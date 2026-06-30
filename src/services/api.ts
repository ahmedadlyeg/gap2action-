/**
 * api.ts — Central HTTP client.
 *
 * - All requests use credentials: 'include' so the browser sends httpOnly cookies automatically.
 * - On 401, silently calls /api/auth/refresh then retries the original request once.
 * - On second 401, clears auth state and redirects to /login.
 * - Exports typed helper functions for every backend endpoint.
 */

export const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  isRetry = false,
  noRedirect = false,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include', // sends httpOnly cookies automatically
    headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    // Try to refresh the access token (uses the refresh_token httpOnly cookie)
    const refreshed = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      // Retry the original request with the new cookie
      return request<T>(method, path, body, true, noRedirect);
    }
    // Refresh failed — redirect to login (unless caller handles 401 itself)
    if (!noRedirect) {
      window.location.href = `${import.meta.env.BASE_URL}login`;
    }
    throw new Error('Session expired');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'assessor' | 'respondent';
  initials: string;
  departmentId?: string | null;
}

export const authApi = {
  // noRedirect=true: a 401 on login means wrong credentials, NOT a session
  // expiry. Without this, the request wrapper would call window.location.href
  // and silently reload the page instead of showing an error message.
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('POST', '/auth/login', { email, password }, false, true),
  logout: () => api.post<void>('/auth/logout'),
  refresh: () => api.post<void>('/auth/refresh'),
  // noRedirect=true: getMe is called on every page load to check session;
  // a 401 here just means "not logged in" — AuthContext handles it gracefully.
  me: () => request<AuthUser>('GET', '/auth/me', undefined, false, true),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export interface ApiCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'Active' | 'Archived';
  templateCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const categoriesApi = {
  list: () => api.get<ApiCategory[]>('/categories'),
  get: (id: string) => api.get<ApiCategory>(`/categories/${id}`),
  create: (data: Partial<ApiCategory>) => api.post<ApiCategory>('/categories', data),
  update: (id: string, data: Partial<ApiCategory>) => api.patch<ApiCategory>(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ─── Frameworks ───────────────────────────────────────────────────────────────

export interface ApiMaturityLevel {
  id: string;
  level: number;
  label: string;
  description: string;
  minScore: number;
  maxScore: number;
}

export interface ApiFramework {
  id: string;
  name: string;
  description: string;
  scoringMethod: string;
  allowedQuestionTypes: string[];
  status: 'Draft' | 'Active' | 'Archived';
  maturityLevels: ApiMaturityLevel[];
  createdAt: string;
  updatedAt: string;
}

export const frameworksApi = {
  list: () => api.get<ApiFramework[]>('/frameworks'),
  get: (id: string) => api.get<ApiFramework>(`/frameworks/${id}`),
  create: (data: Partial<ApiFramework>) => api.post<ApiFramework>('/frameworks', data),
  update: (id: string, data: Partial<ApiFramework>) => api.patch<ApiFramework>(`/frameworks/${id}`, data),
  delete: (id: string) => api.delete(`/frameworks/${id}`),
};

// ─── Templates ────────────────────────────────────────────────────────────────

export interface ApiTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  assessmentType?: string;
  version: string;
  status: 'Draft' | 'Active' | 'Archived';
  tagline?: string;
  definition?: string;
  explanation?: string;
  coverImageUrl?: string;
  categoryId: string;
  frameworkId?: string;
  framework?: { id: string; name: string };
  sections?: ApiSection[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSection {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  questions: ApiQuestion[];
}

export interface ApiQuestion {
  id: string;
  text: string;
  guidance: string;
  type: string;
  required: boolean;
  sortOrder: number;
  minLabel?: string;
  maxLabel?: string;
  ratingScores: number[];
  yesScore?: number;
  noScore?: number;
  options: { id: string; text: string; score: number; sortOrder: number }[];
}

export const templatesApi = {
  list: (categoryId?: string) =>
    api.get<ApiTemplate[]>(`/templates${categoryId ? `?categoryId=${categoryId}` : ''}`),
  get: (id: string) => api.get<ApiTemplate>(`/templates/${id}`),
  create: (data: Partial<ApiTemplate>) => api.post<ApiTemplate>('/templates', data),
  update: (id: string, data: Partial<ApiTemplate>) => api.patch<ApiTemplate>(`/templates/${id}`, data),
  saveSections: (templateId: string, sections: ApiSection[]) =>
    api.put<{ ok: boolean }>(`/templates/${templateId}/sections`, sections),
};

// ─── Events ───────────────────────────────────────────────────────────────────

export interface ApiRespondent {
  eventId: string;
  userId: string;
  status: string;
  completionPct: number;
  lastActivity?: string;
  feedback?: string;
  user?: { id: string; name: string; initials: string; email: string };
}

export interface ApiEvent {
  id: string;
  name: string;
  description: string;
  status: string;
  startDate?: string;
  endDate?: string;
  targetMaturityLevel?: string;
  reassessmentDate?: string;
  completionRate: number;
  score?: number;
  maturityLevel?: string;
  trend?: string;
  templateId: string;
  ownerId: string;
  template?: ApiTemplate;
  owner?: { id: string; name: string; initials: string };
  respondents: ApiRespondent[];
  createdAt: string;
  updatedAt: string;
}

export const eventsApi = {
  list: () => api.get<ApiEvent[]>('/events'),
  get: (id: string) => api.get<ApiEvent>(`/events/${id}`),
  create: (data: {
    name: string;
    description?: string;
    templateId: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    targetMaturityLevel?: string;
    reassessmentDate?: string;
    respondentIds?: string[];
  }) => api.post<ApiEvent>('/events', data),
  update: (id: string, data: Partial<ApiEvent>) => api.patch<ApiEvent>(`/events/${id}`, data),
  updateRespondents: (id: string, changes: { add?: string[]; remove?: string[] }) =>
    api.patch<{ ok: boolean }>(`/events/${id}/respondents`, changes),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'assessor' | 'respondent';
  status: 'Active' | 'Inactive';
  initials: string;
  departmentId?: string | null;
  groupIds?: string[];
  createdAt?: string;
}

export interface ApiGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface ApiDepartment {
  id: string;
  name: string;
}

export const usersApi = {
  list: () => api.get<ApiUser[]>('/users'),
  get: (id: string) => api.get<ApiUser>(`/users/${id}`),
  create: (data: { name: string; email: string; password: string; role: string; departmentId?: string }) =>
    api.post<ApiUser>('/users', data),
  update: (id: string, data: Partial<ApiUser>) => api.patch<ApiUser>(`/users/${id}`, data),
  // Groups
  groups: () => api.get<ApiGroup[]>('/users/groups'),
  createGroup: (data: { name: string; memberIds: string[] }) => api.post<ApiGroup>('/users/groups', data),
  updateGroup: (id: string, data: { name?: string; memberIds?: string[] }) => api.patch<ApiGroup>(`/users/groups/${id}`, data),
  deleteGroup: (id: string) => api.delete(`/users/groups/${id}`),
  // Departments
  departments: () => api.get<ApiDepartment[]>('/users/departments'),
  createDepartment: (name: string) => api.post<ApiDepartment>('/users/departments', { name }),
  updateDepartment: (id: string, name: string) => api.patch<ApiDepartment>(`/users/departments/${id}`, { name }),
  deleteDepartment: (id: string) => api.delete(`/users/departments/${id}`),
};

// ─── Submissions ──────────────────────────────────────────────────────────────

export interface ApiSubmission {
  id: string;
  eventId: string;
  userId: string;
  answers: Record<string, unknown>;
  submittedAt?: string;
  validatedAt?: string;
  evidenceFiles: ApiEvidenceFile[];
}

export const submissionsApi = {
  list: (eventId: string) => api.get<ApiSubmission[]>(`/submissions?eventId=${eventId}`),
  get: (eventId: string, userId: string) => api.get<ApiSubmission>(`/submissions/${eventId}/${userId}`),
  save: (eventId: string, answers: Record<string, unknown>) =>
    api.put<ApiSubmission>(`/submissions/${eventId}`, { answers }),
  submit: (eventId: string) => api.post<ApiSubmission>(`/submissions/${eventId}/submit`),
  validate: (eventId: string, userId: string) =>
    api.post<{ ok: boolean }>(`/submissions/${eventId}/${userId}/validate`),
  return: (eventId: string, userId: string, feedback?: string) =>
    api.post<{ ok: boolean }>(`/submissions/${eventId}/${userId}/return`, { feedback }),
};

// ─── Evidence Files ───────────────────────────────────────────────────────────

export interface ApiEvidenceFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType?: string;
  blobUrl: string;
  uploadedAt: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  url: string;
  mimeType: string;
}

export async function uploadEvidenceFile(
  file: File,
  eventId: string,
  questionId: string,
  submissionId: string,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('eventId', eventId);
  form.append('questionId', questionId);
  form.append('submissionId', submissionId);

  const res = await fetch(`${BASE}/evidence/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  if (res.status === 401) {
    // Try refresh then retry
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) {
      return uploadEvidenceFile(file, eventId, questionId, submissionId);
    }
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.error ?? `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteEvidenceFile(fileId: string): Promise<void> {
  await api.delete(`/evidence/${fileId}`);
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export interface ApiRecommendation {
  id: string;
  eventId: string;
  sectionName: string;
  gapMagnitude: number;
  status: string;
  currentText: string;
  originalText: string;
  messages: { id: string; role: string; text: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export const recommendationsApi = {
  list: (eventId: string) => api.get<ApiRecommendation[]>(`/recommendations?eventId=${eventId}`),
  generate: (eventId: string) =>
    api.post<ApiRecommendation[]>('/recommendations/generate', { eventId }),
  chat: (recId: string, message: string) =>
    api.post<{ role: string; text: string }>(`/recommendations/${recId}/chat`, { message }),
  update: (recId: string, data: Partial<ApiRecommendation>) =>
    api.patch<ApiRecommendation>(`/recommendations/${recId}`, data),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface ApiTask {
  id: string;
  title: string;
  description: string;
  progressNotes: string;
  recName: string;
  gapWeight: number;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not_Started' | 'In_Progress' | 'Done' | 'Blocked';
  effort: 'Small' | 'Medium' | 'Large';
  startDate?: string;
  dueDate?: string;
  completionPct: number;
  eventId: string;
  recommendationId?: string;
  assigneeId?: string;
  assignee?: { id: string; name: string; initials: string };
  createdAt: string;
  updatedAt: string;}

export const tasksApi = {
  list: (eventId?: string) => api.get<ApiTask[]>(`/tasks${eventId ? `?eventId=${eventId}` : ''}`),
  get: (id: string) => api.get<ApiTask>(`/tasks/${id}`),
  create: (data: Partial<ApiTask>) => api.post<ApiTask>('/tasks', data),
  update: (id: string, data: Partial<ApiTask>) => api.patch<ApiTask>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  addDependency: (taskId: string, dependsOnTaskId: string) =>
    api.post<{ ok: boolean }>(`/tasks/${taskId}/dependencies`, { dependsOnTaskId }),
  removeDependency: (taskId: string, depId: string) =>
    api.delete(`/tasks/${taskId}/dependencies/${depId}`),
};
