import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const safeOptionalText = (label: string, max: number) => z.string().trim().max(max)
  .refine((value) => !value || !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`)
  .transform((value) => value || null);

const safeRequiredText = (label: string, min: number, max: number) => z.string().trim().min(min, `${label} es obligatorio.`).max(max)
  .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);

export const createSupplierInvoiceSchema = z.object({
  action: z.literal("CREATE_INVOICE"),
  purchaseOrderId: z.string().uuid("Orden de compra inválida."),
  requestKey: z.string().uuid("Identificador de operación inválido."),
  invoiceNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9./-]{1,79}$/, "Ingresá un número de factura válido."),
  amount: z.coerce.number().positive("El importe debe ser mayor a cero.").multipleOf(0.01, "Usá como máximo dos decimales.").max(999_999_999_999),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de emisión inválida."),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de vencimiento inválida."),
  notes: safeOptionalText("Notas", 600)
}).refine((value) => value.dueAt >= value.issuedAt, {
  message: "El vencimiento no puede ser anterior a la emisión.",
  path: ["dueAt"]
});

export const createSupplierPaymentSchema = z.object({
  action: z.literal("CREATE_PAYMENT"),
  invoiceId: z.string().uuid("Factura inválida."),
  requestKey: z.string().uuid("Identificador de operación inválido."),
  amount: z.coerce.number().positive("El importe debe ser mayor a cero.").multipleOf(0.01, "Usá como máximo dos decimales.").max(999_999_999_999),
  method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "OTHER"]),
  reference: safeOptionalText("Referencia", 120),
  paidAt: z.string().datetime({ offset: true, message: "Fecha de pago inválida." })
    .refine((value) => new Date(value).getTime() <= Date.now() + 5 * 60_000, "La fecha de pago no puede estar en el futuro."),
  notes: safeOptionalText("Notas", 600)
});

export const voidSupplierPaymentSchema = z.object({
  action: z.literal("VOID_PAYMENT"),
  paymentId: z.string().uuid("Pago inválido."),
  reason: safeRequiredText("Motivo", 3, 240)
});

export const voidSupplierInvoiceSchema = z.object({
  action: z.literal("VOID_INVOICE"),
  invoiceId: z.string().uuid("Factura inválida."),
  reason: safeRequiredText("Motivo", 3, 240)
});

export const supplierFinancePayloadSchema = z.union([
  createSupplierInvoiceSchema,
  createSupplierPaymentSchema,
  voidSupplierPaymentSchema,
  voidSupplierInvoiceSchema
]);
