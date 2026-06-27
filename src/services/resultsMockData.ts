// Mock scored results for completed events.
// Only e3 has full result data — other events show an empty state.

export interface QuestionResult {
  id: string;
  sectionId: string;
  text: string;
  /** 'scored' = appears in the comparison table; 'text' = qualitative, shown as answered/not */
  type: 'scored' | 'text';
  maxScore: number;
  respondentScores: Record<string, number | null>;
  respondentLabels: Record<string, string>;
  averageScore: number | null;
}

export interface SectionResult {
  id: string;
  name: string;
  achievedScore: number; // 0–5
  targetScore: number;   // 0–5
  weightPct: number;     // contributes to weighted overall
  questions: QuestionResult[];
}

export interface EventResultData {
  eventId: string;
  overallScore: number;       // weighted average, 0–5
  targetScore: number;        // 0–5
  maturityLevelNum: number;
  maturityLevelName: string;
  targetLevelNum: number;
  targetLevelName: string;
  respondentIds: string[];    // ordered list for table columns
  completedDate: string;      // ISO date
  sections: SectionResult[];
}

// ── e3 — EA Maturity Assessment Q1 2026 ─────────────────────────────────────
// Overall: weighted avg of section scores → 3.6 / 5.0 (matches event.score 72%)
// Target: 4.0 / 5.0 (Level 4 — Quantitatively Managed)
// Respondents: u1 (Alexandra Mitchell), u3 (Sarah Chen)

const _e3Result: EventResultData = {
  eventId: 'e3',
  overallScore: 3.6,
  targetScore: 4.0,
  maturityLevelNum: 3,
  maturityLevelName: 'Defined',
  targetLevelNum: 4,
  targetLevelName: 'Quantitatively Managed',
  respondentIds: ['u1', 'u3'],
  completedDate: '2026-03-31',
  sections: [
    {
      id: 'rs1',
      name: 'Strategy & Planning',
      achievedScore: 4.4,
      targetScore: 4.0,
      weightPct: 30,
      questions: [
        {
          id: 'rq1-1',
          sectionId: 'rs1',
          text: 'How well is the EA strategy aligned with the overall business strategy?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 5, u3: 3 },
          respondentLabels: { u1: 'Fully aligned', u3: 'Partially aligned' },
          averageScore: 4.0,
        },
        {
          id: 'rq1-2',
          sectionId: 'rs1',
          text: 'Rate the overall maturity of the current EA roadmap.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 5, u3: 4 },
          respondentLabels: { u1: '5 / 5', u3: '4 / 5' },
          averageScore: 4.5,
        },
        {
          id: 'rq1-3',
          sectionId: 'rs1',
          text: 'Which strategic planning artefacts does your EA team actively maintain?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 5, u3: 4 },
          respondentLabels: { u1: '5 of 5 selected', u3: '4 of 5 selected' },
          averageScore: 4.5,
        },
        {
          id: 'rq1-4',
          sectionId: 'rs1',
          text: 'Describe strategic planning challenges the EA function currently faces.',
          type: 'text',
          maxScore: 0,
          respondentScores: { u1: null, u3: null },
          respondentLabels: { u1: 'Answered', u3: 'Answered' },
          averageScore: null,
        },
      ],
    },
    {
      id: 'rs2',
      name: 'Architecture Governance',
      achievedScore: 3.2,
      targetScore: 4.0,
      weightPct: 25,
      questions: [
        {
          id: 'rq2-1',
          sectionId: 'rs2',
          text: 'Does the organisation have a formal Architecture Review Board (ARB)?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 5, u3: 1 },
          respondentLabels: { u1: 'Yes', u3: 'No' },
          averageScore: 3.0,
        },
        {
          id: 'rq2-2',
          sectionId: 'rs2',
          text: 'Rate the effectiveness of the architecture governance process.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 4, u3: 3 },
          respondentLabels: { u1: '4 / 5', u3: '3 / 5' },
          averageScore: 3.5,
        },
        {
          id: 'rq2-3',
          sectionId: 'rs2',
          text: 'Describe the exception-handling process for non-compliant projects.',
          type: 'text',
          maxScore: 0,
          respondentScores: { u1: null, u3: null },
          respondentLabels: { u1: 'Answered', u3: 'Answered' },
          averageScore: null,
        },
      ],
    },
    {
      id: 'rs3',
      name: 'Technology & Data',
      achievedScore: 2.8,
      targetScore: 4.0,
      weightPct: 25,
      questions: [
        {
          id: 'rq3-1',
          sectionId: 'rs3',
          text: 'Does the organisation maintain a current application portfolio inventory?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 3, u3: 2 },
          respondentLabels: { u1: 'Yes', u3: 'No' },
          averageScore: 2.5,
        },
        {
          id: 'rq3-2',
          sectionId: 'rs3',
          text: 'Rate the maturity of data architecture and data governance practices.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 3, u3: 3 },
          respondentLabels: { u1: '3 / 5', u3: '3 / 5' },
          averageScore: 3.0,
        },
        {
          id: 'rq3-3',
          sectionId: 'rs3',
          text: 'Which technology domains have documented and approved target architectures?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 2, u3: 3 },
          respondentLabels: { u1: '2 of 6 selected', u3: '3 of 6 selected' },
          averageScore: 2.5,
        },
        {
          id: 'rq3-4',
          sectionId: 'rs3',
          text: 'Provide additional context about the technology landscape.',
          type: 'text',
          maxScore: 0,
          respondentScores: { u1: null, u3: null },
          respondentLabels: { u1: 'Answered', u3: 'Not answered' },
          averageScore: null,
        },
      ],
    },
    {
      id: 'rs4',
      name: 'Stakeholder Engagement',
      achievedScore: 4.0,
      targetScore: 3.5,
      weightPct: 20,
      questions: [
        {
          id: 'rq4-1',
          sectionId: 'rs4',
          text: 'How regularly does EA leadership engage with C-suite stakeholders?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 4, u3: 4 },
          respondentLabels: { u1: 'Monthly', u3: 'Monthly' },
          averageScore: 4.0,
        },
        {
          id: 'rq4-2',
          sectionId: 'rs4',
          text: 'Rate the quality and accessibility of architecture communication materials.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 4, u3: 4 },
          respondentLabels: { u1: '4 / 5', u3: '4 / 5' },
          averageScore: 4.0,
        },
      ],
    },
  ],
};

// ── e1 — EA Maturity Assessment Q3 2026 ─────────────────────────────────────
// Overall: 2.9 / 5.0 → Level 2 (Managed). Target: 4.0 (Quantitatively Managed)
// Respondents: u3 (Sarah Chen), u4 (James Carter), u5 (Maria Rodriguez)

const _e1Result: EventResultData = {
  eventId: 'e1',
  overallScore: 2.9,
  targetScore: 4.0,
  maturityLevelNum: 2,
  maturityLevelName: 'Managed',
  targetLevelNum: 4,
  targetLevelName: 'Quantitatively Managed',
  respondentIds: ['u3', 'u4', 'u5'],
  completedDate: '2026-09-30',
  sections: [
    {
      id: 's1',
      name: 'Strategy & Planning',
      achievedScore: 3.2,
      targetScore: 4.0,
      weightPct: 40,
      questions: [
        {
          id: 'q1-1',
          sectionId: 's1',
          text: 'How well is the EA strategy aligned with the overall business strategy?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u3: 5, u4: 3, u5: 2 },
          respondentLabels: { u3: 'Fully aligned', u4: 'Partially aligned', u5: 'No discernible alignment' },
          averageScore: 3.3,
        },
        {
          id: 'q1-2',
          sectionId: 's1',
          text: 'Rate the maturity of the current EA roadmap.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u3: 4, u4: 3, u5: 2 },
          respondentLabels: { u3: '4 / 5', u4: '3 / 5', u5: '2 / 5' },
          averageScore: 3.0,
        },
      ],
    },
    {
      id: 's2',
      name: 'Architecture Governance',
      achievedScore: 2.5,
      targetScore: 4.0,
      weightPct: 35,
      questions: [
        {
          id: 'q2-1',
          sectionId: 's2',
          text: 'Does the organisation have a formal Architecture Review Board (ARB)?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u3: 5, u4: 1, u5: 1 },
          respondentLabels: { u3: 'Yes', u4: 'No', u5: 'No' },
          averageScore: 2.3,
        },
      ],
    },
    {
      id: 's3',
      name: 'Technology & Data',
      achievedScore: 3.0,
      targetScore: 4.0,
      weightPct: 25,
      questions: [
        {
          id: 'q3-1',
          sectionId: 's3',
          text: 'Rate the maturity of data architecture and data governance practices.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u3: 3, u4: 3, u5: 3 },
          respondentLabels: { u3: '3 / 5', u4: '3 / 5', u5: '3 / 5' },
          averageScore: 3.0,
        },
      ],
    },
  ],
};

// ── e2 — Digital Maturity Index H1 2026 ─────────────────────────────────────
// Overall: 2.4 / 5.0 → Level 2 (Managed). Target: 3.0 (Defined)
// Respondents: u1 (Alexandra Mitchell), u3 (Sarah Chen)

const _e2Result: EventResultData = {
  eventId: 'e2',
  overallScore: 2.4,
  targetScore: 3.0,
  maturityLevelNum: 2,
  maturityLevelName: 'Managed',
  targetLevelNum: 3,
  targetLevelName: 'Defined',
  respondentIds: ['u1', 'u3'],
  completedDate: '2026-06-15',
  sections: [
    {
      id: 'e2s1',
      name: 'Digital Strategy',
      achievedScore: 2.8,
      targetScore: 3.5,
      weightPct: 35,
      questions: [
        {
          id: 'e2q1-1',
          sectionId: 'e2s1',
          text: 'How clearly is the digital transformation strategy defined and communicated?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 4, u3: 2 },
          respondentLabels: { u1: 'Clearly defined', u3: 'Partially defined' },
          averageScore: 3.0,
        },
        {
          id: 'e2q1-2',
          sectionId: 'e2s1',
          text: 'Rate the alignment between digital initiatives and business priorities.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 3, u3: 2 },
          respondentLabels: { u1: '3 / 5', u3: '2 / 5' },
          averageScore: 2.5,
        },
      ],
    },
    {
      id: 'e2s2',
      name: 'Data & Analytics',
      achievedScore: 2.0,
      targetScore: 3.0,
      weightPct: 35,
      questions: [
        {
          id: 'e2q2-1',
          sectionId: 'e2s2',
          text: 'Rate the organisation\'s use of data analytics for decision-making.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 2, u3: 2 },
          respondentLabels: { u1: '2 / 5', u3: '2 / 5' },
          averageScore: 2.0,
        },
        {
          id: 'e2q2-2',
          sectionId: 'e2s2',
          text: 'Does the organisation have a formal data governance framework?',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 3, u3: 1 },
          respondentLabels: { u1: 'Yes', u3: 'No' },
          averageScore: 2.0,
        },
      ],
    },
    {
      id: 'e2s3',
      name: 'Technology Enablement',
      achievedScore: 2.5,
      targetScore: 2.5,
      weightPct: 30,
      questions: [
        {
          id: 'e2q3-1',
          sectionId: 'e2s3',
          text: 'Rate the maturity of cloud adoption across the organisation.',
          type: 'scored',
          maxScore: 5,
          respondentScores: { u1: 3, u3: 2 },
          respondentLabels: { u1: '3 / 5', u3: '2 / 5' },
          averageScore: 2.5,
        },
      ],
    },
  ],
};

// ── e4 — EA Governance Readiness 2026 ────────────────────────

export const resultsByEventId: Record<string, EventResultData> = {
  e3: _e3Result,
  e1: _e1Result,
  e2: _e2Result,
};
