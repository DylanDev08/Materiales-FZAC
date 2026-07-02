"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Grid3X3, Search, Tag } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { currency } from "@/lib/formatters/currency";

type Suggestion =
  | {
      type: "product";
      id: string;
      name: string;
      slug: string;
      sku: string;
      brand: string;
      price: number;
      image_url: string;
    }
  | { type: "category"; id: string; name: string; slug: string; description?: string }
  | { type: "brand" | "term"; id: string; name: string; slug: string };

const RECENT_KEY = "fzac-search-recent-v1";

function suggestionHref(suggestion: Suggestion) {
  if (suggestion.type === "product") return `/producto/${suggestion.slug}`;
  if (suggestion.type === "category") return `/categoria/${suggestion.slug}`;
  if (suggestion.type === "brand") return `/productos?brand=${encodeURIComponent(suggestion.name)}`;
  return `/productos?search=${encodeURIComponent(suggestion.slug)}`;
}

export function SearchSuggest() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]") as string[];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function remember(term: string) {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecent(next);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = query.trim();
    remember(clean);
    window.location.assign(clean ? `/productos?search=${encodeURIComponent(clean)}` : "/productos");
  }

  return (
    <div className="search-suggest" ref={boxRef}>
      <form className="header-search" onSubmit={submit}>
        <label className="sr-only" htmlFor="site-search">
          Buscar productos
        </label>
        <input
          autoComplete="off"
          id="site-search"
          name="search"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            if (next.trim().length < 2) setSuggestions([]);
            setOpen(next.trim().length >= 2 || recent.length > 0);
          }}
          onFocus={() => setOpen(query.trim().length >= 2 || recent.length > 0)}
          placeholder="Buscar cemento, placas, perfiles, pintura..."
        />
        <button type="submit" aria-label="Buscar">
          <Search size={20} />
        </button>
      </form>

      {open ? (
        <div className="search-suggest__panel">
          {query.trim().length < 2 && recent.length ? (
            <div className="search-suggest__group">
              <span className="search-suggest__status">Busquedas recientes</span>
              {recent.map((term) => (
                <Link
                  className="search-suggest__item search-suggest__item--compact"
                  href={`/productos?search=${encodeURIComponent(term)}`}
                  key={term}
                  onClick={() => {
                    remember(term);
                    setOpen(false);
                  }}
                >
                  <Clock size={18} />
                  <strong>{term}</strong>
                </Link>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="search-skeleton" aria-label="Cargando sugerencias">
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {!loading && query.trim().length >= 2 && suggestions.length === 0 ? (
            <span className="search-suggest__status">No encontramos resultados</span>
          ) : null}
          {suggestions.map((suggestion) => (
            <Link
              className="search-suggest__item"
              href={suggestionHref(suggestion)}
              key={`${suggestion.type}-${suggestion.id}`}
              onClick={() => {
                remember(suggestion.name);
                setOpen(false);
              }}
            >
              {suggestion.type === "product" ? (
                <span className="search-suggest__image">
                  <Image src={suggestion.image_url} alt={suggestion.name} width={48} height={48} />
                </span>
              ) : (
                <span className="search-suggest__icon">
                  {suggestion.type === "category" ? <Grid3X3 size={20} /> : <Tag size={20} />}
                </span>
              )}
              <span>
                <strong>{suggestion.name}</strong>
                <small>
                  {suggestion.type === "product"
                    ? `${suggestion.brand} - ${suggestion.sku}`
                    : suggestion.type === "category"
                      ? "Categoria"
                      : suggestion.type === "brand"
                        ? "Marca"
                        : "Busqueda sugerida"}
                </small>
              </span>
              {suggestion.type === "product" ? <b>{currency(suggestion.price)}</b> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
