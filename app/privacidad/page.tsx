import Image from "next/image";
import Link from "next/link";
import { LegalIdentity } from "@/components/legal/legal-identity";
import { CookieSettingsButton } from "@/components/privacy/cookie-settings-button";
import { getStoreLegalIdentity } from "@/lib/legal/store-identity";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Política de privacidad",
  description: "Cómo Materiales FZAC recopila, utiliza y protege los datos personales de clientes y visitantes.",
  path: "/privacidad"
});

export default function Page() {
  const identity = getStoreLegalIdentity();
  const privacyMail = `mailto:${identity.email}?subject=${encodeURIComponent("Solicitud sobre mis datos personales")}`;

  return (
    <main className="page-section legal-page">
      <div className="container">
        <header className="legal-page__head">
          <span className="legal-page__logo">
            <Image src="/logoFZAC.jpg" alt="Materiales FZAC" width={76} height={76} priority />
          </span>
          <div>
            <span className="kicker">Privacidad FZAC</span>
            <h1>Política de privacidad</h1>
            <p>Versión vigente desde el 11 de agosto de 2026. Información clara sobre el uso y protección de tus datos.</p>
          </div>
        </header>

        <nav className="legal-page__actions" aria-label="Acciones de privacidad">
          <a className="btn" href={privacyMail}>Ejercer mis derechos</a>
          <CookieSettingsButton className="btn btn--ghost" />
          <Link className="btn btn--ghost" href="/terminos">Términos y condiciones</Link>
          <Link className="btn btn--ghost" href="/contacto">Centro de ayuda</Link>
        </nav>

        <section>
          <h2>1. Responsable del tratamiento</h2>
          <LegalIdentity />
          <p>
            Este responsable decide para qué y cómo se tratan los datos personales vinculados con el sitio, las cuentas,
            los pedidos y la atención al consumidor.
          </p>

          <h2>2. Datos que podemos recopilar</h2>
          <ul className="legal-list">
            <li>Identificación y cuenta: nombre, email, teléfono, avatar y método de acceso.</li>
            <li>Compra y entrega: productos, cantidades, importes, domicilio, instrucciones y estado del pedido.</li>
            <li>Pago: identificadores, proveedor, importe y estado. FZAC no almacena tarjeta completa, vencimiento ni CVV.</li>
            <li>Atención: consultas, conversaciones, solicitudes de arrepentimiento, reclamos y resoluciones.</li>
            <li>Seguridad: IP, fecha, dispositivo, eventos técnicos y registros necesarios para prevenir abuso y fraude.</li>
          </ul>
          <p>
            No solicites ni escribas datos de tarjeta, contraseñas, códigos de verificación o información sensible en
            notas, chats o formularios de contacto.
          </p>

          <h2>3. Finalidades</h2>
          <p>
            Los datos se usan para autenticar usuarios, mantener el carrito y la cuenta, validar precios y stock, crear y
            entregar pedidos, procesar pagos, emitir constancias, responder consultas, gestionar cambios o devoluciones,
            cumplir obligaciones legales y mejorar la seguridad y funcionamiento del e-commerce.
          </p>
          <p>
            No se venderán bases de clientes ni se usarán datos para una finalidad incompatible sin informar y obtener
            el consentimiento que corresponda.
          </p>

          <h2>4. Base del tratamiento y datos obligatorios</h2>
          <p>
            El tratamiento se apoya, según el caso, en la ejecución de la compra o medidas previas solicitadas por el
            usuario, el consentimiento, el cumplimiento de obligaciones legales y la prevención razonable de fraude. Los
            campos obligatorios se limitan a los necesarios para cada flujo. No completar un dato necesario puede impedir
            crear la cuenta, coordinar la entrega o procesar el pedido.
          </p>

          <h2>5. Proveedores que intervienen</h2>
          <p>
            Para operar la tienda pueden intervenir Supabase en autenticación y base de datos, Render en alojamiento,
            Mercado Pago en pagos, Resend en email transaccional y Google en OAuth o mapas cuando esas funciones estén
            habilitadas. Cada proveedor recibe solo los datos necesarios para prestar su servicio y aplica sus propias
            condiciones de seguridad y privacidad.
          </p>
          <p>
            Algunos proveedores pueden procesar información fuera de Argentina. FZAC debe configurar esos servicios y
            sus contratos procurando niveles de protección compatibles con la Ley 25.326.
          </p>

          <h2>6. Conservación</h2>
          <p>
            Los datos se conservan durante el tiempo necesario para mantener la cuenta, completar operaciones, atender
            reclamos y cumplir plazos legales, fiscales, contables, de garantía y defensa del consumidor. Luego se eliminan,
            anonimizan o restringen, salvo que exista una obligación legal o un interés legítimo que exija conservarlos.
          </p>

          <h2>7. Tus derechos</h2>
          <p>
            Podés solicitar acceso a tus datos y pedir su rectificación, actualización, confidencialidad o supresión cuando
            corresponda. El acceso debe responderse dentro de diez (10) días corridos; la rectificación, actualización o
            supresión, dentro de cinco (5) días hábiles. La supresión puede limitarse si existe una obligación legal de
            conservar comprobantes u otros registros.
          </p>
          <p>
            Para ejercerlos, escribí a <a href={privacyMail}>{identity.email}</a> con el asunto “Solicitud sobre mis datos
            personales”. FZAC podrá pedir una verificación de identidad razonable para no entregar ni modificar datos de
            otra persona. Nunca se solicitará tu contraseña ni códigos de acceso.
          </p>

          <h2>8. Seguridad y acceso</h2>
          <p>
            La aplicación aplica autenticación, autorización server-side, reglas RLS por propietario, separación de claves
            públicas y privadas, validación de entradas, límites de solicitudes, trazabilidad administrativa y conexiones
            HTTPS. El acceso administrativo se limita a usuarios autorizados y los secretos no se envían al navegador.
          </p>
          <p>
            Ningún sistema elimina por completo el riesgo. Ante un incidente que pueda afectar derechos de clientes, FZAC
            deberá contenerlo, documentarlo y comunicar las medidas aplicables.
          </p>

          <h2>9. Cookies y almacenamiento local</h2>
          <p>
            El sitio utiliza cookies y almacenamiento del navegador necesarios para iniciar y proteger la sesión,
            conservar el carrito y evitar pedidos duplicados. Estos elementos técnicos son indispensables para prestar
            las funciones solicitadas y no se utilizan para publicidad.
          </p>
          <p>
            Con autorización opcional, FZAC puede recordar en este dispositivo búsquedas recientes y el historial local
            del asistente. Esa preferencia puede rechazarse o modificarse en cualquier momento desde “Preferencias de
            cookies” en el pie del sitio. Al desactivarla se eliminan del almacenamiento local esos datos opcionales.
          </p>
          <p>
            Actualmente no se encuentran activadas herramientas publicitarias ni analíticas de terceros. Si se incorporan,
            permanecerán bloqueadas hasta informar proveedor, finalidad, duración y obtener el consentimiento que corresponda.
            La aceptación de cookies es independiente de la aceptación de los términos de una cuenta o compra.
          </p>

          <h2>10. Reclamos ante la autoridad</h2>
          <p>
            Si una solicitud no recibe respuesta o la respuesta es insuficiente, podés acudir a la Agencia de Acceso a la
            Información Pública, autoridad de control de la Ley 25.326.
          </p>

          <aside className="legal-review-note">
            La política debe revisarse cuando cambien proveedores, finalidades, plazos de conservación o herramientas de
            analítica. Se recomienda validación legal final antes del lanzamiento productivo.
          </aside>

          <div className="legal-sources">
            <strong>Normativa y canales oficiales</strong>
            <a href="https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion" target="_blank" rel="noreferrer">Ley 25.326 de Protección de Datos Personales</a>
            <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noreferrer">Derechos de titulares de datos - AAIP</a>
            <a href="https://www.argentina.gob.ar/node/93199" target="_blank" rel="noreferrer">Canal de denuncias ante la AAIP</a>
          </div>
        </section>
      </div>
    </main>
  );
}
