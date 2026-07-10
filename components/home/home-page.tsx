import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Grid3X3,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  Truck
} from "lucide-react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { getCategories, getProducts } from "@/lib/db/catalog";
import { getWhatsAppHref } from "@/lib/utils/contact";

export async function HomePage() {
  const [categories, featured, offers] = await Promise.all([
    getCategories(),
    getProducts({ featured: true, limit: 4 }),
    getProducts({ onSale: true, limit: 4 })
  ]);
  const materialHelpHref = getWhatsAppHref("Hola FZAC, no encuentro un material en la tienda y necesito asesoramiento.");
  const spotlightProducts = [...offers, ...featured]
    .filter((product, index, list) => list.findIndex((item) => item.id === product.id) === index)
    .slice(0, 4);
  const buyingNeeds = [
    {
      label: "Levantar pared",
      helper: "Cemento, cal, ladrillos, arena y hierro.",
      href: "/productos?search=cemento"
    },
    {
      label: "Cerrar una habitacion",
      helper: "Durlock, perfileria, masilla, tornillos y aislantes.",
      href: "/productos?search=durlock"
    },
    {
      label: "Pintar o renovar",
      helper: "Latex, esmaltes, pinceles, rodillos y preparadores.",
      href: "/productos?search=latex"
    },
    {
      label: "Instalar o reparar",
      helper: "Electricidad, plomeria, adhesivos y accesorios.",
      href: "/productos?search=accesorios"
    }
  ];

  return (
    <>
      <section className="home-promo" aria-label="Beneficios de compra">
        <div className="container home-promo__inner">
          <span>
            <Truck size={18} /> Envios coordinados
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
            <h1>Compra materiales de obra con claridad desde el primer click.</h1>
            <p>
              Buscá por material, armá el pedido, validá stock y elegí cómo pagar o coordinar con FZAC. Todo pensado
              para comprar rápido, sin perder de vista precios, cantidades y seguimiento.
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
                Comprar ahora <ArrowRight size={18} />
              </Link>
              <Link className="btn btn--ghost" href="/ofertas">
                Ver ofertas
              </Link>
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
        <div className="container category-strip">
          <Link className="category-strip__all" href="/categorias">
            <Grid3X3 size={20} />
            Todos los rubros
          </Link>
          {categories.slice(0, 8).map((category) => (
            <Link href={`/categoria/${category.slug}`} key={category.id}>
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <SectionHeader
            eyebrow="Compra guiada"
            title="Elegí según lo que tenés que resolver"
            text="Accesos simples para que el cliente no tenga que conocer nombres técnicos antes de empezar el pedido."
            action={
              <Link className="btn btn--ghost" href="/categorias">
                Ver rubros
              </Link>
            }
          />
          <div className="home-need-list">
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
        <div className="container home-steps-band" aria-label="Proceso de compra FZAC">
          <div className="home-step-item">
            <Search size={22} />
            <span>1</span>
            <strong>Buscás</strong>
            <small>Encontrá el material por rubro, oferta o nombre.</small>
          </div>
          <div className="home-step-item">
            <ShieldCheck size={22} />
            <span>2</span>
            <strong>Confirmás</strong>
            <small>Revisamos stock, cantidades y datos del pedido.</small>
          </div>
          <div className="home-step-item">
            <MessageCircle size={22} />
            <span>3</span>
            <strong>Pagás o coordinás</strong>
            <small>Mercado Pago, transferencia o coordinación por WhatsApp.</small>
          </div>
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container banner-band banner-band--commercial">
          <div>
            <span className="kicker">Asesoramiento FZAC</span>
            <h2>¿No encontrás un material?</h2>
            <p>Consultá por WhatsApp y el equipo te ayuda a elegir medidas, cantidades o alternativas disponibles.</p>
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
            text="Una selección corta para no saturar la pantalla principal. El catálogo completo queda a un click."
            action={
              <Link className="btn btn--ghost" href="/productos">
                Catálogo completo
              </Link>
            }
          />
          <ProductGrid products={spotlightProducts} />
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container home-legal-row">
          <div>
            <span className="kicker">Derecho del consumidor</span>
            <strong>Compra clara, cambios y devoluciones disponibles.</strong>
            <p>Consultá condiciones legales, plazos y requisitos antes de confirmar tu pedido.</p>
          </div>
          <Link className="btn btn--ghost" href="/cambios-y-devoluciones">
            Ver política
          </Link>
        </div>
      </section>
    </>
  );
}
