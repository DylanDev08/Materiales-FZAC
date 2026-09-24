import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const BUCKET = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET?.trim() || "product-images";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://gooxgjzetziwnxhuymmx.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const suppliers = [
  {
    code: "LA-YESERA-ROSARINA",
    pageUrl: "https://tienda.layeserarosarina.com.ar/",
    async imageSource(html) {
      const match = html.match(/<img[^>]+class="[^"]*logo-img[^"]*"[^>]+src="([^"]+)"|<img[^>]+src="([^"]+)"[^>]+class="[^"]*logo-img/i);
      const source = match?.[1] || match?.[2];
      if (!source) throw new Error("No se encontró el logo oficial de Yesera.");
      return source.startsWith("//") ? `https:${source}` : source;
    }
  },
  {
    code: "UNIVERSO-PINTURAS-SRL",
    pageUrl: "https://www.tiendauniverso.com.ar/",
    async imageSource(html) {
      const match = html.match(/<img[^>]+alt="Tiena Universo Logo"[^>]+data-src="([^"]+)"/i);
      if (!match?.[1]) throw new Error("No se encontró el logo oficial de Universo.");
      return match[1]
        .replace(/&#x27;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&");
    }
  }
];

async function sourceBuffer(source) {
  if (source.startsWith("data:image/svg+xml,")) {
    return Buffer.from(decodeURIComponent(source.slice("data:image/svg+xml,".length)), "utf8");
  }
  const response = await fetch(source, { headers: { "User-Agent": "MaterialesFZACSupplierAssets/1.0" } });
  if (!response.ok) throw new Error(`No se pudo descargar el logo (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function run() {
  const preview = [];
  for (const supplier of suppliers) {
    const response = await fetch(supplier.pageUrl, { headers: { "User-Agent": "MaterialesFZACSupplierAssets/1.0" } });
    if (!response.ok) throw new Error(`No se pudo abrir ${supplier.pageUrl} (${response.status}).`);
    const source = await supplier.imageSource(await response.text());
    const optimized = await sharp(await sourceBuffer(source), { failOn: "error" })
      .resize({ width: 640, height: 240, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
    preview.push({ code: supplier.code, source: supplier.pageUrl, bytes: optimized.byteLength, optimized });
  }

  console.table(preview.map(({ code, source, bytes }) => ({ code, source, bytes })));
  if (!APPLY) {
    console.log("Preview completo. Ejecutá con --apply para guardar los logos verificados.");
    return;
  }
  if (!SERVICE_ROLE) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para aplicar.");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const item of preview) {
    const path = `suppliers/${item.code.toLowerCase()}.webp`;
    const upload = await admin.storage.from(BUCKET).upload(path, item.optimized, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false
    });
    if (upload.error && !upload.error.message.toLowerCase().includes("already exists")) throw upload.error;
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    const updated = await admin.from("suppliers").update({ logo_url: data.publicUrl }).eq("code", item.code).select("id,name").single();
    if (updated.error) throw updated.error;
    await admin.from("admin_audit_logs").insert({
      action: "SUPPLIER_LOGO_SYNCED",
      entity: "suppliers",
      entity_id: updated.data.id,
      message: `Logo oficial verificado y copiado a Storage propio: ${updated.data.name}.`,
      metadata: { bucket: BUCKET, path, source: item.source }
    });
  }
  console.log(`Logos aplicados: ${preview.length}.`);
}

await run();
