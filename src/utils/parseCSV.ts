// ─── Core quoted-CSV parser ───────────────────────────────────────────────────

/** Parse a single CSV line with proper quoted-field handling. */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Returns array of rows (header is row[0]).
 * Skips comment lines (starting with #) and empty lines.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    rows.push(parseLine(line));
  }
  return rows;
}

// ─── Typed parsers ────────────────────────────────────────────────────────────

export interface DeptImportRow {
  name: string;
}

export interface UserImportRow {
  name: string;
  email: string;
  role: 'admin' | 'assessor' | 'respondent';
  department: string;
  groups: string[];
  status: 'Active' | 'Inactive';
}

export interface GroupImportRow {
  name: string;
  members: string[];
}

const VALID_ROLES = new Set(['admin', 'assessor', 'respondent']);

export function parseDepartmentsCSV(text: string): {
  rows: DeptImportRow[];
  errors: string[];
  warnings: string[];
} {
  const rows: DeptImportRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const allRows = parseCSV(text);
  if (allRows.length < 2) return { rows, errors: ['No data rows found after the header.'], warnings };

  const seenNames = new Set<string>();

  for (let i = 1; i < allRows.length; i++) {
    const lineNum = i + 1;
    const [name = ''] = allRows[i];

    if (!name) {
      errors.push(`Row ${lineNum}: name is blank.`);
      continue;
    }
    if (seenNames.has(name.toLowerCase())) {
      errors.push(`Row ${lineNum}: duplicate department name "${name}" within this CSV.`);
      continue;
    }
    seenNames.add(name.toLowerCase());
    rows.push({ name });
  }

  return { rows, errors, warnings };
}

export function parseUsersCSV(text: string): {
  rows: UserImportRow[];
  errors: string[];
  warnings: string[];
} {
  const rows: UserImportRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const allRows = parseCSV(text);
  if (allRows.length < 2) return { rows, errors: ['No data rows found after the header.'], warnings };

  const seenEmails = new Set<string>();

  for (let i = 1; i < allRows.length; i++) {
    const lineNum = i + 1;
    const [name = '', email = '', roleRaw = '', department = '', groupsRaw = '', statusRaw = ''] = allRows[i];

    let hasError = false;

    if (!name) { errors.push(`Row ${lineNum}: name is blank.`); hasError = true; }
    if (!email) {
      errors.push(`Row ${lineNum}: email is blank.`);
      hasError = true;
    } else if (!email.includes('@')) {
      errors.push(`Row ${lineNum}: email "${email}" does not contain "@".`);
      hasError = true;
    } else if (seenEmails.has(email.toLowerCase())) {
      errors.push(`Row ${lineNum}: duplicate email "${email}" within this CSV.`);
      hasError = true;
    }

    if (!VALID_ROLES.has(roleRaw.toLowerCase())) {
      errors.push(`Row ${lineNum}: role "${roleRaw}" is not valid. Must be admin, assessor, or respondent.`);
      hasError = true;
    }

    if (hasError) continue;

    seenEmails.add(email.toLowerCase());

    if (!department) warnings.push(`Row ${lineNum}: department is blank — user will have no department.`);

    let status: 'Active' | 'Inactive' = 'Active';
    if (statusRaw && statusRaw !== 'Active' && statusRaw !== 'Inactive') {
      warnings.push(`Row ${lineNum}: unrecognized status "${statusRaw}" — defaulting to Active.`);
    } else if (statusRaw === 'Inactive') {
      status = 'Inactive';
    }

    const groups = groupsRaw
      ? groupsRaw.split(',').map(g => g.trim()).filter(Boolean)
      : [];

    rows.push({
      name,
      email: email.toLowerCase(),
      role: roleRaw.toLowerCase() as 'admin' | 'assessor' | 'respondent',
      department,
      groups,
      status,
    });
  }

  return { rows, errors, warnings };
}

export function parseGroupsCSV(text: string): {
  rows: GroupImportRow[];
  errors: string[];
  warnings: string[];
} {
  const rows: GroupImportRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const allRows = parseCSV(text);
  if (allRows.length < 2) return { rows, errors: ['No data rows found after the header.'], warnings };

  const seenNames = new Set<string>();

  for (let i = 1; i < allRows.length; i++) {
    const lineNum = i + 1;
    const [name = '', membersRaw = ''] = allRows[i];

    if (!name) {
      errors.push(`Row ${lineNum}: group name is blank.`);
      continue;
    }
    if (seenNames.has(name.toLowerCase())) {
      errors.push(`Row ${lineNum}: duplicate group name "${name}" within this CSV.`);
      continue;
    }
    seenNames.add(name.toLowerCase());

    const members = membersRaw
      ? membersRaw.split(',').map(m => m.trim()).filter(Boolean)
      : [];
    if (members.length === 0) warnings.push(`Row ${lineNum}: group "${name}" has no members.`);

    rows.push({ name, members });
  }

  return { rows, errors, warnings };
}

// ─── Blank template generators ────────────────────────────────────────────────

export function generateDepartmentsTemplate(): string {
  return [
    '# Gap2Action — Departments Import CSV',
    '# Format: one department name per row (after the header)',
    '# Existing departments with the same name will be skipped (or updated if you choose Update mode)',
    'name',
    'Enterprise Architecture',
    'Digital Strategy',
    'IT Operations',
  ].join('\n');
}

export function generateUsersTemplate(): string {
  return [
    '# Gap2Action — Users Import CSV',
    '# Columns: name, email, role, department, groups, status',
    '# role:       admin | assessor | respondent',
    '# department: must match a department name (will be created if it does not exist)',
    '# groups:     comma-separated group names wrapped in quotes if more than one',
    '#             e.g.  EA Core Team',
    '#             e.g.  "EA Core Team,Digital Transformation Group"',
    '#             (groups will be created if they do not exist)',
    '# status:     Active | Inactive  (defaults to Active if blank)',
    'name,email,role,department,groups,status',
    'Jane Smith,j.smith@example.com,respondent,Enterprise Architecture,EA Core Team,Active',
    'John Doe,j.doe@example.com,assessor,Digital Strategy,"EA Core Team,Digital Transformation Group",Active',
    'Admin User,admin@example.com,admin,IT Operations,,Active',
  ].join('\n');
}

export function generateGroupsTemplate(): string {
  return [
    '# Gap2Action — User Groups Import CSV',
    '# Columns: name, members (comma-separated emails, wrapped in quotes if more than one)',
    '# If a group already exists: Update mode replaces member list; Skip mode adds new members only',
    '# If a member email does not exist in the system they will be skipped with a warning',
    'name,members',
    'EA Core Team,"user1@example.com,user2@example.com"',
    'Digital Team,user3@example.com',
  ].join('\n');
}
