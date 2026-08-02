import { z } from "zod";
import { ASSISTANT_INTENTS } from "@/lib/assistant/contracts";
import { isSafePlainText } from "@/lib/validations/security";

const safeText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum).refine(isSafePlainText, "El texto contiene contenido no permitido.");

const internalHref = z
  .string()
  .trim()
  .max(180)
  .regex(/^\/(?!\/)[A-Za-z0-9_?=&/%.-]*$/, "Usá una ruta interna válida.");

const actionSchema = z
  .object({
    label: safeText(2, 80),
    href: internalHref.optional(),
    message: safeText(2, 180).optional()
  })
  .refine((action) => Boolean(action.href) !== Boolean(action.message), "Cada acción necesita un enlace o mensaje.");

export const assistantKnowledgeSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: safeText(2, 100),
  topic: safeText(2, 60),
  intent: z.enum(ASSISTANT_INTENTS),
  keywords: z.array(safeText(2, 50)).max(30).default([]),
  phrases: z.array(safeText(2, 100)).max(20).default([]),
  answer: safeText(20, 1200),
  alternate_answer: safeText(20, 1200).nullable().optional(),
  source_label: safeText(2, 100),
  source_href: internalHref,
  actions: z.array(actionSchema).max(4).default([]),
  active: z.boolean().default(true)
});

export type AssistantKnowledgePayload = z.infer<typeof assistantKnowledgeSchema>;
