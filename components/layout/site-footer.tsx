import Link from "next/link";
import Image from "next/image";
import { getEnv } from "@/lib/utils/env";

export function SiteFooter() {
  const email = getEnv("FZAC_EMAIL") || "fortalezaconstruccionesrosario@gmail.com";
  const whatsapp = getEnv("FZAC_WHATSAPP") || "+5493415847000";
  const instagram = getEnv("FZAC_INSTAGRAM") || "@fzaconstrucciones";

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <Link className="brand" href="/">
            <span className="brand__mark brand__mark--logo">
              <Image src="/logoFZAC.jpg" alt="FZAC" width={42} height={42} unoptimized />
            </span>
            <span className="brand__text">
              <strong>Materiales FZAC</strong>
              <span>Fortaleza Construcciones</span>
            </span>
          </Link>
          <p>
            E-commerce de materiales para obra, mantenimiento y construcción en Rosario. Compra online,
            pago seguro y coordinación comercial.
          </p>
        </div>

        <div>
          <h3>Tienda</h3>
          <nav>
            <Link href="/productos">Productos</Link>
            <Link href="/categorias">Categorías</Link>
            <Link href="/ofertas">Ofertas</Link>
            <Link href="/carrito">Carrito</Link>
          </nav>
        </div>

        <div>
          <h3>Cuenta</h3>
          <nav>
            <Link href="/login">Ingresar</Link>
            <Link href="/registro">Registrarme</Link>
            <Link href="/cuenta/pedidos">Mis pedidos</Link>
            <Link href="/cuenta/conversaciones">Conversaciones</Link>
          </nav>
        </div>

        <div>
          <h3>Legal y contacto</h3>
          <nav>
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/cambios-y-devoluciones">Cambios y devoluciones</Link>
            <Link href="/envios-y-retiros">Envíos y retiros</Link>
            <Link href="/medios-de-pago">Medios de pago</Link>
            <a href={`mailto:${email}`}>{email}</a>
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}>WhatsApp {whatsapp}</a>
            <span>{instagram}</span>
          </nav>
        </div>
      </div>

      <div className="site-footer__bottom">
        <div className="container">Materiales FZAC. Pagos confirmados por proveedor seguro y stock descontado solo con pago aprobado.</div>
      </div>
    </footer>
  );
}
