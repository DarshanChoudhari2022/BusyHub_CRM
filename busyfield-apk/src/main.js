import { supabase } from './supabase.js';

// ─── Constants ─────────────────────────────────────────────────────────────────
const HEARTBEAT_MS = 2 * 60 * 1000;   // push location every 2 min
const MIN_ACCURACY_M = 200;            // reject visit if GPS fuzzier than this
const STATS_INTERVAL = 30_000;         // refresh dashboard stats every 30s
const LOCATION_CHECK_MS = 60_000;      // check location permission every 60s (reduced frequency)
const MAX_PHOTO_SIZE = 800;            // max dimension for photo compression
const PHOTO_QUALITY = 0.6;            // JPEG quality for compression

// ─── App state ─────────────────────────────────────────────────────────────────
let currentUser = null;
let isTracking = false;
let heartbeatTimer = null;
let statsTimer = null;
let locationWatchdogTimer = null;
let activeShiftId = null;
let lastSyncTs = null;
let selfieFile = null;
let buildingFile = null;
let visitsRange = 'today';
let cachedVisits = [];
let employeeProject = 'society_one'; // 'society_one', 'smart_tap_ai', 'both'
let shiftStartSelfie = null;
let shiftEndSelfie = null;
let noWorkFlag = false;
let shopSelfieFile = null;
let shopBuildingFile = null;
let shopInterest = 'interested';
let cachedShopVisits = [];
let locationGranted = false;
let shiftTransitioning = false; // prevent double-tap glitch on shift buttons

// ─── DOM helpers ───────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function show(el) { if (typeof el === 'string') el = $(el); el?.classList.add('active'); }
function hide(el) { if (typeof el === 'string') el = $(el); el?.classList.remove('active'); }

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  show(`#${id}`);
}

function showTab(name) {
  $$('.tab-page').forEach(p => p.classList.remove('active'));
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  show(`#tab-${name}`);
  document.querySelector(`.tab-btn[data-tab="${name}"]`)?.classList.add('active');
  if (name === 'assignments') loadAssignments();
  if (name === 'visits') loadMyVisits();
  if (name === 'dashboard') loadDashboardStats();
}

function applyProjectFilter() {
  const isSociety = employeeProject === 'society_one' || employeeProject === 'both';
  const isSmartTap = employeeProject === 'smart_tap_ai' || employeeProject === 'both';

  // Show/hide project-specific tab buttons
  $$('.tab-btn.project-society').forEach(el => el.style.display = isSociety ? '' : 'none');
  $$('.tab-btn.project-smart-tap').forEach(el => el.style.display = isSmartTap ? '' : 'none');
}

let toastTimeout;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.className = 'toast', 3000);
}

// ─── Geolocation helper ────────────────────────────────────────────────────────
function getCurrentPosition(highAccuracy = true) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: 15000,
      maximumAge: 10000,
    });
  });
}

// ─── Photo Compression Helper ──────────────────────────────────────────────────
function compressPhoto(file) {
  return new Promise((resolve) => {
    // If file is small enough, skip compression
    if (file.size < 200 * 1024) { // less than 200KB
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        // Scale down if needed
        if (w > MAX_PHOTO_SIZE || h > MAX_PHOTO_SIZE) {
          if (w > h) {
            h = Math.round(h * MAX_PHOTO_SIZE / w);
            w = MAX_PHOTO_SIZE;
          } else {
            w = Math.round(w * MAX_PHOTO_SIZE / h);
            h = MAX_PHOTO_SIZE;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressed = new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' });
            resolve(compressed);
          } else {
            resolve(file); // fallback to original
          }
        }, 'image/jpeg', PHOTO_QUALITY);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ─── Location Permission Enforcer ──────────────────────────────────────────────
function createLocationBlocker() {
  // Create a fullscreen blocking overlay — no way to close it
  if (document.getElementById('location-blocker')) return;
  const overlay = document.createElement('div');
  overlay.id = 'location-blocker';
  overlay.innerHTML = `
    <div style="
      position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:99999;
      background:linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:32px; box-sizing:border-box; color:#E2E8F0; text-align:center;
    ">
      <svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="#F59E0B" stroke-width="2" style="margin-bottom:24px">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <h2 style="font-size:22px; font-weight:800; margin:0 0 12px; color:#F8FAFC">Location Access Required</h2>
      <p style="font-size:15px; color:#94A3B8; max-width:320px; line-height:1.5; margin:0 0 24px">
        BuzyHub Field requires your live location during office hours to track field operations.
        This app cannot function without location access.
      </p>
      <button id="btn-grant-location" style="
        background:linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        color:white; border:none; border-radius:12px; padding:16px 48px;
        font-size:16px; font-weight:700; cursor:pointer; width:100%; max-width:300px;
        box-shadow: 0 4px 14px rgba(59,130,246,0.4);
      ">Allow Location Access</button>
      <p style="font-size:12px; color:#64748B; margin-top:16px; max-width:280px; line-height:1.4">
        If you previously denied permission, go to<br>
        <strong style="color:#94A3B8">Settings → Apps → BuzyHub Field → Permissions → Location → Allow all the time</strong>
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('btn-grant-location').addEventListener('click', requestLocationPermission);
}

function removeLocationBlocker() {
  const blocker = document.getElementById('location-blocker');
  if (blocker) blocker.remove();
}

async function requestLocationPermission() {
  try {
    // This triggers the native Android permission dialog via the WebView
    const pos = await getCurrentPosition(true);
    locationGranted = true;
    removeLocationBlocker();
    toast('Location access granted!', 'success');
    updateStatusList();
    return true;
  } catch (err) {
    console.log('Location permission denied or failed:', err.message);
    locationGranted = false;
    // Keep the blocker visible — show error feedback
    const btn = document.getElementById('btn-grant-location');
    if (btn) {
      btn.textContent = 'Permission Denied — Tap to Try Again';
      btn.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
      btn.style.boxShadow = '0 4px 14px rgba(239,68,68,0.4)';
      setTimeout(() => {
        btn.textContent = 'Allow Location Access';
        btn.style.background = 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
        btn.style.boxShadow = '0 4px 14px rgba(59,130,246,0.4)';
      }, 3000);
    }
    return false;
  }
}

async function checkLocationPermission() {
  try {
    // Use Permissions API first (faster, no GPS needed)
    if (navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') {
        locationGranted = true;
        removeLocationBlocker();
        return true;
      } else if (status.state === 'denied') {
        locationGranted = false;
        createLocationBlocker();
        return false;
      }
      // 'prompt' state — don't show blocker, don't trigger prompt automatically
      // Only show blocker if we haven't established permission yet
    }
    // Fallback: actually try to get position (only if we haven't confirmed permission yet)
    if (!locationGranted) {
      await getCurrentPosition(false);
      locationGranted = true;
      removeLocationBlocker();
    }
    return true;
  } catch {
    locationGranted = false;
    createLocationBlocker();
    return false;
  }
}

function startLocationWatchdog() {
  if (locationWatchdogTimer) clearInterval(locationWatchdogTimer);
  locationWatchdogTimer = setInterval(async () => {
    // Only re-check if permission was previously denied
    // If already granted, just verify it hasn't been revoked
    if (locationGranted) {
      // Quick non-intrusive check using Permissions API only
      try {
        if (navigator.permissions) {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (status.state === 'denied') {
            locationGranted = false;
            createLocationBlocker();
          }
          // If still 'granted', do nothing — no popup, no GPS call
        }
      } catch { /* ignore */ }
    } else {
      // Permission not granted — re-check
      await checkLocationPermission();
    }
  }, LOCATION_CHECK_MS);
}

async function enforceLocationOnBoot() {
  // Immediately check and request location permission
  const granted = await checkLocationPermission();
  if (!granted) {
    createLocationBlocker();
  }
  // Start watchdog regardless — continuously monitors
  startLocationWatchdog();
  return granted;
}

// ─── Photo upload helper ───────────────────────────────────────────────────────
async function uploadPhoto(file, userId, kind) {
  try {
    // Compress photo before upload for speed
    const compressed = await compressPhoto(file);
    const path = `${userId}/${Date.now()}-${kind}.jpg`;
    const arrayBuffer = await compressed.arrayBuffer();
    const { error } = await supabase.storage
      .from('field-evidence')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
    if (error) { console.log('upload error', error.message); return null; }
    const { data } = supabase.storage.from('field-evidence').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.log('uploadPhoto error', e);
    return null;
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    enterApp();
  } else {
    showScreen('login');
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      enterApp();
    } else {
      currentUser = null;
      exitApp();
    }
  });
}

async function handleLogin() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errEl = $('#login-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Enter email and password'; return; }

  $('#btn-login').disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $('#btn-login').disabled = false;

  if (error) { errEl.textContent = error.message; }
}

async function handleLogout() {
  await stopTracking();
  await supabase.auth.signOut();
}

async function enterApp() {
  showScreen('app');

  // Fetch employee's project assignment
  if (currentUser) {
    const { data: empRow } = await supabase.from('employees')
      .select('project').eq('id', currentUser.id).maybeSingle();
    employeeProject = empRow?.project || 'society_one';
  }
  applyProjectFilter();

  showTab('dashboard');
  loadDashboardStats();
  reconcileShift();
  statsTimer = setInterval(loadDashboardStats, STATS_INTERVAL);
}

function exitApp() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
  isTracking = false;
  activeShiftId = null;
  showScreen('login');
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────
async function loadDashboardStats() {
  if (!currentUser) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const visitTable = employeeProject === 'smart_tap_ai' ? 'shop_visits' : 'society_data';
  const [empRes, countRes] = await Promise.all([
    supabase.from('employees').select('lead_target_daily').eq('id', currentUser.id).maybeSingle(),
    supabase.from(visitTable).select('id', { count: 'exact', head: true })
      .eq('employee_id', currentUser.id)
      .gte('created_at', start.toISOString()),
  ]);

  const target = empRes.data?.lead_target_daily || 15;
  const visited = countRes.count || 0;
  const pct = target > 0 ? Math.min(100, Math.round((visited / target) * 100)) : 0;

  $('#stat-target').textContent = target;
  $('#stat-visited').textContent = visited;
  const pctEl = $('#stat-progress');
  pctEl.textContent = pct + '%';
  pctEl.className = 'stat-value ' + (pct >= 100 ? 'green' : 'accent');
  $('#progress-bar').style.width = pct + '%';

  updateTrackingUI();
  updateStatusList();
}

function updateTrackingUI() {
  const desc = $('#tracking-desc');
  const startBtn = $('#btn-start-shift');
  const stopBtn = $('#btn-stop-shift');
  if (isTracking) {
    desc.textContent = `Your location is being shared. Last sync: ${formatRelative(lastSyncTs)}.`;
    startBtn.style.display = 'none';
    stopBtn.style.display = '';
    stopBtn.disabled = shiftTransitioning;
  } else {
    desc.textContent = 'Start your shift to share your location with your manager.';
    startBtn.style.display = '';
    startBtn.disabled = shiftTransitioning;
    stopBtn.style.display = 'none';
  }
}

function formatRelative(ts) {
  if (!ts) return 'never';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  return Math.floor(diff / 3600000) + 'h ago';
}

async function updateStatusList() {
  const list = $('#status-list');
  let gpsOk = false;

  // Use locationGranted flag which is always kept in sync — no extra GPS call
  const permOk = locationGranted;

  try {
    // Only test GPS if permission is granted
    if (permOk) {
      await getCurrentPosition(false);
      gpsOk = true;
    }
  } catch { gpsOk = false; }

  const rows = [
    { ok: gpsOk, label: gpsOk ? 'GPS: Available' : 'GPS: Unavailable' },
    { ok: permOk, label: permOk ? 'Location permission: Granted' : 'Location permission: Not granted' },
    { ok: isTracking, label: isTracking ? 'Tracking: Running' : 'Tracking: Stopped' },
    { ok: lastSyncTs && (Date.now() - lastSyncTs < 5 * 60000), label: `Last sync: ${formatRelative(lastSyncTs)}` },
  ];

  list.innerHTML = rows.map(r =>
    `<div class="status-row"><span class="dot ${r.ok ? 'dot-green' : 'dot-amber'}"></span><span>${r.label}</span></div>`
  ).join('');
}

// ─── Shift & Tracking ──────────────────────────────────────────────────────────
async function reconcileShift() {
  if (!currentUser) return;
  const { data: openShift } = await supabase
    .from('employee_shifts')
    .select('id')
    .eq('employee_id', currentUser.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openShift?.id) {
    activeShiftId = openShift.id;
    isTracking = true;
    startHeartbeat();
    updateTrackingUI();
  }
}

function handleStartShift() {
  if (!currentUser || shiftTransitioning) return;
  // Reset modal state
  shiftStartSelfie = null;
  noWorkFlag = false;
  $('#shift-planned-work').value = '';
  $('#shift-start-error').textContent = '';
  resetPhotoBox('photo-shift-start', 'Tap to take selfie');
  $('#btn-no-work-flag').classList.remove('no-work-active');
  $('#btn-no-work-flag').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> No Work Assigned Today';
  $('#shift-start-modal').classList.add('open');
}

async function confirmStartShift() {
  if (!currentUser || shiftTransitioning) return;
  const errEl = $('#shift-start-error');
  errEl.textContent = '';

  if (!shiftStartSelfie) {
    errEl.textContent = 'Please take a selfie to start your shift.';
    return;
  }

  const plannedWork = $('#shift-planned-work').value.trim();
  if (!plannedWork && !noWorkFlag) {
    errEl.textContent = 'Enter your planned work or tap "No Work Assigned".';
    return;
  }

  const btn = $('#btn-confirm-shift-start');
  btn.disabled = true;
  shiftTransitioning = true;
  btn.textContent = 'Getting location...';

  // Request location
  try {
    await getCurrentPosition();
  } catch (e) {
    errEl.textContent = 'Please allow location access to start your shift.';
    btn.disabled = false;
    shiftTransitioning = false;
    btn.textContent = 'Start Shift';
    return;
  }

  let startLat = null, startLng = null;
  try {
    const pos = await getCurrentPosition();
    startLat = pos.coords.latitude;
    startLng = pos.coords.longitude;
  } catch { /* non-fatal */ }

  btn.textContent = 'Uploading selfie...';
  const selfieUrl = await uploadPhoto(shiftStartSelfie, currentUser.id, 'shift-start');

  btn.textContent = 'Starting shift...';
  const { data: row, error } = await supabase
    .from('employee_shifts')
    .insert({
      employee_id: currentUser.id,
      start_lat: startLat,
      start_lng: startLng,
      start_selfie_url: selfieUrl,
      planned_work: plannedWork || null,
      no_work_flag: noWorkFlag,
    })
    .select('id')
    .single();

  btn.disabled = false;
  shiftTransitioning = false;
  btn.textContent = 'Start Shift';

  if (error) {
    if (error.code === '23505') {
      errEl.textContent = 'A shift is already open. Stop it first.';
      await reconcileShift();
    } else {
      errEl.textContent = error.message || 'Could not start shift';
    }
    return;
  }

  activeShiftId = row?.id || null;
  isTracking = true;
  startHeartbeat();
  updateTrackingUI();
  $('#shift-start-modal').classList.remove('open');
  toast('Shift started! Your location is being shared.', 'success');
}

async function handleStopShift() {
  if (!currentUser || !activeShiftId || shiftTransitioning) return;

  // Check shift duration for early-end warning
  const { data: shiftRow } = await supabase
    .from('employee_shifts')
    .select('started_at')
    .eq('id', activeShiftId)
    .maybeSingle();

  const SHIFT_HOURS = 8;
  let elapsedMin = 0;
  if (shiftRow?.started_at) {
    elapsedMin = Math.max(0, Math.round((Date.now() - new Date(shiftRow.started_at).getTime()) / 60000));
  }

  // Reset modal state
  shiftEndSelfie = null;
  $('#shift-work-summary').value = '';
  $('#shift-shops-count').value = '';
  $('#shift-end-error').textContent = '';
  resetPhotoBox('photo-shift-end', 'Tap to take selfie');

  // Show early warning if < 8 hours
  const warningEl = $('#early-shift-warning');
  if (elapsedMin < SHIFT_HOURS * 60) {
    const hrs = Math.floor(elapsedMin / 60);
    const mins = elapsedMin % 60;
    $('#early-warning-text').textContent = `You've worked ${hrs}h ${mins}m of your ${SHIFT_HOURS}-hour shift. This will be recorded.`;
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }

  $('#shift-end-modal').classList.add('open');
}

async function confirmEndShift() {
  if (!currentUser || !activeShiftId || shiftTransitioning) return;
  const errEl = $('#shift-end-error');
  errEl.textContent = '';

  if (!shiftEndSelfie) {
    errEl.textContent = 'Please take a selfie to end your shift.';
    return;
  }

  const workSummary = $('#shift-work-summary').value.trim();
  if (!workSummary) {
    errEl.textContent = 'Please fill in your work summary for today.';
    return;
  }

  const btn = $('#btn-confirm-shift-end');
  btn.disabled = true;
  shiftTransitioning = true;
  btn.textContent = 'Uploading selfie...';

  const endSelfieUrl = await uploadPhoto(shiftEndSelfie, currentUser.id, 'shift-end');

  btn.textContent = 'Ending shift...';

  let endLat = null, endLng = null;
  try {
    const pos = await getCurrentPosition(false);
    endLat = pos.coords.latitude;
    endLng = pos.coords.longitude;
  } catch { /* non-fatal */ }

  // Compute shift duration + visit count
  const { data: shiftRow } = await supabase
    .from('employee_shifts')
    .select('started_at')
    .eq('id', activeShiftId)
    .maybeSingle();

  let durationMin = null, visitCount = 0;
  if (shiftRow?.started_at) {
    const started = new Date(shiftRow.started_at);
    durationMin = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    const { count } = await supabase
      .from('society_data')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', currentUser.id)
      .gte('created_at', started.toISOString());
    visitCount = count || 0;
  }

  const shopsCount = $('#shift-shops-count').value ? parseInt($('#shift-shops-count').value) : visitCount;

  await supabase.from('employee_shifts').update({
    ended_at: new Date().toISOString(),
    end_lat: endLat,
    end_lng: endLng,
    end_selfie_url: endSelfieUrl,
    duration_min: durationMin,
    visit_count: shopsCount,
    work_summary: workSummary,
  }).eq('id', activeShiftId);

  // Stop tracking
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  isTracking = false;
  activeShiftId = null;
  shiftTransitioning = false;
  updateTrackingUI();

  btn.disabled = false;
  btn.textContent = 'End Shift';
  $('#shift-end-modal').classList.remove('open');
  toast('Shift ended successfully.', 'success');
  loadDashboardStats();
}

async function stopTracking() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  isTracking = false;
  updateTrackingUI();

  if (!currentUser || !activeShiftId) return;

  // Fallback for logout without end-shift modal
  let endLat = null, endLng = null;
  try {
    const pos = await getCurrentPosition(false);
    endLat = pos.coords.latitude;
    endLng = pos.coords.longitude;
  } catch { /* non-fatal */ }

  const { data: shiftRow } = await supabase
    .from('employee_shifts')
    .select('started_at')
    .eq('id', activeShiftId)
    .maybeSingle();

  let durationMin = null, visitCount = 0;
  if (shiftRow?.started_at) {
    const started = new Date(shiftRow.started_at);
    durationMin = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    const { count } = await supabase
      .from('society_data')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', currentUser.id)
      .gte('created_at', started.toISOString());
    visitCount = count || 0;
  }

  await supabase.from('employee_shifts').update({
    ended_at: new Date().toISOString(),
    end_lat: endLat,
    end_lng: endLng,
    duration_min: durationMin,
    visit_count: visitCount,
  }).eq('id', activeShiftId);

  activeShiftId = null;
  toast('Shift ended.', 'success');
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  pushLocation(); // immediate first tick
  heartbeatTimer = setInterval(pushLocation, HEARTBEAT_MS);
}

async function pushLocation() {
  if (!currentUser) return;
  try {
    const pos = await getCurrentPosition(false);
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
    const now = new Date().toISOString();

    await Promise.all([
      supabase.from('employees').update({
        current_lat: lat,
        current_lng: lng,
        last_location_update: now,
      }).eq('id', currentUser.id),
      supabase.from('employee_location_history').insert({
        employee_id: currentUser.id,
        lat, lng,
        timestamp: now,
        accuracy_m: accuracy,
        is_mock: false,
      }),
    ]);
    lastSyncTs = Date.now();
    // Confirm permission is working
    locationGranted = true;
  } catch (e) {
    console.log('pushLocation failed:', e);
  }
}

// ─── Assignments ───────────────────────────────────────────────────────────────
async function loadAssignments() {
  if (!currentUser) return;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('assigned_societies')
    .select('id, society_name, address, lat, lng, priority, notes, visited_at, assigned_date')
    .eq('employee_id', currentUser.id)
    .gte('assigned_date', todayStart.toISOString())
    .lte('assigned_date', todayEnd.toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  const list = $('#assignments-list');
  const subtitle = $('#assignments-subtitle');

  if (error) {
    subtitle.textContent = 'Failed to load assignments';
    list.innerHTML = '';
    return;
  }

  const assignments = data || [];
  const pending = assignments.filter(a => !a.visited_at);
  const visited = assignments.filter(a => a.visited_at);

  subtitle.textContent = assignments.length === 0
    ? 'No assignments for today.'
    : `${visited.length} / ${assignments.length} completed`;

  if (assignments.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Your manager hasn\'t assigned any societies for today.</p></div>';
    return;
  }

  let html = '';
  if (pending.length > 0) {
    html += '<p style="font-size:14px;font-weight:700;color:#E2E8F0;margin-bottom:6px">Pending</p>';
    html += pending.map(a => assignCard(a, false)).join('');
  }
  if (visited.length > 0) {
    html += '<p style="font-size:14px;font-weight:700;color:#E2E8F0;margin:12px 0 6px">Completed</p>';
    html += visited.map(a => assignCard(a, true)).join('');
  }
  list.innerHTML = html;
}

function assignCard(a, done) {
  return `<div class="assign-card ${done ? 'done' : 'pending'}">
    <div class="assign-header">
      <div style="display:flex;align-items:center;gap:8px;flex:1">
        <svg class="assign-status-icon" viewBox="0 0 24 24" width="18" height="18" fill="${done ? '#22C55E' : 'none'}" stroke="${done ? '#22C55E' : '#F59E0B'}" stroke-width="2"><circle cx="12" cy="12" r="10"/>${done ? '<polyline points="9 12 11 14 15 10"/>' : ''}</svg>
        <span class="assign-name">${esc(a.society_name)}</span>
      </div>
      ${a.priority > 0 ? `<span class="assign-badge">P${a.priority}</span>` : ''}
    </div>
    ${a.address ? `<div class="assign-address" style="margin-left:26px">${esc(a.address)}</div>` : ''}
    ${a.notes ? `<div class="assign-notes" style="margin-left:26px">${esc(a.notes)}</div>` : ''}
    ${!done ? `<button class="assign-done-btn" data-assign-id="${a.id}">Mark Done</button>` : ''}
  </div>`;
}

async function markAssignmentDone(assignId) {
  const btn = document.querySelector(`[data-assign-id="${assignId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  const { error } = await supabase.from('assigned_societies')
    .update({ visited_at: new Date().toISOString() })
    .eq('id', assignId);
  if (error) {
    toast('Failed to mark done: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Mark Done'; }
  } else {
    toast('Assignment marked done!', 'success');
    loadAssignments();
    loadDashboardStats();
  }
}

// ─── My Visits ──────────────────────────────────────────────────────────────────
function getDateRange(range) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - start.getDay());
  if (range === 'month') start.setDate(1);
  return start.toISOString();
}

async function loadMyVisits() {
  if (!currentUser) return;

  // For smart_tap_ai project, load shop visits instead
  if (employeeProject === 'smart_tap_ai') {
    return loadShopVisits();
  }
  // For 'both' project, load society visits in main list (shop visits in Shop tab)

  const list = $('#visits-list');
  const subtitle = $('#visits-subtitle');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const since = getDateRange(visitsRange);
  const { data, error } = await supabase.from('society_data')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', currentUser.id)
    .gte('created_at', since);

  if (error) {
    subtitle.textContent = 'Failed to load';
    list.innerHTML = `<div class="empty-state"><p>${error.message}</p></div>`;
    return;
  }

  const count = data?.length || 0;
  const rangeLabel = visitsRange === 'today' ? 'today' : visitsRange === 'week' ? 'this week' : 'this month';
  subtitle.textContent = `${count} societ${count === 1 ? 'y' : 'ies'} visited ${rangeLabel}`;

  if (count === 0) {
    list.innerHTML = `
      <div class="visits-count-card">
        <div class="visits-count-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#64748B" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="visits-count-number">0</div>
        <div class="visits-count-label">No visits logged ${rangeLabel}</div>
        <div class="visits-count-hint">Start logging visits from the Log tab</div>
      </div>`;
    return;
  }

  // Show count-only card with a clean UI
  list.innerHTML = `
    <div class="visits-count-card">
      <div class="visits-count-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#22C55E" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="visits-count-number">${count}</div>
      <div class="visits-count-label">Societ${count === 1 ? 'y' : 'ies'} Visited</div>
      <div class="visits-count-period">${rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1)}</div>
      <div class="visits-count-hint">Your total count is preserved securely</div>
    </div>`;
}

// ─── Visit Detail Modal ──────────────────────────────────────────────────────────
function openVisitModal(visitId) {
  toast('Details are not available for visits.', 'error');
  return;
}

function openShopVisitModal(shopVisitId) {
  toast('Details are not available for visits.', 'error');
  return;
}


function closeModal() { $('#visit-modal').classList.remove('open'); }

function openEditForm(v) {
  const body = $('#modal-body');
  $('#modal-title').textContent = 'Edit Visit';
  body.innerHTML = `
    <div class="modal-edit-form">
      <div class="form-group"><label>Society Name</label><input id="edit-name" type="text" value="${esc(v.name)}" /></div>
      <div class="form-group"><label>Address</label><input id="edit-address" type="text" value="${esc(v.address || '')}" /></div>
      <div class="form-group"><label>Contact Person</label><input id="edit-contact" type="text" value="${esc(v.contact_person || '')}" /></div>
      <div class="form-group"><label>Contact Phone</label><input id="edit-phone" type="tel" value="${esc(v.contact_phone || '')}" /></div>
      <div class="form-group"><label>Number of Flats</label><input id="edit-flats" type="number" value="${v.number_of_flats || ''}" inputmode="numeric" /></div>
      <div class="modal-actions">
        <button class="btn btn-outline-danger btn-sm" id="btn-cancel-edit">Cancel</button>
        <button class="btn btn-primary btn-sm" id="btn-save-edit" data-vid="${v.id}">Save</button>
      </div>
    </div>
  `;
  $('#btn-cancel-edit').addEventListener('click', () => { closeModal(); });
  $('#btn-save-edit').addEventListener('click', () => saveVisitEdit(v.id));
}

async function saveVisitEdit(visitId) {
  const btn = $('#btn-save-edit');
  btn.disabled = true; btn.textContent = 'Saving...';

  const updates = {
    name: $('#edit-name').value.trim(),
    address: $('#edit-address').value.trim(),
    contact_person: $('#edit-contact').value.trim() || null,
    contact_phone: $('#edit-phone').value.trim() || null,
    number_of_flats: $('#edit-flats').value ? parseInt($('#edit-flats').value) : null,
  };

  if (!updates.name) { toast('Society name is required', 'error'); btn.disabled = false; btn.textContent = 'Save'; return; }

  const { error } = await supabase.from('society_data').update(updates).eq('id', visitId);
  if (error) {
    toast('Save failed: ' + error.message, 'error');
    btn.disabled = false; btn.textContent = 'Save';
  } else {
    toast('Visit updated!', 'success');
    closeModal();
    loadMyVisits();
  }
}

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── Smart Tap AI Shop Visit ────────────────────────────────────────────────────
async function handleSubmitShop() {
  const personName = $('#shop-person-name').value.trim();
  const mobile = $('#shop-mobile').value.trim();
  const shopName = $('#shop-name').value.trim();
  const nextCall = $('#shop-next-call').value;
  const notes = $('#shop-notes').value.trim();
  const errEl = $('#shop-error');
  const successEl = $('#shop-success');
  errEl.textContent = '';
  successEl.textContent = '';

  if (!personName || !mobile) {
    errEl.textContent = 'Person name and mobile number are required.';
    return;
  }

  const btn = $('#btn-submit-shop');
  btn.disabled = true;
  btn.textContent = 'Getting location...';

  let lat = null, lng = null, accuracy = null;
  try {
    const pos = await getCurrentPosition(true);
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Submit Shop Visit';
    errEl.textContent = 'Could not get GPS location. Move outdoors and try again.';
    return;
  }

  btn.textContent = 'Uploading photos...';
  let selfieUrl = null, shopPhotoUrl = null;
  if (shopSelfieFile) selfieUrl = await uploadPhoto(shopSelfieFile, currentUser.id, 'shop-selfie');
  if (shopBuildingFile) shopPhotoUrl = await uploadPhoto(shopBuildingFile, currentUser.id, 'shop-photo');

  const googleMapLink = `https://www.google.com/maps?q=${lat},${lng}`;

  btn.textContent = 'Submitting...';
  const { error } = await supabase.from('shop_visits').insert({
    employee_id: currentUser.id,
    person_name: personName,
    mobile,
    shop_name: shopName || null,
    interest_status: shopInterest,
    lat, lng,
    accuracy_m: accuracy,
    selfie_url: selfieUrl,
    shop_photo_url: shopPhotoUrl,
    next_call_date: nextCall || null,
    notes: notes || null,
    google_map_link: googleMapLink,
  });

  btn.disabled = false;
  btn.textContent = 'Submit Shop Visit';

  if (error) {
    errEl.textContent = 'Error: ' + error.message;
    return;
  }

  successEl.textContent = 'Shop visit logged successfully!';
  $('#shop-person-name').value = '';
  $('#shop-mobile').value = '';
  $('#shop-name').value = '';
  $('#shop-next-call').value = '';
  $('#shop-notes').value = '';
  shopSelfieFile = null;
  shopBuildingFile = null;
  shopInterest = 'interested';
  resetPhotoBox('photo-shop-selfie', 'Your Selfie');
  resetPhotoBox('photo-shop-building', 'Shop Photo');
  // Reset pill selection
  $$('.pill-btn').forEach(b => b.classList.remove('active'));
  $('.pill-btn[data-interest="interested"]')?.classList.add('active');

  loadDashboardStats();
  setTimeout(() => { successEl.textContent = ''; }, 5000);
}

async function loadShopVisits() {
  if (!currentUser) return;
  const list = $('#visits-list');
  const subtitle = $('#visits-subtitle');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const since = getDateRange(visitsRange);
  const { count, error } = await supabase.from('shop_visits')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', currentUser.id)
    .gte('created_at', since);

  if (error) {
    subtitle.textContent = 'Failed to load';
    list.innerHTML = `<div class="empty-state"><p>${error.message}</p></div>`;
    return;
  }

  const totalCount = count || 0;
  const rangeLabel = visitsRange === 'today' ? 'today' : visitsRange === 'week' ? 'this week' : 'this month';
  subtitle.textContent = `${totalCount} shop${totalCount === 1 ? '' : 's'} visited ${rangeLabel}`;

  if (totalCount === 0) {
    list.innerHTML = `
      <div class="visits-count-card">
        <div class="visits-count-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#64748B" stroke-width="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div class="visits-count-number">0</div>
        <div class="visits-count-label">No shop visits logged ${rangeLabel}</div>
        <div class="visits-count-hint">Start logging visits from the Shop tab</div>
      </div>`;
    return;
  }

  list.innerHTML = `
    <div class="visits-count-card">
      <div class="visits-count-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#22C55E" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="visits-count-number">${totalCount}</div>
      <div class="visits-count-label">Shop${totalCount === 1 ? '' : 's'} Visited</div>
      <div class="visits-count-period">${rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1)}</div>
      <div class="visits-count-hint">Your total count is preserved securely</div>
    </div>`;
}

// ─── Log Visit ─────────────────────────────────────────────────────────────────
async function handleSubmitVisit() {
  const name = $('#visit-name').value.trim();
  const address = $('#visit-address').value.trim();
  const contactPerson = $('#visit-contact').value.trim();
  const contactPhone = $('#visit-phone').value.trim();
  const flatsRaw = $('#visit-flats').value.trim();
  const errEl = $('#visit-error');
  const successEl = $('#visit-success');
  errEl.textContent = '';
  successEl.textContent = '';

  if (!name || !address) {
    errEl.textContent = 'Society name and address are required.';
    return;
  }

  const btn = $('#btn-submit-visit');
  btn.disabled = true;
  btn.textContent = 'Getting location...';

  // Get GPS position
  let lat = null, lng = null, accuracy = null;
  try {
    const pos = await getCurrentPosition(true);
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Submit Visit';
    errEl.textContent = 'Could not get GPS location. Move outdoors and try again.';
    return;
  }

  if (accuracy != null && accuracy > MIN_ACCURACY_M) {
    btn.disabled = false;
    btn.textContent = 'Submit Visit';
    errEl.textContent = `GPS accuracy too low (${Math.round(accuracy)}m). Move to an open area (need < ${MIN_ACCURACY_M}m).`;
    return;
  }

  btn.textContent = 'Uploading photos...';

  // Upload photos
  let selfieUrl = null, buildingUrl = null;
  if (selfieFile) selfieUrl = await uploadPhoto(selfieFile, currentUser.id, 'selfie');
  if (buildingFile) buildingUrl = await uploadPhoto(buildingFile, currentUser.id, 'building');

  btn.textContent = 'Submitting...';

  const { data: visitRow, error } = await supabase.from('society_data')
    .insert({
      employee_id: currentUser.id,
      name,
      address,
      contact_person: contactPerson || null,
      contact_phone: contactPhone || null,
      number_of_flats: flatsRaw ? parseInt(flatsRaw) : null,
      status: 'Pending',
      lat, lng,
      accuracy_m: accuracy,
      is_mock: false,
      selfie_url: selfieUrl,
      building_photo_url: buildingUrl,
      verification_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    btn.disabled = false;
    btn.textContent = 'Submit Visit';
    errEl.textContent = 'Error: ' + error.message;
    return;
  }

  // Auto-match to today's assignment
  if (visitRow?.id) {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { data: candidates } = await supabase
        .from('assigned_societies')
        .select('id, society_name')
        .eq('employee_id', currentUser.id)
        .is('visited_at', null)
        .gte('assigned_date', todayStart.toISOString())
        .lte('assigned_date', todayEnd.toISOString());

      if (candidates?.length) {
        const normName = name.toLowerCase();
        const match = candidates.find(c => c.society_name.trim().toLowerCase() === normName);
        if (match) {
          await supabase.from('assigned_societies')
            .update({ visited_at: new Date().toISOString(), visit_id: visitRow.id })
            .eq('id', match.id);
        }
      }
    } catch { /* non-fatal */ }
  }

  // Reset form
  btn.disabled = false;
  btn.textContent = 'Submit Visit';
  successEl.textContent = 'Visit logged successfully! The calling team will verify it.';
  $('#visit-name').value = '';
  $('#visit-address').value = '';
  $('#visit-contact').value = '';
  $('#visit-phone').value = '';
  $('#visit-flats').value = '';
  selfieFile = null;
  buildingFile = null;
  resetPhotoBox('photo-selfie', 'Take Selfie');
  resetPhotoBox('photo-building', 'Building Photo');
  $('#visit-location-info').classList.remove('visible');

  // Refresh dashboard stats
  loadDashboardStats();

  setTimeout(() => { successEl.textContent = ''; }, 5000);
}

function resetPhotoBox(id, label) {
  const box = $(`#${id}`);
  const img = box.querySelector('img');
  if (img) img.remove();
  const check = box.querySelector('.photo-check');
  if (check) check.remove();
  const span = box.querySelector('span');
  if (span) span.textContent = label;
}

// ─── Photo preview handler ─────────────────────────────────────────────────────
function handlePhotoInput(e) {
  const input = e.target;
  const file = input.files?.[0];
  if (!file) return;
  const kind = input.dataset.kind;
  const box = input.closest('.photo-box');

  // Store the raw file — compression happens on upload
  if (kind === 'selfie') selfieFile = file;
  else if (kind === 'building') buildingFile = file;
  else if (kind === 'shift-start') shiftStartSelfie = file;
  else if (kind === 'shift-end') shiftEndSelfie = file;
  else if (kind === 'shop-selfie') shopSelfieFile = file;
  else if (kind === 'shop-building') shopBuildingFile = file;

  // Show immediate low-res preview via canvas for speed
  const existing = box.querySelector('img');
  if (existing) existing.remove();
  const existingCheck = box.querySelector('.photo-check');
  if (existingCheck) existingCheck.remove();

  // Create fast thumbnail preview using canvas
  const reader = new FileReader();
  reader.onload = (ev) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      // Small thumbnail for preview — much faster than full-size blob URL
      const maxPreview = 200;
      let w = tempImg.width;
      let h = tempImg.height;
      if (w > maxPreview || h > maxPreview) {
        if (w > h) {
          h = Math.round(h * maxPreview / w);
          w = maxPreview;
        } else {
          w = Math.round(w * maxPreview / h);
          h = maxPreview;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempImg, 0, 0, w, h);

      const previewImg = document.createElement('img');
      previewImg.src = canvas.toDataURL('image/jpeg', 0.5);
      box.appendChild(previewImg);

      const check = document.createElement('div');
      check.className = 'photo-check';
      check.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#22C55E"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
      box.appendChild(check);
    };
    tempImg.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── Wire up event listeners ───────────────────────────────────────────────────
function bindEvents() {
  // Login
  $('#btn-login').addEventListener('click', handleLogin);
  $('#login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

  // Logout
  $('#btn-logout').addEventListener('click', handleLogout);

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Shift start/stop
  $('#btn-start-shift').addEventListener('click', handleStartShift);
  $('#btn-stop-shift').addEventListener('click', handleStopShift);

  // Shift start modal
  $('#btn-confirm-shift-start').addEventListener('click', confirmStartShift);
  $('#btn-close-shift-start').addEventListener('click', () => $('#shift-start-modal').classList.remove('open'));
  $('#shift-start-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#shift-start-modal').classList.remove('open'); });

  // No-work flag toggle
  $('#btn-no-work-flag').addEventListener('click', () => {
    noWorkFlag = !noWorkFlag;
    const btn = $('#btn-no-work-flag');
    if (noWorkFlag) {
      btn.classList.add('no-work-active');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> No Work Flagged';
    } else {
      btn.classList.remove('no-work-active');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> No Work Assigned Today';
    }
  });

  // Shift end modal
  $('#btn-confirm-shift-end').addEventListener('click', confirmEndShift);
  $('#btn-close-shift-end').addEventListener('click', () => $('#shift-end-modal').classList.remove('open'));
  $('#shift-end-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#shift-end-modal').classList.remove('open'); });

  // Visit submit
  $('#btn-submit-visit').addEventListener('click', handleSubmitVisit);

  // Shop visit submit
  $('#btn-submit-shop').addEventListener('click', handleSubmitShop);

  // Interest pills (Smart Tap AI form)
  $$('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shopInterest = btn.dataset.interest;
    });
  });

  // Photo inputs
  $$('.photo-input').forEach(input => {
    input.addEventListener('change', handlePhotoInput);
  });

  // Assignment mark-done (delegated)
  document.addEventListener('click', (e) => {
    const doneBtn = e.target.closest('.assign-done-btn');
    if (doneBtn) markAssignmentDone(doneBtn.dataset.assignId);
  });

  // Visits filter buttons
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      visitsRange = btn.dataset.range;
      loadMyVisits();
    });
  });

  // Visit card tap → open detail modal (delegated)
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.visit-card');
    if (card) {
      if (card.dataset.visitId) {
        openVisitModal(card.dataset.visitId);
      } else if (card.dataset.shopVisitId) {
        openShopVisitModal(card.dataset.shopVisitId);
      }
    }
  });

  // Close modal
  $('#btn-close-modal').addEventListener('click', closeModal);
  $('#visit-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  // FIRST: Enforce location permission immediately before anything else
  await enforceLocationOnBoot();

  await initAuth();
  hide('#splash');
});
