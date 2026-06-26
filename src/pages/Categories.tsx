import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Archive, ArchiveRestore, FolderOpen,
  Building2, Zap, Shield, BarChart2, Database, Globe, Users, Cpu,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter,
  SheetTitle, SheetDescription, SheetClose,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { templates as seedTemplates } from '@/services/mockData';
import { getCategories, saveCategory, updateCategory, getTemplates } from '@/services/store';
import type { Category, CategoryStatus } from '@/types';

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  'building-2': Building2,
  'zap': Zap,
  'shield': Shield,
  'bar-chart': BarChart2,
  'database': Database,
  'globe': Globe,
  'users': Users,
  'cpu': Cpu,
  'folder': FolderOpen,
};

const ICON_OPTIONS = [
  { value: 'building-2', icon: Building2, label: 'Building' },
  { value: 'zap', icon: Zap, label: 'Digital' },
  { value: 'shield', icon: Shield, label: 'Security' },
  { value: 'bar-chart', icon: BarChart2, label: 'Analytics' },
  { value: 'database', icon: Database, label: 'Data' },
  { value: 'globe', icon: Globe, label: 'Global' },
  { value: 'users', icon: Users, label: 'People' },
  { value: 'cpu', icon: Cpu, label: 'Technology' },
];

const COLOR_PALETTE = [
  '#2563EB', '#7C3AED', '#059669', '#DC2626',
  '#D97706', '#0891B2', '#DB2777', '#65A30D',
];

function uid() { return `cat${Date.now()}`; }

// ─── Category Sheet ───────────────────────────────────────────────────────────

interface CatFormData {
  name: string;
  description: string;
  icon: string;
  color: string;
  status: CategoryStatus;
}

const EMPTY_FORM: CatFormData = {
  name: '',
  description: '',
  icon: 'building-2',
  color: '#2563EB',
  status: 'Active',
};

interface CatSheetProps {
  open: boolean;
  onClose: () => void;
  editing: Category | null;
  existingNames: string[];
  onSave: (data: CatFormData) => void;
}

function CatSheet({ open, onClose, editing, existingNames, onSave }: CatSheetProps) {
  const [form, setForm] = useState<CatFormData>(
    editing
      ? { name: editing.name, description: editing.description, icon: editing.icon, color: editing.color, status: editing.status }
      : EMPTY_FORM
  );
  const [nameErr, setNameErr] = useState('');

  // Reset when target changes
  const [prevId, setPrevId] = useState(editing?.id);
  if (prevId !== editing?.id) {
    setPrevId(editing?.id);
    setForm(editing
      ? { name: editing.name, description: editing.description, icon: editing.icon, color: editing.color, status: editing.status }
      : EMPTY_FORM
    );
    setNameErr('');
  }

  const set = <K extends keyof CatFormData>(k: K, v: CatFormData[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'name') setNameErr('');
  };

  const handleSave = () => {
    const trimmed = form.name.trim();
    if (!trimmed) { setNameErr('Category name is required.'); return; }
    const dup = existingNames
      .filter(n => !editing || n !== editing.name)
      .map(n => n.toLowerCase())
      .includes(trimmed.toLowerCase());
    if (dup) { setNameErr('A category with this name already exists.'); return; }
    onSave({ ...form, name: trimmed });
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">
            {editing ? 'Edit Category' : 'Create Category'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            {editing ? 'Update category details.' : 'Add a new assessment category.'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Risk Management"
            />
            {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief description of what this category assesses…"
              rows={3}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-4 gap-2">
              {ICON_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const active = form.icon === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('icon', opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-all ${
                      active
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set('color', color)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                    form.color === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
                  }`}
                  style={{ background: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-status">Status</Label>
            <Select
              id="cat-status"
              value={form.status}
              onChange={e => set('status', e.target.value as CategoryStatus)}
            >
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </Select>
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </SheetClose>
          <Button size="sm" onClick={handleSave}>
            {editing ? 'Save Changes' : 'Create Category'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

interface CatCardProps {
  category: Category;
  templateCount: number;
  canManage: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onClick: () => void;
}

function CatCard({ category, templateCount, canManage, onEdit, onToggleArchive, onClick }: CatCardProps) {
  const Icon = ICON_MAP[category.icon] ?? FolderOpen;
  const archived = category.status === 'Archived';

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-card transition-all duration-200 hover:shadow-md ${
        archived ? 'opacity-60' : 'cursor-pointer hover:-translate-y-0.5'
      }`}
      onClick={!archived ? onClick : undefined}
    >
      {/* Color accent bar */}
      <div className="h-1.5 w-full rounded-t-xl" style={{ background: category.color }} />

      <div className="flex-1 p-5">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: category.color + '18' }}
          >
            <Icon size={22} style={{ color: category.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground leading-snug">{category.name}</h3>
              <Badge variant={archived ? 'outline' : 'success'} className="shrink-0 text-[10px]">
                {category.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {category.description}
            </p>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              {templateCount} template{templateCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-5 py-3">
        {archived ? (
          <span className="text-xs text-muted-foreground">Archived</span>
        ) : (
          <span className="text-xs text-primary font-medium group-hover:underline">
            View Templates →
          </span>
        )}

        {canManage && (
          <div
            className="flex items-center gap-0.5"
            onClick={e => e.stopPropagation()}
          >
            {!archived && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                    <Pencil size={13} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${archived ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={onToggleArchive}
                >
                  {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{archived ? 'Restore' : 'Archive'}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Categories() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin';

  const [cats, setCats] = useState<Category[]>(() => getCategories());
  const [showArchived, setShowArchived] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const reload = useCallback(() => {
    setCats(getCategories());
  }, []);

  useEffect(() => {
    window.addEventListener('g2a-store-updated', reload);
    return () => window.removeEventListener('g2a-store-updated', reload);
  }, [reload]);

  const templateCountById = useMemo(() => {
    const allTpls = getTemplates();
    const map: Record<string, number> = {};
    allTpls.forEach(t => {
      if (t.status !== 'Archived') {
        map[t.categoryId] = (map[t.categoryId] ?? 0) + 1;
      }
    });
    // also count seed templates not in store (shouldn't happen once store is primed)
    seedTemplates.forEach(t => {
      if (t.status !== 'Archived' && !allTpls.find(x => x.id === t.id)) {
        map[t.categoryId] = (map[t.categoryId] ?? 0) + 1;
      }
    });
    return map;
  }, [cats]); // re-derive when cats changes (store update)

  const visible = useMemo(
    () => cats.filter(c => showArchived || c.status !== 'Archived'),
    [cats, showArchived]
  );
  const archivedCount = cats.filter(c => c.status === 'Archived').length;
  const existingNames = cats.map(c => c.name);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setSheetOpen(true); };

  const handleSave = (data: CatFormData) => {
    if (editing) {
      updateCategory(editing.id, data);
    } else {
      const newCat: Category = {
        id: uid(),
        ...data,
        templateCount: 0,
        createdAt: new Date().toISOString(),
      };
      saveCategory(newCat);
    }
    reload();
    setSheetOpen(false);
  };

  const toggleArchive = (cat: Category) => {
    const newStatus = cat.status === 'Archived' ? 'Active' : 'Archived';
    updateCategory(cat.id, { status: newStatus as CategoryStatus });
    reload();
  };

  const handleCardClick = (cat: Category) => {
    navigate(`/categories/${cat.id}/templates`, { state: { category: cat } });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assessment Categories</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse and manage assessment categories and their templates.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openCreate} className="shrink-0">
              <Plus size={14} className="mr-1.5" /> Create Category
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
            {showArchived ? 'Hide' : 'Show'} archived categories ({archivedCount})
          </button>
        )}

        {/* Grid */}
        {visible.length === 0 ? (
          <div className="rounded-xl border bg-card py-16 text-center">
            <FolderOpen size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No categories found.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus size={14} className="mr-1.5" /> Create your first category
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(cat => (
              <CatCard
                key={cat.id}
                category={cat}
                templateCount={templateCountById[cat.id] ?? 0}
                canManage={canManage}
                onEdit={() => openEdit(cat)}
                onToggleArchive={() => toggleArchive(cat)}
                onClick={() => handleCardClick(cat)}
              />
            ))}
          </div>
        )}
      </div>

      <CatSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editing={editing}
        existingNames={existingNames}
        onSave={handleSave}
      />
    </TooltipProvider>
  );
}
