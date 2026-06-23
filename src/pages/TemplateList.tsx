import { useState, useMemo } from 'react';
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
import {
  categories as seedCategories,
  templates as seedTemplates,
  users,
} from '@/services/mockData';
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
  const base = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  let code = `${base}-v1`;
  let i = 2;
  while (existingCodes.includes(code)) { code = `${base}-v${i++}`; }
  return code;
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
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Template Name <span className="text-destructive">*</span></Label>
            <Input
              id="tpl-name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Cloud Readiness Assessment"
            />
            {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does this template assess?"
              rows={3}
            />
          </div>

          {/* Assessment Type */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-type">Assessment Type</Label>
            <Input
              id="tpl-type"
              value={form.assessmentType}
              onChange={e => set('assessmentType', e.target.value)}
              placeholder="e.g. Maturity, Readiness, Capability…"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-status">Initial Status</Label>
            <Select
              id="tpl-status"
              value={form.status}
              onChange={e => set('status', e.target.value as TemplateStatus)}
            >
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
  const canManage = user?.role === 'admin' || user?.role === 'assessor';

  // Category: prefer router state (for newly created categories not in seedData)
  const category: Category | undefined =
    (location.state as { category?: Category })?.category ??
    seedCategories.find(c => c.id === id);

  const [templates, setTemplates] = useState<Template[]>(() =>
    seedTemplates.filter(t => t.categoryId === id)
  );
  const [showArchived, setShowArchived] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<Template | null>(null);

  const visible = useMemo(
    () => templates.filter(t => showArchived || t.status !== 'Archived'),
    [templates, showArchived]
  );
  const archivedCount = templates.filter(t => t.status === 'Archived').length;

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
    const existingCodes = templates.map(t => t.code);
    const newTpl: Template = {
      id: `t${Date.now()}`,
      categoryId: id!,
      name: data.name,
      code: genCode(data.name, existingCodes),
      description: data.description,
      assessmentType: data.assessmentType || undefined,
      version: '1.0',
      status: data.status,
      questionCount: 0,
      createdBy: user?.id ?? 'u1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates(prev => [newTpl, ...prev]);
    setSheetOpen(false);
  };

  const handleClone = (tpl: Template) => {
    const clone: Template = {
      ...tpl,
      id: `t${Date.now()}`,
      name: `${tpl.name} (Copy)`,
      code: genCode(`${tpl.name} Copy`, templates.map(t => t.code)),
      status: 'Draft',
      version: '1.0',
      questionCount: tpl.questionCount,
      createdBy: user?.id ?? 'u1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates(prev => [...prev, clone]);
  };

  const handleToggleArchive = (tpl: Template) => {
    if (tpl.status !== 'Archived') {
      setConfirmArchive(tpl);
    } else {
      setTemplates(prev => prev.map(t =>
        t.id === tpl.id ? { ...t, status: 'Draft', updatedAt: new Date().toISOString() } : t
      ));
    }
  };

  const confirmDoArchive = () => {
    if (!confirmArchive) return;
    setTemplates(prev => prev.map(t =>
      t.id === confirmArchive.id ? { ...t, status: 'Archived', updatedAt: new Date().toISOString() } : t
    ));
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
            {/* Category color accent */}
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
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`}
            />
            {showArchived ? 'Hide' : 'Show'} archived templates ({archivedCount})
          </button>
        )}

        {/* Template table */}
        <Card className="overflow-hidden">
          {visible.length === 0 ? (
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
                  {visible.map(tpl => {
                    const archived = tpl.status === 'Archived';
                    return (
                      <tr
                        key={tpl.id}
                        className={`hover:bg-muted/30 transition-colors ${archived ? 'opacity-55' : ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <FileText size={14} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[200px]">{tpl.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground font-mono">{tpl.code}</span>
                                {tpl.assessmentType && (
                                  <span className="text-[10px] text-muted-foreground">· {tpl.assessmentType}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="text-muted-foreground font-mono text-xs">v{tpl.version}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[tpl.status]}`} />
                            <Badge variant={STATUS_VARIANT[tpl.status]}>{tpl.status}</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-muted-foreground hidden md:table-cell">
                          {tpl.questionCount}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                          {userName(tpl.createdBy)}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                          {formatDate(tpl.updatedAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {!archived && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => navigate(`/templates/${tpl.id}/builder`)}
                              >
                                Open Builder <ArrowRight size={12} />
                              </Button>
                            )}
                            {canManage && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleClone(tpl)}
                                    >
                                      <Copy size={13} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Clone</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-7 w-7 ${archived ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground'}`}
                                      onClick={() => handleToggleArchive(tpl)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
            {visible.length} template{visible.length !== 1 ? 's' : ''} shown
            {archivedCount > 0 && !showArchived && ` · ${archivedCount} archived`}
          </div>
        </Card>

        {/* Archive confirm dialog */}
        {confirmArchive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Archive "{confirmArchive.name}"?
              </h3>
              <p className="text-sm text-muted-foreground">
                Archived templates cannot be used in new events. Existing events are unaffected.
                You can restore it later.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setConfirmArchive(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={confirmDoArchive}>
                  Archive Template
                </Button>
              </div>
            </div>
          </div>
        )}

        <TplSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSave={handleCreate}
        />
      </div>
    </TooltipProvider>
  );
}
