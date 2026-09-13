"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const gallery = useMemo(() => Array.from(new Set(images.filter(Boolean))).slice(0, 5), [images]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const selected = gallery[selectedIndex] ?? gallery[0] ?? "";

  const selectRelative = useCallback((direction: -1 | 1) => {
    setSelectedIndex((current) => (current + direction + gallery.length) % gallery.length);
  }, [gallery.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft" && gallery.length > 1) selectRelative(-1);
      if (event.key === "ArrowRight" && gallery.length > 1) selectRelative(1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gallery.length, lightboxOpen, selectRelative]);

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null || gallery.length < 2) return;
    const distance = event.changedTouches[0]?.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 42) return;
    selectRelative(distance > 0 ? -1 : 1);
  }

  if (!selected) return null;

  return (
    <section className="product-gallery" aria-label={`Galería de ${name}`}>
      <div
        className="product-gallery__main"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={handleTouchEnd}
      >
        <Image src={selected} alt={name} fill sizes="(max-width: 900px) 100vw, 52vw" priority />
        <span className="product-gallery__counter">{selectedIndex + 1} / {gallery.length}</span>
        <button className="product-gallery__zoom" type="button" onClick={() => setLightboxOpen(true)} aria-label={`Ampliar foto de ${name}`}>
          <Expand size={18} />
          <span>Ampliar</span>
        </button>
        {gallery.length > 1 ? (
          <div className="product-gallery__arrows">
            <button type="button" onClick={() => selectRelative(-1)} aria-label="Foto anterior"><ChevronLeft size={22} /></button>
            <button type="button" onClick={() => selectRelative(1)} aria-label="Foto siguiente"><ChevronRight size={22} /></button>
          </div>
        ) : null}
      </div>
      {gallery.length > 1 ? (
        <div className="product-gallery__thumbs" role="list" aria-label="Imágenes disponibles">
          {gallery.map((image, index) => (
            <button
              className={`product-gallery__thumb ${selectedIndex === index ? "is-active" : ""}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Ver imagen ${index + 1} de ${name}`}
              aria-pressed={selectedIndex === index}
              key={image}
            >
              <Image src={image} alt="" fill sizes="92px" />
            </button>
          ))}
        </div>
      ) : null}
      {lightboxOpen ? (
        <div className="product-gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Vista ampliada de ${name}`}>
          <button className="product-gallery-lightbox__close" type="button" onClick={() => setLightboxOpen(false)} aria-label="Cerrar imagen ampliada"><X size={22} /></button>
          <div className="product-gallery-lightbox__stage">
            <Image src={selected} alt={`${name}, imagen ${selectedIndex + 1} de ${gallery.length}`} fill sizes="100vw" />
          </div>
          {gallery.length > 1 ? (
            <div className="product-gallery__arrows">
              <button type="button" onClick={() => selectRelative(-1)} aria-label="Foto anterior"><ChevronLeft size={26} /></button>
              <button type="button" onClick={() => selectRelative(1)} aria-label="Foto siguiente"><ChevronRight size={26} /></button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
