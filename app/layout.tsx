import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/layout/providers";
import {
  getPublicSiteUrl,
  isSeoIndexingEnabled,
  SITE_DESCRIPTION,
  SITE_NAME,
  toAbsoluteUrl
} from "@/lib/seo/site";
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

const indexingEnabled = isSeoIndexingEnabled();

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | Materiales para construcción en Rosario`,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(getPublicSiteUrl()),
  alternates: {
    canonical: "/"
  },
  keywords: [
    "materiales de construcción",
    "corralón Rosario",
    "ferretería Rosario",
    "construcción en seco",
    "materiales para obra",
    "Fortaleza Construcciones"
  ],
  authors: [{ name: "Fortaleza Construcciones" }],
  creator: "Fortaleza Construcciones",
  publisher: SITE_NAME,
  category: "E-commerce de materiales para construcción",
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/logoFZAC.jpg", type: "image/jpeg" }]
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Materiales para construcción en Rosario`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: toAbsoluteUrl("/logoFZAC.jpg"),
        width: 1080,
        height: 1080,
        alt: "Logo de Materiales FZAC"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Materiales para construcción`,
    description: SITE_DESCRIPTION,
    images: [toAbsoluteUrl("/logoFZAC.jpg")]
  },
  robots: {
    index: indexingEnabled,
    follow: indexingEnabled,
    nocache: !indexingEnabled,
    googleBot: {
      index: indexingEnabled,
      follow: indexingEnabled,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
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
