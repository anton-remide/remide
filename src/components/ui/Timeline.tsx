import type { ReactNode } from 'react';

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  badge?: ReactNode;
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export default function Timeline({ events, className }: TimelineProps) {
  return (
    <div className={['st-timeline', className].filter(Boolean).join(' ')}>
      {events.map((event, i) => (
        <div key={i} className="st-timeline__item">
          <div className="st-timeline__marker" />
          <div className="st-timeline__content">
            <div className="st-timeline__header">
              <time className="st-timeline__date">{event.date}</time>
              {event.badge}
            </div>
            <h4 className="st-timeline__title">{event.title}</h4>
            {event.description && <p className="st-timeline__desc">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
