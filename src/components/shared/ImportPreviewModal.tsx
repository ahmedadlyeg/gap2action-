import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';

export interface ImportPreview {
  total: number;
  newCount: number;
  conflictCount: number;
  rows: Array<{ label: string; isNew: boolean }>;
}

interface ImportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: 'skip' | 'update') => void;
  entityType: 'departments' | 'users' | 'groups';
  errors: string[];
  warnings: string[];
  preview: ImportPreview;
}

const ENTITY_LABELS: Record<string, string> = {
  departments: 'Departments',
  users: 'Users',
  groups: 'User Groups',
};

export function ImportPreviewModal({
  open, onClose, onConfirm,
  entityType, errors, warnings, preview,
}: ImportPreviewModalProps) {
  const [mode, setMode] = useState<'skip' | 'update'>('skip');
  const hasErrors = errors.length > 0;
  const importCount = mode === 'update'
    ? preview.newCount + preview.conflictCount
    : preview.newCount;

  const handleClose = () => { setMode('skip'); onClose(); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Upload size={16} className="text-primary" />
            Import {ENTITY_LABELS[entityType]} — Preview
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review the CSV content before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-0.5">

          {/* Errors — block import */}
          {hasErrors && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                <AlertCircle size={13} /> {errors.length} error{errors.length !== 1 ? 's' : ''} — fix these before importing
              </div>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 font-mono pl-5">{e}</p>
              ))}
            </div>
          )}

          {!hasErrors && (
            <>
              {/* Ready header */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-800">
                  Ready to import {preview.total} record{preview.total !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                    <AlertTriangle size={13} /> {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                  </div>
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 font-mono pl-5">{w}</p>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/20 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{preview.newCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">New records</p>
                </div>
                <div className="rounded-lg border bg-muted/20 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{preview.conflictCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Conflicts (already exist)</p>
                </div>
              </div>

              {/* Conflict mode */}
              {preview.conflictCount > 0 && (
                <div className="rounded-lg border px-4 py-3 space-y-2.5">
                  <p className="text-xs font-semibold text-foreground">How to handle conflicts?</p>
                  {(['skip', 'update'] as const).map(m => (
                    <label key={m} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="conflict-mode"
                        checked={mode === m}
                        onChange={() => setMode(m)}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="text-sm text-foreground">
                        {m === 'skip'
                          ? <><span className="font-medium">Skip existing records</span> <span className="text-muted-foreground">— leave them unchanged</span></>
                          : <><span className="font-medium">Update existing records</span> <span className="text-muted-foreground">— overwrite with CSV values</span></>
                        }
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Row list */}
              <div className="rounded-lg border overflow-hidden">
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b">
                  Records ({preview.rows.length})
                </p>
                <div className="max-h-[180px] overflow-y-auto divide-y">
                  {preview.rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${row.isNew ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <span className="text-xs text-foreground truncate">{row.label}</span>
                      <span className={`ml-auto text-[10px] font-medium shrink-0 ${row.isNew ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {row.isNew ? 'new' : 'conflict'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              {hasErrors ? 'Close' : 'Cancel'}
            </Button>
          </DialogClose>
          {!hasErrors && (
            <Button
              size="sm"
              onClick={() => { onConfirm(mode); setMode('skip'); }}
              disabled={importCount === 0}
            >
              <Upload size={13} className="mr-1.5" />
              Import {importCount} Record{importCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
