import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const sections = [
  {
    title: "Dashboard",
    target: "Control general del negocio.",
    use: "Sirve para ver ingresos, egresos, pedidos, pagos, tickets y stock desde una sola pantalla. Es la primera vista que conviene revisar al abrir el panel."
  },
  {
    title: "Actividad",
    target: "Historial de lo que paso en la tienda.",
    use: "Muestra movimientos importantes: pagos, pedidos, stock, tickets, logins y avisos. Se usa para entender que ocurrio sin leer datos tecnicos."
  },
  {
    title: "Pedidos",
    target: "Gestion de compras de clientes.",
    use: "Desde aca se revisan pedidos pendientes, aprobados, rechazados o para coordinar. Es el lugar para confirmar compras y hacer seguimiento."
  },
  {
    title: "Pagos",
    target: "Control de cobros.",
    use: "Permite ver si un pago fue aprobado, quedo pendiente, fue rechazado o se coordina por transferencia/WhatsApp."
  },
  {
    title: "Tickets",
    target: "Comprobantes internos de compra.",
    use: "Cada compra confirmada puede generar un comprobante FZAC. Esta seccion ayuda a ubicar tickets emitidos y revisar su estado."
  },
  {
    title: "Clientes",
    target: "Personas registradas y compradores.",
    use: "Sirve para buscar clientes, revisar contacto, compras, pagos, tickets y datos utiles para atencion o entrega."
  },
  {
    title: "Productos",
    target: "Catálogo comercial.",
    use: "Desde aca se cargan productos, precios, fotos, stock, ofertas y destacados. Es clave mantenerlo actualizado."
  },
  {
    title: "Inventario",
    target: "Stock, demanda y reposicion.",
    use: "Ordena los productos por urgencia usando ventas confirmadas, cobertura y pedidos pendientes. La compra sugerida es una ayuda: nunca cambia stock ni publica una orden automaticamente."
  },
  {
    title: "Comprobantes de pago",
    target: "Revisión del proveedor de pagos.",
    use: "Muestra eventos de Mercado Pago y otros medios. Se usa cuando un cobro necesita verificacion."
  },
  {
    title: "Ingresos y egresos",
    target: "Control de caja y gastos operativos.",
    use: "Registra gastos y otros ingresos que no provienen de ventas online. Las ventas pagadas se incorporan solas; no deben cargarse otra vez."
  },
  {
    title: "Arrepentimientos",
    target: "Solicitudes de devolución o revisión del consumidor.",
    use: "Permite recibir, revisar y responder cada trámite con número de seguimiento. Aprobar una solicitud no devuelve dinero: si corresponde, el reembolso se procesa después desde Pagos."
  },
  {
    title: "Conocimiento IA",
    target: "Respuestas verificadas del asistente FZAC.",
    use: "Permite crear, editar, publicar o pausar respuestas comerciales sin tocar código. Cada cambio conserva una versión anterior y los votos de clientes ayudan a detectar qué contenido necesita revisión."
  },
  {
    title: "Calidad IA",
    target: "Revision humana de respuestas dudosas.",
    use: "Reune votos negativos, conversaciones sin resolver y respuestas con poca seguridad. Resolver una revision no publica cambios: primero hay que verificar la informacion y luego editar Conocimiento IA."
  },
  {
    title: "Precios de mercado",
    target: "Referencias privadas para decidir precios.",
    use: "Permite registrar fuentes y valores comparables por unidad. El asistente solo informa una referencia cuando hay al menos dos fuentes vigentes y verificadas. Esta seccion nunca cambia el precio publicado de FZAC."
  },
  {
    title: "Ajustes",
    target: "Configuracion del panel.",
    use: "Reservado para opciones administrativas. No cambiar ajustes sensibles sin revisar variables de entorno y seguridad."
  }
];

const routines = [
  "Abrir Dashboard y revisar ingresos, pendientes y alertas.",
  "Entrar en Pedidos para preparar, aprobar o coordinar compras.",
  "Revisar Pagos si hay cobros pendientes o rechazados.",
  "Revisar Arrepentimientos y responder primero los trámites nuevos.",
  "Ver Inventario, revisar cobertura y confirmar manualmente cada reposicion sugerida.",
  "Usar Clientes para contactar compradores y resolver dudas.",
  "Revisar Conocimiento IA cuando aumenten las respuestas marcadas para mejorar.",
  "Abrir Calidad IA, priorizar los casos urgentes y documentar la decision antes de modificar una respuesta.",
  "Revisar Precios de mercado antes de tomar decisiones comerciales; nunca copiar un valor sin confirmar presentacion, IVA, fecha y unidad.",
  "Consultar Actividad si algo no coincide."
];

export default async function Page() {
  await requireAdmin();

  return (
    <AdminShell title="Guia del panel" description="Documentacion interna para usar cada seccion administrativa de FZAC.">
      <section className="admin-docs-page">
        <article className="admin-docs-hero">
          <span className="kicker">Uso interno</span>
          <h2>Para que sirve este panel</h2>
          <p>
            Este panel esta pensado para administrar ventas, pagos, clientes, tickets, productos y stock sin usar datos
            tecnicos. Cada seccion tiene una funcion concreta y conviene usarlo como sistema de trabajo diario.
          </p>
        </article>

        <section className="admin-docs-routine">
          <h3>Rutina recomendada</h3>
          <ol>
            {routines.map((routine) => (
              <li key={routine}>{routine}</li>
            ))}
          </ol>
        </section>

        <section className="admin-docs-grid" aria-label="Documentacion de secciones admin">
          {sections.map((section) => (
            <article key={section.title}>
              <span>{section.target}</span>
              <h3>{section.title}</h3>
              <p>{section.use}</p>
            </article>
          ))}
        </section>

        <section className="admin-docs-note">
          <strong>Importante</strong>
          <p>
            Los datos tecnicos, IDs internos, credenciales y configuraciones sensibles no deben compartirse con clientes.
            Si un dato parece de prueba, revisalo antes de aprobar pedidos o emitir comprobantes definitivos.
          </p>
        </section>
      </section>
    </AdminShell>
  );
}
