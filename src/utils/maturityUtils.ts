export interface MaturityMeta {
  level: number;
  label: string;
  color: string;
  bg: string;
  border: string;
  progressColor: string;
}

export function getMaturityMeta(score: number | null): MaturityMeta {
  if (score === null) {
    return { level: 0, label: 'Not Assessed', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', progressColor: '#94A3B8' };
  }
  if (score < 2.0) {
    return { level: 1, label: 'Initial', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', progressColor: '#EF4444' };
  }
  if (score < 3.0) {
    return { level: 2, label: 'Developing', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', progressColor: '#F97316' };
  }
  if (score < 3.5) {
    return { level: 3, label: 'Defined', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', progressColor: '#CA8A04' };
  }
  if (score < 4.5) {
    return { level: 4, label: 'Managed', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', progressColor: '#2563EB' };
  }
  return { level: 5, label: 'Optimised', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', progressColor: '#16A34A' };
}

export function formatScore(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(1);
}
