import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const safeString = (label: string, min = 0, max = 500) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(999)
      })
    )
    .min(1, "El carrito esta vacio."),
  customer: z.object({
    name: safeString("Nombre", 2, 120),
    email: z.string().trim().email("Ingresá un email valido.").max(160),
    phone: safeString("Telefono", 6, 40)
  }),
  shippingMethod: z.enum(["PICKUP", "DELIVERY"]),
  address: z
    .object({
      street: safeString("Calle", 0, 120).optional(),
      number: safeString("Numero", 0, 30).optional(),
      apartment: safeString("Departamento", 0, 60).optional(),
      city: safeString("Ciudad", 0, 80).optional(),
      province: safeString("Provincia", 0, 80).optional(),
      postalCode: safeString("Codigo postal", 0, 30).optional(),
      notes: safeString("Notas de direccion", 0, 240).optional(),
      distanceKm: z.coerce.number().optional(),
      deliveryAvailable: z.boolean().optional(),
      deliveryZoneSnapshot: z.string().optional()
    })
    .nullable()
    .optional(),
  notes: safeString("Notas", 0, 500).optional(),
  paymentProvider: z.enum(["MERCADOPAGO", "NARANJAX", "MOCK"]).optional()
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
