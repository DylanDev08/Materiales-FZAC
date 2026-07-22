import { z } from "zod";
import { hasSqlMeta, isValidArgentinePhone } from "@/lib/validations/security";

const COMMON_PASSWORDS = ["123456", "12345678", "password", "qwerty", "admin", "fzac123"];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function passwordChecks(password: string, email = "", name = "") {
  const normalizedPassword = password.toLowerCase();
  const emailLocal = normalizeEmail(email).split("@")[0] ?? "";
  const normalizedName = name.trim().toLowerCase();

  return [
    { id: "length", label: "8 caracteres minimo", ok: password.length >= 8 },
    { id: "lowercase", label: "Una minúscula", ok: /[a-z]/.test(password) },
    { id: "uppercase", label: "Una mayúscula", ok: /[A-Z]/.test(password) },
    { id: "number", label: "Un número", ok: /\d/.test(password) },
    { id: "symbol", label: "Un símbolo", ok: /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~.]/.test(password) },
    { id: "trim", label: "Sin espacios al inicio o final", ok: password === password.trim() },
    { id: "common", label: "No comun ni obvia", ok: !COMMON_PASSWORDS.some((item) => normalizedPassword.includes(item)) },
    {
      id: "personal",
      label: "No contiene email o nombre",
      ok:
        (!emailLocal || !normalizedPassword.includes(emailLocal)) &&
        (!normalizedName || !normalizedPassword.includes(normalizedName))
    }
  ];
}

export function validatePassword(password: string, email = "", name = "") {
  const failed = passwordChecks(password, email, name).filter((check) => !check.ok);
  if (failed.length) throw new Error(`La contrasena no cumple: ${failed.map((check) => check.label).join(", ")}.`);
}

const safeText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} es obligatorio.`)
    .max(max)
    .refine((value) => !hasSqlMeta(value), `${label} contiene caracteres no permitidos.`);

const nameSchema = safeText("Nombre", 2, 120).refine(
  (value) => /^[\p{L}\p{M}\s.'-]+$/u.test(value),
  "Completa tu nombre con caracteres validos."
);

const phoneSchema = safeText("Teléfono", 1, 18).refine(
  isValidArgentinePhone,
  "Ingresá un teléfono argentino válido: 10 dígitos, 54 + 10 dígitos o 549 + 10 dígitos."
);

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo.")
  .max(128, "La contrasena es demasiado larga.")
  .refine((value) => value === value.trim(), "La contrasena no puede empezar o terminar con espacios.")
  .refine((value) => /[a-z]/.test(value), "La contraseña debe tener al menos una minúscula.")
  .refine((value) => /[A-Z]/.test(value), "La contraseña debe tener al menos una mayúscula.")
  .refine((value) => /\d/.test(value), "La contraseña debe tener al menos un número.")
  .refine((value) => /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~.]/.test(value), "La contraseña debe tener al menos un símbolo.");

const loginPasswordSchema = z
  .string()
  .min(1, "Ingresá tu contraseña.")
  .max(128, "La contraseña es demasiado larga.");

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido.").transform(normalizeEmail),
  password: loginPasswordSchema,
  hp: z.string().max(0).optional()
});

export const registerSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema.optional().or(z.literal("")),
    email: z.string().trim().email("Ingresá un email válido.").transform(normalizeEmail),
    password: passwordSchema,
    confirmPassword: z.string().min(8, "Confirma la contrasena con al menos 8 caracteres."),
    acceptedTerms: z.literal(true, { errorMap: () => ({ message: "Debes aceptar terminos y privacidad." }) }),
    hp: z.string().max(0).optional()
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Las contrasenas no coinciden." });
    }

    for (const check of passwordChecks(value.password, value.email, value.name)) {
      if (!check.ok) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: `La contrasena debe cumplir: ${check.label}.` });
      }
    }
  });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(8, "Confirma la contrasena con al menos 8 caracteres.")
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Las contrasenas no coinciden." });
    }
    for (const check of passwordChecks(value.password)) {
      if (!check.ok) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: `La contrasena debe cumplir: ${check.label}.` });
      }
    }
  });
