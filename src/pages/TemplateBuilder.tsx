import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDirtyState, registerDirtyGuard, unregisterDirtyGuard } from '@/context/DirtyStateContext';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  Save, Zap, ArrowLeft, BarChart2, Info, X, Check, Lock, Eye, GitBranch,
  Upload, Download, AlertCircle, AlertTriangle, Camera, ImageIcon, LayoutTemplate, LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import { getTemplateSections, saveTemplateSections, updateEvent as _updateEvent, getTemplateMeta, saveTemplateMeta, cloneTemplate, getTemplates, getVersionFamily, saveTemplate, getTemplate, updateTemplate, getFramework } from '@/services/store';
import { templatesApi, frameworksApi, type ApiTemplate, type ApiSection } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { TemplateStatus, QuestionType, AnswerOption, BuilderQuestion, BuilderSection, Template } from '@/types';
import { parseTemplateCSV, exportSectionsToCSV, generateCsvTemplate, type CsvImportResult } from '@/utils/csvImport';

interface MaturityRow {
  id: string;
  level: number;
  name: string;
  scoreFrom: number;
  scoreTo: number;
  description: string;
}

type Selection =
  | { kind: 'scoring' }
  | { kind: 'cover' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'question'; sectionId: string; questionId: string };

// ─── API ↔ Builder conversion helpers ────────────────────────────────────────

function fromApiSections(sections: ApiSection[]): BuilderSection[] {
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      weight: 0,
      questions: [...s.questions]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(q => ({
          id: q.id,
          sectionId: s.id,
          text: q.text,
          guidance: q.guidance ?? '',
          type: q.type as QuestionType,
          required: q.required,
          options: [...q.options]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(o => ({ id: o.id, text: o.text, score: o.score })),
          minLabel: q.minLabel ?? '',
          maxLabel: q.maxLabel ?? '',
          ratingScores: q.ratingScores ?? [],
          yesScore: q.yesScore ?? 0,
          noScore: q.noScore ?? 0,
        })),
    }));
}

function toApiSections(sections: BuilderSection[]): ApiSection[] {
  return sections.map((s, si) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    sortOrder: si,
    questions: s.questions.map((q, qi) => ({
      id: q.id,
      text: q.text,
      guidance: q.guidance,
      type: q.type,
      required: q.required,
      sortOrder: qi,
      minLabel: q.minLabel,
      maxLabel: q.maxLabel,
      ratingScores: q.ratingScores,
      yesScore: q.yesScore,
      noScore: q.noScore,
      options: q.options.map((o, oi) => ({ id: o.id, text: o.text, score: o.score, sortOrder: oi })),
    })),
  }));
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const DEFAULT_MATURITY: MaturityRow[] = [
  { id: 'ml1', level: 1, name: 'Initial', scoreFrom: 0, scoreTo: 39, description: 'Processes are ad hoc and chaotic.' },
  { id: 'ml2', level: 2, name: 'Managed', scoreFrom: 40, scoreTo: 54, description: 'Processes are planned and tracked at the project level.' },
  { id: 'ml3', level: 3, name: 'Defined', scoreFrom: 55, scoreTo: 69, description: 'Processes are documented and standardized across the org.' },
  { id: 'ml4', level: 4, name: 'Quantitatively Managed', scoreFrom: 70, scoreTo: 84, description: 'Processes are measured and controlled quantitatively.' },
  { id: 'ml5', level: 5, name: 'Optimizing', scoreFrom: 85, scoreTo: 100, description: 'Focus on continuous process improvement.' },
];

const SEED_SECTIONS: BuilderSection[] = [
  {
    id: 'sec1', name: 'Strategy & Planning',
    description: 'Assess EA alignment with business strategy and long-term planning.',
    weight: 25,
    questions: [
      {
        id: 'q1', sectionId: 'sec1',
        text: 'How well is the EA strategy aligned with the overall business strategy?',
        guidance: 'Consider documented strategic plans, EA roadmaps, and level of executive sponsorship.',
        type: 'single-choice', required: true,
        options: [
          { id: 'o1', text: 'Fully aligned with a documented, approved strategy', score: 4 },
          { id: 'o2', text: 'Partially aligned — some linkage but not formalised', score: 2 },
          { id: 'o3', text: 'No discernible alignment', score: 0 },
        ],
        minLabel: '', maxLabel: '', ratingScores: [1, 2, 3, 4, 5], yesScore: 4, noScore: 0,
      },
      {
        id: 'q2', sectionId: 'sec1',
        text: 'Rate the maturity of the current EA roadmap.',
        guidance: 'Consider timeframe coverage, milestone clarity, and stakeholder buy-in.',
        type: 'rating-scale', required: true,
        options: [],
        minLabel: 'No roadmap exists', maxLabel: 'Fully optimized & reviewed quarterly',
        ratingScores: [1, 2, 3, 4, 5], yesScore: 4, noScore: 0,
      },
    ],
  },
  {
    id: 'sec2', name: 'Architecture Governance',
    description: 'Evaluate governance frameworks, review boards, and policy enforcement.',
    weight: 25,
    questions: [
      {
        id: 'q3', sectionId: 'sec2',
        text: 'Does the organization have a formal Architecture Review Board (ARB)?',
        guidance: 'The ARB should have a defined charter, regular cadence, and documented decisions.',
        type: 'yes-no', required: true,
        options: [], minLabel: '', maxLabel: '', ratingScores: [1, 2, 3, 4, 5], yesScore: 5, noScore: 0,
      },
      {
        id: 'q4', sectionId: 'sec2',
        text: 'Describe the current exception-handling process for architecture non-compliance.',
        guidance: 'A mature process includes escalation paths, time-bound waivers, and remediation tracking.',
        type: 'free-text', required: false,
        options: [], minLabel: '', maxLabel: '', ratingScores: [1, 2, 3, 4, 5], yesScore: 4, noScore: 0,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(_prefix?: string) { return crypto.randomUUID(); }

const ALL_Q_TYPE_LABELS: Partial<Record<QuestionType, string>> = {
  'single-choice': 'Single Choice',
  'multi-choice': 'Multi-Select',
  'rating-scale': 'Rating Scale (1–5)',
  'yes-no': 'Yes / No',
  'yes-no-partial': 'Yes / No / Partially',
  'percentage': 'Percentage Coverage',
  'frequency': 'Frequency',
};

// Kept as module-level fallback; the component derives a filtered version per framework
const Q_TYPE_LABELS: Partial<Record<QuestionType, string>> = ALL_Q_TYPE_LABELS;

function blankQuestion(sectionId: string): BuilderQuestion {
  return {
    id: uid('q'), sectionId,
    text: '', guidance: '', type: 'single-choice', required: true,
    options: [{ id: uid('o'), text: '', score: 0 }],
    minLabel: 'Low', maxLabel: 'High',
    ratingScores: [1, 2, 3, 4, 5], yesScore: 5, noScore: 0,
  };
}

// ─── Sortable Section Row ─────────────────────────────────────────────────────

interface SortableSectionRowProps {
  section: BuilderSection;
  expanded: boolean;
  selected: boolean;
  selectedQuestionId?: string;
  locked: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onSelectQuestion: (qId: string) => void;
  onDelete: () => void;
  onDeleteQuestion: (qId: string) => void;
  children: React.ReactNode;
}

function SortableSectionRow({
  section, expanded, selected, selectedQuestionId, locked,
  onToggleExpand, onSelect, onDelete, onSelectQuestion, onDeleteQuestion, children,
}: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id, data: { type: 'section' } });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group/row flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors select-none ${
          selected ? 'bg-primary/12 text-primary' : 'hover:bg-muted/60 text-foreground'
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        {!locked && (
          <span
            {...attributes} {...listeners}
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-0.5"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={13} />
          </span>
        )}
        {/* Expand toggle */}
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={e => { e.stopPropagation(); onToggleExpand(); }}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className="flex-1 truncate text-xs font-semibold">{section.name || 'Untitled Section'}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{section.questions.length}q</span>
        {!locked && (
          <button
            className="shrink-0 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive p-0.5 transition-opacity"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {children}
          <SortableContext
            items={section.questions.map(q => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {section.questions.map(q => (
              <SortableQuestionRow
                key={q.id}
                question={q}
                selected={selectedQuestionId === q.id}
                locked={locked}
                onSelect={() => onSelectQuestion(q.id)}
                onDelete={() => onDeleteQuestion(q.id)}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Question Row ────────────────────────────────────────────────────

interface SortableQuestionRowProps {
  question: BuilderQuestion;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableQuestionRow({ question, selected, locked, onSelect, onDelete }: SortableQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id, data: { type: 'question', sectionId: question.sectionId } });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };

  return (
    <div
      ref={setNodeRef} style={style}
      className={`group/row flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors select-none ${
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
      onClick={onSelect}
    >
      {!locked && (
        <span
          {...attributes} {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
      )}
      <span className="flex-1 truncate text-[11px] leading-snug">
        {question.text || <span className="italic opacity-50">Untitled question</span>}
      </span>
      <span className="shrink-0 text-[9px] opacity-60 font-mono uppercase">{(Q_TYPE_LABELS[question.type] ?? question.type).split(' ')[0]}</span>
      {!locked && (
        <button
          className="shrink-0 opacity-0 group-hover/row:opacity-100 text-destructive p-0.5 transition-opacity"
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

// ─── Section Edit Form ────────────────────────────────────────────────────────

interface SectionFormProps {
  section: BuilderSection;
  totalSections: number;
  locked: boolean;
  onChange: (patch: Partial<BuilderSection>) => void;
  onAddQuestion: () => void;
}

function SectionForm({ section, totalSections, locked, onChange, onAddQuestion }: SectionFormProps) {
  const autoWeight = Math.round(100 / totalSections);
  const weightOff = Math.abs(section.weight - autoWeight) > 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <BarChart2 size={15} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Section Editor</p>
          <p className="text-[10px] text-muted-foreground">{section.questions.length} question{section.questions.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sec-name">Section Name</Label>
        <Input
          id="sec-name"
          value={section.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="e.g. Data Governance"
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sec-desc">Description</Label>
        <Textarea
          id="sec-desc"
          value={section.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="What does this section assess?"
          rows={3}
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="sec-weight">Weight (%)</Label>
          {weightOff && (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <Info size={10} /> Equal split is {autoWeight}%
            </span>
          )}
        </div>
        <Input
          id="sec-weight"
          type="number"
          min={0} max={100}
          value={section.weight}
          onChange={e => onChange({ weight: Number(e.target.value) })}
          disabled={locked}
          className="w-28"
        />
      </div>

      {!locked && (
        <Button variant="outline" size="sm" onClick={onAddQuestion} className="w-full">
          <Plus size={14} className="mr-1.5" /> Add Question to this Section
        </Button>
      )}
    </div>
  );
}

// ─── Question Edit Form ───────────────────────────────────────────────────────

interface QuestionFormProps {
  question: BuilderQuestion;
  locked: boolean;
  onChange: (patch: Partial<BuilderQuestion>) => void;
  qTypeLabels?: Partial<Record<QuestionType, string>>;
}

function QuestionForm({ question, locked, onChange, qTypeLabels = Q_TYPE_LABELS }: QuestionFormProps) {
  const addOption = () =>
    onChange({ options: [...question.options, { id: uid('o'), text: '', score: 0 }] });

  const removeOption = (id: string) =>
    onChange({ options: question.options.filter(o => o.id !== id) });

  const patchOption = (id: string, patch: Partial<AnswerOption>) =>
    onChange({ options: question.options.map(o => o.id === id ? { ...o, ...patch } : o) });

  const patchRatingScore = (idx: number, val: number) => {
    const scores = [...question.ratingScores];
    scores[idx] = val;
    onChange({ ratingScores: scores });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
          <span className="text-[11px] font-bold text-violet-600">Q</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Question Editor</p>
          <p className="text-[10px] text-muted-foreground">{Q_TYPE_LABELS[question.type]}</p>
        </div>
      </div>

      {/* Question text */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="q-text">Question Text <span className="text-destructive">*</span></Label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={question.required}
              onChange={e => onChange({ required: e.target.checked })}
              disabled={locked}
              className="h-3 w-3 rounded border-input accent-primary"
            />
            Required
          </label>
        </div>
        <Textarea
          id="q-text"
          value={question.text}
          onChange={e => onChange({ text: e.target.value })}
          placeholder="Enter the question respondents will answer…"
          rows={3}
          disabled={locked}
        />
      </div>

      {/* Guidance */}
      <div className="space-y-1.5">
        <Label htmlFor="q-guidance">
          Guidance Notes
          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(shown to respondents as a hint)</span>
        </Label>
        <Textarea
          id="q-guidance"
          value={question.guidance}
          onChange={e => onChange({ guidance: e.target.value })}
          placeholder="Optional: add context to help respondents answer accurately…"
          rows={2}
          disabled={locked}
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label htmlFor="q-type">Question Type</Label>
        <Select
          id="q-type"
          value={question.type}
          onChange={e => onChange({ type: e.target.value as QuestionType })}
          disabled={locked}
        >
          {(Object.entries(qTypeLabels) as [QuestionType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>



      {/* ── Dynamic scoring section ─────────────────────── */}

      {/* Single / Multi Choice */}
      {(question.type === 'single-choice' || question.type === 'multi-choice') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Answer Options</Label>
            <span className="text-[10px] text-muted-foreground">Text · Score</span>
          </div>
          <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
            {question.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0 w-4">{i + 1}.</span>
                <Input
                  value={opt.text}
                  onChange={e => patchOption(opt.id, { text: e.target.value })}
                  placeholder="Option text"
                  disabled={locked}
                  className="flex-1 h-8 text-xs"
                />
                <Input
                  type="number"
                  value={opt.score}
                  onChange={e => patchOption(opt.id, { score: Number(e.target.value) })}
                  disabled={locked}
                  className="w-16 h-8 text-xs text-center"
                  title="Score"
                />
                {!locked && question.options.length > 1 && (
                  <button onClick={() => removeOption(opt.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!locked && (
            <Button variant="ghost" size="sm" onClick={addOption} className="h-7 text-xs">
              <Plus size={12} className="mr-1" /> Add option
            </Button>
          )}
        </div>
      )}

      {/* Rating Scale */}
      {question.type === 'rating-scale' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-min" className="text-xs">Min Label (Level 1)</Label>
              <Input
                id="q-min"
                value={question.minLabel}
                onChange={e => onChange({ minLabel: e.target.value })}
                placeholder="e.g. Not in place"
                disabled={locked}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-max" className="text-xs">Max Label (Level 5)</Label>
              <Input
                id="q-max"
                value={question.maxLabel}
                onChange={e => onChange({ maxLabel: e.target.value })}
                placeholder="e.g. Fully optimized"
                disabled={locked}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium">Level</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[1, 2, 3, 4, 5].map(level => (
                  <tr key={level}>
                    <td className="px-3 py-2 text-muted-foreground">Level {level}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={question.ratingScores[level - 1]}
                        onChange={e => patchRatingScore(level - 1, Number(e.target.value))}
                        disabled={locked}
                        className="w-16 h-7 text-xs text-center ml-auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Yes / No */}
      {question.type === 'yes-no' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Answer</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2.5 font-medium text-emerald-700">Yes</td>
                <td className="px-4 py-2.5 text-right">
                  <Input
                    type="number"
                    value={question.yesScore}
                    onChange={e => onChange({ yesScore: Number(e.target.value) })}
                    disabled={locked}
                    className="w-16 h-7 text-xs text-center ml-auto"
                  />
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-red-600">No</td>
                <td className="px-4 py-2.5 text-right">
                  <Input
                    type="number"
                    value={question.noScore}
                    onChange={e => onChange({ noScore: Number(e.target.value) })}
                    disabled={locked}
                    className="w-16 h-7 text-xs text-center ml-auto"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Free Text */}
      {question.type === 'free-text' && (
        <div className="flex items-start gap-2.5 rounded-lg bg-primary/8 border border-primary/20 px-4 py-3">
          <Info size={14} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary/80">
            Text answers are used for AI context and qualitative analysis only. No numeric score is applied.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Scoring Model Panel ──────────────────────────────────────────────────────

// Level colours — cycles for >5 levels
const LEVEL_COLOR_CLASSES = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500',
  'bg-purple-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-cyan-500',
];

const DEFAULT_LEVEL_LABELS = ['Initial', 'Developing', 'Defined', 'Quantitatively Managed', 'Optimising'];

// Distributes the 0–100 scale evenly across N levels
function computeMaturityRanges(n: number): { from: number; to: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    from: Math.round((i / n) * 100),
    to: i === n - 1 ? 100 : Math.round(((i + 1) / n) * 100) - 1,
  }));
}

interface ScoringPanelProps {
  maturityLevels: MaturityRow[];
  targetScore: number;
  locked: boolean;
  onChangeLevel: (id: string, patch: Partial<MaturityRow>) => void;
  onChangeTarget: (v: number) => void;
  onAddLevel: () => void;
  onRemoveLevel: (id: string) => void;
}

function ScoringPanel({ maturityLevels, targetScore, locked, onChangeLevel, onChangeTarget, onAddLevel, onRemoveLevel }: ScoringPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
          <BarChart2 size={15} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Scoring Model</p>
          <p className="text-[10px] text-muted-foreground">Maturity levels & target score</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="target-score">Target Score (%)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="target-score"
            type="number"
            min={0} max={100}
            value={targetScore}
            onChange={e => onChangeTarget(Number(e.target.value))}
            disabled={locked}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">Minimum score to pass this assessment</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Maturity Levels</Label>
          {!locked && (
            <Button type="button" variant="outline" size="sm" onClick={onAddLevel} className="shrink-0 text-xs h-7">
              <Plus size={12} className="mr-1" /> Add Level
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {maturityLevels.map((row, i) => (
            <div key={row.id} className="flex items-center gap-3">
              {/* Colored circle */}
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${LEVEL_COLOR_CLASSES[i % LEVEL_COLOR_CLASSES.length]}`}>
                {row.level}
              </div>
              {/* Label */}
              <Input
                value={row.name}
                onChange={e => onChangeLevel(row.id, { name: e.target.value })}
                disabled={locked}
                placeholder={`Level ${row.level} label`}
                className="w-44 shrink-0"
              />
              {/* Description */}
              <Input
                value={row.description}
                onChange={e => onChangeLevel(row.id, { description: e.target.value })}
                disabled={locked}
                placeholder={`Description for level ${row.level}…`}
                className="flex-1"
              />
              {/* Score range badge */}
              <span className="shrink-0 text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 font-mono whitespace-nowrap">
                {row.scoreFrom}–{row.scoreTo}%
              </span>
              {/* Remove button */}
              {!locked && (
                <button
                  type="button"
                  onClick={() => onRemoveLevel(row.id)}
                  disabled={maturityLevels.length <= 2}
                  title={maturityLevels.length <= 2 ? 'Minimum 2 levels required' : `Remove level ${row.level}`}
                  className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    maturityLevels.length <= 2
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Cover Panel ─────────────────────────────────────────────────────────────

function CoverPanel({ templateId, apiTemplate, onCoverUpdate, locked }: {
  templateId: string;
  apiTemplate: ApiTemplate | null;
  onCoverUpdate: (patch: Partial<ApiTemplate>) => void;
  locked: boolean;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [tagline, setTagline] = useState(apiTemplate?.tagline ?? '');
  const [definition, setDefinition] = useState(apiTemplate?.definition ?? '');
  const [explanation, setExplanation] = useState(apiTemplate?.explanation ?? '');

  // Re-sync when API template arrives or changes
  useEffect(() => {
    if (apiTemplate) {
      setTagline(apiTemplate.tagline ?? '');
      setDefinition(apiTemplate.definition ?? '');
      setExplanation(apiTemplate.explanation ?? '');
    }
  }, [apiTemplate?.id]);

  const save = (patch: Partial<ApiTemplate>) => {
    onCoverUpdate(patch);
    // Also update store as fallback
    updateTemplate(templateId, patch as Partial<Template>);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => save({ coverImageUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const currentImg = apiTemplate?.coverImageUrl ?? getTemplate(templateId)?.coverImageUrl;

  return (
    <div className="space-y-5">
      {/* Panel header */}
      <div className="flex items-center gap-2 pb-3 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
          <ImageIcon size={15} className="text-sky-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Template Cover</p>
          <p className="text-[10px] text-muted-foreground">Intro screen shown to assessors & respondents</p>
        </div>
      </div>

      {/* Row 1: Tagline — full width */}
      <div className="space-y-1.5">
        <Label htmlFor="cov-tagline">Tagline</Label>
        <Input
          id="cov-tagline"
          value={tagline}
          onChange={e => setTagline(e.target.value)}
          onBlur={() => save({ tagline })}
          placeholder="A short subtitle for this template…"
          disabled={locked}
        />
      </div>

      {/* Row 2: About (left, tall) + Cover image (right, smaller) */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cov-def">About This Assessment</Label>
          <Textarea
            id="cov-def"
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            onBlur={() => save({ definition })}
            placeholder="Describe what this assessment measures and why it matters…"
            rows={8}
            disabled={locked}
            className="resize-none"
          />
        </div>

        <div className="w-48 shrink-0 space-y-1.5">
          <Label>Cover Image</Label>
          <div
            className={`relative group/img rounded-xl overflow-hidden border bg-muted/30 ${!locked ? 'cursor-pointer' : ''}`}
            style={{ aspectRatio: '4/3' }}
            onClick={() => !locked && coverInputRef.current?.click()}
          >
            {currentImg ? (
              <img src={currentImg} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-1.5 text-muted-foreground">
                <Camera size={22} />
                <span className="text-[11px] text-center px-2">{locked ? 'No image' : 'Click to upload'}</span>
              </div>
            )}
            {!locked && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                <Camera size={16} className="text-white" />
                <span className="text-white text-[11px] font-medium">{currentImg ? 'Change' : 'Upload'}</span>
              </div>
            )}
          </div>
          {!locked && (
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          )}
        </div>
      </div>

      {/* Row 3: What Will Be Evaluated — full width */}
      <div className="space-y-1.5">
        <Label htmlFor="cov-exp">What Will Be Evaluated?</Label>
        <Textarea
          id="cov-exp"
          value={explanation}
          onChange={e => setExplanation(e.target.value)}
          onBlur={() => save({ explanation })}
          placeholder="Explain what aspects will be assessed across sections…"
          rows={5}
          disabled={locked}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [apiTemplate, setApiTemplate] = useState<ApiTemplate | null>(null);
  const [apiFramework, setApiFramework] = useState<{ allowedQuestionTypes: QuestionType[] } | null>(null);
  const template = apiTemplate ?? getTemplate(id ?? '') ?? getTemplates().find(t => t.id === id);
  // Use full framework from API or store fallback (ApiTemplate.framework only has id+name)
  const framework = apiFramework ?? (template?.frameworkId ? getFramework(template.frameworkId) : undefined);
  const effectiveQTypeLabels: Partial<Record<QuestionType, string>> = framework
    ? Object.fromEntries(
        Object.entries(ALL_Q_TYPE_LABELS).filter(([k]) =>
          framework.allowedQuestionTypes.includes(k as QuestionType)
        )
      )
    : ALL_Q_TYPE_LABELS;

  // ── Builder state — seed from store if previously saved, else from mockData ──
  const _meta = id ? getTemplateMeta(id) : null;
  // True if the user has previously saved custom maturity levels on this template
  const hasStoredLevels = !!((_meta?.maturityLevels as MaturityRow[] | undefined)?.length);
  const [name, setName] = useState(_meta?.name ?? template?.name ?? 'Untitled Template');
  const [editingName, setEditingName] = useState(false);
  const [version, setVersion] = useState(_meta?.version ?? template?.version ?? '1.0');
  const [status, setStatus] = useState<TemplateStatus>(_meta?.status ?? template?.status ?? 'Draft');
  const [sections, setSections] = useState<BuilderSection[]>(() => {
    if (!id) return [];
    const stored = getTemplateSections(id);
    if (stored) return stored;
    // Only pre-populate with demo sections for seed templates; new user-created templates start empty
    const SEED_TEMPLATE_IDS = new Set(['t1', 't2', 't2b', 't3', 't4']);
    const isSeedTemplate = id ? SEED_TEMPLATE_IDS.has(id) : false;
    if (isSeedTemplate) {
      saveTemplateSections(id, SEED_SECTIONS);
      return SEED_SECTIONS;
    }
    return [];
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['sec1', 'sec2']));
  const [maturityLevels, setMaturityLevels] = useState<MaturityRow[]>(
    (_meta?.maturityLevels as MaturityRow[] | undefined) ?? DEFAULT_MATURITY
  );
  const [targetScore, setTargetScore] = useState(_meta?.targetScore ?? 70);
  const [selection, setSelection] = useState<Selection>({ kind: 'cover' });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  // Refs always hold latest values — guards and save callbacks read these
  const isDirtyRef = useRef(false);
  const sectionsRef = useRef(sections);
  const nameRef = useRef(name);
  const versionRef = useRef(version);
  const statusRef = useRef(status);
  const maturityLevelsRef = useRef(maturityLevels);
  const targetScoreRef = useRef(targetScore);

  // ── Dialog ──
  const [activateOpen, setActivateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── DnD ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const locked = status === 'Active' || status === 'Archived' || user?.role !== 'admin';

  // ── Load from API on mount ──
  useEffect(() => {
    if (!id) return;
    templatesApi.get(id)
      .then(tpl => {
        setApiTemplate(tpl);
        setName(tpl.name);
        setVersion(tpl.version);
        setStatus(tpl.status as TemplateStatus);
        if (tpl.sections && tpl.sections.length > 0) {
          const builderSections = fromApiSections(tpl.sections);
          setSections(builderSections);
          setExpandedSections(new Set([builderSections[0]?.id].filter(Boolean) as string[]));
        }
        // Load full framework (for allowedQuestionTypes + maturity level inheritance)
        if (tpl.frameworkId) {
          frameworksApi.get(tpl.frameworkId)
            .then(fw => {
              setApiFramework({ allowedQuestionTypes: fw.allowedQuestionTypes as QuestionType[] });
              // Inherit maturity levels from framework on first open.
              // If the admin has previously saved custom levels on this template,
              // those are stored in _meta and we keep them unchanged.
              if (!hasStoredLevels && fw.maturityLevels.length > 0) {
                const ranges = computeMaturityRanges(fw.maturityLevels.length);
                setMaturityLevels(fw.maturityLevels.map((fl, i) => ({
                  id: uid('ml'),
                  level: fl.level,
                  name: fl.label,
                  scoreFrom: ranges[i].from,
                  scoreTo: ranges[i].to,
                  description: fl.description,
                })));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => { /* keep store/default state */ });
  }, [id]);

  // ── Cover update handler ──
  const handleCoverUpdate = useCallback((patch: Partial<ApiTemplate>) => {
    if (id) {
      templatesApi.update(id, patch)
        .then(updated => setApiTemplate(updated))
        .catch(() => {});
    }
  }, [id]);

  // ── Callbacks ──
  const toggleExpanded = useCallback((sId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sId)) next.delete(sId); else next.add(sId);
      return next;
    });
  }, []);

  const addSection = () => {
    const newSec: BuilderSection = {
      id: uid('sec'), name: 'New Section', description: '',
      weight: Math.round(100 / (sections.length + 1)), questions: [],
    };
    setSections(prev => [...prev, newSec]);
    setExpandedSections(prev => new Set([...prev, newSec.id]));
    markDirty();
    setSelection({ kind: 'section', sectionId: newSec.id });
  };

  const deleteSection = (sId: string) => {
    setSections(prev => prev.filter(s => s.id !== sId));
    setSelection({ kind: 'scoring' });
    markDirty();
  };

  const updateSection = (sId: string, patch: Partial<BuilderSection>) => {
    setSections(prev => prev.map(s => s.id === sId ? { ...s, ...patch } : s));
    markDirty();
  };

  const addQuestion = (sId: string) => {
    const q = blankQuestion(sId);
    setSections(prev => prev.map(s => s.id === sId ? { ...s, questions: [...s.questions, q] } : s));
    setExpandedSections(prev => new Set([...prev, sId]));
    setSelection({ kind: 'question', sectionId: sId, questionId: q.id });
    markDirty();
  };

  const deleteQuestion = (sId: string, qId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sId ? { ...s, questions: s.questions.filter(q => q.id !== qId) } : s
    ));
    setSelection({ kind: 'section', sectionId: sId });
    markDirty();
  };

  const updateQuestion = (sId: string, qId: string, patch: Partial<BuilderQuestion>) => {
    setSections(prev => prev.map(s =>
      s.id === sId
        ? { ...s, questions: s.questions.map(q => q.id === qId ? { ...q, ...patch } : q) }
        : s
    ));
    markDirty();
  };

  const addMaturityLevel = () => {
    setMaturityLevels(prev => {
      const n = prev.length + 1;
      const ranges = computeMaturityRanges(n);
      return prev
        .map((l, i) => ({ ...l, scoreFrom: ranges[i].from, scoreTo: ranges[i].to }))
        .concat({
          id: uid('ml'),
          level: n,
          name: DEFAULT_LEVEL_LABELS[n - 1] ?? `Level ${n}`,
          scoreFrom: ranges[n - 1].from,
          scoreTo: ranges[n - 1].to,
          description: '',
        });
    });
    markDirty();
  };

  const removeMaturityLevel = (levelId: string) => {
    setMaturityLevels(prev => {
      if (prev.length <= 2) return prev;
      const filtered = prev.filter(l => l.id !== levelId);
      const n = filtered.length;
      const ranges = computeMaturityRanges(n);
      return filtered.map((l, i) => ({ ...l, level: i + 1, scoreFrom: ranges[i].from, scoreTo: ranges[i].to }));
    });
    markDirty();
  };

  // Keep refs in sync with latest state on every render
  sectionsRef.current = sections;
  isDirtyRef.current = isDirty;
  nameRef.current = name;
  versionRef.current = version;
  statusRef.current = status;
  maturityLevelsRef.current = maturityLevels;
  targetScoreRef.current = targetScore;

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
  }, []);

  // Auto-persist sections to localStorage on every change (survives HMR / page refresh)
  useEffect(() => {
    if (id && sections.length > 0) saveTemplateSections(id, sections);
  }, [id, sections]);

  // ── CSV Import handlers ──
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const result = parseTemplateCSV(text);
      setImportResult(result);
      setImportMode('replace');
      setImportModalOpen(true);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importResult || importResult.errors.length > 0) return;
    setSections(prev => importMode === 'replace' ? importResult.sections : [...prev, ...importResult.sections]);
    const newIds = new Set(importResult.sections.map(s => s.id));
    setExpandedSections(prev => new Set([...prev, ...newIds]));
    markDirty();
    setImportModalOpen(false);
    setImportResult(null);
  };

  const handleExportCsv = () => {
    const csv = exportSectionsToCSV(sectionsRef.current);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nameRef.current.replace(/[^a-z0-9]/gi, '_')}_sections.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nudj_import_format.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stable save — reads all refs so always persists the latest values
  const handleSaveDraft = useCallback(async () => {
    if (id) {
      // Store fallback (always, so HMR / page-refresh doesn't lose work)
      saveTemplateSections(id, sectionsRef.current);
      saveTemplateMeta(id, {
        name: nameRef.current,
        version: versionRef.current,
        status: statusRef.current,
        maturityLevels: maturityLevelsRef.current,
        targetScore: targetScoreRef.current,
      });
      // API save — awaited so callers (Preview, Activate) see persisted data
      let apiOk = false;
      await Promise.all([
        templatesApi.update(id, {
          name: nameRef.current,
          version: versionRef.current,
          status: statusRef.current as ApiTemplate['status'],
        }).then(updated => setApiTemplate(updated)),
        templatesApi.saveSections(id, toApiSections(sectionsRef.current)),
      ]).then(() => { apiOk = true; }).catch((err: Error) => {
        const msg = err?.message ?? 'Save failed — check the server is running';
        console.error('[TemplateBuilder] API save failed:', msg, err);
        setSaveError(msg);
        setTimeout(() => setSaveError(null), 5000);
      });
      if (!apiOk) return; // keep isDirty=true so the user can retry
    }
    isDirtyRef.current = false;
    setIsDirty(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  }, [id]);

  const { requestNavigation } = useDirtyState();

  // Register synchronously on every render — module-level singleton, no effect delays
  if (!locked) {
    registerDirtyGuard(() => isDirtyRef.current, handleSaveDraft);
  } else {
    unregisterDirtyGuard();
  }

  // Clean up when this builder unmounts
  useEffect(() => () => unregisterDirtyGuard(), []);

  const handleActivateConfirm = async () => {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
    const newVersion = parts.join('.');
    setStatus('Active');
    setVersion(newVersion);
    setActivateOpen(false);
    setIsDirty(false);
    if (id) {
      // Store fallback
      saveTemplateSections(id, sectionsRef.current);
      saveTemplateMeta(id, {
        name: nameRef.current,
        version: newVersion,
        status: 'Active',
        maturityLevels: maturityLevelsRef.current,
        targetScore: targetScoreRef.current,
      });
      // Enforce single Active per family in store — archive other Active siblings
      const allTemplates = getTemplates();
      getVersionFamily(allTemplates, id).forEach(t => {
        if (t.id === id || t.status !== 'Active') return;
        saveTemplate({ ...t, status: 'Archived', updatedAt: new Date().toISOString() });
        const tMeta = getTemplateMeta(t.id);
        if (tMeta) saveTemplateMeta(t.id, { ...tMeta, status: 'Archived' });
        // Archive sibling via API
        templatesApi.update(t.id, { status: 'Archived' }).catch(() => {});
      });
      // API activate: await so the template list sees the saved sections immediately
      await Promise.all([
        templatesApi.update(id, { name: nameRef.current, version: newVersion, status: 'Active' })
          .then(updated => setApiTemplate(updated)),
        templatesApi.saveSections(id, toApiSections(sectionsRef.current)),
      ]).catch(() => {});
    }
    // Navigate only after saves have completed
    const categoryId = apiTemplate?.categoryId ?? template?.categoryId;
    if (categoryId) {
      navigate(`/categories/${categoryId}/templates`);
    } else {
      navigate('/categories');
    }
  };

  const handleCreateNewVersionConfirm = () => {
    if (!id) return;
    const newId = cloneTemplate(id);
    setNewVersionOpen(false);
    navigate(`/templates/${newId}/builder`);
  };

  // ── DnD handlers ──
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeType = active.data.current?.type;
    const overType   = over.data.current?.type;

    if (activeType === 'section') {
      setSections(prev => {
        const oldIdx = prev.findIndex(s => s.id === active.id);
        const newIdx = prev.findIndex(s => s.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
      markDirty();
    } else if (activeType === 'question') {
      const srcSectionId = active.data.current?.sectionId as string;
      const dstSectionId = (overType === 'question'
        ? (over.data.current?.sectionId as string)
        : (over.id as string));
      setSections(prev => {
        if (srcSectionId === dstSectionId) {
          return prev.map(s => {
            if (s.id !== srcSectionId) return s;
            const oi = s.questions.findIndex(q => q.id === active.id);
            const ni = s.questions.findIndex(q => q.id === over.id);
            if (oi < 0 || ni < 0) return s;
            return { ...s, questions: arrayMove(s.questions, oi, ni) };
          });
        }
        // Cross-section move
        const q = prev.find(s => s.id === srcSectionId)?.questions.find(q => q.id === active.id);
        if (!q) return prev;
        return prev.map(s => {
          if (s.id === srcSectionId) return { ...s, questions: s.questions.filter(x => x.id !== active.id) };
          if (s.id === dstSectionId) return { ...s, questions: [...s.questions, q] };
          return s;
        });
      });
      markDirty();
    }
  };

  // ── Right panel content ──
  const rightPanel = () => {
    if (selection.kind === 'cover') {
      return id ? <CoverPanel templateId={id} apiTemplate={apiTemplate} onCoverUpdate={handleCoverUpdate} locked={locked} /> : null;
    }
    if (selection.kind === 'scoring') {
      return (
        <ScoringPanel
          maturityLevels={maturityLevels}
          targetScore={targetScore}
          locked={locked}
          onChangeLevel={(id, patch) => {
            setMaturityLevels(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
            markDirty();
          }}
          onChangeTarget={v => { setTargetScore(v); markDirty(); }}
          onAddLevel={addMaturityLevel}
          onRemoveLevel={removeMaturityLevel}
        />
      );
    }
    if (selection.kind === 'section') {
      const sec = sections.find(s => s.id === selection.sectionId);
      if (!sec) return null;
      return (
        <SectionForm
          section={sec}
          totalSections={sections.length}
          locked={locked}
          onChange={patch => updateSection(selection.sectionId, patch)}
          onAddQuestion={() => addQuestion(selection.sectionId)}
        />
      );
    }
    if (selection.kind === 'question') {
      const sec = sections.find(s => s.id === selection.sectionId);
      const q   = sec?.questions.find(q => q.id === selection.questionId);
      if (!q) return null;
      return (
        <QuestionForm
          question={q}
          locked={locked}
          onChange={patch => updateQuestion(selection.sectionId, selection.questionId, patch)}
          qTypeLabels={effectiveQTypeLabels}
        />
      );
    }
    return null;
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Template not found.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-screen overflow-hidden bg-background">

          {/* ── Top bar ── */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-5 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                const categoryId = apiTemplate?.categoryId ?? template?.categoryId;
                requestNavigation(categoryId ? `/categories/${categoryId}/templates` : '/categories');
              }}>
                <ArrowLeft size={15} />
              </Button>

              {/* Editable template name */}
              {editingName && !locked ? (
                <input
                  autoFocus
                  className="text-sm font-semibold bg-transparent border-b border-primary outline-none min-w-0 max-w-xs"
                  value={name}
                  onChange={e => { setName(e.target.value); markDirty(); }}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
                />
              ) : (
                <button
                  className="text-sm font-semibold text-foreground truncate max-w-xs hover:text-primary transition-colors"
                  onClick={() => !locked && setEditingName(true)}
                  title={locked ? undefined : 'Click to rename'}
                >
                  {name}
                </button>
              )}

              <Badge variant={status === 'Active' ? 'success' : status === 'Archived' ? 'outline' : 'secondary'} className="text-[10px] shrink-0">
                {status}
              </Badge>
              <span className="text-[11px] text-muted-foreground shrink-0">v{version}</span>
              {locked && <Lock size={12} className="text-muted-foreground shrink-0" />}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Framework badge */}
              {framework && (
                <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                  <LayoutGrid size={11} />
                  {framework.name}
                </div>
              )}

              {savedAt && !saveError && (
                <span className="text-[11px] text-emerald-600 font-medium hidden sm:inline">Saved</span>
              )}
              {isDirty && !savedAt && !saveError && (
                <span className="text-[11px] text-amber-600 font-medium hidden sm:inline">Unsaved changes</span>
              )}
              {saveError && (
                <span className="text-[11px] text-red-600 font-medium hidden sm:inline" title={saveError}>⚠ Save failed</span>
              )}

              {!locked && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSaveDraft}>
                    <Save size={13} className="mr-1.5" /> Save
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreviewOpen(true)}>
                    <Eye size={13} className="mr-1.5" /> Preview
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={() => setActivateOpen(true)} disabled={sections.length === 0}>
                    <Zap size={13} className="mr-1.5" /> Activate
                  </Button>
                </>
              )}

              {(status === 'Active' || status === 'Archived') && user?.role === 'admin' && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setNewVersionOpen(true)}>
                  <GitBranch size={13} className="mr-1.5" /> New Version
                </Button>
              )}
            </div>
          </header>

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0">

            {/* ── Left: Section tree ── */}
            <aside className="w-56 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col">
              <div className="p-3 border-b space-y-1">
                {/* Cover page nav */}
                <button
                  onClick={() => setSelection({ kind: 'cover' })}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    selection.kind === 'cover' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/60'
                  }`}
                >
                  <LayoutTemplate size={13} className="shrink-0" />
                  Cover Page
                </button>
                {/* Scoring nav */}
                <button
                  onClick={() => setSelection({ kind: 'scoring' })}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    selection.kind === 'scoring' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/60'
                  }`}
                >
                  <BarChart2 size={13} className="shrink-0" />
                  Scoring Model
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {sections.map(sec => (
                    <SortableSectionRow
                      key={sec.id}
                      section={sec}
                      expanded={expandedSections.has(sec.id)}
                      selected={
                        (selection.kind === 'section' && selection.sectionId === sec.id) ||
                        (selection.kind === 'question' && selection.sectionId === sec.id)
                      }
                      selectedQuestionId={selection.kind === 'question' ? selection.questionId : undefined}
                      locked={locked}
                      onToggleExpand={() => toggleExpanded(sec.id)}
                      onSelect={() => setSelection({ kind: 'section', sectionId: sec.id })}
                      onSelectQuestion={qId => setSelection({ kind: 'question', sectionId: sec.id, questionId: qId })}
                      onDelete={() => deleteSection(sec.id)}
                      onDeleteQuestion={qId => deleteQuestion(sec.id, qId)}
                    >
                      {!locked && (
                        <button
                          className="w-full flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                          onClick={e => { e.stopPropagation(); addQuestion(sec.id); }}
                        >
                          <Plus size={11} /> Add Question
                        </button>
                      )}
                    </SortableSectionRow>
                  ))}
                </SortableContext>
              </div>

              {/* Add Section + Import buttons */}
              {!locked && (
                <div className="border-t p-2 space-y-1">
                  <Button variant="ghost" size="sm" className="w-full h-8 text-xs justify-start" onClick={addSection}>
                    <Plus size={13} className="mr-1.5" /> Add Section
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-[11px]" onClick={() => csvInputRef.current?.click()}>
                      <Upload size={11} className="mr-1" /> Import CSV
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-[11px]" onClick={handleExportCsv} disabled={sections.length === 0}>
                      <Download size={11} className="mr-1" /> Export
                    </Button>
                  </div>
                  <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />
                </div>
              )}
            </aside>

            {/* ── Right: Detail panel ── */}
            <main className="flex-1 overflow-y-auto p-6">
              {rightPanel()}
            </main>
          </div>
        </div>

        {/* DnD ghost */}
        <DragOverlay>
          {activeDragId && (
            <div className="rounded-lg border bg-card shadow-xl px-3 py-2 text-xs font-medium opacity-90">
              Moving…
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Activate dialog ── */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap size={16} className="text-amber-500" /> Activate Template
            </DialogTitle>
            <DialogDescription>
              Activating will lock this template for editing and bump the patch version.
              Any existing Active version in this family will be archived.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleActivateConfirm}>Activate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Version dialog ── */}
      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch size={16} /> Create New Version
            </DialogTitle>
            <DialogDescription>
              A new Draft copy of this template will be created. The current version remains unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreateNewVersionConfirm}>Create New Version</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Questionnaire</DialogTitle>
            <DialogDescription>
              Open the questionnaire in preview mode (read-only, no answers saved).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={async () => {
                // Save to local store + fire API sync before opening preview
                await handleSaveDraft();
                setPreviewOpen(false);
                window.open(
                  `${import.meta.env.BASE_URL}templates/${id}/preview?mode=preview`,
                  '_blank',
                );
              }}
            >
              Open Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV Import modal ── */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Sections from CSV</DialogTitle>
            <DialogDescription>
              Review the import result below before confirming.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-3 max-h-72 overflow-y-auto">
            {importResult && (
              <>
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                        <AlertCircle size={13} className="shrink-0 mt-0.5" /> {e}
                      </div>
                    ))}
                  </div>
                )}
                {importResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {importResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {w}
                      </div>
                    ))}
                  </div>
                )}
                {importResult.errors.length === 0 && (
                  <div className="flex items-start gap-2 text-xs text-emerald-700">
                    <Check size={13} className="shrink-0 mt-0.5" />
                    {importResult.sections.length} section{importResult.sections.length !== 1 ? 's' : ''},{' '}
                    {importResult.sections.reduce((n, s) => n + s.questions.length, 0)} questions ready to import.
                  </div>
                )}
                {importResult.errors.length === 0 && (
                  <div className="flex gap-2 pt-1">
                    {(['replace', 'append'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setImportMode(m)}
                        className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                          importMode === m ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {m === 'replace' ? 'Replace all sections' : 'Append to existing'}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={handleConfirmImport}
              disabled={!importResult || importResult.errors.length > 0}
            >
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="sm" className="hidden" onClick={handleDownloadTemplate}>
        Download Template CSV
      </Button>
    </TooltipProvider>
  );
}

// ─── Keyed wrapper (forces full remount when templateId changes) ──────────────

export function KeyedTemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  return <TemplateBuilder key={id} />;
}
