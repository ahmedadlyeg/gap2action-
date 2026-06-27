import { authApi, ApiError } from './api';
import { users } from './mockData';
import type { User } from '@/types';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

const SESSION_KEY = 'g2a-mock-user';

function toUser(u: (typeof users)[0]): User {
  return { ...u } as User;
}

function apiUserToUser(u: { id: string; name: string; email: string; role: string; initials: string; departmentId?: string | null }): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as User['role'],
    initials: u.initials,
    status: 'Active',
    department: u.departmentId ?? undefined,
  } as unknown as User;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const { user } = await authApi.login(email, password);
    return { success: true, user: apiUserToUser(user) };
  } catch (err) {
    // Backend unreachable — fall back to mock auth
    if (!(err instanceof ApiError)) {
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!found) return { success: false, error: 'No account found with that email.' };
      if (password !== 'password') return { success: false, error: 'Demo password is "password".' };
      const mockUser = toUser(found);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
      return { success: true, user: mockUser };
    }
    if (err.status === 401) return { success: false, error: 'Invalid email or password.' };
    if (err.status === 403) return { success: false, error: err.message };
    return { success: false, error: 'An error occurred. Please try again.' };
  }
}

export async function getMe(): Promise<User | null> {
  // Check mock session first — avoids a network call when backend isn't running
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try { return JSON.parse(stored) as User; } catch { /* ignore */ }
  }

  try {
    const u = await authApi.me();
    return apiUserToUser(u);
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  sessionStorage.removeItem(SESSION_KEY);
  try {
    await authApi.logout();
  } catch {
    // Backend may not be running — that's fine
  }
}
