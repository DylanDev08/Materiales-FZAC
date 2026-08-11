import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  CreditCard,
  Droplets,
  Hammer,
  Headphones,
  Layers3,
  MessageCircle,
  PaintRoller,
  PanelsTopLeft,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wrench,
  Zap
} from "lucide-react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { getProducts } from "@/lib/db/catalog";
import { getWhatsAppHref } from "@/lib/utils/contact";

const buyingNeeds = [
  { label: "Materiales de obra", helper: "Cemento, cal y áridos", href: "/productos?search=cemento", icon: Building2 },
  { label: "Construcción en seco", helper: "Placas y perfiles", href: "/productos?search=durlock", icon: PanelsTopLeft },
  { label: "Ferretería", helper: "Fijaciones y adhesivos", href: "/productos?search=ferreteria", icon: Wrench },
  { label: "Herramientas", helper: "Manuales y eléctricas", href: "/productos?search=herramientas", icon: Hammer },
  { label: "Electricidad", helper: "Cables y canalización", href: "/productos?search=electricidad", icon: Zap },
  { label: "Plomería", helper: "Caños y conexiones", href: "/productos?search=plomeria", icon: Droplets },
  { label: "Pintura", helper: "Látex e impermeabilización", href: "/productos?search=pintura", icon: PaintRoller },
  { label: "Revestimientos", helper: "Pegamentos y terminaciones", href: "/productos?search=revestimientos", icon: Layers3 }
];

export async function HomePage() {
  const [featured, offers] = await Promise.all([
    getProducts({ featured: true, limit: 8 }),
    getProducts({ onSale: true, limit: 8 })
  ]);
  const materialHelpHref = getWhatsAppHref("Hola FZAC, no encuentro un material en la tienda y necesito asesoramiento.");
  const offerShelf = (offers.length ? offers : featured).slice(0, 8);
  const featuredShelf = featured.filter((product) => !offerShelf.some((item) => item.id === product.id)).slice(0, 8);

  return (
    <>
      <section className="home-promo storefront-promo" aria-label="Beneficios de compra">
        <div className="container home-promo__inner">
          <span><Truck size={18} /> Envíos coordinados</span>
          <span><ShieldCheck size={18} /> Compra protegida</span>
          <span><BadgeCheck size={18} /> Stock validado</span>
          <Link href="/arrepentimiento" prefetch={false}><RotateCcw size={18} /> Botón de arrepentimiento</Link>
        </div>
      </section>

      <section className="storefront-hero">
        <div className="container storefront-hero__inner">
          <div className="storefront-hero__content">
            <span className="storefront-hero__eyebrow">Fortaleza Construcciones</span>
            <h1>Todo para tu obra, en un solo lugar.</h1>
            <p>Materiales, herramientas y soluciones con precios claros, stock visible y atención de FZAC.</p>
            <div className="storefront-hero__actions">
              <Link className="btn" href="/productos" prefetch={false}>
                Comprar ahora <ArrowRight size={18} />
              </Link>
              <Link className="btn btn--ghost" href="/ofertas" prefetch={false}>Ver ofertas</Link>
            </div>
            <div className="storefront-hero__facts" aria-label="Condiciones de compra">
              <span><BadgeCheck size={17} /> Stock validado</span>
              <span><CreditCard size={17} /> Pago seguro</span>
              <span><Truck size={17} /> Entrega coordinada</span>
            </div>
          </div>
        </div>
      </section>

      <section className="storefront-section storefront-categories">
        <div className="container">
          <SectionHeader
            eyebrow="Categorías"
            title="Encontrá lo que necesitás"
            text="Accesos directos a los rubros principales de la tienda."
            action={<Link className="btn btn--ghost" href="/categorias" prefetch={false}>Ver todas <ArrowRight size={16} /></Link>}
          />
          <div className="storefront-category-rail">
            {buyingNeeds.map(({ href, icon: Icon, label, helper }) => (
              <Link className="storefront-category" href={href} key={label} prefetch={false}>
                <span className="storefront-category__icon"><Icon size={22} /></span>
                <strong>{label}</strong>
                <small>{helper}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="storefront-section storefront-shelf">
        <div className="container">
          <SectionHeader
            eyebrow="Precios destacados"
            title={offers.length ? "Ofertas para aprovechar" : "Productos destacados"}
            text="Sumá materiales al carrito sin perder de vista precio y disponibilidad."
            action={<Link className="storefront-section-link" href={offers.length ? "/ofertas" : "/productos"} prefetch={false}>Ver más <ChevronRight size={17} /></Link>}
          />
          <ProductGrid products={offerShelf} variant="rail" />
        </div>
      </section>

      <section className="storefront-benefits" aria-label="Servicios FZAC">
        <div className="container storefront-benefits__grid">
          <div><ShieldCheck size={22} /><span><strong>Compra protegida</strong><small>Validamos precio y stock.</small></span></div>
          <div><Truck size={22} /><span><strong>Entrega o retiro</strong><small>Coordinación según tu pedido.</small></span></div>
          <div><CreditCard size={22} /><span><strong>Medios de pago</strong><small>Online, transferencia o coordinación.</small></span></div>
          <div><Headphones size={22} /><span><strong>Atención FZAC</strong><small>Ayuda antes y después de comprar.</small></span></div>
        </div>
      </section>

      {featuredShelf.length ? (
        <section className="storefront-section storefront-shelf">
          <div className="container">
            <SectionHeader
              eyebrow="Selección FZAC"
              title="Recomendados para tu obra"
              text="Productos elegidos por disponibilidad y utilidad en proyectos frecuentes."
              action={<Link className="storefront-section-link" href="/productos?featured=true" prefetch={false}>Ver más <ChevronRight size={17} /></Link>}
            />
            <ProductGrid products={featuredShelf} variant="rail" />
          </div>
        </section>
      ) : null}

      <section className="storefront-section storefront-projects">
        <div className="container storefront-projects__layout">
          <div className="storefront-projects__intro">
            <span className="kicker">Compra simple</span>
            <h2>De la lista de materiales al pedido confirmado.</h2>
            <p>Un proceso claro, con validación real y asistencia cuando la necesitás.</p>
            <Link className="btn btn--ghost" href="/como-comprar" prefetch={false}>Cómo comprar <ArrowRight size={17} /></Link>
          </div>
          <ol className="storefront-projects__steps">
            <li><span>1</span><div><strong>Elegí</strong><small>Buscá por producto, rubro u oferta.</small></div></li>
            <li><span>2</span><div><strong>Revisá</strong><small>Confirmá cantidades y forma de entrega.</small></div></li>
            <li><span>3</span><div><strong>Pagá o coordiná</strong><small>Elegí el medio que mejor se adapte.</small></div></li>
            <li><span>4</span><div><strong>Recibí</strong><small>Seguí el pedido desde tu cuenta.</small></div></li>
          </ol>
        </div>
      </section>

      <section className="storefront-section storefront-support">
        <div className="container storefront-support__inner">
          <div>
            <span className="kicker">Asesoramiento comercial</span>
            <h2>¿No encontrás el material o la medida?</h2>
            <p>Contanos qué estás construyendo y te ayudamos a completar el pedido.</p>
          </div>
          <a className="btn" href={materialHelpHref} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> Consultar por WhatsApp
          </a>
        </div>
      </section>

      <section className="storefront-legal-strip">
        <div className="container">
          <span><ShieldCheck size={17} /> Tus derechos de compra siempre visibles.</span>
          <Link href="/cambios-y-devoluciones" prefetch={false}>Cambios y devoluciones</Link>
          <Link href="/arrepentimiento" prefetch={false}>Botón de arrepentimiento</Link>
        </div>
      </section>
    </>
  );
}
