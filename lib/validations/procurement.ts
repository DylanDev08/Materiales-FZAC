import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const safeText = (label: string, min: number, max: number) => z.string().trim().min(min, `${label} es obligatorio.`).max(max)
  .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);
const optionalText = (label: string, max: number) => z.string().trim().max(max)
  .refine((value) => !value || !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`)
  .transform((value) => value || null);

export const supplierPayloadSchema = z.object({
  action: z.literal("SAVE_SUPPLIER"),
  id: z.string().uuid("Proveedor inválido.").optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, "Usá un código de 2 a 40 caracteres."),
  name: safeText("Nombre", 2, 140),
  contactName: optionalText("Contacto", 120),
  email: z.union([z.string().trim().email("Ingresá un email válido.").max(180), z.literal("")]).transform((value) => value || null),
  phone: z.union([z.string().trim().regex(/^[+0-9()\s-]{6,30}$/, "Ingresá un teléfono válido."), z.literal("")]).transform((value) => value || null),
  taxId: z.union([z.string().trim().regex(/^[0-9-]{7,20}$/, "Ingresá un CUIT o identificación válida."), z.literal("")]).transform((value) => value || null),
  paymentTerms: optionalText("Condiciones de pago", 180),
  leadTimeDays: z.coerce.number().int().min(1).max(120),
  notes: optionalText("Notas", 600),
  active: z.boolean().default(true)
});

const orderItemSchema = z.object({
  productId: z.string().uuid("Producto inválido."),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser mayor a cero.").max(1_000_000),
  unitCost: z.coerce.number().positive("El costo debe ser mayor a cero.").max(999_999_999_999)
});

export const createPurchaseOrderSchema = z.object({
  action: z.literal("CREATE_ORDER"),
  supplierId: z.string().uuid("Elegí un proveedor válido."),
  requestKey: z.string().uuid("Identificador de operación inválido."),
  expectedAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha esperada inválida."), z.literal("")]).transform((value) => value || null),
  notes: optionalText("Notas", 600),
  items: z.array(orderItemSchema).min(1, "Agregá al menos un producto.").max(50)
}).superRefine((value, context) => {
  const uniqueProducts = new Set(value.items.map((item) => item.productId));
  if (uniqueProducts.size !== value.items.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "No repitas productos en la misma orden.", path: ["items"] });
});

export const orderPurchaseSchema = z.object({
  action: z.literal("ORDER_PURCHASE"),
  orderId: z.string().uuid("Orden inválida.")
});

export const cancelPurchaseSchema = z.object({
  action: z.literal("CANCEL_PURCHASE"),
  orderId: z.string().uuid("Orden inválida."),
  reason: safeText("Motivo", 3, 240)
});

export const receivePurchaseSchema = z.object({
  action: z.literal("RECEIVE_PURCHASE"),
  orderId: z.string().uuid("Orden inválida."),
  items: z.array(z.object({
    itemId: z.string().uuid("Producto de orden inválido."),
    quantity: z.coerce.number().int().min(1).max(1_000_000)
  })).min(1, "Indicá al menos una cantidad recibida.").max(50)
});

export const procurementPayloadSchema = z.union([
  supplierPayloadSchema,
  createPurchaseOrderSchema,
  orderPurchaseSchema,
  cancelPurchaseSchema,
  receivePurchaseSchema
]);
