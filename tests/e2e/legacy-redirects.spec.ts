import { expect, test } from "@playwright/test";

const redirects = [
  ["/productos.html", "/productos"],
  ["/carrito.html", "/carrito"],
  ["/mis-pedidos.html", "/cuenta/pedidos"],
  ["/cliente-login.html", "/login"]
] as const;

for (const [legacyPath, currentPath] of redirects) {
  test(`${legacyPath} redirige a ${currentPath}`, async ({ request }) => {
    const response = await request.get(legacyPath, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const location = response.headers().location;
    expect(new URL(location, response.url()).pathname).toBe(currentPath);
  });
}
