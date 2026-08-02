import Link from "next/link";
import Image from "next/image";
import { MapPin, RotateCcw, ShieldCheck } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { CartStatus } from "@/components/layout/cart-status";
import { SearchSuggest } from "@/components/layout/search-suggest";
import { SiteNav } from "@/components/layout/site-nav";
import { getUserProfile } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/db/catalog";
import { getAdminConsolePath } from "@/lib/utils/env";

export async function SiteHeader() {
  const [profile, categories] = await Promise.all([getUserProfile(), getCategories()]);
  const adminPath = getAdminConsolePath();

  return (
    <>
      <div className="topbar">
        <div className="container topbar__inner">
          <span className="topbar__location"><MapPin size={14} /> Rosario y zona</span>
          <span className="topbar__message">Comprá online con stock validado y entrega coordinada.</span>
          <Link className="topbar__consumer-link" href="/arrepentimiento" prefetch={false}>
            <RotateCcw size={14} aria-hidden="true" />
            Botón de arrepentimiento
          </Link>
        </div>
      </div>

      <header className="site-header">
        <div className="container site-header__main">
          <Link className="brand" href="/" aria-label="Ir al inicio" prefetch={false}>
            <span className="brand__mark brand__mark--logo">
              <Image src="/logoFZAC.jpg" alt="FZAC" width={42} height={42} priority unoptimized />
            </span>
            <span className="brand__text">
              <strong>FZAC Materiales</strong>
              <span>Fortaleza Construcciones</span>
            </span>
          </Link>

          <SearchSuggest />

          <div className="header-actions">
            {profile?.role === "ADMIN" ? (
              <Link className="icon-link" href={adminPath} aria-label="Panel admin" prefetch={false}>
                <ShieldCheck size={20} />
              </Link>
            ) : null}
            <AccountMenu profile={profile} adminPath={adminPath} />
            <CartStatus />
          </div>
        </div>

        <SiteNav categories={categories} />
      </header>
    </>
  );
}
