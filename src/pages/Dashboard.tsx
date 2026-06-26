import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, TrendingUp, TrendingDown, Minus,
  AlertCircle, ArrowRight, Calendar, Users, CheckCircle2,
  ChevronDown, ChevronUp, Plus, FolderOpen, ShieldCheck, Eye, Pencil, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  events as seedEvents, templates, users, categories, currentUser,
} from '@/services/mockData';
import { getEvents, getReturnFeedback } from '@/services/store';
import type { MaturityLevel, RespondentStatus } from '@/types';

function allEvents() {
  const map = new globalThis.Map([...seedEvents, ...getEvents()].map(e => [e.id, e]));
  return [...map.values()];
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Assessor Dashboard ───────────────────────────────────────────────────────

function AssessorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

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

  return (
    <PageShell
      greeting={`Welcome, ${user?.name?.split(' ')[0]}`}
      subtitle="Here's the status of your assessment events."
    >
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
              const tpl = templates.find(t => t.id === event.templateId);
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
    </PageShell>
  );
}

// ─── Respondent Dashboard ─────────────────────────────────────────────────────

function RespondentDashboard() {
  const { user } = useAuth();
  const [showCompleted, setShowCompleted] = useState(false);
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

  return (
    <PageShell
      greeting={`Hi, ${user?.name?.split(' ')[0]}`}
      subtitle="Your pending and completed assessments."
    >
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
                const uid = user?.id ?? currentUser.id;
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
                const uid = user?.id ?? currentUser.id;
                const returnFeedback = getReturnFeedback(event.id, uid);
                const isReturned = returnFeedback !== null;
                const progress = myProgress(event);
                const overdue = !isReturned && isOverdue(event.endDate);
                const tpl = templates.find(t => t.id === event.templateId);

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
    </PageShell>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const { user } = useAuth();

  const roleCount = {
    admin: users.filter(u => u.role === 'admin').length,
    assessor: users.filter(u => u.role === 'assessor').length,
    respondent: users.filter(u => u.role === 'respondent').length,
  };
  const ev = allEvents();
  const activeEvents = ev.filter(e => e.status === 'Open' || e.status === 'In Progress');
  const completedEvents = ev.filter(e => e.score !== undefined);
  const avgScore = completedEvents.length
    ? Math.round(completedEvents.reduce((s, e) => s + (e.score ?? 0), 0) / completedEvents.length)
    : null;

  const TREND_ICON = {
    up: <TrendingUp size={14} className="text-emerald-600" />,
    down: <TrendingDown size={14} className="text-red-500" />,
    flat: <Minus size={14} className="text-slate-400" />,
  };

  return (
    <PageShell
      greeting={`Welcome, ${user?.name?.split(' ')[0]}`}
      subtitle="Platform overview across all events and users."
    >
      {/* Executive KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Active Events',
            value: activeEvents.length,
            icon: ClipboardList,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Average Maturity Score',
            value: avgScore !== null ? `${avgScore}%` : '—',
            icon: TrendingUp,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
          },
          {
            label: 'Overall Readiness',
            value: avgScore !== null ? (avgScore >= 70 ? 'High' : avgScore >= 50 ? 'Medium' : 'Low') : '—',
            icon: ShieldCheck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon size={16} className={kpi.color} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Events table */}
      <div>
        <SectionHeader title="Recent Events" />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Event</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Maturity</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground">Trend</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {allEvents().map(event => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground truncate max-w-[220px]">{event.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.endDate}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={STATUS_VARIANT[event.status] ?? 'outline'}>{event.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-foreground">
                      {event.score !== undefined ? `${event.score}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {event.maturityLevel ? <MaturityPill level={event.maturityLevel} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {event.trend ? TREND_ICON[event.trend] : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-3.5">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/events/${event.id}`}><ArrowRight size={14} /></Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Admin section */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* User counts */}
        <div>
          <SectionHeader title="Users by Role" />
          <Card>
            <CardContent className="pt-5 space-y-3">
              {(Object.entries(roleCount) as [string, number][]).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm capitalize text-foreground">{role}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{count}</span>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <Link to="/users">
                  <Users size={14} className="mr-1.5" /> Manage Users
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div>
          <SectionHeader title="Quick Links" />
          <Card>
            <CardContent className="pt-5 space-y-2">
              {[
                { to: '/users', icon: Users, label: 'User Management', desc: `${users.length} users` },
                { to: '/categories', icon: FolderOpen, label: 'Assessment Categories', desc: `${categories.length} categories` },
              ].map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 rounded-lg border p-3.5 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <link.icon size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Root export — role switch ─────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'assessor') return <AssessorDashboard />;
  if (user?.role === 'respondent') return <RespondentDashboard />;
  return <AdminDashboard />;
}
