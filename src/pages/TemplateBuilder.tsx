import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Save, Zap, ArrowLeft, BarChart2, Info, X, Check, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import { templates as seedTemplates } from '@/services/mockData';
import type { TemplateStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = 'single-choice' | 'multi-choice' | 'rating-scale' | 'yes-no' | 'free-text';

interface AnswerOption { id: string; text: string; score: number }

interface BuilderQuestion {
  id: string;
  sectionId: string;
  text: string;
  guidance: string;
  type: QuestionType;
  required: boolean;
  options: AnswerOption[];
  minLabel: string;
  maxLabel: string;
  ratingScores: number[];
  yesScore: number;
  noScore: number;
}

interface BuilderSection {
  id: string;
  name: string;
  description: string;
  weight: number;
  questions: BuilderQuestion[];
}

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
  | { kind: 'section'; sectionId: string }
  | { kind: 'question'; sectionId: string; questionId: string };

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

let _counter = 100;
function uid(prefix: string) { return `${prefix}${++_counter}`; }

const Q_TYPE_LABELS: Record<QuestionType, string> = {
  'single-choice': 'Single Choice',
  'multi-choice': 'Multi-Choice',
  'rating-scale': 'Rating Scale',
  'yes-no': 'Yes / No',
  'free-text': 'Free Text',
};

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
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors select-none ${
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
            className="shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive p-0.5 transition-opacity"
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
      className={`group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors select-none ${
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
      <span className="shrink-0 text-[9px] opacity-60 font-mono uppercase">{Q_TYPE_LABELS[question.type].split(' ')[0]}</span>
      {!locked && (
        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 text-destructive p-0.5 transition-opacity"
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
}

function QuestionForm({ question, locked, onChange }: QuestionFormProps) {
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
          {(Object.entries(Q_TYPE_LABELS) as [QuestionType, string][]).map(([v, l]) => (
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
        <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Text answers are used for AI context and qualitative analysis only. No numeric score is applied.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Scoring Model Panel ──────────────────────────────────────────────────────

interface ScoringPanelProps {
  maturityLevels: MaturityRow[];
  targetScore: number;
  locked: boolean;
  onChangeLevel: (id: string, patch: Partial<MaturityRow>) => void;
  onChangeTarget: (v: number) => void;
}

function ScoringPanel({ maturityLevels, targetScore, locked, onChangeLevel, onChangeTarget }: ScoringPanelProps) {
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
        <Label>Maturity Levels</Label>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-8">#</th>
                <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Level Name</th>
                <th className="px-3 py-2.5 text-right text-muted-foreground font-medium w-16">From</th>
                <th className="px-3 py-2.5 text-right text-muted-foreground font-medium w-16">To</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {maturityLevels.map(row => (
                <tr key={row.id} className="group">
                  <td className="px-3 py-2 text-muted-foreground font-mono">{row.level}</td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.name}
                      onChange={e => onChangeLevel(row.id, { name: e.target.value })}
                      disabled={locked}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      value={row.scoreFrom}
                      onChange={e => onChangeLevel(row.id, { scoreFrom: Number(e.target.value) })}
                      disabled={locked}
                      className="w-14 h-7 text-xs text-center ml-auto"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      value={row.scoreTo}
                      onChange={e => onChangeLevel(row.id, { scoreTo: Number(e.target.value) })}
                      disabled={locked}
                      className="w-14 h-7 text-xs text-center ml-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Descriptions below the table */}
        <div className="space-y-2 pt-1">
          {maturityLevels.map(row => (
            <div key={row.id} className="flex items-start gap-2">
              <span className="text-[10px] text-muted-foreground font-mono mt-1.5 w-4 shrink-0">{row.level}</span>
              <Input
                value={row.description}
                onChange={e => onChangeLevel(row.id, { description: e.target.value })}
                disabled={locked}
                placeholder={`Description for level ${row.level}…`}
                className="h-7 text-xs text-muted-foreground"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const template = seedTemplates.find(t => t.id === id);

  // ── Builder state ──
  const [name, setName] = useState(template?.name ?? 'Untitled Template');
  const [editingName, setEditingName] = useState(false);
  const [version, setVersion] = useState(template?.version ?? '1.0');
  const [status, setStatus] = useState<TemplateStatus>(template?.status ?? 'Draft');
  const [sections, setSections] = useState<BuilderSection[]>(SEED_SECTIONS);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['sec1', 'sec2']));
  const [maturityLevels, setMaturityLevels] = useState<MaturityRow[]>(DEFAULT_MATURITY);
  const [targetScore, setTargetScore] = useState(70);
  const [selection, setSelection] = useState<Selection>({ kind: 'scoring' });
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // ── Dialog ──
  const [activateOpen, setActivateOpen] = useState(false);

  // ── DnD ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const locked = status === 'Active' || status === 'Archived';

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
    setSelection({ kind: 'section', sectionId: newSec.id });
  };

  const deleteSection = (sId: string) => {
    setSections(prev => prev.filter(s => s.id !== sId));
    setSelection({ kind: 'scoring' });
  };

  const updateSection = (sId: string, patch: Partial<BuilderSection>) => {
    setSections(prev => prev.map(s => s.id === sId ? { ...s, ...patch } : s));
  };

  const addQuestion = (sId: string) => {
    const q = blankQuestion(sId);
    setSections(prev => prev.map(s => s.id === sId ? { ...s, questions: [...s.questions, q] } : s));
    setExpandedSections(prev => new Set([...prev, sId]));
    setSelection({ kind: 'question', sectionId: sId, questionId: q.id });
  };

  const deleteQuestion = (sId: string, qId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sId ? { ...s, questions: s.questions.filter(q => q.id !== qId) } : s
    ));
    setSelection({ kind: 'section', sectionId: sId });
  };

  const updateQuestion = (sId: string, qId: string, patch: Partial<BuilderQuestion>) => {
    setSections(prev => prev.map(s =>
      s.id === sId
        ? { ...s, questions: s.questions.map(q => q.id === qId ? { ...q, ...patch } : q) }
        : s
    ));
  };

  const handleSaveDraft = () => {
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  };

  const handleActivateConfirm = () => {
    setStatus('Active');
    // Bump patch version on activate
    const parts = version.split('.').map(Number);
    parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
    setVersion(parts.join('.'));
    setActivateOpen(false);
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
    const overType = over.data.current?.type;

    if (activeType === 'section' && overType === 'section') {
      setSections(prev => {
        const oldIdx = prev.findIndex(s => s.id === active.id);
        const newIdx = prev.findIndex(s => s.id === over.id);
        return oldIdx !== -1 && newIdx !== -1 ? arrayMove(prev, oldIdx, newIdx) : prev;
      });
    } else if (activeType === 'question') {
      const sectionId = active.data.current?.sectionId as string;
      setSections(prev => prev.map(s => {
        if (s.id !== sectionId) return s;
        const oldIdx = s.questions.findIndex(q => q.id === active.id);
        const newIdx = s.questions.findIndex(q => q.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return s;
        return { ...s, questions: arrayMove(s.questions, oldIdx, newIdx) };
      }));
    }
  };

  // ── Derive selected item ──
  const selectedSection = selection.kind === 'section' || selection.kind === 'question'
    ? sections.find(s => s.id === (selection as { sectionId: string }).sectionId)
    : undefined;
  const selectedQuestion = selection.kind === 'question'
    ? selectedSection?.questions.find(q => q.id === (selection as { questionId: string }).questionId)
    : undefined;

  // ── Total questions count ──
  const totalQ = sections.reduce((n, s) => n + s.questions.length, 0);

  if (!template) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Template not found.</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link to="/categories">← Back to Categories</Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">

        {/* ── Toolbar ── */}
        <header className="flex h-13 shrink-0 items-center justify-between border-b bg-background px-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <Link to="/categories"><ArrowLeft size={15} /></Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Categories</TooltipContent>
            </Tooltip>

            {/* Editable template name */}
            {editingName && !locked ? (
              <Input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
                className="h-7 text-sm font-semibold w-64"
              />
            ) : (
              <button
                onClick={() => !locked && setEditingName(true)}
                className={`text-sm font-semibold text-foreground truncate max-w-xs ${!locked ? 'hover:text-primary cursor-text' : 'cursor-default'}`}
                title={locked ? undefined : 'Click to rename'}
              >
                {name}
              </button>
            )}

            <span className="text-xs font-mono text-muted-foreground shrink-0">v{version}</span>

            <Badge variant={status === 'Active' ? 'success' : status === 'Archived' ? 'secondary' : 'outline'}>
              {status}
            </Badge>

            {locked && (
              <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 shrink-0">
                <Lock size={11} /> Frozen — read only
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground hidden sm:block">
              {sections.length} sections · {totalQ} questions
            </span>

            {savedAt && (
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 animate-in fade-in">
                <Check size={11} /> Saved
              </span>
            )}

            {!locked && (
              <>
                <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                  <Save size={13} className="mr-1.5" /> Save Draft
                </Button>
                <Button size="sm" onClick={() => setActivateOpen(true)}>
                  <Zap size={13} className="mr-1.5" /> Activate
                </Button>
              </>
            )}
          </div>
        </header>

        {/* ── Body: sidebar + right panel ── */}
        <div className="flex flex-1 min-h-0">

          {/* Left sidebar — section tree */}
          <aside className="w-[260px] shrink-0 flex flex-col border-r bg-muted/20 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {sections.map(section => {
                    const selQ = selection.kind === 'question' && (selection as { sectionId: string }).sectionId === section.id
                      ? (selection as { questionId: string }).questionId
                      : undefined;
                    return (
                      <SortableSectionRow
                        key={section.id}
                        section={section}
                        expanded={expandedSections.has(section.id)}
                        selected={selection.kind === 'section' && (selection as { sectionId: string }).sectionId === section.id}
                        selectedQuestionId={selQ}
                        locked={locked}
                        onToggleExpand={() => toggleExpanded(section.id)}
                        onSelect={() => setSelection({ kind: 'section', sectionId: section.id })}
                        onSelectQuestion={qId => setSelection({ kind: 'question', sectionId: section.id, questionId: qId })}
                        onDelete={() => deleteSection(section.id)}
                        onDeleteQuestion={qId => deleteQuestion(section.id, qId)}
                      >
                        {null}
                      </SortableSectionRow>
                    );
                  })}
                </SortableContext>

                <DragOverlay>
                  {activeDragId && (
                    <div className="rounded-lg bg-white border border-primary shadow-lg px-3 py-2 text-xs font-medium opacity-90">
                      {sections.find(s => s.id === activeDragId)?.name
                        ?? sections.flatMap(s => s.questions).find(q => q.id === activeDragId)?.text
                        ?? 'Dragging…'}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>

              {sections.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
                  No sections yet. Add one below.
                </p>
              )}
            </div>

            {/* Sidebar footer */}
            <div className="shrink-0 border-t p-3 space-y-1.5">
              {!locked && (
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addSection}>
                  <Plus size={13} className="mr-1.5" /> Add Section
                </Button>
              )}
              <button
                onClick={() => setSelection({ kind: 'scoring' })}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  selection.kind === 'scoring'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <BarChart2 size={13} /> Scoring Model
              </button>
            </div>
          </aside>

          {/* Right panel */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-6">
              {selection.kind === 'scoring' && (
                <ScoringPanel
                  maturityLevels={maturityLevels}
                  targetScore={targetScore}
                  locked={locked}
                  onChangeLevel={(id, patch) =>
                    setMaturityLevels(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
                  }
                  onChangeTarget={setTargetScore}
                />
              )}

              {selection.kind === 'section' && selectedSection && (
                <SectionForm
                  section={selectedSection}
                  totalSections={sections.length}
                  locked={locked}
                  onChange={patch => updateSection(selectedSection.id, patch)}
                  onAddQuestion={() => addQuestion(selectedSection.id)}
                />
              )}

              {selection.kind === 'question' && selectedQuestion && selectedSection && (
                <QuestionForm
                  question={selectedQuestion}
                  locked={locked}
                  onChange={patch => updateQuestion(selectedSection.id, selectedQuestion.id, patch)}
                />
              )}

              {/* Empty state */}
              {!selectedSection && !selectedQuestion && selection.kind !== 'scoring' && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <p className="text-sm text-muted-foreground">Select a section or question from the sidebar to edit it.</p>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ── Activate Confirmation Dialog ── */}
        <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
          <DialogContent hideClose>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                Activate Template?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                This will <strong>freeze the template</strong> — no further edits can be made to this version.
                A new version (<strong>v{(parseFloat(version) + 0.1).toFixed(1)}</strong>) will be created if you need to make changes later.
              </DialogDescription>
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                Events already using this template will continue working. New events will reference this activated version.
              </div>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">Cancel</Button>
              </DialogClose>
              <Button size="sm" onClick={handleActivateConfirm}>
                <Zap size={13} className="mr-1.5" /> Yes, Activate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
