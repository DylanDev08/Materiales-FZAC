import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { isTrustedMutationRequest } from "@/lib/utils/request-security";

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

function hasExpectedImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  }
  if (type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_SIZE + 128 * 1024) {
    return jsonError("La imagen supera 5 MB.", 413);
  }
  const context = await getAdminApiContext(request, { scope: "admin-product-image-upload", limit: 12 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) return jsonError("Selecciona una imagen valida.", 422);
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Formato no permitido. Usa JPG, PNG o WebP.", 422);
  if (file.size > MAX_IMAGE_SIZE) return jsonError("La imagen supera 5 MB.", 413);

  const bucket = getBucketName();
  const path = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const bytes = await file.arrayBuffer();
  if (!hasExpectedImageSignature(new Uint8Array(bytes.slice(0, 16)), file.type)) {
    return jsonError("El contenido del archivo no coincide con una imagen válida.", 422);
  }
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
    actor_role: profile.role,
    action: "PRODUCT_IMAGE_UPLOADED",
    entity: "storage.objects",
    entity_id: path,
    message: `Imagen de producto subida al bucket ${bucket}.`
  });

  return Response.json({ url: data.publicUrl, path, bucket });
}
