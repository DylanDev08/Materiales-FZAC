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
    { label: "Materiales de obra", helper: "Cemento, cal, arena, piedra, hierro y ladrillos.", href: "/productos?search=cemento" },
    { label: "Construccion en seco", helper: "Placas, perfiles, masillas, tornillos y aislantes.", href: "/productos?search=durlock" },
    { label: "Ferreteria", helper: "Tornilleria, adhesivos, fijaciones y accesorios.", href: "/productos?search=ferreteria" },
    { label: "Herramientas", helper: "Manuales, electricas y consumibles para obra.", href: "/productos?search=herramientas" },
    { label: "Electricidad", helper: "Cables, cajas, llaves, tomas y canalizacion.", href: "/productos?search=electricidad" },
    { label: "Plomeria", helper: "Canos, conexiones, adhesivos y accesorios sanitarios.", href: "/productos?search=plomeria" },
    { label: "Pintura e impermeabilizacion", helper: "Latex, membranas, rodillos y preparadores.", href: "/productos?search=pintura" },
    { label: "Revestimientos", helper: "Pegamentos, pastinas, placas y terminaciones.", href: "/productos?search=revestimientos" }
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
            <h1>Compra materiales para obra con stock visible y atencion FZAC.</h1>
            <p>
              Busca por material, arma tu pedido y elegi como pagar o coordinar. FZAC valida stock, precios y datos
              antes de confirmar la compra.
            </p>
            <form className="hero-search" action="/productos">
              <Search size={20} />
              <input name="search" placeholder="Que material necesitas hoy?" aria-label="Buscar materiales" />
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
                <MessageCircle size={18} /> No encontras un material?
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
            title="Comprar por rubro"
            text="La tienda esta ordenada como un corralon digital: elegi el tipo de material y arma tu pedido."
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
        <div className="container home-steps-band home-steps-band--five" aria-label="Proceso de compra FZAC">
          <div className="home-step-item">
            <Search size={22} />
            <span>1</span>
            <strong>Elegis productos</strong>
            <small>Buscas por rubro, oferta o nombre.</small>
          </div>
          <div className="home-step-item">
            <ShieldCheck size={22} />
            <span>2</span>
            <strong>Confirmas datos</strong>
            <small>Cargamos comprador, retiro o envio.</small>
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
            <strong>Pagas o coordinas</strong>
            <small>Mercado Pago, transferencia o WhatsApp.</small>
          </div>
          <div className="home-step-item">
            <Truck size={22} />
            <span>5</span>
            <strong>Retiras o recibis</strong>
            <small>Entrega y retiro se coordinan con FZAC.</small>
          </div>
        </div>
      </section>

      <section className="page-section page-section--tight">
        <div className="container banner-band banner-band--commercial">
          <div>
            <span className="kicker">Asesoramiento FZAC</span>
            <h2>No encontras un material?</h2>
            <p>Pedi asesoramiento a FZAC por WhatsApp para elegir medidas, cantidades o alternativas disponibles.</p>
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
            text="Una seleccion corta para comprar rapido. El catalogo completo queda a un click."
            action={
              <Link className="btn btn--ghost" href="/productos">
                Catalogo completo
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
            <p>Consulta condiciones legales, plazos y requisitos antes de confirmar tu pedido.</p>
          </div>
          <Link className="btn btn--ghost" href="/cambios-y-devoluciones">
            Ver politica
          </Link>
        </div>
      </section>
    </>
  );
}
