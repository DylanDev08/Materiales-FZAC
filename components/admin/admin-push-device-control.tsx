"use client";

import { useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, Send } from "lucide-react";

type PushConfig = {
  configured: boolean;
  publicKey: string;
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone / iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "PC Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "PC Linux";
  return "Dispositivo administrador";
}

export function AdminPushDeviceControl() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [standalone, setStandalone] = useState(false);

  const iosNeedsInstall = useMemo(
    () => supported === true && /iPhone|iPad|iPod/i.test(navigator.userAgent) && !standalone,
    [supported, standalone]
  );

  useEffect(() => {
    const hasSupport =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(hasSupport);
    if (!hasSupport) return;

    setPermission(Notification.permission);
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    );

    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/admin/push", { cache: "no-store" });
        if (!response.ok) return;
        const config = (await response.json()) as PushConfig;
        if (!active) return;
        setConfigured(Boolean(config.configured));
        setPublicKey(config.publicKey || "");

        const registration = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/" });
        const subscription = await registration.pushManager.getSubscription();
        if (active) setEnabled(Boolean(subscription));
      } catch {
        if (active) setMessage("No pudimos revisar las notificaciones de este dispositivo.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function activate() {
    if (!supported || !configured || !publicKey) {
      setMessage("Las notificaciones push todavía no están disponibles.");
      return;
    }
    if (iosNeedsInstall) {
      setMessage("En iPhone/iPad, agregá FZAC a la pantalla de inicio y abrilo desde ahí.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const requested = await Notification.requestPermission();
      setPermission(requested);
      if (requested !== "granted") {
        setMessage("Tenés que permitir las notificaciones en este dispositivo.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      const json = subscription.toJSON();
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth
          },
          deviceLabel: deviceLabel()
        })
      });

      if (!response.ok) throw new Error("No pudimos registrar este dispositivo.");

      setEnabled(true);
      setMessage("Notificaciones activadas en este dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch {
      setMessage("No pudimos desactivar este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function testNotification() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const body = (await response.json().catch(() => null)) as { sent?: number } | null;
      if (!response.ok) throw new Error("No pudimos enviar la prueba.");
      setMessage(`Prueba enviada a ${body?.sent ?? 1} dispositivo(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos enviar la prueba.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return <div className="admin-push-control"><small>Este navegador no admite notificaciones push.</small></div>;
  }

  return (
    <div className="admin-push-control">
      <div className="admin-push-control__status">
        <BellRing size={16} />
        <div>
          <strong>Alertas en este dispositivo</strong>
          <small>
            {!configured
              ? "Configuración pendiente del servidor"
              : enabled
                ? "Activadas para pagos y avisos importantes"
                : permission === "denied"
                  ? "Bloqueadas por el navegador"
                  : "Todavía no activadas"}
          </small>
        </div>
      </div>

      <div className="admin-push-control__actions">
        {!enabled ? (
          <button type="button" onClick={activate} disabled={busy || !configured}>
            <BellRing size={14} /> {busy ? "Activando..." : "Activar en este dispositivo"}
          </button>
        ) : (
          <>
            <button type="button" onClick={testNotification} disabled={busy}>
              <Send size={14} /> Probar
            </button>
            <button type="button" onClick={deactivate} disabled={busy}>
              <BellOff size={14} /> Desactivar
            </button>
          </>
        )}
      </div>

      {iosNeedsInstall ? (
        <small className="admin-push-control__hint">En iPhone/iPad: Compartir → Agregar a pantalla de inicio → abrí FZAC desde el ícono.</small>
      ) : null}
      {message ? <small className="admin-push-control__message" role="status">{message}</small> : null}
    </div>
  );
}
