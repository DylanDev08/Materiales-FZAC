"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MapPin, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { AccountOverview } from "@/lib/db/account";

type Address = AccountOverview["addresses"][number];
type AddressForm = Omit<Address, "id">;

const emptyAddress: AddressForm = {
  label: "Casa",
  street: "",
  number: "",
  apartment: "",
  city: "Rosario",
  province: "Santa Fe",
  postalCode: "",
  notes: ""
};

export function AccountAddressManager({ initialAddresses }: { initialAddresses: Address[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyAddress);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  function field<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function create() {
    setEditingId(null);
    setForm(emptyAddress);
    setMessage("");
    setOpen(true);
  }

  function edit(address: Address) {
    const { id, ...values } = address;
    setEditingId(id);
    setForm(values);
    setMessage("");
    setOpen(true);
  }

  function close() {
    if (loading) return;
    setOpen(false);
    setEditingId(null);
    setForm(emptyAddress);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setOk(false);

    try {
      const response = await fetch("/api/account/addresses", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form)
      });
      const data = (await response.json()) as { id?: string; message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos guardar la dirección.");

      if (editingId) {
        setAddresses((current) => current.map((address) => (address.id === editingId ? { id: editingId, ...form } : address)));
      } else if (data.id) {
        setAddresses((current) => [{ id: data.id!, ...form }, ...current]);
      }
      setOk(true);
      setMessage(editingId ? "Dirección actualizada." : "Dirección guardada.");
      setOpen(false);
      setEditingId(null);
      setForm(emptyAddress);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar la dirección.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (loading) return;
    if (deletingId !== id) {
      setDeletingId(id);
      return;
    }

    setLoading(true);
    setMessage("");
    setOk(false);
    try {
      const response = await fetch("/api/account/addresses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos eliminar la dirección.");
      setAddresses((current) => current.filter((address) => address.id !== id));
      setDeletingId(null);
      setOk(true);
      setMessage("Dirección eliminada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos eliminar la dirección.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="account-section account-address-manager">
      <header className="account-section__head">
        <div>
          <span className="kicker">Entrega</span>
          <h2>Direcciones guardadas</h2>
          <p>Se completan automáticamente cuando elegís envío en el checkout.</p>
        </div>
        <button className="btn" type="button" onClick={create} disabled={loading || addresses.length >= 8}>
          <Plus size={17} /> Nueva dirección
        </button>
      </header>

      {addresses.length ? (
        <div className="account-address-list">
          {addresses.map((address) => (
            <article key={address.id}>
              <MapPin size={19} />
              <div>
                <strong>{address.label}</strong>
                <span>{address.street} {address.number}{address.apartment ? `, ${address.apartment}` : ""}</span>
                <small>{address.city}, {address.province}{address.postalCode ? ` · ${address.postalCode}` : ""}</small>
              </div>
              <div className="account-address-list__actions">
                <button type="button" onClick={() => edit(address)} title="Editar dirección"><Pencil size={16} /></button>
                <button
                  type="button"
                  className={deletingId === address.id ? "is-confirming" : ""}
                  onClick={() => remove(address.id)}
                  title={deletingId === address.id ? "Confirmar eliminación" : "Eliminar dirección"}
                >
                  {loading && deletingId === address.id ? <Loader2 size={16} /> : deletingId === address.id ? <CheckCircle2 size={16} /> : <Trash2 size={16} />}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <button className="account-address-empty" type="button" onClick={create}>
          <MapPin size={24} />
          <span><strong>Guardá tu primera dirección</strong><small>La vas a poder seleccionar al pedir entrega.</small></span>
          <Plus size={18} />
        </button>
      )}

      {open ? (
        <form className="account-address-form" onSubmit={submit}>
          <header>
            <div><span className="kicker">{editingId ? "Editar" : "Nueva"}</span><h3>{editingId ? "Actualizar dirección" : "Agregar dirección"}</h3></div>
            <button type="button" onClick={close} aria-label="Cerrar formulario"><X size={18} /></button>
          </header>
          <div className="form-grid">
            <label>Nombre de referencia<input value={form.label} onChange={(event) => field("label", event.target.value)} required maxLength={50} /></label>
            <label>Calle<input value={form.street} onChange={(event) => field("street", event.target.value)} required maxLength={120} autoComplete="address-line1" /></label>
            <label>Altura<input value={form.number} onChange={(event) => field("number", event.target.value)} required maxLength={30} inputMode="numeric" /></label>
            <label>Departamento (opcional)<input value={form.apartment} onChange={(event) => field("apartment", event.target.value)} maxLength={60} autoComplete="address-line2" /></label>
            <label>Ciudad<input value={form.city} onChange={(event) => field("city", event.target.value)} required maxLength={80} autoComplete="address-level2" /></label>
            <label>Provincia<input value={form.province} onChange={(event) => field("province", event.target.value)} required maxLength={80} autoComplete="address-level1" /></label>
            <label>Código postal (opcional)<input value={form.postalCode} onChange={(event) => field("postalCode", event.target.value)} maxLength={30} autoComplete="postal-code" /></label>
            <label className="field--wide">Indicaciones (opcional)<textarea value={form.notes} onChange={(event) => field("notes", event.target.value)} maxLength={240} rows={3} /></label>
          </div>
          <div className="account-address-form__actions">
            <button className="btn btn--ghost" type="button" onClick={close}>Cancelar</button>
            <button className="btn" type="submit" disabled={loading}>{loading ? <Loader2 size={17} /> : <Save size={17} />} Guardar dirección</button>
          </div>
        </form>
      ) : null}

      {message ? <p className={ok ? "notice notice--success" : "notice notice--danger"}>{message}</p> : null}
    </section>
  );
}
