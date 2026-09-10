"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Grid2X2, Menu, X } from "lucide-react";
import type { Category } from "@/types/domain";

const productLinks = [
  { href: "/productos", label: "Todos los productos" },
  { href: "/productos?featured=true", label: "Destacados" },
  { href: "/productos?order=price_desc", label: "Más vendidos" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/productos?inStock=true", label: "Stock disponible" }
];

const fallbackCategories = [
  { href: "/categoria/materiales", label: "Materiales de obra" },
  { href: "/categoria/construccion-en-seco", label: "Construcción en seco" },
  { href: "/categoria/ferreteria", label: "Ferretería" },
  { href: "/categoria/herramientas", label: "Herramientas" },
  { href: "/categoria/electricidad", label: "Electricidad" },
  { href: "/categoria/plomeria", label: "Plomería" },
  { href: "/categoria/pintura", label: "Pintura e impermeabilización" },
  { href: "/categoria/revestimientos", label: "Revestimientos" },
  { href: "/ofertas", label: "Ofertas" }
];

export function SiteNav({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<"products" | "categories" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const categoryLinks =
    categories.length > 0
      ? categories.slice(0, 9).map((category) => ({ href: `/categoria/${category.slug}`, label: category.name }))
      : fallbackCategories;

  const homeActive = pathname === "/";
  const productsActive = pathname === "/productos" || pathname.startsWith("/producto/");
  const categoriesActive = pathname === "/categorias" || pathname.startsWith("/categoria/");
  const offersActive = pathname === "/ofertas";
  const howToBuyActive = pathname === "/como-comprar";
  const contactActive = pathname === "/contacto";

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
      <nav className="category-nav" aria-label="Navegación principal">
        <div className="container category-nav__inner">
          <Link href="/" className={homeActive ? "is-active" : undefined} aria-current={homeActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Inicio
          </Link>
          <div className="nav-dropdown-wrap">
            <button
              type="button"
              className={`category-nav__button category-nav__button--primary${productsActive ? " is-active" : ""}`}
              aria-expanded={openDropdown === "products"}
              aria-current={productsActive ? "page" : undefined}
              onClick={() => setOpenDropdown(openDropdown === "products" ? null : "products")}
            >
              Productos <ChevronDown size={16} />
            </button>
            {openDropdown === "products" ? (
              <div className="nav-dropdown">
                {productLinks.map((item) => (
                  <Link href={item.href} key={item.href} onClick={closeAll} prefetch={false}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="nav-dropdown-wrap">
            <button
              type="button"
              className={`category-nav__button${categoriesActive ? " is-active" : ""}`}
              aria-expanded={openDropdown === "categories"}
              aria-current={categoriesActive ? "page" : undefined}
              onClick={() => setOpenDropdown(openDropdown === "categories" ? null : "categories")}
            >
              <Grid2X2 size={16} /> Categorías <ChevronDown size={16} />
            </button>
            {openDropdown === "categories" ? (
              <div className="nav-dropdown">
                {categoryLinks.map((item) => (
                  <Link href={item.href} key={item.href} onClick={closeAll} prefetch={false}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/ofertas" className={offersActive ? "is-active" : undefined} aria-current={offersActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Ofertas
          </Link>
          <Link href="/como-comprar" className={howToBuyActive ? "is-active" : undefined} aria-current={howToBuyActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Cómo comprar
          </Link>
          <Link href="/contacto" className={contactActive ? "is-active" : undefined} aria-current={contactActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
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
          <Link href="/" className={homeActive ? "is-active" : undefined} aria-current={homeActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Inicio
          </Link>
          <Link href="/productos" className={productsActive ? "is-active" : undefined} aria-current={productsActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Productos
          </Link>
          <button type="button" className={categoriesActive ? "is-active" : undefined} aria-current={categoriesActive ? "page" : undefined} onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}>
            Categorías <ChevronDown size={16} />
          </button>
          {mobileCategoriesOpen ? (
            <div className="mobile-nav-panel__group">
              {categoryLinks.map((item) => (
                <Link href={item.href} key={item.href} onClick={closeAll} prefetch={false}>
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
          <Link href="/ofertas" className={offersActive ? "is-active" : undefined} aria-current={offersActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Ofertas
          </Link>
          <Link href="/como-comprar" className={howToBuyActive ? "is-active" : undefined} aria-current={howToBuyActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Cómo comprar
          </Link>
          <Link href="/contacto" className={contactActive ? "is-active" : undefined} aria-current={contactActive ? "page" : undefined} onClick={closeAll} prefetch={false}>
            Contacto
          </Link>
        </div>
      ) : null}
    </div>
  );
}
