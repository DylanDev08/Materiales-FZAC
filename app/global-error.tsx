"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#090909", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "min(620px, 100%)", border: "1px solid #3b3310", borderRadius: 18, background: "#151515", padding: "clamp(24px, 6vw, 48px)" }}>
            <span style={{ color: "#f4c400", fontSize: 13, fontWeight: 800, letterSpacing: ".08em" }}>MATERIALES FZAC</span>
            <h1 style={{ margin: "14px 0 10px", fontSize: "clamp(2rem, 8vw, 4rem)", lineHeight: 1 }}>Pausa técnica.</h1>
            <p style={{ color: "#c6c6c6", lineHeight: 1.6 }}>La tienda tuvo una interrupción temporal. Reintentá para recuperar la navegación de forma segura.</p>
            <button type="button" onClick={reset} style={{ minHeight: 48, marginTop: 14, border: 0, borderRadius: 10, background: "#f4c400", color: "#090909", padding: "0 20px", fontWeight: 800, cursor: "pointer" }}>Reintentar</button>
          </div>
        </main>
      </body>
    </html>
  );
}
