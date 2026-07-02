export default function Page() {
  return (
    <main className="page-section legal-page">
      <div className="container">
        <span className="kicker">Logistica</span>
        <h1>Envios y retiros</h1>
        <section>
          <p>
            FZAC permite retiro coordinado y envio dentro de la zona validada hasta 30 km desde Rosario, Santa Fe,
            Argentina. La distancia se calcula server-side con Google Maps cuando la API esta configurada.
          </p>
          <p>
            Si la direccion queda fuera de zona, el checkout permite retiro o contacto comercial para una cotizacion
            especial.
          </p>
        </section>
      </div>
    </main>
  );
}
