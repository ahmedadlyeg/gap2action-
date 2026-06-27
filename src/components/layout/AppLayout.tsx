import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768) setCollapsed(true);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="app-canvas h-screen overflow-hidden p-3 flex gap-3">
      {/* Floating sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      {/* Main content area — white card */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
