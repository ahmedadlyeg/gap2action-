import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function parseJson(val: any): any {
  if (Array.isArray(val)) return val; // already parsed (pg returns arrays natively for ARRAY columns)
  if (typeof val === 'string') {
    // Handle PostgreSQL array literal format: {1,2,3,4,5}
    if (val.startsWith('{') && val.endsWith('}')) {
      const inner = val.slice(1, -1);
      return inner === '' ? [] : inner.split(',').map(s => {
        const n = Number(s.trim());
        return isNaN(n) ? s.trim() : n;
      });
    }
    try { return JSON.parse(val); } catch { return []; }
  }
  return val ?? [];
}

async function buildTemplate(row: any) {
  const sections = await db.prepare('SELECT * FROM template_sections WHERE template_id = ? ORDER BY sort_order').all(row.id) as any[];
  const builtSections = await Promise.all(sections.map(async sec => {
    const questions = await db.prepare('SELECT * FROM template_questions WHERE section_id = ? ORDER BY sort_order').all(sec.id) as any[];
    return {
      id: sec.id, name: sec.name, description: sec.description, sortOrder: sec.sort_order,
      questions: await Promise.all(questions.map(async q => {
        const options = await db.prepare('SELECT * FROM template_question_options WHERE question_id = ? ORDER BY sort_order').all(q.id) as any[];
        return {
          id: q.id, text: q.text, guidance: q.guidance, type: q.type,
          required: !!q.required, sortOrder: q.sort_order,
          minLabel: q.min_label ?? undefined, maxLabel: q.max_label ?? undefined,
          ratingScores: parseJson(q.rating_scores),
          yesScore: q.yes_score ?? undefined, noScore: q.no_score ?? undefined,
          options: options.map((o: any) => ({ id: o.id, text: o.text, score: o.score, sortOrder: o.sort_order })),
        };
      })),
    };
  }));

  const fw = row.framework_id
    ? await db.prepare('SELECT id, name FROM frameworks WHERE id = ?').get(row.framework_id) as any
    : null;

  return {
    id: row.id, name: row.name, code: row.code, description: row.description,
    assessmentType: row.assessment_type, version: row.version, status: row.status,
    tagline: row.tagline, definition: row.definition, explanation: row.explanation,
    coverImageUrl: row.cover_image_url,
    categoryId: row.category_id, frameworkId: row.framework_id,
    framework: fw ? { id: fw.id, name: fw.name } : undefined,
    sections: builtSections,
    createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// GET /templates
router.get('/', async (req: Request, res: Response) => {
  const { categoryId } = req.query;
  const rows = categoryId
    ? await db.prepare('SELECT * FROM templates WHERE category_id = ? ORDER BY name').all(categoryId as string) as any[]
    : await db.prepare('SELECT * FROM templates ORDER BY name').all() as any[];
  res.json(await Promise.all(rows.map(buildTemplate)));
});

// GET /templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(await buildTemplate(row));
});

// POST /templates
router.post('/', async (req: Request, res: Response) => {
  const { name, code, description = '', assessmentType, version = '1.0', status = 'Draft',
          categoryId, frameworkId, tagline, definition, explanation, coverImageUrl } = req.body;
  if (!name || !code) { res.status(400).json({ error: 'name and code are required' }); return; }
  const id  = uuidv4();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO templates (id, category_id, framework_id, name, code, description, assessment_type, version, status, tagline, definition, explanation, cover_image_url, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, categoryId ?? null, frameworkId ?? null, name, code, description, assessmentType ?? null,
         version, status, tagline ?? null, definition ?? null, explanation ?? null, coverImageUrl ?? null,
         req.user!.userId, now, now);
  const row = await db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  res.status(201).json(await buildTemplate(row));
});

// PATCH /templates/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const row = await db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, code, description, assessmentType, version, status,
          categoryId, frameworkId, tagline, definition, explanation, coverImageUrl } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE templates SET
    name = COALESCE(?, name), code = COALESCE(?, code), description = COALESCE(?, description),
    assessment_type = COALESCE(?, assessment_type), version = COALESCE(?, version),
    status = COALESCE(?, status), category_id = COALESCE(?, category_id),
    framework_id = COALESCE(?, framework_id), tagline = COALESCE(?, tagline),
    definition = COALESCE(?, definition), explanation = COALESCE(?, explanation),
    cover_image_url = COALESCE(?, cover_image_url), updated_at = ? WHERE id = ?`)
    .run(name ?? null, code ?? null, description ?? null, assessmentType ?? null, version ?? null,
         status ?? null, categoryId ?? null, frameworkId ?? null, tagline ?? null,
         definition ?? null, explanation ?? null, coverImageUrl ?? null, now, req.params.id);
  const updated = await db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any;
  res.json(await buildTemplate(updated));
});

// PUT /templates/:id/sections — full replace of sections + questions + options
router.put('/:id/sections', async (req: Request, res: Response) => {
  const sections: any[] = Array.isArray(req.body) ? req.body : [];
  const templateId = req.params.id;
  console.log(`[PUT /sections] templateId=${templateId} sections=${sections.length}`);

  await db.transaction(async (txDb) => {
    console.log(`[PUT /sections] starting transaction for ${templateId}`);
    await txDb.prepare('DELETE FROM template_sections WHERE template_id = ?').run(templateId);

    const insSection  = txDb.prepare(`INSERT INTO template_sections (id, template_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET template_id=EXCLUDED.template_id, name=EXCLUDED.name, description=EXCLUDED.description, sort_order=EXCLUDED.sort_order`);
    const insQuestion = txDb.prepare(`INSERT INTO template_questions (id, section_id, text, guidance, type, required, sort_order, min_label, max_label, rating_scores, yes_score, no_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET section_id=EXCLUDED.section_id, text=EXCLUDED.text, guidance=EXCLUDED.guidance, type=EXCLUDED.type, required=EXCLUDED.required, sort_order=EXCLUDED.sort_order, min_label=EXCLUDED.min_label, max_label=EXCLUDED.max_label, rating_scores=EXCLUDED.rating_scores, yes_score=EXCLUDED.yes_score, no_score=EXCLUDED.no_score`);
    const insOption   = txDb.prepare(`INSERT INTO template_question_options (id, question_id, text, score, sort_order) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET question_id=EXCLUDED.question_id, text=EXCLUDED.text, score=EXCLUDED.score, sort_order=EXCLUDED.sort_order`);

    for (const sec of sections) {
      const secId = sec.id ?? uuidv4();
      await insSection.run(secId, templateId, sec.name, sec.description ?? '', sec.sortOrder ?? 0);
      for (const q of sec.questions ?? []) {
        const qId = q.id ?? uuidv4();
        await insQuestion.run(qId, secId, q.text, q.guidance ?? '', q.type, q.required ? 1 : 0,
          q.sortOrder ?? 0, q.minLabel ?? null, q.maxLabel ?? null,
          JSON.stringify(q.ratingScores ?? []), q.yesScore ?? null, q.noScore ?? null);
        for (const opt of q.options ?? []) {
          await insOption.run(opt.id ?? uuidv4(), qId, opt.text, opt.score ?? 0, opt.sortOrder ?? 0);
        }
      }
    }
    const now = new Date().toISOString();
    await txDb.prepare('UPDATE templates SET updated_at = ? WHERE id = ?').run(now, templateId);
  });

  res.json({ ok: true });
});

export default router;
