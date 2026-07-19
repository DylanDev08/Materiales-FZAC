"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link_to: string | null;
  read: boolean;
  created_at: string;
};

function safeLink(value: string | null, adminPath: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return adminPath;
  return value.replace(/^\/admin(?=\/|$)/, adminPath);
}

function notificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function AdminNotificationBell({ adminPath }: { adminPath: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const unread = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    let active = true;

    async function load() {
      const controller = new AbortController();
      requestRef.current?.abort();
      requestRef.current = controller;
      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { notifications?: AdminNotification[] };
        if (active) setNotifications(data.notifications ?? []);
      } catch {
        // The next polling cycle retries without interrupting the admin workflow.
      }
    }

    void load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      requestRef.current?.abort();
    };
  }, []);

  async function markAllRead() {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true })
    });
    if (response.ok) setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  return (
    <div className="admin-notification-bell">
      <button type="button" aria-label="Abrir notificaciones" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unread ? <span>{Math.min(unread, 99)}</span> : null}
      </button>

      {open ? (
        <aside className="admin-notification-panel" aria-label="Notificaciones administrativas">
          <header>
            <div>
              <span className="kicker">Actividad reciente</span>
              <h2>Notificaciones</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones"><X size={17} /></button>
          </header>
          <div className="admin-notification-panel__actions">
            <span>{unread ? `${unread} sin leer` : "Todo al dia"}</span>
            <button type="button" onClick={markAllRead} disabled={!unread}><CheckCheck size={15} /> Marcar leidas</button>
          </div>
          <div className="admin-notification-list">
            {notifications.length ? notifications.slice(0, 20).map((notification) => (
              <Link
                className={notification.read ? "is-read" : undefined}
                href={safeLink(notification.link_to, adminPath)}
                key={notification.id}
                onClick={() => setOpen(false)}
              >
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>{notificationDate(notification.created_at)}</small>
              </Link>
            )) : <p className="admin-notification-empty">No hay notificaciones pendientes.</p>}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
