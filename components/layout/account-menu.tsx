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
  adminPath: string;
};

type AccountMenuSummary = {
  totalSpent: string;
  pendingAmount: string;
  ordersCount: number;
  purchasedProducts: number;
  reservedProducts: number;
};

function ProfileAvatar({ large = false, profile }: { large?: boolean; profile: HeaderProfile }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldUseProfilePhoto = profile.avatar_url && profile.avatar_url !== failedUrl;

  return (
    <span className={`account-menu__avatar ${large ? "account-menu__avatar--large" : ""}`}>
      {shouldUseProfilePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url!} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(profile.avatar_url)} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logoFZAC.jpg" alt="" />
      )}
    </span>
  );
}

export function AccountMenu({ profile, adminPath }: AccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<AccountMenuSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const summaryRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      const pendingRequest = summaryRequestRef.current;
      summaryRequestRef.current = null;
      pendingRequest?.abort();
    };
  }, []);

  function loadSummary() {
    if (!profile || summary || summaryRequestRef.current) return;
    const controller = new AbortController();
    summaryRequestRef.current = controller;
    setSummaryLoading(true);
    void fetch("/api/account/summary", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No pudimos cargar el resumen.");
        return (await response.json()) as AccountMenuSummary;
      })
      .then(setSummary)
      .catch(() => undefined)
      .finally(() => {
        if (summaryRequestRef.current !== controller) return;
        summaryRequestRef.current = null;
        setSummaryLoading(false);
      });
  }

  function toggleMenu() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) loadSummary();
  }

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  if (!profile) {
    return (
      <Link className="icon-link" href="/login" aria-label="Ingresar a cuenta" prefetch={false}>
        <UserRound size={20} />
      </Link>
    );
  }

  return (
    <div className="account-menu" ref={ref}>
      <button className="account-menu__trigger" type="button" aria-expanded={open} onClick={toggleMenu}>
        <ProfileAvatar profile={profile} />
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
            {summaryLoading && !summary ? (
              <><span className="account-menu__stat-skeleton" /><span className="account-menu__stat-skeleton" /><span className="account-menu__stat-skeleton" /><span className="account-menu__stat-skeleton" /></>
            ) : (
              <>
                <span><WalletCards size={16} /> Comprado {summary?.totalSpent ?? "-"}</span>
                <span><Package size={16} /> {summary?.purchasedProducts ?? 0} comprados</span>
                <span><ShoppingBag size={16} /> {summary?.ordersCount ?? 0} pedidos</span>
                <span><Package size={16} /> {summary?.reservedProducts ?? 0} en reserva</span>
              </>
            )}
          </div>

          <nav>
            {profile.role === "ADMIN" ? (
              <Link href={adminPath} onClick={() => setOpen(false)} prefetch={false}>
                <LayoutDashboard size={17} /> Panel admin
              </Link>
            ) : null}
            <Link href="/cuenta" onClick={() => setOpen(false)} prefetch={false}>
              <UserRound size={17} /> Mi cuenta
            </Link>
            <Link href="/cuenta/pedidos" onClick={() => setOpen(false)} prefetch={false}>
              <Package size={17} /> Productos comprados
            </Link>
            <Link href="/cuenta/ajustes" onClick={() => setOpen(false)} prefetch={false}>
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
