"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, ShoppingCart } from "lucide-react";

const BOARD_WIDTH = 1.2;
const BOARD_HEIGHT = 2.4;
const BOARD_AREA = BOARD_WIDTH * BOARD_HEIGHT;

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function DurlockBoardCalculator() {
  const [width, setWidth] = useState("4");
  const [height, setHeight] = useState("2,60");
  const [faces, setFaces] = useState("2");
  const [waste, setWaste] = useState("10");

  const result = useMemo(() => {
    const wallWidth = numberValue(width);
    const wallHeight = numberValue(height);
    const faceCount = Math.max(1, Math.min(2, Math.round(numberValue(faces) || 1)));
    const wastePercent = Math.max(0, Math.min(30, numberValue(waste)));

    const netArea = wallWidth * wallHeight * faceCount;
    const purchaseArea = netArea * (1 + wastePercent / 100);
    const boards = purchaseArea > 0 ? Math.ceil(purchaseArea / BOARD_AREA) : 0;

    return { netArea, purchaseArea, boards, faceCount, wastePercent };
  }, [faces, height, waste, width]);

  return (
    <section className="checkout-panel" aria-label="Calculadora de placas Durlock">
      <div className="section-head">
        <div>
          <span className="kicker">Calculadora FZAC</span>
          <h2><Calculator size={24} /> Estimá cuántas placas necesitás</h2>
          <p>Base de cálculo: placa de 1,20 m × 2,40 m. El resultado es orientativo y no reemplaza un cómputo de obra.</p>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Largo de pared (m)
          <input inputMode="decimal" value={width} onChange={(event) => setWidth(event.target.value)} />
        </label>
        <label>
          Alto de pared (m)
          <input inputMode="decimal" value={height} onChange={(event) => setHeight(event.target.value)} />
        </label>
        <label>
          Caras con placa
          <select value={faces} onChange={(event) => setFaces(event.target.value)}>
            <option value="1">1 cara</option>
            <option value="2">2 caras</option>
          </select>
        </label>
        <label>
          Margen por recortes (%)
          <input inputMode="decimal" value={waste} onChange={(event) => setWaste(event.target.value)} />
        </label>
      </div>

      <div className="checkout-confidence" style={{ marginTop: 22 }}>
        <div><span><strong>{result.netArea.toFixed(2)} m²</strong> de superficie neta</span></div>
        <div><span><strong>{result.purchaseArea.toFixed(2)} m²</strong> incluyendo margen</span></div>
        <div><span><strong>{result.boards} placas</strong> estimadas de 1,20 × 2,40 m</span></div>
      </div>

      <p className="checkout-summary__payment" style={{ marginTop: 18 }}>
        Puertas, ventanas, orientación de placa, modulación, doble emplacado y encuentros pueden modificar el consumo real.
      </p>

      <div className="legal-action-row" style={{ marginTop: 18 }}>
        <Link className="btn" href="/productos?search=placa+durlock">
          <ShoppingCart size={17} /> Ver placas Durlock
        </Link>
        <Link className="btn btn--ghost" href="/guias/materiales-pared-durlock">
          Ver lista completa de materiales
        </Link>
      </div>
    </section>
  );
}
