import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, Pencil, UserX, UserCheck,
  Trash2, Users, Building2,
  Upload, DownloadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter,
  SheetTitle, SheetDescription, SheetClose,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usersApi, type ApiUser, type ApiDepartment, type ApiGroup } from '@/services/api';
import type { User, UserRole, UserStatus, Department, UserGroup } from '@/types';
import {
  parseDepartmentsCSV, parseUsersCSV, parseGroupsCSV,
  generateDepartmentsTemplate, generateUsersTemplate, generateGroupsTemplate,
  type DeptImportRow, type UserImportRow, type GroupImportRow,
} from '@/utils/parseCSV';
import { ImportPreviewModal, type ImportPreview } from '@/components/shared/ImportPreviewModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────


const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  assessor: 'Assessor',
  respondent: 'Respondent',
};

const ROLE_VARIANT: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  assessor: 'secondary',
  respondent: 'outline',
};

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import state shape ───────────────────────────────────────────────────────

interface ActiveImport {
  entityType: 'departments' | 'users' | 'groups';
  errors: string[];
  warnings: string[];
  preview: ImportPreview;
  deptRows?: DeptImportRow[];
  userRows?: UserImportRow[];
  groupRows?: GroupImportRow[];
}

// ─── User Form ────────────────────────────────────────────────────────────────

interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  department: string;
  groupIds: string[];
  status: UserStatus;
}

const EMPTY_FORM: UserFormData = {
  name: '', email: '', role: 'respondent', department: '', groupIds: [], status: 'Active',
};

interface UserSheetProps {
  open: boolean;
  onClose: () => void;
  editing: User | null;
  existingEmails: string[];
  groups: UserGroup[];
  deptNames: string[];
  onSave: (data: UserFormData) => void;
}

function UserSheet({ open, onClose, editing, existingEmails, groups, deptNames, onSave }: UserSheetProps) {
  const [form, setForm] = useState<UserFormData>(
    editing
      ? { name: editing.name, email: editing.email, role: editing.role, department: editing.department ?? '', groupIds: editing.groupIds ?? [], status: editing.status }
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  const prevEditing = useRef(editing?.id);
  if (prevEditing.current !== editing?.id) {
    prevEditing.current = editing?.id;
    const next = editing
      ? { name: editing.name, email: editing.email, role: editing.role, department: editing.department ?? '', groupIds: editing.groupIds ?? [], status: editing.status }
      : EMPTY_FORM;
    setTimeout(() => setForm(next), 0);
  }

  const set = <K extends keyof UserFormData>(k: K, v: UserFormData[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const toggleGroup = (id: string) => {
    set('groupIds', form.groupIds.includes(id) ? form.groupIds.filter(g => g !== id) : [...form.groupIds, id]);
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address.';
    } else {
      const dup = existingEmails.filter(e => !editing || e !== editing.email).includes(form.email.toLowerCase());
      if (dup) errs.email = 'This email is already in use.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">{editing ? 'Edit User' : 'Create User'}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            {editing ? 'Update user details and permissions.' : 'Add a new user to the platform.'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="u-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Jane Smith" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email Address <span className="text-destructive">*</span></Label>
            <Input id="u-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-role">Role</Label>
            <Select id="u-role" value={form.role} onChange={e => set('role', e.target.value as UserRole)}>
              <option value="admin">Admin</option>
              <option value="assessor">Assessor</option>
              <option value="respondent">Respondent</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-dept">Department</Label>
            <Select id="u-dept" value={form.department} onChange={e => set('department', e.target.value)}>
              <option value="">— None —</option>
              {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-status">Status</Label>
            <Select id="u-status" value={form.status} onChange={e => set('status', e.target.value as UserStatus)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>User Groups</Label>
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No groups defined yet.</p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="h-4 w-4 rounded border-input accent-primary" />
                    <span className="text-sm">{g.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{g.memberIds.length} member{g.memberIds.length !== 1 ? 's' : ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </SheetClose>
          <Button size="sm" onClick={() => { if (validate()) onSave({ ...form, email: form.email.toLowerCase() }); }}>
            {editing ? 'Save Changes' : 'Create User'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

interface UsersTabProps {
  users: User[];
  groups: UserGroup[];
  deptNames: string[];
  isAdmin: boolean;
  onAdd: (data: UserFormData) => void;
  onEdit: (user: User, data: UserFormData) => void;
  onToggleStatus: (user: User) => void;
  onImportFile: (file: File) => void;
  onDownloadTemplate: () => void;
}

function UsersTab({ users, groups, deptNames, isAdmin, onAdd, onEdit, onToggleStatus, onImportFile, onDownloadTemplate }: UsersTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => users.filter(u => {
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    if (filterRole && u.role !== filterRole) return false;
    if (filterDept && u.department !== filterDept) return false;
    if (filterStatus && u.status !== filterStatus) return false;
    return true;
  }), [users, search, filterRole, filterDept, filterStatus]);

  const handleSave = (data: UserFormData) => {
    if (editing) onEdit(editing, data);
    else onAdd(data);
    setSheetOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="w-36">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="assessor">Assessor</option>
          <option value="respondent">Respondent</option>
        </Select>
        <Select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-48">
          <option value="">All Departments</option>
          {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-32">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {isAdmin && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownloadTemplate}>
                    <DownloadCloud size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download blank CSV template</TooltipContent>
              </Tooltip>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} className="mr-1.5" /> Import CSV
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true); }}>
            <Plus size={14} className="mr-1.5" /> Create User
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Department</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No users match the current filters.</td></tr>
              ) : filtered.map(u => {
                const inactive = u.status === 'Inactive';
                return (
                  <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${inactive ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={inactive ? 'bg-slate-200 text-slate-400' : ''}>{u.initials}</AvatarFallback>
                        </Avatar>
                        <span className={`font-medium ${inactive ? 'text-muted-foreground' : 'text-foreground'}`}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{u.email}</td>
                    <td className="px-5 py-3.5"><Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">{u.department ?? '—'}</td>
                    <td className="px-5 py-3.5"><Badge variant={inactive ? 'outline' : 'success'}>{u.status}</Badge></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(u); setSheetOpen(true); }}>
                              <Pencil size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit user</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon"
                              className={`h-8 w-8 ${inactive ? 'text-emerald-600 hover:text-emerald-700' : 'text-destructive hover:text-destructive'}`}
                              onClick={() => onToggleStatus(u)}>
                              {inactive ? <UserCheck size={14} /> : <UserX size={14} />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{inactive ? 'Reactivate' : 'Deactivate'}</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
          Showing {filtered.length} of {users.length} users
        </div>
      </Card>

      <UserSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing}
        existingEmails={users.map(u => u.email.toLowerCase())} groups={groups} deptNames={deptNames} onSave={handleSave} />
    </div>
  );
}

// ─── Departments Tab ──────────────────────────────────────────────────────────

interface DepartmentsTabProps {
  departments: Department[];
  users: User[];
  isAdmin: boolean;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onImportFile: (file: File) => void;
  onDownloadTemplate: () => void;
}

function DepartmentsTab({ departments, users, isAdmin, onAdd, onRename, onDelete, onImportFile, onDownloadTemplate }: DepartmentsTabProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userCountByDept = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach(u => { if (u.department) map[u.department] = (map[u.department] ?? 0) + 1; });
    return map;
  }, [users]);

  const commitEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex gap-2">
        <Input placeholder="New department name…" value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onAdd(newName.trim()); setNewName(''); } }}
          className="flex-1" />
        <Button size="sm" onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(''); } }} disabled={!newName.trim()}>
          <Plus size={14} className="mr-1.5" /> Add
        </Button>
        {isAdmin && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onDownloadTemplate}>
                  <DownloadCloud size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download blank CSV template</TooltipContent>
            </Tooltip>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} className="mr-1.5" /> Import CSV
            </Button>
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {departments.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No departments defined yet.</CardContent>
        ) : (
          <div className="divide-y">
            {departments.map(dept => {
              const count = userCountByDept[dept.name] ?? 0;
              const isEditing = editingId === dept.id;
              return (
                <div key={dept.id} className="flex items-center gap-4 px-5 py-3.5 group hover:bg-muted/30 transition-colors">
                  <Building2 size={16} className="text-muted-foreground shrink-0" />
                  {isEditing ? (
                    <Input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(dept.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(dept.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 h-7 text-sm" />
                  ) : (
                    <span className="flex-1 text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => { setEditingId(dept.id); setEditValue(dept.name); }} title="Click to rename">
                      {dept.name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">{count} user{count !== 1 ? 's' : ''}</span>
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditingId(dept.id); setEditValue(dept.name); }}>
                            <Pencil size={13} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              disabled={count > 0} onClick={() => count === 0 && onDelete(dept.id)}>
                              <Trash2 size={13} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {count > 0 ? `Cannot delete — ${count} user${count !== 1 ? 's' : ''} in this department` : 'Delete department'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Group Sheet ──────────────────────────────────────────────────────────────

interface GroupSheetProps {
  open: boolean;
  onClose: () => void;
  editing: UserGroup | null;
  allUsers: User[];
  onSave: (name: string, memberIds: string[]) => void;
}

function GroupSheet({ open, onClose, editing, allUsers, onSave }: GroupSheetProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(editing?.memberIds ?? []);
  const [search, setSearch] = useState('');
  const [nameErr, setNameErr] = useState('');

  const prevId = useRef(editing?.id);
  if (prevId.current !== editing?.id) {
    prevId.current = editing?.id;
    setTimeout(() => { setName(editing?.name ?? ''); setMemberIds(editing?.memberIds ?? []); setSearch(''); setNameErr(''); }, 0);
  }

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const filteredUsers = allUsers.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">{editing ? 'Edit Group' : 'Create Group'}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            {editing ? 'Update the group name and membership.' : 'Create a new user group.'}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Group Name <span className="text-destructive">*</span></Label>
            <Input id="g-name" value={name} onChange={e => { setName(e.target.value); setNameErr(''); }} placeholder="e.g. EA Core Team" />
            {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No users found.</p>
              ) : filteredUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} className="h-4 w-4 rounded border-input accent-primary" />
                  <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[10px]">{u.initials}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant={ROLE_VARIANT[u.role]} className="shrink-0 text-[10px]">{ROLE_LABELS[u.role]}</Badge>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{memberIds.length} member{memberIds.length !== 1 ? 's' : ''} selected</p>
          </div>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild><Button variant="outline" size="sm">Cancel</Button></SheetClose>
          <Button size="sm" onClick={() => {
            if (!name.trim()) { setNameErr('Group name is required.'); return; }
            onSave(name.trim(), memberIds);
            onClose();
          }}>
            {editing ? 'Save Changes' : 'Create Group'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── User Groups Tab ──────────────────────────────────────────────────────────

interface GroupsTabProps {
  groups: UserGroup[];
  allUsers: User[];
  isAdmin: boolean;
  onAdd: (name: string, memberIds: string[]) => void;
  onEdit: (group: UserGroup, name: string, memberIds: string[]) => void;
  onDelete: (id: string) => void;
  onImportFile: (file: File) => void;
  onDownloadTemplate: () => void;
}

function GroupsTab({ groups, allUsers, isAdmin, onAdd, onEdit, onDelete, onImportFile, onDownloadTemplate }: GroupsTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (name: string, memberIds: string[]) => {
    if (editingGroup) onEdit(editingGroup, name, memberIds);
    else onAdd(name, memberIds);
    setSheetOpen(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end gap-2">
        {isAdmin && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownloadTemplate}>
                  <DownloadCloud size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download blank CSV template</TooltipContent>
            </Tooltip>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} className="mr-1.5" /> Import CSV
            </Button>
          </>
        )}
        <Button size="sm" onClick={() => { setEditingGroup(null); setSheetOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Create Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No user groups yet. Create one to get started.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const members = allUsers.filter(u => group.memberIds.includes(u.id));
            return (
              <Card key={group.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{group.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingGroup(group); setSheetOpen(true); }}>
                        <Pencil size={14} />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(group.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete group</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px]">{m.initials}</AvatarFallback></Avatar>
                          <span className="text-xs text-muted-foreground">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {confirmDelete && (() => {
        const group = groups.find(g => g.id === confirmDelete);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Delete "{group?.name}"?</h3>
              <p className="text-sm text-muted-foreground">This will permanently remove the group. Users will not be deleted.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}>Delete</Button>
              </div>
            </div>
          </div>
        );
      })()}

      <GroupSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editing={editingGroup} allUsers={allUsers} onSave={handleSave} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'users' | 'departments' | 'groups';

function apiUserToLocal(u: ApiUser, deptMap: Map<string, string>): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    initials: u.initials,
    groupIds: u.groupIds ?? [],
    department: u.departmentId ? deptMap.get(u.departmentId) : undefined,
  };
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const [tab, setTab] = useState<Tab>('users');
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [localDepts, setLocalDepts] = useState<Department[]>([]);
  const [localGroups, setLocalGroups] = useState<UserGroup[]>([]);
  const [activeImport, setActiveImport] = useState<ActiveImport | null>(null);

  const deptNames = localDepts.map(d => d.name);

  // ─── Load from API ────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    const [apiUsers, depts, groups] = await Promise.all([
      usersApi.list().catch(() => [] as ApiUser[]),
      usersApi.departments().catch(() => [] as ApiDepartment[]),
      usersApi.groups().catch(() => [] as ApiGroup[]),
    ]);
    const deptMap = new Map(depts.map(d => [d.id, d.name]));
    setLocalUsers(apiUsers.map(u => apiUserToLocal(u, deptMap)));
    setLocalDepts(depts as Department[]);
    setLocalGroups(groups as UserGroup[]);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ─── User mutations ───────────────────────────────────────────────────────

  const addUser = async (data: UserFormData) => {
    const deptId = data.department
      ? localDepts.find(d => d.name === data.department)?.id
      : undefined;
    try {
      const created = await usersApi.create({
        name: data.name.trim(),
        email: data.email,
        password: 'ChangeMe123!',
        role: data.role,
        ...(deptId && { departmentId: deptId }),
      });
      // Sync group memberships
      for (const gid of data.groupIds) {
        const g = localGroups.find(g => g.id === gid);
        if (g) await usersApi.updateGroup(gid, { memberIds: [...new Set([...g.memberIds, created.id])] }).catch(() => {});
      }
      await reload();
      toast({ title: 'User created', description: `${data.name} has been added.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      toast({ title: 'Error', description: msg, variant: 'error' });
    }
  };

  const editUser = async (original: User, data: UserFormData) => {
    const deptId = data.department
      ? (localDepts.find(d => d.name === data.department)?.id ?? null)
      : null;
    await usersApi.update(original.id, {
      name: data.name.trim(),
      role: data.role,
      status: data.status,
      departmentId: deptId,
    }).catch(() => {});
    // Sync group memberships
    for (const g of localGroups) {
      const inGroup = data.groupIds.includes(g.id);
      const wasIn = g.memberIds.includes(original.id);
      if (inGroup !== wasIn) {
        const next = inGroup
          ? [...new Set([...g.memberIds, original.id])]
          : g.memberIds.filter(m => m !== original.id);
        await usersApi.updateGroup(g.id, { memberIds: next }).catch(() => {});
      }
    }
    await reload();
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    await usersApi.update(user.id, { status: newStatus as User['status'] }).catch(() => {});
    await reload();
  };

  // ─── Department mutations ─────────────────────────────────────────────────

  const addDept = async (name: string) => {
    await usersApi.createDepartment(name).catch(() => {});
    await reload();
  };

  const renameDept = async (id: string, name: string) => {
    await usersApi.updateDepartment(id, name).catch(() => {});
    await reload();
  };

  const deleteDept = async (id: string) => {
    await usersApi.deleteDepartment(id).catch(() => {});
    await reload();
  };

  // ─── Group mutations ──────────────────────────────────────────────────────

  const addGroup = async (name: string, memberIds: string[]) => {
    await usersApi.createGroup({ name, memberIds }).catch(() => {});
    await reload();
  };

  const editGroup = async (original: UserGroup, name: string, memberIds: string[]) => {
    await usersApi.updateGroup(original.id, { name, memberIds }).catch(() => {});
    await reload();
  };

  const deleteGroup = async (id: string) => {
    await usersApi.deleteGroup(id).catch(() => {});
    await reload();
  };

  // ─── Import file handlers ─────────────────────────────────────────────────

  const handleDeptImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { rows, errors, warnings } = parseDepartmentsCSV(text);
      const existingNames = new Set(localDepts.map(d => d.name.toLowerCase()));
      const newCount = rows.filter(r => !existingNames.has(r.name.toLowerCase())).length;
      const preview: ImportPreview = {
        total: rows.length,
        newCount,
        conflictCount: rows.length - newCount,
        rows: rows.slice(0, 5).map(r => ({ label: r.name, isNew: !existingNames.has(r.name.toLowerCase()) })),
      };
      setActiveImport({ entityType: 'departments', errors, warnings, preview, deptRows: rows });
    };
    reader.readAsText(file);
  };

  const handleUserImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { rows, errors, warnings } = parseUsersCSV(text);
      const existingEmails = new Set(localUsers.map(u => u.email.toLowerCase()));
      const newCount = rows.filter(r => !existingEmails.has(r.email.toLowerCase())).length;
      const preview: ImportPreview = {
        total: rows.length,
        newCount,
        conflictCount: rows.length - newCount,
        rows: rows.slice(0, 5).map(r => ({ label: `${r.name} <${r.email}>`, isNew: !existingEmails.has(r.email.toLowerCase()) })),
      };
      setActiveImport({ entityType: 'users', errors, warnings, preview, userRows: rows });
    };
    reader.readAsText(file);
  };

  const handleGroupImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { rows, errors, warnings } = parseGroupsCSV(text);
      const existingNames = new Set(localGroups.map(g => g.name.toLowerCase()));
      const newCount = rows.filter(r => !existingNames.has(r.name.toLowerCase())).length;
      const preview: ImportPreview = {
        total: rows.length,
        newCount,
        conflictCount: rows.length - newCount,
        rows: rows.slice(0, 5).map(r => ({ label: `${r.name} (${r.members.length} members)`, isNew: !existingNames.has(r.name.toLowerCase()) })),
      };
      setActiveImport({ entityType: 'groups', errors, warnings, preview, groupRows: rows });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async (_mode: 'skip' | 'update') => {
    if (!activeImport) return;
    if (activeImport.entityType === 'departments' && activeImport.deptRows) {
      const existingNames = new Set(localDepts.map(d => d.name.toLowerCase()));
      for (const r of activeImport.deptRows) {
        if (!existingNames.has(r.name.toLowerCase())) {
          await usersApi.createDepartment(r.name).catch(() => {});
        }
      }
      toast({ title: 'Departments imported', description: `${activeImport.deptRows.length} processed.` });
    } else if (activeImport.entityType === 'users' && activeImport.userRows) {
      const deptMap = new Map(localDepts.map(d => [d.name.toLowerCase(), d.id]));
      for (const r of activeImport.userRows) {
        const deptId = r.department ? deptMap.get(r.department.toLowerCase()) : undefined;
        await usersApi.create({
          name: r.name,
          email: r.email,
          password: 'ChangeMe123!',
          role: (r.role as UserRole) ?? 'respondent',
          ...(deptId && { departmentId: deptId }),
        }).catch(() => {});
      }
      toast({ title: 'Users imported', description: `${activeImport.userRows.length} processed.` });
    } else if (activeImport.entityType === 'groups' && activeImport.groupRows) {
      const emailToId = new Map(localUsers.map(u => [u.email.toLowerCase(), u.id]));
      for (const r of activeImport.groupRows) {
        const memberIds = r.members
          .map(e => emailToId.get(e.toLowerCase()))
          .filter((id): id is string => Boolean(id));
        await usersApi.createGroup({ name: r.name, memberIds }).catch(() => {});
      }
      toast({ title: 'Groups imported', description: `${activeImport.groupRows.length} group(s) processed.` });
    }
    await reload();
    setActiveImport(null);
  };

  const handleDownloadDeptTemplate = () => downloadBlob(generateDepartmentsTemplate(), 'departments_template.csv');
  const handleDownloadUserTemplate = () => downloadBlob(generateUsersTemplate(), 'users_template.csv');
  const handleDownloadGroupTemplate = () => downloadBlob(generateGroupsTemplate(), 'groups_template.csv');

  return (
    <TooltipProvider>
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users, departments, and groups.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="users" activeValue={tab} onSelect={v => setTab(v as Tab)}>Users ({localUsers.length})</TabsTrigger>
          <TabsTrigger value="departments" activeValue={tab} onSelect={v => setTab(v as Tab)}>Departments ({localDepts.length})</TabsTrigger>
          <TabsTrigger value="groups" activeValue={tab} onSelect={v => setTab(v as Tab)}>Groups ({localGroups.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" activeValue={tab} className="mt-4">
          <UsersTab
            users={localUsers}
            groups={localGroups}
            deptNames={deptNames}
            isAdmin={isAdmin}
            onAdd={addUser}
            onEdit={editUser}
            onToggleStatus={toggleStatus}
            onImportFile={handleUserImportFile}
            onDownloadTemplate={handleDownloadUserTemplate}
          />
        </TabsContent>

        <TabsContent value="departments" activeValue={tab} className="mt-4">
          <DepartmentsTab
            departments={localDepts}
            users={localUsers}
            isAdmin={isAdmin}
            onAdd={addDept}
            onRename={renameDept}
            onDelete={deleteDept}
            onImportFile={handleDeptImportFile}
            onDownloadTemplate={handleDownloadDeptTemplate}
          />
        </TabsContent>

        <TabsContent value="groups" activeValue={tab} className="mt-4">
          <GroupsTab
            groups={localGroups}
            allUsers={localUsers}
            isAdmin={isAdmin}
            onAdd={addGroup}
            onEdit={editGroup}
            onDelete={deleteGroup}
            onImportFile={handleGroupImportFile}
            onDownloadTemplate={handleDownloadGroupTemplate}
          />
        </TabsContent>
      </Tabs>

      {activeImport && (
        <ImportPreviewModal
          open={true}
          onClose={() => setActiveImport(null)}
          entityType={activeImport.entityType}
          errors={activeImport.errors}
          warnings={activeImport.warnings}
          preview={activeImport.preview}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
