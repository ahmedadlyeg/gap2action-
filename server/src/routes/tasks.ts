import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function buildTask(row: any) {
  const assignee = row.assignee_id
    ? await db.prepare('SELECT id, name, initials FROM users WHERE id = ?').get(row.assignee_id) as any
    : null;
  return {
    id: row.id, title: row.title, description: row.description,
    progressNotes: row.progress_notes, recName: row.rec_name, gapWeight: row.gap_weight,
    priority: row.priority, status: row.status, effort: row.effort,
    startDate: row.start_date ?? undefined, dueDate: row.due_date ?? undefined,
    completionPct: row.completion_pct,
    eventId: row.event_id, recommendationId: row.recommendation_id ?? undefined,
    assigneeId: row.assignee_id ?? undefined,
    assignee: assignee ? { id: assignee.id, name: assignee.name, initials: assignee.initials } : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// GET /tasks?eventId=
router.get('/', async (req: Request, res: Response) => {
  const { eventId } = req.query;
  const rows = eventId
    ? await db.prepare('SELECT * FROM tasks WHERE event_id = ? ORDER BY created_at').all(eventId as string) as any[]
    : await db.prepare('SELECT * FROM tasks ORDER BY created_at').all() as any[];
  res.json(await Promise.all(rows.map(buildTask)));
});

// GET /tasks/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildTask(row));
});

// POST /tasks
router.post('/', async (req: Request, res: Response) => {
  const { title, description = '', progressNotes = '', recName = '', gapWeight = 0,
          priority = 'Medium', status = 'Not_Started', effort, startDate, dueDate,
          completionPct = 0, eventId, recommendationId, assigneeId } = req.body;
  if (!title || !eventId) { res.status(400).json({ error: 'title and eventId are required' }); return; }
  const id  = uuidv4();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO tasks (id, event_id, recommendation_id, rec_name, gap_weight, assignee_id, title, description, progress_notes, priority, status, effort, start_date, due_date, completion_pct, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, eventId, recommendationId ?? null, recName, gapWeight, assigneeId ?? null,
         title, description, progressNotes, priority, status, effort ?? null,
         startDate ?? null, dueDate ?? null, completionPct, now, now);
  const row = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  res.status(201).json(await buildTask(row));
});

// PATCH /tasks/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const { title, description, progressNotes, recName, gapWeight, priority, status,
          effort, startDate, dueDate, completionPct, assigneeId, recommendationId } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE tasks SET
    title = COALESCE(?, title), description = COALESCE(?, description),
    progress_notes = COALESCE(?, progress_notes), rec_name = COALESCE(?, rec_name),
    gap_weight = COALESCE(?, gap_weight), priority = COALESCE(?, priority),
    status = COALESCE(?, status), effort = COALESCE(?, effort),
    start_date = COALESCE(?, start_date), due_date = COALESCE(?, due_date),
    completion_pct = COALESCE(?, completion_pct),
    assignee_id = COALESCE(?, assignee_id), recommendation_id = COALESCE(?, recommendation_id),
    updated_at = ? WHERE id = ?`)
    .run(title ?? null, description ?? null, progressNotes ?? null, recName ?? null,
         gapWeight ?? null, priority ?? null, status ?? null, effort ?? null,
         startDate ?? null, dueDate ?? null, completionPct ?? null,
         assigneeId ?? null, recommendationId ?? null, now, req.params.id);
  const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  res.json(await buildTask(updated));
});

// DELETE /tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// POST /tasks/:id/dependencies
router.post('/:id/dependencies', async (req: Request, res: Response) => {
  const { dependsOnTaskId } = req.body;
  if (!dependsOnTaskId) { res.status(400).json({ error: 'dependsOnTaskId is required' }); return; }
  await db.prepare('INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(req.params.id, dependsOnTaskId);
  res.json({ ok: true });
});

// DELETE /tasks/:taskId/dependencies/:depId
router.delete('/:taskId/dependencies/:depId', async (req: Request, res: Response) => {
  await db.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?').run(req.params.taskId, req.params.depId);
  res.status(204).end();
});

export default router;
