import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const staticAssetRecoveryScript = `
(() => {
  const retryKey = "fzac-static-asset-retry";
  let recoveryScheduled = false;

  window.addEventListener("error", (event) => {
    const target = event.target;
    const source = target instanceof HTMLScriptElement
      ? target.src
      : target instanceof HTMLLinkElement && target.rel === "stylesheet"
        ? target.href
        : "";

    if (recoveryScheduled || !source.includes("/_next/static/")) return;
    recoveryScheduled = true;

    let retries = 0;
    try {
      retries = Number(window.sessionStorage.getItem(retryKey) || "0");
    } catch {}

    if (retries >= 2) return;
    try {
      window.sessionStorage.setItem(retryKey, String(retries + 1));
    } catch {}

    window.setTimeout(() => window.location.reload(), 250 * (retries + 1));
  }, true);

  window.addEventListener("load", () => {
    if (recoveryScheduled) return;
    try {
      window.sessionStorage.removeItem(retryKey);
    } catch {}
  }, { once: true });
})();
`;

export const metadata: Metadata = {
  title: {
    default: "Materiales FZAC",
    template: "%s | Materiales FZAC"
  },
  description: "E-commerce profesional de materiales para Fortaleza Construcciones Rosario.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: staticAssetRecoveryScript }} />
      </head>
      <body>
        <Providers>
          <div className="site-shell">
            <SiteHeader />
            <div className="site-main">{children}</div>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
