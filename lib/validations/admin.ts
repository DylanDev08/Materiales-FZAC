import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const safeText = (label: string, min = 0, max = 600) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);

const secureHttpsUrl = z
  .string()
  .trim()
  .url("Ingresa una URL valida.")
  .max(500, "La URL es demasiado larga.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "La URL debe usar HTTPS y no incluir credenciales.");

const moneySchema = z.coerce
  .number()
  .finite("Ingresa un importe valido.")
  .max(9_999_999_999.99, "El importe supera el maximo permitido.")
  .multipleOf(0.01, "Usa como maximo dos decimales.");

const specificationsSchema = z
  .record(z.union([z.string().max(300), z.number().finite(), z.boolean()]))
  .refine((value) => Object.keys(value).length <= 40, "La ficha tecnica supera 40 campos.");

export const adminProductSchema = z.object({
  id: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid("ID de producto invalido.").optional()),
  name: safeText("Nombre", 2, 160),
  slug: safeText("Slug", 2, 180).refine(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    "El slug debe usar minusculas, numeros y guiones, sin espacios."
  ),
  sku: safeText("SKU", 2, 80).refine(
    (value) => /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value),
    "El SKU solo puede usar letras, numeros, punto, guion, barra o guion bajo."
  ),
  brand: safeText("Marca", 1, 100),
  description: safeText("Descripcion", 5, 1200),
  category_id: z.string().trim().uuid("Elegi una categoria valida antes de guardar."),
  subcategory: safeText("Subcategoria", 1, 100).default("General"),
  price: moneySchema.positive("El precio debe ser mayor a cero."),
  compare_price: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    moneySchema.min(0).nullable()
  ).optional(),
  stock: z.coerce.number().int().min(0).max(2_000_000_000),
  stock_minimum: z.coerce.number().int().min(0).max(2_000_000_000).default(5),
  availability_status: z.enum(["IN_STOCK", "OUT_OF_STOCK", "CONSULT"]).default("IN_STOCK"),
  supplier_id: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.string().uuid("Proveedor invalido.").nullable()
  ).optional(),
  unit: safeText("Unidad", 1, 40).default("unidad"),
  image_url: secureHttpsUrl.or(z.literal("")),
  gallery: z.array(secureHttpsUrl).max(12, "Podes cargar hasta 12 imagenes.").default([]),
  specifications: specificationsSchema.default({}),
  featured: z.boolean().default(false),
  on_sale: z.boolean().default(false),
  active: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.compare_price != null && Number(value.compare_price) < Number(value.price)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compare_price"],
      message: "El precio anterior no puede ser menor al precio actual."
    });
  }
});

export const adminCategorySchema = z.object({
  id: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid("Categoria invalida.").optional()),
  name: safeText("Nombre", 2, 140),
  slug: safeText("Slug", 2, 160).refine(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    "El slug debe usar minusculas, numeros y guiones."
  ),
  description: safeText("Descripcion", 2, 700),
  image_url: secureHttpsUrl.or(z.literal("")).nullable().optional(),
  parent_id: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.string().uuid("Categoria superior invalida.").nullable()
  ).optional(),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(100_000).default(0)
});

export const financialMovementSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: safeText("Categoría", 2, 80),
  description: safeText("Descripción", 3, 240),
  amount: z.coerce
    .number({ invalid_type_error: "Ingresá un importe válido." })
    .positive("El importe debe ser mayor a cero.")
    .max(999_999_999_999, "El importe supera el máximo permitido."),
  occurred_at: z.string().datetime({ offset: true, message: "Elegí una fecha válida." })
});

export const voidFinancialMovementSchema = z.object({
  id: z.string().uuid("Movimiento inválido."),
  reason: safeText("Motivo", 3, 240)
});

export const bulkVoidFinancialMovementsSchema = z.object({
  type: z.enum(["ALL", "INCOME", "EXPENSE"]),
  before: z.string().datetime({ offset: true, message: "Elegí una fecha límite válida." }),
  reason: safeText("Motivo", 8, 240),
  confirmation: z.literal("ANULAR", {
    errorMap: () => ({ message: "Escribí ANULAR para confirmar la operación." })
  })
});
