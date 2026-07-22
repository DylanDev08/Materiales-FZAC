"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import type { Category } from "@/types/domain";

const productLinks = [
  { href: "/productos", label: "Todos los productos" },
  { href: "/productos?featured=true", label: "Destacados" },
  { href: "/productos?order=price_desc", label: "Mas vendidos" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/productos?inStock=true", label: "Stock disponible" }
];

const fallbackCategories = [
  { href: "/categoria/materiales", label: "Materiales de obra" },
  { href: "/categoria/construccion-en-seco", label: "Construccion en seco" },
  { href: "/categoria/ferreteria", label: "Ferreteria" },
  { href: "/categoria/herramientas", label: "Herramientas" },
  { href: "/categoria/electricidad", label: "Electricidad" },
  { href: "/categoria/plomeria", label: "Plomeria" },
  { href: "/categoria/pintura", label: "Pintura e impermeabilizacion" },
  { href: "/categoria/revestimientos", label: "Revestimientos" },
  { href: "/ofertas", label: "Ofertas" }
];

export function SiteNav({ categories }: { categories: Category[] }) {
  const [openDropdown, setOpenDropdown] = useState<"products" | "categories" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const categoryLinks =
    categories.length > 0
      ? categories.slice(0, 9).map((category) => ({ href: `/categoria/${category.slug}`, label: category.name }))
      : fallbackCategories;

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setReady(true), 0);

    function close(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", close);
    return () => {
      window.clearTimeout(readyTimer);
      document.removeEventListener("mousedown", close);
    };
  }, []);

  function closeAll() {
    setOpenDropdown(null);
    setMobileOpen(false);
  }

  return (
    <div className="site-nav-wrap" ref={navRef}>
      <nav className="category-nav" aria-label="Navegacion principal">
        <div className="container category-nav__inner">
          <Link href="/" onClick={closeAll}>
            Inicio
          </Link>
          <div className="nav-dropdown-wrap">
            <button
              type="button"
              className="category-nav__button"
              aria-expanded={openDropdown === "products"}
              onClick={() => setOpenDropdown(openDropdown === "products" ? null : "products")}
            >
              Productos <ChevronDown size={16} />
            </button>
            {openDropdown === "products" ? (
              <div className="nav-dropdown">
                {productLinks.map((item) => (
                  <Link href={item.href} key={item.href} onClick={closeAll}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="nav-dropdown-wrap">
            <button
              type="button"
              className="category-nav__button"
              aria-expanded={openDropdown === "categories"}
              onClick={() => setOpenDropdown(openDropdown === "categories" ? null : "categories")}
            >
              Categorias <ChevronDown size={16} />
            </button>
            {openDropdown === "categories" ? (
              <div className="nav-dropdown">
                {categoryLinks.map((item) => (
                  <Link href={item.href} key={item.href} onClick={closeAll}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/ofertas" onClick={closeAll}>
            Ofertas
          </Link>
          <Link href="/como-comprar" onClick={closeAll}>
            Como comprar
          </Link>
          <Link href="/contacto" onClick={closeAll}>
            Contacto
          </Link>
        </div>
      </nav>

      <button className="mobile-menu-trigger" type="button" aria-expanded={mobileOpen} disabled={!ready} onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        <span>Menu</span>
      </button>
      {mobileOpen ? (
        <div className="mobile-nav-panel">
          <Link href="/" onClick={closeAll}>
            Inicio
          </Link>
          <Link href="/productos" onClick={closeAll}>
            Productos
          </Link>
          <button type="button" onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}>
            Categorias <ChevronDown size={16} />
          </button>
          {mobileCategoriesOpen ? (
            <div className="mobile-nav-panel__group">
              {categoryLinks.map((item) => (
                <Link href={item.href} key={item.href} onClick={closeAll}>
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
          <Link href="/ofertas" onClick={closeAll}>
            Ofertas
          </Link>
          <Link href="/como-comprar" onClick={closeAll}>
            Como comprar
          </Link>
          <Link href="/contacto" onClick={closeAll}>
            Contacto
          </Link>
        </div>
      ) : null}
    </div>
  );
}
