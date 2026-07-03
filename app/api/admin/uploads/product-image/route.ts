import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getBucketName() {
  return process.env.SUPABASE_PRODUCT_IMAGES_BUCKET?.trim() || "product-images";
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("No podemos subir imagenes en este momento.", 500);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) return jsonError("Selecciona una imagen valida.", 422);
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Formato no permitido. Usa JPG, PNG o WebP.", 422);
  if (file.size > MAX_IMAGE_SIZE) return jsonError("La imagen supera 5 MB.", 413);

  const bucket = getBucketName();
  const path = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const bytes = await file.arrayBuffer();
  const { error } = await admin.storage.from(bucket).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false
  });

  if (error) return jsonError("No pudimos subir la imagen al bucket de Supabase.", 400);

  const { data } = admin.storage.from(bucket).getPublicUrl(path);

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    action: "PRODUCT_IMAGE_UPLOADED",
    entity: "storage.objects",
    entity_id: path,
    message: `Imagen de producto subida al bucket ${bucket}.`
  });

  return Response.json({ url: data.publicUrl, path, bucket });
}
