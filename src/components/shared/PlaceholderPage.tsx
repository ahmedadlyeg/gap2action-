import { Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  badge?: string;
}

export function PlaceholderPage({ title, description, badge }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Construction size={28} className="text-primary" />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <p className="text-muted-foreground text-sm max-w-sm">
          {description ?? 'This screen is coming soon. Check back later.'}
        </p>
      </div>
    </div>
  );
}
