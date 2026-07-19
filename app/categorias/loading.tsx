export default function Loading() {
  return (
    <main className="category-directory-page category-directory-page--loading" aria-busy="true">
      <section className="category-directory-hero">
        <div className="container category-directory-hero__inner">
          <div>
            <span className="skeleton-line skeleton-line--eyebrow" />
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--lead" />
          </div>
        </div>
      </section>
      <section className="page-section category-directory">
        <div className="container category-directory__list">
          {Array.from({ length: 7 }).map((_, index) => (
            <span className="category-directory__row category-directory__row--skeleton" key={index} />
          ))}
        </div>
      </section>
    </main>
  );
}
