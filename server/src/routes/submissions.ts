import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function parseJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
  return val ?? {};
}

async function buildSubmission(row: any) {
  const files = await db.prepare('SELECT * FROM evidence_files WHERE submission_id = ?').all(row.id) as any[];
  return {
    id: row.id, eventId: row.event_id, userId: row.user_id,
    answers: parseJson(row.answers),
    submittedAt: row.submitted_at ?? undefined,
    validatedAt: row.validated_at ?? undefined,
    evidenceFiles: files.map((f: any) => ({
      id: f.id, name: f.name, sizeBytes: f.size_bytes,
      mimeType: f.mime_type, blobUrl: f.blob_url, uploadedAt: f.uploaded_at,
    })),
  };
}

async function recalcCompletionRate(eventId: string) {
  const respondents = await db.prepare('SELECT * FROM event_respondents WHERE event_id = ?').all(eventId) as any[];
  if (!respondents.length) return;
  const submitted = respondents.filter((r: any) => !['Not Started', 'In Progress', 'Returned'].includes(r.status)).length;
  const rate = Math.round((submitted / respondents.length) * 100);
  await db.prepare('UPDATE events SET completion_rate = ?, updated_at = ? WHERE id = ?').run(rate, new Date().toISOString(), eventId);
}

// GET /submissions?eventId=
router.get('/', async (req: Request, res: Response) => {
  const { eventId } = req.query;
  if (!eventId) { res.status(400).json({ error: 'eventId query param required' }); return; }
  const rows = await db.prepare('SELECT * FROM submissions WHERE event_id = ?').all(eventId as string) as any[];
  res.json(await Promise.all(rows.map(buildSubmission)));
});

// GET /submissions/:eventId/:userId
router.get('/:eventId/:userId', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM submissions WHERE event_id = ? AND user_id = ?').get(req.params.eventId, req.params.userId) as any;
  if (!row) {
    res.json({ id: null, eventId: req.params.eventId, userId: req.params.userId, answers: {}, evidenceFiles: [] });
    return;
  }
  res.json(await buildSubmission(row));
});

// PUT /submissions/:eventId — save draft answers
router.put('/:eventId', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { answers = {} } = req.body;
  const now = new Date().toISOString();

  let row = await db.prepare('SELECT * FROM submissions WHERE event_id = ? AND user_id = ?').get(req.params.eventId, userId) as any;
  if (!row) {
    const id = uuidv4();
    await db.prepare('INSERT INTO submissions (id, event_id, user_id, answers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.params.eventId, userId, JSON.stringify(answers), now, now);
    row = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as any;
  } else {
    await db.prepare('UPDATE submissions SET answers = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(answers), now, row.id);
    row = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(row.id) as any;
  }

  const countRow = await db.prepare(`
    SELECT COUNT(*) as c FROM template_questions tq
    JOIN template_sections ts ON ts.id = tq.section_id
    JOIN templates t ON t.id = ts.template_id
    JOIN events e ON e.template_id = t.id
    WHERE e.id = ?`).get(req.params.eventId) as any;
  const questionCount = Number(countRow?.c ?? 0);
  const answeredCount = Object.keys(answers).length;
  const pct = questionCount > 0 ? Math.min(100, Math.round((answeredCount / questionCount) * 100)) : 0;
  await db.prepare('UPDATE event_respondents SET completion_pct = ?, status = ?, last_activity = ? WHERE event_id = ? AND user_id = ?')
    .run(pct, pct > 0 ? 'In Progress' : 'Not Started', now, req.params.eventId, userId);

  res.json(await buildSubmission(row));
});

// POST /submissions/:eventId/submit
router.post('/:eventId/submit', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const now = new Date().toISOString();

  let row = await db.prepare('SELECT * FROM submissions WHERE event_id = ? AND user_id = ?').get(req.params.eventId, userId) as any;
  if (!row) {
    const id = uuidv4();
    await db.prepare('INSERT INTO submissions (id, event_id, user_id, answers, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.eventId, userId, '{}', now, now, now);
    row = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as any;
  } else {
    await db.prepare('UPDATE submissions SET submitted_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id);
    row = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(row.id) as any;
  }
  await db.prepare('UPDATE event_respondents SET status = ?, completion_pct = 100, last_activity = ? WHERE event_id = ? AND user_id = ?')
    .run('Submitted', now, req.params.eventId, userId);
  await recalcCompletionRate(req.params.eventId);

  res.json(await buildSubmission(row));
});

// POST /submissions/:eventId/:userId/validate
router.post('/:eventId/:userId/validate', async (req: Request, res: Response) => {
  const now = new Date().toISOString();
  await db.prepare('UPDATE submissions SET validated_at = ?, updated_at = ? WHERE event_id = ? AND user_id = ?')
    .run(now, now, req.params.eventId, req.params.userId);
  await db.prepare('UPDATE event_respondents SET status = ?, last_activity = ? WHERE event_id = ? AND user_id = ?')
    .run('Validated', now, req.params.eventId, req.params.userId);
  await recalcCompletionRate(req.params.eventId);
  res.json({ ok: true });
});

// POST /submissions/:eventId/:userId/return
router.post('/:eventId/:userId/return', async (req: Request, res: Response) => {
  const { feedback = '' } = req.body;
  const now = new Date().toISOString();
  await db.prepare('UPDATE submissions SET submitted_at = NULL, validated_at = NULL, updated_at = ? WHERE event_id = ? AND user_id = ?')
    .run(now, req.params.eventId, req.params.userId);
  await db.prepare('UPDATE event_respondents SET status = ?, feedback = ?, last_activity = ?, return_count = return_count + 1 WHERE event_id = ? AND user_id = ?')
    .run('Returned', feedback, now, req.params.eventId, req.params.userId);
  res.json({ ok: true });
});

export default router;
