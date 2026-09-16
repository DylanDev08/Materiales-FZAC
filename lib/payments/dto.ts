import { z } from "zod";

export const publicPaymentSummarySchema = z.object({
  status: z.string().max(40),
  provider: z.string().max(40),
  amount: z.number().finite().nonnegative(),
  currency: z.string().min(3).max(3),
  updated_at: z.string().datetime().nullable()
});

export type PublicPaymentSummary = z.infer<typeof publicPaymentSummarySchema>;

export function toPublicPaymentSummary(payment: Record<string, unknown> | null | undefined): PublicPaymentSummary | null {
  if (!payment) return null;
  return publicPaymentSummarySchema.parse({
    status: String(payment.status ?? "PENDING"),
    provider: String(payment.provider ?? ""),
    amount: Number(payment.amount ?? 0),
    currency: String(payment.currency ?? "ARS").toUpperCase(),
    updated_at: payment.updated_at ? String(payment.updated_at) : null
  });
}
