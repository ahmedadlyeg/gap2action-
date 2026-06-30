import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Cast USER-DEFINED enums and custom ARRAY types to text so pg can parse them
const FW_SELECT = `
  SELECT id, name, description,
    scoring_method::TEXT        AS scoring_method,
    status::TEXT                AS status,
    ARRAY_TO_JSON(allowed_question_types)::TEXT AS allowed_question_types,
    created_at, updated_at, created_by
  FROM frameworks
`;

// DB stores underscore enum values (rating_scale); frontend uses hyphens (rating-scale)
const toFrontend = (v: string) => v.replace(/_/g, '-');
const toDbEnum   = (v: string) => v.replace(/-/g, '_');

function parseAllowedTypes(val: any): string[] {
  let arr: string[] = [];
  if (Array.isArray(val)) arr = val;
  else if (typeof val === 'string') {
    try { const p = JSON.parse(val); arr = Array.isArray(p) ? p : []; } catch { arr = []; }
  }
  return arr.map(toFrontend);
}

async function withLevels(row: any) {
  const levels = await db.prepare('SELECT * FROM framework_maturity_levels WHERE framework_id = ? ORDER BY level').all(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scoringMethod: row.scoring_method,
    status: row.status,
    allowedQuestionTypes: parseAllowedTypes(row.allowed_question_types),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    maturityLevels: levels.map((l: any) => ({
      id: l.id, level: l.level, label: l.label,
      description: l.description, minScore: l.min_score, maxScore: l.max_score,
    })),
  };
}

// GET /frameworks
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.prepare(`${FW_SELECT} ORDER BY name`).all() as any[];
  res.json(await Promise.all(rows.map(withLevels)));
});

// GET /frameworks/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare(`${FW_SELECT} WHERE id = ?`).get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await withLevels(row));
});

// POST /frameworks
router.post('/', async (req: Request, res: Response) => {
  const { name, description = '', scoringMethod = 'simple_average', allowedQuestionTypes = [], status = 'Draft', maturityLevels = [] } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const id  = uuidv4();
  const now = new Date().toISOString();
  // Convert frontend kebab-case to DB underscore enum values, then pass native array
  const dbTypes = (allowedQuestionTypes as string[]).map(toDbEnum);
  await db.prepare(`INSERT INTO frameworks (id, name, description, scoring_method, allowed_question_types, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, description, scoringMethod, dbTypes, status, req.user!.userId, now, now);

  for (const lvl of maturityLevels) {
    await db.prepare('INSERT INTO framework_maturity_levels (id, framework_id, level, label, description, min_score, max_score) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), id, lvl.level, lvl.label, lvl.description ?? '', lvl.minScore ?? 0, lvl.maxScore ?? 5);
  }

  const row = await db.prepare(`${FW_SELECT} WHERE id = ?`).get(id) as any;
  res.status(201).json(await withLevels(row));
});

// PATCH /frameworks/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const existing = await db.prepare(`${FW_SELECT} WHERE id = ?`).get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, description, scoringMethod, allowedQuestionTypes, status, maturityLevels } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE frameworks SET
    name = COALESCE(?, name), description = COALESCE(?, description),
    scoring_method = COALESCE(?, scoring_method),
    allowed_question_types = COALESCE(?, allowed_question_types),
    status = COALESCE(?, status), updated_at = ? WHERE id = ?`)
    .run(name ?? null, description ?? null, scoringMethod ?? null,
      allowedQuestionTypes ? (allowedQuestionTypes as string[]).map(toDbEnum) : null,
      status ?? null, now, req.params.id);

  if (maturityLevels) {
    await db.prepare('DELETE FROM framework_maturity_levels WHERE framework_id = ?').run(req.params.id);
    for (const lvl of maturityLevels) {
      await db.prepare('INSERT INTO framework_maturity_levels (id, framework_id, level, label, description, min_score, max_score) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(lvl.id ?? uuidv4(), req.params.id, lvl.level, lvl.label, lvl.description ?? '', lvl.minScore ?? 0, lvl.maxScore ?? 5);
    }
  }

  const updated = await db.prepare(`${FW_SELECT} WHERE id = ?`).get(req.params.id) as any;
  res.json(await withLevels(updated));
});

// DELETE /frameworks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await db.prepare('DELETE FROM frameworks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
