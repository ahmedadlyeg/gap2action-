import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDirtyState } from '@/context/DirtyStateContext';
import {
  LayoutDashboard, FolderOpen, Users, BarChart2,
  ChevronDown, ChevronRight, LogOut,
  Building2, Zap, LayoutTemplate, PanelLeftClose, PanelLeftOpen,
  TrendingUp, LayoutGrid, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/AuthContext';
import { getTemplates, getCategories } from '@/services/store';

const categoryIcons: Record<string, React.ElementType> = {
  'building-2': Building2,
  'zap': Zap,
};

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  end?: boolean;
  badge?: string | number;
}

function NavItem({ to, icon: Icon, label, collapsed, end, badge }: NavItemProps) {
  const { requestNavigation } = useDirtyState();
  const location = useLocation();
  const isExact = end ?? to === '/';
  const isActive = isExact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(to + '/');

  const item = (
    <NavLink
      to={to}
      end={isExact}
      onClick={e => { e.preventDefault(); requestNavigation(to); }}
      className={cn(
        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 group',
        isActive
          ? 'bg-[#0c93ac] text-white font-semibold shadow-[0_2px_8px_rgba(19,180,207,.30)]'
          : 'text-slate-500 font-medium hover:bg-black/5 hover:text-slate-800'
      )}
    >
      <Icon
        size={16}
        className={cn(
          'shrink-0 transition-colors',
          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1">{label}</span>
          {badge !== undefined && (
            <span className={cn(
              'ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
              isActive ? 'bg-white/25 text-white' : 'bg-black/8 text-slate-500'
            )}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return item;
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-3 mx-3 h-px bg-black/8" />;
  return (
    <div className="pt-5 pb-2 px-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  );
}

// Inline logo mark — three coloured tiles echoing the brand logo
function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: size }}>
      {/* G tile — orange */}
      <div
        className="flex items-center justify-center rounded-[6px] text-white font-black"
        style={{
          width: size, height: size, fontSize: size * 0.52,
          background: 'linear-gradient(145deg,#F5B942,#D97810)',
          boxShadow: '0 3px 10px rgba(232,148,26,.55),inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      >G</div>
      {/* 2 tile — cyan */}
      <div
        className="flex items-center justify-center rounded-[6px] text-white font-black"
        style={{
          width: size, height: size, fontSize: size * 0.52,
          background: 'linear-gradient(145deg,#2fc8e0,#0c7689)',
          boxShadow: '0 3px 10px rgba(19,180,207,.55),inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      >2</div>
      {/* Chart bars — green */}
      <div
        className="flex items-center justify-center rounded-[6px]"
        style={{
          width: size, height: size,
          background: 'linear-gradient(145deg,#5DD49F,#35A478)',
          boxShadow: '0 3px 10px rgba(77,184,138,.55),inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" style={{ width: size * 0.58, height: size * 0.58 }}>
          <rect x="1.5" y="9" width="3" height="5.5" rx="0.8" fill="white" opacity=".65" />
          <rect x="6.5" y="5.5" width="3" height="9" rx="0.8" fill="white" opacity=".82" />
          <rect x="11.5" y="2" width="3" height="12.5" rx="0.8" fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { requestNavigation } = useDirtyState();
  const [expandedCats, setExpandedCats] = useState<string[]>(['cat1']);
  const [templates, setTemplates] = useState(() => getTemplates());
  const [categories, setCategories] = useState(() => getCategories());

  // Re-read templates + categories whenever anything writes to the store
  useEffect(() => {
    const handler = () => {
      setTemplates(getTemplates());
      setCategories(getCategories());
    };
    window.addEventListener('g2a-store-updated', handler);
    return () => window.removeEventListener('g2a-store-updated', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };
  const toggleCat = (id: string) =>
    setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const role = user?.role;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col sidebar-float bg-sidebar transition-all duration-250 overflow-hidden shrink-0',
          collapsed ? 'w-[68px] rounded-2xl' : 'w-[260px] rounded-2xl'
        )}
        
      >
        {/* ── Logo ── */}
        <div className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <LogoMark size={28} />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-800 leading-none tracking-wide">نُضٌج Nudj</p>
                  <p className="text-[9px] text-slate-400 leading-none mt-1 tracking-[0.1em] uppercase">
                    Assess, Comply, Excel
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onToggle}
                className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-700 hover:bg-black/5">
                <PanelLeftClose size={15} />
              </Button>
            </>
          ) : (
            <LogoMark size={30} />
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

          {/* Respondent */}
          {role === 'respondent' && (
            <>
              <NavItem to="/" icon={LayoutDashboard} label="Home" collapsed={collapsed} />
              <NavItem to="/maturity" icon={TrendingUp} label="Maturity Levels" collapsed={collapsed} />
            </>
          )}

          {/* Assessor */}
          {role === 'assessor' && (
            <>
              <NavItem to="/" icon={LayoutDashboard} label="Home" collapsed={collapsed} />
              <NavItem to="/maturity" icon={TrendingUp} label="Maturity Levels" collapsed={collapsed} />
              <NavItem to="/tasks" icon={ListChecks} label="All Tasks" collapsed={collapsed} />
              <SectionLabel label="Tools" collapsed={collapsed} />
              <NavItem to="/categories" icon={FolderOpen} label="All Categories" collapsed={collapsed} />
            </>
          )}

          {/* Admin */}
          {role === 'admin' && (
            <>
              <NavItem to="/" icon={LayoutDashboard} label="Home" collapsed={collapsed} />
              <NavItem to="/maturity" icon={TrendingUp} label="Maturity Levels" collapsed={collapsed} />
              <NavItem to="/reports" icon={BarChart2} label="Reports" collapsed={collapsed} />
              <NavItem to="/tasks" icon={ListChecks} label="All Tasks" collapsed={collapsed} />

              <SectionLabel label="Assessment Categories" collapsed={collapsed} />

              {categories.map(cat => {
                // Build sidebar entries: one per family showing Active + any Draft versions (no Archived)
                const allCatTemplates = templates.filter(t => t.categoryId === cat.id);
                const catTemplateIds = new Set(allCatTemplates.map(t => t.id));
                const roots = allCatTemplates.filter(
                  t => !t.parentVersionId || !catTemplateIds.has(t.parentVersionId)
                );
                const parseVer = (v: string) => { const [maj=0, min=0] = v.split('.').map(Number); return maj * 1000 + min; };

                // For each family: pick ONE representative — Active if available, else highest Draft
                interface SidebarEntry { tpl: typeof allCatTemplates[number] }
                const catTemplates: SidebarEntry[] = roots.flatMap(root => {
                  const family: typeof allCatTemplates = [];
                  const queue = [root.id];
                  const visited = new Set<string>();
                  while (queue.length > 0) {
                    const pid = queue.shift()!;
                    if (visited.has(pid)) continue;
                    visited.add(pid);
                    const t = allCatTemplates.find(x => x.id === pid);
                    if (t) {
                      family.push(t);
                      allCatTemplates.filter(x => x.parentVersionId === pid).forEach(c => queue.push(c.id));
                    }
                  }
                  const primary =
                    family.find(t => t.status === 'Active') ??
                    family.filter(t => t.status !== 'Archived').sort((a, b) => parseVer(b.version) - parseVer(a.version))[0];
                  return primary ? [{ tpl: primary }] : [];
                });
                const Icon = categoryIcons[cat.icon] ?? FolderOpen;
                const isExpanded = expandedCats.includes(cat.id);

                if (collapsed) {
                  return (
                    <Tooltip key={cat.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => requestNavigation(`/categories/${cat.id}/templates`)}
                          className="flex w-full items-center justify-center rounded-xl p-2 text-sidebar-muted hover:bg-white/8 hover:text-white transition-colors"
                        >
                          <div className="icon-3d h-8 w-8" style={{
                            background: `linear-gradient(145deg,${cat.color}dd,${cat.color})`,
                            boxShadow: `0 4px 12px ${cat.color}55,inset 0 1px 0 rgba(255,255,255,.2)`,
                          }}>
                            <Icon size={15} className="text-white" />
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{cat.name}</TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Collapsible key={cat.id} open={isExpanded} onOpenChange={() => toggleCat(cat.id)}>
                    <div className="flex items-center rounded-xl hover:bg-black/5 transition-colors group">
                      <button
                        onClick={() => requestNavigation(`/categories/${cat.id}/templates`)}
                        className="flex flex-1 items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 min-w-0"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${cat.color}14`, color: cat.color }}>
                          <Icon size={14} />
                        </span>
                        <span className="flex-1 truncate text-left">{cat.name}</span>
                        <span className="text-[10px] text-slate-300 mr-1 font-normal">{catTemplates.length}</span>
                      </button>
                      <CollapsibleTrigger asChild>
                        <button className="px-2 py-2 text-slate-300 hover:text-slate-600 shrink-0">
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                      <div className="pl-[52px] pr-2 pb-1 space-y-0.5">
                        {catTemplates.map(({ tpl }) => (
                          <NavLink
                            key={tpl.id}
                            to={`/templates/${tpl.id}/builder`}
                            onClick={e => { e.preventDefault(); requestNavigation(`/templates/${tpl.id}/builder`); }}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                                isActive
                                  ? 'text-white bg-white/10'
                                  : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                              )
                            }
                          >
                            <LayoutTemplate size={11} className="shrink-0 text-sidebar-accent opacity-75" />
                            <span className="truncate flex-1">{tpl.name}</span>
                            <span className="shrink-0 text-[8px] font-bold text-sidebar-accent/70 bg-sidebar-accent/10 rounded px-1 py-0.5">v{tpl.version}</span>
                          </NavLink>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              <SectionLabel label="Administration" collapsed={collapsed} />
              <NavItem to="/frameworks" icon={LayoutGrid} label="Assessment Frameworks" collapsed={collapsed} />
              <NavItem to="/categories" icon={FolderOpen} label="Manage Categories" collapsed={collapsed} />
              <NavItem to="/users" icon={Users} label="User Management" collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* ── User footer ── */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-8 w-8 ring-2 ring-[#13b4cf]/30">
                <AvatarFallback className="text-[11px] font-bold bg-gradient-to-br from-[#13b4cf] to-[#0c7689] text-white">
                  {user?.initials ?? '?'}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={onToggle}
                className="h-7 w-7 text-sidebar-muted hover:text-white hover:bg-white/8">
                <PanelLeftOpen size={14} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-black/5 border border-sidebar-border px-3 py-2.5">
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-accent/30">
                <AvatarFallback className="text-[11px] font-bold bg-gradient-to-br from-[#13b4cf] to-[#0c7689] text-white">
                  {user?.initials ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize mt-0.5">{user?.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-700 hover:bg-black/5"
              >
                <LogOut size={14} />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
