import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverClientPath = new URL("../../lib/supabase/server.ts", import.meta.url);
const proxyPath = new URL("../../proxy.ts", import.meta.url);

test("Server Components no fallan cuando Supabase intenta refrescar cookies", async () => {
  const [serverClient, proxy] = await Promise.all([
    readFile(serverClientPath, "utf8"),
    readFile(proxyPath, "utf8")
  ]);

  assert.match(serverClient, /getAll\(\)[\s\S]*cookieStore\.getAll\(\)/);
  assert.match(serverClient, /setAll\([\s\S]*try[\s\S]*cookieStore\.set[\s\S]*catch/);

  assert.match(proxy, /createServerClient/);
  assert.match(proxy, /response\.cookies\.set/);
  assert.match(proxy, /await supabase\.auth\.getUser\(\)/);
});
