/**
 * Dirty-state navigation guard.
 *
 * Uses a module-level singleton for the guard so registration is synchronous
 * and immune to React effect scheduling delays.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, Trash2 } from 'lucide-react';

// ── Module-level singleton — no React lifecycle delays ────────────────────────

interface Guard {
  isDirty: () => boolean;
  save: () => void;
}

let _guard: Guard | null = null;

export function registerDirtyGuard(isDirtyFn: () => boolean, saveFn: () => void) {
  _guard = { isDirty: isDirtyFn, save: saveFn };
}

export function unregisterDirtyGuard() {
  _guard = null;
}

// ── Context — only owns the dialog UI state ───────────────────────────────────

interface DirtyStateContextValue {
  requestNavigation: (path: string) => void;
}

const DirtyStateContext = createContext<DirtyStateContextValue>({
  requestNavigation: () => {},
});

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const requestNavigation = useCallback((path: string) => {
    if (!_guard || !_guard.isDirty()) {
      navigate(path);
      return;
    }
    setPendingPath(path);
  }, [navigate]);

  const handleSaveAndLeave = useCallback(() => {
    _guard?.save();
    if (pendingPath) navigate(pendingPath);
    setPendingPath(null);
  }, [pendingPath, navigate]);

  const handleDiscard = useCallback(() => {
    if (pendingPath) navigate(pendingPath);
    setPendingPath(null);
  }, [pendingPath, navigate]);

  const handleCancel = useCallback(() => setPendingPath(null), []);

  return (
    <DirtyStateContext.Provider value={{ requestNavigation }}>
      {children}

      <Dialog open={pendingPath !== null} onOpenChange={open => { if (!open) handleCancel(); }}>
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Unsaved Changes</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              You have unsaved changes in this template. What would you like to do before leaving?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-foreground">
              Stay &amp; Keep Editing
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm" onClick={handleDiscard}
                className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
              >
                <Trash2 size={13} className="mr-1.5" /> Discard
              </Button>
              <Button size="sm" onClick={handleSaveAndLeave}>
                <Save size={13} className="mr-1.5" /> Save &amp; Leave
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DirtyStateContext.Provider>
  );
}

export function useDirtyState() {
  return useContext(DirtyStateContext);
}
