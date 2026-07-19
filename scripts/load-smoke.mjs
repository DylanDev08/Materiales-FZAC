import { performance } from "node:perf_hooks";

const baseUrl = new URL(process.argv[2] || process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000");
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

if (!loopbackHosts.has(baseUrl.hostname) && process.env.ALLOW_REMOTE_LOAD_TEST !== "true") {
  throw new Error("La prueba de carga solo acepta localhost. Usa ALLOW_REMOTE_LOAD_TEST=true para un destino autorizado.");
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

async function runSuite({ name, count, allowedStatuses, request }) {
  const results = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const startedAt = performance.now();
      try {
        const response = await request(index);
        await response.arrayBuffer();
        return {
          status: response.status,
          elapsed: performance.now() - startedAt,
          retryAfter: response.headers.get("retry-after")
        };
      } catch (error) {
        return {
          status: 0,
          elapsed: performance.now() - startedAt,
          retryAfter: null,
          error: error instanceof Error ? error.message : "Error de red"
        };
      }
    })
  );

  const counts = results.reduce((summary, result) => {
    summary[result.status] = (summary[result.status] ?? 0) + 1;
    return summary;
  }, {});
  const elapsed = results.map((result) => result.elapsed);
  const invalid = results.filter((result) => !allowedStatuses.has(result.status));
  const missingRetryAfter = results.filter((result) => result.status === 429 && !result.retryAfter);

  console.log(
    `${name}: ${count} solicitudes | estados ${JSON.stringify(counts)} | p50 ${percentile(elapsed, 0.5).toFixed(1)} ms | p95 ${percentile(elapsed, 0.95).toFixed(1)} ms | max ${Math.max(...elapsed).toFixed(1)} ms`
  );

  if (invalid.length) {
    throw new Error(`${name} devolvio ${invalid.length} respuestas inesperadas: ${JSON.stringify(invalid.slice(0, 3))}`);
  }
  if (missingRetryAfter.length) {
    throw new Error(`${name} devolvio 429 sin cabecera Retry-After.`);
  }
}

const headers = { "Content-Type": "application/json", "x-fzac-load-test": "readonly" };

await runSuite({
  name: "Busqueda",
  count: 100,
  allowedStatuses: new Set([200, 429]),
  request: (index) => fetch(new URL(`/api/search/suggestions?q=${index % 2 ? "cemento" : "pintura"}`, baseUrl))
});

await runSuite({
  name: "Validacion de carrito",
  count: 80,
  allowedStatuses: new Set([422, 429]),
  request: () => fetch(new URL("/api/cart/validate", baseUrl), { method: "POST", headers, body: JSON.stringify({ items: [] }) })
});

if (process.env.ASSISTANT_PERSISTENCE_ENABLED === "false") {
  await runSuite({
    name: "Asistente sin persistencia",
    count: 50,
    allowedStatuses: new Set([200, 429]),
    request: (index) =>
      fetch(new URL("/api/assistant", baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: index % 2 ? "Hola" : "Quiero consultar medios de pago",
          visitorId: crypto.randomUUID(),
          history: []
        })
      })
  });
} else {
  console.log("Asistente: omitido. Define ASSISTANT_PERSISTENCE_ENABLED=false en servidor y script para probarlo sin escrituras.");
}

console.log("Smoke de concurrencia finalizado sin respuestas 500 ni escrituras intencionales.");
