// Mock delta-comparison data for the Compare tab.
// Compares a previous assessment event against the current one (e3).

export interface SectionDelta {
  id: string;
  name: string;
  previousScore: number;
  currentScore: number;
  delta: number; // currentScore - previousScore
}

export interface CompletedTaskEntry {
  id: string;
  title: string;
  recName: string;
  completedDate: string; // ISO date
}

export interface ComparisonData {
  previousEventName: string;
  previousEventDate: string;
  currentEventName: string;
  currentEventDate: string;
  previousScore: number;
  currentScore: number;
  previousLevelNum: number;
  previousLevelName: string;
  currentLevelNum: number;
  currentLevelName: string;
  sections: SectionDelta[];
  completedTasks: CompletedTaskEntry[];
  readinessPctAtReassessment: number;
}

// Improvement in 2 sections, decline in 1
const e3Comparison: ComparisonData = {
  previousEventName: 'EA Maturity Assessment Q1 2025',
  previousEventDate: '2025-04-15',
  currentEventName: 'EA Maturity Diagnostic 2026',
  currentEventDate: '2026-03-31',
  previousScore: 2.8,
  currentScore: 3.6,
  previousLevelNum: 2,
  previousLevelName: 'Managed',
  currentLevelNum: 3,
  currentLevelName: 'Defined',
  sections: [
    {
      id: 'cs1',
      name: 'Strategy & Planning',
      previousScore: 3.8,
      currentScore: 4.4,
      delta: 0.6,
    },
    {
      id: 'cs2',
      name: 'Architecture Governance',
      previousScore: 2.4,
      currentScore: 3.2,
      delta: 0.8,
    },
    {
      id: 'cs3',
      name: 'Technology & Data',
      previousScore: 3.1,
      currentScore: 2.8,
      delta: -0.3,
    },
    {
      id: 'cs4',
      name: 'Stakeholder Engagement',
      previousScore: 2.8,
      currentScore: 4.0,
      delta: 1.2,
    },
  ],
  completedTasks: [
    {
      id: 'ct1',
      title: 'Assign Portfolio Owner',
      recName: 'Technology & Data',
      completedDate: '2026-06-25',
    },
    {
      id: 'ct2',
      title: 'Build self-assessment checklist',
      recName: 'Architecture Governance',
      completedDate: '2026-07-08',
    },
    {
      id: 'ct3',
      title: 'Run application discovery sprint',
      recName: 'Technology & Data',
      completedDate: '2026-07-10',
    },
  ],
  readinessPctAtReassessment: 19,
};

const e1Comparison: ComparisonData = {
  previousEventName: 'EA Maturity Assessment — Q1 2026',
  previousEventDate: '2026-03-31',
  currentEventName: 'EA Maturity Assessment — Q3 2026',
  currentEventDate: '2026-09-30',
  previousScore: 3.6,
  currentScore: 4.1,
  previousLevelNum: 3,
  previousLevelName: 'Defined',
  currentLevelNum: 4,
  currentLevelName: 'Quantitatively Managed',
  sections: [
    { id: 'cs1', name: 'Strategy & Planning',      previousScore: 4.4, currentScore: 4.7, delta: 0.3 },
    { id: 'cs2', name: 'Architecture Governance',  previousScore: 3.2, currentScore: 4.0, delta: 0.8 },
    { id: 'cs3', name: 'Technology & Data',        previousScore: 2.8, currentScore: 3.5, delta: 0.7 },
    { id: 'cs4', name: 'Stakeholder Engagement',   previousScore: 4.0, currentScore: 4.2, delta: 0.2 },
    { id: 'cs5', name: 'Data Architecture',        previousScore: 3.5, currentScore: 3.2, delta: -0.3 },
  ],
  completedTasks: [
    { id: 'ct1', title: 'Define EA Governance Charter',    recName: 'Architecture Governance', completedDate: '2026-08-15' },
    { id: 'ct2', title: 'Evaluate EA Repository Tools',    recName: 'Technology & Data',        completedDate: '2026-09-01' },
    { id: 'ct3', title: 'Stakeholder Alignment Workshop',  recName: 'Stakeholder Engagement',   completedDate: '2026-09-10' },
  ],
  readinessPctAtReassessment: 42,
};

export const comparisonByCurrentEventId: Record<string, ComparisonData> = {
  e3: e3Comparison,
  e1: e1Comparison,
};
