import { useState, useMemo, useRef } from 'react';
import {
  Search, Plus, Pencil, UserX, UserCheck,
  Trash2, Users, Building2, GripVertical,
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
import {
  users as seedUsers,
  departments as seedDepts,
  userGroups as seedGroups,
} from '@/services/mockData';
import type { User, UserRole, UserStatus, Department, UserGroup } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function uid() {
  return `u${Date.now()}`;
}

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
  name: '',
  email: '',
  role: 'respondent',
  department: '',
  groupIds: [],
  status: 'Active',
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
      ? {
          name: editing.name,
          email: editing.email,
          role: editing.role,
          department: editing.department ?? '',
          groupIds: editing.groupIds ?? [],
          status: editing.status,
        }
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  // Reset when editing target changes
  const prevEditing = useRef(editing?.id);
  if (prevEditing.current !== editing?.id) {
    prevEditing.current = editing?.id;
    const next = editing
      ? { name: editing.name, email: editing.email, role: editing.role, department: editing.department ?? '', groupIds: editing.groupIds ?? [], status: editing.status }
      : EMPTY_FORM;
    // Use function-form to avoid stale closure
    setTimeout(() => setForm(next), 0);
  }

  const set = <K extends keyof UserFormData>(k: K, v: UserFormData[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const toggleGroup = (id: string) => {
    set('groupIds', form.groupIds.includes(id)
      ? form.groupIds.filter(g => g !== id)
      : [...form.groupIds, id]);
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address.';
    } else {
      const dup = existingEmails
        .filter(e => !editing || e !== editing.email)
        .includes(form.email.toLowerCase());
      if (dup) errs.email = 'This email is already in use.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ ...form, email: form.email.toLowerCase() });
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">
            {editing ? 'Edit User' : 'Create User'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            {editing ? 'Update user details and permissions.' : 'Add a new user to the platform.'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Full Name <span className="text-destructive">*</span></Label>
            <Input
              id="u-name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Jane Smith"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email Address <span className="text-destructive">*</span></Label>
            <Input
              id="u-email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="jane@example.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="u-role">Role</Label>
            <Select
              id="u-role"
              value={form.role}
              onChange={e => set('role', e.target.value as UserRole)}
            >
              <option value="admin">Admin</option>
              <option value="assessor">Assessor</option>
              <option value="respondent">Respondent</option>
            </Select>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label htmlFor="u-dept">Department</Label>
            <Select
              id="u-dept"
              value={form.department}
              onChange={e => set('department', e.target.value)}
            >
              <option value="">— None —</option>
              {deptNames.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="u-status">Status</Label>
            <Select
              id="u-status"
              value={form.status}
              onChange={e => set('status', e.target.value as UserStatus)}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>

          {/* User Groups (multi-select via checkboxes) */}
          <div className="space-y-2">
            <Label>User Groups</Label>
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No groups defined yet.</p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.groupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm">{g.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {g.memberIds.length} member{g.memberIds.length !== 1 ? 's' : ''}
                    </span>
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
          <Button size="sm" onClick={handleSave}>
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
  onAdd: (data: UserFormData) => void;
  onEdit: (user: User, data: UserFormData) => void;
  onToggleStatus: (user: User) => void;
}

function UsersTab({ users, groups, deptNames, onAdd, onEdit, onToggleStatus }: UsersTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (filterRole && u.role !== filterRole) return false;
      if (filterDept && u.department !== filterDept) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      return true;
    });
  }, [users, search, filterRole, filterDept, filterStatus]);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);

  const existingEmails = users.map(u => u.email.toLowerCase());

  const handleSave = (data: UserFormData) => {
    if (editing) onEdit(editing, data);
    else onAdd(data);
    setSheetOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
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
        <Button size="sm" onClick={openCreate} className="shrink-0 ml-auto">
          <Plus size={14} className="mr-1.5" /> Create User
        </Button>
      </div>

      {/* Table */}
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
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No users match the current filters.
                  </td>
                </tr>
              ) : filtered.map(u => {
                const inactive = u.status === 'Inactive';
                return (
                  <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${inactive ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={inactive ? 'bg-slate-200 text-slate-400' : ''}>
                            {u.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`font-medium ${inactive ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {u.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                      {u.department ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={inactive ? 'outline' : 'success'}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                              <Pencil size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit user</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${inactive ? 'text-emerald-600 hover:text-emerald-700' : 'text-destructive hover:text-destructive'}`}
                              onClick={() => onToggleStatus(u)}
                            >
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

      <UserSheet
        open={sheetOpen}
        onClose={closeSheet}
        editing={editing}
        existingEmails={existingEmails}
        groups={groups}
        deptNames={deptNames}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Departments Tab ──────────────────────────────────────────────────────────

interface DepartmentsTabProps {
  departments: Department[];
  users: User[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function DepartmentsTab({ departments, users, onAdd, onRename, onDelete }: DepartmentsTabProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const userCountByDept = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach(u => {
      if (u.department) map[u.department] = (map[u.department] ?? 0) + 1;
    });
    return map;
  }, [users]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewName('');
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditValue(dept.name);
  };

  const commitEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Add department */}
      <div className="flex gap-2">
        <Input
          placeholder="New department name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus size={14} className="mr-1.5" /> Add
        </Button>
      </div>

      <Card className="overflow-hidden">
        {departments.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No departments defined yet.
          </CardContent>
        ) : (
          <div className="divide-y">
            {departments.map(dept => {
              const count = userCountByDept[dept.name] ?? 0;
              const hasUsers = count > 0;
              const isEditing = editingId === dept.id;

              return (
                <div key={dept.id} className="flex items-center gap-4 px-5 py-3.5 group hover:bg-muted/30 transition-colors">
                  <Building2 size={16} className="text-muted-foreground shrink-0" />

                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(dept.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit(dept.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 h-7 text-sm"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => startEdit(dept)}
                      title="Click to rename"
                    >
                      {dept.name}
                    </span>
                  )}

                  <span className="text-xs text-muted-foreground shrink-0">
                    {count} user{count !== 1 ? 's' : ''}
                  </span>

                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(dept)}
                          >
                            <Pencil size={13} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              disabled={hasUsers}
                              onClick={() => !hasUsers && onDelete(dept.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasUsers
                            ? `Cannot delete — ${count} user${count !== 1 ? 's' : ''} in this department`
                            : 'Delete department'}
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

  // Re-init when editing target changes
  const prevId = useRef(editing?.id);
  if (prevId.current !== editing?.id) {
    prevId.current = editing?.id;
    setTimeout(() => {
      setName(editing?.name ?? '');
      setMemberIds(editing?.memberIds ?? []);
      setSearch('');
      setNameErr('');
    }, 0);
  }

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const filteredUsers = allUsers.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!name.trim()) { setNameErr('Group name is required.'); return; }
    onSave(name.trim(), memberIds);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">
            {editing ? 'Edit Group' : 'Create Group'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            {editing ? 'Update the group name and membership.' : 'Create a new user group.'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Group Name */}
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Group Name <span className="text-destructive">*</span></Label>
            <Input
              id="g-name"
              value={name}
              onChange={e => { setName(e.target.value); setNameErr(''); }}
              placeholder="e.g. EA Core Team"
            />
            {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
          </div>

          {/* Members */}
          <div className="space-y-2">
            <Label>Members</Label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No users found.</p>
              ) : filteredUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px]">{u.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant={ROLE_VARIANT[u.role]} className="shrink-0 text-[10px]">
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{memberIds.length} member{memberIds.length !== 1 ? 's' : ''} selected</p>
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </SheetClose>
          <Button size="sm" onClick={handleSave}>
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
  onAdd: (name: string, memberIds: string[]) => void;
  onEdit: (group: UserGroup, name: string, memberIds: string[]) => void;
  onDelete: (id: string) => void;
}

function GroupsTab({ groups, allUsers, onAdd, onEdit, onDelete }: GroupsTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openCreate = () => { setEditingGroup(null); setSheetOpen(true); };
  const openEdit = (g: UserGroup) => { setEditingGroup(g); setSheetOpen(true); };

  const handleSave = (name: string, memberIds: string[]) => {
    if (editingGroup) onEdit(editingGroup, name, memberIds);
    else onAdd(name, memberIds);
    setSheetOpen(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1.5" /> Create Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No user groups yet. Create one to get started.
          </CardContent>
        </Card>
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
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {members.length} member{members.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(group)}>
                        <Pencil size={14} />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(group.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete group</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Member avatars */}
                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px]">{m.initials}</AvatarFallback>
                          </Avatar>
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

      {/* Inline delete confirm */}
      {confirmDelete && (() => {
        const group = groups.find(g => g.id === confirmDelete);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Delete "{group?.name}"?</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently remove the group. Users will not be deleted.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      <GroupSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editing={editingGroup}
        allUsers={allUsers}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'users' | 'departments' | 'groups';

export function UserManagement() {
  const [tab, setTab] = useState<Tab>('users');

  // In-memory state — resets on page refresh
  const [localUsers, setLocalUsers] = useState<User[]>(() =>
    seedUsers.map(u => ({ ...u, status: u.status ?? 'Active' }))
  );
  const [localDepts, setLocalDepts] = useState<Department[]>(seedDepts);
  const [localGroups, setLocalGroups] = useState<UserGroup[]>(seedGroups);

  const deptNames = localDepts.map(d => d.name);

  // ─── User mutations ───
  const addUser = (data: UserFormData) => {
    const user: User = {
      id: uid(),
      name: data.name.trim(),
      email: data.email,
      role: data.role,
      status: data.status,
      department: data.department || undefined,
      groupIds: data.groupIds,
      initials: getInitials(data.name),
    };
    setLocalUsers(prev => [...prev, user]);
    // Update group memberships
    setLocalGroups(prev => prev.map(g => ({
      ...g,
      memberIds: data.groupIds.includes(g.id)
        ? [...new Set([...g.memberIds, user.id])]
        : g.memberIds.filter(m => m !== user.id),
    })));
  };

  const editUser = (original: User, data: UserFormData) => {
    setLocalUsers(prev => prev.map(u => u.id !== original.id ? u : {
      ...u,
      name: data.name.trim(),
      email: data.email,
      role: data.role,
      status: data.status,
      department: data.department || undefined,
      groupIds: data.groupIds,
      initials: getInitials(data.name),
    }));
    setLocalGroups(prev => prev.map(g => ({
      ...g,
      memberIds: data.groupIds.includes(g.id)
        ? [...new Set([...g.memberIds, original.id])]
        : g.memberIds.filter(m => m !== original.id),
    })));
  };

  const toggleStatus = (user: User) => {
    setLocalUsers(prev => prev.map(u =>
      u.id === user.id
        ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' }
        : u
    ));
  };

  // ─── Department mutations ───
  const addDept = (name: string) => {
    setLocalDepts(prev => [...prev, { id: `d${Date.now()}`, name }]);
  };
  const renameDept = (id: string, name: string) => {
    const old = localDepts.find(d => d.id === id)?.name;
    setLocalDepts(prev => prev.map(d => d.id === id ? { ...d, name } : d));
    // Update users that referenced the old name
    if (old) {
      setLocalUsers(prev => prev.map(u => u.department === old ? { ...u, department: name } : u));
    }
  };
  const deleteDept = (id: string) => {
    setLocalDepts(prev => prev.filter(d => d.id !== id));
  };

  // ─── Group mutations ───
  const addGroup = (name: string, memberIds: string[]) => {
    const id = `g${Date.now()}`;
    setLocalGroups(prev => [...prev, { id, name, memberIds }]);
    setLocalUsers(prev => prev.map(u =>
      memberIds.includes(u.id) ? { ...u, groupIds: [...new Set([...(u.groupIds ?? []), id])] } : u
    ));
  };
  const editGroup = (original: UserGroup, name: string, memberIds: string[]) => {
    setLocalGroups(prev => prev.map(g => g.id === original.id ? { ...g, name, memberIds } : g));
    setLocalUsers(prev => prev.map(u => {
      const inGroup = memberIds.includes(u.id);
      const hadGroup = (u.groupIds ?? []).includes(original.id);
      if (inGroup && !hadGroup) return { ...u, groupIds: [...(u.groupIds ?? []), original.id] };
      if (!inGroup && hadGroup) return { ...u, groupIds: (u.groupIds ?? []).filter(g => g !== original.id) };
      return u;
    }));
  };
  const deleteGroup = (id: string) => {
    setLocalGroups(prev => prev.filter(g => g.id !== id));
    setLocalUsers(prev => prev.map(u => ({
      ...u,
      groupIds: (u.groupIds ?? []).filter(g => g !== id),
    })));
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage users, departments, and groups across the platform.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-1.5">
            <GripVertical size={13} />
            {localUsers.filter(u => u.status === 'Active').length} active · {localUsers.filter(u => u.status === 'Inactive').length} inactive
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="users" activeValue={tab} onSelect={v => setTab(v as Tab)}>
              Users ({localUsers.length})
            </TabsTrigger>
            <TabsTrigger value="departments" activeValue={tab} onSelect={v => setTab(v as Tab)}>
              Departments ({localDepts.length})
            </TabsTrigger>
            <TabsTrigger value="groups" activeValue={tab} onSelect={v => setTab(v as Tab)}>
              User Groups ({localGroups.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" activeValue={tab}>
            <UsersTab
              users={localUsers}
              groups={localGroups}
              deptNames={deptNames}
              onAdd={addUser}
              onEdit={editUser}
              onToggleStatus={toggleStatus}
            />
          </TabsContent>

          <TabsContent value="departments" activeValue={tab}>
            <DepartmentsTab
              departments={localDepts}
              users={localUsers}
              onAdd={addDept}
              onRename={renameDept}
              onDelete={deleteDept}
            />
          </TabsContent>

          <TabsContent value="groups" activeValue={tab}>
            <GroupsTab
              groups={localGroups}
              allUsers={localUsers}
              onAdd={addGroup}
              onEdit={editGroup}
              onDelete={deleteGroup}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
