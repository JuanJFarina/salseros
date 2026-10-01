import { MapPin, Music2, Sparkles } from "lucide-react";

import { EventRequestForm } from "@/components/event-request-form";
import { WeeklyAgenda } from "@/components/weekly-agenda";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#" aria-label="SalseRos, inicio">
          Salse<span>Ros</span>
        </a>
        <p>
          <MapPin size={16} aria-hidden="true" />
          Rosario, Santa Fe
        </p>
      </header>

      <main>
        <section className="hero">
          <div className="hero__content">
            <p className="hero__badge">
              <Sparkles size={17} aria-hidden="true" />
              La agenda salsera de Rosario
            </p>
            <h1>
              Esta semana,
              <br />
              <em>Rosario baila.</em>
            </h1>
            <p className="hero__intro">
              Sociales de salsa y bachata, ordenados y en un solo lugar.
              Elegí pista y avisá que vas.
            </p>
          </div>
          <div className="hero__mark" aria-hidden="true">
            <span className="hero__record">
              <Music2 size={44} strokeWidth={1.6} />
            </span>
            <span className="hero__orbit">SALSA · BACHATA · ROSARIO ·</span>
          </div>
        </section>

        <WeeklyAgenda />
        <EventRequestForm />
      </main>

      <footer className="site-footer">
        <a className="brand brand--small" href="#">
          Salse<span>Ros</span>
        </a>
        <p>
          Los horarios pueden cambiar. Confirmá siempre con la cuenta
          organizadora.
        </p>
        <span>Hecho para la comunidad salsera de Rosario.</span>
      </footer>
    </>
  );
}
