# Nudj — Database Seed Data Mapping

This document maps every entity in `src/services/mockData.ts` and `src/types/index.ts`
to its proposed database table, columns, and relationships.
Use this as the source of truth for writing backend migrations and the seed script.

---

## Conventions

- All primary keys are UUIDs in production. The seed data uses short IDs (`u1`, `cat1`, etc.) for readability — convert to UUIDs before inserting.
- `created_at` / `updated_at` are `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`.
- Foreign keys are strict — no orphans.
- Enums are defined as DB-level `ENUM` types (or `VARCHAR` with a CHECK constraint if the DB doesn't support enums).

---

## Tables

### 1. `departments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | VARCHAR(100) NOT NULL UNIQUE | |
| `created_at` | TIMESTAMPTZ | |

**Seed rows (5):** Enterprise Architecture, Digital Strategy, IT Operations, Finance, Human Resources.

---

### 2. `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | VARCHAR(150) NOT NULL | |
| `email` | VARCHAR(255) NOT NULL UNIQUE | |
| `password_hash` | VARCHAR(255) | NULL for SSO-only accounts |
| `azure_oid` | VARCHAR(255) UNIQUE | Azure AD Object ID for SSO users |
| `role` | ENUM('admin','assessor','respondent') NOT NULL | |
| `status` | ENUM('Active','Inactive') NOT NULL DEFAULT 'Active' | |
| `department_id` | UUID FK → departments.id | NULLABLE |
| `initials` | VARCHAR(5) | Derived from name; store for avatar display |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seed rows (8):** Alexandra Mitchell (admin), James Carter (assessor), Sarah Chen (respondent), David Okafor, Priya Nair, Marcus Webb, Aisha Patel, Carlos Díaz.

> **Auth note:** `password_hash` is bcrypt. For email+password login the backend sets this. For Microsoft SSO login the backend sets `azure_oid` instead. An account can have both (user links SSO later).

---

### 3. `user_groups`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | VARCHAR(150) NOT NULL | |
| `created_at` | TIMESTAMPTZ | |

**Seed rows (2):** EA Core Team, Digital Transformation Group.

---

### 4. `user_group_members` *(junction)*

| Column | Type | Notes |
|--------|------|-------|
| `group_id` | UUID FK → user_groups.id | |
| `user_id` | UUID FK → users.id | |
| PK | (`group_id`, `user_id`) | |

**Seed rows:** g1→[u1,u2,u6], g2→[u2,u3,u5].

---

### 5. `categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | VARCHAR(150) NOT NULL | |
| `description` | TEXT | |
| `icon` | VARCHAR(50) | Icon key (e.g. `building-2`) |
| `color` | VARCHAR(20) | Hex colour (e.g. `#2563EB`) |
| `status` | ENUM('Active','Archived') NOT NULL DEFAULT 'Active' | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> `templateCount` is a **computed field** (COUNT query) — do not store it.

**Seed rows (3):** Enterprise Architecture (Active), Digital Transformation (Active), Cybersecurity Readiness (Archived).

---

### 6. `frameworks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | VARCHAR(150) NOT NULL | |
| `description` | TEXT | |
| `scoring_method` | ENUM('weighted_section','simple_average','categorical_weight') NOT NULL | |
| `allowed_question_types` | TEXT[] (or JSON array) | List of allowed question type keys |
| `status` | ENUM('Draft','Active','Archived') NOT NULL DEFAULT 'Draft' | |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seed rows (3):** EA Maturity Framework, Digital Readiness Framework, Governance Audit Framework.

---

### 7. `framework_maturity_levels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `framework_id` | UUID FK → frameworks.id ON DELETE CASCADE | |
| `level` | SMALLINT NOT NULL | 1–5 |
| `label` | VARCHAR(100) NOT NULL | e.g. "Initial" |
| `description` | TEXT | |
| `min_score` | NUMERIC(4,2) NOT NULL | |
| `max_score` | NUMERIC(4,2) NOT NULL | |

**Seed rows:** 5 levels per framework × 3 frameworks = 15 rows.

---

### 8. `templates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `category_id` | UUID FK → categories.id | |
| `framework_id` | UUID FK → frameworks.id | NULLABLE |
| `parent_version_id` | UUID FK → templates.id | NULLABLE — links to previous version |
| `name` | VARCHAR(200) NOT NULL | |
| `code` | VARCHAR(50) NOT NULL UNIQUE | e.g. `EA-MAT-v2` |
| `description` | TEXT | |
| `assessment_type` | VARCHAR(50) | e.g. Maturity, Readiness, Capability |
| `version` | VARCHAR(20) NOT NULL | e.g. `2.1` |
| `status` | ENUM('Draft','Active','Archived') NOT NULL DEFAULT 'Draft' | |
| `tagline` | VARCHAR(255) | Cover page tagline |
| `definition` | TEXT | Cover page definition |
| `explanation` | TEXT | Cover page explanation |
| `cover_image_url` | TEXT | Azure Blob URL for cover image |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> `questionCount` is a **computed field** — do not store it.

**Seed rows (5):** t1 EA Maturity Assessment, t2 EA Governance Readiness, t2b EA Capability Baseline, t3 Digital Maturity Index, t4 Innovation Capability Survey.

---

### 9. `template_sections`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `template_id` | UUID FK → templates.id ON DELETE CASCADE | |
| `name` | VARCHAR(200) NOT NULL | |
| `description` | TEXT | |
| `sort_order` | SMALLINT NOT NULL DEFAULT 0 | |

---

### 10. `template_questions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `section_id` | UUID FK → template_sections.id ON DELETE CASCADE | |
| `text` | TEXT NOT NULL | |
| `guidance` | TEXT | |
| `type` | ENUM('single-choice','multi-choice','rating-scale','yes-no','free-text','yes-no-partial','percentage','frequency') NOT NULL | |
| `required` | BOOLEAN NOT NULL DEFAULT TRUE | |
| `sort_order` | SMALLINT NOT NULL DEFAULT 0 | |
| `min_label` | VARCHAR(100) | For rating-scale |
| `max_label` | VARCHAR(100) | For rating-scale |
| `rating_scores` | NUMERIC[] | Scores for each rating option |
| `yes_score` | NUMERIC(4,2) | For yes-no questions |
| `no_score` | NUMERIC(4,2) | For yes-no questions |

---

### 11. `template_question_options`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `question_id` | UUID FK → template_questions.id ON DELETE CASCADE | |
| `text` | TEXT NOT NULL | |
| `score` | NUMERIC(4,2) NOT NULL | |
| `sort_order` | SMALLINT NOT NULL DEFAULT 0 | |

---

### 12. `events`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `template_id` | UUID FK → templates.id | |
| `owner_id` | UUID FK → users.id | |
| `name` | VARCHAR(200) NOT NULL | |
| `description` | TEXT | |
| `status` | ENUM('Draft','Scheduled','Open','In Progress','Completed','Closed') NOT NULL DEFAULT 'Draft' | |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `target_maturity_level` | VARCHAR(50) | e.g. "Defined" |
| `reassessment_date` | DATE | NULLABLE |
| `completion_rate` | SMALLINT | Cached %, updated on submission |
| `score` | NUMERIC(5,2) | Final score (set on close) |
| `maturity_level` | VARCHAR(50) | Final maturity label (set on close) |
| `trend` | ENUM('up','down','flat') | NULLABLE |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seed rows (5):** e1–e5 as in mockData.

---

### 13. `event_respondents` *(junction)*

| Column | Type | Notes |
|--------|------|-------|
| `event_id` | UUID FK → events.id ON DELETE CASCADE | |
| `user_id` | UUID FK → users.id | |
| `completion_pct` | SMALLINT NOT NULL DEFAULT 0 | |
| `status` | ENUM('Not Started','In Progress','Submitted','Validated','Returned','Returned for Revision') NOT NULL DEFAULT 'Not Started' | |
| `last_activity` | TIMESTAMPTZ | |
| `feedback` | TEXT | Assessor return feedback |
| `return_count` | SMALLINT NOT NULL DEFAULT 0 | |
| PK | (`event_id`, `user_id`) | |

---

### 14. `event_section_assignments`

*(Only rows exist when specific sections are assigned to specific respondents — absence = all sections assigned to everyone)*

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `event_id` | UUID FK → events.id ON DELETE CASCADE | |
| `section_id` | UUID FK → template_sections.id | |
| `user_id` | UUID FK → users.id | |

---

### 15. `submissions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `event_id` | UUID FK → events.id ON DELETE CASCADE | |
| `user_id` | UUID FK → users.id | |
| `answers` | JSONB NOT NULL | `{ [questionId]: answerValue }` |
| `submitted_at` | TIMESTAMPTZ | NULL until submitted |
| `validated_at` | TIMESTAMPTZ | NULL until validated |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| UNIQUE | (`event_id`, `user_id`) | One submission per respondent per event |

---

### 16. `evidence_files`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `submission_id` | UUID FK → submissions.id ON DELETE CASCADE | |
| `question_id` | UUID FK → template_questions.id | |
| `name` | VARCHAR(255) NOT NULL | Original filename |
| `size_bytes` | BIGINT NOT NULL | |
| `mime_type` | VARCHAR(100) | |
| `blob_url` | TEXT NOT NULL | Azure Blob Storage URL |
| `blob_path` | TEXT NOT NULL | Internal path for deletion (not exposed to client) |
| `uploaded_by` | UUID FK → users.id | |
| `uploaded_at` | TIMESTAMPTZ | |

---

### 17. `recommendations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `event_id` | UUID FK → events.id ON DELETE CASCADE | |
| `section_name` | VARCHAR(200) | The gap section this rec addresses |
| `gap_magnitude` | NUMERIC(4,2) | Negative number e.g. -1.2 |
| `status` | ENUM('AI Draft','Under Review','Approved','Noted','Converted') NOT NULL DEFAULT 'AI Draft' | |
| `current_text` | TEXT NOT NULL | Latest version of the recommendation text |
| `original_text` | TEXT NOT NULL | First AI-generated text (immutable) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seed rows (2):** r1, r2 from mockData (map to new event IDs).

---

### 18. `recommendation_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `recommendation_id` | UUID FK → recommendations.id ON DELETE CASCADE | |
| `role` | ENUM('assessor','ai') NOT NULL | |
| `text` | TEXT NOT NULL | |
| `created_at` | TIMESTAMPTZ | |

---

### 19. `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `event_id` | UUID FK → events.id ON DELETE CASCADE | |
| `recommendation_id` | UUID FK → recommendations.id | NULLABLE |
| `rec_name` | VARCHAR(200) | Label copied from rec at creation time |
| `gap_weight` | NUMERIC(4,2) | |
| `assignee_id` | UUID FK → users.id | NULLABLE |
| `title` | VARCHAR(255) NOT NULL | |
| `description` | TEXT | |
| `progress_notes` | TEXT | |
| `priority` | ENUM('High','Medium','Low') NOT NULL DEFAULT 'Medium' | |
| `status` | ENUM('Not Started','In Progress','Done','Blocked') NOT NULL DEFAULT 'Not Started' | |
| `effort` | ENUM('Small','Medium','Large') | |
| `start_date` | DATE | |
| `due_date` | DATE | |
| `completion_pct` | SMALLINT NOT NULL DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seed rows (2):** task1, task2 from mockData.

---

### 20. `task_dependencies` *(junction)*

| Column | Type | Notes |
|--------|------|-------|
| `task_id` | UUID FK → tasks.id ON DELETE CASCADE | |
| `depends_on_task_id` | UUID FK → tasks.id ON DELETE CASCADE | |
| PK | (`task_id`, `depends_on_task_id`) | |

**Seed rows:** task2 depends on task1.

---

## Entity Relationship Summary

```
departments
    └── users (department_id)

users ──────────────────────── user_group_members ── user_groups

categories
    └── templates (category_id)
            └── template_sections (template_id)
                    └── template_questions (section_id)
                            └── template_question_options (question_id)

frameworks
    ├── framework_maturity_levels (framework_id)
    └── templates (framework_id)

events (template_id, owner_id)
    ├── event_respondents (event_id, user_id)
    ├── event_section_assignments (event_id, section_id, user_id)
    ├── submissions (event_id, user_id)
    │       └── evidence_files (submission_id, question_id)
    ├── recommendations (event_id)
    │       └── recommendation_messages (recommendation_id)
    └── tasks (event_id, recommendation_id)
            └── task_dependencies (task_id, depends_on_task_id)
```

---

## Auth Tables (backend-managed, not in mockData)

These are not in the frontend seed but must be created in the migration:

### `refresh_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id ON DELETE CASCADE | |
| `token_hash` | VARCHAR(255) NOT NULL UNIQUE | bcrypt hash of the refresh token |
| `expires_at` | TIMESTAMPTZ NOT NULL | |
| `created_at` | TIMESTAMPTZ | |

### `password_reset_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id ON DELETE CASCADE | |
| `token_hash` | VARCHAR(255) NOT NULL UNIQUE | |
| `expires_at` | TIMESTAMPTZ NOT NULL | |
| `used_at` | TIMESTAMPTZ | NULL until consumed |
| `created_at` | TIMESTAMPTZ | |

---

## Seed Script Order

Insert in this order to satisfy FK constraints:

1. `departments`
2. `users`
3. `user_groups`
4. `user_group_members`
5. `categories`
6. `frameworks`
7. `framework_maturity_levels`
8. `templates`
9. `template_sections`
10. `template_questions`
11. `template_question_options`
12. `events`
13. `event_respondents`
14. `recommendations`
15. `tasks`
16. `task_dependencies`

> `submissions`, `evidence_files`, `recommendation_messages`, `event_section_assignments`, `refresh_tokens`, and `password_reset_tokens` start empty — populated by real usage.

---

## Notes for Backend Developer

- The frontend store key `g2a_store` in localStorage mirrors this schema. Use it as a reference for API response shapes.
- `answers` in `submissions` is stored as JSONB. The scoring engine (`src/utils/scoring.ts`) documents the expected shape.
- Evidence files: the frontend calls `POST /api/evidence/upload` (multipart) and expects `{ id, name, size, url, mimeType }` back. The backend stores to Azure Blob and saves the internal `blob_path` (never sent to client) for future deletion.
- The `VITE_API_URL` env variable in the frontend must point to the backend base URL (e.g. `https://api.nudj.com`).
