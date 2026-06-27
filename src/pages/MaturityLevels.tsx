import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ChevronLeft } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
  Legend,
} from 'recharts';
import { useMaturityData } from '@/hooks/useMaturityData';
import { getMaturityMeta, formatScore } from '@/utils/maturityUtils';
import type { MaturityMeta } from '@/utils/maturityUtils';
import type { TemplateMaturity, CategoryMaturity } from '@/hooks/useMaturityData';

// ── MaturityBadge ─────────────────────────────────────────────────────────────

interface MaturityBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

function MaturityBadge({ score, size = 'md' }: MaturityBadgeProps) {
  const meta = getMaturityMeta(score);
  const sizeClass =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : size === 'lg'
      ? 'text-base px-4 py-1.5'
      : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClass} ${meta.color} ${meta.bg} ${meta.border}`}
    >
      L{meta.level} · {meta.label}
    </span>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

interface ScoreBarProps {
  current: number | null;
  target: number | null;
  height?: number;
}

function ScoreBar({ current, target, height = 8 }: ScoreBarProps) {
  const meta = getMaturityMeta(current);
  const currentPct = current != null ? (current / 5) * 100 : 0;
  const targetPct = target != null ? (target / 5) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1 bg-slate-100 rounded-full" style={{ height }}>
        {target != null && (
          <>
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-400 z-10"
              style={{ left: `${targetPct}%` }}
            />
            <span
              className="absolute text-[9px] text-slate-500 font-bold"
              style={{ left: `${targetPct}%`, top: -(height + 4), transform: 'translateX(-50%)' }}
            >
              T
            </span>
          </>
        )}
        {current != null && (
          <div
            className="h-full rounded-full"
            style={{ width: `${currentPct}%`, background: meta.progressColor }}
          />
        )}
      </div>
      <span className="text-xs text-slate-500 shrink-0 ml-1">
        {formatScore(current)} / 5.0
      </span>
    </div>
  );
}

// ── DonutGauge ────────────────────────────────────────────────────────────────
// Pure SVG donut: outer thin ring = target, inner thick ring = current score.

function DonutGauge({
  score,
  target,
  size = 130,
}: {
  score: number | null;
  target: number | null;
  size?: number;
}) {
  const meta = getMaturityMeta(score);
  const cx = size / 2;
  const cy = size / 2;

  const targetSW = Math.max(4, size * 0.033);
  const scoreSW  = Math.max(10, size * 0.105);
  const gap = 4;
  const outerR = cx - targetSW / 2 - 3;
  const innerR = outerR - targetSW / 2 - gap - scoreSW / 2;

  const arc = (r: number, pct: number) => {
    const c = 2 * Math.PI * r;
    const filled = Math.max(0, pct * c - 1.5);
    return `${filled} ${c}`;
  };

  const scorePct  = score  != null ? Math.min(score  / 5, 1) : 0;
  const targetPct = target != null ? Math.min(target / 5, 1) : 0;

  const fontSz = size * 0.185;
  const subSz  = size * 0.1;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {/* Background tracks */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#F1F5F9" strokeWidth={targetSW} />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#F1F5F9" strokeWidth={scoreSW} />

      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {/* Target arc — outer thin ring */}
        {target != null && targetPct > 0 && (
          <circle
            cx={cx} cy={cy} r={outerR} fill="none"
            stroke="#CBD5E1" strokeWidth={targetSW}
            strokeDasharray={arc(outerR, targetPct)}
            strokeLinecap="round"
          />
        )}
        {/* Score arc — inner thick ring */}
        {score != null && scorePct > 0 && (
          <circle
            cx={cx} cy={cy} r={innerR} fill="none"
            stroke={meta.progressColor} strokeWidth={scoreSW}
            strokeDasharray={arc(innerR, scorePct)}
            strokeLinecap="round"
          />
        )}
      </g>

      {/* Centre score */}
      <text
        x={cx} y={cy - subSz * 0.5}
        textAnchor="middle" dominantBaseline="auto"
        fontSize={fontSz} fontWeight="800"
        fill={score != null ? meta.progressColor : '#CBD5E1'}
      >
        {score != null ? score.toFixed(1) : '—'}
      </text>
      <text
        x={cx} y={cy + fontSz * 0.55}
        textAnchor="middle" dominantBaseline="auto"
        fontSize={subSz} fill="#94A3B8"
      >
        / 5.0
      </text>
    </svg>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  drillLevel: number;
  categoryName?: string;
  templateName?: string;
  onOrgClick: () => void;
  onCategoryClick: () => void;
}

function Breadcrumb({ drillLevel, categoryName, templateName, onOrgClick, onCategoryClick }: BreadcrumbProps) {
  if (drillLevel === 0) return null;
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 flex-wrap">
      <button onClick={onOrgClick} className="hover:text-primary font-medium">
        Maturity Levels
      </button>
      {drillLevel >= 1 && categoryName && (
        <>
          <span>/</span>
          {drillLevel === 1 ? (
            <span className="text-slate-700 font-semibold">{categoryName}</span>
          ) : (
            <button onClick={onCategoryClick} className="hover:text-primary font-medium">
              {categoryName}
            </button>
          )}
        </>
      )}
      {drillLevel === 2 && templateName && (
        <>
          <span>/</span>
          <span className="text-slate-700 font-semibold">{templateName}</span>
        </>
      )}
    </nav>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MaturityLevels() {
  const [drillLevel, setDrillLevel] = useState<0 | 1 | 2>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  const data = useMaturityData();

  const animateDrill = (fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 150);
  };

  const goToOrg = () =>
    animateDrill(() => {
      setDrillLevel(0);
      setSelectedCategoryId(null);
      setSelectedTemplateId(null);
    });

  const goToCategory = (catId: string) =>
    animateDrill(() => {
      setDrillLevel(1);
      setSelectedCategoryId(catId);
      setSelectedTemplateId(null);
    });

  const goToTemplate = (tplId: string) =>
    animateDrill(() => {
      setDrillLevel(2);
      setSelectedTemplateId(tplId);
    });

  const selectedCategory = data.categories.find(c => c.categoryId === selectedCategoryId) ?? null;
  const selectedTemplate =
    selectedCategory?.templates.find(t => t.templateId === selectedTemplateId) ?? null;

  const transitionClass = visible
    ? 'opacity-100 translate-y-0 transition-all duration-200'
    : 'opacity-0 translate-y-2 transition-all duration-150';

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Breadcrumb
          drillLevel={drillLevel}
          categoryName={selectedCategory?.categoryName}
          templateName={selectedTemplate?.templateName}
          onOrgClick={goToOrg}
          onCategoryClick={() => selectedCategoryId && goToCategory(selectedCategoryId)}
        />

        <div className={transitionClass}>
          {drillLevel === 0 && (
            <Level0 data={data} onCategoryClick={catId => goToCategory(catId)} />
          )}
          {drillLevel === 1 && selectedCategory && (
            <Level1
              category={selectedCategory}
              onBack={goToOrg}
              onTemplateClick={tplId => goToTemplate(tplId)}
            />
          )}
          {drillLevel === 2 && selectedTemplate && selectedCategory && (
            <Level2
              template={selectedTemplate}
              category={selectedCategory}
              onBack={() => goToCategory(selectedCategoryId!)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── LEVEL 0 ───────────────────────────────────────────────────────────────────

interface Level0Props {
  data: ReturnType<typeof useMaturityData>;
  onCategoryClick: (catId: string) => void;
}

function Level0({ data, onCategoryClick }: Level0Props) {
  const assessedCats = data.categories.filter(c => c.assessedCount > 0);
  const useRadar = assessedCats.length >= 3;

  const radarData = assessedCats.map(c => ({
    subject: c.categoryName.length > 18 ? c.categoryName.slice(0, 16) + '…' : c.categoryName,
    current: c.avgScore ?? 0,
    target: c.avgTarget ?? 0,
  }));

  const assessedPct =
    data.totalTemplates > 0
      ? Math.round((data.assessedTemplates / data.totalTemplates) * 100)
      : 0;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800">Maturity Levels</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Organisation-wide maturity snapshot across all assessment categories.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Overall Maturity</p>
          <p className="text-3xl font-extrabold text-slate-800 mb-1">{formatScore(data.avgScore)}</p>
          <MaturityBadge score={data.avgScore} size="sm" />
          {data.avgTarget != null && (
            <p className="text-xs text-slate-400 mt-1">Target {formatScore(data.avgTarget)}</p>
          )}
        </KpiCard>

        <KpiCard>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Templates Assessed</p>
          <p className="text-3xl font-extrabold text-slate-800 mb-1">
            {data.assessedTemplates}
            <span className="text-lg text-slate-400">/{data.totalTemplates}</span>
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${assessedPct}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{assessedPct}% coverage</p>
        </KpiCard>

        <KpiCard>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Above Target</p>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-green-500" size={28} />
            <p className="text-3xl font-extrabold text-green-600">{data.aboveTarget}</p>
          </div>
          <p className="text-xs text-slate-400 mt-1">templates at or above target</p>
        </KpiCard>

        <KpiCard>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Below Target</p>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-400" size={28} />
            <p className="text-3xl font-extrabold text-red-500">{data.belowTarget}</p>
          </div>
          <p className="text-xs text-slate-400 mt-1">templates needing improvement</p>
        </KpiCard>
      </div>

      {/* Radar or donut fallback */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">
          {useRadar ? 'Category Radar' : 'Category Overview'}
        </h2>
        {useRadar ? (
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#F1F5F9" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Radar name="Current" dataKey="current" stroke="#2563EB" fill="#2563EB" fillOpacity={0.18} dot={false} />
              <Radar name="Target" dataKey="target" stroke="#CBD5E1" fill="transparent" strokeDasharray="4 2" dot={false} />
              <Tooltip formatter={((v: number) => v.toFixed(1)) as never} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          /* Donut fallback for < 3 assessed categories */
          <div className="flex flex-wrap justify-center gap-8 py-4">
            {assessedCats.length === 0 ? (
              <p className="text-sm text-slate-400 py-8">No assessments completed yet.</p>
            ) : (
              assessedCats.map(cat => (
                <button
                  key={cat.categoryId}
                  onClick={() => onCategoryClick(cat.categoryId)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <DonutGauge score={cat.avgScore} target={cat.avgTarget} size={140} />
                  <p className="text-xs font-semibold text-slate-700 text-center max-w-[120px]">
                    {cat.categoryName}
                  </p>
                  <MaturityBadge score={cat.avgScore} size="sm" />
                  <p className="text-[10px] text-primary group-hover:underline">View Details →</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.categories.map(cat => (
          <button
            key={cat.categoryId}
            onClick={() => onCategoryClick(cat.categoryId)}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 text-left hover:shadow-md hover:border-slate-200 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ background: cat.categoryColor }} />
                <span className="font-bold text-slate-700 text-sm truncate">{cat.categoryName}</span>
              </div>
              <MaturityBadge score={cat.avgScore} size="sm" />
            </div>

            {/* Donut + stats row */}
            <div className="flex items-center gap-4 mb-3">
              <DonutGauge score={cat.avgScore} target={cat.avgTarget} size={90} />
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-extrabold text-slate-800">
                  {formatScore(cat.avgScore)}
                  <span className="text-sm font-normal text-slate-400 ml-1">/ 5.0</span>
                </p>
                <p className="text-xs text-slate-400">{cat.assessedCount}/{cat.totalCount} assessed</p>
                {cat.avgTarget != null && (
                  <p className="text-xs text-slate-400 mt-0.5">Target {formatScore(cat.avgTarget)}</p>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-0.5 mb-3">
              {cat.templates.slice(0, 3).map(t => (
                <p key={t.templateId} className="truncate flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: getMaturityMeta(t.currentScore).progressColor }}
                  />
                  {t.templateName}
                </p>
              ))}
              {cat.templates.length > 3 && (
                <p className="text-slate-300">+ {cat.templates.length - 3} more</p>
              )}
            </div>

            <p className="text-xs font-semibold text-primary group-hover:underline">View Details →</p>
          </button>
        ))}
      </div>
    </>
  );
}

// ── LEVEL 1 ───────────────────────────────────────────────────────────────────

interface Level1Props {
  category: CategoryMaturity;
  onBack: () => void;
  onTemplateClick: (tplId: string) => void;
}

function Level1({ category, onBack, onTemplateClick }: Level1Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={onBack} className="mt-1 text-slate-400 hover:text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">{category.categoryName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <MaturityBadge score={category.avgScore} size="lg" />
            <span className="text-slate-400 text-sm">
              avg {formatScore(category.avgScore)} / 5.0 · {category.assessedCount}/{category.totalCount} assessed
            </span>
          </div>
        </div>
      </div>

      {/* Donut grid — replaces grouped bar chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-5">
          Template Comparison
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {category.templates.map(t => (
            <button
              key={t.templateId}
              onClick={() => onTemplateClick(t.templateId)}
              className="flex flex-col items-center p-4 rounded-2xl border border-slate-100 hover:border-primary/30 hover:shadow-md transition-all group"
            >
              <DonutGauge score={t.currentScore} target={t.targetScore} size={120} />
              <p className="text-xs font-semibold text-slate-700 mt-2 text-center leading-snug line-clamp-2">
                {t.templateName}
              </p>
              <div className="mt-2">
                <MaturityBadge score={t.currentScore} size="sm" />
              </div>
              {t.targetScore != null && (
                <p className="text-[10px] text-slate-400 mt-1">Target {formatScore(t.targetScore)}</p>
              )}
              <p className="text-[10px] text-primary mt-1.5 group-hover:underline">Drill Down →</p>
            </button>
          ))}
        </div>
      </div>

      {/* Template table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 font-semibold uppercase tracking-wide">
              <th className="text-left px-5 py-3">Template</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Current</th>
              <th className="text-right px-4 py-3">Target</th>
              <th className="text-right px-4 py-3">Gap</th>
              <th className="text-left px-4 py-3">Last Assessed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {category.templates.map(t => {
              const gap =
                t.currentScore != null && t.targetScore != null
                  ? t.targetScore - t.currentScore
                  : null;
              return (
                <tr
                  key={t.templateId}
                  onClick={() => onTemplateClick(t.templateId)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3 font-semibold text-slate-700">{t.templateName}</td>
                  <td className="px-4 py-3"><MaturityBadge score={t.currentScore} size="sm" /></td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{formatScore(t.currentScore)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatScore(t.targetScore)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {gap === null ? (
                      <span className="text-slate-300">—</span>
                    ) : gap > 0 ? (
                      <span className="text-red-500">+{gap.toFixed(1)}</span>
                    ) : (
                      <span className="text-green-600">✓ {Math.abs(gap).toFixed(1)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.completedDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); onTemplateClick(t.templateId); }}
                      className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                    >
                      Drill Down →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── LEVEL 2 ───────────────────────────────────────────────────────────────────

interface Level2Props {
  template: TemplateMaturity;
  category: CategoryMaturity;
  onBack: () => void;
}

function Level2({ template, category, onBack }: Level2Props) {
  const meta: MaturityMeta = template.maturityMeta;
  const history = [...template.history].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={onBack} className="mt-1 text-slate-400 hover:text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-800 truncate">{template.templateName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: category.categoryColor + '22',
                color: category.categoryColor,
                border: `1px solid ${category.categoryColor}44`,
              }}
            >
              {category.categoryName}
            </span>
            <MaturityBadge score={template.currentScore} size="lg" />
            <span className="text-slate-400 text-sm">
              {formatScore(template.currentScore)} / 5.0
              {template.targetScore != null && ` · target ${formatScore(template.targetScore)}`}
              {template.completedDate && ` · ${template.completedDate}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className={`rounded-2xl border p-5 flex items-center gap-5 ${meta.bg} ${meta.border}`}>
          <DonutGauge score={template.currentScore} target={template.targetScore} size={100} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Current Maturity</p>
            <p className={`text-4xl font-extrabold ${meta.color}`}>{formatScore(template.currentScore)}</p>
            <p className={`text-sm font-semibold mt-1 ${meta.color}`}>L{meta.level} — {meta.label}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center gap-5">
          <DonutGauge score={template.targetScore} target={template.targetScore} size={100} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Target Maturity</p>
            <p className="text-4xl font-extrabold text-slate-700">{formatScore(template.targetScore)}</p>
            <p className="text-sm font-semibold mt-1 text-slate-500">
              {template.targetScore != null
                ? (() => { const tm = getMaturityMeta(template.targetScore); return `L${tm.level} — ${tm.label}`; })()
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Full-width score bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Overall Score</p>
        <ScoreBar current={template.currentScore} target={template.targetScore} height={12} />
      </div>

      {/* Section breakdown — donut grid replaces horizontal bar chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-5">Section Breakdown</h2>
        {template.sections.length === 0 ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm p-4">
            Section breakdown not available yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {template.sections.map(s => (
              <div
                key={s.id}
                className="flex flex-col items-center p-4 rounded-2xl border border-slate-100 bg-slate-50/50"
              >
                <DonutGauge score={s.achievedScore} target={s.targetScore} size={110} />
                <p className="text-xs font-semibold text-slate-700 mt-2 text-center leading-snug">
                  {s.name}
                </p>
                <div className="mt-2">
                  <MaturityBadge score={s.achievedScore} size="sm" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Target {s.targetScore.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Assessment History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No completed assessments yet.</p>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-0 bottom-0 border-l-2 border-slate-200" />
            <div className="space-y-6">
              {history.map((h, i) => {
                const hMeta = getMaturityMeta(h.score);
                const isLast = i === history.length - 1;
                return (
                  <div key={h.eventId} className="relative">
                    <div
                      className="absolute -left-[25px] flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-extrabold"
                      style={{ background: hMeta.progressColor }}
                    >
                      {hMeta.level}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">{h.date}</span>
                        <MaturityBadge score={h.score} size="sm" />
                        {isLast && (
                          <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-semibold">
                            Latest
                          </span>
                        )}
                      </div>
                      <ScoreBar current={h.score} target={template.targetScore} height={6} />
                      <Link
                        to={`/events/${h.eventId}/results`}
                        className="text-xs font-semibold text-primary hover:underline w-fit"
                      >
                        View Results →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
