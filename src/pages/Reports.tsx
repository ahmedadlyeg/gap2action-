import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, BarChart2, Users, CheckCircle2, Clock,
  ChevronDown, ChevronUp, ArrowRight, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { eventsApi, templatesApi, categoriesApi, type ApiEvent, type ApiTemplate, type ApiCategory } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'Open' | 'In Progress' | 'Completed' | 'Closed';
type SortKey = 'name' | 'template' | 'category' | 'completion' | 'score' | 'status';
type SortDir = 'asc' | 'desc';

interface ReportRow {
  event: ApiEvent;
  template: ApiTemplate | undefined;
  category: ApiCategory | undefined;
  completionPct: number;
  respondentCount: number;
  submittedCount: number;
  validatedCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'outline'> = {
  Open: 'success', 'In Progress': 'warning', Completed: 'secondary',
  Closed: 'outline', Draft: 'outline', Scheduled: 'outline',
};

const MATURITY_COLOR: Record<string, string> = {
  Initial:                 'text-red-600 bg-red-50 border-red-200',
  Managed:                 'text-orange-600 bg-orange-50 border-orange-200',
  Defined:                 'text-amber-600 bg-amber-50 border-amber-200',
  'Quantitatively Managed':'text-blue-600 bg-blue-50 border-blue-200',
  Optimizing:              'text-emerald-600 bg-emerald-50 border-emerald-200',
};

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function exportCSV(rows: ReportRow[]) {
  const headers = [
    'Event Name', 'Template', 'Category', 'Status',
    'Respondents', 'Submitted', 'Validated', 'Completion %',
    'Score', 'Maturity Level', 'Start Date', 'End Date',
  ];
  const csvRows = rows.map(r => [
    `"${r.event.name}"`,
    `"${r.template?.name ?? ''}"`,
    `"${r.category?.name ?? ''}"`,
    r.event.status,
    r.respondentCount,
    r.submittedCount,
    r.validatedCount,
    r.completionPct,
    r.event.score != null ? r.event.score.toFixed(1) : '',
    `"${r.event.maturityLevel ?? ''}"`,
    fmt(r.event.startDate),
    fmt(r.event.endDate),
  ].join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gap2action-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${color}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronDown size={12} className="opacity-30" />
        }
      </span>
    </th>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Reports() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    Promise.all([eventsApi.list(), templatesApi.list(), categoriesApi.list()])
      .then(([events, templates, categories]) => {
        const buildRows = (evs: ApiEvent[]) => evs.map(ev => {
          const tpl = templates.find(t => t.id === ev.templateId);
          const cat = categories.find(c => c.id === tpl?.categoryId);
          const respondentCount = ev.respondents.length;
          const submittedCount  = ev.respondents.filter(p =>
            p.status === 'Submitted' || p.status === 'Validated'
          ).length;
          const validatedCount  = ev.respondents.filter(p => p.status === 'Validated').length;
          const completionPct   = respondentCount > 0
            ? Math.round(submittedCount / respondentCount * 100)
            : Math.round(ev.completionRate ?? 0);
          return { event: ev, template: tpl, category: cat, completionPct, respondentCount, submittedCount, validatedCount };
        });
        setRows(buildRows(events));
      })
      .catch(() => {});
  }, []);

  // Filter
  const filtered = rows.filter(r =>
    statusFilter === 'all' || r.event.status === statusFilter
  );

  // Sort
  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name')       cmp = a.event.name.localeCompare(b.event.name);
    if (sortKey === 'template')   cmp = (a.template?.name ?? '').localeCompare(b.template?.name ?? '');
    if (sortKey === 'category')   cmp = (a.category?.name ?? '').localeCompare(b.category?.name ?? '');
    if (sortKey === 'status')     cmp = a.event.status.localeCompare(b.event.status);
    if (sortKey === 'completion') cmp = a.completionPct - b.completionPct;
    if (sortKey === 'score')      cmp = (a.event.score ?? -1) - (b.event.score ?? -1);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Summary stats
  const total      = rows.length;
  const completed  = rows.filter(r => r.event.status === 'Completed' || r.event.status === 'Closed').length;
  const avgCompletion = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.completionPct, 0) / rows.length)
    : 0;
  const scoredEvents = rows.filter(r => r.event.score != null);
  const avgScore = scoredEvents.length > 0
    ? (scoredEvents.reduce((s, r) => s + (r.event.score ?? 0), 0) / scoredEvents.length).toFixed(1)
    : '—';

  const STATUS_OPTIONS: StatusFilter[] = ['all', 'Open', 'In Progress', 'Completed', 'Closed'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of all assessment events, completion rates, and scores.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(sorted)}
          disabled={sorted.length === 0}
        >
          <Download size={14} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Events"
          value={total}
          sub={`${completed} completed`}
          icon={FileText}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          label="Avg Completion"
          value={`${avgCompletion}%`}
          sub="across all events"
          icon={Clock}
          color="bg-amber-50 text-amber-600"
        />
        <SummaryCard
          label="Avg Score"
          value={avgScore}
          sub={scoredEvents.length > 0 ? `from ${scoredEvents.length} scored event${scoredEvents.length > 1 ? 's' : ''}` : 'no scores yet'}
          icon={BarChart2}
          color="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          label="Total Respondents"
          value={rows.reduce((s, r) => s + r.respondentCount, 0)}
          sub={`${rows.reduce((s, r) => s + r.validatedCount, 0)} validated`}
          icon={Users}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {s === 'all' ? `All (${rows.length})` : `${s} (${rows.filter(r => r.event.status === s).length})`}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <FileText size={32} className="text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No events found</p>
            <p className="text-xs text-muted-foreground">
              {statusFilter !== 'all' ? 'Try a different filter.' : 'Create an assessment event to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <SortHeader label="Event"      sortKey="name"       current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Template"   sortKey="template"   current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Category"   sortKey="category"   current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Status"     sortKey="status"     current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Respondents</th>
                  <SortHeader label="Completion" sortKey="completion" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Score"      sortKey="score"      current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Maturity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">End Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((r, i) => (
                  <tr key={r.event.id} className={`hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                    {/* Event name */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground">{r.event.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{r.event.description ?? ''}</p>
                    </td>
                    {/* Template */}
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {r.template ? (
                        <span>{r.template.name}<span className="ml-1 text-muted-foreground/60">v{r.template.version}</span></span>
                      ) : '—'}
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{r.category?.name ?? '—'}</td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <Badge variant={STATUS_VARIANT[r.event.status] ?? 'outline'} className="text-[11px]">
                        {r.event.status}
                      </Badge>
                    </td>
                    {/* Respondents */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users size={12} />
                        <span>{r.submittedCount}/{r.respondentCount}</span>
                        {r.validatedCount > 0 && (
                          <span className="text-emerald-600 flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> {r.validatedCount}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Completion */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Progress value={r.completionPct} className="h-1.5 w-20" />
                        <span className="text-xs text-muted-foreground w-8">{r.completionPct}%</span>
                      </div>
                    </td>
                    {/* Score */}
                    <td className="px-4 py-3.5">
                      {r.event.score != null ? (
                        <span className="text-sm font-semibold text-foreground">{r.event.score.toFixed(1)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Maturity */}
                    <td className="px-4 py-3.5">
                      {r.event.maturityLevel ? (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${MATURITY_COLOR[r.event.maturityLevel] ?? 'text-muted-foreground bg-muted border-border'}`}>
                          {r.event.maturityLevel}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* End date */}
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{fmt(r.event.endDate)}</td>
                    {/* Action */}
                    <td className="px-4 py-3.5">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link to={`/events/${r.event.id}`}>
                          View <ArrowRight size={12} className="ml-1" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-right">
        Showing {sorted.length} of {rows.length} event{rows.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
