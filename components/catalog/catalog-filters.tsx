import type { Category } from "@/types/domain";

export function CatalogFilters({
  categories,
  values
}: {
  categories: Category[];
  values: Record<string, string | undefined>;
}) {
  return (
    <aside className="catalog-filter">
      <h2>Filtros</h2>
      <form action="/productos">
        <label className="field">
          Buscar
          <input name="search" defaultValue={values.search} placeholder="Producto, SKU o marca" />
        </label>
        <label className="field">
          Categoria
          <select name="category" defaultValue={values.category ?? ""}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Marca
          <input name="brand" defaultValue={values.brand} placeholder="Ej. Durlock" />
        </label>
        <label className="field">
          Precio minimo
          <input name="minPrice" type="number" min="0" defaultValue={values.minPrice} />
        </label>
        <label className="field">
          Precio maximo
          <input name="maxPrice" type="number" min="0" defaultValue={values.maxPrice} />
        </label>
        <label className="field">
          Orden
          <select name="order" defaultValue={values.order ?? "newest"}>
            <option value="newest">Mas recientes</option>
            <option value="price_asc">Menor precio</option>
            <option value="price_desc">Mayor precio</option>
            <option value="name_asc">Nombre A-Z</option>
          </select>
        </label>
        <label className="field">
          <span>
            <input name="inStock" type="checkbox" value="true" defaultChecked={values.inStock === "true"} /> Con stock
          </span>
        </label>
        <label className="field">
          <span>
            <input name="onSale" type="checkbox" value="true" defaultChecked={values.onSale === "true"} /> Solo ofertas
          </span>
        </label>
        <button className="btn" type="submit">
          Aplicar filtros
        </button>
      </form>
    </aside>
  );
}
