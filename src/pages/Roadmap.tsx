import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoadmapTab } from '@/components/event/RoadmapTab';
import { events as seedEvents } from '@/services/mockData';
import { getEvents } from '@/services/store';

export function Roadmap() {
  const { id } = useParams<{ id: string }>();
  const allEvents = new Map([...seedEvents, ...getEvents()].map(e => [e.id, e]));
  const event = id ? allEvents.get(id) : undefined;

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
      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        {' / '}
        <Link to={`/events/${event.id}`} className="hover:text-primary transition-colors">{event.name}</Link>
        {' / '}
        <span>Task Roadmap</span>
      </p>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Task Roadmap — {event.name}</h1>
        <Button asChild variant="outline" size="sm">
          <Link to={`/events/${event.id}`}>
            <ArrowLeft size={14} className="mr-1.5" /> Back to Event
          </Link>
        </Button>
      </div>

      <RoadmapTab event={event} />
    </div>
  );
}
