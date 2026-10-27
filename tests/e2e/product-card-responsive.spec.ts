import { expect, test } from "@playwright/test";

/**
 * Isolated fixture with the actual storefront styles, no Supabase, payments,
 * checkout or production state. Test the same cart/detail flex items as the
 * ProductCard markup, including the new label span.
 */
test("los botones de tarjetas pequeñas no se superponen ni cortan el texto", async ({ page }) => {
  for (const viewport of [360, 430, 768, 1366]) {
    await page.setViewportSize({ width: viewport, height: 850 });
    await page.setContent(`
      <main class="container">
        <section class="product-grid">
          <article class="product-card" style="width: 280px;max-width:100%">
            <div class="product-card__body">
              <div class="product-card__actions">
                <button type="button" class="btn product-card__primary-action">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18"><path d="M1 1h3l2 10h10" /></svg>
                  <span class="product-card__primary-label">Añadir al carrito</span>
                </button>
                <a class="btn btn--ghost product-card__detail" href="/producto/demo">Detalle
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M1 8h13"/></svg>
                </a>
              </div>
            </div>
          </article>
        </section>
      </main>
    `);
    for (const path of [
      "styles/tokens.css",
      "styles/components.css",
      "styles/catalog.css",
      "styles/catalog-mobile-products.css",
      "styles/storefront.css",
      "styles/mobile.css",
      "styles/ui-ux-hardening.css"
    ]) await page.addStyleTag({ path });

    const bounds = await page.locator(".product-card__actions").evaluate((actions) => {
      const primary = actions.querySelector<HTMLElement>(".product-card__primary-action")!;
      const label = actions.querySelector<HTMLElement>(".product-card__primary-label")!;
      const detail = actions.querySelector<HTMLElement>(".product-card__detail")!;
      const a = primary.getBoundingClientRect();
      const b = label.getBoundingClientRect();
      const c = detail.getBoundingClientRect();
      return {
        labelFits: label.scrollWidth <= label.clientWidth + 1 &&
          label.scrollHeight <= label.clientHeight + 1 &&
          b.left >= a.left - 1 && b.right <= a.right + 1,
        overlaps: getComputedStyle(detail).display !== "none" &&
          a.right > c.left + 1 && a.left < c.right - 1 &&
          a.bottom > c.top + 1 && a.top < c.bottom - 1,
        label: label.textContent?.trim(),
        available: a.width
      };
    });
    expect(bounds.label, `etiqueta en ${viewport}px`).toBe("Añadir al carrito");
    expect(bounds.labelFits, `texto fuera del botón a ${viewport}px; botón de ${bounds.available}px`).toBe(true);
    expect(bounds.overlaps, `solapamiento a ${viewport}px`).toBe(false);
  }
});
