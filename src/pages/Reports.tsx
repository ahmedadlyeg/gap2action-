import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { events as seedEvents, categories, templates } from '@/services/mockData';
import { resultsByEventId } from '@/services/resultsMockData';
import { getEvents } from '@/services/store';
import type { AssessmentEvent } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function allEvents(): AssessmentEvent[] {
  const map = new globalThis.Map([...seedEvents, ...getEvents()].map(e => [e.id, e]));
  return [...map.values()];
}

function templateName(templateId: string) {
  return templates.find(t => t.id === templateId)?.name ?? '—';
}

function categoryForTemplate(templateId: string) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return null;
  return categories.find(c => c.id === tpl.categoryId) ?? null;
}

type StatusFilter = 'All' | 'Open' | 'In Progress' | 'Completed' | 'Closed' | 'Draft';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  Completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
  Open:       { label: 'Open',      cls: 'bg-green-100 text-green-700' },
  'In Progress': { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  Closed:     { label: 'Closed',    cls: 'bg-slate-100 text-slate-600' },
  Draft:      { label: 'Draft',     cls: 'bg-gray-100 text-gray-500' },
  Scheduled:  { label: 'Scheduled', cls: 'bg-violet-100 text-violet-700' },
};

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(evts: AssessmentEvent[]) {
  const headers = ['Event Name', 'Template', 'Status', 'Score', 'Maturity Level', 'Due Date', 'Respondents'];
  const rows = evts.map(e => {
    const result = resultsByEventId[e.id];
    return [
      `"${e.name}"`,
      `"${templateName(e.templateId)}"`,
      e.status,
      result ? String(Math.round(result.overallScore * 20)) : (e.score != null ? String(e.score) : ''),
      result ? result.maturityLevelName : (e.maturityLevel ?? ''),
      e.endDate ?? '',
      String(e.respondentIds.length),
    ];
  });
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gap2action_report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Reports() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const evts = allEvents();

  // KPI data
  const totalAssessments = evts.length;
  const completedEvents = evts.filter(e => e.status === 'Completed').length;
  const activeEvents = evts.filter(e => e.status === 'Open' || e.status === 'In Progress').length;
  const scoredEvents = evts.filter(e => resultsByEventId[e.id] || e.score != null);
  const avgScore = scoredEvents.length > 0
    ? Math.round(
        scoredEvents.reduce((sum, e) => {
          const r = resultsByEventId[e.id];
          return sum + (r ? Math.round(r.overallScore * 20) : (e.score ?? 0));
        }, 0) / scoredEvents.length
      )
    : null;

  // Filter events
  const filteredEvts = statusFilter === 'All'
    ? evts
    : evts.filter(e => e.status === statusFilter);

  const filterOptions: StatusFilter[] = ['All', 'Open', 'In Progress', 'Completed', 'Closed', 'Draft'];

  // Category breakdown
  const catBreakdown = categories.map(cat => {
    const catEvts = evts.filter(e => {
      const tpl = templates.find(t => t.id === e.templateId);
      return tpl?.categoryId === cat.id;
    });
    const catScored = catEvts.filter(e => resultsByEventId[e.id] || e.score != null);
    const catAvg = catScored.length > 0
      ? Math.round(
          catScored.reduce((sum, e) => {
            const r = resultsByEventId[e.id];
            return sum + (r ? Math.round(r.overallScore * 20) : (e.score ?? 0));
          }, 0) / catScored.length
        )
      : null;
    return { cat, count: catEvts.length, avg: catAvg };
  }).filter(c => c.count > 0);

  return (
    <div className="px-8 py-7 max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Cross-event analytics and exportable summaries.</p>
      </div>

      {/* ── Section 1: KPI cards ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Assessments', value: totalAssessments },
            { label: 'Completed Events',  value: completedEvents },
            { label: 'Active Events',     value: activeEvents },
            { label: 'Average Score',     value: avgScore != null ? `${avgScore}%` : '—' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Section 2: Events Table ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Events Summary</h2>
          <Button size="sm" variant="outline" onClick={() => exportCSV(filteredEvts)}>
            <Download size={13} className="mr-1.5" /> Export CSV
          </Button>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {f}
              {f !== 'All' && (
                <span className={`ml-1.5 text-[10px] font-bold ${statusFilter === f ? 'opacity-70' : ''}`}>
                  {evts.filter(e => e.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Event Name', 'Template', 'Status', 'Score', 'Maturity Level', 'Due Date', 'Respondents'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEvts.map(e => {
                const result = resultsByEventId[e.id];
                const score = result
                  ? `${Math.round(result.overallScore * 20)}%`
                  : e.score != null ? `${e.score}%` : '—';
                const maturity = result
                  ? result.maturityLevelName
                  : e.maturityLevel ?? '—';
                const sbadge = STATUS_BADGE[e.status];
                return (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{e.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{templateName(e.templateId)}</td>
                    <td className="px-4 py-3">
                      {sbadge
                        ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sbadge.cls}`}>{sbadge.label}</span>
                        : <Badge variant="outline">{e.status}</Badge>
                      }
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{score}</td>
                    <td className="px-4 py-3 text-muted-foreground">{maturity}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(e.endDate)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{e.respondentIds.length}</td>
                  </tr>
                );
              })}
              {filteredEvts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No events match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 3: Category Breakdown ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Category Breakdown</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catBreakdown.map(({ cat, count, avg }) => (
            <Card key={cat.id}>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground text-lg">{count}</span> event{count !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg score:{' '}
                  <span className="font-semibold text-foreground">{avg != null ? `${avg}%` : '—'}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
