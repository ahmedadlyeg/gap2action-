import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ArrowLeft, Users, Search, X, Check, Send, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import {
  users, departments, userGroups,
} from '@/services/mockData';
import { saveEvent, getTemplates, getTemplateSections } from '@/services/store';
import type { AssessmentEvent, MaturityLevel, EventStatus, BuilderSection } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MATURITY_LEVELS: MaturityLevel[] = [
  'Initial', 'Managed', 'Defined', 'Quantitatively Managed', 'Optimizing',
];

const activeUsers = users.filter(u => u.status === 'Active');

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventForm {
  name: string;
  description: string;
  templateId: string;
  startDate: string;
  endDate: string;
  targetMaturityLevel: MaturityLevel | '';
  reassessmentDate: string;
}

// ─── Respondent Checklist Item ────────────────────────────────────────────────

function CheckItem({
  id, label, sub, checked, onChange,
}: { id: string; label: string; sub?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors select-none ${
        checked ? 'bg-primary/8' : 'hover:bg-muted/60'
      }`}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? 'bg-primary border-primary' : 'border-input bg-background'
      }`}>
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </span>
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
        id={`chk-${id}`}
      />
      <span className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">{label}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </span>
    </label>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function EventCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId') ?? '';

  const [form, setForm] = useState<EventForm>({
    name: '',
    description: '',
    templateId: preselectedTemplateId,
    startDate: '',
    endDate: '',
    targetMaturityLevel: '',
    reassessmentDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EventForm, string>>>({});

  // Respondent selection
  const [respTab, setRespTab] = useState('users');
  const [search, setSearch] = useState('');
  const [directIds, setDirectIds] = useState<Set<string>>(new Set());
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  // Section assignment (Step 3)
  const [useSectionAssignment, setUseSectionAssignment] = useState(false);
  const [sectionAssignments, setSectionAssignments] = useState<Record<string, Set<string>>>({});

  // Active templates for picker — deduplicated by family (highest version per root)
  const activeTemplatesForPicker = useMemo(() => {
    const allActive = getTemplates().filter(t => t.status === 'Active');
    allActive.sort((a, b) => {
      const [aMaj = 0, aMin = 0] = a.version.split('.').map(Number);
      const [bMaj = 0, bMin = 0] = b.version.split('.').map(Number);
      return aMaj !== bMaj ? bMaj - aMaj : bMin - aMin;
    });
    const seen = new Set<string>();
    return allActive.filter(t => {
      const root = t.parentVersionId ?? t.id;
      if (seen.has(root)) return false;
      seen.add(root);
      return true;
    });
  }, []);

  // Template sections — loaded from store whenever templateId changes
  const templateSections = useMemo<BuilderSection[]>(() => {
    if (!form.templateId) return [];
    return getTemplateSections(form.templateId) ?? [];
  }, [form.templateId]);

  // Section validation — every section needs >= 1 assigned respondent (only when toggle ON)
  const sectionValidationError = useSectionAssignment &&
    templateSections.some(s => (sectionAssignments[s.id]?.size ?? 0) === 0);

  // Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [launched, setLaunched] = useState(false);

  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
    // Reset section assignment when template changes
    if (k === 'templateId') {
      setUseSectionAssignment(false);
      setSectionAssignments({});
    }
  };

  // Resolve unique respondent IDs — direct + group + dept members, minus exclusions
  const resolvedIds = useMemo(() => {
    const ids = new Set<string>();
    directIds.forEach(id => ids.add(id));
    userGroups.filter(g => groupIds.has(g.id)).forEach(g => g.memberIds.forEach(id => ids.add(id)));
    activeUsers.filter(u => u.department && deptIds.has(u.department)).forEach(u => ids.add(u.id));
    excludedIds.forEach(id => ids.delete(id));
    return Array.from(ids);
  }, [directIds, groupIds, deptIds, excludedIds]);

  const resolvedUsers = activeUsers.filter(u => resolvedIds.includes(u.id));

  // Filtered lists per tab
  const filteredUsers = activeUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.department ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = userGroups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (uid: string, checked: boolean) => {
    setDirectIds(prev => { const s = new Set(prev); if (checked) s.add(uid); else s.delete(uid); return s; });
    // Re-checking a user that was excluded should clear the exclusion
    if (checked) setExcludedIds(prev => { const s = new Set(prev); s.delete(uid); return s; });
  };

  const toggleGroup = (gid: string, checked: boolean) => {
    setGroupIds(prev => { const s = new Set(prev); if (checked) s.add(gid); else s.delete(gid); return s; });
    if (!checked) {
      // When deselecting a group, remove its members from exclusions so re-adding works cleanly
      const memberIds = userGroups.find(g => g.id === gid)?.memberIds ?? [];
      setExcludedIds(prev => {
        const s = new Set(prev);
        memberIds.forEach(id => s.delete(id));
        return s;
      });
    }
  };

  const toggleDept = (name: string, checked: boolean) => {
    setDeptIds(prev => { const s = new Set(prev); if (checked) s.add(name); else s.delete(name); return s; });
    if (!checked) {
      // When deselecting a dept, remove its members from exclusions so re-adding works cleanly
      const memberIds = activeUsers.filter(u => u.department === name).map(u => u.id);
      setExcludedIds(prev => {
        const s = new Set(prev);
        memberIds.forEach(id => s.delete(id));
        return s;
      });
    }
  };

  // ── Section assignment helpers ──────────────────────────────────────────────

  const handleToggleSectionAssignment = () => {
    if (!useSectionAssignment) {
      // Turning ON — pre-assign all resolved respondents to every section
      const init: Record<string, Set<string>> = {};
      templateSections.forEach(s => { init[s.id] = new Set(resolvedIds); });
      setSectionAssignments(init);
    }
    setUseSectionAssignment(v => !v);
  };

  const toggleSectionUser = (sectionId: string, userId: string) => {
    setSectionAssignments(prev => {
      const current = new Set(prev[sectionId] ?? []);
      if (current.has(userId)) current.delete(userId); else current.add(userId);
      return { ...prev, [sectionId]: current };
    });
  };

  const setAllForSection = (sectionId: string) => {
    setSectionAssignments(prev => ({ ...prev, [sectionId]: new Set(resolvedIds) }));
  };

  const clearSection = (sectionId: string) => {
    setSectionAssignments(prev => ({ ...prev, [sectionId]: new Set<string>() }));
  };

  const removeResolved = (uid: string) => {
    if (directIds.has(uid)) {
      setDirectIds(prev => { const s = new Set(prev); s.delete(uid); return s; });
    } else {
      // Came from a group or dept — add to exclusion list
      setExcludedIds(prev => new Set([...prev, uid]));
    }
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof EventForm, string>> = {};
    if (!form.name.trim()) errs.name = 'Event name is required.';
    if (!form.templateId) errs.templateId = 'Please select a template.';
    if (!form.startDate) errs.startDate = 'Start date is required.';
    if (!form.endDate) errs.endDate = 'End date is required.';
    else if (form.endDate <= form.startDate) errs.endDate = 'End date must be after start date.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return false;
    // Section assignment: every section must have at least 1 respondent (errors shown inline)
    if (sectionValidationError) return false;
    return true;
  };

  const handleSaveDraft = () => {
    if (!form.name.trim()) { setErrors({ name: 'Event name is required to save as draft.' }); return; }
    const draft: AssessmentEvent = {
      id: `e_${Date.now()}`,
      templateId: form.templateId,
      name: form.name.trim(),
      description: form.description.trim(),
      status: 'Draft' as EventStatus,
      ownerId: user?.id ?? '',
      startDate: form.startDate,
      endDate: form.endDate,
      targetMaturityLevel: form.targetMaturityLevel || undefined,
      reassessmentDate: form.reassessmentDate || undefined,
      respondentIds: resolvedIds,
      sectionAssignments: useSectionAssignment && templateSections.length > 0
        ? templateSections.map(s => ({
            sectionId: s.id,
            respondentIds: Array.from(sectionAssignments[s.id] ?? []),
          }))
        : undefined,
      respondentProgress: resolvedIds.map(uid => ({
        userId: uid,
        completionPct: 0,
        status: 'Not Started' as const,
      })),
      completionRate: 0,
      createdAt: new Date().toISOString(),
    };
    saveEvent(draft);
    navigate('/');
  };

  const handleLaunch = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const handleConfirmLaunch = () => {
    const newId = `e_${Date.now()}`;
    const tpl = activeTemplatesForPicker.find(t => t.id === form.templateId);
    const newEvent: AssessmentEvent = {
      id: newId,
      templateId: form.templateId,
      name: form.name.trim(),
      description: form.description.trim(),
      status: 'Open' as EventStatus,
      ownerId: user?.id ?? '',
      startDate: form.startDate,
      endDate: form.endDate,
      targetMaturityLevel: form.targetMaturityLevel || undefined,
      reassessmentDate: form.reassessmentDate || undefined,
      respondentIds: resolvedIds,
      sectionAssignments: useSectionAssignment && templateSections.length > 0
        ? templateSections.map(s => ({
            sectionId: s.id,
            respondentIds: Array.from(sectionAssignments[s.id] ?? []),
          }))
        : undefined,
      respondentProgress: resolvedIds.map(uid => ({
        userId: uid,
        completionPct: 0,
        status: 'Not Started' as const,
      })),
      completionRate: 0,
      createdAt: new Date().toISOString(),
    };
    saveEvent(newEvent);
    setLaunched(true);
    toast({ title: 'Event launched successfully', description: newEvent.name, variant: 'success' });
    setTimeout(() => {
      setConfirmOpen(false);
      navigate(`/events/${newId}`);
    }, 1200);
  };

  const selectedTemplate = activeTemplatesForPicker.find(t => t.id === form.templateId);

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b bg-background px-8 py-5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link to="/"><ArrowLeft size={15} /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Create Assessment Event</h1>
            <p className="text-xs text-muted-foreground">Configure and launch a new assessment run</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ── Left: Event Details ── */}
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Event Details</h2>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="ev-name">Event Name <span className="text-destructive">*</span></Label>
                <Input
                  id="ev-name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. EA Maturity Assessment — Q3 2026"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="ev-desc">
                  Description
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">optional</span>
                </Label>
                <Textarea
                  id="ev-desc"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Provide context for respondents about the purpose of this assessment…"
                  rows={3}
                />
              </div>

              {/* Template */}
              <div className="space-y-1.5">
                <Label htmlFor="ev-tpl">Assessment Template <span className="text-destructive">*</span></Label>
                <Select
                  id="ev-tpl"
                  value={form.templateId}
                  onChange={e => set('templateId', e.target.value)}
                >
                  <option value="">— Select a template —</option>
                  {activeTemplatesForPicker.map(t => (
                    <option key={t.id} value={t.id}>{t.name}  (v{t.version})</option>
                  ))}
                </Select>
                {errors.templateId && <p className="text-xs text-destructive">{errors.templateId}</p>}
                {selectedTemplate && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.questionCount} questions · {selectedTemplate.assessmentType ?? 'Maturity'} type
                  </p>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-start">Start Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="ev-start"
                    type="date"
                    value={form.startDate}
                    onChange={e => set('startDate', e.target.value)}
                  />
                  {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-end">End Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="ev-end"
                    type="date"
                    value={form.endDate}
                    onChange={e => set('endDate', e.target.value)}
                    min={form.startDate}
                  />
                  {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
                </div>
              </div>

              {/* Target Maturity + Reassessment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-target">
                    Target Maturity Level
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">optional</span>
                  </Label>
                  <Select
                    id="ev-target"
                    value={form.targetMaturityLevel}
                    onChange={e => set('targetMaturityLevel', e.target.value as MaturityLevel | '')}
                  >
                    <option value="">— Not set —</option>
                    {MATURITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-reassess">
                    Reassessment Date
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">optional</span>
                  </Label>
                  <Input
                    id="ev-reassess"
                    type="date"
                    value={form.reassessmentDate}
                    onChange={e => set('reassessmentDate', e.target.value)}
                    min={form.endDate}
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={handleSaveDraft}>
                Save as Draft
              </Button>
              <Button onClick={handleLaunch} disabled={sectionValidationError}>
                <Send size={14} className="mr-2" /> Launch Event
              </Button>
            </div>
          </div>

          {/* ── Right: Respondent Assignment ── */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Assign Respondents</span>
                </div>
                <Badge variant={resolvedIds.length > 0 ? 'default' : 'outline'}>
                  {resolvedIds.length}
                </Badge>
              </div>

              {/* Tab switcher (slim) */}
              <div className="flex border-b">
                {(['users', 'groups', 'depts'] as const).map((t, i) => {
                  const labels = ['Individuals', 'User Groups', 'Departments'];
                  return (
                    <button
                      key={t}
                      onClick={() => { setRespTab(t); setSearch(''); }}
                      className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                        respTab === t
                          ? 'border-primary text-primary bg-primary/4'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      } ${i > 0 ? 'border-l' : ''}`}
                    >
                      {labels[i]}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="px-3 py-2.5 border-b">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
                {respTab === 'users' && (
                  filteredUsers.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No users found.</p>
                    : filteredUsers.map(u => (
                        <CheckItem
                          key={u.id}
                          id={u.id}
                          label={u.name}
                          sub={`${u.department ?? '—'} · ${u.role}`}
                          checked={directIds.has(u.id)}
                          onChange={checked => toggleUser(u.id, checked)}
                        />
                      ))
                )}
                {respTab === 'groups' && (
                  filteredGroups.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No groups found.</p>
                    : filteredGroups.map(g => (
                        <CheckItem
                          key={g.id}
                          id={g.id}
                          label={g.name}
                          sub={`${g.memberIds.length} member${g.memberIds.length !== 1 ? 's' : ''}`}
                          checked={groupIds.has(g.id)}
                          onChange={checked => toggleGroup(g.id, checked)}
                        />
                      ))
                )}
                {respTab === 'depts' && (
                  filteredDepts.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No departments found.</p>
                    : filteredDepts.map(d => {
                        const count = activeUsers.filter(u => u.department === d.name).length;
                        return (
                          <CheckItem
                            key={d.id}
                            id={d.id}
                            label={d.name}
                            sub={`${count} active user${count !== 1 ? 's' : ''}`}
                            checked={deptIds.has(d.name)}
                            onChange={checked => toggleDept(d.name, checked)}
                          />
                        );
                      })
                )}
              </div>
            </div>

            {/* Summary panel */}
            {resolvedUsers.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b">
                  <UserCheck size={14} className="text-emerald-600" />
                  <span className="text-xs font-semibold text-foreground">
                    {resolvedUsers.length} respondent{resolvedUsers.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <ul className="max-h-52 overflow-y-auto p-2 space-y-0.5">
                  {resolvedUsers.map(u => (
                    <li key={u.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 group hover:bg-muted/50">
                      <UserAvatar name={u.name} initials={u.initials} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                        <p className="text-[10px] text-muted-foreground">{u.department ?? '—'}</p>
                      </div>
                      <button
                        onClick={() => removeResolved(u.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── Step 3: Section Assignment ── */}
        {form.templateId && (
          <div className="mt-8 rounded-xl border bg-card p-6 space-y-5">
            {/* Toggle header */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Section Assignment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {useSectionAssignment
                    ? 'Each section can have a different subset of respondents.'
                    : 'All respondents will answer all sections.'}
                </p>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                <span className="text-xs text-muted-foreground">Assign respondents to specific sections</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useSectionAssignment}
                  onClick={handleToggleSectionAssignment}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    useSectionAssignment ? 'bg-primary' : 'bg-input'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    useSectionAssignment ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </label>
            </div>

            {/* Per-section assignment panel */}
            {useSectionAssignment && (
              templateSections.length === 0
                ? (
                  <p className="text-xs text-muted-foreground italic">
                    No sections found for this template. Save at least one section in the builder first.
                  </p>
                )
                : (
                  <div className="space-y-4">
                    {templateSections.map(section => {
                      const assigned = sectionAssignments[section.id] ?? new Set<string>();
                      const hasError = assigned.size === 0;
                      return (
                        <div
                          key={section.id}
                          className={`rounded-lg border p-4 space-y-3 transition-colors ${
                            hasError ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                          }`}
                        >
                          {/* Section header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">{section.name}</p>
                              {section.description && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {section.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setAllForSection(section.id)}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Select All
                              </button>
                              <span className="text-muted-foreground/40 text-[10px]">·</span>
                              <button
                                type="button"
                                onClick={() => clearSection(section.id)}
                                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          {/* Respondent chips */}
                          {resolvedUsers.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">
                              No respondents selected — add respondents in Step 2 first.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {resolvedUsers.map(u => {
                                const isAssigned = assigned.has(u.id);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => toggleSectionUser(section.id, u.id)}
                                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                                      isAssigned
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                        : 'bg-muted text-muted-foreground border-input hover:bg-muted/70'
                                    }`}
                                  >
                                    <span className="font-mono">{u.initials}</span>
                                    <span>{u.name.split(' ')[0]}</span>
                                    {isAssigned && <Check size={10} className="text-emerald-700" strokeWidth={2.5} />}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Per-section error */}
                          {hasError && (
                            <p className="flex items-center gap-1 text-[10px] font-medium text-destructive">
                              <AlertCircle size={10} /> At least 1 respondent required
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
            )}
          </div>
        )}
      </div>

      {/* ── Launch Confirmation Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={v => { if (!launched) setConfirmOpen(v); }}>
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Send size={16} className="text-primary" />
              Launch Assessment Event?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 mt-2">
                <div className="rounded-lg bg-muted/50 border px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-foreground">{form.name}</p>
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplate.name} · v{selectedTemplate.version}
                    </p>
                  )}
                  {form.startDate && form.endDate && (
                    <p className="text-xs text-muted-foreground">
                      {form.startDate} → {form.endDate}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {resolvedUsers.length > 0
                    ? `Email notifications will be sent to ${resolvedUsers.length} respondent${resolvedUsers.length !== 1 ? 's' : ''} inviting them to complete the assessment.`
                    : 'No respondents have been assigned. You can add them after launching.'}
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  The event status will be set to <strong>Open</strong> and respondents will be notified immediately.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {!launched ? (
              <>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancel</Button>
                </DialogClose>
                <Button size="sm" onClick={handleConfirmLaunch}>
                  <Send size={13} className="mr-1.5" /> Launch Now
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium py-1">
                <Check size={16} /> Event launched — redirecting…
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
