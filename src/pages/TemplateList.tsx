import { Fragment, useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, ArrowRight, FileText, Copy, Archive, ArchiveRestore,
  ChevronDown, Home,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter,
  SheetTitle, SheetDescription, SheetClose,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { categories as seedCategories, users } from '@/services/mockData';
import { getTemplates, saveTemplate } from '@/services/store';
import type { Template, TemplateStatus, Category } from '@/types';

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
  return users.find(u => u.id === id)?.name ?? id;
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

// ─── Template Sheet ───────────────────────────────────────────────────────────

interface TplFormData {
  name: string;
  description: string;
  assessmentType: string;
  status: TemplateStatus;
}

const EMPTY_TPL: TplFormData = { name: '', description: '', assessmentType: '', status: 'Draft' };

interface TplSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TplFormData) => void;
}

function TplSheet({ open, onClose, onSave }: TplSheetProps) {
  const [form, setForm] = useState<TplFormData>(EMPTY_TPL);
  const [nameErr, setNameErr] = useState('');

  const set = <K extends keyof TplFormData>(k: K, v: TplFormData[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'name') setNameErr('');
  };

  const handleSave = () => {
    if (!form.name.trim()) { setNameErr('Template name is required.'); return; }
    onSave({ ...form, name: form.name.trim() });
    setForm(EMPTY_TPL);
    setNameErr('');
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { onClose(); setForm(EMPTY_TPL); setNameErr(''); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">Create Template</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            Add a new assessment template to this category.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Template Name <span className="text-destructive">*</span></Label>
            <Input id="tpl-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Cloud Readiness Assessment" />
            {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea id="tpl-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does this template assess?" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-type">Assessment Type</Label>
            <Input id="tpl-type" value={form.assessmentType} onChange={e => set('assessmentType', e.target.value)} placeholder="e.g. Maturity, Readiness, Capability…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-status">Initial Status</Label>
            <Select id="tpl-status" value={form.status} onChange={e => set('status', e.target.value as TemplateStatus)}>
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
            </Select>
          </div>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </SheetClose>
          <Button size="sm" onClick={handleSave}>Create Template</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TemplateList() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin';

  const category: Category | undefined =
    (location.state as { category?: Category })?.category ??
    seedCategories.find(c => c.id === id);

  const [templates, setTemplates] = useState<Template[]>(() =>
    getTemplates().filter(t => t.categoryId === id)
  );
  const reload = useCallback(() => {
    setTemplates(getTemplates().filter(t => t.categoryId === (id ?? '')));
  }, [id]);

  useEffect(() => {
    window.addEventListener('g2a-store-updated', reload);
    return () => window.removeEventListener('g2a-store-updated', reload);
  }, [reload]);

  const [showArchived, setShowArchived] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<Template | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // ── Build version families (BFS handles deep chains) ──────────────────────
  const families = useMemo(() => {
    const idSet = new Set(templates.map(t => t.id));
    const roots = templates.filter(t => !t.parentVersionId || !idSet.has(t.parentVersionId));
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
          templates.filter(x => x.parentVersionId === pid).forEach(c => queue.push(c.id));
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

  const handleCreate = (data: TplFormData) => {
    const newTpl: Template = {
      id: `t${Date.now()}`,
      categoryId: id!,
      name: data.name,
      code: genCode(data.name, templates.map(t => t.code)),
      description: data.description,
      assessmentType: data.assessmentType || undefined,
      version: '1.0',
      status: data.status,
      questionCount: 0,
      createdBy: user?.id ?? 'u1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTemplate(newTpl);
    reload();
    setSheetOpen(false);
  };

  // Clone creates an independent copy (no version relationship)
  const handleClone = (tpl: Template) => {
    const clone: Template = {
      ...tpl,
      id: `t${Date.now()}`,
      name: `${tpl.name} (Copy)`,
      code: genCode(`${tpl.name} Copy`, templates.map(t => t.code)),
      status: 'Draft',
      version: '1.0',
      parentVersionId: undefined,
      createdBy: user?.id ?? 'u1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTemplate(clone);
    reload();
  };

  const handleToggleArchive = (tpl: Template) => {
    if (tpl.status !== 'Archived') {
      setConfirmArchive(tpl);
    } else {
      const restored = { ...tpl, status: 'Draft' as TemplateStatus, updatedAt: new Date().toISOString() };
      saveTemplate(restored);
      reload();
    }
  };

  const confirmDoArchive = () => {
    if (!confirmArchive) return;
    const updated = { ...confirmArchive, status: 'Archived' as TemplateStatus, updatedAt: new Date().toISOString() };
    saveTemplate(updated);
    reload();
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
            <Button size="sm" onClick={() => setSheetOpen(true)} className="shrink-0">
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
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setSheetOpen(true)}>
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
                        <tr className={`hover:bg-muted/30 transition-colors ${archived ? 'opacity-55' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              {/* Version expand toggle */}
                              <button
                                className={`shrink-0 text-muted-foreground hover:text-foreground transition-colors ${!hasOthers ? 'invisible pointer-events-none' : ''}`}
                                onClick={() => toggleFamily(primary.id)}
                                aria-label={expanded ? 'Collapse versions' : 'Expand versions'}
                              >
                                <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                              </button>
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <FileText size={14} className="text-primary" />
                              </div>
                              <div className="min-w-0">
                                <button
                                  className="font-medium text-foreground hover:text-primary truncate max-w-[200px] text-left transition-colors"
                                  onClick={() => navigate(`/templates/${primary.id}/builder`)}
                                >
                                  {primary.name}
                                </button>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground font-mono">{primary.code}</span>
                                  {primary.assessmentType && (
                                    <span className="text-[10px] text-muted-foreground">· {primary.assessmentType}</span>
                                  )}
                                  {hasOthers && (
                                    <span className="text-[10px] font-semibold text-primary/70 cursor-pointer" onClick={() => toggleFamily(primary.id)}>
                                      {others.length + 1} versions
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <span className="text-muted-foreground font-mono text-xs">v{primary.version}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[primary.status]}`} />
                              <Badge variant={STATUS_VARIANT[primary.status]}>{primary.status}</Badge>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right text-muted-foreground hidden md:table-cell">
                            {primary.questionCount}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                            {userName(primary.createdBy)}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                            {formatDate(primary.updatedAt)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {!archived && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => navigate(`/templates/${primary.id}/builder`)}>
                                  Open Builder <ArrowRight size={12} />
                                </Button>
                              )}
                              {canManage && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleClone(primary)}>
                                        <Copy size={13} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Clone (independent copy)</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon"
                                        className={`h-7 w-7 ${archived ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground'}`}
                                        onClick={() => handleToggleArchive(primary)}
                                      >
                                        {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{archived ? 'Restore' : 'Archive'}</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded version rows ── */}
                        {expanded && others.map(tpl => {
                          const tplArchived = tpl.status === 'Archived';
                          return (
                            <tr key={tpl.id} className={`bg-muted/10 hover:bg-muted/20 transition-colors ${tplArchived ? 'opacity-55' : ''}`}>
                              <td className="pl-14 pr-5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-4 border-l-2 border-b-2 border-muted-foreground/25 rounded-bl shrink-0" style={{ marginTop: '-8px' }} />
                                  <span className={`text-xs font-mono font-medium ${tplArchived ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    v{tpl.version}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-2.5 hidden sm:table-cell" />
                              <td className="px-5 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <div className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[tpl.status]}`} />
                                  <Badge variant={STATUS_VARIANT[tpl.status]}>{tpl.status}</Badge>
                                </div>
                              </td>
                              <td className="px-5 py-2.5 hidden md:table-cell" />
                              <td className="px-5 py-2.5 hidden lg:table-cell" />
                              <td className="px-5 py-2.5 text-[11px] text-muted-foreground hidden lg:table-cell">
                                {formatDate(tpl.createdAt)}
                              </td>
                              <td className="px-5 py-2.5">
                                <div className="flex justify-end">
                                  {!tplArchived && (
                                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => navigate(`/templates/${tpl.id}/builder`)}>
                                      Open Builder <ArrowRight size={11} />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
            {visibleFamilies.length} template{visibleFamilies.length !== 1 ? 's' : ''} shown
            {archivedCount > 0 && !showArchived && ` · ${archivedCount} archived`}
          </div>
        </Card>

        {/* Archive confirm dialog */}
        {confirmArchive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Archive "{confirmArchive.name}"?</h3>
              <p className="text-sm text-muted-foreground">
                Archived templates cannot be used in new events. Existing events are unaffected. You can restore it later.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setConfirmArchive(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={confirmDoArchive}>Archive Template</Button>
              </div>
            </div>
          </div>
        )}

        <TplSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSave={handleCreate} />
      </div>
    </TooltipProvider>
  );
}
