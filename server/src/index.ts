import dotenv from 'dotenv';
dotenv.config();

import 'express-async-errors'; // patches Express 4 to forward async route errors to next()
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRouter          from './routes/auth';
import categoriesRouter    from './routes/categories';
import frameworksRouter    from './routes/frameworks';
import templatesRouter     from './routes/templates';
import eventsRouter        from './routes/events';
import usersRouter         from './routes/users';
import submissionsRouter   from './routes/submissions';
import evidenceRouter      from './routes/evidence';
import recommendationsRouter from './routes/recommendations';
import tasksRouter         from './routes/tasks';
import { errorHandler }    from './middleware/error';
import db from './db';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ── One-time schema fixes (idempotent) ────────────────────────────────────────
// Convert any PostgreSQL ENUM columns that should be plain TEXT.
// These arise when the DB was bootstrapped from a Prisma schema that used enums.
async function fixSchema() {
  const fixes = [
    // template_questions.type — was a "QuestionType" enum in old Prisma schema
    `DO $$ BEGIN
       ALTER TABLE template_questions ALTER COLUMN type TYPE TEXT USING type::TEXT;
     EXCEPTION WHEN others THEN NULL; END $$`,
    // template_questions.rating_scores — was INTEGER[] in old Prisma schema;
    // convert to TEXT storing JSON so we can use JSON.stringify on write and JSON.parse on read.
    // USING clause converts PostgreSQL array literal {1,2,3} → JSON string [1,2,3].
    `DO $$ BEGIN
       ALTER TABLE template_questions
         ALTER COLUMN rating_scores TYPE TEXT
         USING COALESCE(array_to_json(rating_scores)::TEXT, '[]');
     EXCEPTION WHEN others THEN NULL; END $$`,
  ];
  for (const sql of fixes) {
    try { await db.exec(sql); } catch { /* already TEXT or table absent */ }
  }
  console.log('[startup] schema fixes applied');
}
fixSchema().catch(err => console.error('[startup] schema fix error:', err));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── Static file serving for evidence uploads ──────────────────────────────────
const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
app.use('/uploads', express.static(uploadsDir));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',            authRouter);
app.use('/api/categories',      categoriesRouter);
app.use('/api/frameworks',      frameworksRouter);
app.use('/api/templates',       templatesRouter);
app.use('/api/events',          eventsRouter);
app.use('/api/users',           usersRouter);
app.use('/api/submissions',     submissionsRouter);
app.use('/api/evidence',        evidenceRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/tasks',           tasksRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Gap2Action API running on http://localhost:${PORT}/api`);
});

export default app;
