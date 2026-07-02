import Link from "next/link";
import Image from "next/image";
import { UserRound, ShieldCheck } from "lucide-react";
import { CartStatus } from "@/components/layout/cart-status";
import { SearchSuggest } from "@/components/layout/search-suggest";
import { getUserProfile } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/db/catalog";

export async function SiteHeader() {
  const [profile, categories] = await Promise.all([getUserProfile(), getCategories()]);

  return (
    <>
      <div className="topbar">
        <div className="container topbar__inner">
          <span>Fortaleza Construcciones Rosario</span>
          <span>Envios hasta 30 km, retiro coordinado y pagos online.</span>
        </div>
      </div>

      <header className="site-header">
        <div className="container site-header__main">
          <Link className="brand" href="/" aria-label="Ir al inicio">
            <span className="brand__mark brand__mark--logo">
              <Image src="/logoFZAC.jpg" alt="" width={42} height={42} priority />
            </span>
            <span className="brand__text">
              <strong>Materiales FZAC</strong>
              <span>Corralon digital</span>
            </span>
          </Link>

          <SearchSuggest />

          <div className="header-actions">
            {profile?.role === "ADMIN" ? (
              <Link className="icon-link" href="/admin" aria-label="Panel admin">
                <ShieldCheck size={20} />
              </Link>
            ) : null}
            <Link className="icon-link" href={profile ? "/cuenta" : "/login"} aria-label="Cuenta">
              <UserRound size={20} />
            </Link>
            <CartStatus />
          </div>
        </div>

        <nav className="category-nav" aria-label="Categorias principales">
          <div className="container category-nav__inner">
            <Link href="/catalogo">Catalogo</Link>
            <Link href="/ofertas">Ofertas</Link>
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} href={`/categoria/${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </div>
        </nav>
      </header>
    </>
  );
}
