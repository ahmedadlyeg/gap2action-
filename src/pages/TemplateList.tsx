import { Fragment, useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, ArrowRight, FileText, Copy, Archive, ArchiveRestore,
  ChevronDown, Home, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { templatesApi, categoriesApi, frameworksApi, type ApiTemplate, type ApiCategory, type ApiFramework } from '@/services/api';
import type { TemplateStatus } from '@/types';

type Template = ApiTemplate & { questionCount?: number };
type Category = ApiCategory;
type AssessmentFramework = ApiFramework;
import { scoringMethodLabel } from './FrameworkList';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<TemplateStatus, 'success' | 'outline' | 'secondary'> = {
  Active: 'success',
  Draft: 'outline',
  Archived: 'secondary',
};

const STATUS_DOT: Record<TemplateStatus, string> = {
  Active: 'bg-emerald-500',
  Draft: 'bg-slate-400',
  Archived: 'bg-red-400',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function userName(id: string) {
  return id; // users resolved from API in a future improvement
}

function genCode(name: string, existingCodes: string[]) {
  const base = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
  let code = `${base}-v1`;
  let i = 2;
  while (existingCodes.includes(code)) { code = `${base}-v${i++}`; }
  return code;
}

function compareVersion(a: string, b: string): number {
  const [aMaj = 0, aMin = 0] = a.split('.').map(Number);
  const [bMaj = 0, bMin = 0] = b.split('.').map(Number);
  return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
}

// ─── Framework Picker Dialog ──────────────────────────────────────────────────




// ─── Main Page ────────────────────────────────────────────────────────────────

export function TemplateList() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin';

  const [category, setCategory] = useState<Category | undefined>(
    (location.state as { category?: Category })?.category
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [tpls, cat] = await Promise.all([
        templatesApi.list(id),
        category ? Promise.resolve(category) : categoriesApi.get(id ?? '').catch(() => undefined),
      ]);
      setTemplates(tpls);
      if (!category && cat) setCategory(cat);
    } finally {
      setLoading(false);
    }
  }, [id, category]);

  useEffect(() => { reload(); }, [reload]);

  const [showArchived, setShowArchived] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<Template | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // ── Build version families (BFS handles deep chains) ──────────────────────
  const families = useMemo(() => {
    const idSet = new Set(templates.map(t => t.id));
    const roots = templates.filter(t => !(t as Template & { parentVersionId?: string }).parentVersionId || !idSet.has((t as Template & { parentVersionId?: string }).parentVersionId!));
    return roots.map(root => {
      const allVersions: Template[] = [];
      const queue = [root.id];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const pid = queue.shift()!;
        if (visited.has(pid)) continue;
        visited.add(pid);
        const t = templates.find(x => x.id === pid);
        if (t) {
          allVersions.push(t);
          templates.filter(x => (x as Template & { parentVersionId?: string }).parentVersionId === pid).forEach(ch => queue.push(ch.id));
        }
      }
      allVersions.sort((a, b) => compareVersion(b.version, a.version));
      const primary =
        allVersions.find(t => t.status === 'Active') ??
        allVersions.find(t => t.status === 'Draft') ??
        allVersions[0];
      return { primary, allVersions, others: allVersions.filter(t => t.id !== primary.id) };
    });
  }, [templates]);

  const archivedCount = templates.filter(t => t.status === 'Archived').length;

  const visibleFamilies = useMemo(
    () => families.filter(f => showArchived || f.primary.status !== 'Archived'),
    [families, showArchived]
  );

  const toggleFamily = (primaryId: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(primaryId)) next.delete(primaryId); else next.add(primaryId);
      return next;
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading templates…</div>;
  }

  if (!category) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Category not found.</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link to="/categories">← Back to Categories</Link>
        </Button>
      </div>
    );
  }


  const handlePickerConfirm = async (frameworkId: string) => {
    const newTpl = await templatesApi.create({
      categoryId: id!,
      name: 'Untitled Template',
      code: genCode('Untitled Template', templates.map(t => t.code)),
      description: '',
      version: '1.0',
      status: 'Draft',
      frameworkId,
    });
    setPickerOpen(false);
    navigate(`/templates/${newTpl.id}/builder`);
  };

  const handleClone = async (tpl: Template) => {
    await templatesApi.create({
      categoryId: id!,
      name: `${tpl.name} (Copy)`,
      code: genCode(`${tpl.name} Copy`, templates.map(t => t.code)),
      description: tpl.description,
      assessmentType: tpl.assessmentType,
      version: '1.0',
      status: 'Draft',
      frameworkId: tpl.frameworkId,
    });
    await reload();
  };

  const handleToggleArchive = async (tpl: Template) => {
    if (tpl.status !== 'Archived') {
      setConfirmArchive(tpl);
    } else {
      await templatesApi.update(tpl.id, { status: 'Draft' as TemplateStatus });
      await reload();
    }
  };

  const confirmDoArchive = async () => {
    if (!confirmArchive) return;
    await templatesApi.update(confirmArchive.id, { status: 'Archived' as TemplateStatus });
    await reload();
    setConfirmArchive(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home size={13} /> Home
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <Link to="/categories" className="hover:text-foreground transition-colors">Categories</Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl mt-0.5"
              style={{ background: category.color + '18' }}
            >
              <FileText size={22} style={{ color: category.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{category.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">{category.description}</p>
            </div>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setPickerOpen(true)} className="shrink-0">
              <Plus size={14} className="mr-1.5" /> Create Template
            </Button>
          )}
        </div>

        {/* Archived toggle */}
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown size={15} className={`transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`} />
            {showArchived ? 'Hide' : 'Show'} archived templates ({archivedCount})
          </button>
        )}

        {/* Template table */}
        <Card className="overflow-hidden">
          {visibleFamilies.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={28} className="mx-auto text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">No templates in this category yet.</p>
              {canManage && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setPickerOpen(true)}>
                  <Plus size={14} className="mr-1.5" /> Create first template
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Template</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Version</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground hidden md:table-cell">Questions</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Created By</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Last Modified</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleFamilies.map(({ primary, others }) => {
                    const archived = primary.status === 'Archived';
                    const hasOthers = others.length > 0;
                    const expanded = expandedFamilies.has(primary.id);

                    return (
                      <Fragment key={primary.id}>
                        {/* ── Primary row ── */}
                        <tr
                          className={`group/trow transition-colors hover:bg-muted/20 ${archived ? 'opacity-60' : ''}`}
                        >
                          {/* Name + expand toggle */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 min-w-0">
                              {hasOthers && (
                                <button
                                  onClick={() => toggleFamily(primary.id)}
                                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ChevronDown
                                    size={14}
                                    className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                                  />
                                </button>
                              )}
                              <div className="min-w-0">
                                <Link
                                  to={`/templates/${primary.id}/builder`}
                                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block"
                                >
                                  {primary.name}
                                </Link>
                                {primary.description && (
                                  <p className="text-[11px] text-muted-foreground truncate mt-0.5 max-w-xs">
                                    {primary.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Version */}
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <span className="text-xs font-mono text-muted-foreground">v{primary.version}</span>
                          </td>
                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <Badge variant={STATUS_VARIANT[primary.status]} className="text-[10px]">
                              <span className={`mr-1 h-1.5 w-1.5 rounded-full inline-block ${STATUS_DOT[primary.status]}`} />
                              {primary.status}
                            </Badge>
                          </td>
                          {/* Question count */}
                          <td className="px-5 py-3.5 text-right text-xs text-muted-foreground hidden md:table-cell">
                            {primary.questionCount ?? 0}
                          </td>
                          {/* Created by */}
                          <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                            {userName((primary as unknown as { createdBy?: string }).createdBy ?? '')}
                          </td>
                          {/* Last modified */}
                          <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                            {formatDate(primary.updatedAt)}
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover/trow:opacity-100 transition-opacity">
                              {canManage && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleClone(primary)}
                                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Copy size={13} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Clone</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleToggleArchive(primary)}
                                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>{archived ? 'Restore' : 'Archive'}</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                              <Link
                                to={`/templates/${primary.id}/builder`}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ArrowRight size={13} />
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {/* ── Child version rows (expanded) ── */}
                        {expanded && others.map(tpl => (
                          <tr key={tpl.id} className="bg-muted/10 hover:bg-muted/20 transition-colors">
                            <td className="pl-12 pr-5 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-px h-4 bg-border shrink-0" />
                                <Link
                                  to={`/templates/${tpl.id}/builder`}
                                  className="text-xs font-medium text-muted-foreground hover:text-foreground truncate block"
                                >
                                  {tpl.name}
                                </Link>
                              </div>
                            </td>
                            <td className="px-5 py-2.5 hidden sm:table-cell">
                              <span className="text-xs font-mono text-muted-foreground">v{tpl.version}</span>
                            </td>
                            <td className="px-5 py-2.5">
                              <Badge variant={STATUS_VARIANT[tpl.status]} className="text-[10px]">
                                <span className={`mr-1 h-1.5 w-1.5 rounded-full inline-block ${STATUS_DOT[tpl.status]}`} />
                                {tpl.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">
                              {tpl.questionCount ?? 0}
                            </td>
                            <td className="px-5 py-2.5 hidden lg:table-cell" />
                            <td className="px-5 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                              {formatDate(tpl.updatedAt)}
                            </td>
                            <td className="px-5 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canManage && (
                                  <>
                                    <button
                                      onClick={() => handleClone(tpl)}
                                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleArchive(tpl)}
                                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {tpl.status === 'Archived' ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                    </button>
                                  </>
                                )}
                                <Link
                                  to={`/templates/${tpl.id}/builder`}
                                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ArrowRight size={13} />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Show / hide archived toggle (bottom) */}
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown size={15} className={`transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`} />
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
      </div>

      {/* ── Confirm archive dialog ── */}
      <Dialog open={confirmArchive !== null} onOpenChange={open => !open && setConfirmArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Template</DialogTitle>
            <DialogDescription>
              Archiving <strong>{confirmArchive?.name}</strong> will prevent new events from using it.
              Existing events are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={confirmDoArchive}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Framework picker dialog ── */}
      <FrameworkPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handlePickerConfirm}
      />
    </TooltipProvider>
  );
}

// ── Framework Picker Dialog ───────────────────────────────────────────────────

function FrameworkPickerDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (frameworkId: string) => void;
}) {
  const [selected, setSelected] = useState<string>('');
  const [frameworks, setFrameworks] = useState<AssessmentFramework[]>([]);
  useEffect(() => { frameworksApi.list().then(setFrameworks).catch(() => {}); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Assessment Framework</DialogTitle>
          <DialogDescription>Select the framework that defines scoring rules and question types for this template.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-4 space-y-2 max-h-72 overflow-y-auto">
          {frameworks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No frameworks configured yet.</p>
          ) : frameworks.map(fw => (
            <button
              key={fw.id}
              onClick={() => setSelected(fw.id)}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                selected === fw.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{fw.name}</p>
                  {fw.description && <p className="text-xs text-muted-foreground mt-0.5">{fw.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Scoring: {scoringMethodLabel(fw.scoringMethod as import('@/types').ScoringMethod)} &middot; {fw.maturityLevels.length} maturity levels
                  </p>
                </div>
                {selected === fw.id && <CheckCircle2 size={16} className="text-primary shrink-0" />}
              </div>
            </button>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={() => selected && onConfirm(selected)} disabled={!selected}>
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
