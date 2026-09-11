import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Hammer,
  Headphones,
  Layers3,
  MessageCircle,
  PanelsTopLeft,
  Ruler,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wrench
} from "lucide-react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { getProducts } from "@/lib/db/catalog";
import { getWhatsAppHref } from "@/lib/utils/contact";

const primaryCategories = [
  { label: "Construcción en Seco", helper: "Placas, perfiles, masillas y terminaciones", href: "/categoria/construccion-en-seco", icon: PanelsTopLeft },
  { label: "Steel Framing", helper: "Estructuras y soluciones para sistemas exteriores", href: "/categoria/steel-framing", icon: Layers3 },
  { label: "Ferretería", helper: "Tornillos, tarugos y fijaciones", href: "/categoria/ferreteria", icon: Wrench }
];

const buyingNeeds = [
  { label: "Hacer una pared de Durlock", helper: "Placas, perfiles, masilla y cinta", href: "/productos?search=durlock", icon: Ruler },
  { label: "Construir con Steel Framing", helper: "Perfiles PGC/PGU y placas exteriores", href: "/categoria/steel-framing", icon: Layers3 },
  { label: "Colocar cielorraso", helper: "Placas, PVC y perfilería", href: "/productos?search=cielorraso", icon: PanelsTopLeft },
  { label: "Comprar placas", helper: "Compará medidas y prestaciones", href: "/productos?search=placa", icon: PanelsTopLeft },
  { label: "Buscar perfiles", helper: "Montantes, soleras y perfiles", href: "/productos?search=perfil", icon: Hammer }
];

export async function HomePage() {
  const products = await getProducts({ limit: 12, order: "newest" });
  const materialHelpHref = getWhatsAppHref("Hola FZAC, no encuentro un material en la tienda y necesito asesoramiento.");
  const productShelf = products.slice(0, 10);

  return (
    <>
      <section className="home-promo storefront-promo" aria-label="Beneficios de compra">
        <div className="container home-promo__inner">
          <span><Truck size={18} /> Envíos y retiro coordinados</span>
          <span><ShieldCheck size={18} /> Compra protegida</span>
          <span><BadgeCheck size={18} /> Disponibilidad confirmada</span>
          <Link href="/arrepentimiento" prefetch={false}><RotateCcw size={18} /> Botón de arrepentimiento</Link>
        </div>
      </section>

      <section className="storefront-hero">
        <div className="container storefront-hero__inner">
          <div className="storefront-hero__content">
            <span className="storefront-hero__eyebrow">Materiales FZAC · Rosario</span>
            <h1>Todo para construir en seco, en un solo lugar.</h1>
            <p>Materiales para construcción en seco, steel framing y ferretería, con precios online, carrito y asesoramiento.</p>
            <div className="storefront-hero__actions">
              <Link className="btn" href="/productos" prefetch={false}>
                Ver productos <ArrowRight size={18} />
              </Link>
              <a className="btn btn--ghost" href={materialHelpHref} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> Consultar por WhatsApp
              </a>
            </div>
            <div className="storefront-hero__facts" aria-label="Condiciones de compra">
              <span><BadgeCheck size={17} /> Disponibilidad real</span>
              <span><CreditCard size={17} /> Pago seguro</span>
              <span><Truck size={17} /> Entrega coordinada</span>
            </div>
          </div>
        </div>
      </section>

      <section className="storefront-section storefront-shelf">
        <div className="container">
          <SectionHeader
            eyebrow="Catálogo FZAC"
            title="Productos para avanzar con tu obra"
            text="Precios finales FZAC y disponibilidad indicada en cada producto."
            action={<Link className="storefront-section-link" href="/productos" prefetch={false}>Ver todos <ChevronRight size={17} /></Link>}
          />
          <ProductGrid products={productShelf} variant="rail" />
        </div>
      </section>

      <section className="storefront-section storefront-categories">
        <div className="container">
          <SectionHeader
            eyebrow="Categorías principales"
            title="Comprá por rubro"
            text="Un catálogo enfocado en sistemas en seco y sus fijaciones."
          />
          <div className="storefront-category-rail">
            {primaryCategories.map(({ href, icon: Icon, label, helper }) => (
              <Link className="storefront-category" href={href} key={label} prefetch={false}>
                <span className="storefront-category__icon"><Icon size={22} /></span>
                <strong>{label}</strong>
                <small>{helper}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="storefront-section storefront-categories">
        <div className="container">
          <SectionHeader
            eyebrow="Comprar según tu necesidad"
            title="Empezá por el trabajo que querés hacer"
            text="Accesos rápidos a productos reales del catálogo."
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

      <section className="storefront-benefits" aria-label="Servicios FZAC">
        <div className="container storefront-benefits__grid">
          <div><ShieldCheck size={22} /><span><strong>Compra protegida</strong><small>Validamos precio y disponibilidad.</small></span></div>
          <div><Truck size={22} /><span><strong>Entrega o retiro</strong><small>Coordinación según tu pedido.</small></span></div>
          <div><CreditCard size={22} /><span><strong>Medios de pago</strong><small>Online, transferencia o coordinación.</small></span></div>
          <div><Headphones size={22} /><span><strong>Atención FZAC</strong><small>Ayuda antes y después de comprar.</small></span></div>
        </div>
      </section>

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
