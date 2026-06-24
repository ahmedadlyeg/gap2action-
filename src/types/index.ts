export type UserRole = 'admin' | 'assessor' | 'respondent';
export type UserStatus = 'Active' | 'Inactive';
export type CategoryStatus = 'Active' | 'Archived';
export type TemplateStatus = 'Draft' | 'Active' | 'Archived';
export type EventStatus = 'Draft' | 'Scheduled' | 'Open' | 'In Progress' | 'Completed' | 'Closed';
export type RecommendationStatus = 'Draft' | 'Approved' | 'Converted' | 'Rejected';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Done' | 'Blocked';
export type Priority = 'High' | 'Medium' | 'Low';
export type MaturityLevel = 'Initial' | 'Managed' | 'Defined' | 'Quantitatively Managed' | 'Optimizing';
export type RespondentStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Validated' | 'Returned';

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
}

export interface RespondentProgress {
  userId: string;
  completionPct: number;
  status: RespondentStatus;
  lastActivity?: string;
  feedback?: string;
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
  respondentProgress: RespondentProgress[];
  completionRate: number;
  score?: number;
  maturityLevel?: MaturityLevel;
  trend?: 'up' | 'down' | 'flat';
  createdAt: string;
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

export interface Task {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  dependsOn: string[];
  sourceRecommendationId: string | null;
  completionPct: number;
}

// ─── Template Builder ─────────────────────────────────────────────────────────

export type QuestionType = 'single-choice' | 'multi-choice' | 'rating-scale' | 'yes-no' | 'free-text';

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

// ─── Persistence ──────────────────────────────────────────────────────────────

export interface QuestionnaireSubmission {
  eventId: string;
  userId: string;
  answers: Record<string, string | string[] | number>;
  completionPct: number;
  status: 'In Progress' | 'Submitted';
  submittedAt?: string;
}

export interface RespondentAction {
  status: 'Validated' | 'Returned';
  feedback?: string;
  actionAt: string;
}
