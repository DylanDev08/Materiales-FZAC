import { ZodError, z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { isTrustedMutationRequest, readLimitedJson } from "@/lib/utils/request-security";
import {
  supplierDocumentItemSchema,
  supplierDocumentMetadataSchema
} from "@/lib/validations/supplier-documents";

export const runtime = "nodejs";

const BUCKET = "supplier-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "text/csv", "application/vnd.ms-excel"]);
const documentIdSchema = z.string().uuid();

function extensionFor(type: string) {
  return type === "application/pdf" ? "pdf" : "csv";
}

function safeFileName(value: string, extension: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim().slice(0, 170);
  return normalized || `documento.${extension}`;
}

function hasExpectedSignature(bytes: Uint8Array, type: string) {
  if (type === "application/pdf") {
    return Buffer.from(bytes.slice(0, 1024)).includes(Buffer.from("%PDF-"));
  }
  return !bytes.slice(0, 1024).some((value) => value === 0);
}

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-supplier-document-download", limit: 30 });
  if (!context.ok) return context.response;
  const id = documentIdSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return jsonError("Documento inválido.", 422);

  const { data: document, error } = await context.admin
    .from("supplier_documents")
    .select("id,file_name,storage_path,status")
    .eq("id", id.data)
    .maybeSingle();
  if (error || !document || document.status !== "ACTIVE") return jsonError("Documento no disponible.", 404);

  const signed = await context.admin.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, 60, { download: document.file_name });
  if (signed.error || !signed.data?.signedUrl) return jsonError("No pudimos abrir el archivo.", 503);
  return Response.json({ url: signed.data.signedUrl }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_FILE_SIZE + 256 * 1024) {
    return jsonError("El archivo supera 10 MB.", 413);
  }

  const context = await getAdminApiContext(request, { scope: "admin-supplier-documents", limit: 20 });
  if (!context.ok) return context.response;

  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return jsonError("Seleccioná un PDF o CSV.", 422);
      if (!ALLOWED_TYPES.has(file.type)) return jsonError("Formato no permitido. Usá PDF o CSV.", 422);
      if (file.size < 1 || file.size > MAX_FILE_SIZE) return jsonError("El archivo debe pesar hasta 10 MB.", 413);

      const metadata = supplierDocumentMetadataSchema.parse({
        supplierId: formData.get("supplierId"),
        title: formData.get("title"),
        kind: formData.get("kind"),
        documentDate: formData.get("documentDate"),
        notes: formData.get("notes")
      });
      const supplier = await context.admin.from("suppliers").select("id,name").eq("id", metadata.supplierId).maybeSingle();
      if (supplier.error || !supplier.data) return jsonError("Proveedor inexistente.", 404);

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasExpectedSignature(bytes, file.type)) return jsonError("El contenido no coincide con el formato declarado.", 422);
      const extension = extensionFor(file.type);
      const storagePath = `suppliers/${metadata.supplierId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
      const upload = await context.admin.storage.from(BUCKET).upload(storagePath, bytes, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
      if (upload.error) return jsonError("No pudimos guardar el archivo privado.", 503);

      const inserted = await context.admin.from("supplier_documents").insert({
        supplier_id: metadata.supplierId,
        title: metadata.title,
        kind: metadata.kind,
        document_date: metadata.documentDate,
        file_name: safeFileName(file.name, extension),
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        notes: metadata.notes,
        created_by: context.profile.id
      }).select("id").single();
      if (inserted.error || !inserted.data) {
        await context.admin.storage.from(BUCKET).remove([storagePath]);
        return jsonError("No pudimos registrar el documento.", 409);
      }

      await context.admin.from("admin_audit_logs").insert({
        actor_id: context.profile.id,
        actor_email: context.profile.email,
        actor_role: context.profile.role,
        action: "SUPPLIER_DOCUMENT_UPLOADED",
        entity: "supplier_documents",
        entity_id: inserted.data.id,
        message: `Documento privado agregado a ${supplier.data.name}.`,
        metadata: { kind: metadata.kind, sizeBytes: file.size }
      });
      return Response.json({ ok: true, id: inserted.data.id }, { status: 201 });
    }

    const json = await readLimitedJson(request, 16 * 1024);
    if (!json.ok) return jsonError(json.message, json.status);
    const payload = supplierDocumentItemSchema.parse(json.data);
    const { data: document, error: documentError } = await context.admin
      .from("supplier_documents")
      .select("id,supplier_id,status")
      .eq("id", payload.documentId)
      .maybeSingle();
    if (documentError || !document || document.status !== "ACTIVE") return jsonError("Documento no disponible.", 404);

    const product = payload.productId
      ? await context.admin.from("products").select("id,name,sku,unit,price").eq("id", payload.productId).maybeSingle()
      : null;
    if (product?.error || (payload.productId && !product?.data)) return jsonError("Producto FZAC inexistente.", 404);

    const inserted = await context.admin.from("supplier_document_items").insert({
      document_id: document.id,
      product_id: product?.data?.id ?? null,
      supplier_sku: payload.supplierSku ?? product?.data?.sku ?? null,
      supplier_product_name: payload.supplierProductName || product?.data?.name || "Producto",
      unit: payload.unit ?? product?.data?.unit ?? null,
      supplier_price: payload.supplierPrice,
      customer_price_snapshot: product?.data ? Number(product.data.price) : null,
      supplier_stock: payload.supplierStock,
      created_by: context.profile.id
    }).select("id").single();
    if (inserted.error || !inserted.data) return jsonError("Ese producto o SKU ya está registrado en el documento.", 409);

    await context.admin.from("admin_audit_logs").insert({
      actor_id: context.profile.id,
      actor_email: context.profile.email,
      actor_role: context.profile.role,
      action: "SUPPLIER_DOCUMENT_ITEM_ADDED",
      entity: "supplier_document_items",
      entity_id: inserted.data.id,
      message: "Precio de proveedor verificado y comparado con el precio FZAC.",
      metadata: { documentId: document.id, supplierId: document.supplier_id, productId: product?.data?.id ?? null }
    });
    return Response.json({ ok: true, id: inserted.data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos.", 422);
    return jsonError("No pudimos procesar el documento.", 500);
  }
}
