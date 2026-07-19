"use client";

import { Grid2X2, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function CatalogViewToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "list" ? "list" : "grid";

  function select(nextView: "grid" | "list") {
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "grid") params.delete("view");
    else params.set("view", nextView);
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  return (
    <div className="catalog-view-toggle" aria-label="Vista de productos">
      <button type="button" className={view === "grid" ? "is-active" : ""} onClick={() => select("grid")} title="Vista en grilla">
        <Grid2X2 size={17} />
        <span className="sr-only">Vista en grilla</span>
      </button>
      <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => select("list")} title="Vista en lista">
        <List size={18} />
        <span className="sr-only">Vista en lista</span>
      </button>
    </div>
  );
}
