import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CreditCard,
  Grid3X3,
  Hammer,
  Package,
  Percent,
  ShieldCheck,
  Truck
} from "lucide-react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { getCategories, getProducts } from "@/lib/db/catalog";

export async function HomePage() {
  const [categories, featured, offers, bestSellers] = await Promise.all([
    getCategories(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ onSale: true, limit: 4 }),
    getProducts({ inStock: true, order: "price_desc", limit: 4 })
  ]);

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
            <CreditCard size={18} /> Mercado Pago listo
          </span>
          <span>
            <ShieldCheck size={18} /> Stock validado en backend
          </span>
        </div>
      </section>

      <section className="home-hero">
        <div className="container home-hero__grid">
          <div className="home-hero__content">
            <span className="kicker">Corralon online FZAC</span>
            <h1>Compras de obra claras, rapidas y con identidad Fortaleza.</h1>
            <p>
              Catalogo por rubro, precios visibles, carrito persistente y checkout preparado para pagos online,
              transferencia coordinada, retiro o envio en Rosario y alrededores.
            </p>
            <div className="hero-actions">
              <Link className="btn" href="/catalogo">
                Comprar ahora <ArrowRight size={18} />
              </Link>
              <Link className="btn btn--ghost" href="/ofertas">
                Ver ofertas
              </Link>
            </div>
            <div className="hero-stats" aria-label="Indicadores FZAC">
              <span>
                <strong>FZAC</strong>
                logistica coordinada
              </span>
              <span>
                <strong>24/7</strong>
                tienda disponible
              </span>
              <span>
                <strong>MP</strong>
                tarjetas y cuenta
              </span>
            </div>
          </div>

          <aside className="home-hero__deal" aria-label="Resumen comercial">
            <div className="deal-card deal-card--main">
              <span className="status-pill status-pill--warning">
                <Percent size={15} /> Megaofertas
              </span>
              <h2>Combos para obra seca, pintura y materiales base.</h2>
              <p>Pedis online, FZAC valida stock y te confirma retiro, envio o pago pendiente.</p>
              <Link className="btn" href="/ofertas">
                Explorar promos
              </Link>
            </div>
            <div className="deal-card">
              <Banknote size={22} />
              <strong>Transferencia</strong>
              <span>Pedido pendiente hasta validacion administrativa.</span>
            </div>
            <div className="deal-card">
              <Hammer size={22} />
              <strong>Materiales reales</strong>
              <span>Rubros de corralon, electricidad, plomeria y pintura.</span>
            </div>
          </aside>
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
            eyebrow="Categorias"
            title="Rubros principales"
            text="La tienda esta pensada para comprar como en un corralon real: por material, uso y disponibilidad."
            action={
              <Link className="btn btn--ghost" href="/categorias">
                Ver todas
              </Link>
            }
          />
          <div className="category-grid">
            {categories.slice(0, 6).map((category) => (
              <Link className="category-card" href={`/categoria/${category.slug}`} key={category.id}>
                <span className="category-card__icon">
                  <Grid3X3 size={24} />
                </span>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <span>Ver productos</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <SectionHeader
            eyebrow="Destacados"
            title="Destacados del mes"
            text="Una vidriera de productos frecuentes para obra, mantenimiento y compras de reposicion."
            action={
              <Link className="btn btn--ghost" href="/productos">
                Catalogo completo
              </Link>
            }
          />
          <ProductGrid products={featured} />
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="banner-band">
            <div>
              <span className="kicker">
                <CreditCard size={16} /> Pago online
              </span>
              <h2>Medios de pago listos para operar como tienda real.</h2>
              <p>
                Tarjetas por Mercado Pago, transferencia con revision administrativa y stock descontado solo cuando el
                pago queda aprobado desde backend.
              </p>
            </div>
            <Link className="btn" href="/checkout">
              Pagar carrito <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <SectionHeader
            eyebrow="Megaofertas"
            title="Oportunidades vigentes"
            text="Precios destacados para compras con stock visible y validacion final al pagar."
          />
          <ProductGrid products={offers} />
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <SectionHeader
            eyebrow="Mas vendidos"
            title="Materiales con alta rotacion"
            text="Productos disponibles para compras recurrentes."
          />
          <ProductGrid products={bestSellers} />
        </div>
      </section>

      <section className="page-section">
        <div className="container benefit-grid">
          <article className="benefit-card">
            <ShieldCheck size={24} />
            <h3>Compra protegida</h3>
            <p>Precios, stock, pagos y tickets se validan en Route Handlers.</p>
          </article>
          <article className="benefit-card">
            <Truck size={24} />
            <h3>Envio FZAC</h3>
            <p>La entrega se coordina con datos de direccion, telefono y disponibilidad operativa.</p>
          </article>
          <article className="benefit-card">
            <BadgeCheck size={24} />
            <h3>Seguimiento admin</h3>
            <p>El pedido queda visible para el panel con cliente, pago, ticket y estado operativo.</p>
          </article>
        </div>
      </section>
    </>
  );
}
