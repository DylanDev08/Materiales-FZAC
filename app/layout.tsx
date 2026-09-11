import type { Metadata } from "next";
import { FzacEntryLoader } from "@/components/layout/fzac-entry-loader";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/layout/providers";
import {
  getPublicSiteUrl,
  isSeoIndexingEnabled,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SOCIAL_IMAGE,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_WIDTH,
  toAbsoluteUrl
} from "@/lib/seo/site";
import { getEnv, hasRealValue } from "@/lib/utils/env";
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
const googleVerification = getEnv("GOOGLE_SITE_VERIFICATION");

function instagramHref(value: string) {
  const handle = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .replace(/[^A-Za-z0-9._]/g, "");
  return `https://www.instagram.com/${handle || "fzaconstrucciones"}/`;
}

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
  keywords: SITE_KEYWORDS,
  authors: [{ name: "Fortaleza Construcciones" }],
  creator: "Fortaleza Construcciones",
  publisher: SITE_NAME,
  category: "E-commerce de materiales para construcción",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  verification: hasRealValue(googleVerification) ? { google: googleVerification } : undefined,
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }]
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
        url: toAbsoluteUrl(SOCIAL_IMAGE),
        width: SOCIAL_IMAGE_WIDTH,
        height: SOCIAL_IMAGE_HEIGHT,
        alt: "Materiales para construcción y obra de Materiales FZAC"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Materiales para construcción`,
    description: SITE_DESCRIPTION,
    images: [toAbsoluteUrl(SOCIAL_IMAGE)]
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
  const email = getEnv("FZAC_EMAIL") || "fortalezaconstruccionesrosario@gmail.com";
  const whatsapp = (getEnv("FZAC_WHATSAPP") || getEnv("NEXT_PUBLIC_FZAC_WHATSAPP") || "5493415847000").replace(/\D/g, "");
  const instagram = instagramHref(getEnv("FZAC_INSTAGRAM") || getEnv("NEXT_PUBLIC_FZAC_INSTAGRAM") || "@fzaconstrucciones");

  return (
    <html lang="es-AR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: staticAssetRecoveryScript }} />
      </head>
      <body>
        <Providers>
          <FzacEntryLoader
            email={email}
            instagramHref={instagram}
            whatsappHref={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola FZAC, quiero consultar por materiales para mi obra.")}`}
          />
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
