import type { BuilderSection, BuilderQuestion, AnswerOption, QuestionType } from '@/types';

export interface CsvImportResult {
  sections: BuilderSection[];
  errors: string[];
  warnings: string[];
}

// ─── Simple CSV line parser (handles double-quoted fields with embedded commas) ─

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let val = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      fields.push(val);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

const TYPE_MAP: Record<string, QuestionType> = {
  single_choice: 'single-choice',
  multi_choice: 'multi-choice',
  rating_scale: 'rating-scale',
  yes_no: 'yes-no',
  free_text: 'free-text',
};

let _seq = 1000;
function uid(prefix: string) { return `${prefix}${++_seq}_csv`; }

export function parseTemplateCSV(csvText: string): CsvImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sections: BuilderSection[] = [];

  const lines = csvText.split(/\r?\n/);
  let currentSection: BuilderSection | null = null;
  let currentQuestion: BuilderQuestion | null = null;

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li].trim();
    if (!raw || raw.startsWith('#')) continue;

    const fields = parseCsvLine(raw);
    const rowType = fields[0]?.toUpperCase();

    // Skip header row
    if (rowType === 'ROW_TYPE') continue;

    const row = li + 1;

    if (rowType === 'SECTION') {
      const name = fields[1] ?? '';
      const desc = fields[2] ?? '';
      const weightRaw = fields[3] ?? '';

      if (!name) { errors.push(`Row ${row}: SECTION is missing a name.`); continue; }

      const weight = parseInt(weightRaw, 10);
      if (isNaN(weight) || weight < 0 || weight > 100) {
        warnings.push(`Row ${row}: SECTION "${name}" has invalid weight "${weightRaw}" — defaulting to 0.`);
      }

      currentSection = {
        id: uid('sec'),
        name: name.trim(),
        description: desc.trim(),
        weight: isNaN(weight) ? 0 : weight,
        questions: [],
      };
      currentQuestion = null;
      sections.push(currentSection);

    } else if (rowType === 'QUESTION') {
      if (!currentSection) { errors.push(`Row ${row}: QUESTION found before any SECTION.`); continue; }

      const text = fields[1] ?? '';
      const typeRaw = fields[2]?.toLowerCase() ?? '';
      const requiredRaw = fields[3]?.toLowerCase() ?? 'yes';
      const guidance = fields[4] ?? '';

      if (!text) { errors.push(`Row ${row}: QUESTION is missing text.`); continue; }

      const type = TYPE_MAP[typeRaw];
      if (!type) {
        errors.push(`Row ${row}: Unknown question type "${typeRaw}". Valid: single_choice, multi_choice, rating_scale, yes_no, free_text.`);
        currentQuestion = null;
        continue;
      }

      currentQuestion = {
        id: uid('q'),
        sectionId: currentSection.id,
        text: text.trim(),
        guidance: guidance.trim(),
        type,
        required: requiredRaw !== 'no',
        options: [],
        minLabel: '',
        maxLabel: '',
        ratingScores: [1, 2, 3, 4, 5],
        yesScore: 4,
        noScore: 0,
      };
      currentSection.questions.push(currentQuestion);

    } else if (rowType === 'OPTION') {
      if (!currentQuestion) { errors.push(`Row ${row}: OPTION found without a preceding QUESTION.`); continue; }
      if (currentQuestion.type !== 'single-choice' && currentQuestion.type !== 'multi-choice') {
        warnings.push(`Row ${row}: OPTION ignored — question type "${currentQuestion.type}" does not use options.`);
        continue;
      }

      const text = fields[1] ?? '';
      const score = parseFloat(fields[2] ?? '0');

      if (!text) { warnings.push(`Row ${row}: OPTION has empty text — skipped.`); continue; }

      const opt: AnswerOption = { id: uid('o'), text: text.trim(), score: isNaN(score) ? 0 : score };
      currentQuestion.options.push(opt);

    } else if (rowType === 'RATING_SCORE') {
      if (!currentQuestion) { errors.push(`Row ${row}: RATING_SCORE found without a preceding QUESTION.`); continue; }
      if (currentQuestion.type !== 'rating-scale') {
        warnings.push(`Row ${row}: RATING_SCORE ignored — question type is "${currentQuestion.type}".`);
        continue;
      }

      const level = parseInt(fields[1] ?? '', 10);
      const score = parseFloat(fields[2] ?? '0');
      const minLabel = fields[3] ?? '';
      const maxLabel = fields[4] ?? '';

      if (isNaN(level) || level < 1 || level > 5) {
        warnings.push(`Row ${row}: RATING_SCORE has invalid level "${fields[1]}" — skipped.`);
        continue;
      }

      // ratingScores is indexed 0-4 for levels 1-5
      const newScores = [...currentQuestion.ratingScores];
      newScores[level - 1] = isNaN(score) ? 0 : score;
      currentQuestion.ratingScores = newScores;

      if (level === 1) {
        if (minLabel) currentQuestion.minLabel = minLabel.trim();
        if (maxLabel) currentQuestion.maxLabel = maxLabel.trim();
      }

    } else if (rowType === 'YESNO_SCORE') {
      if (!currentQuestion) { errors.push(`Row ${row}: YESNO_SCORE found without a preceding QUESTION.`); continue; }
      if (currentQuestion.type !== 'yes-no') {
        warnings.push(`Row ${row}: YESNO_SCORE ignored — question type is "${currentQuestion.type}".`);
        continue;
      }

      const yesScore = parseFloat(fields[1] ?? '4');
      const noScore = parseFloat(fields[2] ?? '0');
      currentQuestion.yesScore = isNaN(yesScore) ? 4 : yesScore;
      currentQuestion.noScore = isNaN(noScore) ? 0 : noScore;

    } else {
      warnings.push(`Row ${row}: Unknown row type "${rowType}" — skipped.`);
    }
  }

  if (sections.length === 0 && errors.length === 0) {
    errors.push('No SECTION rows found. The file may be empty or incorrectly formatted.');
  }

  const totalWeight = sections.reduce((s, sec) => s + sec.weight, 0);
  if (sections.length > 0 && Math.abs(totalWeight - 100) > 1) {
    warnings.push(`Section weights sum to ${totalWeight}% (expected 100%). Adjust weights after importing.`);
  }

  return { sections, errors, warnings };
}

// ─── Export sections to CSV ───────────────────────────────────────────────────

const Q_TYPE_TO_CSV: Record<string, string> = {
  'single-choice': 'single_choice',
  'multi-choice': 'multi_choice',
  'rating-scale': 'rating_scale',
  'yes-no': 'yes_no',
  'free-text': 'free_text',
};

function csvField(value: string | number): string {
  const s = String(value);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function exportSectionsToCSV(sections: BuilderSection[]): string {
  const lines: string[] = [
    '# Gap2Action — Template Import CSV',
    '# Format guide:',
    '#   SECTION      : field_1=name, field_2=description, field_3=weight_percent',
    '#   QUESTION     : field_1=text, field_2=type, field_3=required(yes/no), field_4=guidance_text',
    '#   OPTION       : field_1=option_text, field_2=score  (for single_choice and multi_choice)',
    '#   RATING_SCORE : field_1=level(1-5), field_2=score, field_3=min_label(level 1 only), field_4=max_label(level 1 only)',
    '#   YESNO_SCORE  : field_1=yes_score, field_2=no_score',
    '#   Lines starting with # are ignored',
    'row_type,field_1,field_2,field_3,field_4',
  ];

  for (const sec of sections) {
    lines.push(`SECTION,${csvField(sec.name)},${csvField(sec.description)},${sec.weight}`);

    for (const q of sec.questions) {
      const typeStr = Q_TYPE_TO_CSV[q.type] ?? q.type;
      const required = q.required ? 'yes' : 'no';
      lines.push(`QUESTION,${csvField(q.text)},${typeStr},${required},${csvField(q.guidance)}`);

      if (q.type === 'single-choice' || q.type === 'multi-choice') {
        for (const opt of q.options) {
          lines.push(`OPTION,${csvField(opt.text)},${opt.score}`);
        }
      } else if (q.type === 'rating-scale') {
        const scores = q.ratingScores ?? [0, 1, 2, 3, 4];
        for (let i = 0; i < 5; i++) {
          const level = i + 1;
          const score = scores[i] ?? i;
          if (level === 1) {
            lines.push(`RATING_SCORE,${level},${score},${csvField(q.minLabel ?? '')},${csvField(q.maxLabel ?? '')}`);
          } else {
            lines.push(`RATING_SCORE,${level},${score},,`);
          }
        }
      } else if (q.type === 'yes-no') {
        lines.push(`YESNO_SCORE,${q.yesScore ?? 4},${q.noScore ?? 0}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── CSV Template download ────────────────────────────────────────────────────

export function generateCsvTemplate(): string {
  return [
    '# Gap2Action — Template Import CSV',
    '# Format guide:',
    '#   SECTION      : field_1=name, field_2=description, field_3=weight_percent',
    '#   QUESTION     : field_1=text, field_2=type, field_3=required(yes/no), field_4=guidance_text',
    '#   OPTION       : field_1=option_text, field_2=score  (for single_choice and multi_choice)',
    '#   RATING_SCORE : field_1=level(1-5), field_2=score, field_3=min_label(level 1 only), field_4=max_label(level 1 only)',
    '#   YESNO_SCORE  : field_1=yes_score, field_2=no_score',
    '#   Lines starting with # are ignored',
    'row_type,field_1,field_2,field_3,field_4',
    'SECTION,Section Name,Section description,50',
    'QUESTION,Question text here?,single_choice,yes,Optional guidance for respondents.',
    'OPTION,Option A text,4',
    'OPTION,Option B text,2',
    'OPTION,Option C text,0',
    'QUESTION,Rate this aspect.,rating_scale,yes,Consider X and Y when answering.',
    'RATING_SCORE,1,0,Low,High',
    'RATING_SCORE,2,1,,',
    'RATING_SCORE,3,2,,',
    'RATING_SCORE,4,3,,',
    'RATING_SCORE,5,4,,',
    'QUESTION,Is this in place?,yes_no,yes,Yes means formally established.',
    'YESNO_SCORE,4,0',
    'QUESTION,Select all that apply.,multi_choice,no,',
    'OPTION,Item 1,1',
    'OPTION,Item 2,1',
    'QUESTION,Describe the situation.,free_text,no,',
    'SECTION,Another Section,Another description,50',
    'QUESTION,Another question?,single_choice,yes,',
    'OPTION,Yes,4',
    'OPTION,No,0',
  ].join('\n');
}
