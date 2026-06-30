import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, Sparkles, Loader2, Check, ChevronDown } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { users } from '@/services/mockData';
import type { AssessmentEvent, Task, TaskEffort } from '@/types';
import { tasksApi, usersApi, type ApiTask, type ApiUser } from '@/services/api';
import { cn } from '@/lib/utils';

// Status mapping helpers
function toFrontendStatus(s: string): Task['status'] {
  return s.replace('_', ' ') as Task['status'];
}
function toApiStatus(s: string): ApiTask['status'] {
  return s.replace(' ', '_') as ApiTask['status'];
}
function apiTaskToTask(t: ApiTask): Task {
  const recName = t.recName ?? '';
  return {
    id: t.id, eventId: t.eventId, title: t.title, description: t.description,
    progressNotes: t.progressNotes,
    recId: t.recommendationId ?? `rec-${recName.replace(/\s+/g, '-').toLowerCase()}`,
    recName,
    gapWeight: t.gapWeight ?? 0, status: toFrontendStatus(t.status),
    effort: t.effort, assigneeId: t.assigneeId, priority: t.priority,
    startDate: t.startDate ?? '', dueDate: t.dueDate ?? '',
    dependsOn: [], completionPct: t.completionPct, createdAt: t.createdAt,
  } as unknown as Task;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'Not Started' | 'In Progress' | 'Done' | 'Blocked';
type Effort = TaskEffort;
type GanttTask = Task;

interface RecGroup {
  recId: string;
  recName: string;
  gapWeight: number;
  color: string; // hex accent for group header bar
}

// ─── Mock data ────────────────────────────────────────────────────────────────



// AI-suggested tasks per recommendation name
const AI_SUGGESTIONS: Record<string, Array<{ title: string; effort: Effort }>> = {
  'Architecture Governance': [
    { title: 'Document ARB meeting agenda template',          effort: 'Small'  },
    { title: 'Train project leads on governance process',     effort: 'Medium' },
    { title: 'Create exception-handling workflow',            effort: 'Medium' },
    { title: 'Publish first ARB decision record',             effort: 'Small'  },
    { title: 'Conduct quarterly ARB effectiveness review',    effort: 'Large'  },
  ],
  'Technology & Data': [
    { title: 'Define application classification criteria',    effort: 'Small'  },
    { title: 'Complete integration dependency mapping',       effort: 'Large'  },
    { title: 'Identify top 10 rationalisation candidates',   effort: 'Medium' },
    { title: 'Present portfolio findings to leadership',      effort: 'Small'  },
  ],
  'Data Architecture': [
    { title: 'Run data ownership workshop',                   effort: 'Medium' },
    { title: 'Draft enterprise data glossary',                effort: 'Medium' },
    { title: 'Define data quality measurement framework',     effort: 'Large'  },
    { title: 'Pilot data catalogue with one business domain', effort: 'Medium' },
  ],
  '__default__': [
    { title: 'Define success criteria and KPIs',              effort: 'Small'  },
    { title: 'Assign workstream lead',                        effort: 'Small'  },
    { title: 'Develop implementation plan',                   effort: 'Medium' },
    { title: 'Conduct stakeholder alignment workshop',        effort: 'Medium' },
    { title: 'Review and sign-off milestone',                 effort: 'Small'  },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(iso: string): Date { return new Date(iso + 'T00:00:00'); }
function daysBetween(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86400000); }
// These are used only for Gantt bar display; TaskDetailSheet uses API users instead
function userName(uid?: string) { return uid ? (users.find(u => u.id === uid)?.name ?? uid.slice(0, 6)) : '—'; }
function userInitials(uid?: string) { return uid ? (users.find(u => u.id === uid)?.initials ?? uid.slice(0, 2).toUpperCase()) : ''; }

function isOverdue(task: GanttTask): boolean {
  return task.status !== 'Done' && task.status !== 'Blocked' && parseDate(task.dueDate) < new Date();
}

function barColor(task: GanttTask): string {
  if (task.status === 'Done')        return '#10b981';
  if (task.status === 'Blocked')     return '#ef4444';
  if (isOverdue(task))               return '#f97316';
  if (task.status === 'In Progress') return '#3b82f6';
  return '#94a3b8';
}

function calcReadiness(tasks: GanttTask[]): number {
  const total = tasks.reduce((s, t) => s + t.gapWeight, 0);
  const done  = tasks.filter(t => t.status === 'Done').reduce((s, t) => s + t.gapWeight, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

let _uid = 200;
function uid(): string { return `new-${_uid++}`; }

const STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Done', 'Blocked'];
const EFFORTS:  Effort[]     = ['Small', 'Medium', 'Large'];

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'Done':        'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Blocked':     'bg-red-100 text-red-700 border-red-200',
};

// ─── Readiness Gauge ──────────────────────────────────────────────────────────

function ReadinessGauge({ pct, tasks, groups }: {
  pct: number;
  tasks: GanttTask[];
  groups: RecGroup[];
}) {
  const R = 52;
  const CX = 70;
  const CY = 70;
  const circ = 2 * Math.PI * R;
  const offset = circ - (pct / 100) * circ;
  const gaugeColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#3b82f6';

  const breakdown = groups.map(g => {
    const gTasks = tasks.filter(t => t.recId === g.recId);
    const done   = gTasks.filter(t => t.status === 'Done').length;
    return { name: g.recName, done, total: gTasks.length, color: g.color };
  });

  return (
    <div className="rounded-2xl border bg-card p-6 flex items-start gap-8">
      {/* SVG gauge */}
      <div className="flex flex-col items-center shrink-0">
        <svg width={140} height={140} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
          {/* Track */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e2e8f0" strokeWidth={10} />
          {/* Progress */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          {/* Percentage text */}
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize={22} fontWeight={700} fill="#0f172a">
            {pct}%
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize={9} fill="#64748b">
            READINESS
          </text>
        </svg>
        <p className="text-xs text-center text-muted-foreground mt-1 max-w-[120px] leading-relaxed">
          Readiness for Reassessment
        </p>
      </div>

      {/* Breakdown */}
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Task Completion by Gap</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Based on weighted task completion across all gaps
          </p>
        </div>
        <div className="space-y-2.5">
          {breakdown.map(b => (
            <div key={b.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground truncate">{b.name}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {b.done}/{b.total} done
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: b.total > 0 ? `${(b.done / b.total) * 100}%` : '0%',
                    background: b.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Gantt Chart ──────────────────────────────────────────────────────────────

// Layout constants
const NW    = 220;  // names column width
const HDR_H = 44;   // date header height
const GRP_H = 28;   // group header row height
const ROW_H = 40;   // task row height
const BAR_P = 8;    // vertical padding inside row for bar
const BAR_H = ROW_H - BAR_P * 2;
const PPD   = 28;   // pixels per day

interface RowInfo {
  type: 'group' | 'task';
  y: number;
  label: string;
  task?: GanttTask;
  groupColor?: string;
}

function buildRows(tasks: GanttTask[], groups: RecGroup[]): RowInfo[] {
  const rows: RowInfo[] = [];
  let y = HDR_H;
  groups.forEach(g => {
    rows.push({ type: 'group', y, label: g.recName, groupColor: g.color });
    y += GRP_H;
    tasks.filter(t => t.recId === g.recId).forEach(task => {
      rows.push({ type: 'task', y, label: task.title, task });
      y += ROW_H;
    });
  });
  return rows;
}

function buildMonths(minD: Date, totalDays: number): Array<{ label: string; x: number }> {
  const months: Array<{ label: string; x: number }> = [];
  const d = new Date(minD);
  d.setDate(1);
  while (daysBetween(minD, d) < totalDays) {
    const offset = daysBetween(minD, d);
    if (offset >= 0) {
      months.push({
        label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        x: NW + offset * PPD,
      });
    }
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

interface GanttChartProps {
  tasks: GanttTask[];
  groups: RecGroup[];
  onTaskClick: (task: GanttTask) => void;
}

function GanttChart({ tasks, groups, onTaskClick }: GanttChartProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border text-sm text-muted-foreground">
        No tasks yet. Add tasks via the AI modal or task detail panel.
      </div>
    );
  }

  const dates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.dueDate)]);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  // Pad slightly
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 7);

  const totalDays = daysBetween(minDate, maxDate) + 1;
  const TLW = Math.max(600, totalDays * PPD);
  const SVG_W = NW + TLW;

  const rows = buildRows(tasks, groups);
  const SVG_H = HDR_H + rows.reduce((s, r) => s + (r.type === 'group' ? GRP_H : ROW_H), 0);

  const months = buildMonths(minDate, totalDays);
  const todayX = NW + daysBetween(minDate, new Date()) * PPD;

  // Helper: x position for a date
  function dx(iso: string): number { return NW + Math.max(0, daysBetween(minDate, parseDate(iso))) * PPD; }
  function dw(s: string, e: string): number { return Math.max(PPD * 0.8, daysBetween(parseDate(s), parseDate(e)) * PPD); }

  // Helper: find row y for a task id
  function rowY(id: string): number {
    return rows.find(r => r.task?.id === id)?.y ?? 0;
  }

  return (
    <div className="overflow-auto rounded-xl border">
      <svg
        width={SVG_W}
        height={SVG_H}
        style={{ display: 'block', minWidth: SVG_W }}
        aria-label="Gantt chart"
      >
        <defs>
          {/* Clip names column */}
          <clipPath id="gantt-names-clip">
            <rect x={0} y={0} width={NW - 12} height={SVG_H} />
          </clipPath>
          {/* Arrowhead marker */}
          <marker id="gantt-arrow" markerWidth={7} markerHeight={5} refX={6} refY={2.5} orient="auto">
            <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8" />
          </marker>
        </defs>

        {/* ── Background ── */}
        <rect width={SVG_W} height={SVG_H} fill="#ffffff" />
        {/* Names column bg */}
        <rect x={0} y={0} width={NW} height={SVG_H} fill="#f8fafc" />
        {/* Header bg */}
        <rect x={0} y={0} width={SVG_W} height={HDR_H} fill="#f1f5f9" />

        {/* ── Month grid lines + labels ── */}
        {months.map((m, i) => (
          <Fragment key={i}>
            <line x1={m.x} y1={HDR_H} x2={m.x} y2={SVG_H} stroke="#e2e8f0" strokeWidth={1} />
            <text x={m.x + 6} y={HDR_H - 14} fontSize={11} fill="#64748b" fontWeight={500}>{m.label}</text>
          </Fragment>
        ))}

        {/* ── Today line ── */}
        {todayX >= NW && todayX <= SVG_W && (
          <>
            <line x1={todayX} y1={HDR_H} x2={todayX} y2={SVG_H} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={todayX + 4} y={HDR_H - 14} fontSize={10} fill="#3b82f6" fontWeight={600}>Today</text>
          </>
        )}

        {/* ── Header column border ── */}
        <text x={12} y={HDR_H / 2 + 4} fontSize={11} fill="#64748b" fontWeight={600}>Task</text>
        <line x1={NW} y1={0} x2={NW} y2={SVG_H} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={0} y1={HDR_H} x2={SVG_W} y2={HDR_H} stroke="#e2e8f0" strokeWidth={1} />

        {/* ── Rows ── */}
        {rows.map((row, ri) => (
          <Fragment key={ri}>
            {row.type === 'group' ? (
              /* Group header row */
              <>
                <rect x={0} y={row.y} width={SVG_W} height={GRP_H} fill="#f1f5f9" />
                <rect x={0} y={row.y} width={4} height={GRP_H} fill={row.groupColor ?? '#94a3b8'} />
                <text
                  x={14} y={row.y + GRP_H / 2 + 4}
                  fontSize={11} fontWeight={700} fill="#475569"
                  clipPath="url(#gantt-names-clip)"
                >
                  {row.label}
                </text>
                <line x1={0} y1={row.y + GRP_H} x2={SVG_W} y2={row.y + GRP_H} stroke="#e2e8f0" strokeWidth={1} />
              </>
            ) : (
              /* Task row */
              <>
                <rect x={0} y={row.y} width={SVG_W} height={ROW_H} fill="transparent" />
                <line x1={0} y1={row.y + ROW_H} x2={SVG_W} y2={row.y + ROW_H} stroke="#f1f5f9" strokeWidth={1} />

                {/* Task name */}
                <text
                  x={14} y={row.y + ROW_H / 2 + 4}
                  fontSize={12} fill="#334155"
                  clipPath="url(#gantt-names-clip)"
                >
                  {row.label}
                </text>

                {/* Task bar */}
                {row.task && (() => {
                  const t  = row.task;
                  const bx = dx(t.startDate);
                  const bw = dw(t.startDate, t.dueDate);
                  const by = row.y + BAR_P;
                  const bc = barColor(t);

                  return (
                    <g
                      onClick={() => onTaskClick(t)}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      aria-label={t.title}
                    >
                      {/* Shadow rect */}
                      <rect x={bx + 1} y={by + 2} width={bw} height={BAR_H} rx={5} fill="rgba(0,0,0,0.06)" />
                      {/* Main bar */}
                      <rect x={bx} y={by} width={bw} height={BAR_H} rx={5} fill={bc} opacity={0.9} />
                      {/* Hover highlight */}
                      <rect x={bx} y={by} width={bw} height={BAR_H} rx={5} fill="white" opacity={0}
                        style={{ transition: 'opacity 0.15s' }}
                        onMouseEnter={e => { (e.target as SVGRectElement).style.opacity = '0.15'; }}
                        onMouseLeave={e => { (e.target as SVGRectElement).style.opacity = '0'; }}
                      />
                      {/* Assignee initials */}
                      {bw > 30 && t.assigneeId && (
                        <text
                          x={bx + bw - 10} y={by + BAR_H / 2 + 4}
                          fontSize={9} fill="white" fontWeight={700}
                          textAnchor="middle" opacity={0.9}
                        >
                          {userInitials(t.assigneeId)}
                        </text>
                      )}
                      {/* Task title on bar if wide enough */}
                      {bw > 80 && (
                        <text
                          x={bx + 8} y={by + BAR_H / 2 + 4}
                          fontSize={10} fill="white" opacity={0.92}
                          style={{ pointerEvents: 'none' }}
                        >
                          {t.title.length > 22 ? t.title.slice(0, 20) + '…' : t.title}
                        </text>
                      )}
                    </g>
                  );
                })()}
              </>
            )}
          </Fragment>
        ))}

        {/* ── Dependency arrows ── */}
        {tasks.flatMap(task =>
          task.dependsOn.map(depId => {
            const depTask = tasks.find(t => t.id === depId);
            if (!depTask) return null;
            const fromX = dx(depTask.dueDate) + dw(depTask.startDate, depTask.dueDate);
            const fromY = rowY(depId) + ROW_H / 2;
            const toX   = dx(task.startDate);
            const toY   = rowY(task.id) + ROW_H / 2;
            if (!fromY || !toY) return null;
            const mid = fromX + Math.min(16, (toX - fromX) / 2);
            return (
              <path
                key={`${depId}-${task.id}`}
                d={`M ${fromX} ${fromY} H ${mid} V ${toY} H ${toX}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                markerEnd="url(#gantt-arrow)"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

interface TaskDetailSheetProps {
  task: GanttTask | null;
  allTasks: GanttTask[];
  users: ApiUser[];
  onClose: () => void;
  onSave: (updated: GanttTask) => void;
}

function TaskDetailSheet({ task, allTasks, users: sheetUsers, onClose, onSave }: TaskDetailSheetProps) {
  function userName(uid?: string) { return uid ? (sheetUsers.find(u => u.id === uid)?.name ?? uid) : '—'; }
  function userInitials(uid?: string) { return uid ? (sheetUsers.find(u => u.id === uid)?.initials ?? '?') : ''; }
  const [draft, setDraft] = useState<GanttTask | null>(null);

  useEffect(() => { setDraft(task ? { ...task } : null); }, [task]);

  if (!draft) return null;

  function patch<K extends keyof GanttTask>(key: K, val: GanttTask[K]) {
    setDraft(prev => prev ? { ...prev, [key]: val } : prev);
  }

  function toggleDep(id: string) {
    const deps = draft!.dependsOn;
    patch('dependsOn', deps.includes(id) ? deps.filter(d => d !== id) : [...deps, id]);
  }

  const otherTasks = allTasks.filter(t => t.id !== draft.id);

  return (
    <Sheet open={!!task} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent width="w-[460px]" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="pr-6 leading-snug text-base">{draft.title}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            From: <span className="font-medium text-foreground">{draft.recName}</span>
          </p>
        </SheetHeader>

        <SheetBody className="space-y-5">

          {/* Task name */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Task Name</Label>
            <input
              value={draft.title}
              onChange={e => patch('title', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch('status', s)}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-semibold transition-all',
                    draft.status === s
                      ? STATUS_COLORS[s]
                      : 'border-border text-muted-foreground hover:border-muted-foreground',
                  )}
                >
                  {draft.status === s && <Check size={11} className="inline mr-1" />}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Effort */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Effort</Label>
            <div className="flex gap-2">
              {EFFORTS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => patch('effort', e)}
                  className={cn(
                    'flex-1 rounded-lg border py-2 text-xs font-semibold transition-all',
                    draft.effort === e
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Owner */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Owner</Label>
            <select
              value={draft.assigneeId ?? ''}
              onChange={e => patch('assigneeId', e.target.value || undefined)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">No owner</option>
              {sheetUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {draft.assigneeId && (
              <div className="flex items-center gap-2 mt-2">
                <UserAvatar name={userName(draft.assigneeId)} initials={userInitials(draft.assigneeId) ?? ''} size="sm" />
                <span className="text-sm">{userName(draft.assigneeId)}</span>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Start Date</Label>
              <input
                type="date"
                value={draft.startDate}
                onChange={e => patch('startDate', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Due Date</Label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={e => patch('dueDate', e.target.value)}
                className={cn(
                  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary',
                  isOverdue(draft) ? 'border-red-400 text-red-600' : 'border-border',
                )}
              />
            </div>
          </div>

          {/* Depends On */}
          {otherTasks.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Depends On</Label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg border border-border p-2">
                {otherTasks.map(t => (
                  <label key={t.id} className="flex items-center gap-2.5 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer">
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                      draft.dependsOn.includes(t.id) ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )}>
                      {draft.dependsOn.includes(t.id) && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <input type="checkbox" className="sr-only" checked={draft.dependsOn.includes(t.id)} onChange={() => toggleDep(t.id)} />
                    <span className="text-xs text-foreground leading-tight">{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
            <Textarea
              value={draft.description}
              onChange={e => patch('description', e.target.value)}
              rows={3}
              className="text-sm resize-none"
              placeholder="What does this task involve?"
            />
          </div>

          {/* Progress notes */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Progress Notes</Label>
            <Textarea
              value={draft.progressNotes}
              onChange={e => patch('progressNotes', e.target.value)}
              rows={2}
              className="text-sm resize-none"
              placeholder="Latest update on this task…"
            />
          </div>
        </SheetBody>

        <SheetFooter>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mr-auto"
          >
            Cancel
          </button>
          <Button size="sm" onClick={() => { onSave(draft); onClose(); }}>
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── AI Generate Modal ────────────────────────────────────────────────────────

interface SuggestedTask {
  id: string;
  title: string;
  effort: Effort;
  dependsOn: string;
}

interface AiGenerateModalProps {
  recName: string;
  existingTasks: GanttTask[];
  recId: string;
  gapWeight: number;
  eventId: string;
  onAdd: (tasks: GanttTask[]) => void;
  onClose: () => void;
}

function AiGenerateModal({ recName, existingTasks, recId, gapWeight, eventId, onAdd, onClose }: AiGenerateModalProps) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const base = AI_SUGGESTIONS[recName] ?? AI_SUGGESTIONS['__default__'];
      setSuggestions(base.map(s => ({ id: uid(), title: s.title, effort: s.effort, dependsOn: '' })));
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [recName]);

  function updateSuggestion(id: string, field: keyof SuggestedTask, value: string) {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }
  function removeSuggestion(id: string) {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }
  function addSuggestion() {
    setSuggestions(prev => [...prev, { id: uid(), title: '', effort: 'Medium', dependsOn: '' }]);
  }

  function handleAdd() {
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const defaultDue = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const newTasks: GanttTask[] = suggestions
      .filter(s => s.title.trim())
      .map(s => ({
        id: uid(),
        eventId,
        title: s.title.trim(),
        description: '',
        progressNotes: '',
        recId,
        recName,
        gapWeight,
        status: 'Not Started' as TaskStatus,
        effort: s.effort,
        assigneeId: undefined,
        priority: 'Medium' as const,
        startDate: start,
        dueDate: defaultDue,
        dependsOn: s.dependsOn ? [s.dependsOn] : [],
        completionPct: 0,
        createdAt: new Date().toISOString(),
      }));

    onAdd(newTasks);
    onClose();
  }

  const allTaskOptions = [...existingTasks];

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles size={16} className="text-primary" />
            Generate Task Breakdown
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1">
              <p className="text-sm text-muted-foreground">
                AI-suggested tasks for <strong className="text-foreground">{recName}</strong>.
                Edit, remove, or add tasks before adding to the roadmap.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[260px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 size={28} className="text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">AI is suggesting tasks…</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1"
                   style={{ gridTemplateColumns: '1fr 100px 140px 32px' }}>
                <span>Task Name</span>
                <span>Effort</span>
                <span>Depends On</span>
                <span />
              </div>

              {suggestions.map(s => (
                <div
                  key={s.id}
                  className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 100px 140px 32px' }}
                >
                  <input
                    value={s.title}
                    onChange={e => updateSuggestion(s.id, 'title', e.target.value)}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Task title…"
                  />
                  <select
                    value={s.effort}
                    onChange={e => updateSuggestion(s.id, 'effort', e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {EFFORTS.map(e => <option key={e}>{e}</option>)}
                  </select>
                  <select
                    value={s.dependsOn}
                    onChange={e => updateSuggestion(s.id, 'dependsOn', e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">No dependency</option>
                    {allTaskOptions.map(t => (
                      <option key={t.id} value={t.id}>{t.title.slice(0, 28)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSuggestion(s.id)}
                    className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addSuggestion}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors w-full"
              >
                <Plus size={12} /> Add another task
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleAdd} disabled={loading || suggestions.filter(s => s.title.trim()).length === 0}>
            <Plus size={13} className="mr-1.5" />
            Add {suggestions.filter(s => s.title.trim()).length} Tasks to Roadmap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RoadmapTabProps {
  event: AssessmentEvent;
  pendingRecName?: string | null;
  onPendingConsumed?: () => void;
}

const GROUP_COLORS = ['#8b5cf6', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#f97316'];

export function RoadmapTab({ event, pendingRecName, onPendingConsumed }: RoadmapTabProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [apiUsers, setApiUsers] = useState<ApiUser[]>([]);
  const [openTask, setOpenTask]   = useState<GanttTask | null>(null);
  const [aiModal, setAiModal]     = useState<{ recName: string; recId: string; gapWeight: number } | null>(null);

  // Load tasks from API
  useEffect(() => {
    tasksApi.list(event.id)
      .then(ts => setTasks(ts.map(apiTaskToTask)))
      .catch(() => {});
    usersApi.list().then(setApiUsers).catch(() => {});
  }, [event.id]);

  // Build groups dynamically from tasks
  const recGroups: RecGroup[] = useMemo(() => {
    const seen = new Map<string, RecGroup>();
    tasks.forEach(t => {
      const key = t.recName || t.recId;
      if (!seen.has(key)) {
        seen.set(key, {
          recId: t.recId || `rec-${key}`,
          recName: t.recName,
          gapWeight: t.gapWeight,
          color: GROUP_COLORS[seen.size % GROUP_COLORS.length],
        });
      }
    });
    return Array.from(seen.values());
  }, [tasks]);

  // Auto-open AI modal when arriving from Recommendations
  const consumedRef = useRef(false);
  useEffect(() => {
    if (pendingRecName && !consumedRef.current) {
      consumedRef.current = true;
      onPendingConsumed?.();
      const hasExisting = tasks.some(t => t.recName === pendingRecName);
      if (!hasExisting) {
        const group = recGroups.find(g => g.recName === pendingRecName)
          ?? (recGroups.length > 0 ? recGroups[0] : null);
        if (group) {
          setAiModal({ recName: group.recName, recId: group.recId, gapWeight: group.gapWeight });
        }
      }
    }
  }, [pendingRecName, onPendingConsumed, tasks, recGroups]);

  function saveTask(updated: GanttTask) {
    tasksApi.update(updated.id, {
      title: updated.title,
      description: updated.description,
      progressNotes: updated.progressNotes,
      status: toApiStatus(updated.status),
      effort: updated.effort,
      assigneeId: updated.assigneeId,
      startDate: updated.startDate,
      dueDate: updated.dueDate,
    }).catch(() => {});
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    toast({ title: 'Task saved', variant: 'success' });
  }

  function addTasks(newTasks: GanttTask[]) {
    const today = new Date().toISOString().slice(0, 10);
    const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    Promise.all(newTasks.map(t =>
      tasksApi.create({
        eventId: t.eventId,
        title: t.title,
        description: t.description,
        progressNotes: t.progressNotes,
        recName: t.recName,
        gapWeight: t.gapWeight,
        status: toApiStatus(t.status),
        effort: t.effort,
        priority: t.priority,
        startDate: t.startDate || today,
        dueDate: t.dueDate || defaultDue,
        completionPct: t.completionPct,
        assigneeId: t.assigneeId,
      }).then(apiTaskToTask)
    ))
    .then(created => setTasks(prev => [...prev, ...created]))
    .catch(() => { setTasks(prev => [...prev, ...newTasks]); });
    toast({
      title: `${newTasks.length} task${newTasks.length !== 1 ? 's' : ''} added to roadmap`,
      variant: 'success',
    });
  }

  const readinessPct = calcReadiness(tasks);

  // Status legend items
  const LEGEND: Array<{ label: string; color: string }> = [
    { label: 'Not Started', color: '#94a3b8' },
    { label: 'In Progress', color: '#3b82f6' },
    { label: 'Done',        color: '#10b981' },
    { label: 'Blocked',     color: '#ef4444' },
    { label: 'Overdue',     color: '#f97316' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-7">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Roadmap</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{event.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => {
              const g = recGroups[0];
              if (g) setAiModal({ recName: g.recName, recId: g.recId, gapWeight: g.gapWeight });
              else toast({ title: 'No gaps found', description: 'Convert recommendations to tasks first to populate gaps.', variant: 'default' });
            }}
          >
            <Sparkles size={13} className="text-primary" />
            Generate Tasks with AI
          </Button>
          {/* Group selector for AI */}
          <div className="relative">
            <select
              className="appearance-none rounded-lg border border-border bg-background pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              defaultValue=""
              onChange={e => {
                const g = recGroups.find(r => r.recId === e.target.value);
                if (g) setAiModal({ recName: g.recName, recId: g.recId, gapWeight: g.gapWeight });
                e.target.value = '';
              }}
            >
              <option value="" disabled>Select gap…</option>
              {recGroups.map(g => <option key={g.recId} value={g.recId}>{g.recName}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Readiness gauge */}
      <ReadinessGauge pct={readinessPct} tasks={tasks} groups={recGroups} />

      {/* Gantt legend */}
      <div className="flex items-center gap-5 flex-wrap">
        {LEGEND.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-6 rounded-sm" style={{ background: color }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
          <span className="inline-block h-0 w-6 border-t-2 border-dashed border-slate-400" />
          Dependency
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-4 w-0.5 bg-blue-500" />
          Today
        </div>
      </div>

      {/* Gantt chart */}
      <GanttChart tasks={tasks} groups={recGroups} onTaskClick={setOpenTask} />

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={openTask}
        allTasks={tasks}
        users={apiUsers}
        onClose={() => setOpenTask(null)}
        onSave={saveTask}
      />

      {/* AI generate modal */}
      {aiModal && (
        <AiGenerateModal
          recName={aiModal.recName}
          recId={aiModal.recId}
          gapWeight={aiModal.gapWeight}
          eventId={event.id}
          existingTasks={tasks}
          onAdd={addTasks}
          onClose={() => setAiModal(null)}
        />
      )}
    </div>
  );
}
