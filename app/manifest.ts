import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Materiales FZAC",
    short_name: "FZAC",
    description: "Tienda online de materiales para construcción, ferretería y obra en Rosario.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B0B",
    theme_color: "#F4C400",
    lang: "es-AR",
    orientation: "portrait-primary",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/logoFZAC.jpg",
        sizes: "1080x1080",
        type: "image/jpeg",
        purpose: "any"
      }
    ]
  };
}
