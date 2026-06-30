import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function buildUser(row: any): Promise<any> {
  const groupIds = (await db.prepare('SELECT group_id FROM user_group_members WHERE user_id = ?').all(row.id) as any[]).map(r => r.group_id);
  return {
    id: row.id, name: row.name, email: row.email, role: row.role,
    status: row.status, initials: row.initials,
    departmentId: row.department_id ?? null, groupIds,
    createdAt: row.created_at,
  };
}

// GET /users
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.prepare('SELECT * FROM users ORDER BY name').all() as any[];
  res.json(await Promise.all(rows.map(buildUser)));
});

// GET /users/departments — MUST come before /:id
router.get('/departments', async (_req: Request, res: Response) => {
  const rows = await db.prepare('SELECT * FROM departments ORDER BY name').all() as any[];
  res.json(rows.map((r: any) => ({ id: r.id, name: r.name })));
});

// GET /users/groups — MUST come before /:id
router.get('/groups', async (_req: Request, res: Response) => {
  const groups = await db.prepare('SELECT * FROM user_groups ORDER BY name').all() as any[];
  res.json(await Promise.all(groups.map(async (g: any) => {
    const memberIds = (await db.prepare('SELECT user_id FROM user_group_members WHERE group_id = ?').all(g.id) as any[]).map(r => r.user_id);
    return { id: g.id, name: g.name, memberIds };
  })));
});

// GET /users/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildUser(row));
});

// POST /users
router.post('/', async (req: Request, res: Response) => {
  const { name, email, password, role, departmentId } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'name, email, password, and role are required' }); return;
  }
  const id   = uuidv4();
  const now  = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 5).toUpperCase();
  await db.prepare('INSERT INTO users (id, name, email, password_hash, role, status, department_id, initials, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, email, hash, role, 'Active', departmentId ?? null, initials, now, now);
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  res.status(201).json(await buildUser(row));
});

// PATCH /users/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, email, role, status, departmentId } = req.body;
  const now = new Date().toISOString();
  const initials = name ? name.split(' ').map((w: string) => w[0]).join('').slice(0, 5).toUpperCase() : null;
  await db.prepare(`UPDATE users SET
    name = COALESCE(?, name), email = COALESCE(?, email),
    initials = COALESCE(?, initials), role = COALESCE(?, role),
    status = COALESCE(?, status), department_id = COALESCE(?, department_id),
    updated_at = ? WHERE id = ?`)
    .run(name ?? null, email ?? null, initials, role ?? null, status ?? null, departmentId ?? null, now, req.params.id);
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  res.json(await buildUser(updated));
});

// ── Groups ────────────────────────────────────────────────────────────────────

// POST /users/groups
router.post('/groups', async (req: Request, res: Response) => {
  const { name, memberIds = [] } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const id  = uuidv4();
  await db.prepare('INSERT INTO user_groups (id, name) VALUES (?, ?)').run(id, name);
  for (const uid of memberIds) {
    await db.prepare('INSERT INTO user_group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(id, uid);
  }
  const memberIdsOut = (await db.prepare('SELECT user_id FROM user_group_members WHERE group_id = ?').all(id) as any[]).map(r => r.user_id);
  res.status(201).json({ id, name, memberIds: memberIdsOut });
});

// PATCH /users/groups/:id
router.patch('/groups/:id', async (req: Request, res: Response) => {
  const { name, memberIds } = req.body;
  if (name) await db.prepare('UPDATE user_groups SET name = ? WHERE id = ?').run(name, req.params.id);
  if (memberIds) {
    await db.prepare('DELETE FROM user_group_members WHERE group_id = ?').run(req.params.id);
    for (const uid of memberIds) {
      await db.prepare('INSERT INTO user_group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(req.params.id, uid);
    }
  }
  const g = await db.prepare('SELECT * FROM user_groups WHERE id = ?').get(req.params.id) as any;
  const mids = (await db.prepare('SELECT user_id FROM user_group_members WHERE group_id = ?').all(req.params.id) as any[]).map(r => r.user_id);
  res.json({ id: g.id, name: g.name, memberIds: mids });
});

// DELETE /users/groups/:id
router.delete('/groups/:id', async (req: Request, res: Response) => {
  await db.prepare('DELETE FROM user_groups WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ── Departments ───────────────────────────────────────────────────────────────

// POST /users/departments
router.post('/departments', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const id = uuidv4();
  await db.prepare('INSERT INTO departments (id, name) VALUES (?, ?)').run(id, name);
  res.status(201).json({ id, name });
});

// PATCH /users/departments/:id
router.patch('/departments/:id', async (req: Request, res: Response) => {
  const { name } = req.body;
  await db.prepare('UPDATE departments SET name = ? WHERE id = ?').run(name, req.params.id);
  const row = await db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) as any;
  res.json({ id: row.id, name: row.name });
});

// DELETE /users/departments/:id
router.delete('/departments/:id', async (req: Request, res: Response) => {
  await db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
