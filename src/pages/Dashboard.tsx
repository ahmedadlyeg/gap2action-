import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Minus,
  AlertCircle, ArrowRight, Calendar, Users, CheckCircle2,
  ChevronDown, ChevronUp, Plus, ShieldCheck, Eye, Pencil, AlertTriangle,
  Activity, Search, Bell, Lightbulb, CircleCheckBig, ClockAlert,
  ListChecks, ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getEvents, getReturnFeedback, getTemplates, getTemplate, getUsers, getCategories } from '@/services/store';
import type { MaturityLevel, RespondentStatus } from '@/types';

function allEvents() {
  return getEvents();
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const MATURITY_COLOR: Record<MaturityLevel, string> = {
  Initial: 'text-red-600 bg-red-50 border-red-200',
  Managed: 'text-orange-600 bg-orange-50 border-orange-200',
  Defined: 'text-amber-600 bg-amber-50 border-amber-200',
  'Quantitatively Managed': 'text-blue-600 bg-blue-50 border-blue-200',
  Optimizing: 'text-emerald-600 bg-emerald-50 border-emerald-200',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning'> = {
  Open: 'success',
  'In Progress': 'default',
  Completed: 'secondary',
  Closed: 'secondary',
  Draft: 'outline',
  Scheduled: 'warning',
};

const RESPONDENT_STATUS_COLOR: Record<RespondentStatus, string> = {
  'Not Started':           'text-slate-500 bg-slate-100',
  'In Progress':           'text-blue-700 bg-blue-100',
  Submitted:               'text-amber-700 bg-amber-100',
  Validated:               'text-emerald-700 bg-emerald-100',
  Returned:                'text-orange-700 bg-orange-100',
  'Returned for Revision': 'text-amber-700 bg-amber-100 border border-amber-300',
};

function MaturityPill({ level }: { level: MaturityLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${MATURITY_COLOR[level]}`}>
      {level}
    </span>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function PageShell({ greeting, subtitle, children }: {
  greeting: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary/70 mb-2">{subtitle}</p>
          <h1 className="heading-display text-3xl text-foreground">{greeting}</h1>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Shared Hero Band ────────────────────────────────────────────────────────

interface HeroBtn { label: string; icon: React.ElementType; onClick: () => void; primary?: boolean; }

function HeroBand({
  greeting, subline, buttons, user, role,
}: {
  greeting: string;
  subline: string;
  buttons: HeroBtn[];
  user: ReturnType<typeof useAuth>['user'];
  role?: string;
}) {
  const initials = user?.initials ?? (user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'U');
  const navigate = useNavigate();
  // Nav links vary by role:
  // admin: Dashboard, Templates (no Events)
  // assessor: Dashboard, Templates, Events
  // respondent: Dashboard only
  const showTemplates = role !== 'respondent';
  const showEvents = role === 'assessor';

  return (
    <div style={{ background: 'linear-gradient(120deg,#13b4cf 0%,#2e7de0 38%,#7b2ff7 70%,#e0218a 100%)', position: 'relative' }}>
      {/* Nav row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 26px' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: 'linear-gradient(135deg,#14c4de,#e0218a)' }} />
        </div>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '-.02em', color: '#fff' }}>Gap2Action</span>
        <div style={{ marginLeft: 22, display: 'flex', gap: 20, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>
          <span style={{ color: '#fff' }}>Dashboard</span>
          {showTemplates && <span style={{ cursor: 'pointer' }} onClick={() => navigate('/categories')}>Templates</span>}
          {showEvents && <span style={{ cursor: 'pointer' }} onClick={() => navigate('/events/new')}>Events</span>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 10, height: 36, padding: '0 12px', color: 'rgba(255,255,255,.85)', fontSize: 13, width: 200 }}>
            <Search size={16} style={{ flexShrink: 0 }} /> Search assessments…
          </div>
          <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Bell size={18} />
            <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: '#ffe14d', border: '1.5px solid #7b2ff7' }} />
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.95)', color: '#7b2ff7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
            {initials}
          </div>
        </div>
      </div>
      {/* Greeting row */}
      <div style={{ padding: '8px 28px 30px' }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', color: '#fff' }}>{greeting}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.82)', marginTop: 5 }}>{subline}</div>
        {buttons.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {buttons.map(btn => (
              <button key={btn.label} onClick={btn.onClick} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14,
                padding: '11px 19px', borderRadius: 11, border: 'none', cursor: 'pointer',
                background: btn.primary ? '#fff' : 'rgba(255,255,255,.16)',
                color: btn.primary ? '#7b2ff7' : '#fff',
                ...(btn.primary ? {} : { border: '1px solid rgba(255,255,255,.3)' }),
              }}>
                <btn.icon size={17} /> {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assessor Dashboard ───────────────────────────────────────────────────────

function AssessorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('g2a-store-updated', refresh);
    return () => window.removeEventListener('g2a-store-updated', refresh);
  }, []);

  const ev = allEvents();
  const myEvents = ev.filter(e =>
    e.ownerId === user?.id && (e.status === 'Open' || e.status === 'In Progress' || e.status === 'Draft')
  );
  const completedEvents = ev
    .filter(e => e.ownerId === user?.id && (e.status === 'Completed' || e.status === 'Closed') && e.score !== undefined)
    .slice(0, 3);

  const pendingValidations = ev
    .flatMap(e => e.respondentProgress)
    .filter(p => p.status === 'Submitted').length;

  const today = new Date();
  const overdueCount = myEvents.filter(e => new Date(e.endDate) < today).length;

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const sublineParts = [
    `${myEvents.length} active event${myEvents.length !== 1 ? 's' : ''}`,
    pendingValidations > 0 ? `${pendingValidations} awaiting validation` : null,
    overdueCount > 0 ? `${overdueCount} overdue` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="min-h-full" style={{ background: '#fbfcfe' }}>
      <HeroBand
        greeting={`${timeGreeting}, ${firstName}`}
        subline={sublineParts || 'No active events right now'}
        user={user}
        role="assessor"
        buttons={[
          { label: 'Create assessment', icon: Plus, primary: true, onClick: () => navigate('/events/new') },
          { label: 'View tasks', icon: ListChecks, onClick: () => navigate('/tasks') },
        ]}
      />
      <div className="p-6 max-w-5xl mx-auto space-y-6 pt-8">

      {/* Alert: pending validations */}
      {pendingValidations > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            {pendingValidations} response{pendingValidations > 1 ? 's' : ''} submitted and awaiting your validation.
          </p>
          <Badge variant="warning" className="ml-auto shrink-0">{pendingValidations} Pending</Badge>
        </div>
      )}

      {/* Active events */}
      <div>
        <SectionHeader
          title="Active Events"
          action={
            <Button size="sm" onClick={() => navigate('/events/new')}>
              <Plus size={14} className="mr-1.5" /> Create New Event
            </Button>
          }
        />
        {myEvents.length === 0 ? (
          <Card>
            <CardContent className="py-14 flex flex-col items-center text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ClipboardList size={24} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">No active events yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Choose an assessment template to create your first event and invite respondents.
                </p>
              </div>
              <Button size="sm" className="mt-1" onClick={() => navigate('/categories')}>
                <Plus size={13} className="mr-1.5" /> Create First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {myEvents.map(event => {
              const tpl = getTemplates().find(t => t.id === event.templateId);
              const submitted = event.respondentProgress.filter(p =>
                p.status === 'Submitted' || p.status === 'Validated'
              ).length;
              const total = event.respondentIds.length;

              return (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-snug">{event.name}</CardTitle>
                      <Badge variant={STATUS_VARIANT[event.status] ?? 'outline'} className="shrink-0">
                        {event.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{tpl?.name}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users size={12} /> {total} respondent{total !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} /> Due {event.endDate}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Submissions</span>
                        <span className="font-medium text-foreground">{submitted} of {total}</span>
                      </div>
                      <Progress value={(submitted / total) * 100} />
                    </div>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/events/${event.id}`}>Open Event <ArrowRight size={13} className="ml-1" /></Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent results */}
      {completedEvents.length > 0 && (
        <div>
          <SectionHeader title="Recent Results" />
          <Card>
            <div className="divide-y">
              {completedEvents.map(event => (
                <div key={event.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.endDate}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-lg font-bold text-foreground">{event.score}%</span>
                    {event.maturityLevel && <MaturityPill level={event.maturityLevel} />}
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/events/${event.id}`}><ArrowRight size={14} /></Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Respondent Dashboard ─────────────────────────────────────────────────────

function RespondentDashboard() {
  const { user } = useAuth();
  const [showCompleted, setShowCompleted] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('g2a-store-updated', refresh);
    return () => window.removeEventListener('g2a-store-updated', refresh);
  }, []);
  const today = new Date();

  const myEvents = allEvents().filter(e => e.respondentIds.includes(user?.id ?? ''));
  const activeEvents = myEvents.filter(e =>
    e.status === 'Open' || e.status === 'In Progress' || e.status === 'Scheduled'
  );
  const completedEvents = myEvents.filter(e =>
    e.status === 'Completed' || e.status === 'Closed'
  );

  function myProgress(event: ReturnType<typeof allEvents>[0]) {
    return event.respondentProgress.find(p => p.userId === user?.id);
  }

  function isOverdue(endDate: string) {
    return new Date(endDate) < today;
  }

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const pendingCount = activeEvents.filter(e => {
    const p = myProgress(e);
    return !p || p.status === 'Not Started' || p.status === 'In Progress';
  }).length;
  const subline = pendingCount > 0
    ? `${pendingCount} assessment${pendingCount !== 1 ? 's' : ''} pending · ${completedEvents.length} completed`
    : completedEvents.length > 0
      ? `All caught up · ${completedEvents.length} completed`
      : 'No assessments assigned yet';

  return (
    <div className="min-h-full" style={{ background: '#fbfcfe' }}>
      <HeroBand
        greeting={`${timeGreeting}, ${firstName}`}
        subline={subline}
        user={user}
        role="respondent"
        buttons={[
          { label: 'View maturity levels', icon: TrendingUp, primary: true, onClick: () => navigate('/maturity') },
        ]}
      />
      <div className="p-6 max-w-5xl mx-auto space-y-6 pt-8">
      {/* My Assessments */}
      <div>
        <SectionHeader title="My Assessments" />
        {activeEvents.length === 0 ? (
          <Card>
            <CardContent className="py-14 flex flex-col items-center text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ShieldCheck size={24} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">No assessments assigned yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  When your assessor invites you to participate in an assessment, it will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeEvents
              .sort((a, b) => {
                const uid = user?.id ?? 'u1';
                const sortRank = (ev: typeof activeEvents[0]) => {
                  const fb = getReturnFeedback(ev.id, uid);
                  if (fb !== null) return 0;
                  if (isOverdue(ev.endDate)) return 1;
                  const p = ev.respondentProgress.find(p => p.userId === uid);
                  if (p?.status === 'In Progress') return 2;
                  if (p?.status === 'Not Started') return 3;
                  return 4;
                };
                const diff = sortRank(a) - sortRank(b);
                return diff !== 0 ? diff : new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
              })
              .map(event => {
                const uid = user?.id ?? 'u1';
                const returnFeedback = getReturnFeedback(event.id, uid);
                const isReturned = returnFeedback !== null;
                const progress = myProgress(event);
                const overdue = !isReturned && isOverdue(event.endDate);
                const tpl = getTemplates().find(t => t.id === event.templateId);

                return (
                  <Card
                    key={event.id}
                    className={
                      isReturned
                        ? 'border-amber-300 bg-amber-50/30 hover:shadow-md transition-shadow'
                        : overdue
                          ? 'border-red-300 bg-red-50/30 hover:shadow-md transition-shadow'
                          : 'hover:shadow-md transition-shadow'
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold leading-snug">{event.name}</CardTitle>
                        {isReturned ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <AlertTriangle size={10} /> Returned for Revision
                          </span>
                        ) : progress ? (
                          <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${RESPONDENT_STATUS_COLOR[progress.status]}`}>
                            {progress.status}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{tpl?.name}</p>
                      {isReturned && returnFeedback && (
                        <p className="text-sm text-amber-700 italic mt-1">
                          Assessor feedback: "{returnFeedback.length > 80 ? returnFeedback.slice(0, 80) + '…' : returnFeedback}"
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar size={12} className={overdue ? 'text-red-500' : 'text-muted-foreground'} />
                        <span className={overdue ? 'font-semibold text-red-600' : 'text-muted-foreground'}>
                          {overdue ? 'Overdue — ' : 'Due '}{event.endDate}
                        </span>
                      </div>
                      {progress && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">My completion</span>
                            <span className="font-medium">{progress.completionPct}%</span>
                          </div>
                          <Progress
                            value={progress.completionPct}
                            indicatorClassName={overdue ? 'bg-red-500' : undefined}
                          />
                        </div>
                      )}
                      {isReturned ? (
                        <Button
                          size="sm"
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                          asChild
                        >
                          <Link to={`/events/${event.id}/questionnaire`}>
                            Revise &amp; Resubmit <ArrowRight size={13} />
                          </Link>
                        </Button>
                      ) : progress?.completionPct === 100 ? (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                            <Link to={`/events/${event.id}/questionnaire?mode=preview`}>
                              <Eye size={13} /> Preview
                            </Link>
                          </Button>
                          <Button size="sm" className="flex-1 gap-1.5" asChild>
                            <Link to={`/events/${event.id}/questionnaire`}>
                              <Pencil size={13} /> Edit Response
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant={overdue ? 'destructive' : 'default'}
                          size="sm"
                          className="w-full"
                          asChild
                        >
                          <Link to={`/events/${event.id}/questionnaire`}>
                            {progress?.status === 'Not Started' ? 'Start Assessment' : 'Continue'}
                            <ArrowRight size={13} className="ml-1" />
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {/* Completed Assessments — collapsible */}
      {completedEvents.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex w-full items-center justify-between rounded-xl border bg-card px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-foreground">
                Completed Assessments
              </span>
              <Badge variant="secondary">{completedEvents.length}</Badge>
            </div>
            {showCompleted ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          {showCompleted && (
            <Card className="mt-2">
              <div className="divide-y">
                {completedEvents.map(event => {
                  const progress = myProgress(event);
                  return (
                    <div key={event.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{event.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Closed {event.endDate}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {progress && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${RESPONDENT_STATUS_COLOR[progress.status]}`}>
                            {progress.status}
                          </span>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/events/${event.id}`}><ArrowRight size={14} /></Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

// Helper: convert EventStatus → display label + pill colors
const EVENT_STATUS_DISPLAY: Record<string, { label: string; bg: string; fg: string }> = {
  'Open':        { label: 'Open',         bg: '#dbeafe', fg: '#1f63c0' },
  'In Progress': { label: 'In progress',  bg: '#d8f7f7', fg: '#0c8e8e' },
  'Completed':   { label: 'Completed',    bg: '#d9f6e3', fg: '#0f8a4b' },
  'Closed':      { label: 'Completed',    bg: '#d9f6e3', fg: '#0f8a4b' },
  'Scheduled':   { label: 'Scheduled',    bg: '#ece2ff', fg: '#6a1fe0' },
  'Draft':       { label: 'Scheduled',    bg: '#ece2ff', fg: '#6a1fe0' },
};

// Helper: maturity level → numeric 1-5
const MATURITY_NUM: Record<MaturityLevel, number> = {
  'Initial': 1, 'Managed': 2, 'Defined': 3, 'Quantitatively Managed': 4, 'Optimizing': 5,
};

// Helper: 1-5 score → bar fill gradient
function matFill(s: number): string {
  if (s >= 4)   return 'linear-gradient(90deg,#16b364,#34d17e)';
  if (s >= 3.2) return 'linear-gradient(90deg,#13b4cf,#2e7de0)';
  if (s >= 2.6) return 'linear-gradient(90deg,#ffb020,#ff9f1c)';
  return 'linear-gradient(90deg,#ff5c7a,#ff4d6d)';
}
function matColor(s: number): string {
  if (s >= 4)   return '#16a34a';
  if (s >= 3.2) return '#2e7de0';
  if (s >= 2.6) return '#e8920c';
  return '#ff4d6d';
}

function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('g2a-store-updated', refresh);
    return () => window.removeEventListener('g2a-store-updated', refresh);
  }, []);

  const today = new Date();
  const ev = allEvents();
  const templates = getTemplates();
  const users = getUsers();
  const categories = getCategories();

  const activeEvents = ev.filter(e => e.status === 'Open' || e.status === 'In Progress');
  const completedCount = ev.filter(e => e.status === 'Completed' || e.status === 'Closed').length;
  const overdueCount = activeEvents.filter(e => new Date(e.endDate) < today).length;

  // Count open recommendations across all events
  const openRecsCount = ev.reduce((sum, e) => {
    if (!e.recommendations) return sum;
    return sum + Object.values(e.recommendations).flat()
      .filter(r => r.status !== 'Converted' && r.status !== 'Noted').length;
  }, 0);

  // Events table — top 5 events by recency, all statuses
  const tableEvents = [...ev].slice(0, 5).map(e => {
    const owner = users.find(u => u.id === e.ownerId);
    const matScore = e.maturityLevel ? MATURITY_NUM[e.maturityLevel]
      : e.score != null ? e.score / 20 : null;
    const st = EVENT_STATUS_DISPLAY[e.status] ?? { label: e.status, bg: '#eef1f4', fg: '#6b7888' };
    return {
      id: e.id,
      name: e.name,
      assessor: owner?.name ?? '—',
      status: st,
      compPct: e.completionRate ?? 0,
      matScore,
    };
  });

  // Maturity by category
  const catRows = categories.slice(0, 5).map(cat => {
    const catTemplateIds = templates.filter(t => t.categoryId === cat.id).map(t => t.id);
    const catEvents = ev.filter(e => catTemplateIds.includes(e.templateId) && (e.maturityLevel || e.score != null));
    const scores = catEvents.map(e =>
      e.maturityLevel ? MATURITY_NUM[e.maturityLevel] : (e.score ?? 0) / 20
    );
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { name: cat.name, score: avg };
  }).filter(r => r.score != null) as { name: string; score: number }[];

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const subline = [
    `${activeEvents.length} active event${activeEvents.length !== 1 ? 's' : ''}`,
    overdueCount > 0 ? `${overdueCount} need your attention` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="min-h-full" style={{ background: '#fbfcfe' }}>
      <HeroBand
        greeting={`${greeting}, ${firstName}`}
        subline={subline}
        user={user}
        role="admin"
        buttons={[
          { label: 'View tasks', icon: ListChecks, primary: true, onClick: () => navigate('/tasks') },
          { label: 'View reports', icon: ClipboardList, onClick: () => navigate('/reports') },
        ]}
      />

      {/* ── Body ──────────────────────────────────────────────── */}
      <div style={{ padding: '0 26px 32px' }}>

        {/* Stat cards — negative margin overlaps hero */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: -48, position: 'relative' }}>
          {[
            { bg: '#d8f7f7', iconColor: '#0e9ea0', value: activeEvents.length,  label: 'Active events',         Icon: Activity },
            { bg: '#d9f6e3', iconColor: '#16a34a', value: completedCount,        label: 'Completed',            Icon: CircleCheckBig },
            { bg: '#ece2ff', iconColor: '#7b2ff7', value: openRecsCount,         label: 'Open recommendations', Icon: Lightbulb },
            { bg: '#ffe1e7', iconColor: '#ff4d6d', value: overdueCount,          label: 'Overdue events',       Icon: ClockAlert },
          ].map(({ bg, iconColor, value, label, Icon }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 12px 34px -16px rgba(20,30,50,.26)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={21} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 800, color: '#161c25', marginTop: 12, letterSpacing: '-.02em' }}>{value}</div>
              <div style={{ fontSize: 13, color: '#6b7888' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Two-column body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginTop: 18, alignItems: 'start' }}>

          {/* Events table */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 2px rgba(20,30,50,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f0f3f6' }}>
              <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: '#161c25' }}>Active &amp; recent events</span>
              <Link to="/reports" style={{ fontSize: 13, fontWeight: 600, color: '#7b2ff7', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div style={{ padding: '4px 8px 10px' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .9fr 1fr .5fr', gap: 12, padding: '9px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' as const, color: '#9aa5b1' }}>
                <span>Event</span><span>Status</span><span>Completion</span><span style={{ textAlign: 'right' }}>Maturity</span>
              </div>
              {tableEvents.length === 0 ? (
                <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: '#9aa5b1' }}>No events yet</div>
              ) : tableEvents.map(e => (
                <Link key={e.id} to={`/events/${e.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .9fr 1fr .5fr', gap: 12, padding: '11px 14px', borderTop: '1px solid #f4f6f8', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e2730' }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: '#94a0ac', marginTop: 1 }}>{e.assessor}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: e.status.bg, color: e.status.fg }}>
                        {e.status.label}
                      </span>
                    </div>
                    <div>
                      <div style={{ height: 7, borderRadius: 6, background: '#eef1f4', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${e.compPct}%`, borderRadius: 6, background: e.compPct === 100 ? 'linear-gradient(90deg,#16b364,#34d17e)' : 'linear-gradient(90deg,#13b4cf,#7b2ff7)' }} />
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#94a0ac', marginTop: 3 }}>{e.compPct}%</div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', fontSize: 14, fontWeight: 600, color: e.matScore != null ? '#161c25' : '#c3cdd7' }}>
                      {e.matScore != null ? e.matScore.toFixed(1) : '—'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Maturity by category */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 2px rgba(20,30,50,.05)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f3f6' }}>
              <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: '#161c25' }}>Maturity by category</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {catRows.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9aa5b1', textAlign: 'center', padding: '16px 0' }}>
                  Complete assessments to see category scores
                </div>
              ) : catRows.map(m => (
                <div key={m.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#3a4550' }}>{m.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, color: matColor(m.score) }}>{m.score.toFixed(1)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: '#eef1f4', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(m.score / 5) * 100}%`, borderRadius: 6, background: matFill(m.score) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'assessor') return <AssessorDashboard />;
  return <RespondentDashboard />;
}
