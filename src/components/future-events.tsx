import { CalendarClock, ExternalLink } from "lucide-react";

import { ROSARIO_TIME_ZONE } from "@/domain/identity";
import type { KnownFutureEvent } from "@/domain/models";

type FutureEventsProps = {
  events: KnownFutureEvent[];
};

function eventDate(value: string): string {
  const date = new Date(value);
  const currentYear = new Date().getFullYear();
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === currentYear ? undefined : "numeric",
    timeZone: ROSARIO_TIME_ZONE,
  }).format(date);
}

export function FutureEvents({ events }: FutureEventsProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="future-events" aria-labelledby="future-events-title">
      <div className="future-events__heading">
        <CalendarClock size={19} aria-hidden="true" />
        <div>
          <p className="eyebrow">Para ir agendando</p>
          <h2 id="future-events-title">Más adelante</h2>
        </div>
      </div>

      <div className="future-events__list">
        {events.map((event) => (
          <a
            key={event.eventId}
            className="future-event"
            href={event.sourcePermalink}
            target="_blank"
            rel="noreferrer"
          >
            <time dateTime={event.date}>{eventDate(event.date)}</time>
            <strong>{event.socialName}</strong>
            <span>
              @{event.instagramAccount}
              <ExternalLink size={14} aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
