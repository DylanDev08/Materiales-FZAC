import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyticsPath = new URL(
  "../../components/analytics/consent-aware-analytics.tsx",
  import.meta.url
);

test("Vercel Analytics exige consentimiento también al enviar cada evento", async () => {
  const source = await readFile(analyticsPath, "utf8");

  assert.match(source, /enabled \? \([\s\S]*<Analytics/);
  assert.match(source, /beforeSend=\{\(event\) => \(analyticsAllowed\(\) \? event : null\)\}/);
});
