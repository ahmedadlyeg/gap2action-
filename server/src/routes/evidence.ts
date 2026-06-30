import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// POST /evidence/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  const { eventId, questionId, submissionId } = req.body;

  let subId = submissionId;
  if (!subId) {
    const sub = await db.prepare('SELECT id FROM submissions WHERE event_id = ? AND user_id = ?').get(eventId, req.user!.userId) as any;
    subId = sub?.id;
    if (!subId) {
      const now = new Date().toISOString();
      subId = uuidv4();
      await db.prepare('INSERT INTO submissions (id, event_id, user_id, answers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(subId, eventId, req.user!.userId, '{}', now, now);
    }
  }

  const id      = uuidv4();
  const now     = new Date().toISOString();
  const baseUrl = `http://localhost:${process.env.PORT ?? 3001}`;
  const blobUrl  = `${baseUrl}/uploads/${req.file.filename}`;
  const blobPath = req.file.path;

  await db.prepare(`INSERT INTO evidence_files (id, submission_id, question_id, name, size_bytes, mime_type, blob_url, blob_path, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, subId, questionId ?? null, req.file.originalname, req.file.size, req.file.mimetype, blobUrl, blobPath, req.user!.userId, now);

  res.json({
    id, name: req.file.originalname,
    size: `${(req.file.size / 1024).toFixed(1)} KB`,
    url: blobUrl, mimeType: req.file.mimetype,
  });
});

// DELETE /evidence/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const file = await db.prepare('SELECT * FROM evidence_files WHERE id = ?').get(req.params.id) as any;
  if (file) {
    try { fs.unlinkSync(file.blob_path); } catch { /* already deleted */ }
    await db.prepare('DELETE FROM evidence_files WHERE id = ?').run(req.params.id);
  }
  res.status(204).end();
});

export default router;
