import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Play, Square, Route as RouteIcon,
  MapPin, Navigation, X, ExternalLink,
  Activity, CheckCircle2, AlertTriangle, WifiOff,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { EmployeeMovementTimeline } from '@/components/EmployeeMovementTimeline';

type EmpStatus = 'live' | 'recent' | 'stale' | 'offline';

interface Shift {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  start_selfie_url: string | null;
  end_selfie_url: string | null;
  duration_min: number | null;
  visit_count: number | null;
}

interface Props {
  employees: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visitsToday: Record<string, number>;
  shiftsToday: Record<string, Shift>;
  classifyEmployee: (emp: any) => EmpStatus;
  route: [number, number][];
  routeLoading: boolean;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const STATUS_CONFIG: Record<EmpStatus, {
  label: string;
  dot: string;
  border: string;
  badge: string;
  icon: any;
  filterBg: string;
  filterActiveBg: string;
}> = {
  live:    { label: 'Live',     dot: 'bg-green-500',  border: 'border-l-green-500',  badge: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle2,  filterBg: 'bg-green-50 text-green-700 border-green-200',   filterActiveBg: 'bg-green-600 text-white border-green-700' },
  recent:  { label: 'Recent',   dot: 'bg-blue-500',   border: 'border-l-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Clock,         filterBg: 'bg-blue-50 text-blue-700 border-blue-200',     filterActiveBg: 'bg-blue-600 text-white border-blue-700' },
  stale:   { label: 'Stale',    dot: 'bg-amber-500',  border: 'border-l-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200',   icon: AlertTriangle, filterBg: 'bg-amber-50 text-amber-700 border-amber-200',   filterActiveBg: 'bg-amber-600 text-white border-amber-700' },
  offline: { label: 'Offline',  dot: 'bg-slate-300',  border: 'border-l-slate-300',  badge: 'bg-slate-50 text-slate-500 border-slate-200',   icon: WifiOff,       filterBg: 'bg-slate-100 text-slate-600 border-slate-200',  filterActiveBg: 'bg-slate-600 text-white border-slate-700' },
};

type FilterType = 'all' | EmpStatus;

export function MobileTrackingSheet({
  employees, selectedId, onSelect, visitsToday, shiftsToday, classifyEmployee, route, routeLoading
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedEmp = selectedId ? employees.find(e => e.id === selectedId) : null;
  const shift = selectedId ? shiftsToday[selectedId] : null;

  // Expand sheet when an employee is selected
  useEffect(() => { if (selectedId) setExpanded(true); }, [selectedId]);

  // Count employees by status
  const counts: Record<EmpStatus, number> = { live: 0, recent: 0, stale: 0, offline: 0 };
  for (const e of employees) counts[classifyEmployee(e)]++;
  const liveCount = counts.live;

  // Filter employees
  const displayEmployees = filter === 'all'
    ? employees
    : employees.filter(e => classifyEmployee(e) === filter);

  // Sheet heights: collapsed shows handle + header + filters + 1.5 cards ≈ 180px
  const COLLAPSED_H = 190;
  const EXPANDED_H  = Math.min(window.innerHeight * 0.8, 600);

  return (
    <div
      ref={sheetRef}
      className="tracking-bottom-sheet"
      style={{
        height: `${EXPANDED_H}px`,
        transform: expanded ? 'translateY(0)' : `translateY(${EXPANDED_H - COLLAPSED_H}px)`,
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Drag Handle */}
      <div
        className="flex justify-center pt-2 pb-1 cursor-pointer"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>

      {/* ── Header ── */}
      <div
        className="px-4 pt-1 pb-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-foreground">Field Team</span>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-bold border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              {liveCount} Live
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          {employees.length} employees
        </span>
      </div>

      {/* ── Status Filter Pills ── */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
        {/* All filter */}
        <button
          onClick={() => setFilter('all')}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          <Activity className="w-3 h-3" />
          All
          <span className={`ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${filter === 'all' ? 'bg-white/25' : 'bg-white'}`}>
            {employees.length}
          </span>
        </button>

        {/* Status-specific filters */}
        {(['live', 'recent', 'stale', 'offline'] as EmpStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          const isActive = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                isActive ? cfg.filterActiveBg : cfg.filterBg
              }`}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
              <span className={`ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/25' : 'bg-white'}`}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">

        {/* Selected employee expanded card */}
        {selectedEmp && (
          <div className="mb-3 p-3 rounded-xl bg-primary/5 border-2 border-primary/20 shadow-sm">
            {/* Top row: avatar + info + close */}
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <Avatar className="h-11 w-11 border-2 border-primary">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                    {getInitials(selectedEmp.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${STATUS_CONFIG[classifyEmployee(selectedEmp)].dot}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm leading-tight truncate">{selectedEmp.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[classifyEmployee(selectedEmp)].badge}`}>
                    {STATUS_CONFIG[classifyEmployee(selectedEmp)].label}
                  </Badge>
                  {shift && !shift.ended_at && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-semibold">
                      <Play className="w-2.5 h-2.5 fill-green-600" /> Shift Active
                    </span>
                  )}
                  {shift && shift.ended_at && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                      <Square className="w-2.5 h-2.5" /> Shift Ended
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => onSelect(selectedEmp.id)}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Route info */}
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <RouteIcon className="w-3 h-3" />
              {routeLoading ? 'Loading route...' : route.length > 0 ? `${route.length} GPS points tracked today` : 'No route data yet'}
            </div>

            {/* Shift timing */}
            {shift && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                Shift: {format(new Date(shift.started_at), 'h:mm a')}
                {shift.ended_at
                  ? ` → ${format(new Date(shift.ended_at), 'h:mm a')}`
                  : ' → Ongoing'}
              </div>
            )}

            {/* Google Maps deep link */}
            {selectedEmp.current_lat && selectedEmp.current_lng && (
              <a
                href={`https://www.google.com/maps?q=${selectedEmp.current_lat},${selectedEmp.current_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Live Location in Google Maps
              </a>
            )}

            {/* Movement timeline */}
            {shift && (
              <div className="mt-2.5 pt-2.5 border-t border-primary/15">
                <EmployeeMovementTimeline
                  employeeId={selectedEmp.id}
                  employeeName={selectedEmp.name}
                  shiftStartedAt={shift.started_at}
                  shiftEndedAt={shift.ended_at}
                />
              </div>
            )}

            {!shift && (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No shift started today — movement timeline unavailable.
              </div>
            )}
          </div>
        )}

        {/* Employee list */}
        {displayEmployees.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <MapPin className="w-8 h-8 mx-auto mb-3 opacity-20" />
            {filter === 'all' ? 'No employees found.' : `No employees with "${STATUS_CONFIG[filter as EmpStatus]?.label}" status.`}
          </div>
        )}

        {displayEmployees.map(emp => {
          const status = classifyEmployee(emp);
          const cfg = STATUS_CONFIG[status];
          const lastUpdate = emp.last_location_update ? new Date(emp.last_location_update) : null;
          const isSelected = selectedId === emp.id;
          const empShift = shiftsToday[emp.id];
          const visits = visitsToday[emp.id] || 0;

          // Skip selected employee from list (already shown above)
          if (isSelected) return null;

          return (
            <button
              key={emp.id}
              onClick={() => onSelect(emp.id)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white border border-border/60 border-l-4 ${cfg.border} shadow-sm active:bg-slate-50 transition-colors`}
            >
              {/* Avatar with status dot */}
              <div className="relative flex-shrink-0">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                    {getInitials(emp.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dot}`} />
              </div>

              {/* Name + time */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                  {emp.name}
                  {empShift && !empShift.ended_at && (
                    <Play className="w-2.5 h-2.5 text-green-600 fill-green-600 flex-shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                  {lastUpdate ? formatDistanceToNow(lastUpdate, { addSuffix: true }) : 'Never updated'}
                </div>
              </div>

              {/* Right: status + visits */}
              <div className="flex-shrink-0 text-right space-y-1">
                <Badge variant="outline" className={`text-[10px] block ${cfg.badge}`}>
                  {cfg.label}
                </Badge>
                <div className="text-[11px] text-muted-foreground font-medium">
                  {visits} visit{visits !== 1 ? 's' : ''} today
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
