/**
 * migrate.ts — Creates all Gap2Action database tables.
 * Run with: ts-node src/migrate.ts
 */
import db from './db';

db.exec(`
  -- 1. departments
  CREATE TABLE IF NOT EXISTS departments (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 2. users
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    azure_oid     TEXT UNIQUE,
    role          TEXT NOT NULL CHECK(role IN ('admin','assessor','respondent')),
    status        TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
    department_id TEXT REFERENCES departments(id),
    initials      TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 3. user_groups
  CREATE TABLE IF NOT EXISTS user_groups (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 4. user_group_members
  CREATE TABLE IF NOT EXISTS user_group_members (
    group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
  );

  -- 5. categories
  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#2563EB',
    status      TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Archived')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 6. frameworks
  CREATE TABLE IF NOT EXISTS frameworks (
    id                     TEXT PRIMARY KEY,
    name                   TEXT NOT NULL,
    description            TEXT NOT NULL DEFAULT '',
    scoring_method         TEXT NOT NULL DEFAULT 'simple_average',
    allowed_question_types TEXT NOT NULL DEFAULT '[]',
    status                 TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Active','Archived')),
    created_by             TEXT REFERENCES users(id),
    created_at             TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 7. framework_maturity_levels
  CREATE TABLE IF NOT EXISTS framework_maturity_levels (
    id           TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
    level        INTEGER NOT NULL,
    label        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    min_score    REAL NOT NULL,
    max_score    REAL NOT NULL
  );

  -- 8. templates
  CREATE TABLE IF NOT EXISTS templates (
    id                TEXT PRIMARY KEY,
    category_id       TEXT REFERENCES categories(id),
    framework_id      TEXT REFERENCES frameworks(id),
    parent_version_id TEXT REFERENCES templates(id),
    name              TEXT NOT NULL,
    code              TEXT NOT NULL UNIQUE,
    description       TEXT NOT NULL DEFAULT '',
    assessment_type   TEXT,
    version           TEXT NOT NULL DEFAULT '1.0',
    status            TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Active','Archived')),
    tagline           TEXT,
    definition        TEXT,
    explanation       TEXT,
    cover_image_url   TEXT,
    created_by        TEXT REFERENCES users(id),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 9. template_sections
  CREATE TABLE IF NOT EXISTS template_sections (
    id          TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  -- 10. template_questions
  CREATE TABLE IF NOT EXISTS template_questions (
    id           TEXT PRIMARY KEY,
    section_id   TEXT NOT NULL REFERENCES template_sections(id) ON DELETE CASCADE,
    text         TEXT NOT NULL,
    guidance     TEXT NOT NULL DEFAULT '',
    type         TEXT NOT NULL,
    required     INTEGER NOT NULL DEFAULT 1,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    min_label    TEXT,
    max_label    TEXT,
    rating_scores TEXT NOT NULL DEFAULT '[]',
    yes_score    REAL,
    no_score     REAL
  );

  -- 11. template_question_options
  CREATE TABLE IF NOT EXISTS template_question_options (
    id          TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES template_questions(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    score       REAL NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  -- 12. events
  CREATE TABLE IF NOT EXISTS events (
    id                    TEXT PRIMARY KEY,
    template_id           TEXT REFERENCES templates(id),
    owner_id              TEXT REFERENCES users(id),
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT 'Draft',
    start_date            TEXT,
    end_date              TEXT,
    target_maturity_level TEXT,
    reassessment_date     TEXT,
    completion_rate       INTEGER NOT NULL DEFAULT 0,
    score                 REAL,
    maturity_level        TEXT,
    trend                 TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 13. event_respondents
  CREATE TABLE IF NOT EXISTS event_respondents (
    event_id       TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(id),
    completion_pct INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'Not Started',
    last_activity  TEXT,
    feedback       TEXT,
    return_count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, user_id)
  );

  -- 14. event_section_assignments
  CREATE TABLE IF NOT EXISTS event_section_assignments (
    id         TEXT PRIMARY KEY,
    event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES template_sections(id),
    user_id    TEXT NOT NULL REFERENCES users(id)
  );

  -- 15. submissions
  CREATE TABLE IF NOT EXISTS submissions (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id),
    answers      TEXT NOT NULL DEFAULT '{}',
    submitted_at TEXT,
    validated_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, user_id)
  );

  -- 16. evidence_files
  CREATE TABLE IF NOT EXISTS evidence_files (
    id            TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id   TEXT REFERENCES template_questions(id),
    name          TEXT NOT NULL,
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    mime_type     TEXT,
    blob_url      TEXT NOT NULL,
    blob_path     TEXT NOT NULL,
    uploaded_by   TEXT REFERENCES users(id),
    uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 17. recommendations
  CREATE TABLE IF NOT EXISTS recommendations (
    id            TEXT PRIMARY KEY,
    event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    section_name  TEXT NOT NULL DEFAULT '',
    gap_magnitude REAL NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'AI Draft',
    current_text  TEXT NOT NULL,
    original_text TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 18. recommendation_messages
  CREATE TABLE IF NOT EXISTS recommendation_messages (
    id                TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    role              TEXT NOT NULL CHECK(role IN ('assessor','ai')),
    text              TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 19. tasks
  CREATE TABLE IF NOT EXISTS tasks (
    id                TEXT PRIMARY KEY,
    event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    recommendation_id TEXT REFERENCES recommendations(id),
    rec_name          TEXT NOT NULL DEFAULT '',
    gap_weight        REAL NOT NULL DEFAULT 0,
    assignee_id       TEXT REFERENCES users(id),
    title             TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    progress_notes    TEXT NOT NULL DEFAULT '',
    priority          TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('High','Medium','Low')),
    status            TEXT NOT NULL DEFAULT 'Not_Started' CHECK(status IN ('Not_Started','In_Progress','Done','Blocked')),
    effort            TEXT CHECK(effort IN ('Small','Medium','Large')),
    start_date        TEXT,
    due_date          TEXT,
    completion_pct    INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 20. task_dependencies
  CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id            TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id)
  );

  -- Auth tables
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Migration complete — all tables created.');
