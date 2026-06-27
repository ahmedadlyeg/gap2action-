import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildEventResults } from '@/utils/scoring';
import type { SectionResult } from '@/services/resultsMockData';
import type { AssessmentEvent } from '@/types';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gapPillCls(gap: number): string {
  const abs = Math.abs(gap);
  if (abs >= 1.2) return 'bg-red-100 text-red-700 border-red-200';
  if (abs >= 0.6) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function scoreBarCls(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.85) return 'bg-emerald-500';
  if (pct >= 0.65) return 'bg-amber-400';
  return 'bg-orange-500';
}

function levelLabel(score: number): string {
  if (score < 1.5) return 'Level 1 — Initial';
  if (score < 2.5) return 'Level 2 — Managed';
  if (score < 3.5) return 'Level 3 — Defined';
  if (score < 4.5) return 'Level 4 — Quantitatively Managed';
  return 'Level 5 — Optimizing';
}

// ─── Gap Card ─────────────────────────────────────────────────────────────────

function GapCard({
  section,
  targetScore,
  gap,
  maxScore,
  onViewRecommendations,
}: {
  section: SectionResult;
  targetScore: number;
  gap: number;
  maxScore: number;
  onViewRecommendations?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const scoredQuestions = section.questions.filter(q => q.type === 'scored' && q.averageScore !== null);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <AlertTriangle size={15} className="text-orange-500 shrink-0" />
              <h3 className="font-semibold text-foreground text-sm">{section.name}</h3>
            </div>

            {/* Score row */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="text-foreground">
                Achieved: <strong>{section.achievedScore.toFixed(1)}</strong>
              </span>
              <span className="text-muted-foreground">
                Target: <strong>{targetScore.toFixed(1)}</strong>
              </span>
              <Badge
                variant="outline"
                className={cn('text-xs font-semibold border px-2 py-0.5', gapPillCls(gap))}
              >
                Gap: {gap.toFixed(1)}
              </Badge>
            </div>

            {/* Level context */}
            <p className="text-xs text-muted-foreground mt-2">
              Currently at {levelLabel(section.achievedScore)} — target is {levelLabel(targetScore)}
            </p>
          </div>

          {/* Bar mini-chart */}
          <div className="shrink-0 w-28">
            <div className="relative h-3 rounded-full bg-muted overflow-visible">
              <div
                className={cn('h-full rounded-full', scoreBarCls(section.achievedScore, maxScore))}
                style={{ width: `${(section.achievedScore / maxScore) * 100}%` }}
              />
              <div
                className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-foreground/40 z-10"
                style={{ left: `${(targetScore / maxScore) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>0</span>
              <span>{maxScore}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 pl-0 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {expanded ? 'Hide' : 'Show'} question drivers
          </Button>
          {onViewRecommendations && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 ml-auto"
              onClick={onViewRecommendations}
            >
              View Recommendation <ArrowRight size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded question drivers */}
      {expanded && scoredQuestions.length > 0 && (
        <div className="border-t bg-muted/20">
          <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Question-level drivers
          </div>
          <div className="divide-y">
            {scoredQuestions.map(q => {
              const avg = q.averageScore as number;
              const belowTarget = avg < targetScore;
              return (
                <div key={q.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {q.text}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', scoreBarCls(avg, q.maxScore))}
                        style={{ width: `${(avg / q.maxScore) * 100}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-xs font-semibold w-10 text-right',
                      belowTarget ? 'text-orange-600' : 'text-emerald-600',
                    )}>
                      {avg.toFixed(1)} / {q.maxScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── On-Target Card ───────────────────────────────────────────────────────────

function OnTargetCard({ section, surplus, maxScore }: {
  section: SectionResult;
  surplus: number;
  maxScore: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4">
      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{section.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Score {section.achievedScore.toFixed(1)} / {section.targetScore.toFixed(1)} target
          &nbsp;·&nbsp;{levelLabel(section.achievedScore)}
        </p>
      </div>
      <div className="shrink-0 w-24">
        <div className="relative h-2 rounded-full bg-muted overflow-visible">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${(section.achievedScore / maxScore) * 100}%` }}
          />
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-foreground/40"
            style={{ left: `${(section.targetScore / maxScore) * 100}%` }}
          />
        </div>
      </div>
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs shrink-0">
        +{surplus.toFixed(1)} above
      </Badge>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GapsTabProps {
  event: AssessmentEvent;
  onViewRecommendations?: () => void;
}

export function GapsTab({ event, onViewRecommendations }: GapsTabProps) {
  const [onTargetOpen, setOnTargetOpen] = useState(false);
  const data = buildEventResults(event);
  const MAX_SCORE = 5;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <AlertTriangle size={24} className="text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1">Gap analysis not available</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Gap analysis will be generated once all submissions are validated and the event is closed.
        </p>
      </div>
    );
  }

  // Partition sections
  const gapSections = data.sections
    .filter(s => s.achievedScore < s.targetScore)
    .sort((a, b) => (a.achievedScore - a.targetScore) - (b.achievedScore - b.targetScore)); // most negative first

  const onTargetSections = data.sections.filter(s => s.achievedScore >= s.targetScore);

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">

      {/* Intro */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Gap Analysis</h2>
        <p className="text-sm text-muted-foreground">
          {gapSections.length > 0
            ? `${gapSections.length} section${gapSections.length > 1 ? 's' : ''} scored below the target score. Sections are sorted by gap magnitude — largest first.`
            : 'All sections are at or above their target scores. No gaps identified.'}
        </p>
      </div>

      {/* Gap cards */}
      {gapSections.length > 0 && (
        <div className="space-y-4">
          {gapSections.map(section => (
            <GapCard
              key={section.id}
              section={section}
              targetScore={section.targetScore}
              gap={section.achievedScore - section.targetScore}
              maxScore={MAX_SCORE}
              onViewRecommendations={onViewRecommendations}
            />
          ))}
        </div>
      )}

      {/* On-target sections (collapsible) */}
      {onTargetSections.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOnTargetOpen(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {onTargetOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            On Target ({onTargetSections.length} section{onTargetSections.length > 1 ? 's' : ''})
          </button>

          {onTargetOpen && (
            <div className="space-y-2">
              {onTargetSections.map(section => (
                <OnTargetCard
                  key={section.id}
                  section={section}
                  surplus={section.achievedScore - section.targetScore}
                  maxScore={MAX_SCORE}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
