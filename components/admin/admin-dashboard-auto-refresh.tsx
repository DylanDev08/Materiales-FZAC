"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AdminDashboardAutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <span className="admin-model-live-indicator" title="El dashboard se actualiza con datos reales del servidor.">
      <RefreshCw size={14} />
      Actualiza cada {Math.round(intervalMs / 1000)}s
    </span>
  );
}
