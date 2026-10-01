"use client";

import { AtSign, CalendarDays, Clock3, MapPin, Send } from "lucide-react";
import { type FormEvent, useState } from "react";

import { ROSARIO_TIME_ZONE } from "@/domain/identity";
import { requestEvent } from "@/services/browser-api";

function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROSARIO_TIME_ZONE,
  }).format(new Date());
}

export function EventRequestForm() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFailed(false);

    try {
      const response = await requestEvent({
        date,
        time,
        place,
        username,
      });
      const messages = {
        approved: `¡Listo! ${response.socialName} ya está en la agenda.`,
        pending:
          "Recibimos el social. La cuenta necesita una revisión antes de publicarlo.",
        rejected:
          "No pudimos confirmar que la cuenta publique sociales de salsa o bachata.",
        duplicate: "Ese social ya estaba publicado en la agenda.",
      };
      setMessage(messages[response.outcome]);
      if (response.outcome === "approved") {
        window.dispatchEvent(new Event("salseros:agenda-updated"));
      }
      if (
        response.outcome === "approved" ||
        response.outcome === "pending" ||
        response.outcome === "duplicate"
      ) {
        setDate("");
        setTime("");
        setPlace("");
        setUsername("");
      }
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos guardar el social.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="source-request event-request"
      aria-labelledby="event-request-title"
    >
      <div>
        <p className="eyebrow">La agenda crece con vos</p>
        <h2 id="event-request-title">¿Falta un social?</h2>
        <p>
          Pasanos los datos básicos. Verificamos la cuenta y evitamos eventos
          duplicados antes de publicarlo.
        </p>
      </div>

      <form onSubmit={(event) => void submit(event)}>
        <div className="event-request__grid">
          <label className="event-request__field">
            <span>
              <CalendarDays size={17} aria-hidden="true" />
              Fecha
            </span>
            <input
              type="date"
              value={date}
              min={localToday()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label className="event-request__field">
            <span>
              <Clock3 size={17} aria-hidden="true" />
              Hora
            </span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </label>
          <label className="event-request__field event-request__field--wide">
            <span>
              <MapPin size={17} aria-hidden="true" />
              Lugar
            </span>
            <input
              type="text"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="Dirección 1234"
              maxLength={160}
              required
            />
          </label>
          <label className="event-request__field event-request__field--wide">
            <span>
              <AtSign size={17} aria-hidden="true" />
              Instagram
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="cuenta.salsera"
              autoComplete="off"
              spellCheck={false}
              maxLength={31}
              required
            />
          </label>
        </div>
        <button
          className="event-request__submit"
          type="submit"
          disabled={
            pending ||
            !date ||
            !time ||
            !place.trim() ||
            !username.trim()
          }
        >
          <span>{pending ? "Verificando…" : "Agregar social"}</span>
          <Send size={17} aria-hidden="true" />
        </button>
        {message ? (
          <p className="source-request__message" data-error={failed} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
