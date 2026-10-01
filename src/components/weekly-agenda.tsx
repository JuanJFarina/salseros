"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { EventsResponse } from "@/domain/models";
import {
  fetchEvents,
  updateAttendance,
} from "@/services/browser-api";

import { EventCard } from "./event-card";
import { FutureEvents } from "./future-events";

const VISITOR_KEY = "salseros:visitor-id:v1";
const RSVP_KEY = "salseros:rsvps:v1";

function visitorToken(): string {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, created);
  return created;
}

function savedSelections(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RSVP_KEY) ?? "[]");
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return new Set(parsed);
    }
  } catch {
    localStorage.removeItem(RSVP_KEY);
  }
  return new Set();
}

function withAttendeeCount(
  current: EventsResponse,
  eventId: string,
  attendants: number,
): EventsResponse {
  return {
    ...current,
    days: current.days.map((day) => ({
      ...day,
      events: day.events.map((event) =>
        event.eventId === eventId ? { ...event, attendants } : event,
      ),
    })),
  };
}

export function WeeklyAgenda() {
  const [agenda, setAgenda] = useState<EventsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : savedSelections(),
  );
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAgenda = useCallback(async () => {
    setError(null);
    try {
      setAgenda(await fetchEvents());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No pudimos cargar la agenda.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchEvents()
      .then((response) => {
        if (active) {
          setAgenda(response);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No pudimos cargar la agenda.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => void loadAgenda();
    window.addEventListener("salseros:agenda-updated", refresh);
    return () =>
      window.removeEventListener("salseros:agenda-updated", refresh);
  }, [loadAgenda]);

  async function toggle(eventId: string, currentCount: number) {
    if (pending.has(eventId)) {
      return;
    }

    const attending = !selected.has(eventId);
    const previousSelected = new Set(selected);
    const nextSelected = new Set(selected);
    if (attending) {
      nextSelected.add(eventId);
    } else {
      nextSelected.delete(eventId);
    }
    setSelected(nextSelected);
    localStorage.setItem(RSVP_KEY, JSON.stringify([...nextSelected]));
    setPending((current) => new Set(current).add(eventId));
    setNotice(null);
    setAgenda((current) =>
      current
        ? withAttendeeCount(
            current,
            eventId,
            Math.max(0, currentCount + (attending ? 1 : -1)),
          )
        : current,
    );

    try {
      const response = await updateAttendance(
        eventId,
        visitorToken(),
        attending,
      );
      setAgenda((current) =>
        current
          ? withAttendeeCount(current, eventId, response.attendants)
          : current,
      );
    } catch (toggleError) {
      setSelected(previousSelected);
      localStorage.setItem(RSVP_KEY, JSON.stringify([...previousSelected]));
      setAgenda((current) =>
        current
          ? withAttendeeCount(current, eventId, currentCount)
          : current,
      );
      setNotice(
        toggleError instanceof Error
          ? toggleError.message
          : "No pudimos guardar tu elección.",
      );
    } finally {
      setPending((current) => {
        const updated = new Set(current);
        updated.delete(eventId);
        return updated;
      });
    }
  }

  if (error) {
    return (
      <section className="agenda-state" aria-live="polite">
        <p>{error}</p>
        <button type="button" onClick={() => void loadAgenda()}>
          <RefreshCw size={17} aria-hidden="true" />
          Reintentar
        </button>
      </section>
    );
  }

  if (!agenda) {
    return (
      <section className="agenda-loading" aria-label="Cargando agenda">
        <span />
        <span />
        <span />
      </section>
    );
  }

  if (agenda.days.length === 0) {
    return (
      <>
        <section className="agenda-state" aria-live="polite">
          <CalendarDays size={30} aria-hidden="true" />
          <h2>La pista está tranquila</h2>
          <p>Todavía no encontramos sociales para los próximos siete días.</p>
        </section>
        <FutureEvents events={agenda.futureEvents} />
      </>
    );
  }

  return (
    <>
      <section className="agenda" aria-labelledby="agenda-title">
        <div className="section-heading">
          <p className="eyebrow">Próximos 7 días</p>
          <h2 id="agenda-title">¿Dónde bailamos?</h2>
        </div>

        {notice ? (
          <p className="inline-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="agenda__days">
          {agenda.days.map((day) => (
            <section className="day-row" key={day.date}>
              <header className="day-row__heading">
                <span>{day.weekday}</span>
                <strong>{day.fullDate}</strong>
              </header>
              <div className="day-row__events">
                {day.events.map((event) => (
                  <EventCard
                    key={event.eventId}
                    event={event}
                    selected={selected.has(event.eventId)}
                    pending={pending.has(event.eventId)}
                    onToggle={() =>
                      void toggle(event.eventId, event.attendants)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {agenda.updatedAt ? (
          <p className="agenda__updated">
            Agenda actualizada{" "}
            {new Intl.DateTimeFormat("es-AR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(agenda.updatedAt))}
          </p>
        ) : null}
      </section>
      <FutureEvents events={agenda.futureEvents} />
    </>
  );
}
