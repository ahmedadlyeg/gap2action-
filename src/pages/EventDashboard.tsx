import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ClipboardList, Users, BarChart2, AlertCircle, Map as MapIcon, GitCompare,
  CheckCircle2, MessageSquare, Eye, ArrowRight, CalendarDays,
  Target, RotateCcw, FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlaceholderPage } from '@/components/shared/PlaceholderPage';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ResultsTab } from '@/components/event/ResultsTab';
import { GapsTab } from '@/components/event/GapsTab';
import { RecommendationsTab } from '@/components/event/RecommendationsTab';
import { RoadmapTab } from '@/components/event/RoadmapTab';
import { CompareTab } from '@/components/event/CompareTab';
import { useToast } from '@/context/ToastContext';
import { events as seedEvents, templates, users } from '@/services/mockData';
import { getEvents, getSubmission, saveSubmission, getTemplateSections, saveRespondentAction, getRespondentAction, getReturnFeedback, getUserAssignedSections, getSectionRespondents } from '@/services/store';
import type { AssessmentEvent, Template, RespondentProgress, RespondentStatus } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userName(uid: string) {
  return users.find(u => u.id === uid)?.name ?? `User ${uid}`;
}
function userInitials(uid: string) {
  return users.find(u => u.id === uid)?.initials ?? '??';
}
function userDept(uid: string) {
  return users.find(u => u.id === uid)?.department ?? '—';
}
function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatRelative(iso?: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RespondentStatus, { label: string; textCls: string; bgCls: string; dot: string }> = {
  'Not Started':          { label: 'Not Started',          textCls: 'text-slate-600',   bgCls: 'bg-slate-100',   dot: 'bg-slate-400' },
  'In Progress':          { label: 'In Progress',          textCls: 'text-blue-700',    bgCls: 'bg-blue-100',    dot: 'bg-blue-500' },
  'Submitted':            { label: 'Submitted',            textCls: 'text-amber-700',   bgCls: 'bg-amber-100',   dot: 'bg-amber-500' },
  'Validated':            { label: 'Validated',            textCls: 'text-emerald-700', bgCls: 'bg-emerald-100', dot: 'bg-emerald-500' },
  'Returned':             { label: 'Returned',             textCls: 'text-orange-700',  bgCls: 'bg-orange-100',  dot: 'bg-orange-500' },
  'Returned for Revision':{ label: 'Returned for Revision',textCls: 'text-amber-700',   bgCls: 'bg-amber-100',   dot: 'bg-amber-500' },
};

const EVENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'outline'> = {
  Open: 'success', 'In Progress': 'warning', Completed: 'secondary', Closed: 'outline',
  Draft: 'outline', Scheduled: 'outline',
};

// ─── Readiness Gauge SVG ──────────────────────────────────────────────────────

function ReadinessGauge({ value, label }: { value: number; label: string }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.max(0, Math.min(100, value)) / 100 * circ;
  const color =
    value >= 85 ? '#14b8a6'
    : value >= 70 ? '#10b981'
    : value >= 55 ? '#f59e0b'
    : value >= 40 ? '#f97316'
    : '#f43f5e';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 112 112" className="w-28 h-28">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="56" cy="56" r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        <text x="56" y="51" textAnchor="middle" dominantBaseline="middle"
          fontSize="20" fontWeight="700" fill="currentColor"
        >{value}</text>
        <text x="56" y="67" textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill="#94a3b8"
        >%</text>
      </svg>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Status Breakdown Bar ─────────────────────────────────────────────────────

function StatusBar({ progress }: { progress: RespondentProgress[] }) {
  const total = progress.length;
  if (total === 0) return null;
  const counts = Object.fromEntries(
    Object.keys(STATUS_CFG).map(s => [s, 0])
  ) as Record<RespondentStatus, number>;
  progress.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1; });

  const order: RespondentStatus[] = ['Validated', 'Submitted', 'In Progress', 'Returned', 'Not Started'];
  const bgColors: Record<RespondentStatus, string> = {
    Validated: 'bg-emerald-500', Submitted: 'bg-amber-400',
    'In Progress': 'bg-blue-500', Returned: 'bg-orange-400', 'Not Started': 'bg-slate-300',
  };

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
        {order.map(s => {
          const pct = (counts[s] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={s}
              className={`h-full ${bgColors[s]} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${STATUS_CFG[s].label}: ${counts[s]}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {order.filter(s => counts[s] > 0).map(s => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${bgColors[s]}`} />
            {STATUS_CFG[s].label} <span className="font-semibold text-foreground">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewResponseSheet({
  open, userId, event, onClose,
}: { open: boolean; userId: string | null; event: AssessmentEvent; onClose: () => void }) {
  const uName = userId ? userName(userId) : '';
  const submission = userId ? getSubmission(event.id, userId) : null;
  const allSections = getTemplateSections(event.templateId) ?? [];
  const allSectionIds = allSections.map(s => s.id);
  const assignedIds = userId
    ? getUserAssignedSections(event, userId, allSectionIds)
    : allSectionIds;
  const visibleSections = allSections.filter(s => assignedIds.includes(s.id));
  const isFiltered = assignedIds.length < allSectionIds.length;

  type QAPair = { qNum: number; text: string; answer: string; type: string };
  const qaPairs: QAPair[] = [];

  if (submission && visibleSections.length > 0) {
    let qNum = 0;
    for (const sec of visibleSections) {
      for (const q of sec.questions) {
        qNum++;
        const raw = submission.answers[q.id];
        let answer = '';
        if (raw === undefined || raw === null || raw === '') {
          answer = '—';
        } else if (Array.isArray(raw)) {
          answer = raw.join(', ');
        } else {
          answer = String(raw);
        }
        qaPairs.push({ qNum, text: q.text, answer, type: q.type });
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">Response — {uName}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {submission
              ? `${submission.completionPct}% complete · ${STATUS_CFG[submission.status as RespondentStatus]?.label ?? submission.status}`
              : ''}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          {isFiltered && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Viewing <strong>{assignedIds.length}</strong> assigned sections
            </div>
          )}
          {!submission ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-foreground">No answers submitted yet</p>
              <p className="text-xs text-muted-foreground">The respondent hasn't saved any answers.</p>
            </div>
          ) : qaPairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-foreground">Template sections not found</p>
              <p className="text-xs text-muted-foreground">Could not load questions for this template.</p>
            </div>
          ) : (
            qaPairs.map((qa) => (
              <div key={qa.qNum} className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground mt-0.5 w-5">Q{qa.qNum}</span>
                  <p className="text-xs font-medium text-foreground leading-relaxed">{qa.text}</p>
                </div>
                <div className="ml-7 rounded-lg bg-muted/40 border px-3 py-2.5">
                  <p className="text-sm text-foreground">{qa.answer}</p>
                  {qa.type === 'text' && qa.answer !== '—' && (
                    <p className="text-[10px] text-blue-600 mt-1">Free text — AI context only</p>
                  )}
                </div>
              </div>
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// ─── Return Feedback Dialog ───────────────────────────────────────────────────

function ReturnDialog({
  open, userId, onClose, onSubmit,
}: { open: boolean; userId: string | null; onClose: () => void; onSubmit: (feedback: string) => void }) {
  const [feedback, setFeedback] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = () => {
    if (!feedback.trim()) { setErr('Feedback message is required.'); return; }
    onSubmit(feedback.trim());
    setFeedback('');
    setErr('');
  };

  const handleClose = () => {
    setFeedback('');
    setErr('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <RotateCcw size={15} className="text-orange-500" />
            Return Submission
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Return {userId ? userName(userId) : 'this submission'}'s response for revision.
            Your feedback will be visible to the respondent.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-2">
          <Label htmlFor="feedback-msg">
            Feedback Message <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="feedback-msg"
            value={feedback}
            onChange={e => { setFeedback(e.target.value); setErr(''); }}
            placeholder="Describe what needs to be revised and why…"
            rows={4}
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          </DialogClose>
          <Button size="sm" variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={handleSubmit}
          >
            <RotateCcw size={13} className="mr-1.5" /> Return for Revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Submissions Filter ───────────────────────────────────────────────────────

type SubmissionsFilter = 'all' | 'pending' | 'not-started' | 'overdue';

// ─── Main Event Dashboard ─────────────────────────────────────────────────────

export function EventDashboard() {
  const { id } = useParams<{ id: string }>();
  const allEvents = new Map(
    [...seedEvents, ...getEvents()].map(e => [e.id, e])
  );
  const event = id ? allEvents.get(id) : undefined;
  const template = (event ? templates.find(t => t.id === event.templateId) : null) ?? null;

  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [pendingRecName, setPendingRecName] = useState<string | null>(null);
  const [progress, setProgress] = useState<RespondentProgress[]>(() => {
    const base = event?.respondentProgress ?? [];
    if (!event) return base;
    return base.map(p => {
      const action = getRespondentAction(event.id, p.userId);
      if (!action) return p;
      if (action.status === 'Returned for Revision') {
        return {
          ...p,
          status: 'Returned for Revision' as const,
          feedback: action.feedback ?? p.feedback,
          returnCount: action.returnCount,
          lastActivity: action.actionAt ?? p.lastActivity,
        };
      }
      if (action.status === 'Validated') {
        return {
          ...p,
          status: 'Validated' as const,
          lastActivity: action.actionAt ?? p.lastActivity,
        };
      }
      return p;
    });
  });
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [returnUserId, setReturnUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubmissionsFilter>('all');

  if (!event) {
    return <PlaceholderPage title="Event not found" description="The requested event does not exist." />;
  }

  // Derived stats
  const total = progress.length;
  const submitted = progress.filter(p => p.status === 'Submitted').length;
  const validated = progress.filter(p => p.status === 'Validated').length;
  const notStarted = progress.filter(p => p.status === 'Not Started').length;
  const inProgress = progress.filter(p => p.status === 'In Progress' || p.status === 'Returned for Revision').length;
  const gaugeValue = event.score ?? Math.round((submitted + validated) / Math.max(1, total) * 100);
  const gaugeLabel = event.score != null ? 'Assessment Score' : 'Completion';

  // Actions
  const validateUser = (uid: string) => {
    const now = new Date().toISOString();
    const existing = getRespondentAction(event.id, uid);
    setProgress(prev => prev.map(p =>
      p.userId === uid ? { ...p, status: 'Validated', lastActivity: now } : p
    ));
    saveRespondentAction(event.id, uid, {
      status: 'Validated',
      returnCount: existing?.returnCount ?? 0,
      actionAt: now,
    });
    toast({ title: 'Response validated', variant: 'success' });
  };

  const returnUser = (uid: string, feedback: string) => {
    const now = new Date().toISOString();

    // 1. Load existing action to carry forward returnCount
    const existing = getRespondentAction(event.id, uid);
    const returnCount = (existing?.returnCount ?? 0) + 1;

    // 2. Persist to store
    saveRespondentAction(event.id, uid, {
      status: 'Returned for Revision',
      feedback,
      returnedAt: now,
      returnCount,
      actionAt: now,
    });

    // 3. Demote submission status so it no longer counts as Submitted
    const sub = getSubmission(event.id, uid);
    if (sub) {
      saveSubmission(event.id, uid, { ...sub, status: 'In Progress' });
    }

    // 4. Update local UI state
    setProgress(prev => prev.map(p =>
      p.userId === uid
        ? { ...p, status: 'Returned for Revision', feedback, returnCount, lastActivity: now }
        : p
    ));
    setReturnUserId(null);
    toast({ title: 'Submission returned for revision', description: 'The respondent will be asked to revise.', variant: 'warning' });
  };

  // Template sections — computed once for badge + overdue logic
  const templateSections = getTemplateSections(event.templateId) ?? [];
  const allTemplateSectionIds = templateSections.map(s => s.id);
  const isPastDue = new Date(event.endDate) < new Date();

  const hasAssignedSection = (uid: string) =>
    getUserAssignedSections(event, uid, allTemplateSectionIds).length > 0;

  // Filter submissions
  const filteredProgress = progress.filter(p => {
    if (filter === 'pending') return p.status === 'Submitted';
    if (filter === 'not-started') return p.status === 'Not Started';
    if (filter === 'overdue') {
      return hasAssignedSection(p.userId)
        && p.status !== 'Submitted'
        && p.status !== 'Validated'
        && isPastDue;
    }
    return true;
  });

  const TABS = [
    { value: 'overview', label: 'Overview', icon: ClipboardList },
    { value: 'submissions', label: 'Submissions', icon: Users },
    { value: 'results', label: 'Results', icon: BarChart2 },
    { value: 'gaps', label: 'Gaps', icon: AlertCircle },
    { value: 'recommendations', label: 'Recommendations', icon: MessageSquare },
    { value: 'roadmap', label: 'Roadmap', icon: MapIcon },
    { value: 'compare', label: 'Compare', icon: GitCompare },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col min-h-full">

        {/* ── Event header ── */}
        <div className="border-b bg-background px-8 pt-7 pb-0">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start justify-between gap-6 mb-5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1.5">
                  <Link to="/" className="hover:text-primary transition-colors">Dashboard</Link>
                  {' / '}
                  <span>Assessment Events</span>
                </p>
                <h1 className="text-2xl font-bold text-foreground leading-tight">{event.name}</h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {template?.name ?? 'Unknown Template'}
                  {template && ` · v${template.version}`}
                  {' · '}
                  {formatDate(event.startDate)} → {formatDate(event.endDate)}
                </p>
              </div>

              <div className="flex items-start gap-4 shrink-0">
                {/* Stats chips */}
                <div className="hidden sm:flex flex-col gap-1.5 text-right">
                  <span className="text-xs text-muted-foreground">
                    {total} respondent{total !== 1 ? 's' : ''}
                  </span>
                  {event.targetMaturityLevel && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Target size={11} /> Target: {event.targetMaturityLevel}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? 'outline'}>
                    {event.status}
                  </Badge>
                  {event.maturityLevel && (
                    <Badge variant="secondary" className="text-[10px]">{event.maturityLevel}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Tab nav */}
            <nav className="flex gap-0 overflow-x-auto -mx-1">
              {TABS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    tab === t.value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <t.icon size={14} />
                  {t.label}
                  {t.value === 'submissions' && submitted > 0 && (
                    <span className="ml-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                      {submitted}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Top row: KPI cards + gauge */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-start">
                  {[
                    {
                      label: 'Respondents', value: total,
                      sub: `${inProgress} in progress`,
                      icon: Users, cls: 'text-blue-600 bg-blue-50',
                    },
                    {
                      label: 'Submitted', value: submitted,
                      sub: 'Pending validation',
                      icon: FileText, cls: 'text-amber-600 bg-amber-50',
                    },
                    {
                      label: 'Validated', value: validated,
                      sub: `${notStarted} not started`,
                      icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50',
                    },
                  ].map(kpi => (
                    <div key={kpi.label} className="rounded-xl border bg-card p-5 flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.cls}`}>
                        <kpi.icon size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
                      </div>
                    </div>
                  ))}

                  {/* Gauge */}
                  <div className="rounded-xl border bg-card p-5 flex items-center justify-center">
                    <ReadinessGauge value={gaugeValue} label={gaugeLabel} />
                  </div>
                </div>

                {/* Submission status breakdown */}
                <div className="rounded-xl border bg-card p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Submission Status</h3>
                  <StatusBar progress={progress} />
                </div>

                {/* Key dates */}
                {(event.reassessmentDate || event.targetMaturityLevel) && (
                  <div className="rounded-xl border bg-card p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Key Info</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {event.targetMaturityLevel && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <Target size={16} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Target Maturity</p>
                            <p className="text-sm font-semibold text-foreground">{event.targetMaturityLevel}</p>
                          </div>
                        </div>
                      )}
                      {event.reassessmentDate && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 shrink-0">
                            <CalendarDays size={16} className="text-violet-600" />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Reassessment Due</p>
                            <p className="text-sm font-semibold text-foreground">{formatDate(event.reassessmentDate)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Respondent progress list */}
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-sm font-semibold text-foreground">Respondents</h3>
                    <button
                      onClick={() => setTab('submissions')}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View all <ArrowRight size={12} />
                    </button>
                  </div>
                  <ul className="divide-y">
                    {progress.map(p => {
                      const cfg = STATUS_CFG[p.status];
                      return (
                        <li key={p.userId} className="flex items-center gap-4 px-6 py-3.5">
                          <UserAvatar name={userName(p.userId)} initials={userInitials(p.userId)} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-foreground truncate">{userName(p.userId)}</span>
                              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bgCls} ${cfg.textCls}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Progress value={p.completionPct} className="h-1.5 flex-1 max-w-[120px]" />
                              <span className="text-[11px] text-muted-foreground">{p.completionPct}%</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                            {p.lastActivity ? formatRelative(p.lastActivity) : '—'}
                          </span>
                        </li>
                      );
                    })}
                    {progress.length === 0 && (
                      <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No respondents assigned yet.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* SUBMISSIONS */}
            {tab === 'submissions' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: 'all', label: 'All', count: total },
                    { key: 'pending', label: 'Pending Validation', count: submitted },
                    { key: 'not-started', label: 'Not Started', count: notStarted },
                    { key: 'overdue', label: 'Overdue', count: progress.filter(p => hasAssignedSection(p.userId) && p.status !== 'Submitted' && p.status !== 'Validated' && isPastDue).length },
                  ] as const).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        filter === f.key
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      }`}
                    >
                      {f.label}
                      {f.count > 0 && (
                        <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                          filter === f.key ? 'bg-white/20 text-white' : 'bg-background/60'
                        }`}>
                          {f.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Respondent</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground hidden lg:table-cell">Completion</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden xl:table-cell">Last Activity</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredProgress.map(p => {
                        const cfg = STATUS_CFG[p.status];
                        const submission = getSubmission(event.id, p.userId);
                        const completionPct = submission?.completionPct ?? 0;
                        const assignedCount = event.sectionAssignments
                          ? getUserAssignedSections(event, p.userId, allTemplateSectionIds).length
                          : null;
                        return (
                          <tr key={p.userId} className="group hover:bg-muted/20 transition-colors">
                            {/* Respondent */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <UserAvatar name={userName(p.userId)} initials={userInitials(p.userId)} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-foreground truncate">{userName(p.userId)}</p>
                                    {assignedCount !== null && (
                                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                        Sections: {assignedCount}/{templateSections.length}
                                      </span>
                                    )}
                                  </div>
                                  {(p.status === 'Returned' || p.status === 'Returned for Revision') && p.feedback && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="text-xs text-amber-700 truncate max-w-[180px] cursor-help">
                                          ↩ {p.feedback}
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">{p.feedback}</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Department */}
                            <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell">
                              {userDept(p.userId)}
                            </td>
                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bgCls} ${cfg.textCls}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                                {p.status === 'Returned for Revision' && (p.returnCount ?? 0) > 1 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    (returned {p.returnCount}x)
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Completion */}
                            <td className="px-4 py-3.5 hidden lg:table-cell">
                              <div className="flex items-center justify-end gap-2">
                                <Progress value={completionPct} className="h-1.5 w-20" />
                                <span className="text-xs text-muted-foreground w-8 text-right">{completionPct}%</span>
                              </div>
                            </td>
                            {/* Last activity */}
                            <td className="px-4 py-3.5 text-muted-foreground text-xs hidden xl:table-cell">
                              {p.lastActivity ? formatRelative(p.lastActivity) : '—'}
                            </td>
                            {/* Actions */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      onClick={() => setViewUserId(p.userId)}
                                      disabled={p.completionPct === 0}
                                    >
                                      <Eye size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Response</TooltipContent>
                                </Tooltip>

                                {p.status === 'Submitted' && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost" size="icon"
                                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                          onClick={() => validateUser(p.userId)}
                                        >
                                          <CheckCircle2 size={14} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Validate</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost" size="icon"
                                          className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                          onClick={() => setReturnUserId(p.userId)}
                                        >
                                          <RotateCcw size={14} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Return for Revision</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}

                                {p.status === 'Validated' && (
                                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 pr-1">
                                    <CheckCircle2 size={12} /> Done
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredProgress.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                            No submissions match this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RESULTS TAB */}
            {tab === 'results' && (
              <ErrorBoundary label="Results">
                <ResultsTab event={event} template={template} />
              </ErrorBoundary>
            )}

            {/* GAPS TAB */}
            {tab === 'gaps' && (
              <ErrorBoundary label="Gaps">
                <GapsTab event={event} onViewRecommendations={() => setTab('recommendations')} />
              </ErrorBoundary>
            )}

            {/* RECOMMENDATIONS TAB */}
            {tab === 'recommendations' && (
              <ErrorBoundary label="Recommendations">
                <RecommendationsTab
                  event={event}
                  onNavigateRoadmap={(name) => {
                    setPendingRecName(name ?? null);
                    setTab('roadmap');
                  }}
                />
              </ErrorBoundary>
            )}

            {/* ROADMAP TAB */}
            {tab === 'roadmap' && (
              <ErrorBoundary label="Roadmap">
                <RoadmapTab
                  event={event}
                  pendingRecName={pendingRecName}
                  onPendingConsumed={() => setPendingRecName(null)}
                />
              </ErrorBoundary>
            )}

            {/* COMPARE TAB */}
            {tab === 'compare' && (
              <ErrorBoundary label="Compare">
                <CompareTab event={event} />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* ── Slide-overs & Dialogs ── */}
      <ViewResponseSheet
        open={viewUserId !== null}
        userId={viewUserId}
        event={event}
        onClose={() => setViewUserId(null)}
      />
      <ReturnDialog
        open={returnUserId !== null}
        userId={returnUserId}
        onClose={() => setReturnUserId(null)}
        onSubmit={feedback => { if (returnUserId) returnUser(returnUserId, feedback); }}
      />
    </TooltipProvider>
  );
}
