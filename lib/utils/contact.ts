const DEFAULT_WHATSAPP = "5493415847000";

export function getFzacWhatsAppNumber() {
  return (process.env.NEXT_PUBLIC_FZAC_WHATSAPP || DEFAULT_WHATSAPP).replace(/\D/g, "");
}

export function getWhatsAppHref(message = "Hola FZAC, necesito ayuda con mi compra.") {
  const phone = getFzacWhatsAppNumber() || DEFAULT_WHATSAPP;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
