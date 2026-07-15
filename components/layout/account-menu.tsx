"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Package, Settings, ShoppingBag, UserRound, WalletCards } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type HeaderProfile = {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "USER" | "ADMIN" | "OPERATOR";
};

type AccountMenuProps = {
  profile: HeaderProfile | null;
  overview: {
    balance: string;
    ordersCount: number;
    purchasedProducts: number;
    reservedProducts: number;
  } | null;
  adminPath: string;
};

function initials(profile: HeaderProfile) {
  const source = profile.full_name || profile.email;
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ProfileAvatar({ large = false, profile }: { large?: boolean; profile: HeaderProfile }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`account-menu__avatar ${large ? "account-menu__avatar--large" : ""}`}>
      {profile.avatar_url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initials(profile)
      )}
    </span>
  );
}

export function AccountMenu({ profile, overview, adminPath }: AccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  if (!profile) {
    return (
      <Link className="icon-link" href="/login" aria-label="Ingresar a cuenta">
        <UserRound size={20} />
      </Link>
    );
  }

  return (
    <div className="account-menu" ref={ref}>
      <button className="account-menu__trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <ProfileAvatar key={profile.avatar_url || "avatar-placeholder"} profile={profile} />
        <ChevronDown size={15} />
      </button>

      {open ? (
        <section className="account-menu__panel" aria-label="Menu de cuenta">
          <header>
            <ProfileAvatar key={profile.avatar_url || "avatar-placeholder"} large profile={profile} />
            <div>
              <strong>{profile.full_name || "Cuenta FZAC"}</strong>
              <span>{profile.email}</span>
            </div>
          </header>

          <div className="account-menu__stats">
            <span>
              <WalletCards size={16} />
              Saldo {overview?.balance ?? "$0"}
            </span>
            <span>
              <Package size={16} />
              {overview?.purchasedProducts ?? 0} comprados
            </span>
            <span>
              <ShoppingBag size={16} />
              {overview?.ordersCount ?? 0} pedidos
            </span>
            <span>
              <Package size={16} />
              {overview?.reservedProducts ?? 0} en reserva
            </span>
          </div>

          <nav>
            {profile.role === "ADMIN" ? (
              <Link href={adminPath} onClick={() => setOpen(false)}>
                <LayoutDashboard size={17} /> Panel admin
              </Link>
            ) : null}
            <Link href="/cuenta" onClick={() => setOpen(false)}>
              <UserRound size={17} /> Mi cuenta
            </Link>
            <Link href="/cuenta/pedidos" onClick={() => setOpen(false)}>
              <Package size={17} /> Productos comprados
            </Link>
            <Link href="/cuenta/ajustes" onClick={() => setOpen(false)}>
              <Settings size={17} /> Ajustes
            </Link>
            <button type="button" onClick={logout}>
              <LogOut size={17} /> Salir
            </button>
          </nav>
        </section>
      ) : null}
    </div>
  );
}
