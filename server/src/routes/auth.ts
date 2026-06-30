import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function signAccess(userId: string, role: string) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as jwt.SignOptions['expiresIn'],
  });
}

function signRefresh(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}

function setCookies(res: Response, access: string, refresh: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: isProd };
  res.cookie('access_token',  access,  { ...opts, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refresh, { ...opts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const access  = signAccess(user.id, user.role);
  const refresh = signRefresh(user.id);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), user.id, bcrypt.hashSync(refresh, 6), expiresAt);

  setCookies(res, access, refresh);
  res.json({
    user: {
      id: user.id, name: user.name, email: user.email,
      role: user.role, initials: user.initials, departmentId: user.department_id ?? null,
    },
  });
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.status(204).end();
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any;
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }

    const access    = signAccess(user.id, user.role);
    const refresh   = signRefresh(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), user.id, bcrypt.hashSync(refresh, 6), expiresAt);

    setCookies(res, access, refresh);
    res.status(204).end();
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({
    id: user.id, name: user.name, email: user.email,
    role: user.role, initials: user.initials, departmentId: user.department_id ?? null,
  });
});

export default router;
