import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  Truck
} from "lucide-react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { getProducts } from "@/lib/db/catalog";
import { getWhatsAppHref } from "@/lib/utils/contact";

export async function HomePage() {
  const [featured, offers] = await Promise.all([
    getProducts({ featured: true, limit: 4 }),
    getProducts({ onSale: true, limit: 4 })
  ]);
  const materialHelpHref = getWhatsAppHref("Hola FZAC, no encuentro un material en la tienda y necesito asesoramiento.");
  const spotlightProducts = [...offers, ...featured]
    .filter((product, index, list) => list.findIndex((item) => item.id === product.id) === index)
    .slice(0, 4);
  const buyingNeeds = [
    { label: "Materiales de obra", helper: "Cemento, cal, arena, piedra, hierro y ladrillos.", href: "/productos?search=cemento" },
    { label: "Construcción en seco", helper: "Placas, perfiles, masillas, tornillos y aislantes.", href: "/productos?search=durlock" },
    { label: "Ferretería", helper: "Tornillería, adhesivos, fijaciones y accesorios.", href: "/productos?search=ferreteria" },
    { label: "Herramientas", helper: "Manuales, eléctricas y consumibles para obra.", href: "/productos?search=herramientas" },
    { label: "Electricidad", helper: "Cables, cajas, llaves, tomas y canalización.", href: "/productos?search=electricidad" },
    { label: "Plomería", helper: "Caños, conexiones, adhesivos y accesorios sanitarios.", href: "/productos?search=plomeria" },
    { label: "Pintura e impermeabilización", helper: "Látex, membranas, rodillos y preparadores.", href: "/productos?search=pintura" },
    { label: "Revestimientos", helper: "Pegamentos, pastinas, placas y terminaciones.", href: "/productos?search=revestimientos" }
  ];

  return (
    <>
      <section className="home-promo" aria-label="Beneficios de compra">
        <div className="container home-promo__inner">
          <span>
            <Truck size={18} /> Envíos coordinados
          </span>
          <span>
            <Package size={18} /> Retiro coordinado
          </span>
          <span>
            <ShieldCheck size={18} /> Orden segura
          </span>
          <span>
            <ShieldCheck size={18} /> Stock validado al comprar
          </span>
        </div>
      </section>

      <section className="home-hero home-hero--clean">
        <div className="container home-hero__grid home-hero__grid--single">
          <div className="home-hero__content home-hero__content--wide">
            <span className="kicker">E-Commerce FZAC</span>
            <h1>Comprá materiales para obra con stock visible y atención FZAC.</h1>
            <p>
              Buscá por material, armá tu pedido y elegí cómo pagar o coordinar. FZAC valida stock, precios y datos
              antes de confirmar la compra.
            </p>
            <form className="hero-search" action="/productos">
              <Search size={20} />
              <input name="search" placeholder="¿Qué material necesitás hoy?" aria-label="Buscar materiales" />
              <button className="btn" type="submit">
                Buscar
              </button>
            </form>
            <div className="hero-actions">
              <Link className="btn" href="/catalogo">
                Comprar materiales <ArrowRight size={18} />
              </Link>
              <Link className="btn btn--ghost" href="/ofertas">
                Ver ofertas
              </Link>
              <a className="btn btn--ghost" href={materialHelpHref} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> ¿No encontrás un material?
              </a>
            </div>
            <div className="home-trust-row" aria-label="Garantias de compra FZAC">
              <span>
                <Truck size={18} />
                Entrega o retiro coordinado
              </span>
              <span>
                <ShieldCheck size={18} />
                Stock validado antes de confirmar
              </span>
              <span>
                <BadgeCheck size={18} />
                Comprobante y seguimiento
              </span>
              <span>
                <MessageCircle size={18} />
                Asistencia por WhatsApp
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container">
          <SectionHeader
            eyebrow="Rubros"
            title="Comprar por necesidad"
            text="Entrá directo al material que necesitás sin recorrer secciones de más."
            action={
              <Link className="btn btn--ghost" href="/categorias">
                Ver rubros
              </Link>
            }
          />
          <div className="home-floating-rubros">
            {buyingNeeds.map((need) => (
              <Link className="home-need-link" href={need.href} key={need.label}>
                <span>
                  <Package size={18} />
                </span>
                <strong>{need.label}</strong>
                <small>{need.helper}</small>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container home-steps-band home-steps-band--five" aria-label="Proceso de compra FZAC">
          <div className="home-step-item">
            <Search size={22} />
            <span>1</span>
            <strong>Elegís productos</strong>
            <small>Buscás por rubro, oferta o nombre.</small>
          </div>
          <div className="home-step-item">
            <ShieldCheck size={22} />
            <span>2</span>
            <strong>Confirmás datos</strong>
            <small>Cargás comprador, retiro o envío.</small>
          </div>
          <div className="home-step-item">
            <BadgeCheck size={22} />
            <span>3</span>
            <strong>Validamos stock</strong>
            <small>FZAC revisa productos y cantidades.</small>
          </div>
          <div className="home-step-item">
            <ShieldCheck size={22} />
            <span>4</span>
            <strong>Pagás o coordinás</strong>
            <small>Mercado Pago, transferencia o WhatsApp.</small>
          </div>
          <div className="home-step-item">
            <Truck size={22} />
            <span>5</span>
            <strong>Retirás o recibís</strong>
            <small>Entrega y retiro se coordinan con FZAC.</small>
          </div>
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container banner-band banner-band--commercial">
          <div>
            <span className="kicker">Asesoramiento FZAC</span>
            <h2>¿No encontrás un material?</h2>
            <p>Pedí asesoramiento a FZAC por WhatsApp para elegir medidas, cantidades o alternativas disponibles.</p>
          </div>
          <a className="btn" href={materialHelpHref} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> Consultar
          </a>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <SectionHeader
            eyebrow="Vidriera FZAC"
            title="Productos para empezar el pedido"
            text="Selección corta, rápida de escanear y lista para sumar al carrito."
            action={
              <Link className="btn btn--ghost" href="/productos">
                Catálogo completo
              </Link>
            }
          />
          <ProductGrid products={spotlightProducts} variant="rail" />
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container home-legal-row">
          <div>
            <span className="kicker">Derecho del consumidor</span>
            <strong>Compra clara, cambios y devoluciones disponibles.</strong>
            <p>Consulta condiciones legales, plazos y requisitos antes de confirmar tu pedido.</p>
          </div>
          <Link className="btn btn--ghost" href="/cambios-y-devoluciones">
            Ver política
          </Link>
        </div>
      </section>
    </>
  );
}
