import { Fragment, useState } from 'react';
import { Download, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { resultsByEventId } from '@/services/resultsMockData';
import { users } from '@/services/mockData';
import type { AssessmentEvent, Template } from '@/types';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userName(uid: string) { return users.find(u => u.id === uid)?.name ?? uid; }
function userInitials(uid: string) { return users.find(u => u.id === uid)?.initials ?? '??'; }

function scoreCellCls(score: number | null): string {
  if (score === null) return 'bg-muted/40 text-muted-foreground';
  if (score <= 1) return 'bg-red-100 text-red-700';
  if (score <= 2) return 'bg-orange-100 text-orange-700';
  if (score <= 3) return 'bg-amber-100 text-amber-700';
  if (score <= 4) return 'bg-emerald-100 text-emerald-700';
  return 'bg-green-100 text-green-800';
}

function maturityColor(levelNum: number) {
  return [
    '', 'text-red-600 bg-red-50 border-red-200',
    'text-orange-600 bg-orange-50 border-orange-200',
    'text-amber-600 bg-amber-50 border-amber-200',
    'text-emerald-600 bg-emerald-50 border-emerald-200',
    'text-green-700 bg-green-50 border-green-200',
  ][levelNum] ?? 'text-muted-foreground bg-muted border-border';
}

function sectionBarColor(achieved: number, target: number): string {
  const ratio = achieved / target;
  if (ratio >= 1) return 'bg-emerald-500';
  if (ratio >= 0.85) return 'bg-amber-400';
  return 'bg-orange-500';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ExportToast({ visible }: { visible: boolean }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border bg-card px-4 py-3 shadow-lg text-sm transition-all duration-300',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
    )}>
      <Info size={15} className="text-primary shrink-0" />
      Export coming soon
    </div>
  );
}

// ─── Section Bar Chart ────────────────────────────────────────────────────────

function SectionBarChart({ sections, maxScore }: {
  sections: { id: string; name: string; achievedScore: number; targetScore: number }[];
  maxScore: number;
}) {
  return (
    <div className="space-y-4">
      {sections.map(s => {
        const achievedPct = (s.achievedScore / maxScore) * 100;
        const targetPct = (s.targetScore / maxScore) * 100;
        const color = sectionBarColor(s.achievedScore, s.targetScore);
        const gap = s.achievedScore - s.targetScore;
        const atTarget = gap >= 0;

        return (
          <div key={s.id} className="flex items-center gap-4">
            {/* Section name */}
            <span className="w-44 shrink-0 text-sm font-medium text-foreground truncate" title={s.name}>
              {s.name}
            </span>

            {/* Bar track */}
            <div className="relative flex-1 h-5 rounded-full bg-muted overflow-visible">
              {/* Achieved fill */}
              <div
                className={cn('absolute top-0 left-0 h-full rounded-full transition-all duration-700', color)}
                style={{ width: `${achievedPct}%` }}
              />
              {/* Target marker */}
              <div
                className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-foreground/50 z-10"
                style={{ left: `${targetPct}%` }}
              >
                <div className="absolute -top-1 -translate-x-1/2 text-[9px] font-semibold text-foreground/60 whitespace-nowrap">
                  Target
                </div>
              </div>
            </div>

            {/* Score + delta */}
            <div className="flex items-center gap-1.5 w-24 justify-end shrink-0">
              <span className="text-sm font-semibold text-foreground">
                {s.achievedScore.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">/ {maxScore.toFixed(1)}</span>
              <span className={cn(
                'ml-1 flex items-center text-[10px] font-semibold',
                atTarget ? 'text-emerald-600' : 'text-orange-600',
              )}>
                {atTarget
                  ? <><TrendingUp size={11} className="mr-0.5" />+{gap.toFixed(1)}</>
                  : <><TrendingDown size={11} className="mr-0.5" />{gap.toFixed(1)}</>}
              </span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          At or above target
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
          Below target
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-foreground/50" />
          Target score marker
        </div>
      </div>
    </div>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({ respondentIds, sections }: {
  respondentIds: string[];
  sections: Array<{ id: string; name: string; questions: Array<{
    id: string; text: string; type: 'scored' | 'text';
    respondentScores: Record<string, number | null>;
    respondentLabels: Record<string, string>;
    averageScore: number | null;
  }> }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-max border-collapse text-xs">
        {/* Sticky header */}
        <thead>
          <tr className="border-b bg-muted/60">
            <th className="sticky left-0 z-20 bg-muted/60 px-4 py-3 text-left font-semibold text-foreground w-64 min-w-[16rem]">
              Question
            </th>
            {respondentIds.map(uid => (
              <th key={uid} className="sticky top-0 z-10 px-4 py-3 text-center font-semibold text-foreground min-w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  <UserAvatar name={userName(uid)} initials={userInitials(uid)} size="xs" />
                  <span className="leading-tight">{userName(uid).split(' ')[0]}</span>
                </div>
              </th>
            ))}
            <th className="px-4 py-3 text-center font-semibold text-foreground min-w-[80px] border-l">
              Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map(section => (
            <Fragment key={section.id}>
              {/* Section header row */}
              <tr className="bg-muted/30 border-y">
                <td
                  colSpan={respondentIds.length + 2}
                  className="sticky left-0 px-4 py-2 font-semibold text-foreground text-[11px] uppercase tracking-wide"
                >
                  {section.name}
                </td>
              </tr>
              {section.questions.map(q => (
                <tr key={q.id} className="border-b hover:bg-muted/10 transition-colors group">
                  {/* Question text — sticky */}
                  <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/10 px-4 py-3 text-muted-foreground max-w-[16rem]">
                    <span className="line-clamp-2 leading-relaxed">{q.text}</span>
                  </td>
                  {/* Per-respondent cells */}
                  {respondentIds.map(uid => {
                    const score = q.respondentScores[uid] ?? null;
                    const label = q.respondentLabels[uid] ?? '—';
                    if (q.type === 'text') {
                      return (
                        <td key={uid} className="px-4 py-3 text-center">
                          <span className="text-muted-foreground italic">{label}</span>
                        </td>
                      );
                    }
                    return (
                      <td key={uid} className="px-4 py-3 text-center">
                        <div className={cn('inline-flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 min-w-[60px]', scoreCellCls(score))}>
                          <span className="text-sm font-bold">{score ?? '—'}</span>
                          <span className="text-[9px] leading-tight opacity-80 max-w-[80px] text-center">{label}</span>
                        </div>
                      </td>
                    );
                  })}
                  {/* Average cell */}
                  <td className="px-4 py-3 text-center border-l">
                    {q.type === 'text' || q.averageScore === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className={cn('inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 min-w-[48px]', scoreCellCls(q.averageScore))}>
                        <span className="text-sm font-bold">{q.averageScore.toFixed(1)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ResultsTabProps {
  event: AssessmentEvent;
  template: Template | null;
}

export function ResultsTab({ event, template }: ResultsTabProps) {
  const [showExport, setShowExport] = useState(false);
  const data = resultsByEventId[event.id];
  const isClosed = event.status === 'Completed' || event.status === 'Closed';
  const MAX_SCORE = 5;

  const handleExport = () => {
    setShowExport(true);
    setTimeout(() => setShowExport(false), 2500);
  };

  // ── No results yet ──
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <Minus size={24} className="text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1">Results not yet available</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Results will be generated once all submissions are validated and the event is closed.
        </p>
      </div>
    );
  }

  const gap = data.overallScore - data.targetScore;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-10">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{event.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {template?.name}{template && ` · v${template.version}`}
            {data.completedDate && ` · Completed ${formatDate(data.completedDate)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={handleExport}>
          <Download size={14} />
          Export PDF
        </Button>
      </div>

      {/* ── Overall score card ── */}
      <div className="rounded-2xl border bg-card p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Overall Score</p>
        <div className="flex flex-wrap items-end gap-6">
          {/* Big number */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-extrabold text-foreground tracking-tight">
              {data.overallScore.toFixed(1)}
            </span>
            <span className="text-xl font-semibold text-muted-foreground">
              / {MAX_SCORE.toFixed(1)}
            </span>
          </div>

          {/* Maturity level badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-sm font-semibold px-3 py-1 rounded-full border',
              maturityColor(data.maturityLevelNum),
            )}
          >
            Level {data.maturityLevelNum} — {data.maturityLevelName}
          </Badge>
        </div>

        {/* Target indicator */}
        <div className="flex items-center gap-6 mt-5 pt-5 border-t flex-wrap">
          <div className="text-sm">
            <span className="text-muted-foreground">Target: </span>
            <span className="font-semibold text-foreground">
              {data.targetScore.toFixed(1)} / {MAX_SCORE.toFixed(1)}
            </span>
            <span className="text-muted-foreground ml-1.5">
              (Level {data.targetLevelNum} — {data.targetLevelName})
            </span>
          </div>
          <div className={cn('flex items-center gap-1.5 text-sm font-semibold', gap >= 0 ? 'text-emerald-600' : 'text-orange-600')}>
            {gap >= 0
              ? <><TrendingUp size={15} /> {gap.toFixed(1)} above target</>
              : <><TrendingDown size={15} /> {Math.abs(gap).toFixed(1)} below target</>}
          </div>
        </div>
      </div>

      {/* ── Section scores ── */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-5">Section Scores</h3>
        <SectionBarChart sections={data.sections} maxScore={MAX_SCORE} />
      </div>

      {/* ── Respondent comparison table (closed events only) ── */}
      {isClosed && (
        <div>
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 mb-5">
            <Info size={15} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Individual answers are visible now that the event has closed.</strong>{' '}
              During the event, respondents could only see their own answers.
            </p>
          </div>

          <h3 className="text-base font-semibold text-foreground mb-4">Respondent Answer Comparison</h3>
          <ComparisonTable
            respondentIds={data.respondentIds}
            sections={data.sections.map(s => ({
              ...s,
              questions: s.questions,
            }))}
          />

          {/* Score color legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
            {[
              { label: '1 — Very low', cls: 'bg-red-100 text-red-700' },
              { label: '2 — Low', cls: 'bg-orange-100 text-orange-700' },
              { label: '3 — Moderate', cls: 'bg-amber-100 text-amber-700' },
              { label: '4 — High', cls: 'bg-emerald-100 text-emerald-700' },
              { label: '5 — Very high', cls: 'bg-green-100 text-green-800' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn('inline-block h-4 w-4 rounded', cls)} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      <ExportToast visible={showExport} />
    </div>
  );
}
