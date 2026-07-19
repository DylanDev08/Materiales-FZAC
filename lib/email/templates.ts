type AuthEmailTemplateInput = {
  name?: string | null;
  actionUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] ?? character);
}

function safeActionUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error("Enlace de autenticacion invalido.");
  return url.toString();
}

function authEmailLayout(input: { title: string; preheader: string; copy: string; actionLabel: string; actionUrl: string }) {
  const actionUrl = escapeHtml(safeActionUrl(input.actionUrl));
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#0b0b0b;color:#ffffff;font-family:Arial,sans-serif">
    <span style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b0b;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid rgba(244,196,0,.3);background:#1f1f1f">
          <tr><td style="padding:24px 28px;border-bottom:3px solid #f4c400">
            <strong style="font-size:24px;color:#f4c400">FZAC</strong>
            <div style="margin-top:4px;color:#b8b8b8;font-size:13px">Materiales para construir</div>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 14px;font-size:24px">${escapeHtml(input.title)}</h1>
            <p style="margin:0 0 22px;color:#d5d5d5;line-height:1.6">${escapeHtml(input.copy)}</p>
            <a href="${actionUrl}" style="display:inline-block;padding:13px 20px;background:#f4c400;color:#0b0b0b;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a>
            <p style="margin:22px 0 0;color:#8f8f8f;font-size:12px;line-height:1.5">Este enlace es temporal. Si no solicitaste esta accion, ignora este correo y no compartas el enlace.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function recoveryEmailTemplate(input: AuthEmailTemplateInput) {
  const name = input.name?.trim() ? ` ${input.name.trim()}` : "";
  const copy = `Hola${name}. Recibimos una solicitud para cambiar la contrasena de tu cuenta. Usa el enlace seguro para definir una nueva.`;
  return {
    subject: "Recupera tu acceso a Materiales FZAC",
    html: authEmailLayout({
      title: "Recupera tu acceso",
      preheader: "Enlace seguro para restablecer tu contrasena FZAC.",
      copy,
      actionLabel: "Cambiar contrasena",
      actionUrl: input.actionUrl
    }),
    text: `${copy}\n\nCambiar contrasena: ${safeActionUrl(input.actionUrl)}\n\nSi no solicitaste este cambio, ignora este correo.`
  };
}

export function verificationEmailTemplate(input: AuthEmailTemplateInput) {
  const name = input.name?.trim() ? ` ${input.name.trim()}` : "";
  const copy = `Hola${name}. Confirma tu email para activar la cuenta y continuar tus compras en Materiales FZAC.`;
  return {
    subject: "Confirma tu cuenta de Materiales FZAC",
    html: authEmailLayout({
      title: "Confirma tu cuenta",
      preheader: "Activa tu cuenta de Materiales FZAC.",
      copy,
      actionLabel: "Confirmar email",
      actionUrl: input.actionUrl
    }),
    text: `${copy}\n\nConfirmar email: ${safeActionUrl(input.actionUrl)}\n\nSi no creaste esta cuenta, ignora este correo.`
  };
}
