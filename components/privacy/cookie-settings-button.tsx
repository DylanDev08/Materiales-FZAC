"use client";

import { Cookie } from "lucide-react";
import { PRIVACY_SETTINGS_OPEN_EVENT } from "@/lib/privacy/consent";

export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button
      className={`cookie-settings-button ${className}`.trim()}
      type="button"
      onClick={() => window.dispatchEvent(new Event(PRIVACY_SETTINGS_OPEN_EVENT))}
    >
      <Cookie size={15} /> Preferencias de cookies
    </button>
  );
}
