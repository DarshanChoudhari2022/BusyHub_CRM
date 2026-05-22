import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mjqwayymtzptnfesnbmy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcXdheXltdHpwdG5mZXNuYm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MzU4ODksImV4cCI6MjA5NTAxMTg4OX0.hN1CdDrxmrna14ITV2oGz11mxZmSrJeTv-172VICf6g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
