import type { User } from '@/types';
import { users } from './mockData';

const CREDENTIALS: Record<string, string> = {
  'admin@nudj.com': 'password123',
  'assessor@nudj.com': 'password123',
  'respondent@nudj.com': 'password123',
};

export interface AuthResult {
  success: boolean;
  user?: User;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 800));

  const expected = CREDENTIALS[email.toLowerCase().trim()];
  if (!expected || expected !== password) {
    return { success: false };
  }

  const user = users.find(u => u.email === email.toLowerCase().trim());
  if (!user) return { success: false };

  return { success: true, user };
}
