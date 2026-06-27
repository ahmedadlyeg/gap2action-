export type UserRole = 'admin' | 'assessor' | 'respondent';
export type UserStatus = 'Active' | 'Inactive';
export type CategoryStatus = 'Active' | 'Archived';
export type TemplateStatus = 'Draft' | 'Active' | 'Archived';
export type EventStatus = 'Draft' | 'Scheduled' | 'Open' | 'In Progress' | 'Completed' | 'Closed';
export type RecommendationStatus = 'Draft' | 'Approved' | 'Converted' | 'Rejected';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Done' | 'Blocked';
export type Priority = 'High' | 'Medium' | 'Low';
export type MaturityLevel = 'Initial' | 'Managed' | 'Defined' | 'Quantitatively Managed' | 'Optimizing';
export type RespondentStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Validated' | 'Returned' | 'Returned for Revision'
  | 'Not_Started' | 'In_Progress' | 'Returned_for_Revision';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  groupIds?: string[];
  initials: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface UserGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: CategoryStatus;
  templateCount: number;
  createdAt: string;
}

export interface Template {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  description: string;
  assessmentType?: string;
  version: string;
  status: TemplateStatus;
  questionCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  parentVersionId?: string;
  coverImageUrl?: string;
  tagline?: string;
  definition?: string;
  explanation?: string;
  frameworkId?: string;
}

export interface RespondentProgress {
  userId: string;
  completionPct: number;
  status: RespondentStatus;
  lastActivity?: string;
  feedback?: string;
  returnCount?: number;
}

export interface AssessmentEvent {
  id: string;
  templateId: string;
  name: string;
  description: string;
  status: EventStatus;
  ownerId: string;
  startDate: string;
  endDate: string;
  targetMaturityLevel?: MaturityLevel;
  reassessmentDate?: string;
  respondentIds: string[];
  sectionAssignments?: SectionAssignment[]; // undefined = all respondents answer all sections
  respondentProgress: RespondentProgress[];
  completionRate: number;
  score?: number;
  maturityLevel?: MaturityLevel;
  trend?: 'up' | 'down' | 'flat';
  createdAt: string;
  frameworkId?: string;
}

export interface Recommendation {
  id: string;
  eventId: string;
  title: string;
  description: string;
  priority: Priority;
  status: RecommendationStatus;
  linkedTaskId: string | null;
  createdAt: string;
}

export type RecStatus = 'AI Draft' | 'Under Review' | 'Approved' | 'Noted' | 'Converted';

export interface RecConvMessage {
  id: string;
  role: 'assessor' | 'ai';
  text: string;
}

export interface EventRec {
  id: string;
  eventId: string;
  sectionName: string;
  gapMagnitude: number;  // negative number, e.g. -1.2
  status: RecStatus;
  currentText: string;
  originalText: string;
  conversation: RecConvMessage[];
}

export type TaskEffort = 'Small' | 'Medium' | 'Large';

export interface Task {
  id: string;
  eventId: string;              // links task to its assessment event
  title: string;
  description: string;
  progressNotes: string;
  recId: string;                // recommendation / gap group id
  recName: string;              // recommendation / gap group label
  gapWeight: number;
  assigneeId?: string;          // user id of person responsible
  priority: Priority;
  status: TaskStatus;
  effort: TaskEffort;
  startDate: string;            // 'YYYY-MM-DD'
  dueDate: string;              // 'YYYY-MM-DD'
  dependsOn: string[];          // task IDs
  completionPct: number;
  createdAt: string;
}

export interface SectionAssignment {
  sectionId: string;       // matches BuilderSection.id from the template
  respondentIds: string[]; // resolved user IDs (not group/dept refs)
}

// ─── Template Builder ─────────────────────────────────────────────────────────

export type QuestionType =
  | 'single-choice' | 'multi-choice' | 'rating-scale' | 'yes-no' | 'free-text'
  | 'yes-no-partial' | 'percentage' | 'frequency';

export type ScoringMethod = 'weighted_section' | 'simple_average' | 'categorical_weight';

export interface MaturityLevelConfig {
  level: number; label: string; description: string; minScore: number; maxScore: number;
}

export interface AssessmentFramework {
  id: string; name: string; description: string;
  allowedQuestionTypes: QuestionType[];
  scoringMethod: ScoringMethod;
  maturityLevels: MaturityLevelConfig[];
  status: 'Draft' | 'Active' | 'Archived';
  createdBy: string; createdAt: string; updatedAt: string;
}

export interface AnswerOption {
  id: string;
  text: string;
  score: number;
}

export interface BuilderQuestion {
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

export interface BuilderSection {
  id: string;
  name: string;
  description: string;
  weight: number;
  questions: BuilderQuestion[];
}

// ─── Questionnaire runtime ────────────────────────────────────────────────────

export interface EvidenceFile {
  id: string;
  name: string;
  size: string;
}

export interface QuestionnaireSubmission {
  eventId: string;
  userId: string;
  answers: Record<string, string | string[] | number | null>;
  evidence?: Record<string, EvidenceFile[]>;
  completionPct: number;
  status: RespondentStatus;
  score?: number;
  submittedAt?: string;
}

export interface RespondentAction {
  status: RespondentStatus;
  feedback?: string;
  returnCount: number;
  actionAt?: string;
}
