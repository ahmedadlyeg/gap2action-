import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Archive, LayoutGrid, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFrameworks, getTemplates, updateFramework } from '@/services/store';
import type { AssessmentFramework, ScoringMethod } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function scoringMethodLabel(method: ScoringMethod): string {
  switch (method) {
    case 'weighted_section': return 'Weighted Section %';
    case 'simple_average': return 'Simple Average';
    case 'categorical_weight': return 'Categorical Weight';
  }
}

const Q_TYPE_LABEL_MAP: Record<string, string> = {
  'rating-scale': 'Rating Scale',
  'yes-no': 'Yes/No',
  'single-choice': 'Single Choice',
  'multi-choice': 'Multi Choice',
  'free-text': 'Free Text',
  'yes-no-partial': 'Yes/No/Partial',
  'percentage': 'Percentage',
  'frequency': 'Frequency',
};

const STATUS_VARIANT: Record<string, 'success' | 'outline' | 'secondary'> = {
  Active: 'success',
  Draft: 'outline',
  Archived: 'secondary',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FrameworkList() {
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState<AssessmentFramework[]>(() => getFrameworks());
  const [templates, setTemplates] = useState(() => getTemplates());

  useEffect(() => {
    const handler = () => {
      setFrameworks(getFrameworks());
      setTemplates(getTemplates());
    };
    window.addEventListener('g2a-store-updated', handler);
    return () => window.removeEventListener('g2a-store-updated', handler);
  }, []);

  const activeCount = frameworks.filter(fw => fw.status === 'Active').length;
  const draftCount = frameworks.filter(fw => fw.status === 'Draft').length;
  const templatesUsingFrameworkCount = templates.filter(t => !!t.frameworkId).length;

  const getTemplateCount = (fwId: string) =>
    templates.filter(t => t.frameworkId === fwId).length;

  const handleArchive = (fw: AssessmentFramework) => {
    updateFramework(fw.id, { status: 'Archived', updatedAt: new Date().toISOString() });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 mt-0.5">
              <LayoutGrid size={22} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Assessment Frameworks</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Define scoring methods, allowed question types, and maturity level configurations for your assessments.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/admin/frameworks/new')} className="shrink-0">
            <Plus size={14} className="mr-1.5" /> New Framework
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Draft</p>
            <p className="text-3xl font-bold text-slate-500 mt-1">{draftCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Templates Using Frameworks</p>
            <p className="text-3xl font-bold text-primary mt-1">{templatesUsingFrameworkCount}</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {frameworks.length === 0 ? (
            <div className="py-16 text-center">
              <LayoutGrid size={28} className="mx-auto text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">No frameworks yet.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/admin/frameworks/new')}>
                <Plus size={14} className="mr-1.5" /> Create first framework
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Scoring Method</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Question Types</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Templates</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {frameworks.map(fw => {
                    const tplCount = getTemplateCount(fw.id);
                    const visibleTypes = fw.allowedQuestionTypes.slice(0, 4);
                    const extraCount = fw.allowedQuestionTypes.length - visibleTypes.length;
                    const isArchived = fw.status === 'Archived';

                    return (
                      <tr key={fw.id} className={`hover:bg-muted/30 transition-colors ${isArchived ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-medium text-foreground">{fw.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{fw.description}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">
                          {scoringMethodLabel(fw.scoringMethod)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {visibleTypes.map(qt => (
                              <span key={qt} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                                {Q_TYPE_LABEL_MAP[qt] ?? qt}
                              </span>
                            ))}
                            {extraCount > 0 && (
                              <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                                +{extraCount} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-muted-foreground">
                          {tplCount}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={STATUS_VARIANT[fw.status]}>{fw.status}</Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => navigate(`/admin/frameworks/${fw.id}`)}
                                >
                                  <Edit2 size={13} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit framework</TooltipContent>
                            </Tooltip>

                            {!isArchived && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                                      onClick={() => handleArchive(fw)}
                                      disabled={tplCount > 0}
                                    >
                                      <Archive size={13} />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {tplCount > 0
                                    ? `Cannot archive — ${tplCount} template${tplCount !== 1 ? 's' : ''} use this framework`
                                    : 'Archive framework'}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
            {frameworks.length} framework{frameworks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
