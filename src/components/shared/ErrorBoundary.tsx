import { Component, type ReactNode } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; label?: string; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-200 mb-5">
            <AlertTriangle size={26} className="text-red-500" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
            {this.props.label
              ? `An unexpected error occurred in "${this.props.label}".`
              : 'An unexpected error occurred in this section.'}{' '}
            Your data is safe — you can try again without losing progress.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            <RotateCcw size={13} className="mr-1.5" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
