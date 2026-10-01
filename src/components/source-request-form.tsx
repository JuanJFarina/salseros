"use client";

import { AtSign, Send } from "lucide-react";
import { type FormEvent, useState } from "react";

import { requestSource } from "@/services/browser-api";

export function SourceRequestForm() {
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
      const response = await requestSource(username);
      const messages = {
        created: "¡Gracias! La cuenta quedó pendiente de revisión.",
        duplicate: "Esa cuenta ya estaba esperando revisión.",
        already_active: "¡Esa cuenta ya forma parte de SalseRos!",
      };
      setMessage(messages[response.outcome]);
      setUsername("");
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos guardar la sugerencia.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="source-request" aria-labelledby="source-request-title">
      <div>
        <p className="eyebrow">La agenda crece con vos</p>
        <h2 id="source-request-title">¿Falta una cuenta?</h2>
        <p>
          Pasanos su Instagram. La revisamos antes de sumarla a la agenda.
        </p>
      </div>

      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="instagram-username">Usuario de Instagram</label>
        <div className="source-request__field">
          <AtSign size={20} aria-hidden="true" />
          <input
            id="instagram-username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="cuenta.salsera"
            autoComplete="off"
            spellCheck={false}
            maxLength={31}
            required
          />
          <button type="submit" disabled={pending || !username.trim()}>
            <span>{pending ? "Enviando…" : "Sugerir"}</span>
            <Send size={17} aria-hidden="true" />
          </button>
        </div>
        {message ? (
          <p className="source-request__message" data-error={failed} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
