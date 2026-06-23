import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToast, type ToastVariant } from '@/context/ToastContext';
import { cn } from '@/lib/utils';

const ICON: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  default: Info,
};

const STYLE: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error:   'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  default: 'border-border bg-card text-foreground shadow-md',
};

const ICON_CLS: Record<ToastVariant, string> = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  default: 'text-primary',
};

export function ToastRenderer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(t => {
        const variant = t.variant ?? 'default';
        const Icon = ICON[variant];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3.5 min-w-[280px] max-w-sm',
              'transition-all duration-300 animate-in slide-in-from-bottom-2 fade-in',
              STYLE[variant],
            )}
          >
            <Icon size={16} className={cn('mt-0.5 shrink-0', ICON_CLS[variant])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">{t.title}</p>
              {t.description && (
                <p className="text-xs opacity-75 leading-relaxed mt-1">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
