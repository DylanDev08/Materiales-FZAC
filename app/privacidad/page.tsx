export default function Page() {
  return (
    <main className="page-section legal-page">
      <div className="container">
        <span className="kicker">Legal</span>
        <h1>Politica de privacidad</h1>
        <section>
          <p>
            FZAC usa los datos de cuenta, contacto, direccion, pedidos y conversaciones para operar la tienda, coordinar
            entregas, responder consultas y cumplir obligaciones comerciales.
          </p>
          <p>
            Las claves privadas, service role, tokens de pago y claves server-side nunca se exponen al cliente. Los datos
            se protegen con RLS en Supabase y validaciones server-side.
          </p>
          <p>
            Los pagos se procesan por proveedores externos. FZAC no guarda tarjetas ni CVV. Las conversaciones del
            asistente pueden almacenarse para seguimiento comercial y mejora de atencion.
          </p>
        </section>
      </div>
    </main>
  );
}
