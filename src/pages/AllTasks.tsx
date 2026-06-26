import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, AlertCircle, Minus, ChevronDown, ChevronRight,
  Filter, ListChecks, User, CalendarClock, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { getTasks, getEvents, getUsers, updateTask } from '@/services/store';
import type { Task, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  'Not Started': { label: 'Not Started', color: 'text-slate-500 bg-slate-100 border-slate-200',   icon: Minus },
  'In Progress': { label: 'In Progress', color: 'text-blue-600  bg-blue-50   border-blue-200',    icon: Clock },
  'Done':        { label: 'Done',        color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  'Blocked':     { label: 'Blocked',     color: 'text-red-600   bg-red-50    border-red-200',     icon: AlertCircle },
};

function isOverdue(task: Task): boolean {
  return task.status !== 'Done' && task.dueDate < new Date().toISOString().slice(0, 10);
}

function pct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100); }

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ task, onChange }: { task: Task; onChange: (s: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[task.status];
  const Icon = cfg.icon;
  const overdue = isOverdue(task);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
          overdue ? 'text-orange-600 bg-orange-50 border-orange-200' : cfg.color
        )}
      >
        <Icon size={11} />
        {overdue ? 'Overdue' : cfg.label}
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl border bg-popover shadow-lg overflow-hidden min-w-[140px]">
            {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(s => {
              const c = STATUS_CONFIG[s];
              const I = c.icon;
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/60 transition-colors',
                    s === task.status && 'bg-muted/40'
                  )}
                >
                  <I size={12} className={STATUS_CONFIG[s].color.split(' ')[0]} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Event group ─────────────────────────────────────────────────────────────

function EventGroup({
  eventId, eventName, tasks, users, onStatusChange,
}: {
  eventId: string;
  eventName: string;
  tasks: Task[];
  users: ReturnType<typeof getUsers>;
  onStatusChange: (taskId: string, s: TaskStatus) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const done      = tasks.filter(t => t.status === 'Done').length;
  const inProg    = tasks.filter(t => t.status === 'In Progress').length;
  const blocked   = tasks.filter(t => t.status === 'Blocked').length;
  const overdue   = tasks.filter(t => isOverdue(t)).length;
  const total     = tasks.length;
  const donePct   = pct(done, total);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Event header row */}
      <button
        className="flex w-full items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn('transition-transform', expanded ? 'rotate-0' : '-rotate-90')}>
          <ChevronDown size={15} className="text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{eventName}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{total} tasks</span>
            {inProg > 0  && <span className="text-xs text-blue-600 font-medium">{inProg} in progress</span>}
            {blocked > 0 && <span className="text-xs text-red-600 font-medium">{blocked} blocked</span>}
            {overdue > 0 && <span className="text-xs text-orange-600 font-medium">{overdue} overdue</span>}
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-24">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${donePct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{donePct}% done</p>
          </div>
          <Link
            to={`/events/${eventId}?tab=roadmap`}
            onClick={e => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight size={14} />
          </Link>
        </div>
      </button>

      {/* Task rows */}
      {expanded && (
        <div className="border-t divide-y">
          {tasks.map(task => {
            const assignee = task.assigneeId ? users.find(u => u.id === task.assigneeId) : undefined;
            const overdue  = isOverdue(task);
            return (
              <div key={task.id} className="flex items-start gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                {/* Status pill */}
                <div className="pt-0.5 shrink-0">
                  <StatusPill task={task} onChange={s => onStatusChange(task.id, s)} />
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-foreground truncate', task.status === 'Done' && 'line-through text-muted-foreground')}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {task.recName && (
                      <span className="text-[11px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                        {task.recName}
                      </span>
                    )}
                    {task.effort && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        {task.effort}
                      </Badge>
                    )}
                    {task.progressNotes && (
                      <span className="text-[11px] text-muted-foreground italic truncate max-w-[200px]">
                        {task.progressNotes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Assignee */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {assignee ? (
                    <>
                      <UserAvatar user={assignee} size="xs" />
                      <span className="text-xs text-muted-foreground hidden md:block">{assignee.name.split(' ')[0]}</span>
                    </>
                  ) : (
                    <User size={13} className="text-muted-foreground/40" />
                  )}
                </div>

                {/* Due date */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className={cn('text-xs', overdue ? 'text-orange-600 font-semibold' : 'text-muted-foreground')}>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AllTasks() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const events  = getEvents();
  const users   = getUsers();

  // Load tasks + re-read on store updates
  useEffect(() => {
    const load = () => setTasks(getTasks());
    load();
    window.addEventListener('g2a-store-updated', load);
    return () => window.removeEventListener('g2a-store-updated', load);
  }, []);

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask(taskId, { status });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  // Filter
  const filtered = tasks.filter(t => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
    return true;
  });

  // Group by eventId
  const grouped = events
    .map(ev => ({ ev, tasks: filtered.filter(t => t.eventId === ev.id) }))
    .filter(g => g.tasks.length > 0);

  // Summary counts
  const total   = tasks.length;
  const done    = tasks.filter(t => t.status === 'Done').length;
  const blocked = tasks.filter(t => t.status === 'Blocked').length;
  const overdue = tasks.filter(t => isOverdue(t)).length;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b bg-background px-8 py-5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ListChecks size={20} className="text-primary" />
              All Tasks
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Initiatives across all assessment events</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Tasks',  value: total,   color: 'text-foreground' },
            { label: 'Completed',    value: done,    color: 'text-emerald-600' },
            { label: 'Blocked',      value: blocked, color: 'text-red-600'    },
            { label: 'Overdue',      value: overdue, color: 'text-orange-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn('text-2xl font-bold mt-1', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={13} className="text-muted-foreground shrink-0" />

          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['All', 'Not Started', 'In Progress', 'Done', 'Blocked'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'bg-primary text-white border-primary'
                    : 'text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="ml-auto rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Event groups */}
        {grouped.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-16 text-center">
            <CalendarClock size={32} className="text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0
                ? 'No tasks yet. Generate tasks from the Roadmap tab of any event.'
                : 'No tasks match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ ev, tasks: evTasks }) => (
              <EventGroup
                key={ev.id}
                eventId={ev.id}
                eventName={ev.name}
                tasks={evTasks}
                users={users}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
