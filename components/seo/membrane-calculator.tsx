"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Droplets } from "lucide-react";

function positiveNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function MembraneCalculator() {
  const [area, setArea] = useState("30");
  const [consumption, setConsumption] = useState("1,5");
  const [waste, setWaste] = useState("10");

  const result = useMemo(() => {
    const surfaceArea = positiveNumber(area);
    const kgPerSquareMeter = positiveNumber(consumption);
    const wastePct = Math.max(0, Math.min(30, positiveNumber(waste)));
    const kilograms = surfaceArea * kgPerSquareMeter * (1 + wastePct / 100);

    return { surfaceArea, kgPerSquareMeter, wastePct, kilograms };
  }, [area, consumption, waste]);

  return (
    <section className="checkout-panel" aria-label="Calculadora de membrana líquida">
      <div className="section-head">
        <div>
          <span className="kicker">Calculadora FZAC</span>
          <h2><Calculator size={24} /> Estimá cuánta membrana necesitás</h2>
          <p>Ingresá el consumo total recomendado por el fabricante en kg por m² para el sistema completo.</p>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Superficie del techo (m²)
          <input inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} />
        </label>
        <label>
          Consumo recomendado (kg/m²)
          <input inputMode="decimal" value={consumption} onChange={(event) => setConsumption(event.target.value)} />
        </label>
        <label>
          Margen adicional (%)
          <input inputMode="decimal" value={waste} onChange={(event) => setWaste(event.target.value)} />
        </label>
      </div>

      <div className="checkout-confidence" style={{ marginTop: 22 }}>
        <div><span><strong>{result.surfaceArea.toFixed(1)} m²</strong> de techo</span></div>
        <div><span><strong>{result.kgPerSquareMeter.toFixed(2)} kg/m²</strong> de consumo</span></div>
        <div><span><strong>{result.kilograms.toFixed(1)} kg</strong> estimados</span></div>
      </div>

      <p className="checkout-summary__payment" style={{ marginTop: 18 }}>
        Siempre compará el resultado con el rendimiento de la ficha técnica. Fisuras, juntas, absorción y estado del soporte pueden modificar el consumo.
      </p>

      <div className="legal-action-row" style={{ marginTop: 18 }}>
        <Link className="btn" href="/categoria/pintura-impermeabilizacion">
          <Droplets size={17} /> Ver impermeabilizantes
        </Link>
        <Link className="btn btn--ghost" href="/guias/membrana-liquida-para-techo">
          Qué revisar antes de aplicar
        </Link>
      </div>
    </section>
  );
}
