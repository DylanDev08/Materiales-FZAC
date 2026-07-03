import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { CartStatus } from "@/components/layout/cart-status";
import { SearchSuggest } from "@/components/layout/search-suggest";
import { SiteNav } from "@/components/layout/site-nav";
import { getUserProfile } from "@/lib/auth/get-user";
import { getAccountOverview } from "@/lib/db/account";
import { getCategories } from "@/lib/db/catalog";
import { getAdminConsolePath } from "@/lib/utils/env";

export async function SiteHeader() {
  const [profile, categories] = await Promise.all([getUserProfile(), getCategories()]);
  const [overview, adminPath] = await Promise.all([profile ? getAccountOverview(profile) : null, getAdminConsolePath()]);
  const accountOverview = overview
    ? {
        balance: overview.balance,
        ordersCount: overview.ordersCount,
        purchasedProducts: overview.purchasedProducts,
        reservedProducts: overview.reservedProducts
      }
    : null;

  return (
    <>
      <div className="topbar">
        <div className="container topbar__inner">
          <span>Fortaleza Construcciones Rosario</span>
          <span>Envios coordinados, retiro acordado y pagos online.</span>
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
              <span>E-Commerce</span>
            </span>
          </Link>

          <SearchSuggest />

          <div className="header-actions">
            {profile?.role === "ADMIN" ? (
              <Link className="icon-link" href={adminPath} aria-label="Panel admin">
                <ShieldCheck size={20} />
              </Link>
            ) : null}
            <AccountMenu profile={profile} overview={accountOverview} adminPath={adminPath} />
            <CartStatus />
          </div>
        </div>

        <SiteNav categories={categories} />
      </header>
    </>
  );
}
