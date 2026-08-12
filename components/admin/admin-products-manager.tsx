"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ImageOff, PackageSearch, Save, Search, Trash2, UploadCloud } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import { slugify } from "@/lib/utils/slug";
import type { Category, Product } from "@/types/domain";

type ProductForm = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  description: string;
  category_id: string;
  subcategory: string;
  price: string | number;
  compare_price: string | number | null;
  stock: string | number;
  stock_minimum: string | number;
  unit: string;
  image_url: string;
  gallery: string[];
  specifications: Record<string, string | number | boolean>;
  featured: boolean;
  on_sale: boolean;
  active: boolean;
};

const emptyProduct: ProductForm = {
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

type CatalogFilter = "ALL" | "READY" | "ATTENTION" | "OUT_OF_STOCK" | "INACTIVE";

function getProductIssues(product: Product, categoryIds: Set<string>) {
  const issues: string[] = [];
  if (!product.image_url.trim()) issues.push("Sin foto");
  if (!product.description.trim()) issues.push("Sin descripcion");
  if (!categoryIds.has(product.category_id)) issues.push("Sin categoria");
  if (Number(product.price) <= 0) issues.push("Sin precio");
  if (Number(product.stock) <= 0) issues.push("Sin stock");
  return issues;
}

export function AdminProductsManager({
  products,
  categories,
  mode = "full",
  initialProductId
}: {
  products: Product[];
  categories: Category[];
  mode?: "full" | "create-only";
  initialProductId?: string;
}) {
  const [rows, setRows] = useState(products);
  const [form, setForm] = useState(() => {
    const selected = products.find((product) => product.id === initialProductId);
    return selected ? { ...emptyProduct, ...selected } : { ...emptyProduct, category_id: categories[0]?.id ?? "" };
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [query, setQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("ALL");

  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const categoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const hasCategories = categories.length > 0;
  const catalogSummary = useMemo(() => {
    const active = rows.filter((product) => product.active);
    const ready = active.filter((product) => getProductIssues(product, categoryIds).length === 0);
    const missingImages = active.filter((product) => !product.image_url.trim()).length;
    const outOfStock = active.filter((product) => Number(product.stock) <= 0).length;
    const attention = active.length - ready.length;

    return {
      active: active.length,
      ready: ready.length,
      attention,
      missingImages,
      outOfStock,
      readiness: active.length ? Math.round((ready.length / active.length) * 100) : 0
    };
  }, [categoryIds, rows]);
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
    return sortedRows.filter((product) => {
      const issues = getProductIssues(product, categoryIds);
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.sku, product.brand, categoryById.get(product.category_id) ?? ""]
          .join(" ")
          .toLocaleLowerCase("es-AR")
          .includes(normalizedQuery);
      const matchesFilter =
        catalogFilter === "ALL" ||
        (catalogFilter === "READY" && product.active && issues.length === 0) ||
        (catalogFilter === "ATTENTION" && product.active && issues.length > 0) ||
        (catalogFilter === "OUT_OF_STOCK" && product.active && Number(product.stock) <= 0) ||
        (catalogFilter === "INACTIVE" && !product.active);
      return matchesQuery && matchesFilter;
    });
  }, [catalogFilter, categoryById, categoryIds, query, sortedRows]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!hasCategories || !form.category_id) {
      setMessage("Primero carga una categoria valida para poder guardar productos.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      ...form,
      id: form.id || undefined,
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

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadingImage) return;

    setUploadingImage(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/uploads/product-image", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !data.url) throw new Error(data.message || "No pudimos subir la imagen.");

      setForm((current) => ({ ...current, image_url: data.url! }));
      setMessage("Imagen subida al bucket y lista para guardar en el producto.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos subir la imagen.");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <>
      <section className={`admin-panel admin-product-editor ${mode === "create-only" ? "admin-product-editor--catalog" : ""}`}>
        <div className="admin-product-editor__head">
          <div>
            <span className="kicker">Gestión exclusiva</span>
            <h2>{form.id ? "Editar producto" : "Cargar producto"}</h2>
            <p>
              Completá precio, foto, stock, descripción y estado comercial. Esta sección solo aparece para administradores.
            </p>
          </div>
          {mode === "create-only" ? <span className="status-pill status-pill--warning">Solo admin</span> : null}
        </div>
        {!hasCategories ? (
          <p className="notice notice--danger">No hay categorias registradas. Crea una categoria antes de cargar productos.</p>
        ) : null}
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
            <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} required disabled={!hasCategories}>
              {!hasCategories ? <option value="">Sin categorias registradas</option> : null}
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
            <input inputMode="decimal" value={String(form.price)} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
          </label>
          <label>
            Precio anterior
            <input
              inputMode="decimal"
              value={form.compare_price ?? ""}
              onChange={(event) => setForm({ ...form, compare_price: event.target.value || null })}
            />
          </label>
          <label>
            Stock
            <input inputMode="numeric" value={String(form.stock)} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
          </label>
          <label>
            Stock minimo
            <input inputMode="numeric" value={String(form.stock_minimum)} onChange={(event) => setForm({ ...form, stock_minimum: event.target.value })} />
          </label>
          <label>
            Unidad
            <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </label>
          <label>
            Imagen
            <input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
          </label>
          <div className="field admin-upload-field">
            <span>Foto del producto</span>
            <label className="admin-upload-control">
              <UploadCloud size={16} />
              {uploadingImage ? "Subiendo..." : "Subir al bucket"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploadingImage} />
            </label>
            {form.image_url ? (
              <span className="admin-upload-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={String(form.image_url)} alt="Vista previa del producto" />
                URL lista para guardar
              </span>
            ) : (
              <small>Tambien podes pegar una URL publica ya subida en Supabase Storage.</small>
            )}
          </div>
          <label>
            Descripcion
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          </label>
          <div className="field admin-product-flags-field">
            <span>Flags</span>
            <span className="admin-product-flags">
              <label>
                <input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Destacado
              </label>
              <label>
                <input type="checkbox" checked={form.on_sale} onChange={(event) => setForm({ ...form, on_sale: event.target.checked })} /> Oferta
              </label>
              <label>
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo
              </label>
            </span>
          </div>
          <button className="btn admin-product-save" type="submit" disabled={saving || !hasCategories}>
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar producto"}
          </button>
        </form>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      {mode === "full" ? (
      <section className="admin-panel admin-panel--table">
        <div className="admin-catalog-readiness">
          <div className="admin-catalog-readiness__copy">
            <span className="kicker">Preparacion comercial</span>
            <h2>Catalogo listo para vender</h2>
            <p>
              {catalogSummary.active === 0
                ? "Todavia no hay productos activos. Carga el primer producto para publicar el catalogo."
                : `${catalogSummary.ready} de ${catalogSummary.active} productos activos tienen precio, foto, categoria, descripcion y stock.`}
            </p>
            <div className="admin-catalog-progress" aria-label={`Preparacion del catalogo: ${catalogSummary.readiness}%`}>
              <span style={{ width: `${catalogSummary.readiness}%` }} />
            </div>
          </div>
          <dl className="admin-catalog-readiness__stats">
            <div>
              <CheckCircle2 size={18} />
              <dt>Listos</dt>
              <dd>{catalogSummary.ready}</dd>
            </div>
            <div>
              <AlertTriangle size={18} />
              <dt>Revisar</dt>
              <dd>{catalogSummary.attention}</dd>
            </div>
            <div>
              <ImageOff size={18} />
              <dt>Sin foto</dt>
              <dd>{catalogSummary.missingImages}</dd>
            </div>
            <div>
              <PackageSearch size={18} />
              <dt>Sin stock</dt>
              <dd>{catalogSummary.outOfStock}</dd>
            </div>
          </dl>
        </div>

        <div className="admin-catalog-toolbar">
          <label className="admin-catalog-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Buscar productos</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, SKU, marca o categoria"
            />
          </label>
          <label className="admin-catalog-filter">
            <span>Estado</span>
            <select value={catalogFilter} onChange={(event) => setCatalogFilter(event.target.value as CatalogFilter)}>
              <option value="ALL">Todos</option>
              <option value="READY">Listos para vender</option>
              <option value="ATTENTION">Requieren revision</option>
              <option value="OUT_OF_STOCK">Sin stock</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Categoria</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((product) => {
                const issues = getProductIssues(product, categoryIds);
                return (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>{product.category?.name ?? categoryById.get(product.category_id) ?? "Categoria pendiente"}</td>
                  <td>{currency(product.price)}</td>
                  <td>{product.stock}</td>
                  <td>
                    {!product.active ? (
                      <span className="status-pill">Inactivo</span>
                    ) : issues.length === 0 ? (
                      <span className="status-pill status-pill--success">Listo</span>
                    ) : (
                      <span className="status-pill status-pill--warning" title={issues.join(", ")}>
                        {issues[0]}{issues.length > 1 ? ` +${issues.length - 1}` : ""}
                      </span>
                    )}
                  </td>
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
                );
              })}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-catalog-empty">
                      <PackageSearch size={24} />
                      <strong>No encontramos productos con estos filtros.</strong>
                      <button className="btn btn--ghost" type="button" onClick={() => { setQuery(""); setCatalogFilter("ALL"); }}>
                        Limpiar filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </>
  );
}
