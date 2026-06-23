import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Users, BarChart2,
  ChevronDown, ChevronRight, LogOut,
  Building2, Zap, FileText, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/AuthContext';
import { categories, templates } from '@/services/mockData';

const categoryIcons: Record<string, React.ElementType> = {
  'building-2': Building2,
  'zap': Zap,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
}

function NavItem({ to, icon: Icon, label, collapsed }: NavItemProps) {
  const item = (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative group',
          isActive
            ? 'bg-sidebar-accent/15 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-sidebar-accent before:rounded-r'
            : 'text-sidebar-muted hover:bg-white/8 hover:text-white'
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
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

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [expandedCats, setExpandedCats] = useState<string[]>(['cat1']);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleCat = (id: string) =>
    setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-sidebar transition-all duration-250 border-r border-sidebar-border',
          collapsed ? 'w-[64px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-sidebar-border shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
                  <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" opacity="0.5" />
                  <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.75" />
                  <rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" />
                  <path d="M5 12 L12 7 L19 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-none">Gap2Action</p>
                <p className="text-[10px] text-sidebar-muted leading-none mt-0.5">Assessment Platform</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-accent">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
                <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" opacity="0.5" />
                <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.75" />
                <rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" />
              </svg>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={onToggle} className="shrink-0 text-sidebar-muted hover:text-white hover:bg-white/8 h-7 w-7">
              <PanelLeftClose size={16} />
            </Button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <NavItem to="/" icon={LayoutDashboard} label="Home" collapsed={collapsed} />

          {/* Assessment Categories */}
          {!collapsed && (
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                Assessment Categories
              </p>
            </div>
          )}
          {collapsed && <div className="my-2 border-t border-sidebar-border mx-2" />}

          {categories.map(cat => {
            const catTemplates = templates.filter(t => t.categoryId === cat.id);
            const Icon = categoryIcons[cat.icon] ?? FolderOpen;
            const isExpanded = expandedCats.includes(cat.id);

            if (collapsed) {
              return (
                <Tooltip key={cat.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(`/categories/${cat.id}/templates`)}
                      className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sidebar-muted hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <Icon size={18} className="shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{cat.name}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Collapsible key={cat.id} open={isExpanded} onOpenChange={() => toggleCat(cat.id)}>
                <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-white/8 hover:text-white transition-colors group">
                  <Icon size={18} className="shrink-0" style={{ color: cat.color }} />
                  <span className="flex-1 truncate text-left">{cat.name}</span>
                  <span className="text-[10px] text-sidebar-muted mr-1">{catTemplates.length}</span>
                  {isExpanded
                    ? <ChevronDown size={14} className="shrink-0 opacity-60" />
                    : <ChevronRight size={14} className="shrink-0 opacity-60" />
                  }
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  <div className="pl-8 pr-2 pb-1 space-y-0.5">
                    {catTemplates.map(tpl => (
                      <NavLink
                        key={tpl.id}
                        to={`/templates/${tpl.id}/builder`}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                            isActive
                              ? 'text-white bg-white/10'
                              : 'text-sidebar-muted hover:text-white hover:bg-white/8'
                          )
                        }
                      >
                        <FileText size={13} className="shrink-0 opacity-70" />
                        <span className="truncate">{tpl.name}</span>
                      </NavLink>
                    ))}
                    <NavLink
                      to={`/categories/${cat.id}/templates`}
                      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-sidebar-muted hover:text-sidebar-accent hover:bg-white/8 transition-colors"
                    >
                      <span className="opacity-60">View all →</span>
                    </NavLink>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Bottom nav links */}
          {!collapsed && <div className="pt-3 pb-1 px-3"><div className="border-t border-sidebar-border" /></div>}
          {collapsed && <div className="my-2 border-t border-sidebar-border mx-2" />}

          <NavItem to="/categories" icon={FolderOpen} label="All Categories" collapsed={collapsed} />
          <NavItem to="/reports" icon={BarChart2} label="Reports" collapsed={collapsed} />

          {/* Admin-only */}
          {user?.role === 'admin' && (
            <NavItem to="/users" icon={Users} label="User Management" collapsed={collapsed} />
          )}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{user?.initials ?? '?'}</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-7 w-7 text-sidebar-muted hover:text-white hover:bg-white/8"
              >
                <PanelLeftOpen size={15} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback>{user?.initials ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-sidebar-muted capitalize">{user?.role}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="h-7 w-7 shrink-0 text-sidebar-muted hover:text-white hover:bg-white/8"
                  >
                    <LogOut size={15} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
