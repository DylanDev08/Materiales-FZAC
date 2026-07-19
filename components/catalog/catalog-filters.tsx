"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import type { Category } from "@/types/domain";

export function CatalogFilters({
  categories,
  brands,
  lockedCategory,
  values
}: {
  categories: Category[];
  brands: string[];
  lockedCategory?: string;
  values: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [search, setSearch] = useState(values.search ?? "");
  const [minPrice, setMinPrice] = useState(values.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(values.maxPrice ?? "");

  const replaceParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false }));
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search.trim() === current) return;
    const timer = window.setTimeout(() => replaceParams({ search: search.trim() || null }), 320);
    return () => window.clearTimeout(timer);
  }, [replaceParams, search, searchParams]);

  const activeFilters = useMemo(() => {
    const rows: Array<{ key: string; label: string }> = [];
    const categorySlug = searchParams.get("category");
    const category = categories.find((item) => item.slug === categorySlug);
    if (category && !lockedCategory) rows.push({ key: "category", label: category.name });
    if (searchParams.get("brand")) rows.push({ key: "brand", label: `Marca: ${searchParams.get("brand")}` });
    if (searchParams.get("minPrice")) rows.push({ key: "minPrice", label: `Desde $${searchParams.get("minPrice")}` });
    if (searchParams.get("maxPrice")) rows.push({ key: "maxPrice", label: `Hasta $${searchParams.get("maxPrice")}` });
    if (searchParams.get("inStock") === "true") rows.push({ key: "inStock", label: "Con stock" });
    if (searchParams.get("onSale") === "true") rows.push({ key: "onSale", label: "Ofertas" });
    if (searchParams.get("featured") === "true") rows.push({ key: "featured", label: "Destacados" });
    return rows;
  }, [categories, lockedCategory, searchParams]);

  function applyPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    replaceParams({ minPrice: minPrice.trim() || null, maxPrice: maxPrice.trim() || null });
    setAdvancedOpen(false);
  }

  function clearFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    const next = lockedCategory ? `?category=${encodeURIComponent(lockedCategory)}` : "";
    startTransition(() => router.replace(`${pathname}${next}`, { scroll: false }));
  }

  return (
    <aside className={`catalog-filter ${pending ? "catalog-filter--pending" : ""}`} aria-label="Filtros del catálogo">
      <div className="catalog-filter__main">
        <label className="catalog-search-field">
          <Search size={18} />
          <span className="sr-only">Buscar productos</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Producto, marca o SKU" />
          {search ? (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
              <X size={16} />
            </button>
          ) : null}
        </label>

        {!lockedCategory ? (
          <label className="catalog-compact-field">
            <span>Rubro</span>
            <select
              value={searchParams.get("category") ?? ""}
              onChange={(event) => replaceParams({ category: event.target.value || null })}
            >
              <option value="">Todos</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="catalog-compact-field">
          <span>Ordenar</span>
          <select
            value={searchParams.get("order") ?? "newest"}
            onChange={(event) => replaceParams({ order: event.target.value === "newest" ? null : event.target.value })}
          >
            <option value="newest">Más recientes</option>
            <option value="price_asc">Menor precio</option>
            <option value="price_desc">Mayor precio</option>
            <option value="stock_desc">Más stock</option>
            <option value="offers">Ofertas primero</option>
            <option value="name_asc">Nombre A-Z</option>
          </select>
        </label>

        <button
          className={`catalog-filter__toggle ${searchParams.get("inStock") === "true" ? "is-active" : ""}`}
          type="button"
          aria-pressed={searchParams.get("inStock") === "true"}
          onClick={() => replaceParams({ inStock: searchParams.get("inStock") === "true" ? null : "true" })}
        >
          <Check size={16} /> Con stock
        </button>
        <button
          className={`catalog-filter__toggle ${searchParams.get("onSale") === "true" ? "is-active" : ""}`}
          type="button"
          aria-pressed={searchParams.get("onSale") === "true"}
          onClick={() => replaceParams({ onSale: searchParams.get("onSale") === "true" ? null : "true" })}
        >
          Ofertas
        </button>
        <button className="catalog-filter__advanced-button" type="button" onClick={() => setAdvancedOpen(true)}>
          <SlidersHorizontal size={17} /> Más filtros
        </button>
      </div>

      {activeFilters.length ? (
        <div className="catalog-active-filters">
          <span>Filtros activos</span>
          {activeFilters.map((filter) => (
            <button key={filter.key} type="button" onClick={() => replaceParams({ [filter.key]: null })}>
              {filter.label} <X size={14} />
            </button>
          ))}
          <button className="catalog-active-filters__clear" type="button" onClick={clearFilters}>
            <RotateCcw size={14} /> Limpiar
          </button>
        </div>
      ) : null}

      {advancedOpen ? <button className="catalog-filter__backdrop" type="button" onClick={() => setAdvancedOpen(false)} aria-label="Cerrar filtros" /> : null}
      <section className={`catalog-filter__advanced ${advancedOpen ? "is-open" : ""}`} aria-hidden={!advancedOpen}>
        <header>
          <div>
            <span className="kicker">Afinar búsqueda</span>
            <h2>Más filtros</h2>
          </div>
          <button type="button" onClick={() => setAdvancedOpen(false)} aria-label="Cerrar filtros">
            <X size={19} />
          </button>
        </header>
        <form onSubmit={applyPrices}>
          <label className="field">
            Marca
            <select
              value={searchParams.get("brand") ?? ""}
              onChange={(event) => replaceParams({ brand: event.target.value || null })}
            >
              <option value="">Todas las marcas</option>
              {brands.map((brand) => (
                <option value={brand} key={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
          <div className="catalog-filter__range">
            <label className="field">
              Precio mínimo
              <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputMode="numeric" placeholder="$ 0" />
            </label>
            <label className="field">
              Precio máximo
              <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="numeric" placeholder="Sin límite" />
            </label>
          </div>
          <div className="catalog-filter__advanced-actions">
            <button className="btn btn--ghost" type="button" onClick={clearFilters}>
              <RotateCcw size={16} /> Limpiar
            </button>
            <button className="btn" type="submit">
              Aplicar filtros
            </button>
          </div>
        </form>
      </section>
    </aside>
  );
}
