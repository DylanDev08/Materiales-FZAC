import Link from "next/link";
import { Grid3X3 } from "lucide-react";
import { getCategories } from "@/lib/db/catalog";

export default async function Page() {
  const categories = await getCategories();

  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Categorias</span>
            <h1>Rubros FZAC</h1>
            <p>Accede al catalogo por rubro para comprar mas rapido.</p>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-card" href={`/categoria/${category.slug}`} key={category.id}>
              <Grid3X3 size={24} />
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
