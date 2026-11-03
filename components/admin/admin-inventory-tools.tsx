"use client";

import { useState } from "react";
import { AdminInventoryLocations } from "@/components/admin/admin-inventory-locations";
import { AdminInventoryForecast } from "@/components/admin/admin-inventory-forecast";

/**
 * El panel cotidiano no consulta depósitos ni pronósticos hasta que alguien
 * abre esas herramientas. Los componentes existentes conservan sus API.
 */
export function AdminInventoryTools({ adminPath }: { adminPath: string }) {
  const [showLocations, setShowLocations] = useState(false);
  const [showForecast, setShowForecast] = useState(false);

  return (
    <>
      <details
        className="admin-focus-details admin-focus-details--section"
        onToggle={(event) => {
          if (event.currentTarget.open) setShowLocations(true);
        }}
      >
        <summary>Stock por depósito y movimientos internos</summary>
        {showLocations ? <AdminInventoryLocations /> : null}
      </details>
      <details
        className="admin-focus-details admin-focus-details--section"
        onToggle={(event) => {
          if (event.currentTarget.open) setShowForecast(true);
        }}
      >
        <summary>Pronóstico y análisis de reposición</summary>
        {showForecast ? <AdminInventoryForecast adminPath={adminPath} /> : null}
      </details>
    </>
  );
}
