import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";
import type { PaymentProvider } from "@/types/domain";

const safeString = (label: string, min = 0, max = 500) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);

const checkoutItemSchema = z
  .object({
    productId: z.string().min(1).optional(),
    product_id: z.string().min(1).optional(),
    sku: z.string().trim().min(1).max(80).optional(),
    slug: z.string().trim().min(1).max(180).optional(),
    quantity: z.coerce.number().int().min(1).max(999)
  })
  .superRefine((value, context) => {
    if (!value.productId && !value.product_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["product_id"],
        message: "Falta producto en el carrito."
      });
    }
  })
  .transform((value) => ({
    productId: value.productId ?? value.product_id ?? "",
    sku: value.sku,
    slug: value.slug,
    quantity: value.quantity
  }));

const addressSchema = z
  .object({
    street: safeString("Calle", 0, 120).optional(),
    number: safeString("Numero", 0, 30).optional(),
    apartment: safeString("Departamento", 0, 60).optional(),
    city: safeString("Ciudad", 0, 80).optional(),
    province: safeString("Provincia", 0, 80).optional(),
    postalCode: safeString("Codigo postal", 0, 30).optional(),
    postal_code: safeString("Codigo postal", 0, 30).optional(),
    notes: safeString("Notas de direccion", 0, 240).optional()
  })
  .transform((value) => ({
    street: value.street,
    number: value.number,
    apartment: value.apartment,
    city: value.city,
    province: value.province,
    postalCode: value.postalCode ?? value.postal_code,
    notes: value.notes
  }));

export const checkoutSchema = z.object({
  items: z
    .array(checkoutItemSchema)
    .min(1, "El carrito esta vacio."),
  customer: z.object({
    name: safeString("Nombre", 2, 120),
    email: z.string().trim().email("Ingresa un email valido.").max(160),
    phone: safeString("Telefono", 6, 40)
  }),
  shippingMethod: z.enum(["PICKUP", "DELIVERY"]),
  address: addressSchema
    .nullable()
    .optional(),
  notes: safeString("Notas", 0, 500).optional(),
  paymentProvider: z.enum(["MERCADOPAGO", "NARANJAX"]).optional()
});

export const checkoutCreateSchema = z
  .object({
    customer_name: safeString("Nombre", 2, 120),
    customer_email: z.string().trim().email("Ingresa un email valido.").max(160),
    customer_phone: safeString("Telefono", 6, 40),
    shipping_method: z.enum(["PICKUP", "DELIVERY"]),
    address_snapshot: addressSchema.nullable().optional(),
    notes: safeString("Notas", 0, 500).optional(),
    items: z.array(checkoutItemSchema).min(1, "El carrito esta vacio.")
  })
  .transform((value) => ({
    items: value.items,
    customer: {
      name: value.customer_name,
      email: value.customer_email,
      phone: value.customer_phone
    },
    shippingMethod: value.shipping_method,
    address: value.address_snapshot ?? null,
    notes: value.notes,
    paymentProvider: "MERCADOPAGO" as PaymentProvider
  }));

export type CheckoutInput = z.infer<typeof checkoutSchema>;
