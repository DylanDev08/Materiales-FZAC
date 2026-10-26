"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, PaintRoller } from "lucide-react";

function positiveNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function PaintCalculator() {
  const [area, setArea] = useState("40");
  const [coats, setCoats] = useState("2");
  const [coverage, setCoverage] = useState("10");
  const [waste, setWaste] = useState("10");

  const result = useMemo(() => {
    const surfaceArea = positiveNumber(area);
    const coatCount = Math.max(1, Math.min(5, Math.round(positiveNumber(coats) || 1)));
    const coverageRate = positiveNumber(coverage);
    const wastePct = Math.max(0, Math.min(30, positiveNumber(waste)));

    const rawLiters = coverageRate > 0 ? (surfaceArea * coatCount) / coverageRate : 0;
    const liters = rawLiters * (1 + wastePct / 100);

    return { surfaceArea, coatCount, coverageRate, liters, wastePct };
  }, [area, coats, coverage, waste]);

  return (
    <section className="checkout-panel" aria-label="Calculadora de pintura">
      <div className="section-head">
        <div>
          <span className="kicker">Calculadora FZAC</span>
          <h2><Calculator size={24} /> Estimá cuánta pintura necesitás</h2>
          <p>Usá el rendimiento indicado por el fabricante del producto que vas a comprar.</p>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Superficie a pintar (m²)
          <input inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} />
        </label>
        <label>
          Cantidad de manos
          <select value={coats} onChange={(event) => setCoats(event.target.value)}>
            <option value="1">1 mano</option>
            <option value="2">2 manos</option>
            <option value="3">3 manos</option>
          </select>
        </label>
        <label>
          Rendimiento (m²/L por mano)
          <input inputMode="decimal" value={coverage} onChange={(event) => setCoverage(event.target.value)} />
        </label>
        <label>
          Margen adicional (%)
          <input inputMode="decimal" value={waste} onChange={(event) => setWaste(event.target.value)} />
        </label>
      </div>

      <div className="checkout-confidence" style={{ marginTop: 22 }}>
        <div><span><strong>{result.surfaceArea.toFixed(1)} m²</strong> de superficie</span></div>
        <div><span><strong>{result.coatCount}</strong> {result.coatCount === 1 ? "mano" : "manos"}</span></div>
        <div><span><strong>{result.liters.toFixed(1)} L</strong> estimados</span></div>
      </div>

      <p className="checkout-summary__payment" style={{ marginTop: 18 }}>
        El consumo real puede variar según absorción, color, textura, preparación y método de aplicación.
      </p>

      <div className="legal-action-row" style={{ marginTop: 18 }}>
        <Link className="btn" href="/categoria/pintura-impermeabilizacion">
          <PaintRoller size={17} /> Ver pinturas
        </Link>
        <Link className="btn btn--ghost" href="/guias/membrana-liquida-para-techo">
          Ver guía de impermeabilización
        </Link>
      </div>
    </section>
  );
}
