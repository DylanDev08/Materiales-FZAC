import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const safeText = (label: string, min = 0, max = 600) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);

export const adminProductSchema = z.object({
  id: z.string().optional(),
  name: safeText("Nombre", 2, 160),
  slug: safeText("Slug", 2, 180),
  sku: safeText("SKU", 2, 80),
  brand: safeText("Marca", 1, 100),
  description: safeText("Descripcion", 5, 1200),
  category_id: z.string().trim().min(1),
  subcategory: safeText("Subcategoria", 1, 100).default("General"),
  price: z.coerce.number().min(0),
  compare_price: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().int().min(0),
  stock_minimum: z.coerce.number().int().min(0).default(5),
  unit: safeText("Unidad", 1, 40).default("unidad"),
  image_url: z.string().trim().url().or(z.literal("")),
  gallery: z.array(z.string().url()).default([]),
  specifications: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  featured: z.boolean().default(false),
  on_sale: z.boolean().default(false),
  active: z.boolean().default(true)
});

export const adminCategorySchema = z.object({
  id: z.string().optional(),
  name: safeText("Nombre", 2, 140),
  slug: safeText("Slug", 2, 160),
  description: safeText("Descripcion", 2, 700),
  image_url: z.string().trim().url().or(z.literal("")).nullable().optional(),
  parent_id: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0)
});
