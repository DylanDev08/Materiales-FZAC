"use client";

import { FormEvent, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import { slugify } from "@/lib/utils/slug";
import type { Category, Product } from "@/types/domain";

const emptyProduct = {
  id: "",
  name: "",
  slug: "",
  sku: "",
  brand: "FZAC",
  description: "",
  category_id: "",
  subcategory: "General",
  price: 0,
  compare_price: null as number | null,
  stock: 0,
  stock_minimum: 5,
  unit: "unidad",
  image_url: "",
  gallery: [] as string[],
  specifications: {} as Record<string, string | number | boolean>,
  featured: false,
  on_sale: false,
  active: true
};

export function AdminProductsManager({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [rows, setRows] = useState(products);
  const [form, setForm] = useState({ ...emptyProduct, category_id: categories[0]?.id ?? "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      ...form,
      slug: form.slug || slugify(form.name),
      price: Number(form.price),
      compare_price: form.compare_price ? Number(form.compare_price) : null,
      stock: Number(form.stock),
      stock_minimum: Number(form.stock_minimum)
    };

    try {
      const response = await fetch("/api/admin/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { product?: Product; message?: string };
      if (!response.ok || !data.product) throw new Error(data.message || "No pudimos guardar el producto.");

      setRows((current) => {
        const exists = current.some((item) => item.id === data.product?.id);
        return exists ? current.map((item) => (item.id === data.product?.id ? data.product : item)) : [...current, data.product!];
      });
      setForm({ ...emptyProduct, category_id: categories[0]?.id ?? "" });
      setMessage("Producto guardado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al guardar producto.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(product: Product) {
    setMessage("");
    const response = await fetch(`/api/admin/products?id=${product.id}`, { method: "DELETE" });
    if (response.ok) {
      setRows((current) => current.filter((item) => item.id !== product.id));
      setMessage("Producto desactivado.");
    } else {
      setMessage("No pudimos desactivar el producto.");
    }
  }

  return (
    <>
      <section className="admin-panel">
        <h2>{form.id ? "Editar producto" : "Crear producto"}</h2>
        <form className="form-grid" onSubmit={save}>
          <label>
            Nombre
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: slugify(event.target.value) })} required />
          </label>
          <label>
            Slug
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
          </label>
          <label>
            SKU
            <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
          </label>
          <label>
            Marca
            <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required />
          </label>
          <label>
            Categoria
            <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subcategoria
            <input value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })} />
          </label>
          <label>
            Precio
            <input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} required />
          </label>
          <label>
            Precio anterior
            <input
              type="number"
              value={form.compare_price ?? ""}
              onChange={(event) => setForm({ ...form, compare_price: event.target.value ? Number(event.target.value) : null })}
            />
          </label>
          <label>
            Stock
            <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} />
          </label>
          <label>
            Stock minimo
            <input type="number" value={form.stock_minimum} onChange={(event) => setForm({ ...form, stock_minimum: Number(event.target.value) })} />
          </label>
          <label>
            Unidad
            <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </label>
          <label>
            Imagen
            <input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
          </label>
          <label>
            Descripcion
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          </label>
          <label>
            Flags
            <span>
              <input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Destacado
              <input type="checkbox" checked={form.on_sale} onChange={(event) => setForm({ ...form, on_sale: event.target.checked })} /> Oferta
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo
            </span>
          </label>
          <button className="btn" type="submit" disabled={saving}>
            <Save size={18} />
            Guardar producto
          </button>
        </form>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="admin-panel">
        <h2>Productos</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>{currency(product.price)}</td>
                  <td>{product.stock}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="btn btn--ghost" type="button" onClick={() => setForm({ ...emptyProduct, ...product })}>
                        Editar
                      </button>
                      <button className="btn btn--danger" type="button" onClick={() => deactivate(product)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
