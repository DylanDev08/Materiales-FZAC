import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";
import type { PaymentFlow, PaymentMethod, PaymentProvider } from "@/types/domain";

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

const requiredCheckoutAddressSchema = addressSchema.refine(
  (value) => Boolean(value.street?.trim() && value.number?.trim() && value.city?.trim() && value.province?.trim()),
  "Completa la direccion del comprador para continuar."
);

export const checkoutSchema = z.object({
  items: z
    .array(checkoutItemSchema)
    .min(1, "El carrito esta vacio."),
  customer: z.object({
    name: safeString("Nombre", 2, 120),
    email: z.string().trim().email("Ingresa un email valido.").max(160),
    phone: safeString("Telefono", 8, 40)
  }),
  shippingMethod: z.enum(["PICKUP", "DELIVERY"]),
  address: requiredCheckoutAddressSchema,
  notes: safeString("Notas", 0, 500).optional(),
  paymentProvider: z.enum(["MERCADOPAGO", "NARANJAX"]).optional(),
  paymentMethod: z.enum(["MERCADOPAGO", "BANK_TRANSFER", "WHATSAPP"]).optional(),
  paymentFlow: z.enum(["CHECKOUT_PRO", "CARD", "TRANSFER", "WHATSAPP"]).optional(),
  idempotencyKey: safeString("Intento de compra", 8, 120).optional()
});

const checkoutCreateFieldsSchema = z.object({
  customer_name: safeString("Nombre", 2, 120),
  customer_email: z.string().trim().email("Ingresa un email valido.").max(160),
  customer_phone: safeString("Telefono", 8, 40),
  shipping_method: z.enum(["PICKUP", "DELIVERY"]),
  address_snapshot: requiredCheckoutAddressSchema,
  notes: safeString("Notas", 0, 500).optional(),
  payment_method: z.enum(["MERCADOPAGO", "BANK_TRANSFER", "WHATSAPP"]).optional(),
  payment_flow: z.enum(["CHECKOUT_PRO", "CARD", "TRANSFER", "WHATSAPP"]).optional(),
  idempotency_key: safeString("Intento de compra", 8, 120).optional(),
  items: z.array(checkoutItemSchema).min(1, "El carrito esta vacio.")
});

function checkoutCreateTransform(value: z.infer<typeof checkoutCreateFieldsSchema>) {
  const fallbackMethod =
    value.payment_flow === "TRANSFER" ? "BANK_TRANSFER" : value.payment_flow === "WHATSAPP" ? "WHATSAPP" : "MERCADOPAGO";

  return {
    items: value.items,
    customer: {
      name: value.customer_name,
      email: value.customer_email,
      phone: value.customer_phone
    },
    shippingMethod: value.shipping_method,
    address: value.address_snapshot,
    notes: value.notes,
    paymentProvider: "MERCADOPAGO" as PaymentProvider,
    paymentMethod: (value.payment_method ?? fallbackMethod) as PaymentMethod,
    paymentFlow: (value.payment_flow ?? "CHECKOUT_PRO") as PaymentFlow,
    idempotencyKey: value.idempotency_key
  };
}

export const checkoutCreateSchema = checkoutCreateFieldsSchema
  .transform((value) => ({
    ...checkoutCreateTransform(value)
  }));

export const checkoutCardCreateSchema = checkoutCreateFieldsSchema
  .extend({
    payment_flow: z.literal("CARD").optional(),
    card: z.object({
      token: safeString("Token de tarjeta", 8, 220),
      payment_method_id: safeString("Medio de pago", 2, 60),
      issuer_id: safeString("Banco emisor", 0, 80).optional(),
      installments: z.coerce.number().int().min(1).max(24),
      identification_type: safeString("Tipo de documento", 2, 20),
      identification_number: safeString("Documento", 5, 20),
      cardholder_email: z.string().trim().email("Ingresa un email valido.").max(160)
    })
  })
  .transform((value) => ({
    checkout: checkoutCreateTransform({ ...value, payment_flow: "CARD" }),
    card: value.card
  }));

export type CheckoutInput = z.infer<typeof checkoutSchema>;
