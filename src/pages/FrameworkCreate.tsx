import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Scale, BarChart2, Layers, LayoutGrid, Eye, X,
  Plus, Trash2, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/context/ToastContext';
import { frameworksApi } from '@/services/api';
import type { QuestionType, ScoringMethod, MaturityLevelConfig } from '@/types';


// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_QUESTION_TYPES: { type: QuestionType; label: string; description: string }[] = [
  { type: 'rating-scale',    label: 'Rating Scale (1–5)',          description: 'Respondents pick a number from 1 to 5.' },
  { type: 'single-choice',   label: 'Single Choice',               description: 'Pick exactly one option from a list.' },
  { type: 'multi-choice',    label: 'Multi-Select',                 description: 'Tick all options that apply.' },
  { type: 'yes-no',          label: 'Yes / No',                    description: 'Binary answer — yes or no.' },
  { type: 'yes-no-partial',  label: 'Yes / No / Partially',        description: 'Three-way answer — yes, partially, or no.' },
  { type: 'free-text',       label: 'Free Text',                   description: 'Open-ended written response.' },
  { type: 'percentage',      label: 'Percentage Coverage (0–100%)', description: 'A numeric percentage slider.' },
  { type: 'frequency',       label: 'Frequency',                   description: 'How often something occurs.' },
];

// Level colours — cycles for >5 levels
const LEVEL_COLOR_CLASSES = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500',
  'bg-purple-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-cyan-500',
];

const DEFAULT_LEVEL_LABELS = ['Initial', 'Developing', 'Defined', 'Quantitatively Managed', 'Optimising'];

// ─── Score-range calculation ──────────────────────────────────────────────────
// Distributes the 0–5 scale evenly across N levels, rounded to 1 dp.
function computeRanges(n: number): { min: number; max: number }[] {
  const total = 5.0;
  const step = total / n;
  return Array.from({ length: n }, (_, i) => {
    const min = i === 0 ? 0 : Math.round((i * step) * 10) / 10;
    const max = i === n - 1 ? 5.0 : Math.round(((i + 1) * step - 0.1) * 10) / 10;
    return { min, max };
  });
}

function formatRange(min: number, max: number): string {
  return `${min.toFixed(1)}–${max.toFixed(1)}`;
}

function buildDefaultLevels(n: number): MaturityLevelConfig[] {
  const ranges = computeRanges(n);
  return ranges.map((r, i) => ({
    level: i + 1,
    label: DEFAULT_LEVEL_LABELS[i] ?? `Level ${i + 1}`,
    minScore: r.min,
    maxScore: r.max,
    description: '',
  }));
}

// ─── Question Preview Modal ───────────────────────────────────────────────────

function QuestionPreview({ type, onClose }: { type: QuestionType; onClose: () => void }) {
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingVal, setRatingVal] = useState(0);
  const [singleVal, setSingleVal] = useState('');
  const [multiVals, setMultiVals] = useState<string[]>([]);
  const [yesNo, setYesNo] = useState('');
  const [yesNoPartial, setYesNoPartial] = useState('');
  const [freeText, setFreeText] = useState('');
  const [pct, setPct] = useState(0);
  const [freq, setFreq] = useState('');

  const toggleMulti = (v: string) =>
    setMultiVals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const SAMPLE_OPTIONS = ['Fully implemented', 'Partially implemented', 'Planned', 'Not started'];
  const FREQ_OPTIONS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];

  const INFO: Record<QuestionType, { label: string; description: string }> = Object.fromEntries(
    ALL_QUESTION_TYPES.map(({ type: t, label, description }) => [t, { label, description }])
  ) as Record<QuestionType, { label: string; description: string }>;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Eye size={16} className="text-primary" />
            Question Preview — {INFO[type]?.label}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{INFO[type]?.description}</p>
        </DialogHeader>

        {/* Question card mock */}
        <div className="rounded-xl border bg-slate-50 p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Sample Question</p>
            <p className="text-sm font-semibold text-foreground leading-snug">
              {type === 'rating-scale'    && 'How would you rate the maturity of the current process?'}
              {type === 'single-choice'   && 'Which best describes your organisation\'s current adoption level?'}
              {type === 'multi-choice'    && 'Which of the following practices are currently in place?'}
              {type === 'yes-no'          && 'Does your organisation have a formal review process in place?'}
              {type === 'yes-no-partial'  && 'Has the governance policy been fully implemented across all departments?'}
              {type === 'free-text'       && 'Describe any significant gaps or challenges observed in this area.'}
              {type === 'percentage'      && 'What percentage of business units have adopted this framework?'}
              {type === 'frequency'       && 'How frequently does your team conduct architecture reviews?'}
            </p>
            <p className="text-xs text-slate-500 italic">
              Guidance: Consider the last 12 months of activity when answering.
            </p>
          </div>

          {/* ── Rating Scale ── */}
          {type === 'rating-scale' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setRatingHover(n)}
                    onMouseLeave={() => setRatingHover(0)}
                    onClick={() => setRatingVal(n)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border-2 text-sm font-bold transition-all ${
                      (ratingVal === n || (ratingHover >= n && ratingVal < n))
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-white text-slate-500 hover:border-primary/40'
                    }`}
                  >
                    <Star
                      size={16}
                      className={ratingHover >= n || ratingVal >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                    />
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 px-1">
                <span>Low maturity</span>
                <span>High maturity</span>
              </div>
              {ratingVal > 0 && (
                <p className="text-xs text-center text-primary font-medium">
                  Selected: {ratingVal} / 5
                </p>
              )}
            </div>
          )}

          {/* ── Single Choice ── */}
          {type === 'single-choice' && (
            <div className="space-y-2">
              {SAMPLE_OPTIONS.map(opt => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    singleVal === opt ? 'border-primary bg-primary/10' : 'border-border bg-white hover:border-primary/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="single-preview"
                    checked={singleVal === opt}
                    onChange={() => setSingleVal(opt)}
                    className="accent-[#0c93ac]"
                  />
                  <span className="text-sm text-foreground">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {/* ── Multi-Select ── */}
          {type === 'multi-choice' && (
            <div className="space-y-2">
              {SAMPLE_OPTIONS.map(opt => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    multiVals.includes(opt) ? 'border-primary bg-primary/10' : 'border-border bg-white hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={multiVals.includes(opt)}
                    onChange={() => toggleMulti(opt)}
                    className="accent-[#0c93ac]"
                  />
                  <span className="text-sm text-foreground">{opt}</span>
                </label>
              ))}
              {multiVals.length > 0 && (
                <p className="text-xs text-primary font-medium">{multiVals.length} selected</p>
              )}
            </div>
          )}

          {/* ── Yes / No ── */}
          {type === 'yes-no' && (
            <div className="flex gap-3">
              {['Yes', 'No'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setYesNo(opt)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    yesNo === opt
                      ? opt === 'Yes'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-border bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt === 'Yes' ? '✓ Yes' : '✗ No'}
                </button>
              ))}
            </div>
          )}

          {/* ── Yes / No / Partially ── */}
          {type === 'yes-no-partial' && (
            <div className="flex gap-2">
              {[
                { val: 'Yes',       label: '✓ Yes',       active: 'border-green-500 bg-green-50 text-green-700' },
                { val: 'Partially', label: '~ Partially',  active: 'border-amber-400 bg-amber-50 text-amber-700' },
                { val: 'No',        label: '✗ No',         active: 'border-red-400 bg-red-50 text-red-700' },
              ].map(({ val, label, active }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setYesNoPartial(val)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    yesNoPartial === val ? active : 'border-border bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── Free Text ── */}
          {type === 'free-text' && (
            <div className="space-y-1.5">
              <Textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Type your response here…"
                rows={4}
                className="bg-white resize-none"
              />
              <p className="text-xs text-slate-400 text-right">{freeText.length} characters</p>
            </div>
          )}

          {/* ── Percentage ── */}
          {type === 'percentage' && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={e => setPct(Number(e.target.value))}
                  className="flex-1 accent-[#0c93ac]"
                />
                <div className={`flex h-12 w-16 items-center justify-center rounded-lg border-2 font-bold text-lg shrink-0 ${
                  pct < 33 ? 'border-red-300 bg-red-50 text-red-700'
                  : pct < 66 ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-green-300 bg-green-50 text-green-700'
                }`}>
                  {pct}%
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 px-1">
                <span>0% — None</span>
                <span>50% — Half</span>
                <span>100% — All</span>
              </div>
            </div>
          )}

          {/* ── Frequency ── */}
          {type === 'frequency' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {FREQ_OPTIONS.map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFreq(opt)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 transition-all text-xs font-medium ${
                      freq === opt
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-white text-slate-500 hover:border-primary/40'
                    }`}
                  >
                    <span className="text-base">{['🚫','🔹','🔸','🔶','✅'][i]}</span>
                    {opt}
                  </button>
                ))}
              </div>
              {freq && (
                <p className="text-xs text-center text-primary font-medium">Selected: {freq}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X size={13} className="mr-1.5" /> Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FrameworkCreate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isNew = !id || id === 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [allowedTypes, setAllowedTypes] = useState<Set<QuestionType>>(
    new Set(ALL_QUESTION_TYPES.map(x => x.type))
  );
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>('weighted_section');
  const [levels, setLevels] = useState<MaturityLevelConfig[]>(buildDefaultLevels(5));
  const [previewType, setPreviewType] = useState<QuestionType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isNew && id) {
      frameworksApi.get(id).then(fw => {
        if (fw) {
          setName(fw.name);
          setDescription(fw.description);
          setStatus(fw.status);
          setAllowedTypes(new Set(fw.allowedQuestionTypes as QuestionType[]));
          setScoringMethod(fw.scoringMethod as ScoringMethod);
          setLevels(fw.maturityLevels.map(l => ({
            level: l.level,
            label: l.label,
            description: l.description,
            minScore: l.minScore,
            maxScore: l.maxScore,
          })));
        }
      }).catch(() => {});
    }
  }, [id, isNew]);

  // ── Question types ──────────────────────────────────────────────────────────

  const toggleType = (type: QuestionType) => {
    setAllowedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  // ── Dynamic maturity levels ─────────────────────────────────────────────────

  const addLevel = () => {
    const n = levels.length + 1;
    const ranges = computeRanges(n);
    setLevels(prev =>
      prev.map((l, i) => ({ ...l, minScore: ranges[i].min, maxScore: ranges[i].max }))
        .concat({
          level: n,
          label: DEFAULT_LEVEL_LABELS[n - 1] ?? `Level ${n}`,
          minScore: ranges[n - 1].min,
          maxScore: ranges[n - 1].max,
          description: '',
        })
    );
  };

  const removeLevel = (index: number) => {
    const n = levels.length - 1;
    if (n < 2) return; // minimum 2 levels
    const ranges = computeRanges(n);
    setLevels(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((l, i) => ({ ...l, level: i + 1, minScore: ranges[i].min, maxScore: ranges[i].max }))
    );
  };

  const patchLevel = (index: number, patch: Partial<MaturityLevelConfig>) => {
    setLevels(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l));
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Framework name is required.');
    if (allowedTypes.size === 0) errs.push('At least one question type must be selected.');
    levels.forEach((l, i) => {
      if (!l.label.trim()) errs.push(`Level ${i + 1} label is required.`);
    });
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async (overrideStatus?: 'Draft' | 'Active') => {
    if (!validate()) return;
    const finalStatus = overrideStatus ?? status;
    const payload = {
      name: name.trim(),
      description: description.trim(),
      allowedQuestionTypes: ALL_QUESTION_TYPES.map(x => x.type).filter(t => allowedTypes.has(t)),
      scoringMethod,
      maturityLevels: levels,
      status: finalStatus,
    };
    try {
      if (isNew) {
        await frameworksApi.create(payload as Parameters<typeof frameworksApi.create>[0]);
      } else {
        await frameworksApi.update(id!, payload as Parameters<typeof frameworksApi.update>[1]);
      }
      toast({ title: 'Framework saved successfully.', variant: 'success' });
      navigate('/admin/frameworks');
    } catch {
      toast({ title: 'Failed to save framework. Please try again.', variant: 'error' });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b bg-background px-8 py-5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 shrink-0">
            <LayoutGrid size={17} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {isNew ? 'New Assessment Framework' : 'Edit Framework'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? 'Define scoring method, allowed question types, and maturity levels.'
                : `Editing: ${name}`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-700">{e}</p>
            ))}
          </div>
        )}

        {/* SECTION 1 — Basic Info */}
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground border-b pb-3">Basic Information</h2>

          <div className="space-y-1.5">
            <Label htmlFor="fw-name">Framework Name <span className="text-destructive">*</span></Label>
            <Input
              id="fw-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. EA Maturity Framework"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fw-desc">Description</Label>
            <Textarea
              id="fw-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this framework assesses and when to use it…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fw-status">Status</Label>
            <Select
              id="fw-status"
              value={status}
              onChange={e => setStatus(e.target.value as 'Draft' | 'Active' | 'Archived')}
            >
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </Select>
          </div>
        </div>

        {/* SECTION 2 — Allowed Question Types */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Allowed Question Types
              <span className="ml-2 text-xs font-normal text-muted-foreground">Select at least one</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click the <Eye size={11} className="inline mb-0.5" /> icon next to any type to preview how it appears to respondents.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_QUESTION_TYPES.map(({ type, label }) => (
              <div
                key={type}
                className={`flex items-center gap-2 rounded-lg border transition-colors ${
                  allowedTypes.has(type) ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <label className="flex flex-1 items-center gap-2.5 px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedTypes.has(type)}
                    onChange={() => toggleType(type)}
                    className="h-3.5 w-3.5 rounded border-input accent-primary shrink-0"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewType(type)}
                  title={`Preview ${label}`}
                  className="shrink-0 mr-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                >
                  <Eye size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3 — Scoring Method */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b pb-3">Scoring Method</h2>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setScoringMethod('weighted_section')}
              className={`w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                scoringMethod === 'weighted_section' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <Scale size={20} className={scoringMethod === 'weighted_section' ? 'text-primary mt-0.5 shrink-0' : 'text-muted-foreground mt-0.5 shrink-0'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Weighted Section Average</p>
                  <Badge variant="success" className="text-[10px]">Recommended</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each section has a percentage weight. The final score is a weighted average across all sections.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScoringMethod('simple_average')}
              className={`w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                scoringMethod === 'simple_average' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <BarChart2 size={20} className={scoringMethod === 'simple_average' ? 'text-primary mt-0.5 shrink-0' : 'text-muted-foreground mt-0.5 shrink-0'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Simple Average</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All scored questions contribute equally regardless of section. The final score is a mean across all responses.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScoringMethod('categorical_weight')}
              className={`w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                scoringMethod === 'categorical_weight' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <Layers size={20} className={scoringMethod === 'categorical_weight' ? 'text-primary mt-0.5 shrink-0' : 'text-muted-foreground mt-0.5 shrink-0'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Categorical Weight</p>
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">Coming soon</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Questions are marked Low / Medium / High / Critical and contribute to a weighted category score.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* SECTION 4 — Maturity Levels */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="border-b pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Maturity Levels
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {levels.length} level{levels.length !== 1 ? 's' : ''} · All labels required
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Score boundaries are auto-distributed across the 0–5 scale when you add or remove levels.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLevel}
              className="shrink-0 text-xs"
            >
              <Plus size={12} className="mr-1" /> Add Level
            </Button>
          </div>

          <div className="space-y-2">
            {levels.map((level, i) => (
              <div key={i} className="flex items-center gap-3">
                {/* Colored circle */}
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${LEVEL_COLOR_CLASSES[i % LEVEL_COLOR_CLASSES.length]}`}>
                  {level.level}
                </div>
                {/* Label */}
                <Input
                  value={level.label}
                  onChange={e => patchLevel(i, { label: e.target.value })}
                  placeholder={`Level ${level.level} label`}
                  className="w-44 shrink-0"
                />
                {/* Description */}
                <Input
                  value={level.description}
                  onChange={e => patchLevel(i, { description: e.target.value })}
                  placeholder={`Description for level ${level.level}…`}
                  className="flex-1"
                />
                {/* Score range badge */}
                <span className="shrink-0 text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 font-mono whitespace-nowrap">
                  {formatRange(level.minScore, level.maxScore)}
                </span>
                {/* Remove button — hidden when only 2 levels remain */}
                <button
                  type="button"
                  onClick={() => removeLevel(i)}
                  disabled={levels.length <= 2}
                  title={levels.length <= 2 ? 'Minimum 2 levels required' : `Remove level ${level.level}`}
                  className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    levels.length <= 2
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate('/admin/frameworks')}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave('Draft')}>Save as Draft</Button>
          <Button onClick={() => handleSave('Active')}>Save &amp; Activate</Button>
        </div>
      </div>

      {/* Question Preview Modal */}
      {previewType && (
        <QuestionPreview type={previewType} onClose={() => setPreviewType(null)} />
      )}
    </div>
  );
}
