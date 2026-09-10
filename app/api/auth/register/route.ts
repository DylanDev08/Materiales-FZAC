import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSignupWithResend } from "@/lib/auth/email-auth";
import { createLegalAcceptance, legalAcceptanceUserMetadata } from "@/lib/legal/versions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { registerSchema } from "@/lib/validations/auth";
import { normalizeArgentinePhone } from "@/lib/validations/security";

function authErrorMessage(message: string) {
  if (/rate limit|too many|over_email_send_rate_limit/i.test(message)) {
    return "No pudimos enviar el email de confirmación por límite temporal. Esperá unos minutos y volvé a probar.";
  }
  if (/password|character of each|uppercase|lowercase|0123456789|symbol/i.test(message)) {
    return "La contraseña debe tener mayúscula, minúscula, número y símbolo.";
  }
  return "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.";
}

const genericRegistrationMessage =
  "Si el email puede registrarse, vas a recibir un enlace de Fortaleza Construcciones para confirmar el acceso.";

function genericRegistrationResponse() {
  return Response.json({ target: "/login?registered=true", message: genericRegistrationMessage });
}

async function findRegistrationDuplicate(input: { email: string; name: string; phone?: string | null }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const checks = [
    admin.from("profiles").select("id").eq("email", input.email).limit(1).maybeSingle(),
    admin.from("profiles").select("id").ilike("full_name", input.name.trim()).limit(1).maybeSingle()
  ];
  if (input.phone) checks.push(admin.from("profiles").select("id").eq("phone", input.phone).limit(1).maybeSingle());

  const [emailResult, nameResult, phoneResult] = await Promise.all(checks);
  if (emailResult?.data) return "email" as const;
  if (nameResult?.data) return "name" as const;
  if (phoneResult?.data) return "phone" as const;
  return null;
}

function duplicateMessage(kind: "email" | "name" | "phone") {
  if (kind === "email") return "Ya existe una cuenta registrada con ese email. Probá iniciar sesión o recuperar el acceso.";
  if (kind === "phone") return "Ya existe una cuenta registrada con ese teléfono. Usá otro número o recuperá tu cuenta.";
  return "Ya existe una cuenta registrada con ese nombre. Revisá tus datos o comunicate con FZAC si necesitás ayuda.";
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 8 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const limit = rateLimit(getRequestKey(request, "auth-register"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));

  try {
    const payload = registerSchema.parse(await request.json());
    const normalizedPhone = payload.phone ? normalizeArgentinePhone(payload.phone) : "";
    const emailLimit = rateLimit(`auth-register-email:${payload.email}`, 3, 30 * 60_000);
    if (!emailLimit.ok) return jsonError("Ya procesamos una solicitud para este email. Revisá tu casilla o esperá antes de reintentar.", 429, retryAfterHeaders(emailLimit));
    const siteUrl = getRequestSiteUrl(request);
    const admin = getSupabaseAdminClient();
    const legalAcceptance = createLegalAcceptance("REGISTER_EMAIL");
    const duplicate = await findRegistrationDuplicate({ email: payload.email, name: payload.name, phone: normalizedPhone });
    if (duplicate) return jsonError(duplicateMessage(duplicate), 409);

    let user = null;
    const resendSignup = await createSignupWithResend({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      phone: normalizedPhone || null,
      siteUrl,
      legalAcceptance
    });

    if (resendSignup) {
      user = resendSignup.user;
    } else {
      const supabase = await getSupabaseServerClient();
      if (!supabase) return jsonError("El registro no esta disponible en este momento.", 503);

      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.name,
            phone: normalizedPhone || null,
            ...legalAcceptanceUserMetadata(legalAcceptance)
          },
          emailRedirectTo: `${siteUrl}/auth/callback`
        }
      });

      if (error) {
        const duplicate = /already|registered|exists/i.test(error.message);
        const passwordPolicy = /password|character of each|uppercase|lowercase|0123456789|symbol/i.test(error.message);
        const emailRateLimit = /rate limit|too many|over_email_send_rate_limit/i.test(error.message);
        if (duplicate) return genericRegistrationResponse();
        return jsonError(
          authErrorMessage(error.message),
          passwordPolicy ? 422 : emailRateLimit ? 429 : 400
        );
      }
      user = data.user;
    }

    if (admin && user?.id) {
      await admin.from("admin_audit_logs").insert({
        actor_email: payload.email,
        actor_role: isAdminEmail(payload.email) ? "ADMIN" : "CUSTOMER",
        action: "LEGAL_ACCEPTANCE_RECORDED",
        entity: "profiles",
        entity_id: user.id,
        message: "Aceptación de términos y privacidad durante el registro.",
        metadata: legalAcceptance
      });
    }

    if (admin && user?.id && isAdminEmail(payload.email)) {
      await admin.from("profiles").upsert(
        {
          id: user.id,
          email: payload.email,
          full_name: payload.name,
          phone: normalizedPhone || null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role: "ADMIN",
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      );
    }

    return genericRegistrationResponse();
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    if (error instanceof Error && /already|registered|exists/i.test(error.message)) {
      return genericRegistrationResponse();
    }
    if (error instanceof Error && /password|character of each|uppercase|lowercase|0123456789|symbol/i.test(error.message)) {
      return jsonError("La contraseña debe tener mayúscula, minúscula, número y símbolo.", 422);
    }
    if (error instanceof Error && /rate limit|too many|over_email_send_rate_limit/i.test(error.message)) {
      return jsonError("No pudimos enviar el email de confirmación por límite temporal. Esperá unos minutos y volvé a probar.", 429);
    }
    return jsonError("No pudimos crear la cuenta.", 500);
  }
}
