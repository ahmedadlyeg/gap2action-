import { useState, useEffect } from 'react';
import { categories } from '@/services/mockData';
import { categoriesApi, templatesApi, eventsApi, type ApiTemplate, type ApiEvent } from '@/services/api';
import { resultsByEventId, type SectionResult } from '@/services/resultsMockData';
import { getMaturityMeta, type MaturityMeta } from '@/utils/maturityUtils';

export type { SectionResult };

export interface TemplateMaturity {
  templateId: string;
  templateName: string;
  categoryId: string;
  latestEventId: string | null;
  completedDate: string | null;
  currentScore: number | null;
  targetScore: number | null;
  maturityMeta: MaturityMeta;
  sections: SectionResult[];
  history: Array<{ eventId: string; date: string; score: number }>;
}

export interface CategoryMaturity {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  templates: TemplateMaturity[];
  avgScore: number | null;
  avgTarget: number | null;
  maturityMeta: MaturityMeta;
  assessedCount: number;
  totalCount: number;
}

export interface OrgMaturity {
  avgScore: number | null;
  avgTarget: number | null;
  maturityMeta: MaturityMeta;
  categories: CategoryMaturity[];
  totalTemplates: number;
  assessedTemplates: number;
  aboveTarget: number;
  belowTarget: number;
}

const EMPTY_ORG: OrgMaturity = {
  avgScore: null, avgTarget: null,
  maturityMeta: getMaturityMeta(null),
  categories: [], totalTemplates: 0, assessedTemplates: 0, aboveTarget: 0, belowTarget: 0,
};

function computeOrgMaturity(templates: ApiTemplate[], allEvents: ApiEvent[], apiCategories?: { id: string; name: string; color: string }[]): OrgMaturity {
  const catList = apiCategories && apiCategories.length > 0 ? apiCategories : categories;
    // Build TemplateMaturity for each template
    const templateMaturityList: TemplateMaturity[] = templates.map(tpl => {
      // Events for this template that have result data
      const matchingEvents = allEvents.filter(
        e => e.templateId === tpl.id && resultsByEventId[e.id] != null
      );

      // Build history entries
      const history: Array<{ eventId: string; date: string; score: number }> = matchingEvents
        .map(e => ({
          eventId: e.id,
          date: resultsByEventId[e.id].completedDate,
          score: resultsByEventId[e.id].overallScore,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Latest = last in descending order
      const sortedDesc = [...matchingEvents].sort((a, b) =>
        resultsByEventId[b.id].completedDate.localeCompare(resultsByEventId[a.id].completedDate)
      );
      const latest = sortedDesc[0] ? resultsByEventId[sortedDesc[0].id] : null;

      const currentScore = latest?.overallScore ?? null;
      const targetScore = latest?.targetScore ?? null;

      return {
        templateId: tpl.id,
        templateName: tpl.name,
        categoryId: tpl.categoryId,
        latestEventId: sortedDesc[0]?.id ?? null,
        completedDate: latest?.completedDate ?? null,
        currentScore,
        targetScore,
        maturityMeta: getMaturityMeta(currentScore),
        sections: latest?.sections ?? [],
        history,
      };
    });

    // Group by category
    const categoryMaturityList: CategoryMaturity[] = catList.map(cat => {
      const catTemplates = templateMaturityList.filter(t => t.categoryId === cat.id);
      const assessed = catTemplates.filter(t => t.currentScore !== null);

      const avgScore =
        assessed.length > 0
          ? assessed.reduce((sum, t) => sum + t.currentScore!, 0) / assessed.length
          : null;

      const avgTarget =
        assessed.length > 0
          ? assessed.reduce((sum, t) => sum + (t.targetScore ?? 0), 0) / assessed.length
          : null;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        templates: catTemplates,
        avgScore,
        avgTarget,
        maturityMeta: getMaturityMeta(avgScore),
        assessedCount: assessed.length,
        totalCount: catTemplates.length,
      };
    });

    // Org aggregates
    const allAssessed = templateMaturityList.filter(t => t.currentScore !== null);
    const orgAvgScore =
      allAssessed.length > 0
        ? allAssessed.reduce((sum, t) => sum + t.currentScore!, 0) / allAssessed.length
        : null;
    const orgAvgTarget =
      allAssessed.length > 0
        ? allAssessed.reduce((sum, t) => sum + (t.targetScore ?? 0), 0) / allAssessed.length
        : null;

    const aboveTarget = allAssessed.filter(
      t => t.targetScore !== null && t.currentScore! >= t.targetScore
    ).length;
    const belowTarget = allAssessed.filter(
      t => t.targetScore !== null && t.currentScore! < t.targetScore
    ).length;

    return {
      avgScore: orgAvgScore,
      avgTarget: orgAvgTarget,
      maturityMeta: getMaturityMeta(orgAvgScore),
      categories: categoryMaturityList,
      totalTemplates: templateMaturityList.length,
      assessedTemplates: allAssessed.length,
      aboveTarget,
      belowTarget,
    };
}

export function useMaturityData(): OrgMaturity {
  const [data, setData] = useState<OrgMaturity>(EMPTY_ORG);

  useEffect(() => {
    Promise.all([templatesApi.list(), eventsApi.list(), categoriesApi.list()])
      .then(([templates, events, cats]) => setData(computeOrgMaturity(templates, events, cats)))
      .catch(() => {});
  }, []);

  return data;
}
