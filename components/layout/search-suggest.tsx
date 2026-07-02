"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { currency } from "@/lib/formatters/currency";

type Suggestion = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  price: number;
  image_url: string;
};

export function SearchSuggest() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
    }, 180);

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = query.trim() ? `/productos?search=${encodeURIComponent(query.trim())}` : "/productos";
    window.location.assign(target);
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
            if (next.trim().length < 2) {
              setSuggestions([]);
              setOpen(false);
            }
          }}
          onFocus={() => setOpen(suggestions.length > 0)}
          placeholder="Buscar cemento, placas, perfiles, pintura..."
        />
        <button type="submit" aria-label="Buscar">
          <Search size={20} />
        </button>
      </form>

      {open ? (
        <div className="search-suggest__panel">
          {loading ? <span className="search-suggest__status">Buscando...</span> : null}
          {!loading && suggestions.length === 0 ? <span className="search-suggest__status">Sin sugerencias</span> : null}
          {suggestions.map((product) => (
            <Link className="search-suggest__item" href={`/producto/${product.slug}`} key={product.id} onClick={() => setOpen(false)}>
              <span className="search-suggest__image">
                <Image src={product.image_url} alt={product.name} width={48} height={48} />
              </span>
              <span>
                <strong>{product.name}</strong>
                <small>
                  {product.brand} · {product.sku}
                </small>
              </span>
              <b>{currency(product.price)}</b>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
