"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Instagram, Mail } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WhatsappIcon } from "@/components/ui/whatsapp-icon";

const SESSION_KEY = "fzac-entry-complete-v1";
const AUTO_CLOSE_MS = 1150;

type LoaderState = "building" | "hidden";

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
  const [state, setState] = useState<LoaderState>("building");
  const timerRef = useRef<number | null>(null);
  const visible = pathname === "/" && state !== "hidden";

  const completeEntry = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // The transition still completes without persistent browser storage.
    }

    setState("hidden");
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pathname !== "/") {
      return;
    }

    let alreadyComplete = false;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "true") {
        alreadyComplete = true;
      }
    } catch {
      // The entry remains usable when storage is unavailable.
    }

    timerRef.current = window.setTimeout(
      alreadyComplete ? () => setState("hidden") : completeEntry,
      alreadyComplete ? 0 : AUTO_CLOSE_MS
    );

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [completeEntry, pathname]);

  if (!visible) return null;

  return (
    <div className="fzac-entry-loader is-building" role="status" aria-live="polite" aria-label="Ingresando a Materiales FZAC">
      <div className="fzac-entry-loader__frame">
        <div className="fzac-entry-loader__logo">
          <Image src="/logoFZAC.jpg" alt="Materiales FZAC" width={124} height={124} priority unoptimized />
        </div>

        <div className="fzac-entry-loader__copy">
          <span>Fortaleza Construcciones</span>
          <h1>Tu obra empieza en FZAC.</h1>
          <p>Materiales, herramientas y soluciones para construir con confianza.</p>
        </div>

        <button className="fzac-entry-loader__action" type="button" onClick={completeEntry}>
          <span aria-hidden="true" />
          Entrar a la tienda
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
