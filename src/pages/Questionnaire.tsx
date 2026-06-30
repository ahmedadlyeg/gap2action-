import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronDown, ChevronRight, ChevronLeft, X, Paperclip,
  CheckCircle2, Check, LogOut, Save, Send, Home, Eye, AlertTriangle, LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import { getEvent, getTemplateSections, saveSubmission, getReturnFeedback, saveRespondentAction, getRespondentAction } from '@/services/store';
import { eventsApi, submissionsApi, templatesApi, type ApiEvent, type ApiTemplate } from '@/services/api';
import { cn } from '@/lib/utils';
import { scoreAnswer } from '@/utils/scoring';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = 'single-choice' | 'multi-choice' | 'rating-scale' | 'yes-no' | 'free-text' | 'yes-no-partial' | 'percentage' | 'frequency';
type AnswerValue = string | string[] | number | null;

interface QuestionOption { id: string; text: string }

interface QuestionnaireQuestion {
  id: string;
  text: string;
  guidance?: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  minLabel?: string;
  maxLabel?: string;
}

interface QuestionnaireSection {
  id: string;
  name: string;
  description: string;
  questions: QuestionnaireQuestion[];
}

interface EvidenceFile {
  id: string;
  name: string;
  size: string;
}

// ─── Mock template content ────────────────────────────────────────────────────

const SECTIONS: QuestionnaireSection[] = [
  {
    id: 'sec1',
    name: 'Strategy & Planning',
    description: "Assess the alignment of Enterprise Architecture with the organisation's strategic goals and long-term planning horizon.",
    questions: [
      {
        id: 'q1-1',
        text: 'How well is the EA strategy aligned with the overall business strategy?',
        guidance: 'Consider documented strategic plans, EA roadmaps, and the level of executive sponsorship for EA initiatives. Look for evidence of joint planning sessions between EA and business leadership.',
        type: 'single-choice',
        required: true,
        options: [
          { id: 'o1', text: 'Fully aligned — documented, approved, and reviewed at least quarterly' },
          { id: 'o2', text: 'Partially aligned — some linkage exists but is not formally documented' },
          { id: 'o3', text: 'Minimal alignment — EA operates mostly independently of business strategy' },
          { id: 'o4', text: 'No alignment — an EA strategy does not exist or is disconnected from business goals' },
        ],
      },
      {
        id: 'q1-2',
        text: 'Which of the following strategic planning artefacts does your EA team actively maintain?',
        guidance: 'Select all that apply. "Actively maintain" means the artefact is reviewed and updated at least annually with documented owner accountability.',
        type: 'multi-choice',
        required: true,
        options: [
          { id: 'o1', text: 'EA Roadmap (3–5 year horizon)' },
          { id: 'o2', text: 'Current State Architecture (as-is inventory)' },
          { id: 'o3', text: 'Target State Architecture (to-be vision)' },
          { id: 'o4', text: 'Transition Architecture (gap and migration plan)' },
          { id: 'o5', text: 'Architecture Principles Register' },
        ],
      },
      {
        id: 'q1-3',
        text: 'Rate the overall maturity of your current EA roadmap.',
        guidance: 'Consider timeframe coverage, milestone clarity, dependency mapping, and the level of cross-functional stakeholder buy-in and sign-off.',
        type: 'rating-scale',
        required: true,
        minLabel: 'No roadmap exists',
        maxLabel: 'Fully optimised, reviewed quarterly',
      },
      {
        id: 'q1-4',
        text: 'Describe any strategic planning challenges your EA function currently faces.',
        guidance: 'Focus on systemic or structural barriers rather than one-off issues. Your response will be used for qualitative gap analysis alongside the scored questions.',
        type: 'free-text',
        required: true,
      },
    ],
  },
  {
    id: 'sec2',
    name: 'Architecture Governance',
    description: 'Evaluate the governance structures, review processes, compliance mechanisms, and decision-making effectiveness in your architecture practice.',
    questions: [
      {
        id: 'q2-1',
        text: 'Does your organisation have a formal Architecture Review Board (ARB) or equivalent governance body?',
        guidance: 'A formal ARB has a documented charter, defined membership, a regular meeting cadence, and publicly accessible records of decisions and exceptions.',
        type: 'yes-no',
        required: true,
      },
      {
        id: 'q2-2',
        text: 'Rate the effectiveness of your current architecture governance process.',
        guidance: 'Consider consistency of enforcement across projects and business units, speed of decision-making, quality of documentation, and stakeholder confidence in the process.',
        type: 'rating-scale',
        required: true,
        minLabel: 'No governance process',
        maxLabel: 'Highly effective, consistently enforced',
      },
      {
        id: 'q2-3',
        text: 'Describe the exception-handling process when a project does not comply with architecture standards.',
        guidance: 'A mature process includes documented escalation paths, time-bound waivers with risk acceptance, remediation tracking, and post-exception review.',
        type: 'free-text',
        required: true,
      },
    ],
  },
  {
    id: 'sec3',
    name: 'Technology & Data',
    description: 'Assess the maturity of technology portfolio management, data architecture practices, and the coverage of documented target architectures across key domains.',
    questions: [
      {
        id: 'q3-1',
        text: 'Does your organisation maintain a current and authoritative application portfolio inventory?',
        guidance: 'The inventory should include lifecycle status (current, invest, migrate, retire), business ownership, integration dependencies, and mapping to business capabilities.',
        type: 'yes-no',
        required: true,
      },
      {
        id: 'q3-2',
        text: 'Rate the maturity of your data architecture and data governance practices.',
        guidance: 'Consider data ownership assignment, data quality standards, metadata management, master data management, and the existence of an approved enterprise data model.',
        type: 'rating-scale',
        required: true,
        minLabel: 'Ad hoc, undocumented',
        maxLabel: 'Enterprise-wide, formally governed',
      },
      {
        id: 'q3-3',
        text: 'Which technology domains have documented and approved target architectures?',
        guidance: 'Select all domains where a documented, approved target architecture exists, is actively referenced in project decisions, and is reviewed annually.',
        type: 'multi-choice',
        required: true,
        options: [
          { id: 'o1', text: 'Application / Software Architecture' },
          { id: 'o2', text: 'Data & Analytics Architecture' },
          { id: 'o3', text: 'Infrastructure & Cloud Architecture' },
          { id: 'o4', text: 'Security & Identity Architecture' },
          { id: 'o5', text: 'Integration & API Architecture' },
          { id: 'o6', text: 'None — no documented target architectures exist' },
        ],
      },
      {
        id: 'q3-4',
        text: 'Provide any additional context about your technology landscape relevant to this assessment.',
        guidance: 'Highlight unique constraints, recent major transformations, upcoming changes, or legacy debt that may affect the maturity scores above.',
        type: 'free-text',
        required: false,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isAnswered(q: QuestionnaireQuestion, answers: Record<string, AnswerValue>): boolean {
  if (!q.required) return true;
  const v = answers[q.id];
  if (v === null || v === undefined) return false;
  if (q.type === 'multi-choice') return Array.isArray(v) && v.length > 0;
  if (q.type === 'free-text') return typeof v === 'string' && v.trim().length > 0;
  if (q.type === 'rating-scale') return typeof v === 'number' && v >= 1;
  if (q.type === 'percentage') return typeof v === 'number' && v >= 0;
  return typeof v === 'string' && v.length > 0;  // yes-no, yes-no-partial, frequency, single-choice
}

function sectionStatus(section: QuestionnaireSection, answers: Record<string, AnswerValue>): 'empty' | 'partial' | 'complete' {
  const required = section.questions.filter(q => q.required);
  const answered = required.filter(q => isAnswered(q, answers)).length;
  if (answered === 0) return 'empty';
  if (answered === required.length) return 'complete';
  return 'partial';
}

function formatRelativeSaved(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  return `${mins} minutes ago`;
}

// ─── Completion Dot ───────────────────────────────────────────────────────────

function CompletionDot({ status }: { status: 'empty' | 'partial' | 'complete' }) {
  if (status === 'complete') {
    return (
      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
        <Check size={11} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'partial') {
    return (
      <div className="relative h-5 w-5 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-primary" />
        <div
          className="absolute inset-0 rounded-full bg-primary"
          style={{ clipPath: 'inset(0 50% 0 0)' }}
        />
      </div>
    );
  }
  return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
}

// ─── Guidance Panel ───────────────────────────────────────────────────────────

function GuidancePanel({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Guidance notes
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Evidence Upload ──────────────────────────────────────────────────────────

function EvidenceUpload({
  questionId,
  files,
  onAdd,
  onRemove,
}: {
  questionId: string;
  files: EvidenceFile[];
  onAdd: (qId: string, newFiles: EvidenceFile[]) => void;
  onRemove: (qId: string, fileId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const added: EvidenceFile[] = Array.from(e.target.files).map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: formatFileSize(f.size),
    }));
    onAdd(questionId, added);
    e.target.value = '';
  };

  return (
    <div className="mt-4 space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleChange}
      />
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map(f => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs"
            >
              <Paperclip size={12} className="text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-foreground">{f.name}</span>
              <span className="text-muted-foreground shrink-0">{f.size}</span>
              <button
                type="button"
                onClick={() => onRemove(questionId, f.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip size={12} className="mr-1.5" />
        Add Evidence
      </Button>
    </div>
  );
}

// ─── Question Renderers ───────────────────────────────────────────────────────

function SingleChoice({
  question,
  value,
  onChange,
}: { question: QuestionnaireQuestion; value: AnswerValue; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2.5 mt-4">
      {(question.options ?? []).map(opt => {
        const selected = value === opt.id;
        return (
          <label
            key={opt.id}
            className={cn(
              'flex items-start gap-3.5 rounded-xl border p-4 cursor-pointer transition-all select-none',
              selected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
            )}
          >
            <span className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
            )}>
              {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <input
              type="radio"
              className="sr-only"
              checked={selected}
              onChange={() => onChange(opt.id)}
            />
            <span className="text-sm text-foreground leading-relaxed">{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

function MultiChoice({
  question,
  value,
  onChange,
}: { question: QuestionnaireQuestion; value: AnswerValue; onChange: (v: string[]) => void }) {
  const selected = (Array.isArray(value) ? value : []) as string[];

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id];
    onChange(next);
  };

  return (
    <div className="space-y-2.5 mt-4">
      {(question.options ?? []).map(opt => {
        const checked = selected.includes(opt.id);
        return (
          <label
            key={opt.id}
            className={cn(
              'flex items-start gap-3.5 rounded-xl border p-4 cursor-pointer transition-all select-none',
              checked
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
            )}
          >
            <span className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
              checked ? 'border-primary bg-primary' : 'border-muted-foreground/40',
            )}>
              {checked && <Check size={10} className="text-white" strokeWidth={3} />}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() => toggle(opt.id)}
            />
            <span className="text-sm text-foreground leading-relaxed">{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

function RatingScale({
  question,
  value,
  onChange,
}: { question: QuestionnaireQuestion; value: AnswerValue; onChange: (v: number) => void }) {
  const selected = typeof value === 'number' ? value : null;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(level => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              'flex-1 rounded-xl border-2 py-5 text-lg font-bold transition-all',
              selected === level
                ? 'border-primary bg-primary text-white shadow-md scale-105'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/40',
            )}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{question.minLabel ?? '1 — Low'}</span>
        <span>{question.maxLabel ?? '5 — High'}</span>
      </div>
    </div>
  );
}

function YesNo({
  value,
  onChange,
}: { value: AnswerValue; onChange: (v: string) => void }) {
  const selected = typeof value === 'string' ? value : null;

  return (
    <div className="flex gap-4 mt-5">
      {(['yes', 'no'] as const).map(opt => {
        const active = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'flex-1 rounded-xl border-2 py-6 text-base font-semibold transition-all',
              opt === 'yes'
                ? active
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md'
                  : 'border-border text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50/50'
                : active
                  ? 'border-red-400 bg-red-50 text-red-700 shadow-md'
                  : 'border-border text-muted-foreground hover:border-red-300 hover:bg-red-50/50',
            )}
          >
            {opt === 'yes' ? '✓  Yes' : '✕  No'}
          </button>
        );
      })}
    </div>
  );
}

function FreeTextAnswer({
  value,
  onChange,
}: { value: AnswerValue; onChange: (v: string) => void }) {
  const text = typeof value === 'string' ? value : '';
  const MAX = 2000;

  return (
    <div className="relative mt-4">
      <Textarea
        value={text}
        onChange={e => onChange(e.target.value.slice(0, MAX))}
        placeholder="Type your response here…"
        rows={5}
        className="pr-16 resize-y"
      />
      <span className={cn(
        'absolute bottom-2.5 right-3 text-[11px] pointer-events-none',
        text.length > MAX * 0.9 ? 'text-amber-600' : 'text-muted-foreground',
      )}>
        {text.length}/{MAX}
      </span>
    </div>
  );
}

// ─── Yes / No / Partial ──────────────────────────────────────────────────────

function YesNoPartial({
  value,
  onChange,
}: { value: AnswerValue; onChange: (v: string) => void }) {
  const selected = typeof value === 'string' ? value : null;
  const opts = [
    { key: 'yes', label: '✓  Yes', active: 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md', hover: 'hover:border-emerald-300 hover:bg-emerald-50/50' },
    { key: 'partial', label: '~  Partial', active: 'border-amber-400 bg-amber-50 text-amber-700 shadow-md', hover: 'hover:border-amber-300 hover:bg-amber-50/50' },
    { key: 'no', label: '✕  No', active: 'border-red-400 bg-red-50 text-red-700 shadow-md', hover: 'hover:border-red-300 hover:bg-red-50/50' },
  ] as const;

  return (
    <div className="flex gap-3 mt-5">
      {opts.map(opt => {
        const active = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'flex-1 rounded-xl border-2 py-5 text-sm font-semibold transition-all',
              active ? opt.active : `border-border text-muted-foreground ${opt.hover}`,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Percentage Slider ────────────────────────────────────────────────────────

function PercentageInput({
  value,
  onChange,
}: { value: AnswerValue; onChange: (v: number) => void }) {
  const pct = typeof value === 'number' ? value : 0;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-primary h-2 cursor-pointer"
        />
        <div className="flex items-center gap-1 w-20 shrink-0">
          <input
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={e => onChange(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center font-semibold text-foreground"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ─── Frequency ────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { key: 'never', label: 'Never', color: 'border-red-400 bg-red-50 text-red-700' },
  { key: 'rarely', label: 'Rarely', color: 'border-orange-400 bg-orange-50 text-orange-700' },
  { key: 'sometimes', label: 'Sometimes', color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { key: 'often', label: 'Often', color: 'border-sky-400 bg-sky-50 text-sky-700' },
  { key: 'always', label: 'Always', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
] as const;

function FrequencyInput({
  value,
  onChange,
}: { value: AnswerValue; onChange: (v: string) => void }) {
  const selected = typeof value === 'string' ? value : null;

  return (
    <div className="flex gap-2 mt-5 flex-wrap">
      {FREQUENCY_OPTIONS.map(opt => {
        const active = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'flex-1 min-w-[80px] rounded-xl border-2 py-4 text-xs font-semibold transition-all',
              active
                ? `${opt.color} shadow-md`
                : 'border-border text-muted-foreground hover:bg-muted/40',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Question Block ───────────────────────────────────────────────────────────

function QuestionBlock({
  question,
  index,
  total,
  answers,
  evidence,
  onAnswer,
  onAddEvidence,
  onRemoveEvidence,
}: {
  question: QuestionnaireQuestion;
  index: number;
  total: number;
  answers: Record<string, AnswerValue>;
  evidence: Record<string, EvidenceFile[]>;
  onAnswer: (qId: string, value: AnswerValue) => void;
  onAddEvidence: (qId: string, files: EvidenceFile[]) => void;
  onRemoveEvidence: (qId: string, fileId: string) => void;
}) {
  const value = answers[question.id] ?? null;
  const answered = isAnswered(question, answers);

  return (
    <div className={cn(
      'rounded-2xl border bg-card p-6 transition-shadow',
      answered ? 'border-border' : 'border-border',
    )}>
      {/* Question header */}
      <div className="flex items-start gap-3 mb-1">
        <span className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5',
          answered ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
        )}>
          {answered ? <Check size={13} strokeWidth={3} /> : index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-relaxed">{question.text}</p>
            {!question.required && (
              <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">Optional</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Question {index + 1} of {total}
          </p>
        </div>
      </div>

      {/* Guidance */}
      {question.guidance && <GuidancePanel text={question.guidance} />}

      {/* Answer input */}
      <div className="mt-1">
        {question.type === 'single-choice' && (
          <SingleChoice
            question={question}
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'multi-choice' && (
          <MultiChoice
            question={question}
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'rating-scale' && (
          <RatingScale
            question={question}
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'yes-no' && (
          <YesNo
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'yes-no-partial' && (
          <YesNoPartial
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'percentage' && (
          <PercentageInput
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'frequency' && (
          <FrequencyInput
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
        {question.type === 'free-text' && (
          <FreeTextAnswer
            value={value}
            onChange={v => onAnswer(question.id, v)}
          />
        )}
      </div>

      {/* Evidence */}
      <EvidenceUpload
        questionId={question.id}
        files={evidence[question.id] ?? []}
        onAdd={onAddEvidence}
        onRemove={onRemoveEvidence}
      />
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ eventName, onHome, revisionMode }: { eventName: string; onHome: () => void; revisionMode?: boolean }) {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-background px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-6">
        <CheckCircle2 size={40} className="text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-3">
        {revisionMode ? 'Revised Submission Sent!' : 'Assessment Submitted!'}
      </h1>
      <p className="text-base text-muted-foreground max-w-md leading-relaxed mb-2">
        Thank you for completing <strong>{eventName}</strong>.
      </p>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-8">
        {revisionMode
          ? 'Your revised submission has been sent to the assessor for review.'
          : 'The assessor will review and validate your submission. You will be notified once the assessment is closed.'}
      </p>
      <Button onClick={onHome}>
        <Home size={15} className="mr-2" /> Return to Dashboard
      </Button>
    </div>
  );
}

// ─── Main Questionnaire ───────────────────────────────────────────────────────

function buildSections(eventId: string | undefined): QuestionnaireSection[] {
  if (!eventId) return SECTIONS;
  const event = getEvent(eventId);
  if (!event) return SECTIONS;
  const stored = getTemplateSections(event.templateId);
  if (!stored) {
    console.warn('No template sections found, using defaults');
    return SECTIONS;
  }
  return stored.map(sec => ({
    id: sec.id,
    name: sec.name,
    description: sec.description,
    questions: sec.questions.map(q => ({
      id: q.id,
      text: q.text,
      guidance: q.guidance || undefined,
      type: q.type,
      required: q.required,
      options: (q.type === 'single-choice' || q.type === 'multi-choice')
        ? q.options.map(o => ({ id: o.id, text: o.text }))
        : undefined,
      minLabel: q.minLabel || undefined,
      maxLabel: q.maxLabel || undefined,
    })),
  }));
}

export function Questionnaire() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { pathname } = window.location;
  const navigate = useNavigate();
  const { user } = useAuth();
  // isPreview: explicit query param OR the /templates/:id/preview route (path ends with /preview)
  const isPreview = searchParams.get('mode') === 'preview' || pathname.endsWith('/preview');
  const userId = user?.id ?? 'u1';

  // ── API data ──
  const [apiEvent, setApiEvent] = useState<ApiEvent | null>(null);
  // Populated when accessed via /templates/:id/preview (no event exists yet)
  const [templatePreview, setTemplatePreview] = useState<ApiTemplate | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoadingData(true);
    eventsApi.get(id)
      .then(ev => {
        setApiEvent(ev);
        // Pre-load saved answers from API
        return submissionsApi.get(id, userId).catch(() => null);
      })
      .then(sub => {
        if (sub?.answers) {
          setAnswers(sub.answers as Record<string, AnswerValue>);
          setLastSaved(sub.submittedAt ? new Date(sub.submittedAt) : new Date());
        }
        // Detect revision mode from submission status
        if (sub && (sub as unknown as { status?: string }).status === 'Returned_for_Revision') {
          setIsRevisionMode(true);
        }
        setLoadingData(false);
      })
      .catch(() => {
        // id may be a template ID (preview from TemplateBuilder) — try loading it as a template
        if (isPreview) {
          templatesApi.get(id)
            .then(tpl => setTemplatePreview(tpl))
            .catch(() => {
              // Final fallback: store
              const storeEvent = getEvent(id);
              if (storeEvent) setApiEvent(storeEvent as unknown as ApiEvent);
            })
            .finally(() => setLoadingData(false));
        } else {
          // Normal event fallback: try store for offline/dev
          const storeEvent = getEvent(id);
          if (storeEvent) setApiEvent(storeEvent as unknown as ApiEvent);
          setLoadingData(false);
        }
      });
  }, [id, userId, isPreview]);

  // Sections source priority:
  //  1. Event template sections (event-based questionnaire)
  //  2. Direct template API sections (template preview with saved sections)
  //  3. Local store sections (template preview, unsaved or API race)
  //  4. buildSections fallback (event-based offline/mock)
  const apiSections = apiEvent?.template?.sections ?? (templatePreview?.sections?.length ? templatePreview.sections : null);
  // For template preview, also check local store — covers unsaved builder changes and API race
  const localStoreSections = (!apiEvent && isPreview && id) ? getTemplateSections(id) : null;
  const rawSections = apiSections ?? localStoreSections ?? null;

  function mapSections(raw: any[]): QuestionnaireSection[] {
    return raw.map(sec => ({
      id: sec.id,
      name: sec.name,
      description: sec.description,
      questions: sec.questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        guidance: q.guidance || undefined,
        type: q.type as QuestionnaireQuestion['type'],
        required: q.required,
        options: (q.type === 'single-choice' || q.type === 'multi-choice')
          ? q.options.map((o: any) => ({ id: o.id, text: o.text }))
          : undefined,
        minLabel: q.minLabel || undefined,
        maxLabel: q.maxLabel || undefined,
      })),
    }));
  }

  const sections: QuestionnaireSection[] = rawSections ? mapSections(rawSections) : buildSections(id);

  // Section assignment — all visible for now (per-user assignment is a future feature)
  const visibleSections = sections;

  // Template cover data (works for both event-based and direct template preview)
  const cover = apiEvent?.template ?? templatePreview;
  const hasCover = !!(cover?.tagline || cover?.definition || cover?.coverImageUrl || cover?.explanation);

  const storageKey = `g2a-questionnaire-${id}`;

  // Revision mode — detected from API submission status or store fallback
  const storeReturnFeedback = !isPreview ? getReturnFeedback(id ?? '', userId) : null;
  const [isRevisionMode, setIsRevisionMode] = useState(storeReturnFeedback !== null);
  const returnFeedback = storeReturnFeedback;

  // ── State ──
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    // Start empty — API load fills answers in the useEffect above
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, AnswerValue>) : {};
    } catch { return {}; }
  });
  const [evidence, setEvidence] = useState<Record<string, EvidenceFile[]>>({});
  const [currentIdx, setCurrentIdx] = useState(() => hasCover ? -1 : 0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [, forceTimeUpdate] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [revisionSubmitted, setRevisionSubmitted] = useState(false);

  // Keep answers ref current for the auto-save interval (avoids stale closure)
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Evidence ref (keeps autosave closure fresh) and key
  const evidenceRef = useRef(evidence);
  useEffect(() => { evidenceRef.current = evidence; }, [evidence]);
  const evidenceKey = `g2a-evidence-${id}-${userId}`;

  // Per-framework score calculation
  const calculateScore = (ans: Record<string, AnswerValue>): number => {
    const allQs = visibleSections.flatMap(s => s.questions);
    if (allQs.length === 0) return 0;
    const scores = allQs.map(q => scoreAnswer(q as unknown as import('@/types').BuilderQuestion, ans[q.id] ?? null));
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  // ── Auto-save every 30s ──
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!id) return;
      setSaving(true);
      const current = answersRef.current;
      localStorage.setItem(storageKey, JSON.stringify(current));
      try {
        await submissionsApi.save(id, current);
        setLastSaved(new Date());
      } catch {
        // Fallback: save to store
        const answered = visibleSections.flatMap(s => s.questions).filter(q => isAnswered(q, current)).length;
        const total = visibleSections.flatMap(s => s.questions.filter(q => q.required)).length;
        const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
        saveSubmission(id, userId, { eventId: id, userId, answers: current, evidence: evidenceRef.current, completionPct: pct, status: 'In Progress' });
        setLastSaved(new Date());
      } finally {
        setSaving(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [storageKey, id, visibleSections]);

  // ── Refresh "X minutes ago" text every 60s ──
  useEffect(() => {
    const interval = setInterval(() => forceTimeUpdate(n => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Scroll to top when section changes ──
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [currentIdx]);

  // ── Handlers ──
  const handleAnswer = useCallback((qId: string, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  }, []);

  const handleAddEvidence = useCallback((qId: string, files: EvidenceFile[]) => {
    setEvidence(prev => ({ ...prev, [qId]: [...(prev[qId] ?? []), ...files] }));
  }, []);

  const handleRemoveEvidence = useCallback((qId: string, fileId: string) => {
    setEvidence(prev => {
      const next = { ...prev, [qId]: (prev[qId] ?? []).filter(f => f.id !== fileId) };
      evidenceRef.current = next;
      try { localStorage.setItem(`g2a-evidence-${id}-${userId}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [id, userId]);

  const manualSave = async () => {
    if (!id) return;
    setSaving(true);
    localStorage.setItem(storageKey, JSON.stringify(answers));
    try {
      await submissionsApi.save(id, answers);
      setLastSaved(new Date());
    } catch {
      const pct = visibleSections.flatMap(s => s.questions.filter(q => q.required)).length > 0
        ? Math.round(visibleSections.flatMap(s => s.questions).filter(q => isAnswered(q, answers)).length
            / visibleSections.flatMap(s => s.questions.filter(q => q.required)).length * 100)
        : 0;
      saveSubmission(id, userId, { eventId: id, userId, answers, completionPct: pct, status: 'In Progress' });
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // First save current answers, then submit
      await submissionsApi.save(id, answers);
      await submissionsApi.submit(id);
      if (isRevisionMode) setRevisionSubmitted(true);
    } catch {
      // Fallback: local store submit
      const now = new Date().toISOString();
      const finalScore = calculateScore(answers);
      saveSubmission(id, userId, {
        eventId: id, userId,
        answers, evidence: evidenceRef.current,
        completionPct: 100, status: 'Submitted',
        score: finalScore, submittedAt: now,
      });
      if (isRevisionMode) {
        const existingAction = getRespondentAction(id, userId);
        saveRespondentAction(id, userId, {
          status: 'Validated',
          returnCount: existingAction?.returnCount ?? 0,
          actionAt: now,
        });
        setRevisionSubmitted(true);
      }
    } finally {
      setSaving(false);
    }
    localStorage.removeItem(storageKey);
    localStorage.removeItem(evidenceKey);
    setSubmitted(true);
    setSubmitOpen(false);
  };

  // ── Derived ──
  // event alias — prefer API, fall back to local store (for preview/offline)
  const event = apiEvent ?? (id ? getEvent(id) : undefined);

  // Show spinner while initial API data loads
  if (loadingData && !event) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground text-sm animate-pulse">Loading assessment…</div>
      </div>
    );
  }

  const currentSection = currentIdx >= 0 ? visibleSections[currentIdx] : undefined;
  const allComplete = visibleSections.every(s => s.questions.every(q => isAnswered(q, answers)));
  const isLast = currentIdx === visibleSections.length - 1;
  const isFirst = currentIdx === 0;
  const eventName = event?.name ?? templatePreview?.name ?? 'Assessment';
  const dueDate = event?.endDate
    ? new Date(event.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  // ── Success screen ──
  if (submitted) {
    return <SuccessScreen eventName={eventName} onHome={() => navigate('/')} revisionMode={revisionSubmitted} />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">

        {/* ── Preview banner ── */}
        {isPreview && (
          <div className="flex items-center justify-between px-5 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
              <Eye size={13} /> VIEW ONLY — your answers are not being changed
            </div>
            <Link to="/" className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900">
              Back to Home
            </Link>
          </div>
        )}

        {/* ── Top bar ── */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{eventName}</p>
              <p className="text-[11px] text-muted-foreground">Due {dueDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Save indicator — hidden in preview */}
            {!isPreview && (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {saving ? (
                    <>
                      <Save size={12} className="animate-pulse text-primary" />
                      <span>Saving…</span>
                    </>
                  ) : lastSaved ? (
                    <>
                      <Save size={12} />
                      <span>Last saved {formatRelativeSaved(lastSaved)}</span>
                    </>
                  ) : (
                    <span className="opacity-50">Not saved yet</span>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={manualSave} disabled={saving}>
                  Save
                </Button>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                  <Link to="/"><LogOut size={15} /></Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exit to Home</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left sidebar ── */}
          <aside className="w-56 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col">
            <div className="px-4 py-4 border-b">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sections</p>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(
                        visibleSections.reduce((n, s) => n + s.questions.filter(q => isAnswered(q, answers)).length, 0) /
                        Math.max(1, visibleSections.reduce((n, s) => n + s.questions.filter(q => q.required).length, 0)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {visibleSections.reduce((n, s) => n + s.questions.filter(q => isAnswered(q, answers)).length, 0)}/
                  {visibleSections.reduce((n, s) => n + s.questions.filter(q => q.required).length, 0)}
                </span>
              </div>
            </div>

            <nav className="flex-1 p-2 space-y-1">
              {hasCover && (
                <button
                  onClick={() => setCurrentIdx(-1)}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-lg px-3 py-3 text-left transition-colors',
                    currentIdx === -1
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted/60',
                  )}
                >
                  <LayoutTemplate size={18} className="shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Introduction</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Template overview</p>
                  </div>
                </button>
              )}
              {visibleSections.map((section, idx) => {
                const status = sectionStatus(section, answers);
                const active = idx === currentIdx;
                return (
                  <button
                    key={section.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={cn(
                      'w-full flex items-start gap-2.5 rounded-lg px-3 py-3 text-left transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/60',
                    )}
                  >
                    <CompletionDot status={status} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{section.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {section.questions.filter(q => isAnswered(q, answers)).length}/
                        {section.questions.filter(q => q.required).length} required
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ── Main content ── */}
          <main ref={mainRef} className="flex-1 overflow-y-auto">

            {/* ── Revision mode banner ── */}
            {isRevisionMode && !isPreview && (
              <div className="mx-6 mt-6 mb-0 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      This submission was returned for revision
                    </p>
                    {returnFeedback && (
                      <p className="mt-1 text-sm text-amber-700 leading-relaxed">
                        {returnFeedback}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-amber-600">
                      Please review your answers and resubmit when ready.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Cover / intro page ── */}
            {currentIdx === -1 && cover && (
              <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
                {cover.coverImageUrl && (
                  <div className="rounded-2xl overflow-hidden border aspect-video bg-muted">
                    <img
                      src={cover.coverImageUrl}
                      alt={cover.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <h1
                    className="text-3xl font-bold text-foreground"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {cover.name}
                  </h1>
                  {cover.tagline && (
                    <p className="mt-2 text-base text-muted-foreground italic">{cover.tagline}</p>
                  )}
                </div>
                {cover.definition && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">
                      Definition
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cover.definition}</p>
                  </div>
                )}
                {cover.explanation && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">
                      About This Assessment
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cover.explanation}</p>
                  </div>
                )}
                <div className="pt-2">
                  <Button onClick={() => setCurrentIdx(0)}>
                    Start Assessment <ChevronRight size={15} className="ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Section content ── */}
            {currentSection && (
              <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

                {/* Section header */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Section {currentIdx + 1} of {visibleSections.length}
                  </p>
                  <h2 className="text-xl font-bold text-foreground">{currentSection.name}</h2>
                  {currentSection.description && (
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                      {currentSection.description}
                    </p>
                  )}
                </div>

                {/* Question blocks */}
                <div className="space-y-5">
                  {currentSection.questions.map((q, idx) => (
                    <QuestionBlock
                      key={q.id}
                      question={q}
                      index={idx}
                      total={currentSection.questions.length}
                      answers={answers}
                      evidence={evidence}
                      onAnswer={handleAnswer}
                      onAddEvidence={handleAddEvidence}
                      onRemoveEvidence={handleRemoveEvidence}
                    />
                  ))}
                </div>

                {/* Section footer nav */}
                <div className="flex items-center justify-between pt-4 pb-10">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentIdx(i => (hasCover ? i - 1 : Math.max(0, i - 1)))}
                    disabled={isFirst && !hasCover}
                  >
                    <ChevronLeft size={15} className="mr-1.5" /> Previous
                  </Button>

                  {isLast ? (
                    <Button
                      onClick={() => setSubmitOpen(true)}
                      disabled={!allComplete || isPreview}
                    >
                      <Send size={14} className="mr-2" />
                      {isRevisionMode ? 'Resubmit Assessment' : 'Submit Assessment'}
                    </Button>
                  ) : (
                    <Button onClick={() => setCurrentIdx(i => i + 1)}>
                      Next <ChevronRight size={15} className="ml-1.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Submit confirmation dialog ── */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isRevisionMode ? 'Resubmit Assessment' : 'Submit Assessment'}
            </DialogTitle>
            <DialogDescription>
              {isRevisionMode
                ? 'Your revised answers will be sent back to the assessor for final review.'
                : 'Once submitted, your answers will be locked until the assessor reviews them.'
              }
            </DialogDescription>
          </DialogHeader>
          {!allComplete && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>Some required questions are still unanswered. Please complete all sections before submitting.</span>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleConfirmSubmit} disabled={!allComplete}>
              <Send size={14} className="mr-2" />
              {isRevisionMode ? 'Confirm Resubmit' : 'Confirm Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
