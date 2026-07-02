import { z } from "zod";
import { hasSqlMeta } from "@/lib/validations/security";

const COMMON_PASSWORDS = ["123456", "12345678", "password", "qwerty", "admin", "fzac123", "fortaleza"];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function passwordChecks(password: string, email = "", name = "") {
  const normalizedPassword = password.toLowerCase();
  const emailLocal = normalizeEmail(email).split("@")[0] ?? "";
  const normalizedName = name.trim().toLowerCase();

  return [
    { id: "length", label: "8 caracteres minimo", ok: password.length >= 8 },
    { id: "upper", label: "Una mayuscula", ok: /[A-Z]/.test(password) },
    { id: "lower", label: "Una minuscula", ok: /[a-z]/.test(password) },
    { id: "number", label: "Un numero", ok: /\d/.test(password) },
    { id: "symbol", label: "Un simbolo", ok: /[^A-Za-z0-9]/.test(password) },
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

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un email valido.").transform(normalizeEmail),
  password: z.string().min(1, "Ingresa tu contrasena."),
  hp: z.string().max(0).optional()
});

export const registerSchema = z
  .object({
    name: safeText("Nombre", 2, 120),
    phone: safeText("Telefono", 6, 40).optional().or(z.literal("")),
    email: z.string().trim().email("Ingresa un email valido.").transform(normalizeEmail),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
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
