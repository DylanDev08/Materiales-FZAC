import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Materiales FZAC",
    short_name: "FZAC",
    description: "Tienda online de construcción en seco, steel framing y ferretería en Rosario.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B0B",
    theme_color: "#F4C400",
    lang: "es-AR",
    orientation: "portrait-primary",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
