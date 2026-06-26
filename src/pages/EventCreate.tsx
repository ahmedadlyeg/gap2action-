import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ArrowLeft, Users, Search, X, Check, Send, UserCheck, AlertCircle, LayoutGrid, Rocket } from 'lucide-react';
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
import { saveEvent, getTemplates, getTemplateSections, getTemplate, getFramework } from '@/services/store';
import { scoringMethodLabel } from './FrameworkList';
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
      frameworkId: selectedFramework?.id,
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
      frameworkId: selectedFramework?.id,
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
  const selectedTemplateWithFramework = form.templateId ? getTemplate(form.templateId) : undefined;
  const selectedFramework = selectedTemplateWithFramework?.frameworkId
    ? getFramework(selectedTemplateWithFramework.frameworkId) : undefined;

  return (
    <>
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
                {selectedFramework && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <LayoutGrid size={14} className="text-slate-600" />
                      <span className="font-semibold text-sm text-slate-700">{selectedFramework.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                        Scoring: {scoringMethodLabel(selectedFramework.scoringMethod)}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
                        {selectedFramework.allowedQuestionTypes.length} question types
                      </span>
                    </div>
                    {selectedFramework.scoringMethod !== 'weighted_section' && (
                      <p className="text-xs text-amber-700">
                        This framework uses {scoringMethodLabel(selectedFramework.scoringMethod)} scoring. Final scores are calculated at submission time.
                      </p>
                    )}
                  </div>
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
                          checked={directIds.has(u.id) || (resolvedIds.includes(u.id) && !directIds.has(u.id))}
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
                    : filteredDepts.map(d => (
                        <CheckItem
                          key={d.id}
                          id={d.name}
                          label={d.name}
                          sub={`${activeUsers.filter(u => u.department === d.name).length} user${activeUsers.filter(u => u.department === d.name).length !== 1 ? 's' : ''}`}
                          checked={deptIds.has(d.name)}
                          onChange={checked => toggleDept(d.name, checked)}
                        />
                      ))
                )}
              </div>

              {/* Selected summary */}
              {resolvedUsers.length > 0 && (
                <div className="border-t px-4 py-3 bg-muted/20">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Selected ({resolvedUsers.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {resolvedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5"
                      >
                        {u.name}
                        <button
                          type="button"
                          onClick={() => setExcludedIds(prev => { const s = new Set(prev); s.add(u.id); return s; })}
                          className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Section Assignment (optional) ── */}
            {templateSections.length > 1 && resolvedIds.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Section Assignment</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Optionally assign different respondents to each section.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-muted-foreground">Enable</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useSectionAssignment}
                      onClick={handleToggleSectionAssignment}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        useSectionAssignment ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        useSectionAssignment ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </label>
                </div>

                {useSectionAssignment && (
                  <div className="divide-y">
                    {templateSections.map(sec => {
                      const assigned = sectionAssignments[sec.id] ?? new Set<string>();
                      const hasError = assigned.size === 0;
                      return (
                        <div key={sec.id} className={`p-4 space-y-2 ${hasError ? 'bg-red-50/40' : ''}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">{sec.name}</p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setAllForSection(sec.id)}
                                className="text-[11px] text-primary hover:underline"
                              >All</button>
                              <span className="text-muted-foreground/40">·</span>
                              <button
                                type="button"
                                onClick={() => clearSection(sec.id)}
                                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                              >None</button>
                            </div>
                          </div>
                          {hasError && (
                            <p className="text-xs text-destructive">At least one respondent is required.</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {resolvedUsers.map(u => {
                              const on = assigned.has(u.id);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => toggleSectionUser(sec.id, u.id)}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    on
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-background text-muted-foreground border-input hover:border-primary/50 hover:text-foreground'
                                  }`}
                                >
                                  {u.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── Launch Confirm Dialog ── */}
    <Dialog open={confirmOpen} onOpenChange={v => !launched && setConfirmOpen(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket size={16} className="text-primary" />
            Launch Assessment Event?
          </DialogTitle>
          <DialogDescription>
            This will open the event to respondents immediately. Make sure all details are correct before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-1 text-sm text-muted-foreground">
          <p><span className="font-semibold text-foreground">Event: </span>{form.name}</p>
          <p><span className="font-semibold text-foreground">Template: </span>{activeTemplatesForPicker.find(t => t.id === form.templateId)?.name ?? '—'}</p>
          <p><span className="font-semibold text-foreground">Respondents: </span>{resolvedIds.length}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={launched}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirmLaunch} disabled={launched} className="gap-2">
            {launched
              ? <><Check size={14} /> Launched!</>
              : <><Rocket size={14} /> Confirm Launch</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
