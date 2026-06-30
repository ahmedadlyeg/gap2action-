import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function buildRec(row: any) {
  const messages = await db.prepare('SELECT * FROM recommendation_messages WHERE recommendation_id = ? ORDER BY created_at').all(row.id) as any[];
  return {
    id: row.id, eventId: row.event_id, sectionName: row.section_name,
    gapMagnitude: row.gap_magnitude, status: row.status,
    currentText: row.current_text, originalText: row.original_text,
    messages: messages.map((m: any) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.created_at })),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// GET /recommendations?eventId=
router.get('/', async (req: Request, res: Response) => {
  const { eventId } = req.query;
  if (!eventId) { res.status(400).json({ error: 'eventId query param required' }); return; }
  const rows = await db.prepare('SELECT * FROM recommendations WHERE event_id = ? ORDER BY created_at').all(eventId as string) as any[];
  res.json(await Promise.all(rows.map(buildRec)));
});

// POST /recommendations/generate
router.post('/generate', async (req: Request, res: Response) => {
  const { eventId } = req.body;
  if (!eventId) { res.status(400).json({ error: 'eventId is required' }); return; }

  await db.prepare("DELETE FROM recommendations WHERE event_id = ? AND status = 'AI Draft'").run(eventId);

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
  const sections = await db.prepare(`
    SELECT ts.name FROM template_sections ts
    JOIN templates t ON t.id = ts.template_id
    WHERE t.id = ?`).all(event?.template_id) as any[];

  const now = new Date().toISOString();
  const recs: any[] = [];

  for (let i = 0; i < Math.min(sections.length, 3); i++) {
    const sec = sections[i];
    const gapMagnitude = -(Math.random() * 1.5 + 0.5);
    const text = `Improve ${sec.name}: establish clear standards, assign ownership, and implement regular review cycles to close the identified maturity gap and progress to the next level.`;
    const id  = uuidv4();
    await db.prepare(`INSERT INTO recommendations (id, event_id, section_name, gap_magnitude, status, current_text, original_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, eventId, sec.name, gapMagnitude, 'AI Draft', text, text, now, now);
    const row = await db.prepare('SELECT * FROM recommendations WHERE id = ?').get(id) as any;
    recs.push(await buildRec(row));
  }

  res.json(recs);
});

// POST /recommendations/:id/chat
router.post('/:id/chat', async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: 'message is required' }); return; }
  const now = new Date().toISOString();

  await db.prepare('INSERT INTO recommendation_messages (id, recommendation_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, 'assessor', message, now);

  const rec = await db.prepare('SELECT * FROM recommendations WHERE id = ?').get(req.params.id) as any;
  const aiReply = `Based on the context of "${rec?.section_name}", here's a refined suggestion: ${rec?.current_text} Additionally, consider benchmarking against industry peers to validate your target maturity level.`;
  const aiNow = new Date(Date.now() + 100).toISOString();
  await db.prepare('INSERT INTO recommendation_messages (id, recommendation_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, 'ai', aiReply, aiNow);

  res.json({ role: 'ai', text: aiReply });
});

// PATCH /recommendations/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM recommendations WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const { status, currentText, sectionName, gapMagnitude } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE recommendations SET
    status = COALESCE(?, status), current_text = COALESCE(?, current_text),
    section_name = COALESCE(?, section_name), gap_magnitude = COALESCE(?, gap_magnitude),
    updated_at = ? WHERE id = ?`)
    .run(status ?? null, currentText ?? null, sectionName ?? null, gapMagnitude ?? null, now, req.params.id);
  const updated = await db.prepare('SELECT * FROM recommendations WHERE id = ?').get(req.params.id) as any;
  res.json(await buildRec(updated));
});

export default router;
