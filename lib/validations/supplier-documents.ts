import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const optionalText = (label: string, max: number) => z.string().trim().max(max)
  .refine((value) => !value || !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`)
  .transform((value) => value || null);

export const supplierDocumentMetadataSchema = z.object({
  supplierId: z.string().uuid("Proveedor inválido."),
  title: z.string().trim().min(2, "Ingresá un título.").max(160)
    .refine((value) => !hasSqlMeta(value), "El título contiene caracteres no permitidos."),
  kind: z.enum(["PRICE_LIST", "CATALOG", "QUOTE", "INVOICE", "OTHER"]),
  documentDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."), z.literal("")])
    .transform((value) => value || null),
  notes: optionalText("Notas", 600)
});

export const supplierDocumentItemSchema = z.object({
  action: z.literal("ADD_ITEM"),
  documentId: z.string().uuid("Documento inválido."),
  productId: z.union([z.string().uuid("Producto inválido."), z.literal("")]).transform((value) => value || null),
  supplierProductName: z.string().trim().min(2, "Ingresá el producto del proveedor.").max(180)
    .refine((value) => !hasSqlMeta(value), "El producto contiene caracteres no permitidos."),
  supplierSku: optionalText("SKU proveedor", 100),
  unit: optionalText("Unidad", 40),
  supplierPrice: z.coerce.number().positive("El precio proveedor debe ser mayor a cero.").max(999_999_999_999),
  supplierStock: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? null : value,
    z.coerce.number().min(0).max(999_999_999_999).nullable()
  )
});
