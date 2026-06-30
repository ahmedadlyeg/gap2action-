import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, ChevronDown, ChevronRight, CheckCircle2,
  StickyNote, ArrowRight, CalendarDays, RotateCcw,
  Users, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/context/ToastContext';
import type { AssessmentEvent, EventRec, RecConvMessage, RecStatus, Task, TaskEffort } from '@/types';
import { resultsByEventId } from '@/services/resultsMockData';
import { buildEventResults } from '@/utils/scoring';
import { recommendationsApi, tasksApi } from '@/services/api';
import { cn } from '@/lib/utils';

// ─── Mock recommendation data ─────────────────────────────────────────────────

const INITIAL_RECS: Omit<EventRec, 'eventId'>[] = [
  {
    id: 'r1',
    sectionName: 'Technology & Data',
    gapMagnitude: -1.2,
    status: 'Approved',
    originalText:
      'Establish a Technology Portfolio Management (TPM) capability to provide full visibility into the application landscape. Begin with a focused discovery sprint to document all production systems — capturing ownership, business capability alignment, lifecycle status (Invest / Sustain / Migrate / Retire), and integration dependencies. Prioritise rationalisation of applications flagged as legacy or duplicates. Assign a dedicated Portfolio Owner within the EA team responsible for maintaining the inventory on a quarterly cadence. Recommended tooling: ServiceNow ITAM or LeanIX as the system of record.',
    currentText:
      'Establish a Technology Portfolio Management (TPM) capability to provide full visibility into the application landscape. Begin with a focused discovery sprint to document all production systems — capturing ownership, business capability alignment, lifecycle status (Invest / Sustain / Migrate / Retire), and integration dependencies. Prioritise rationalisation of applications flagged as legacy or duplicates. Assign a dedicated Portfolio Owner within the EA team responsible for maintaining the inventory on a quarterly cadence. Recommended tooling: ServiceNow ITAM or LeanIX as the system of record.',
    conversation: [],
  },
  {
    id: 'r2',
    sectionName: 'Architecture Governance',
    gapMagnitude: -0.8,
    status: 'Under Review',
    originalText:
      'Formalise the architecture governance process by establishing an Architecture Review Board (ARB) with a documented charter, defined membership representing Business, IT, Security, and Data domains, and a bi-weekly meeting cadence. Create a tiered review process: major projects (>$500k budget or affecting more than 3 core systems) require full ARB review; minor changes use a lightweight self-assessment checklist. Publish decision records within 5 business days of each ARB session to maintain transparency.',
    currentText:
      'Formalise the architecture governance process with a pragmatic, budget-conscious ARB model. Leverage existing senior roles across Business, IT, and Security rather than adding headcount. Scope the ARB to high-impact projects (>3 core systems affected or >$200k budget); all other changes use an asynchronous self-assessment checklist approved by the EA Lead. Aim to convene the first ARB session within 60 days and establish a monthly cadence. Publish lightweight decision summaries within 5 business days.',
    conversation: [
      {
        id: 'cm1',
        role: 'assessor',
        text: 'Budget is constrained — we cannot add headcount or new tooling costs.',
      },
      {
        id: 'cm2',
        role: 'ai',
        text: "Understood. I've revised the recommendation to avoid new headcount by leveraging existing senior roles. I've also raised the project threshold slightly to reduce review volume, and replaced the formal tooling requirement with an asynchronous checklist the EA Lead can manage in existing collaboration tools. The core governance intent is preserved without additional budget.",
      },
    ],
  },
  {
    id: 'r3',
    sectionName: 'Data Architecture',
    gapMagnitude: -0.6,
    status: 'AI Draft',
    originalText:
      'Develop a Data Architecture maturity roadmap targeting Level 3 (Defined) within 12 months. Key initiatives: (1) Appoint a Data Stewardship Committee or interim Chief Data Officer by end of Q3. (2) Define and publish an enterprise data model covering the top 10 business entities within 90 days. (3) Evaluate and implement a metadata management platform (Collibra, Alation, or equivalent) to catalogue data assets and assign ownership. (4) Establish data quality KPIs and a quarterly reporting cadence for executive review. Estimated effort: 2 FTE for 6 months plus tooling budget of approximately $80k–$120k annually.',
    currentText:
      'Develop a Data Architecture maturity roadmap targeting Level 3 (Defined) within 12 months. Key initiatives: (1) Appoint a Data Stewardship Committee or interim Chief Data Officer by end of Q3. (2) Define and publish an enterprise data model covering the top 10 business entities within 90 days. (3) Evaluate and implement a metadata management platform (Collibra, Alation, or equivalent) to catalogue data assets and assign ownership. (4) Establish data quality KPIs and a quarterly reporting cadence for executive review. Estimated effort: 2 FTE for 6 months plus tooling budget of approximately $80k–$120k annually.',
    conversation: [],
  },
];

// ─── Mock AI revision engine ──────────────────────────────────────────────────

const CANNED: Record<string, Record<string, { revised: string; aiReply: string }>> = {
  r2: {
    'We already tried this': {
      revised:
        "Noting that a previous ARB initiative did not take hold, this revised approach focuses on simpler entry points that address the root causes of past failure. Rather than a formal board, begin with a monthly Architecture Checkpoint — a 90-minute session with 3–4 key decision-makers. Capture decisions in a shared log accessible to all project teams. Once this rhythm is established (typically 3–6 months), evolve it into a lightweight ARB with documented membership and scope. Success metrics: >80% of major projects passing through the checkpoint by end of year.",
      aiReply:
        "I've noted that a similar initiative was attempted before. The revised approach starts much smaller — a monthly checkpoint with a few key people — to build the habit before formalising governance. This is more likely to stick where a heavier ARB structure didn't.",
    },
    'Suggest a lower-effort alternative': {
      revised:
        "As a lower-effort alternative, implement a two-step governance lite model: (1) a weekly 30-minute EA office hours session where project teams can get lightweight architecture input without a formal board, and (2) a simple architecture decision log maintained in Confluence or SharePoint. Designate a single EA Lead as the decision authority for all but the most complex cross-system changes. This can be stood up within 2 weeks and requires no new tooling or headcount.",
      aiReply:
        "Here's a lighter-touch alternative that trades some governance rigour for speed of adoption. It can be operating within 2 weeks versus 60+ days for a full ARB, and requires no new investment.",
    },
    'Make it more specific': {
      revised:
        "Formalise architecture governance through these specific steps:\n\n• Week 1–2: Draft ARB charter; identify 4 members (CIO, Head of IT, EA Lead, Security Lead).\n• Week 3–4: Publish tiered review criteria; build self-assessment checklist in Confluence.\n• Week 5–6: Conduct dry-run ARB review on a live project.\n• Month 2 onward: Monthly ARB sessions; decision records published within 3 business days.\n\nOwner: EA Lead. Escalation path: CIO for decisions requiring >$250k spend. KPI: 90% of qualifying projects reviewed before go-live by Month 6.",
      aiReply:
        "I've broken the recommendation into a specific 6-week implementation plan with named owners, timelines, and a KPI to track adoption. This should make it straightforward to assign actions and measure progress.",
    },
    '__default__': {
      revised:
        'Formalise the architecture governance process with a tiered review model calibrated to your context. Based on your input, the approach has been updated to reflect your team\'s constraints. The ARB should meet monthly (not bi-weekly) to reduce scheduling burden, with the EA Lead acting as single point of contact for self-service reviews. Decision records should be maintained in your existing wiki. First ARB session target: within 45 days of approval.',
      aiReply:
        "I've refined the recommendation based on your context. The key changes are a reduced meeting cadence, a stronger EA Lead role to minimise committee overhead, and alignment with your existing tooling. Let me know if you'd like me to adjust further.",
    },
  },
  r3: {
    'Budget is constrained': {
      revised:
        'Develop a lean Data Architecture roadmap targeting Level 3 within 18 months using existing resources. Zero-cost first steps: (1) Assign data stewardship responsibilities to existing domain leads — no new headcount. (2) Document the top 5 business entities using a free Miro or Confluence data dictionary template within 60 days. (3) Pilot data quality tracking with Excel or Google Sheets before investing in a platform. Defer tooling (Collibra/Alation) until budget is available — aim for Year 2. This approach achieves 60–70% of the maturity uplift at minimal cost.',
      aiReply:
        "Given budget constraints, I've restructured the roadmap to use only existing roles and free/low-cost tools as a first phase. Tooling investment is deferred to Year 2 when ROI from improved data quality can justify the spend.",
    },
    '__default__': {
      revised:
        'Develop a phased Data Architecture maturity roadmap. Based on your context, the revised plan extends the timeline and adjusts scope to reflect your team\'s capacity. Phase 1 (0–6 months): appoint a Data Steward per domain and document the top 5 business entities. Phase 2 (6–12 months): introduce a lightweight metadata catalogue. Phase 3 (12–18 months): establish data quality KPIs and executive reporting. This targets Level 3 maturity within 18 months.',
      aiReply:
        "I've revised the roadmap to be more incremental and capacity-aware based on your input. The three-phase structure lets you demonstrate quick wins before the heavier platform investment.",
    },
  },
};

function getMockRevision(recId: string, nudgeOrMessage: string): { revised: string; aiReply: string } {
  const recMap = CANNED[recId];
  if (recMap) {
    const exact = recMap[nudgeOrMessage];
    if (exact) return exact;
    return recMap['__default__'] ?? CANNED_DEFAULT;
  }
  return CANNED_DEFAULT;
}

const CANNED_DEFAULT = {
  revised:
    "The recommendation has been refined based on your input. The updated version addresses the context you've provided while maintaining alignment with the identified gap. Please review the changes and approve when ready.",
  aiReply:
    "I've updated the recommendation based on your feedback. The key changes reflect the context you shared. Let me know if you'd like further adjustments.",
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RecStatus, { label: string; cls: string; dot: string }> = {
  'AI Draft':     { label: 'AI Draft',     cls: 'bg-slate-100 text-slate-600 border-slate-200',       dot: 'bg-slate-400' },
  'Under Review': { label: 'Under Review', cls: 'bg-blue-100 text-blue-700 border-blue-200',           dot: 'bg-blue-500' },
  'Approved':     { label: 'Approved',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500' },
  'Noted':        { label: 'Noted',        cls: 'bg-muted text-muted-foreground border-border',        dot: 'bg-muted-foreground' },
  'Converted':    { label: 'Converted',    cls: 'bg-violet-100 text-violet-700 border-violet-200',     dot: 'bg-violet-500' },
};

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-4">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  );
}

// ─── Conversation message ─────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: RecConvMessage }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={cn('flex gap-2.5', isAI ? '' : 'flex-row-reverse')}>
      {isAI && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
          <Sparkles size={11} className="text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
        isAI
          ? 'bg-card border border-border text-foreground rounded-tl-sm'
          : 'bg-muted text-foreground rounded-tr-sm',
      )}>
        {msg.text}
      </div>
    </div>
  );
}

// ─── Single Recommendation Card ───────────────────────────────────────────────

const NUDGE_CHIPS = [
  'We already tried this',
  'Budget is constrained',
  'Make it more specific',
  'Suggest a lower-effort alternative',
] as const;

interface RecCardProps {
  rec: EventRec;
  eventId: string;
  onUpdate: (id: string, changes: Partial<EventRec>) => void;
  onNavigateRoadmap?: (recName?: string) => void;
}

function RecCard({ rec, eventId, onUpdate, onNavigateRoadmap }: RecCardProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [dateMode, setDateMode] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [editText, setEditText] = useState(rec.currentText);
  const [editMode, setEditMode] = useState(false);
  const convEndRef = useRef<HTMLDivElement>(null);

  // Sync editText when rec.currentText changes (after AI revision)
  useEffect(() => { setEditText(rec.currentText); }, [rec.currentText]);

  // Auto-scroll conversation
  useEffect(() => {
    convEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rec.conversation, typing]);

  const cfg = STATUS_CFG[rec.status];
  const isApproved = rec.status === 'Approved';
  const isNoted = rec.status === 'Noted';
  const isDimmed = isNoted;
  const hasChanged = rec.currentText !== rec.originalText;

  function sendMessage(text: string) {
    if (!text.trim()) return;

    const assessorMsg: RecConvMessage = { id: `m${Date.now()}`, role: 'assessor', text: text.trim() };
    const newConv = [...rec.conversation, assessorMsg];
    onUpdate(rec.id, {
      conversation: newConv,
      status: rec.status === 'AI Draft' ? 'Under Review' : rec.status,
    });
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const { revised, aiReply } = getMockRevision(rec.id, text.trim());
      const aiMsg: RecConvMessage = { id: `m${Date.now() + 1}`, role: 'ai', text: aiReply };
      onUpdate(rec.id, {
        conversation: [...newConv, aiMsg],
        currentText: revised,
        status: 'Under Review',
      });
      setTyping(false);
    }, 1500);
  }

  function sendDate() {
    if (!dateValue) return;
    const formatted = new Date(dateValue).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    sendMessage(`Needs to happen by ${formatted}`);
    setDateMode(false);
    setDateValue('');
  }

  function saveEdit() {
    onUpdate(rec.id, { currentText: editText });
    setEditMode(false);
  }

  function approve() {
    if (editMode) saveEdit();
    onUpdate(rec.id, { status: 'Approved' });
    recommendationsApi.update(rec.id, { status: 'Approved' }).catch(() => {});
    toast({ title: 'Recommendation approved', variant: 'success' });
  }

  function markNoted() {
    onUpdate(rec.id, { status: 'Noted' });
    recommendationsApi.update(rec.id, { status: 'Noted' }).catch(() => {});
    toast({ title: 'Recommendation noted', variant: 'default' });
  }

  async function convertToTasks() {
    // Check if tasks already exist for this rec via API
    const existing = await tasksApi.list(eventId).catch(() => [] as import('@/services/api').ApiTask[]);
    if (existing.some(t => t.recName === rec.sectionName)) {
      onUpdate(rec.id, { status: 'Converted' });
      recommendationsApi.update(rec.id, { status: 'Converted' }).catch(() => {});
      toast({ title: 'Tasks already exist in Roadmap', description: 'Switching to Roadmap tab…', variant: 'default' });
      onNavigateRoadmap?.();
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const taskTitles: Array<{ title: string; effort: TaskEffort }> = [
      { title: `Define improvement targets: ${rec.sectionName}`, effort: 'Small' },
      { title: `Develop action plan: ${rec.sectionName}`, effort: 'Medium' },
      { title: `Assign workstream lead: ${rec.sectionName}`, effort: 'Small' },
      { title: `Execute improvements: ${rec.sectionName}`, effort: 'Large' },
      { title: `Review and validate progress: ${rec.sectionName}`, effort: 'Medium' },
    ];

    await Promise.all(taskTitles.map(item =>
      tasksApi.create({
        eventId,
        title: item.title,
        description: rec.currentText.slice(0, 200),
        progressNotes: '',
        recName: rec.sectionName,
        gapWeight: Math.abs(rec.gapMagnitude),
        status: 'Not_Started' as const,
        effort: item.effort,
        priority: 'Medium' as const,
        startDate: today,
        dueDate,
        completionPct: 0,
      })
    )).catch(() => {});

    onUpdate(rec.id, { status: 'Converted' });
    recommendationsApi.update(rec.id, { status: 'Converted' }).catch(() => {});
    toast({
      title: `${taskTitles.length} tasks added to Roadmap`,
      description: `Tasks created for "${rec.sectionName}". Switching to Roadmap…`,
      variant: 'success',
    });
    onNavigateRoadmap?.();
  }

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-300',
      isApproved && 'border-emerald-200 bg-emerald-50/40',
      rec.status === 'Under Review' && 'border-blue-200',
      isDimmed && 'opacity-60',
      rec.status === 'Converted' && 'border-violet-200 bg-violet-50/20',
      !isApproved && !isDimmed && rec.status !== 'Under Review' && rec.status !== 'Converted' && 'border-border bg-card',
    )}>

      {/* ── Card header ── */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b bg-card/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{rec.sectionName}</span>
              <Badge variant="outline" className="text-xs border-orange-200 bg-orange-50 text-orange-700 font-semibold">
                Gap: {Math.abs(rec.gapMagnitude).toFixed(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Gap magnitude vs target score</p>
          </div>
        </div>
        <Badge variant="outline" className={cn('text-xs font-semibold border shrink-0 flex items-center gap-1.5', cfg.cls)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
          {cfg.label}
        </Badge>
      </div>

      {/* ── Card body: two columns ── */}
      <div className="grid grid-cols-[1fr_340px] divide-x">

        {/* LEFT — Recommendation text */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              AI-generated recommendation
            </span>
            {!isApproved && !isNoted && (
              <button
                type="button"
                onClick={() => { setEditMode(v => !v); if (editMode) saveEdit(); }}
                className="ml-auto text-[11px] text-primary hover:underline"
              >
                {editMode ? 'Save edits' : 'Edit'}
              </button>
            )}
          </div>

          {editMode && !isApproved && !isNoted ? (
            <Textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={9}
              className="text-sm leading-relaxed resize-none bg-background"
              autoFocus
            />
          ) : (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {rec.currentText}
            </p>
          )}

          {/* Show previous version */}
          {hasChanged && (
            <div>
              <button
                type="button"
                onClick={() => setShowOriginal(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showOriginal ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <RotateCcw size={11} />
                Show original AI draft
              </button>
              {showOriginal && (
                <div className="mt-2 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                  {rec.originalText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Conversation panel */}
        <div className="flex flex-col bg-muted/20">
          <div className="px-4 pt-4 pb-2 border-b bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={11} className="text-primary" />
              Refine with AI
            </p>
          </div>

          {/* Nudge chips */}
          <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
            {NUDGE_CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                disabled={isApproved || isNoted || typing}
                onClick={() => sendMessage(chip)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  isApproved || isNoted || typing
                    ? 'opacity-40 cursor-not-allowed border-border text-muted-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary hover:bg-primary/5 cursor-pointer',
                )}
              >
                {chip}
              </button>
            ))}

            {/* Date nudge */}
            {!dateMode ? (
              <button
                type="button"
                disabled={isApproved || isNoted || typing}
                onClick={() => setDateMode(true)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1',
                  isApproved || isNoted || typing
                    ? 'opacity-40 cursor-not-allowed border-border text-muted-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary hover:bg-primary/5 cursor-pointer',
                )}
              >
                <CalendarDays size={11} />
                Needs to happen by…
              </button>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="date"
                  value={dateValue}
                  onChange={e => setDateValue(e.target.value)}
                  className="rounded border border-border bg-card px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={sendDate}
                  disabled={!dateValue}
                  className="text-xs text-primary font-semibold disabled:opacity-40"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => { setDateMode(false); setDateValue(''); }}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* Conversation thread */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-56 min-h-[80px]">
            {rec.conversation.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Click a chip above or type below to refine this recommendation.
              </p>
            )}
            {rec.conversation.map(msg => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {typing && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles size={11} className="text-primary" />
                </div>
                <div className="rounded-2xl border bg-card px-3.5 py-2.5 rounded-tl-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={convEndRef} />
          </div>

          {/* Free-text input */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Add context for the AI…"
                rows={2}
                disabled={isApproved || isNoted || typing}
                className="text-xs resize-none flex-1 min-h-[52px]"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                }}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={!input.trim() || isApproved || isNoted || typing}
                onClick={() => sendMessage(input)}
              >
                {typing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card footer ── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t bg-card/60">
        <div className="flex items-center gap-2">
          {!isApproved && !isNoted && rec.status !== 'Converted' && (
            <>
              <Button size="sm" className="h-8 gap-1.5" onClick={approve} disabled={typing}>
                <CheckCircle2 size={13} />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground"
                onClick={markNoted}
                disabled={typing}
              >
                <StickyNote size={13} />
                Mark as Noted
              </Button>
            </>
          )}
          {isApproved && (
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 size={14} />
              Approved
            </div>
          )}
          {isNoted && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
              <StickyNote size={14} />
              Noted — no action required
            </div>
          )}
        </div>

        <Button
          variant={isApproved ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          disabled={rec.status !== 'Approved'}
          onClick={convertToTasks}
        >
          <ArrowRight size={13} />
          Convert to Tasks
        </Button>
      </div>
    </div>
  );
}

// ─── Status summary bar ───────────────────────────────────────────────────────

function SummaryBar({ recs }: { recs: EventRec[] }) {
  const counts: Record<RecStatus, number> = {
    'Approved': 0, 'Under Review': 0, 'AI Draft': 0, 'Noted': 0, 'Converted': 0,
  };
  recs.forEach(r => counts[r.status]++);

  const items = [
    { label: 'Approved',     value: counts['Approved'],     cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Under Review', value: counts['Under Review'], cls: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'AI Draft',     value: counts['AI Draft'],     cls: 'text-slate-600 bg-slate-50 border-slate-200' },
    { label: 'Noted',        value: counts['Noted'],        cls: 'text-muted-foreground bg-muted border-border' },
  ].filter(i => i.value > 0);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm text-muted-foreground">
        {recs.length} recommendation{recs.length !== 1 ? 's' : ''}
      </span>
      <span className="inline-block w-px h-4 bg-border" />
      {items.map(({ label, value, cls }) => (
        <span
          key={label}
          className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', cls)}
        >
          {value} {label}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RecommendationsTabProps {
  event: AssessmentEvent;
  onNavigateRoadmap?: (recName?: string) => void;
}

export function RecommendationsTab({ event, onNavigateRoadmap }: RecommendationsTabProps) {
  const [recs, setRecs] = useState<EventRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try loading from API first
    recommendationsApi.list(event.id)
      .then(apiRecs => {
        if (apiRecs.length > 0) {
          const mapped: EventRec[] = apiRecs.map(r => ({
            id: r.id,
            eventId: r.eventId,
            sectionName: r.sectionName,
            gapMagnitude: r.gapMagnitude,
            status: r.status as RecStatus,
            originalText: r.originalText,
            currentText: r.currentText,
            conversation: r.messages.map(m => ({
              id: m.id,
              role: m.role as 'assessor' | 'ai',
              text: m.text,
            })),
          })).sort((a, b) => {
            if (a.status === 'Approved' && b.status !== 'Approved') return -1;
            if (b.status === 'Approved' && a.status !== 'Approved') return 1;
            return a.gapMagnitude - b.gapMagnitude;
          });
          setRecs(mapped);
        } else {
          // Generate from gap data if none exist
          recommendationsApi.generate(event.id)
            .then(generated => {
              const mapped: EventRec[] = generated.map(r => ({
                id: r.id, eventId: r.eventId, sectionName: r.sectionName,
                gapMagnitude: r.gapMagnitude, status: r.status as RecStatus,
                originalText: r.originalText, currentText: r.currentText,
                conversation: [],
              })).sort((a, b) => a.gapMagnitude - b.gapMagnitude);
              setRecs(mapped);
            })
            .catch(() => {
              // Fallback to mock data
              const data = resultsByEventId[event.id] ?? buildEventResults(event);
              const baseRecs = data
                ? (data.sections as { id: string; name: string; achievedScore: number; targetScore: number }[])
                    .filter(s => s.achievedScore < s.targetScore)
                    .sort((a, b) => (a.achievedScore - a.targetScore) - (b.achievedScore - b.targetScore))
                    .map((s, i) => {
                      const gap = s.achievedScore - s.targetScore;
                      const gapPct = Math.round(Math.abs(gap) / s.targetScore * 100);
                      const text = `Section "${s.name}" is ${Math.abs(gap).toFixed(1)} points below target. A gap of ${gapPct}% requires focused improvement.`;
                      return { id: `gen-${s.id}-${i}`, eventId: event.id, sectionName: s.name, gapMagnitude: gap, status: 'AI Draft' as const, originalText: text, currentText: text, conversation: [] };
                    })
                : INITIAL_RECS.map(r => ({ ...r, eventId: event.id }));
              setRecs((baseRecs.length > 0 ? baseRecs : INITIAL_RECS.map(r => ({ ...r, eventId: event.id })))
                .sort((a, b) => a.gapMagnitude - b.gapMagnitude));
            });
        }
      })
      .catch(() => setRecs(INITIAL_RECS.map(r => ({ ...r, eventId: event.id }))))
      .finally(() => setLoading(false));
  }, [event.id]);

  function updateRec(id: string, changes: Partial<EventRec>) {
    setRecs(prev =>
      prev.map(r => r.id === id ? { ...r, ...changes } : r)
        .sort((a, b) => {
          if (a.status === 'Approved' && b.status !== 'Approved') return -1;
          if (b.status === 'Approved' && a.status !== 'Approved') return 1;
          return a.gapMagnitude - b.gapMagnitude;
        })
    );
    // Persist text/status changes
    const apiChanges: Record<string, unknown> = {};
    if (changes.status) apiChanges.status = changes.status;
    if (changes.currentText) apiChanges.currentText = changes.currentText;
    if (Object.keys(apiChanges).length > 0) {
      recommendationsApi.update(id, apiChanges).catch(() => {});
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const approvedCount = recs.filter(r => r.status === 'Approved' || r.status === 'Converted').length;
  const hasApproved = approvedCount > 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Recommendations</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{event.name}</p>
      </div>

      {/* Summary bar */}
      <SummaryBar recs={recs} />

      {/* Approved banner */}
      {hasApproved && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <Users size={15} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800 leading-relaxed">
            <strong>Executives and respondents can now view approved recommendations.</strong>{' '}
            Approved recommendations are included in the shared summary report for this assessment.
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-6">
        {recs.map(rec => (
          <RecCard
            key={rec.id}
            rec={rec}
            eventId={event.id}
            onUpdate={updateRec}
            onNavigateRoadmap={onNavigateRoadmap}
          />
        ))}
      </div>

      {/* Conversion notice */}
      {recs.some(r => r.status === 'Converted') && (
        <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5">
          <ArrowRight size={15} className="text-violet-600 mt-0.5 shrink-0" />
          <p className="text-sm text-violet-800">
            <strong>Some recommendations have been converted to roadmap tasks.</strong>{' '}
            Visit the <button
              type="button"
              onClick={() => onNavigateRoadmap?.()}
              className="underline font-semibold"
            >Roadmap</button> tab to track progress.
          </p>
        </div>
      )}
    </div>
  );
}
