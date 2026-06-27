import type {
  User, Category, Template, AssessmentEvent, Recommendation, Task, Department, UserGroup,
  AssessmentFramework,
} from '@/types';

// ─── Departments ──────────────────────────────────────────────────────────────
export const departments: Department[] = [
  { id: 'd1', name: 'Enterprise Architecture' },
  { id: 'd2', name: 'Digital Strategy' },
  { id: 'd3', name: 'IT Operations' },
  { id: 'd4', name: 'Finance' },
  { id: 'd5', name: 'Human Resources' },
];

// ─── Users ────────────────────────────────────────────────────────────────────
export const users: User[] = [
  {
    id: 'u1', name: 'Alexandra Mitchell', email: 'admin@nudj.com',
    role: 'admin', status: 'Active', department: 'Enterprise Architecture',
    groupIds: ['g1'], initials: 'AM',
  },
  {
    id: 'u2', name: 'James Carter', email: 'assessor@nudj.com',
    role: 'assessor', status: 'Active', department: 'Digital Strategy',
    groupIds: ['g1', 'g2'], initials: 'JC',
  },
  {
    id: 'u3', name: 'Sarah Chen', email: 'respondent@nudj.com',
    role: 'respondent', status: 'Active', department: 'IT Operations',
    groupIds: ['g2'], initials: 'SC',
  },
  {
    id: 'u4', name: 'David Okafor', email: 'david@nudj.com',
    role: 'respondent', status: 'Inactive', department: 'Finance',
    groupIds: [], initials: 'DO',
  },
  {
    id: 'u5', name: 'Priya Nair', email: 'priya@nudj.com',
    role: 'respondent', status: 'Active', department: 'Digital Strategy',
    groupIds: ['g2'], initials: 'PN',
  },
  {
    id: 'u6', name: 'Marcus Webb', email: 'marcus@nudj.com',
    role: 'respondent', status: 'Active', department: 'Enterprise Architecture',
    groupIds: ['g1'], initials: 'MW',
  },
  {
    id: 'u7', name: 'Aisha Patel', email: 'aisha@nudj.com',
    role: 'respondent', status: 'Active', department: 'Finance',
    groupIds: [], initials: 'AP',
  },
  {
    id: 'u8', name: 'Carlos Díaz', email: 'carlos@nudj.com',
    role: 'respondent', status: 'Active', department: 'Human Resources',
    groupIds: [], initials: 'CD',
  },
];

// ─── User Groups ──────────────────────────────────────────────────────────────
export const userGroups: UserGroup[] = [
  { id: 'g1', name: 'EA Core Team', memberIds: ['u1', 'u2', 'u6'] },
  { id: 'g2', name: 'Digital Transformation Group', memberIds: ['u2', 'u3', 'u5'] },
];

export const currentUser = users[0];

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories: Category[] = [
  {
    id: 'cat1', name: 'Enterprise Architecture',
    description: 'Assess the maturity of EA practices, governance, and capability across the organization.',
    icon: 'building-2', color: '#2563EB', status: 'Active', templateCount: 2,
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'cat2', name: 'Digital Transformation',
    description: 'Evaluate digital readiness, innovation capability, and technology adoption maturity.',
    icon: 'zap', color: '#7C3AED', status: 'Active', templateCount: 2,
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'cat3', name: 'Cybersecurity Readiness',
    description: "Evaluate the organization's security posture, controls maturity, and incident response capability.",
    icon: 'shield', color: '#DC2626', status: 'Archived', templateCount: 1,
    createdAt: '2025-06-10T09:00:00Z',
  },
];

// ─── Assessment Frameworks ────────────────────────────────────────────────────
export const frameworks: AssessmentFramework[] = [
  {
    id: 'fw1',
    name: 'EA Maturity Framework',
    description: 'Comprehensive framework for assessing enterprise architecture maturity across all capability dimensions.',
    allowedQuestionTypes: ['single-choice', 'multi-choice', 'rating-scale', 'yes-no', 'free-text', 'yes-no-partial', 'percentage', 'frequency'],
    scoringMethod: 'weighted_section',
    status: 'Active',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    maturityLevels: [
      { level: 1, label: 'Initial', minScore: 0, maxScore: 1.9, description: 'Processes are ad hoc and unpredictable.' },
      { level: 2, label: 'Developing', minScore: 2.0, maxScore: 2.9, description: 'Practices exist but are inconsistently applied.' },
      { level: 3, label: 'Defined', minScore: 3.0, maxScore: 3.4, description: 'Processes are documented and standardised.' },
      { level: 4, label: 'Quantitatively Managed', minScore: 3.5, maxScore: 4.4, description: 'Processes are measured and controlled.' },
      { level: 5, label: 'Optimising', minScore: 4.5, maxScore: 5.0, description: 'Continuous improvement is institutionalised.' },
    ],
  },
  {
    id: 'fw2',
    name: 'Digital Readiness Framework',
    description: 'Evaluates digital readiness and transformation capability across business and technology dimensions.',
    allowedQuestionTypes: ['rating-scale', 'yes-no', 'yes-no-partial', 'free-text'],
    scoringMethod: 'simple_average',
    status: 'Active',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    maturityLevels: [
      { level: 1, label: 'Unaware', minScore: 0, maxScore: 1.9, description: 'No awareness of digital transformation needs.' },
      { level: 2, label: 'Exploring', minScore: 2.0, maxScore: 2.9, description: 'Beginning to explore digital opportunities.' },
      { level: 3, label: 'Piloting', minScore: 3.0, maxScore: 3.4, description: 'Running pilot digital initiatives.' },
      { level: 4, label: 'Scaling', minScore: 3.5, maxScore: 4.4, description: 'Scaling digital capabilities across the organisation.' },
      { level: 5, label: 'Transforming', minScore: 4.5, maxScore: 5.0, description: 'Fully digitally transformed and continuously evolving.' },
    ],
  },
  {
    id: 'fw3',
    name: 'Governance Audit Framework',
    description: 'Structured audit framework for evaluating governance compliance and policy adherence.',
    allowedQuestionTypes: ['yes-no', 'yes-no-partial', 'single-choice', 'free-text', 'percentage'],
    scoringMethod: 'categorical_weight',
    status: 'Draft',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    maturityLevels: [
      { level: 1, label: 'Non-Compliant', minScore: 0, maxScore: 1.9, description: 'Significant governance gaps and policy violations.' },
      { level: 2, label: 'Partial', minScore: 2.0, maxScore: 2.9, description: 'Some governance controls in place but incomplete.' },
      { level: 3, label: 'Compliant', minScore: 3.0, maxScore: 3.4, description: 'Meeting minimum governance and compliance requirements.' },
      { level: 4, label: 'Established', minScore: 3.5, maxScore: 4.4, description: 'Robust governance framework consistently applied.' },
      { level: 5, label: 'Exemplary', minScore: 4.5, maxScore: 5.0, description: 'Governance best practices with continuous improvement.' },
    ],
  },
];

// ─── Templates ────────────────────────────────────────────────────────────────
export const templates: Template[] = [
  {
    id: 't1', categoryId: 'cat1', name: 'EA Maturity Assessment', code: 'EA-MAT-v2',
    description: 'Comprehensive evaluation of enterprise architecture maturity across five domains.',
    assessmentType: 'Maturity', version: '2.1', status: 'Active', questionCount: 42,
    createdBy: 'u1', createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-04-10T14:30:00Z',
    frameworkId: 'fw1',
  },
  {
    id: 't2', categoryId: 'cat1', name: 'EA Governance Readiness', code: 'EA-GOV-v1',
    description: 'Targeted assessment of EA governance frameworks, policies, and compliance posture.',
    assessmentType: 'Readiness', version: '1.3', status: 'Active', questionCount: 28,
    createdBy: 'u1', createdAt: '2026-02-05T09:00:00Z', updatedAt: '2026-03-18T11:00:00Z',
    frameworkId: 'fw1',
  },
  {
    id: 't2b', categoryId: 'cat1', name: 'EA Capability Baseline', code: 'EA-CAP-v1',
    description: 'Baseline capability assessment for EA functions across business units.',
    assessmentType: 'Capability', version: '1.0', status: 'Archived', questionCount: 21,
    createdBy: 'u1', createdAt: '2025-09-01T09:00:00Z', updatedAt: '2025-12-01T10:00:00Z',
    frameworkId: 'fw1',
  },
  {
    id: 't3', categoryId: 'cat2', name: 'Digital Maturity Index', code: 'DT-MAT-v1',
    description: 'Holistic evaluation of digital capabilities, data maturity, and transformation readiness.',
    assessmentType: 'Maturity', version: '1.0', status: 'Active', questionCount: 35,
    createdBy: 'u2', createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-04-22T09:00:00Z',
    frameworkId: 'fw2',
  },
  {
    id: 't4', categoryId: 'cat2', name: 'Innovation Capability Survey', code: 'DT-INN-v1',
    description: "Measures the organization's capacity to ideate, experiment, and scale innovation.",
    version: '0.5', status: 'Draft', questionCount: 18,
    createdBy: 'u2', createdAt: '2026-05-10T09:00:00Z', updatedAt: '2026-06-01T16:00:00Z',
    frameworkId: 'fw2',
  },
];

// ─── Events ───────────────────────────────────────────────────────────────────
export const events: AssessmentEvent[] = [
  // Open — rich respondent data for submissions demo
  {
    id: 'e1',
    templateId: 't1',
    name: 'EA Maturity Assessment — Q3 2026',
    description: 'Quarterly maturity review for the Enterprise Architecture function.',
    status: 'Open',
    ownerId: 'u2',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    targetMaturityLevel: 'Defined',
    reassessmentDate: '2027-01-15',
    respondentIds: ['u1', 'u3', 'u5', 'u6', 'u7', 'u8'],
    respondentProgress: [
      { userId: 'u1', completionPct: 0, status: 'Not Started' },
      { userId: 'u3', completionPct: 45, status: 'In Progress', lastActivity: '2026-06-18T14:23:00Z' },
      { userId: 'u5', completionPct: 100, status: 'Submitted', lastActivity: '2026-06-20T09:15:00Z' },
      { userId: 'u6', completionPct: 100, status: 'Validated', lastActivity: '2026-06-19T16:40:00Z' },
      { userId: 'u7', completionPct: 0, status: 'Not Started' },
      {
        userId: 'u8', completionPct: 60, status: 'Returned',
        lastActivity: '2026-06-17T11:00:00Z',
        feedback: 'Please revisit questions 3 and 7 — your responses need more specific evidence to support the maturity claims.',
      },
    ],
    completionRate: 33,
    trend: 'up',
    createdAt: '2026-06-15T09:00:00Z',
  },
  // In Progress
  {
    id: 'e2',
    templateId: 't3',
    name: 'Digital Maturity Index — H1 2026',
    description: 'First-half digital readiness check across business units.',
    status: 'In Progress',
    ownerId: 'u2',
    startDate: '2026-04-01',
    endDate: '2026-06-15',
    targetMaturityLevel: 'Managed',
    respondentIds: ['u1', 'u3'],
    respondentProgress: [
      { userId: 'u1', completionPct: 100, status: 'Submitted', lastActivity: '2026-06-12T10:00:00Z' },
      { userId: 'u3', completionPct: 100, status: 'Validated', lastActivity: '2026-06-14T15:30:00Z' },
    ],
    completionRate: 100,
    trend: 'up',
    createdAt: '2026-03-20T09:00:00Z',
  },
  // Completed — score 72
  {
    id: 'e3',
    templateId: 't1',
    name: 'EA Maturity Assessment — Q1 2026',
    description: 'Q1 maturity baseline for Enterprise Architecture.',
    status: 'Completed',
    ownerId: 'u2',
    startDate: '2026-01-10',
    endDate: '2026-03-31',
    targetMaturityLevel: 'Defined',
    respondentIds: ['u1', 'u3'],
    respondentProgress: [
      { userId: 'u1', completionPct: 100, status: 'Validated', lastActivity: '2026-03-28T09:00:00Z' },
      { userId: 'u3', completionPct: 100, status: 'Validated', lastActivity: '2026-03-29T11:00:00Z' },
    ],
    completionRate: 100,
    score: 72,
    maturityLevel: 'Defined',
    trend: 'up',
    createdAt: '2026-01-05T09:00:00Z',
  },
  // Completed — score 58
  {
    id: 'e4',
    templateId: 't2',
    name: 'EA Governance Readiness — 2025 Baseline',
    description: 'Annual governance readiness baseline.',
    status: 'Completed',
    ownerId: 'u2',
    startDate: '2025-10-01',
    endDate: '2025-12-15',
    respondentIds: ['u1', 'u3'],
    respondentProgress: [
      { userId: 'u1', completionPct: 100, status: 'Validated', lastActivity: '2025-12-10T09:00:00Z' },
      { userId: 'u3', completionPct: 100, status: 'Validated', lastActivity: '2025-12-12T14:00:00Z' },
    ],
    completionRate: 100,
    score: 58,
    maturityLevel: 'Managed',
    trend: 'flat',
    createdAt: '2025-09-20T09:00:00Z',
  },
  // Closed
  {
    id: 'e5',
    templateId: 't3',
    name: 'Digital Maturity Index — 2025 Baseline',
    description: '2025 digital maturity baseline.',
    status: 'Closed',
    ownerId: 'u2',
    startDate: '2025-06-01',
    endDate: '2025-08-31',
    respondentIds: ['u3'],
    respondentProgress: [
      { userId: 'u3', completionPct: 100, status: 'Validated', lastActivity: '2025-08-25T11:00:00Z' },
    ],
    completionRate: 100,
    score: 61,
    maturityLevel: 'Defined',
    trend: 'up',
    createdAt: '2025-05-15T09:00:00Z',
  },
];

// ─── Recommendations ──────────────────────────────────────────────────────────
export const recommendations: Recommendation[] = [
  {
    id: 'r1', eventId: 'e3',
    title: 'Establish EA Governance Framework',
    description: 'Implement a formal EA governance structure with review boards and escalation paths.',
    priority: 'High', status: 'Approved', linkedTaskId: 'task1',
    createdAt: '2026-04-05T09:00:00Z',
  },
  {
    id: 'r2', eventId: 'e3',
    title: 'Deploy Centralised Architecture Repository',
    description: 'Select and implement an EA repository tool to consolidate architecture artefacts.',
    priority: 'Medium', status: 'Draft', linkedTaskId: null,
    createdAt: '2026-04-05T09:05:00Z',
  },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasks: Task[] = ([
  {
    id: 'task1', title: 'Define EA Governance Charter',
    description: 'Draft and ratify the EA governance charter with executive sponsorship.',
    ownerId: 'u1', priority: 'High', status: 'In Progress',
    dueDate: '2026-09-15', dependsOn: [],
    sourceRecommendationId: 'r1', completionPct: 40,
  },
  {
    id: 'task2', title: 'Evaluate EA Repository Tools',
    description: 'Shortlist and evaluate 3 candidate EA repository platforms.',
    ownerId: 'u2', priority: 'Medium', status: 'Not Started',
    dueDate: '2026-09-30', dependsOn: ['task1'],
    sourceRecommendationId: 'r2', completionPct: 0,
  },
] as unknown as Task[]);
