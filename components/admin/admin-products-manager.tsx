"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Eye, ImageOff, PackageSearch, Plus, Save, Search, Trash2, UploadCloud, X } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import { getProductAvailabilityStatus } from "@/lib/products/availability";
import { slugify } from "@/lib/utils/slug";
import { duplicateReason } from "@/lib/products/identity";
import type { Category, Product, ProductAvailabilityStatus, ProductPromotionType } from "@/types/domain";

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
  availability_status: ProductAvailabilityStatus;
  supplier_id: string | null;
  unit: string;
  image_url: string;
  gallery: string[];
  specifications: Record<string, string | number | boolean>;
  featured: boolean;
  on_sale: boolean;
  promotion_type: ProductPromotionType;
  promotion_discount_percent: string | number | null;
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
  availability_status: "OUT_OF_STOCK",
  supplier_id: null,
  unit: "unidad",
  image_url: "",
  gallery: [] as string[],
  specifications: {} as Record<string, string | number | boolean>,
  featured: false,
  on_sale: false,
  promotion_type: "NONE",
  promotion_discount_percent: null,
  active: true
};

type CatalogFilter = "ALL" | "READY" | "ATTENTION" | "CONSULT" | "OUT_OF_STOCK";

function productForm(product: Product): ProductForm {
  return {
    ...emptyProduct,
    ...product,
    availability_status: getProductAvailabilityStatus(product)
  };
}

function getProductIssues(product: Product, categoryIds: Set<string>) {
  const issues: string[] = [];
  const availability = getProductAvailabilityStatus(product);
  if (!product.image_url.trim()) issues.push("Sin foto");
  if (!product.description.trim()) issues.push("Sin descripcion");
  if (!categoryIds.has(product.category_id)) issues.push("Sin categoria");
  if (Number(product.price) <= 0) issues.push("Sin precio");
  if (availability === "OUT_OF_STOCK") issues.push("Sin stock");
  if (availability === "IN_STOCK" && Number(product.stock) <= 0) issues.push("Stock inconsistente");
  return issues;
}

export function AdminProductsManager({
  products,
  categories,
  suppliers,
  mode = "full",
  initialProductId
}: {
  products: Product[];
  categories: Category[];
  suppliers: Array<{ id: string; name: string }>;
  mode?: "full" | "create-only";
  initialProductId?: string;
}) {
  const [rows, setRows] = useState(products);
  const [form, setForm] = useState<ProductForm>(() => {
    const selected = products.find((product) => product.id === initialProductId);
    return selected ? productForm(selected) : { ...emptyProduct, category_id: categories[0]?.id ?? "" };
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [query, setQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [specificationsText, setSpecificationsText] = useState(() => {
    const selected = products.find((product) => product.id === initialProductId);
    return JSON.stringify(selected?.specifications ?? {}, null, 2);
  });
  const [editorOpen, setEditorOpen] = useState(Boolean(initialProductId) || mode === "create-only");

  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const categoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const brands = useMemo(() => Array.from(new Set(rows.map((product) => product.brand.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")), [rows]);
  const hasCategories = categories.length > 0;
  const catalogSummary = useMemo(() => {
    const active = rows.filter((product) => product.active);
    const ready = active.filter((product) => getProductIssues(product, categoryIds).length === 0);
    const missingImages = active.filter((product) => !product.image_url.trim()).length;
    const outOfStock = active.filter((product) => getProductAvailabilityStatus(product) === "OUT_OF_STOCK").length;
    const consult = active.filter((product) => getProductAvailabilityStatus(product) === "CONSULT").length;
    const attention = active.length - ready.length;

    return {
      active: active.length,
      ready: ready.length,
      attention,
      missingImages,
      outOfStock,
      consult,
      readiness: active.length ? Math.round((ready.length / active.length) * 100) : 0
    };
  }, [categoryIds, rows]);
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
    return sortedRows.filter((product) => {
      const issues = getProductIssues(product, categoryIds);
      const availability = getProductAvailabilityStatus(product);
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
        (catalogFilter === "CONSULT" && product.active && availability === "CONSULT") ||
        (catalogFilter === "OUT_OF_STOCK" && product.active && availability === "OUT_OF_STOCK");
      const matchesSupplier = supplierFilter === "ALL" || product.supplier_id === supplierFilter;
      const matchesCategory = categoryFilter === "ALL" || product.category_id === categoryFilter;
      const matchesBrand = brandFilter === "ALL" || product.brand === brandFilter;
      return matchesQuery && matchesFilter && matchesSupplier && matchesCategory && matchesBrand;
    });
  }, [brandFilter, catalogFilter, categoryById, categoryFilter, categoryIds, query, sortedRows, supplierFilter]);
  const duplicateWarning = useMemo(
    () => form.name.trim() && form.slug.trim() && form.sku.trim() ? duplicateReason(form, rows) : null,
    [form, rows]
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!hasCategories || !form.category_id) {
      setMessage("Primero carga una categoria valida para poder guardar productos.");
      return;
    }
    if (duplicateWarning) {
      setMessage(duplicateWarning);
      return;
    }

    setSaving(true);
    setMessage("");

    let parsedSpecifications: Record<string, string | number | boolean> = {};
    try {
      const candidate = specificationsText.trim() ? JSON.parse(specificationsText) : {};
      if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
        setMessage("La ficha técnica debe ser un objeto JSON válido.");
        setSaving(false);
        return;
      }
      parsedSpecifications = candidate as Record<string, string | number | boolean>;
    } catch {
      setMessage("Revisá la ficha técnica: el JSON no es válido.");
      setSaving(false);
      return;
    }

    const generatedSlug = form.slug || slugify(form.name);
    const generatedSku = form.sku || `FZAC-${generatedSlug.slice(0, 48).toUpperCase()}`;
    const payload = {
      ...form,
      id: form.id || undefined,
      slug: generatedSlug,
      sku: generatedSku,
      price: Number(form.price),
      compare_price: form.compare_price ? Number(form.compare_price) : null,
      stock: Number(form.stock),
      stock_minimum: Number(form.stock_minimum),
      promotion_discount_percent:
        form.promotion_type === "SECOND_UNIT_PERCENT" && form.promotion_discount_percent
          ? Number(form.promotion_discount_percent)
          : null,
      on_sale: form.on_sale || form.promotion_type !== "NONE",
      specifications: parsedSpecifications
    };

    try {
      const endpoint = form.id ? `/api/admin/products?id=${encodeURIComponent(form.id.trim())}` : "/api/admin/products";
      const response = await fetch(endpoint, {
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
      setSpecificationsText("{}");
      setEditorOpen(false);
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

  function startNewProduct() {
    setForm({ ...emptyProduct, category_id: categories[0]?.id ?? "" });
    setSpecificationsText("{}");
    setMessage("");
    setEditorOpen(true);
    window.requestAnimationFrame(() => document.getElementById("admin-product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function editProduct(product: Product) {
    setForm(productForm(product));
    setSpecificationsText(JSON.stringify(product.specifications ?? {}, null, 2));
    setMessage("");
    setEditorOpen(true);
    window.requestAnimationFrame(() => document.getElementById("admin-product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function closeEditor() {
    setEditorOpen(false);
    setMessage("");
    setSpecificationsText("{}");
    setForm({ ...emptyProduct, category_id: categories[0]?.id ?? "" });
  }

  return (
    <>
      {mode === "full" ? (
        <section className="admin-product-navigation" aria-label="Navegación de productos">
          <div>
            <span className="kicker">Catálogo y administración</span>
            <h2>Productos</h2>
            <p>Revisá el catálogo como cliente, buscá productos o cargá uno nuevo sin perder el panel administrativo.</p>
          </div>
          <div className="admin-product-navigation__actions">
            <Link className="btn btn--ghost" href="/productos" target="_blank" rel="noreferrer">
              <Eye size={17} /> Ver tienda como cliente <ExternalLink size={14} />
            </Link>
            <button className="btn" type="button" onClick={startNewProduct}>
              <Plus size={17} /> Nuevo producto
            </button>
          </div>
        </section>
      ) : null}
      {editorOpen ? (
      <section id="admin-product-editor" className={`admin-panel admin-product-editor ${mode === "create-only" ? "admin-product-editor--catalog" : ""}`}>
        <div className="admin-product-editor__head">
          <div>
            <span className="kicker">Ficha administrativa</span>
            <h2>{form.id ? form.name || "Editar producto" : "Nuevo producto"}</h2>
            <p>
              Lo importante primero: nombre, precio, stock, categoría, proveedor, foto y descripción. Los datos técnicos quedan en “Opciones avanzadas”.
            </p>
          </div>
          <div className="admin-product-editor__head-actions">
            {mode === "create-only" ? <span className="status-pill status-pill--warning">Solo admin</span> : null}
            {mode === "full" ? (
              <button className="btn btn--ghost" type="button" onClick={closeEditor}>
                <X size={17} /> Cerrar
              </button>
            ) : null}
          </div>
        </div>
        {!hasCategories ? (
          <p className="notice notice--danger">No hay categorias registradas. Crea una categoria antes de cargar productos.</p>
        ) : null}
        <form className="admin-product-simple-form" onSubmit={save}>
          <section className="admin-product-simple-card">
            <div className="admin-product-simple-card__title">
              <span className="kicker">{form.id ? "Editar" : "Crear"}</span>
              <h3>Datos principales</h3>
              <p>Estos son los campos que vas a tocar casi siempre.</p>
            </div>

            <div className="admin-product-simple-grid">
              <label className="admin-product-field--wide">
                Nombre del producto
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: slugify(event.target.value) })} required />
              </label>

              <label>
                Precio de venta
                <input inputMode="decimal" value={String(form.price)} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
              </label>

              <label>
                Cantidad / stock
                <input inputMode="numeric" value={String(form.stock)} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
              </label>

              <label>
                Disponibilidad
                <select
                  value={form.availability_status}
                  onChange={(event) => setForm({ ...form, availability_status: event.target.value as ProductAvailabilityStatus })}
                >
                  <option value="IN_STOCK">En stock</option>
                  <option value="CONSULT">Consultar disponibilidad</option>
                  <option value="OUT_OF_STOCK">Sin stock</option>
                </select>
              </label>

              <label>
                Categoría
                <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} required disabled={!hasCategories}>
                  {!hasCategories ? <option value="">Sin categorías registradas</option> : null}
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>

              <label>
                Proveedor
                <select value={form.supplier_id ?? ""} onChange={(event) => setForm({ ...form, supplier_id: event.target.value || null })}>
                  <option value="">Sin proveedor asignado</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>

              <label className="admin-product-field--wide">
                Descripción
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Descripción clara del producto, uso, presentación y datos relevantes."
                  minLength={5}
                  required
                />
              </label>
            </div>
          </section>

          <section className="admin-product-simple-card">
            <div className="admin-product-simple-card__title">
              <span className="kicker">Ofertas</span>
              <h3>Promoción del producto</h3>
              <p>Podés activar 2x1 o aplicar un descuento únicamente sobre la segunda unidad de cada par.</p>
            </div>
            <div className="admin-product-simple-grid">
              <label>
                Tipo de promoción
                <select
                  value={form.promotion_type}
                  onChange={(event) => {
                    const promotionType = event.target.value as ProductPromotionType;
                    setForm({
                      ...form,
                      promotion_type: promotionType,
                      promotion_discount_percent:
                        promotionType === "SECOND_UNIT_PERCENT" ? (form.promotion_discount_percent || 20) : null,
                      on_sale: promotionType === "NONE" ? form.on_sale : true
                    });
                  }}
                >
                  <option value="NONE">Sin promoción especial</option>
                  <option value="TWO_FOR_ONE">2x1</option>
                  <option value="SECOND_UNIT_PERCENT">Descuento en segunda unidad</option>
                </select>
              </label>
              {form.promotion_type === "SECOND_UNIT_PERCENT" ? (
                <label>
                  Descuento segunda unidad (%)
                  <input
                    inputMode="decimal"
                    min={1}
                    max={100}
                    type="number"
                    value={form.promotion_discount_percent ?? ""}
                    onChange={(event) => setForm({ ...form, promotion_discount_percent: event.target.value })}
                    required
                  />
                </label>
              ) : null}
              <div className="field admin-product-field--wide">
                <span>Cómo se aplica</span>
                <small>
                  {form.promotion_type === "TWO_FOR_ONE"
                    ? "Cada 2 unidades, el cliente paga 1. Si lleva 3 paga 2; si lleva 4 paga 2."
                    : form.promotion_type === "SECOND_UNIT_PERCENT"
                      ? `La primera unidad va a precio completo y únicamente la segunda tiene ${Number(form.promotion_discount_percent || 0)}% de descuento.`
                      : "El producto se cobra normalmente. Podés seguir usando Precio anterior para una rebaja simple."}
                </small>
              </div>
            </div>
          </section>

          <section className="admin-product-simple-card admin-product-media-card">
            <div className="admin-product-simple-card__title">
              <span className="kicker">Imagen</span>
              <h3>Foto del producto</h3>
              <p>Podés subirla directamente o pegar una URL segura.</p>
            </div>
            <div className="admin-product-media">
              <div className="admin-product-media__preview">
                {form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="Vista previa del producto" />
                ) : (
                  <span><ImageOff size={34} /> Sin foto</span>
                )}
              </div>
              <div className="admin-product-media__actions">
                <label className="admin-upload-control">
                  <UploadCloud size={16} />
                  {uploadingImage ? "Subiendo..." : "Subir imagen"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploadingImage} />
                </label>
                <label>
                  URL de imagen
                  <input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} placeholder="https://..." />
                </label>
              </div>
            </div>
          </section>

          <details className="admin-product-advanced">
            <summary>
              <span>
                <strong>Opciones avanzadas</strong>
                <small>SKU, slug, marca, precio anterior, unidad, stock mínimo y publicación</small>
              </span>
              <ChevronDown size={18} />
            </summary>
            <div className="admin-product-simple-grid">
              <label>
                SKU
                <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Se genera automáticamente si lo dejás vacío" />
              </label>
              <label>
                Marca
                <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required />
              </label>
              <label>
                Slug
                <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
              </label>
              <label>
                Subcategoría
                <input value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })} />
              </label>
              <label>
                Precio anterior
                <input inputMode="decimal" value={form.compare_price ?? ""} onChange={(event) => setForm({ ...form, compare_price: event.target.value || null })} />
              </label>
              <label>
                Stock mínimo
                <input inputMode="numeric" value={String(form.stock_minimum)} onChange={(event) => setForm({ ...form, stock_minimum: event.target.value })} />
              </label>
              <label>
                Unidad
                <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
              </label>
              <label className="admin-product-field--wide">
                Galería de imágenes
                <textarea
                  rows={4}
                  value={form.gallery.join("\n")}
                  onChange={(event) => setForm({ ...form, gallery: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })}
                  placeholder="Una URL HTTPS por línea"
                />
              </label>
              <label className="admin-product-field--wide">
                Ficha técnica (JSON)
                <textarea
                  rows={7}
                  value={specificationsText}
                  onChange={(event) => setSpecificationsText(event.target.value)}
                  placeholder={'{"Color":"Blanco","Peso":"20 kg"}'}
                />
              </label>
              <div className="field admin-product-flags-field">
                <span>Publicación</span>
                <span className="admin-product-flags">
                  <label><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Destacado</label>
                  <label><input type="checkbox" checked={form.on_sale} onChange={(event) => setForm({ ...form, on_sale: event.target.checked })} /> Oferta</label>
                  <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo</label>
                </span>
              </div>
            </div>
          </details>

          <aside className="admin-product-preview" aria-label="Resumen del producto">
            <span className="kicker">Resumen antes de guardar</span>
            <div>
              {form.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image_url} alt="" />
              ) : <ImageOff size={28} />}
              <p>
                <strong>{form.name || "Nombre del producto"}</strong>
                <span>{currency(Number(form.price) || 0)} · {form.unit || "unidad"}</span>
                <small>{form.availability_status === "CONSULT" ? "Consultar disponibilidad" : form.availability_status === "IN_STOCK" ? `${form.stock} disponibles` : "Sin stock"}</small>
              </p>
            </div>
            {duplicateWarning ? <em><AlertTriangle size={15} /> {duplicateWarning}</em> : <small>Sin coincidencias visibles por nombre, SKU o slug.</small>}
          </aside>

          <div className="admin-product-editor__savebar">
            {form.id && mode === "full" ? (
              <button className="btn btn--ghost" type="button" onClick={closeEditor}>Cancelar</button>
            ) : null}
            <button className="btn admin-product-save" type="submit" disabled={saving || !hasCategories || Boolean(duplicateWarning)}>
              <Save size={18} />
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
        {message ? <p className="notice">{message}</p> : null}
      </section>
      ) : null}

      {mode === "full" ? (
      <section className="admin-panel admin-panel--table">
        <div className="admin-catalog-readiness">
          <div className="admin-catalog-readiness__copy">
            <span className="kicker">Preparacion comercial</span>
            <h2>Catalogo listo para vender</h2>
            <p>
              {catalogSummary.active === 0
                ? "Todavia no hay productos activos. Carga el primer producto para publicar el catalogo."
                : `${catalogSummary.ready} de ${catalogSummary.active} productos activos tienen precio, foto, categoria, descripcion y estado comercial coherente.`}
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
              <dt>A consultar</dt>
              <dd>{catalogSummary.consult}</dd>
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
              <option value="CONSULT">Consultar disponibilidad</option>
              <option value="OUT_OF_STOCK">Sin stock</option>
            </select>
          </label>
          <label className="admin-catalog-filter">
            <span>Categoría</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="ALL">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="admin-catalog-filter">
            <span>Marca</span>
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
              <option value="ALL">Todas</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </label>
          <label className="admin-catalog-filter">
            <span>Proveedor</span>
            <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
              <option value="ALL">Todos</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Precio venta</th>
                <th>Stock</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((product) => {
                const issues = getProductIssues(product, categoryIds);
                const availability = getProductAvailabilityStatus(product);
                return (
                <tr key={product.id}>
                  <td>
                    <button className="admin-product-name-button" type="button" onClick={() => editProduct(product)}>
                      <strong>{product.name}</strong>
                      <small>{product.sku}</small>
                    </button>
                  </td>
                  <td>{product.category?.name ?? categoryById.get(product.category_id) ?? "Categoria pendiente"}</td>
                  <td>{currency(product.price)}</td>
                  <td>{availability === "CONSULT" ? "A consultar" : product.stock}</td>
                  <td>{product.supplier?.name ?? suppliers.find((supplier) => supplier.id === product.supplier_id)?.name ?? "Sin asignar"}</td>
                  <td>
                    {!product.active ? (
                      <span className="status-pill">Inactivo</span>
                    ) : availability === "CONSULT" ? (
                      <span className="status-pill status-pill--warning">Consultar disponibilidad</span>
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
                      <Link className="btn btn--ghost" href={`/producto/${product.slug}`} target="_blank" rel="noreferrer">
                        <Eye size={16} /> Ver
                      </Link>
                      <button className="btn btn--ghost" type="button" onClick={() => editProduct(product)}>
                        Editar ficha
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
                      <button className="btn btn--ghost" type="button" onClick={() => { setQuery(""); setCatalogFilter("ALL"); setCategoryFilter("ALL"); setBrandFilter("ALL"); setSupplierFilter("ALL"); }}>
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
