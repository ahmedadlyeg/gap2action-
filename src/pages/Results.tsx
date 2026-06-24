import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultsTab } from '@/components/event/ResultsTab';
import { events as seedEvents, templates } from '@/services/mockData';
import { getEvents } from '@/services/store';

export function Results() {
  const { id } = useParams<{ id: string }>();
  const allEvents = new Map([...seedEvents, ...getEvents()].map(e => [e.id, e]));
  const event = id ? allEvents.get(id) : undefined;
  const template = event ? (templates.find(t => t.id === event.templateId) ?? null) : null;

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-lg font-semibold text-foreground">Event not found</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        {' / '}
        <Link to={`/events/${event.id}`} className="hover:text-primary transition-colors">{event.name}</Link>
        {' / '}
        <span>Results</span>
      </p>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Results — {event.name}</h1>
        <Button asChild variant="outline" size="sm">
          <Link to={`/events/${event.id}`}>
            <ArrowLeft size={14} className="mr-1.5" /> Back to Event
          </Link>
        </Button>
      </div>

      <ResultsTab event={event} template={template} />
    </div>
  );
}
