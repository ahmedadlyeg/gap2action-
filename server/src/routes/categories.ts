import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function withTemplateCount(row: any) {
  const result = await db.prepare('SELECT COUNT(*) as c FROM templates WHERE category_id = ?').get(row.id) as any;
  return { ...row, templateCount: Number(result?.c ?? 0) };
}

// GET /categories
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.prepare('SELECT * FROM categories ORDER BY name').all() as any[];
  res.json(await Promise.all(rows.map(withTemplateCount)));
});

// GET /categories/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await withTemplateCount(row));
});

// POST /categories
router.post('/', async (req: Request, res: Response) => {
  const { name, description = '', icon = '', color = '#2563EB', status = 'Active' } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const id  = uuidv4();
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO categories (id, name, description, icon, color, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, description, icon, color, status, now, now);
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  res.status(201).json(await withTemplateCount(row));
});

// PATCH /categories/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, description, icon, color, status } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE categories SET
    name = COALESCE(?, name), description = COALESCE(?, description),
    icon = COALESCE(?, icon), color = COALESCE(?, color),
    status = COALESCE(?, status), updated_at = ?
    WHERE id = ?`).run(name ?? null, description ?? null, icon ?? null, color ?? null, status ?? null, now, req.params.id);
  const updated = await db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as any;
  res.json(await withTemplateCount(updated));
});

// DELETE /categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
