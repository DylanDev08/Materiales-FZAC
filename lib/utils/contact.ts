const DEFAULT_WHATSAPP = "5493415847000";

export function getFzacWhatsAppNumber() {
  return (process.env.NEXT_PUBLIC_FZAC_WHATSAPP || DEFAULT_WHATSAPP).replace(/\D/g, "");
}

export function getWhatsAppHref(message = "Hola FZAC, necesito ayuda con mi compra.") {
  const phone = getFzacWhatsAppNumber() || DEFAULT_WHATSAPP;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Enlaces administrativos hacia el comprador, nunca hacia el número público de FZAC.
 * Acepta celulares argentinos de 10 dígitos, +54 y +549. Ante formatos
 * desconocidos no crea enlaces que puedan enviar información a otro destinatario.
 */
export function getCustomerWhatsAppHref(phone: string | number | null | undefined, message: string): string | null {
  const raw = String(phone ?? "").trim();
  if (!raw || !/^[+\\d().\\s-]+$/.test(raw)) return null;
  const digits = raw.replace(/\\D/g, "");
  const local = digits.length === 10
    ? digits
    : digits.length === 12 && digits.startsWith("54")
      ? digits.slice(2)
      : digits.length === 13 && digits.startsWith("549")
        ? digits.slice(3)
        : null;
  if (!local || local.length !== 10) return null;
  return `https://wa.me/549${local}?text=${encodeURIComponent(message)}`;
}
