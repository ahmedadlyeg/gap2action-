import { TrendingUp, TrendingDown, Minus, CheckCircle2, ArrowRight, CalendarDays, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { comparisonByCurrentEventId } from '@/services/compareMockData';
import type { AssessmentEvent } from '@/types';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function deltaColor(d: number): string {
  if (d > 0) return 'text-emerald-600';
  if (d < 0) return 'text-red-600';
  return 'text-muted-foreground';
}

function rowBg(d: number): string {
  if (d > 0)  return 'bg-emerald-50/60 hover:bg-emerald-50 transition-colors';
  if (d < 0)  return 'bg-red-50/60 hover:bg-red-50 transition-colors';
  return 'hover:bg-muted/20 transition-colors';
}

function levelBadgeCls(n: number): string {
  return [
    '',
    'bg-red-50 text-red-700 border-red-200',
    'bg-orange-50 text-orange-700 border-orange-200',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-green-50 text-green-700 border-green-200',
  ][n] ?? 'bg-muted text-muted-foreground border-border';
}

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, levelNum, levelName, label, maxScore = 5 }: {
  score: number;
  levelNum: number;
  levelName: string;
  label: string;
  maxScore?: number;
}) {
  const R = 54;
  const CX = 72;
  const CY = 72;
  const circ = 2 * Math.PI * R;
  const pct = Math.min(score / maxScore, 1);
  const offset = circ - pct * circ;

  const trackColor = '#e2e8f0';
  const barColor = levelNum >= 4 ? '#10b981' : levelNum === 3 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <svg width={144} height={144} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={trackColor} strokeWidth={11} />
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={barColor}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
        <text x={CX} y={CY - 7} textAnchor="middle" fontSize={26} fontWeight={800} fill="#0f172a">
          {score.toFixed(1)}
        </text>
        <text x={CX} y={CY + 13} textAnchor="middle" fontSize={10} fill="#64748b">
          / {maxScore.toFixed(0)}
        </text>
      </svg>
      <Badge
        variant="outline"
        className={cn('text-xs font-semibold border px-3 py-1', levelBadgeCls(levelNum))}
      >
        Level {levelNum} — {levelName}
      </Badge>
    </div>
  );
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, large }: { delta: number; large?: boolean }) {
  const positive = delta > 0;
  const zero = delta === 0;
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-full border-2 font-bold',
      large ? 'h-20 w-20 text-xl gap-1' : 'h-10 w-10 text-sm',
      zero
        ? 'border-muted bg-muted/40 text-muted-foreground'
        : positive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700',
    )}>
      {zero
        ? <Minus size={large ? 22 : 14} />
        : positive
          ? <TrendingUp size={large ? 22 : 14} />
          : <TrendingDown size={large ? 22 : 14} />}
      <span className={large ? 'text-lg' : 'text-xs'}>
        {positive ? '+' : ''}{delta.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CompareTabProps {
  event: AssessmentEvent;
}

export function CompareTab({ event }: CompareTabProps) {
  const data = comparisonByCurrentEventId[event.id];

  // ── No comparison available ──
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-5">
          <ArrowRight size={24} className="text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1">No previous assessment to compare</p>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          A delta comparison will appear here once a second assessment cycle has been completed for this template.
        </p>
      </div>
    );
  }

  const overallDelta = data.currentScore - data.previousScore;
  const improved = data.sections.filter(s => s.delta > 0).length;
  const declined = data.sections.filter(s => s.delta < 0).length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-10">

      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Reassessment Comparison</h2>
        <div className="flex items-center gap-2 flex-wrap mt-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{data.previousEventName}</span>
          <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">{data.currentEventName}</span>
        </div>
        {/* Date range */}
        <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={12} /> {fmtDate(data.previousEventDate)} → {fmtDate(data.currentEventDate)}
          </span>
          <Badge variant="outline" className="text-[10px] font-medium">
            {improved} improved · {declined} declined
          </Badge>
        </div>
      </div>

      {/* ── Overall Score Comparison ── */}
      <div className="rounded-2xl border bg-card p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-6 text-center">
          Overall Score
        </p>

        <div className="flex items-center justify-center gap-8 flex-wrap">
          {/* Previous */}
          <ScoreGauge
            score={data.previousScore}
            levelNum={data.previousLevelNum}
            levelName={data.previousLevelName}
            label="Previous"
          />

          {/* Delta */}
          <DeltaBadge delta={overallDelta} large />

          {/* Current */}
          <ScoreGauge
            score={data.currentScore}
            levelNum={data.currentLevelNum}
            levelName={data.currentLevelName}
            label="Current"
          />
        </div>

        {/* Level advancement banner */}
        {data.currentLevelNum > data.previousLevelNum && (
          <div className="flex items-center justify-center gap-2 mt-6 pt-5 border-t">
            <TrendingUp size={15} className="text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">
              Advanced from Level {data.previousLevelNum} ({data.previousLevelName}) to Level {data.currentLevelNum} ({data.currentLevelName})
            </p>
          </div>
        )}
        {data.currentLevelNum === data.previousLevelNum && (
          <div className="flex items-center justify-center gap-2 mt-6 pt-5 border-t">
            <Minus size={15} className="text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Remained at Level {data.currentLevelNum} — {data.currentLevelName}
            </p>
          </div>
        )}
        {data.currentLevelNum < data.previousLevelNum && (
          <div className="flex items-center justify-center gap-2 mt-6 pt-5 border-t">
            <TrendingDown size={15} className="text-red-600 shrink-0" />
            <p className="text-sm font-semibold text-red-700">
              Regressed from Level {data.previousLevelNum} ({data.previousLevelName}) to Level {data.currentLevelNum} ({data.currentLevelName})
            </p>
          </div>
        )}
      </div>

      {/* ── Section Comparison Table ── */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">Section Breakdown</h3>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Section</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Previous</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Current</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Change</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.sections.map(s => (
                <tr key={s.id} className={rowBg(s.delta)}>
                  <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {s.previousScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-0.5">/ 5</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-sm font-semibold text-foreground">
                      {s.currentScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-0.5">/ 5</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn('text-sm font-bold', deltaColor(s.delta))}>
                      {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {s.delta > 0 && <TrendingUp size={17} className="text-emerald-600 mx-auto" />}
                    {s.delta < 0 && <TrendingDown size={17} className="text-red-500 mx-auto" />}
                    {s.delta === 0 && <Minus size={17} className="text-muted-foreground mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Overall totals row */}
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Overall</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-bold text-muted-foreground">{data.previousScore.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground ml-0.5">/ 5</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-bold text-foreground">{data.currentScore.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground ml-0.5">/ 5</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('text-sm font-bold', deltaColor(overallDelta))}>
                    {overallDelta > 0 ? '+' : ''}{overallDelta.toFixed(1)}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  {overallDelta > 0 && <TrendingUp size={17} className="text-emerald-600 mx-auto" />}
                  {overallDelta < 0 && <TrendingDown size={17} className="text-red-500 mx-auto" />}
                  {overallDelta === 0 && <Minus size={17} className="text-muted-foreground mx-auto" />}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Color key */}
        <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-emerald-100" />
            Score improved
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-red-100" />
            Score declined
          </div>
        </div>
      </div>

      {/* ── Completed Tasks ── */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">Tasks Completed Since Last Assessment</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {data.completedTasks.length} task{data.completedTasks.length !== 1 ? 's' : ''} closed out between assessment cycles.
        </p>

        <div className="rounded-xl border bg-card divide-y">
          {data.completedTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                <CheckCircle2 size={14} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.recName}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <CalendarDays size={12} />
                {fmtDate(t.completedDate)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 mt-4">
          <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800 leading-relaxed">
            These tasks contributed to the score improvement between assessment cycles. Completing more roadmap tasks before the next cycle will improve the readiness score further.
          </p>
        </div>
      </div>

      {/* ── Readiness at Reassessment ── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-foreground">Readiness at Time of Reassessment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Task completion score recorded when this reassessment was triggered.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className={cn(
              'flex items-center justify-center rounded-full border-4 h-20 w-20 text-2xl font-extrabold',
              data.readinessPctAtReassessment >= 60
                ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                : data.readinessPctAtReassessment >= 30
                  ? 'border-amber-300 text-amber-700 bg-amber-50'
                  : 'border-slate-300 text-slate-700 bg-slate-50',
            )}>
              {data.readinessPctAtReassessment}%
            </div>
          </div>
        </div>
        <div className="mt-5 pt-5 border-t">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                data.readinessPctAtReassessment >= 60 ? 'bg-emerald-500' :
                data.readinessPctAtReassessment >= 30 ? 'bg-amber-400' : 'bg-blue-400',
              )}
              style={{ width: `${data.readinessPctAtReassessment}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {data.readinessPctAtReassessment < 30
              ? 'Low readiness — most improvement came from cultural and process changes rather than completed tasks.'
              : data.readinessPctAtReassessment < 60
                ? 'Moderate readiness — some tasks were completed before reassessment. Continue closing tasks to improve future cycles.'
                : 'High readiness — strong task completion before reassessment. Excellent execution.'}
          </p>
        </div>
      </div>

    </div>
  );
}
