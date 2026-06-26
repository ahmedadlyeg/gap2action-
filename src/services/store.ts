import type {
  AssessmentEvent,
  BuilderSection,
  Department,
  QuestionnaireSubmission,
  RespondentAction,
  Template,
  TemplateStatus,
  User,
  UserGroup,
} from '@/types';

export interface TemplateMeta {
  name: string;
  version: string;
  status: TemplateStatus;
  maturityLevels: unknown[];
  targetScore: number;
}
import { events as seedEvents, templates as seedTemplates, users as seedUsers, departments as seedDepts, userGroups as seedGroups } from '@/services/mockData';

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORE_KEY = 'g2a_store';

// ─── Internal shape ───────────────────────────────────────────────────────────

interface Store {
  events: AssessmentEvent[];
  templates: Template[];
  templateSections: Record<string, BuilderSection[]>;
  templateMeta: Record<string, TemplateMeta>;
  submissions: Record<string, QuestionnaireSubmission>; // key: `${eventId}:${userId}`
  respondentActions: Record<string, RespondentAction>;  // key: `${eventId}:${userId}`
  users?: User[];
  departments?: Department[];
  userGroups?: UserGroup[];
}

function buildSeed(): Store {
  return {
    events: JSON.parse(JSON.stringify(seedEvents)) as AssessmentEvent[],
    templates: JSON.parse(JSON.stringify(seedTemplates)) as Template[],
    templateSections: {},
    templateMeta: {},
    submissions: {},
    respondentActions: {},
    users: JSON.parse(JSON.stringify(seedUsers)) as User[],
    departments: JSON.parse(JSON.stringify(seedDepts)) as Department[],
    userGroups: JSON.parse(JSON.stringify(seedGroups)) as UserGroup[],
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
  window.dispatchEvent(new CustomEvent('g2a-store-updated'));
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

export function getReturnFeedback(eventId: string, userId: string): string | null {
  const action = getRespondentAction(eventId, userId);
  if (action?.status === 'Returned for Revision') return action.feedback ?? null;
  return null;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function getTemplates(): Template[] {
  const store = load();
  const raw: Template[] = store.templates ?? JSON.parse(JSON.stringify(seedTemplates));
  // Guard against duplicate IDs that can accumulate in corrupt localStorage state
  const seen = new Set<string>();
  const templates = raw.filter(t => t.id && !seen.has(t.id) && seen.add(t.id));
  // Merge saved metadata (name/version/status) back so builder saves are reflected
  return templates.map(t => {
    const meta = store.templateMeta?.[t.id];
    if (!meta) return t;
    return { ...t, name: meta.name, version: meta.version, status: meta.status };
  });
}

export function getTemplate(id: string): Template | undefined {
  return getTemplates().find(t => t.id === id);
}

export function updateTemplate(id: string, updates: Partial<Template>): void {
  const store = load();
  if (!store.templates) store.templates = JSON.parse(JSON.stringify(seedTemplates));
  const idx = store.templates.findIndex(t => t.id === id);
  if (idx >= 0) {
    store.templates[idx] = { ...store.templates[idx], ...updates, updatedAt: new Date().toISOString() };
  } else {
    // Template exists only in seed — pull it in so we can persist the update
    const seed = seedTemplates.find(t => t.id === id);
    if (seed) store.templates.push({ ...seed, ...updates, updatedAt: new Date().toISOString() });
  }
  persist(store);
}

export function saveTemplate(t: Template): void {
  const store = load();
  if (!store.templates) store.templates = JSON.parse(JSON.stringify(seedTemplates));
  const idx = store.templates.findIndex(x => x.id === t.id);
  if (idx >= 0) store.templates[idx] = t;
  else store.templates.push(t);
  persist(store);
}

// ─── Version family helpers ───────────────────────────────────────────────────

/** Walk up parentVersionId chain to find the original root template ID. */
export function findVersionRoot(allTemplates: Template[], templateId: string): string {
  const seen = new Set<string>();
  let id = templateId;
  while (true) {
    if (seen.has(id)) return id; // cycle guard
    seen.add(id);
    const t = allTemplates.find(x => x.id === id);
    if (!t?.parentVersionId) return id;
    if (!allTemplates.some(x => x.id === t.parentVersionId)) return id;
    id = t.parentVersionId;
  }
}

/** BFS from root to collect every template in the same version family. */
export function getVersionFamily(allTemplates: Template[], templateId: string): Template[] {
  const rootId = findVersionRoot(allTemplates, templateId);
  const result: Template[] = [];
  const queue = [rootId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const t = allTemplates.find(x => x.id === id);
    if (t) {
      result.push(t);
      allTemplates.filter(x => x.parentVersionId === id).forEach(c => queue.push(c.id));
    }
  }
  return result;
}

export function cloneTemplate(sourceId: string): string {
  const allTemplates = getTemplates();
  const source = allTemplates.find(t => t.id === sourceId);
  if (!source) throw new Error(`Template ${sourceId} not found`);

  // Always link to the family root (keeps versioning 1 level deep)
  const rootId = findVersionRoot(allTemplates, sourceId);

  // Bump past the highest major version in the whole family to avoid conflicts
  const family = getVersionFamily(allTemplates, sourceId);
  const maxMajor = Math.max(...family.map(t => parseInt(t.version.split('.')[0], 10)));
  const newVersion = `${maxMajor + 1}.0`;

  const sourceSections = getTemplateSections(sourceId) ?? [];

  const newTemplate: Template = {
    ...source,
    id: crypto.randomUUID(),
    status: 'Draft',
    version: newVersion,
    parentVersionId: rootId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveTemplate(newTemplate);

  const copiedSections = sourceSections.map(s => ({
    ...s,
    id: crypto.randomUUID(),
    questions: s.questions.map(q => ({ ...q, id: crypto.randomUUID() })),
  }));
  saveTemplateSections(newTemplate.id, copiedSections);

  return newTemplate.id;
}

// ─── Section assignment helpers ───────────────────────────────────────────────

/** Returns respondent IDs for a given section.
 *  Falls back to all event respondent IDs if no sectionAssignments set. */
export function getSectionRespondents(
  event: AssessmentEvent,
  sectionId: string,
): string[] {
  if (!event.sectionAssignments || event.sectionAssignments.length === 0) {
    return event.respondentIds ?? [];
  }
  const a = event.sectionAssignments.find(a => a.sectionId === sectionId);
  return a ? a.respondentIds : [];
}

/** Returns section IDs assigned to a specific user.
 *  Falls back to all section IDs if no sectionAssignments set. */
export function getUserAssignedSections(
  event: AssessmentEvent,
  userId: string,
  allSectionIds: string[],
): string[] {
  if (!event.sectionAssignments || event.sectionAssignments.length === 0) {
    return allSectionIds;
  }
  return event.sectionAssignments
    .filter(a => a.respondentIds.includes(userId))
    .map(a => a.sectionId);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUsers(): User[] {
  return load().users ?? JSON.parse(JSON.stringify(seedUsers));
}

export function saveUser(user: User): void {
  const store = load();
  if (!store.users) store.users = JSON.parse(JSON.stringify(seedUsers));
  const idx = store.users.findIndex(u => u.id === user.id);
  if (idx >= 0) store.users[idx] = user;
  else store.users.push(user);
  persist(store);
}

export function deleteUserById(id: string): void {
  const store = load();
  if (!store.users) store.users = JSON.parse(JSON.stringify(seedUsers));
  store.users = store.users.filter(u => u.id !== id);
  persist(store);
}

// ─── Departments ──────────────────────────────────────────────────────────────

export function getDepartments(): Department[] {
  return load().departments ?? JSON.parse(JSON.stringify(seedDepts));
}

export function saveDepartment(dept: Department): void {
  const store = load();
  if (!store.departments) store.departments = JSON.parse(JSON.stringify(seedDepts));
  const idx = store.departments.findIndex(d => d.id === dept.id);
  if (idx >= 0) store.departments[idx] = dept;
  else store.departments.push(dept);
  persist(store);
}

export function deleteDepartmentById(id: string): void {
  const store = load();
  if (!store.departments) store.departments = JSON.parse(JSON.stringify(seedDepts));
  store.departments = store.departments.filter(d => d.id !== id);
  persist(store);
}

// ─── User Groups ──────────────────────────────────────────────────────────────

export function getGroups(): UserGroup[] {
  return load().userGroups ?? JSON.parse(JSON.stringify(seedGroups));
}

export function saveGroup(group: UserGroup): void {
  const store = load();
  if (!store.userGroups) store.userGroups = JSON.parse(JSON.stringify(seedGroups));
  const idx = store.userGroups.findIndex(g => g.id === group.id);
  if (idx >= 0) store.userGroups[idx] = group;
  else store.userGroups.push(group);
  persist(store);
}

export function deleteGroupById(id: string): void {
  const store = load();
  if (!store.userGroups) store.userGroups = JSON.parse(JSON.stringify(seedGroups));
  store.userGroups = store.userGroups.filter(g => g.id !== id);
  persist(store);
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetStore(): void {
  persist(buildSeed());
}
