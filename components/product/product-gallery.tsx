"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

export function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const gallery = useMemo(() => Array.from(new Set(images.filter(Boolean))).slice(0, 5), [images]);
  const [selected, setSelected] = useState(gallery[0] ?? "");

  if (!selected) return null;

  return (
    <section className="product-gallery" aria-label={`Galería de ${name}`}>
      <div className="product-gallery__main">
        <Image src={selected} alt={name} fill sizes="(max-width: 900px) 100vw, 52vw" priority />
      </div>
      {gallery.length > 1 ? (
        <div className="product-gallery__thumbs" role="list" aria-label="Imágenes disponibles">
          {gallery.map((image, index) => (
            <button
              className={`product-gallery__thumb ${selected === image ? "is-active" : ""}`}
              type="button"
              onClick={() => setSelected(image)}
              aria-label={`Ver imagen ${index + 1} de ${name}`}
              aria-pressed={selected === image}
              key={image}
            >
              <Image src={image} alt="" fill sizes="92px" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
