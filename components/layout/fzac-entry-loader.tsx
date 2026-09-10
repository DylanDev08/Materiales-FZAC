"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Instagram, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WhatsappIcon } from "@/components/ui/whatsapp-icon";

const SESSION_KEY = "fzac-entry-complete-v1";

type LoaderState = "ready" | "building" | "hidden";

export function FzacEntryLoader({
  instagramHref,
  whatsappHref,
  email
}: {
  instagramHref: string;
  whatsappHref: string;
  email: string;
}) {
  const pathname = usePathname();
  const [state, setState] = useState<LoaderState>("ready");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const visible = pathname === "/" && state !== "hidden";

  useEffect(() => {
    if (pathname !== "/") return;
    const frame = window.requestAnimationFrame(() => {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY) === "true") {
          setState("hidden");
          return;
        }
      } catch {
        // The entry remains usable when storage is unavailable.
      }

      setState("ready");
      buttonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  function enterStore() {
    if (state !== "ready") return;
    setState("building");
    timerRef.current = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "true");
      } catch {
        // The transition still completes without persistent browser storage.
      }
      setState("hidden");
    }, 900);
  }

  if (!visible) return null;

  const building = state === "building";

  return (
    <div className={`fzac-entry-loader ${building ? "is-building" : ""}`} role="dialog" aria-modal="true" aria-labelledby="fzac-entry-title">
      <div className="fzac-entry-loader__frame">
        <div className="fzac-entry-loader__logo">
          <Image src="/logoFZAC.jpg" alt="Materiales FZAC" width={124} height={124} priority unoptimized />
        </div>

        <div className="fzac-entry-loader__copy">
          <span>Fortaleza Construcciones</span>
          <h1 id="fzac-entry-title">Tu obra empieza en FZAC.</h1>
          <p>Materiales, herramientas y soluciones para construir con confianza.</p>
        </div>

        <button ref={buttonRef} className="fzac-entry-loader__action" type="button" onClick={enterStore} disabled={building} aria-busy={building}>
          <span aria-hidden="true" />
          {building ? "Construyendo..." : "Construir"}
        </button>

        <div className="fzac-entry-loader__progress" aria-hidden="true"><span /></div>

        <nav className="fzac-entry-loader__socials" aria-label="Redes y contacto FZAC">
          <a href={instagramHref} target="_blank" rel="noreferrer" aria-label="Instagram de FZAC"><Instagram size={20} /></a>
          <a href={whatsappHref} target="_blank" rel="noreferrer" aria-label="WhatsApp de FZAC"><WhatsappIcon width={21} height={21} /></a>
          <a href={`mailto:${email}`} aria-label="Email de FZAC"><Mail size={20} /></a>
        </nav>
      </div>
    </div>
  );
}
