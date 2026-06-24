import type {
  AssessmentEvent,
  BuilderSection,
  QuestionnaireSubmission,
  RespondentAction,
  TemplateStatus,
} from '@/types';

export interface TemplateMeta {
  name: string;
  version: string;
  status: TemplateStatus;
  maturityLevels: unknown[];
  targetScore: number;
}
import { events as seedEvents } from '@/services/mockData';

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORE_KEY = 'g2a_store';

// ─── Internal shape ───────────────────────────────────────────────────────────

interface Store {
  events: AssessmentEvent[];
  templateSections: Record<string, BuilderSection[]>;
  templateMeta: Record<string, TemplateMeta>;
  submissions: Record<string, QuestionnaireSubmission>; // key: `${eventId}:${userId}`
  respondentActions: Record<string, RespondentAction>;  // key: `${eventId}:${userId}`
}

function buildSeed(): Store {
  return {
    events: JSON.parse(JSON.stringify(seedEvents)) as AssessmentEvent[],
    templateSections: {},
    templateMeta: {},
    submissions: {},
    respondentActions: {},
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // corrupted — fall through to seed
  }
  return buildSeed();
}

function persist(store: Store): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function getEvents(): AssessmentEvent[] {
  return load().events;
}

export function saveEvent(event: AssessmentEvent): void {
  const store = load();
  const idx = store.events.findIndex(e => e.id === event.id);
  if (idx >= 0) store.events[idx] = event;
  else store.events.push(event);
  persist(store);
}

export function updateEvent(id: string, partial: Partial<AssessmentEvent>): void {
  const store = load();
  const idx = store.events.findIndex(e => e.id === id);
  if (idx >= 0) store.events[idx] = { ...store.events[idx], ...partial };
  persist(store);
}

// ─── Template sections ────────────────────────────────────────────────────────

export function getTemplateSections(templateId: string): BuilderSection[] | null {
  return load().templateSections[templateId] ?? null;
}

export function saveTemplateSections(templateId: string, sections: BuilderSection[]): void {
  const store = load();
  store.templateSections[templateId] = sections;
  persist(store);
}

// ─── Template metadata (name, version, status, scoring) ──────────────────────

export function getTemplateMeta(templateId: string): TemplateMeta | null {
  return load().templateMeta?.[templateId] ?? null;
}

export function saveTemplateMeta(templateId: string, meta: TemplateMeta): void {
  const store = load();
  if (!store.templateMeta) store.templateMeta = {};
  store.templateMeta[templateId] = meta;
  persist(store);
}

// ─── Questionnaire submissions ────────────────────────────────────────────────

export function getSubmission(eventId: string, userId: string): QuestionnaireSubmission | null {
  return load().submissions[`${eventId}:${userId}`] ?? null;
}

export function saveSubmission(
  eventId: string,
  userId: string,
  sub: QuestionnaireSubmission,
): void {
  const store = load();
  store.submissions[`${eventId}:${userId}`] = sub;
  persist(store);
}

// ─── Respondent actions (validate / return) ───────────────────────────────────

export function getRespondentAction(eventId: string, userId: string): RespondentAction | null {
  return load().respondentActions[`${eventId}:${userId}`] ?? null;
}

export function saveRespondentAction(
  eventId: string,
  userId: string,
  action: RespondentAction,
): void {
  const store = load();
  store.respondentActions[`${eventId}:${userId}`] = action;
  persist(store);
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetStore(): void {
  persist(buildSeed());
}
