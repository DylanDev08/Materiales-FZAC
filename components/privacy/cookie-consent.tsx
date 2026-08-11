"use client";

import Image from "next/image";
import Link from "next/link";
import { Cookie, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  PRIVACY_SETTINGS_OPEN_EVENT,
  readPrivacyConsent,
  savePrivacyConsent
} from "@/lib/privacy/consent";

type ConsentView = "hidden" | "notice" | "settings";

export function CookieConsent() {
  const [view, setView] = useState<ConsentView>("hidden");
  const [preferences, setPreferences] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const current = readPrivacyConsent();
      setPreferences(current?.preferences ?? false);
      if (!current) setView("notice");
    });

    const openSettings = () => {
      const saved = readPrivacyConsent();
      setPreferences(saved?.preferences ?? false);
      setView("settings");
    };
    window.addEventListener(PRIVACY_SETTINGS_OPEN_EVENT, openSettings);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(PRIVACY_SETTINGS_OPEN_EVENT, openSettings);
    };
  }, []);

  function confirm(nextPreferences: boolean) {
    savePrivacyConsent(nextPreferences);
    setView("hidden");
  }

  if (view === "hidden") return null;

  return (
    <aside className="privacy-consent" aria-label="Preferencias de privacidad" aria-live="polite">
      <div
        className={`privacy-consent__panel privacy-consent__panel--${view}`}
        role={view === "settings" ? "dialog" : "region"}
        aria-labelledby="privacy-consent-title"
      >
        <header className="privacy-consent__head">
          <span className="privacy-consent__brand">
            <Image src="/logoFZAC.jpg" alt="" width={46} height={46} />
          </span>
          <div>
            <span className="kicker"><Cookie size={14} /> Privacidad FZAC</span>
            <h2 id="privacy-consent-title">{view === "settings" ? "Configurá tu experiencia" : "Tu privacidad, bajo tu control"}</h2>
          </div>
          {readPrivacyConsent() ? (
            <button className="privacy-consent__close" type="button" aria-label="Cerrar preferencias" onClick={() => setView("hidden")}>
              <X size={19} />
            </button>
          ) : null}
        </header>

        <p>
          Usamos almacenamiento necesario para la sesión, el carrito y el checkout. Con tu permiso también recordamos
          búsquedas y conversaciones en este dispositivo. No usamos publicidad ni vendemos tus datos.
        </p>

        {view === "settings" ? (
          <div className="privacy-consent__choices">
            <div>
              <span><ShieldCheck size={18} /><strong>Necesarias</strong></span>
              <small>Sesión, seguridad, carrito e idempotencia. Siempre activas.</small>
              <b>Activas</b>
            </div>
            <label>
              <span><SlidersHorizontal size={18} /><strong>Preferencias</strong></span>
              <small>Recuerda búsquedas y conversaciones del asistente en este dispositivo.</small>
              <input type="checkbox" checked={preferences} onChange={(event) => setPreferences(event.target.checked)} />
            </label>
            <div className="privacy-consent__choice--disabled">
              <span><strong>Analítica y publicidad</strong></span>
              <small>No hay herramientas de seguimiento publicitario activadas.</small>
              <b>No utilizadas</b>
            </div>
          </div>
        ) : null}

        <div className="privacy-consent__links">
          <Link href="/privacidad">Política de privacidad</Link>
          <Link href="/terminos">Términos y condiciones</Link>
          <span>Las condiciones de compra se aceptan aparte.</span>
        </div>

        <div className="privacy-consent__actions">
          {view === "notice" ? (
            <button className="btn btn--ghost" type="button" onClick={() => setView("settings")}>Configurar</button>
          ) : null}
          <button className="btn btn--ghost" type="button" onClick={() => confirm(false)}>Solo necesarias</button>
          <button className="btn" type="button" onClick={() => confirm(view === "settings" ? preferences : true)}>
            {view === "settings" ? "Guardar preferencias" : "Aceptar recomendadas"}
          </button>
        </div>
      </div>
    </aside>
  );
}
