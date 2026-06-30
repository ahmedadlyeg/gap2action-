import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function buildRespondents(eventId: string) {
  const rows = await db.prepare('SELECT er.*, u.name, u.initials, u.email FROM event_respondents er JOIN users u ON u.id = er.user_id WHERE er.event_id = ?').all(eventId) as any[];
  return rows.map(r => ({
    eventId: r.event_id, userId: r.user_id,
    status: r.status, completionPct: r.completion_pct,
    lastActivity: r.last_activity ?? undefined, feedback: r.feedback ?? undefined,
    user: { id: r.user_id, name: r.name, initials: r.initials, email: r.email },
  }));
}

async function buildEvent(row: any) {
  const template = await db.prepare('SELECT id, name, code FROM templates WHERE id = ?').get(row.template_id) as any;
  const owner    = await db.prepare('SELECT id, name, initials FROM users WHERE id = ?').get(row.owner_id) as any;
  return {
    id: row.id, name: row.name, description: row.description, status: row.status,
    startDate: row.start_date, endDate: row.end_date,
    targetMaturityLevel: row.target_maturity_level, reassessmentDate: row.reassessment_date,
    completionRate: row.completion_rate, score: row.score ?? undefined,
    maturityLevel: row.maturity_level ?? undefined, trend: row.trend ?? undefined,
    templateId: row.template_id, ownerId: row.owner_id,
    template: template ? { id: template.id, name: template.name, code: template.code } : undefined,
    owner: owner ? { id: owner.id, name: owner.name, initials: owner.initials } : undefined,
    respondents: await buildRespondents(row.id),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// GET /events
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.prepare('SELECT * FROM events ORDER BY created_at DESC').all() as any[];
  res.json(await Promise.all(rows.map(buildEvent)));
});

// GET /events/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildEvent(row));
});

// POST /events
router.post('/', async (req: Request, res: Response) => {
  const { name, description = '', templateId, status = 'Draft',
          startDate, endDate, targetMaturityLevel, reassessmentDate, respondentIds = [] } = req.body;
  if (!name || !templateId) { res.status(400).json({ error: 'name and templateId are required' }); return; }
  const id  = uuidv4();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO events (id, template_id, owner_id, name, description, status, start_date, end_date, target_maturity_level, reassessment_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, templateId, req.user!.userId, name, description, status,
         startDate ?? null, endDate ?? null, targetMaturityLevel ?? null, reassessmentDate ?? null, now, now);

  for (const uid of respondentIds) {
    await db.prepare('INSERT INTO event_respondents (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(id, uid);
  }

  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
  res.status(201).json(await buildEvent(row));
});

// PATCH /events/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, description, status, startDate, endDate, targetMaturityLevel, reassessmentDate,
          completionRate, score, maturityLevel, trend } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE events SET
    name = COALESCE(?, name), description = COALESCE(?, description),
    status = COALESCE(?, status), start_date = COALESCE(?, start_date),
    end_date = COALESCE(?, end_date), target_maturity_level = COALESCE(?, target_maturity_level),
    reassessment_date = COALESCE(?, reassessment_date),
    completion_rate = COALESCE(?, completion_rate), score = COALESCE(?, score),
    maturity_level = COALESCE(?, maturity_level), trend = COALESCE(?, trend),
    updated_at = ? WHERE id = ?`)
    .run(name ?? null, description ?? null, status ?? null,
         startDate ?? null, endDate ?? null, targetMaturityLevel ?? null, reassessmentDate ?? null,
         completionRate ?? null, score ?? null, maturityLevel ?? null, trend ?? null,
         now, req.params.id);
  const updated = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any;
  res.json(await buildEvent(updated));
});

// PATCH /events/:id/respondents — add/remove respondents
router.patch('/:id/respondents', async (req: Request, res: Response) => {
  const { add = [], remove = [] } = req.body as { add?: string[]; remove?: string[] };
  await db.transaction(async (txDb) => {
    for (const uid of add) {
      await txDb.prepare('INSERT INTO event_respondents (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(req.params.id, uid);
    }
    for (const uid of remove) {
      await txDb.prepare('DELETE FROM event_respondents WHERE event_id = ? AND user_id = ?').run(req.params.id, uid);
    }
    const now = new Date().toISOString();
    await txDb.prepare('UPDATE events SET updated_at = ? WHERE id = ?').run(now, req.params.id);
  });
  res.json({ ok: true });
});

export default router;
