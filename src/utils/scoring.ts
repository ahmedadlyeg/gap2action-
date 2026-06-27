import { getSubmissions, getTemplateSections, getFramework } from '@/services/store';
import type { AssessmentEvent, BuilderSection, BuilderQuestion } from '@/types';
import type { EventResultData, SectionResult, QuestionResult } from '@/services/resultsMockData';

// ─── Answer → score (0–100) ───────────────────────────────────────────────────

type AnswerValue = string | string[] | number | null | undefined;

export function scoreAnswer(q: BuilderQuestion, v: AnswerValue): number {
  if (v === null || v === undefined) return 0;

  switch (q.type) {
    case 'rating-scale': {
      const steps = q.ratingScores?.length ?? 5;
      return typeof v === 'number' ? Math.round((v / steps) * 100) : 0;
    }
    case 'yes-no':
      return v === 'yes' ? 100 : 0;
    case 'yes-no-partial':
      if (v === 'yes') return 100;
      if (v === 'partial') return 50;
      return 0;
    case 'percentage':
      return typeof v === 'number' ? Math.max(0, Math.min(100, v)) : 0;
    case 'frequency': {
      const map: Record<string, number> = { never: 0, rarely: 25, sometimes: 50, often: 75, always: 100 };
      return map[v as string] ?? 0;
    }
    case 'single-choice': {
      const opts = q.options ?? [];
      const idx = opts.findIndex(o => o.id === v);
      return idx >= 0 ? Math.round((idx / Math.max(opts.length - 1, 1)) * 100) : 0;
    }
    case 'multi-choice': {
      const sel = Array.isArray(v) ? v.length : 0;
      const total = (q.options ?? []).length;
      return total > 0 ? Math.round((sel / total) * 100) : 0;
    }
    case 'free-text':
      return -1; // sentinel: unscored
    default:
      return 0;
  }
}

/** Convert 0–100 score to a 0–5 display value */
export function toFiveScale(score: number): number {
  return Math.round((score / 100) * 5 * 10) / 10;
}

/** Map 0–100 score to maturity label using framework config or defaults */
export function getMaturityLabel(score: number, framework?: { maturityLevels: { level: number; label: string; minScore: number }[] }): string {
  const levels = framework?.maturityLevels;
  if (levels && levels.length > 0) {
    const match = [...levels].sort((a, b) => b.minScore - a.minScore).find(l => score >= l.minScore);
    return match?.label ?? levels[levels.length - 1].label;
  }
  if (score >= 90) return 'Optimizing';
  if (score >= 75) return 'Quantitatively Managed';
  if (score >= 55) return 'Defined';
  if (score >= 35) return 'Managed';
  return 'Initial';
}

export function getMaturityNum(label: string): number {
  const map: Record<string, number> = {
    'Initial': 1, 'Managed': 2, 'Defined': 3,
    'Quantitatively Managed': 4, 'Optimizing': 5,
  };
  return map[label] ?? 1;
}

// ─── Build full EventResultData from store submissions ────────────────────────

export function buildEventResults(event: AssessmentEvent): EventResultData | null {
  const sections: BuilderSection[] = getTemplateSections(event.templateId) ?? [];
  if (sections.length === 0) return null;

  const allSubmissions = getSubmissions().filter(
    s => s.eventId === event.id && (s.status === 'Submitted' || s.status === 'Validated'),
  );
  if (allSubmissions.length === 0) return null;

  const respondentIds = allSubmissions.map(s => s.userId);
  const framework = event.frameworkId ? getFramework(event.frameworkId) : undefined;
  const targetScorePct = 70; // fallback; ideally read from TemplateMeta

  // Section-level results
  let totalWeightedScore = 0;
  let totalWeight = 0;

  const sectionResults: SectionResult[] = sections.map(sec => {
    // scoredQs used below implicitly
    const weight = sec.weight ?? 1;

    const questionResults: QuestionResult[] = sec.questions.map(q => {
      const isScored = q.type !== 'free-text';
      const respondentScores: Record<string, number | null> = {};
      const respondentLabels: Record<string, string> = {};

      for (const sub of allSubmissions) {
        const raw = sub.answers[q.id] as AnswerValue;
        if (!isScored) {
          respondentScores[sub.userId] = null;
          respondentLabels[sub.userId] = raw ? 'Answered' : 'Not answered';
        } else {
          const pct = scoreAnswer(q, raw);
          const score5 = toFiveScale(pct);
          respondentScores[sub.userId] = score5;
          respondentLabels[sub.userId] = answerLabel(q, raw, score5);
        }
      }

      const scored = Object.values(respondentScores).filter(v => v !== null) as number[];
      const avg = scored.length > 0 ? Math.round((scored.reduce((s, n) => s + n, 0) / scored.length) * 10) / 10 : null;

      return {
        id: q.id,
        sectionId: sec.id,
        text: q.text,
        type: isScored ? 'scored' : 'text',
        maxScore: 5,
        respondentScores,
        respondentLabels,
        averageScore: avg,
      };
    });

    // Section score = avg of scored question averages
    const scoredResults = questionResults.filter(q => q.type === 'scored' && q.averageScore !== null);
    const sectionScore5 =
      scoredResults.length > 0
        ? Math.round((scoredResults.reduce((s, q) => s + (q.averageScore ?? 0), 0) / scoredResults.length) * 10) / 10
        : 0;

    const sectionTarget5 = toFiveScale(targetScorePct);

    totalWeightedScore += sectionScore5 * weight;
    totalWeight += weight;

    return {
      id: sec.id,
      name: sec.name,
      achievedScore: sectionScore5,
      targetScore: sectionTarget5,
      weightPct: weight,
      questions: questionResults,
    };
  });

  const overallScore5 = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 10) / 10
    : 0;
  const overallPct = Math.round((overallScore5 / 5) * 100);
  const targetScore5 = toFiveScale(targetScorePct);

  const matLabel = getMaturityLabel(overallPct, framework);
  const tgtLabel = getMaturityLabel(targetScorePct, framework);

  return {
    eventId: event.id,
    overallScore: overallScore5,
    targetScore: targetScore5,
    maturityLevelNum: getMaturityNum(matLabel),
    maturityLevelName: matLabel,
    targetLevelNum: getMaturityNum(tgtLabel),
    targetLevelName: tgtLabel,
    respondentIds,
    completedDate: event.endDate ?? new Date().toISOString(),
    sections: sectionResults,
  };
}

// ─── Helper: human-readable answer label ─────────────────────────────────────

function answerLabel(q: BuilderQuestion, v: AnswerValue, score5: number): string {
  if (v === null || v === undefined || v === '') return '—';
  switch (q.type) {
    case 'yes-no': return v === 'yes' ? 'Yes' : 'No';
    case 'yes-no-partial': return v === 'yes' ? 'Yes' : v === 'partial' ? 'Partial' : 'No';
    case 'percentage': return `${v}%`;
    case 'frequency': return String(v).charAt(0).toUpperCase() + String(v).slice(1);
    case 'rating-scale': return `${v} / ${q.ratingScores?.length ?? 5}`;
    case 'single-choice': {
      const opt = q.options?.find(o => o.id === v);
      return opt?.text ?? String(v);
    }
    case 'multi-choice': {
      const sel = Array.isArray(v) ? v.length : 0;
      return `${sel} of ${q.options?.length ?? 0} selected`;
    }
    default: return `${score5} / 5`;
  }
}

// ─── Aggregate: recompute event.score from all validated submissions ───────────

export function recomputeEventScore(event: AssessmentEvent): number | undefined {
  const sections = getTemplateSections(event.templateId) ?? [];
  if (sections.length === 0) return undefined;

  const subs = getSubmissions().filter(
    s => s.eventId === event.id && (s.status === 'Submitted' || s.status === 'Validated') && s.score !== undefined,
  );
  if (subs.length === 0) return undefined;

  const scores = subs.map(s => s.score as number);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
