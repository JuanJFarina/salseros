"use client";

import { Clock3, ExternalLink, MapPin, UsersRound } from "lucide-react";

import { ROSARIO_TIME_ZONE } from "@/domain/identity";
import type { EventRecord } from "@/domain/models";

type EventCardProps = {
  event: EventRecord;
  selected: boolean;
  pending: boolean;
  onToggle: () => void;
};

function eventTime(event: EventRecord): string {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ROSARIO_TIME_ZONE,
  });
  const start = formatter.format(new Date(event.nextSocialDate));
  const prefix = event.timeApproximate ? "~" : "";
  if (!event.endsAt) {
    return `${prefix}${start} hs`;
  }
  return `${prefix}${start}–${formatter.format(new Date(event.endsAt))} hs`;
}

export function EventCard({
  event,
  selected,
  pending,
  onToggle,
}: EventCardProps) {
  const recurring = event.sourceMediaIds.some((mediaId) =>
    mediaId.startsWith("recurring:"),
  );

  return (
    <article className="event-card">
      <div className="event-card__source">
        <span>@{event.instagramAccount}</span>
        <a
          href={event.sourcePermalinks[0]}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ver publicación de ${event.socialName} en Instagram`}
        >
          <ExternalLink size={16} strokeWidth={2.2} />
        </a>
      </div>

      <h3>{event.socialName}</h3>

      <div className="event-card__details">
        <p>
          <Clock3 size={17} aria-hidden="true" />
          <span>{eventTime(event)}</span>
          {recurring ? (
            <small className="recurring-label">(recurrente)</small>
          ) : null}
        </p>
        <p>
          <MapPin size={17} aria-hidden="true" />
          <span>{event.address}</span>
        </p>
      </div>

      <div className="event-card__action">
        <button
          type="button"
          className="rsvp-button"
          data-selected={selected}
          aria-pressed={selected}
          disabled={pending}
          onClick={onToggle}
        >
          <span>
            {pending
              ? "Guardando…"
              : selected
                ? "¡Nos vemos ahí!"
                : "¡Pa'llá voy!"}
          </span>
        </button>
        <span className="attendee-count" aria-live="polite">
          <UsersRound size={16} aria-hidden="true" />
          {event.attendants} {event.attendants === 1 ? "va" : "van"}
        </span>
      </div>
    </article>
  );
}
