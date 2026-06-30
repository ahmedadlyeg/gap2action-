/**
 * seed.ts — Inserts all mock data into the Gap2Action SQLite database.
 * Run with: ts-node src/seed.ts
 */
import db from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ─── ID maps (short mock IDs → real UUIDs) ───────────────────────────────────

const deptMap: Record<string, string> = {
  d1: uuidv4(), d2: uuidv4(), d3: uuidv4(), d4: uuidv4(), d5: uuidv4(),
};
const userMap: Record<string, string> = {
  u1: uuidv4(), u2: uuidv4(), u3: uuidv4(), u4: uuidv4(),
  u5: uuidv4(), u6: uuidv4(), u7: uuidv4(), u8: uuidv4(),
};
const groupMap: Record<string, string> = { g1: uuidv4(), g2: uuidv4() };
const catMap: Record<string, string>  = { cat1: uuidv4(), cat2: uuidv4(), cat3: uuidv4() };
const fwMap: Record<string, string>   = { fw1: uuidv4(), fw2: uuidv4(), fw3: uuidv4() };
const tmplMap: Record<string, string> = {
  t1: uuidv4(), t2: uuidv4(), t2b: uuidv4(), t3: uuidv4(), t4: uuidv4(),
};
const evtMap: Record<string, string>  = {
  e1: uuidv4(), e2: uuidv4(), e3: uuidv4(), e4: uuidv4(), e5: uuidv4(),
};
const recMap: Record<string, string>  = { r1: uuidv4(), r2: uuidv4() };
const taskMap: Record<string, string> = { task1: uuidv4(), task2: uuidv4() };

const now = new Date().toISOString();
const pwHash = bcrypt.hashSync('password', 10);

const run = db.transaction(() => {
  // ── 1. Departments ──────────────────────────────────────────────────────────
  const insertDept = db.prepare(`INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)`);
  [
    [deptMap.d1, 'Enterprise Architecture'],
    [deptMap.d2, 'Digital Strategy'],
    [deptMap.d3, 'IT Operations'],
    [deptMap.d4, 'Finance'],
    [deptMap.d5, 'Human Resources'],
  ].forEach(r => insertDept.run(...r));

  // ── 2. Users ─────────────────────────────────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status, department_id, initials, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [userMap.u1, 'Alexandra Mitchell', 'admin@nudj.com',      pwHash, 'admin',      'Active',   deptMap.d1, 'AM', now, now],
    [userMap.u2, 'James Carter',       'assessor@nudj.com',   pwHash, 'assessor',   'Active',   deptMap.d2, 'JC', now, now],
    [userMap.u3, 'Sarah Chen',         'respondent@nudj.com', pwHash, 'respondent', 'Active',   deptMap.d3, 'SC', now, now],
    [userMap.u4, 'David Okafor',       'david@nudj.com',      pwHash, 'respondent', 'Inactive', deptMap.d4, 'DO', now, now],
    [userMap.u5, 'Priya Nair',         'priya@nudj.com',      pwHash, 'respondent', 'Active',   deptMap.d2, 'PN', now, now],
    [userMap.u6, 'Marcus Webb',        'marcus@nudj.com',     pwHash, 'respondent', 'Active',   deptMap.d1, 'MW', now, now],
    [userMap.u7, 'Aisha Patel',        'aisha@nudj.com',      pwHash, 'respondent', 'Active',   deptMap.d4, 'AP', now, now],
    [userMap.u8, 'Carlos Díaz',        'carlos@nudj.com',     pwHash, 'respondent', 'Active',   deptMap.d5, 'CD', now, now],
  ].forEach(r => insertUser.run(...r));

  // ── 3. User Groups ──────────────────────────────────────────────────────────
  const insertGroup = db.prepare(`INSERT OR IGNORE INTO user_groups (id, name) VALUES (?, ?)`);
  insertGroup.run(groupMap.g1, 'EA Core Team');
  insertGroup.run(groupMap.g2, 'Digital Transformation Group');

  // ── 4. Group Members ────────────────────────────────────────────────────────
  const insertMember = db.prepare(`INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)`);
  [[groupMap.g1, userMap.u1], [groupMap.g1, userMap.u2], [groupMap.g1, userMap.u6],
   [groupMap.g2, userMap.u2], [groupMap.g2, userMap.u3], [groupMap.g2, userMap.u5]
  ].forEach(([g, u]) => insertMember.run(g, u));

  // ── 5. Categories ───────────────────────────────────────────────────────────
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, description, icon, color, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [catMap.cat1, 'Enterprise Architecture',
      'Assess the maturity of EA practices, governance, and capability across the organization.',
      'building-2', '#2563EB', 'Active', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'],
    [catMap.cat2, 'Digital Transformation',
      'Evaluate digital readiness, innovation capability, and technology adoption maturity.',
      'zap', '#7C3AED', 'Active', '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'],
    [catMap.cat3, 'Cybersecurity Readiness',
      "Evaluate the organization's security posture, controls maturity, and incident response capability.",
      'shield', '#DC2626', 'Archived', '2025-06-10T09:00:00Z', '2025-06-10T09:00:00Z'],
  ].forEach(r => insertCat.run(...r));

  // ── 6. Frameworks ───────────────────────────────────────────────────────────
  const insertFw = db.prepare(`
    INSERT OR IGNORE INTO frameworks (id, name, description, scoring_method, allowed_question_types, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [fwMap.fw1, 'EA Maturity Framework',
      'Comprehensive framework for assessing enterprise architecture maturity across all capability dimensions.',
      'weighted_section',
      JSON.stringify(['single-choice','multi-choice','rating-scale','yes-no','free-text','yes-no-partial','percentage','frequency']),
      'Active', userMap.u1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
    [fwMap.fw2, 'Digital Readiness Framework',
      'Evaluates digital readiness and transformation capability across business and technology dimensions.',
      'simple_average',
      JSON.stringify(['rating-scale','yes-no','yes-no-partial','free-text']),
      'Active', userMap.u1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
    [fwMap.fw3, 'Governance Audit Framework',
      'Structured audit framework for evaluating governance compliance and policy adherence.',
      'categorical_weight',
      JSON.stringify(['yes-no','yes-no-partial','single-choice','free-text','percentage']),
      'Draft', userMap.u1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
  ].forEach(r => insertFw.run(...r));

  // ── 7. Maturity Levels ──────────────────────────────────────────────────────
  const insertLevel = db.prepare(`
    INSERT OR IGNORE INTO framework_maturity_levels (id, framework_id, level, label, description, min_score, max_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const fw1Levels = [
    [1, 'Initial',                 'Processes are ad hoc and unpredictable.',                          0,   1.9],
    [2, 'Developing',              'Practices exist but are inconsistently applied.',                  2.0, 2.9],
    [3, 'Defined',                 'Processes are documented and standardised.',                       3.0, 3.4],
    [4, 'Quantitatively Managed',  'Processes are measured and controlled.',                           3.5, 4.4],
    [5, 'Optimising',              'Continuous improvement is institutionalised.',                     4.5, 5.0],
  ];
  const fw2Levels = [
    [1, 'Unaware',      'No awareness of digital transformation needs.',                    0,   1.9],
    [2, 'Exploring',    'Beginning to explore digital opportunities.',                      2.0, 2.9],
    [3, 'Piloting',     'Running pilot digital initiatives.',                               3.0, 3.4],
    [4, 'Scaling',      'Scaling digital capabilities across the organisation.',            3.5, 4.4],
    [5, 'Transforming', 'Fully digitally transformed and continuously evolving.',           4.5, 5.0],
  ];
  const fw3Levels = [
    [1, 'Non-Compliant', 'Significant governance gaps and policy violations.',              0,   1.9],
    [2, 'Partial',       'Some governance controls in place but incomplete.',               2.0, 2.9],
    [3, 'Compliant',     'Meeting minimum governance and compliance requirements.',         3.0, 3.4],
    [4, 'Established',   'Robust governance framework consistently applied.',               3.5, 4.4],
    [5, 'Exemplary',     'Governance best practices with continuous improvement.',          4.5, 5.0],
  ];
  [...fw1Levels.map(l => [fwMap.fw1, ...l]),
   ...fw2Levels.map(l => [fwMap.fw2, ...l]),
   ...fw3Levels.map(l => [fwMap.fw3, ...l]),
  ].forEach(([fwId, lvl, label, desc, min, max]) =>
    insertLevel.run(uuidv4(), fwId, lvl, label, desc, min, max)
  );

  // ── 8. Templates ────────────────────────────────────────────────────────────
  const insertTmpl = db.prepare(`
    INSERT OR IGNORE INTO templates (id, category_id, framework_id, name, code, description, assessment_type, version, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [tmplMap.t1,  catMap.cat1, fwMap.fw1, 'EA Maturity Assessment',      'EA-MAT-v2', 'Comprehensive evaluation of enterprise architecture maturity across five domains.', 'Maturity',   '2.1', 'Active',   userMap.u1, '2026-01-20T09:00:00Z', '2026-04-10T14:30:00Z'],
    [tmplMap.t2,  catMap.cat1, fwMap.fw1, 'EA Governance Readiness',     'EA-GOV-v1', 'Targeted assessment of EA governance frameworks, policies, and compliance posture.',  'Readiness',  '1.3', 'Active',   userMap.u1, '2026-02-05T09:00:00Z', '2026-03-18T11:00:00Z'],
    [tmplMap.t2b, catMap.cat1, fwMap.fw1, 'EA Capability Baseline',      'EA-CAP-v1', 'Baseline capability assessment for EA functions across business units.',              'Capability', '1.0', 'Archived', userMap.u1, '2025-09-01T09:00:00Z', '2025-12-01T10:00:00Z'],
    [tmplMap.t3,  catMap.cat2, fwMap.fw2, 'Digital Maturity Index',      'DT-MAT-v1', 'Holistic evaluation of digital capabilities, data maturity, and transformation readiness.', 'Maturity', '1.0', 'Active', userMap.u2, '2026-03-01T09:00:00Z', '2026-04-22T09:00:00Z'],
    [tmplMap.t4,  catMap.cat2, fwMap.fw2, 'Innovation Capability Survey','DT-INN-v1', "Measures the organization's capacity to ideate, experiment, and scale innovation.",  null,         '0.5', 'Draft',    userMap.u2, '2026-05-10T09:00:00Z', '2026-06-01T16:00:00Z'],
  ].forEach(r => insertTmpl.run(...r));

  // ── 9-11. Sections, Questions, Options (sample structure for t1) ─────────────
  const insertSection = db.prepare(`
    INSERT OR IGNORE INTO template_sections (id, template_id, name, description, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT OR IGNORE INTO template_questions (id, section_id, text, guidance, type, required, sort_order, min_label, max_label, rating_scores, yes_score, no_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOption = db.prepare(`
    INSERT OR IGNORE INTO template_question_options (id, question_id, text, score, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Sample sections for EA Maturity Assessment (t1)
  const t1Sections = [
    { name: 'EA Strategy & Vision',        desc: 'Assesses strategic alignment of EA with business goals.' },
    { name: 'Architecture Governance',      desc: 'Evaluates governance structures, policies, and decision-making.' },
    { name: 'Business Architecture',        desc: 'Examines business process and capability architecture maturity.' },
    { name: 'Data & Information Architecture', desc: 'Reviews data strategy, governance, and information management.' },
    { name: 'Technology Architecture',      desc: 'Assesses infrastructure, platforms, and technology standards.' },
  ];
  for (let i = 0; i < t1Sections.length; i++) {
    const secId = uuidv4();
    insertSection.run(secId, tmplMap.t1, t1Sections[i].name, t1Sections[i].desc, i);

    // Add 2 sample questions per section
    const q1Id = uuidv4();
    insertQuestion.run(
      q1Id, secId,
      `To what extent does ${t1Sections[i].name} align with overall business strategy?`,
      'Consider formal documentation, executive endorsement, and evidence of regular review.',
      'rating-scale', 1, 0,
      'Not at all', 'Fully aligned',
      JSON.stringify([1, 2, 3, 4, 5]), null, null
    );

    const q2Id = uuidv4();
    insertQuestion.run(
      q2Id, secId,
      `Are ${t1Sections[i].name} policies formally documented and actively enforced?`,
      'Look for policy documents, approval records, and audit trail.',
      'yes-no', 1, 1,
      null, null, '[]', 1, 0
    );

    // Add options for a single-choice question in first section only
    if (i === 0) {
      const q3Id = uuidv4();
      insertQuestion.run(
        q3Id, secId,
        'Which best describes your EA maturity journey?',
        'Select the option that most closely matches your current state.',
        'single-choice', 1, 2,
        null, null, '[]', null, null
      );
      const opts = [
        ['No formal EA practice', 1],
        ['Informal, ad-hoc EA activities', 2],
        ['Structured EA programme in place', 3],
        ['EA integrated across the enterprise', 4],
        ['EA-led continuous improvement culture', 5],
      ];
      opts.forEach(([text, score], idx) => insertOption.run(uuidv4(), q3Id, text, score, idx));
    }
  }

  // Minimal section for t2
  const t2SecId = uuidv4();
  insertSection.run(t2SecId, tmplMap.t2, 'Governance Foundations', 'Evaluates core governance structures and policies.', 0);
  const t2q1 = uuidv4();
  insertQuestion.run(t2q1, t2SecId, 'Does a formal EA governance board exist?', 'Consider charter, membership, and meeting cadence.', 'yes-no', 1, 0, null, null, '[]', 1, 0);

  // ── 12. Events ──────────────────────────────────────────────────────────────
  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (id, template_id, owner_id, name, description, status, start_date, end_date, target_maturity_level, reassessment_date, completion_rate, score, maturity_level, trend, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [evtMap.e1, tmplMap.t1, userMap.u2, 'EA Maturity Assessment — Q3 2026', 'Quarterly maturity review for the Enterprise Architecture function.', 'Open', '2026-07-01', '2026-09-30', 'Defined', '2027-01-15', 33, null, null, 'up', '2026-06-15T09:00:00Z', now],
    [evtMap.e2, tmplMap.t3, userMap.u2, 'Digital Maturity Index — H1 2026', 'First-half digital readiness check across business units.', 'In Progress', '2026-04-01', '2026-06-15', 'Managed', null, 100, null, null, 'up', '2026-03-20T09:00:00Z', now],
    [evtMap.e3, tmplMap.t1, userMap.u2, 'EA Maturity Assessment — Q1 2026', 'Q1 maturity baseline for Enterprise Architecture.', 'Completed', '2026-01-10', '2026-03-31', 'Defined', null, 100, 72, 'Defined', 'up', '2026-01-05T09:00:00Z', now],
    [evtMap.e4, tmplMap.t2, userMap.u2, 'EA Governance Readiness — 2025 Baseline', 'Annual governance readiness baseline.', 'Completed', '2025-10-01', '2025-12-15', null, null, 100, 58, 'Managed', 'flat', '2025-09-20T09:00:00Z', now],
    [evtMap.e5, tmplMap.t3, userMap.u2, 'Digital Maturity Index — 2025 Baseline', '2025 digital maturity baseline.', 'Closed', '2025-06-01', '2025-08-31', null, null, 100, 61, 'Defined', 'up', '2025-05-15T09:00:00Z', now],
  ].forEach(r => insertEvent.run(...r));

  // ── 13. Event Respondents ───────────────────────────────────────────────────
  const insertResp = db.prepare(`
    INSERT OR IGNORE INTO event_respondents (event_id, user_id, completion_pct, status, last_activity, feedback)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const e1Respondents = [
    [userMap.u1, 0,   'Not Started', null, null],
    [userMap.u3, 45,  'In Progress', '2026-06-18T14:23:00Z', null],
    [userMap.u5, 100, 'Submitted',   '2026-06-20T09:15:00Z', null],
    [userMap.u6, 100, 'Validated',   '2026-06-19T16:40:00Z', null],
    [userMap.u7, 0,   'Not Started', null, null],
    [userMap.u8, 60,  'Returned',    '2026-06-17T11:00:00Z', 'Please revisit questions 3 and 7 — your responses need more specific evidence to support the maturity claims.'],
  ];
  e1Respondents.forEach(([uid, pct, status, act, fb]) => insertResp.run(evtMap.e1, uid, pct, status, act, fb));

  [[evtMap.e2, userMap.u1, 100, 'Submitted',  '2026-06-12T10:00:00Z', null],
   [evtMap.e2, userMap.u3, 100, 'Validated',  '2026-06-14T15:30:00Z', null],
   [evtMap.e3, userMap.u1, 100, 'Validated',  '2026-03-28T09:00:00Z', null],
   [evtMap.e3, userMap.u3, 100, 'Validated',  '2026-03-29T11:00:00Z', null],
   [evtMap.e4, userMap.u1, 100, 'Validated',  '2025-12-10T09:00:00Z', null],
   [evtMap.e4, userMap.u3, 100, 'Validated',  '2025-12-12T14:00:00Z', null],
   [evtMap.e5, userMap.u3, 100, 'Validated',  '2025-08-25T11:00:00Z', null],
  ].forEach(r => insertResp.run(...r));

  // ── 17. Recommendations ─────────────────────────────────────────────────────
  const insertRec = db.prepare(`
    INSERT OR IGNORE INTO recommendations (id, event_id, section_name, gap_magnitude, status, current_text, original_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const r1Text = 'Implement a formal EA governance structure with dedicated review boards, clear escalation paths, and executive sponsorship to ensure architectural decisions are consistently enforced across all business units.';
  const r2Text = 'Select and implement a centralised EA repository tool to consolidate all architecture artefacts, enabling traceability, version control, and cross-team visibility of the architecture landscape.';
  insertRec.run(recMap.r1, evtMap.e3, 'Architecture Governance', -1.5, 'Approved',     r1Text, r1Text, '2026-04-05T09:00:00Z', now);
  insertRec.run(recMap.r2, evtMap.e3, 'EA Strategy & Vision',    -1.2, 'AI Draft',     r2Text, r2Text, '2026-04-05T09:05:00Z', now);

  // ── 19. Tasks ────────────────────────────────────────────────────────────────
  const insertTask = db.prepare(`
    INSERT OR IGNORE INTO tasks (id, event_id, recommendation_id, rec_name, gap_weight, assignee_id, title, description, progress_notes, priority, status, effort, due_date, completion_pct, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run(taskMap.task1, evtMap.e3, recMap.r1, 'Establish EA Governance Framework', 1.5, userMap.u1, 'Define EA Governance Charter', 'Draft and ratify the EA governance charter with executive sponsorship.', '', 'High', 'In_Progress', 'Medium', '2026-09-15', 40, now, now);
  insertTask.run(taskMap.task2, evtMap.e3, recMap.r2, 'Deploy Centralised Architecture Repository', 1.2, userMap.u2, 'Evaluate EA Repository Tools', 'Shortlist and evaluate 3 candidate EA repository platforms.', '', 'Medium', 'Not_Started', 'Small', '2026-09-30', 0, now, now);

  // ── 20. Task Dependencies ───────────────────────────────────────────────────
  db.prepare(`INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)`)
    .run(taskMap.task2, taskMap.task1);

  // Persist the ID map so routes can look up by short ID if needed
  // (not needed — routes will use real UUIDs; this is just for dev reference)
  console.log('\n📋 ID mapping (mock → UUID):');
  console.log('Users:', Object.entries(userMap).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('Events:', Object.entries(evtMap).map(([k, v]) => `${k}=${v}`).join(', '));
});

run();
console.log('\n✅ Seed complete — database populated with mock data.');
