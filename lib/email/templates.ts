type AuthEmailTemplateInput = {
  name?: string | null;
  actionUrl: string;
};

type ConsumerRefundEmailInput = {
  name: string;
  requestNumber: string;
  orderNumber?: string | null;
  status?: string;
  resolutionNote?: string | null;
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
            <strong style="font-size:24px;color:#f4c400">Fortaleza Construcciones</strong>
            <div style="margin-top:4px;color:#b8b8b8;font-size:13px">Materiales FZAC para construir</div>
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
    subject: "Recupera tu acceso a Fortaleza Construcciones",
    html: authEmailLayout({
      title: "Recupera tu acceso",
      preheader: "Enlace seguro para restablecer tu contraseña en Fortaleza Construcciones.",
      copy,
      actionLabel: "Cambiar contrasena",
      actionUrl: input.actionUrl
    }),
    text: `${copy}\n\nCambiar contrasena: ${safeActionUrl(input.actionUrl)}\n\nSi no solicitaste este cambio, ignora este correo.`
  };
}

export function verificationEmailTemplate(input: AuthEmailTemplateInput) {
  const name = input.name?.trim() ? ` ${input.name.trim()}` : "";
  const copy = `Hola${name}. Confirma tu email para activar la cuenta y continuar tus compras en Fortaleza Construcciones.`;
  return {
    subject: "Confirma tu cuenta de Fortaleza Construcciones",
    html: authEmailLayout({
      title: "Confirma tu cuenta",
      preheader: "Activa tu cuenta de Fortaleza Construcciones.",
      copy,
      actionLabel: "Confirmar email",
      actionUrl: input.actionUrl
    }),
    text: `${copy}\n\nConfirmar email: ${safeActionUrl(input.actionUrl)}\n\nSi no creaste esta cuenta, ignora este correo.`
  };
}

function consumerRefundEmailLayout(input: {
  title: string;
  preheader: string;
  greeting: string;
  requestNumber: string;
  orderNumber?: string | null;
  status: string;
  copy: string;
  resolutionNote?: string | null;
  actionUrl: string;
}) {
  const actionUrl = escapeHtml(safeActionUrl(input.actionUrl));
  const detailRow = input.resolutionNote
    ? `<tr><td style="padding:8px 0;color:#b8b8b8">Detalle</td><td style="padding:8px 0;text-align:right;color:#ffffff">${escapeHtml(input.resolutionNote)}</td></tr>`
    : "";
  const orderRow = input.orderNumber
    ? `<tr><td style="padding:8px 0;color:#b8b8b8">Pedido informado</td><td style="padding:8px 0;text-align:right;color:#ffffff">${escapeHtml(input.orderNumber)}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#0b0b0b;color:#ffffff;font-family:Arial,sans-serif">
    <span style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b0b;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;border:1px solid rgba(244,196,0,.3);background:#1f1f1f">
          <tr><td style="padding:24px 28px;border-bottom:3px solid #f4c400">
            <strong style="font-size:24px;color:#f4c400">Fortaleza Construcciones</strong>
            <div style="margin-top:4px;color:#b8b8b8;font-size:13px">Constancia de atención al consumidor</div>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 14px;font-size:24px">${escapeHtml(input.title)}</h1>
            <p style="margin:0 0 10px;color:#ffffff;line-height:1.6">${escapeHtml(input.greeting)}</p>
            <p style="margin:0 0 22px;color:#d5d5d5;line-height:1.6">${escapeHtml(input.copy)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;border-top:1px solid #3a3a3a;border-bottom:1px solid #3a3a3a">
              <tr><td style="padding:8px 0;color:#b8b8b8">Número de trámite</td><td style="padding:8px 0;text-align:right;color:#f4c400;font-weight:700">${escapeHtml(input.requestNumber)}</td></tr>
              ${orderRow}
              <tr><td style="padding:8px 0;color:#b8b8b8">Estado</td><td style="padding:8px 0;text-align:right;color:#ffffff">${escapeHtml(input.status)}</td></tr>
              ${detailRow}
            </table>
            <a href="${actionUrl}" style="display:inline-block;padding:13px 20px;background:#f4c400;color:#0b0b0b;text-decoration:none;font-weight:700">Ver canal de solicitud</a>
            <p style="margin:22px 0 0;color:#8f8f8f;font-size:12px;line-height:1.5">Conservá este correo y el número de trámite. La aprobación de una solicitud no reemplaza la validación del pago y del estado de la mercadería.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function consumerRefundReceivedEmailTemplate(input: ConsumerRefundEmailInput) {
  const greeting = `Hola ${input.name.trim() || "cliente"}.`;
  const copy = "Recibimos tu solicitud y quedó registrada para revisión. FZAC se contactará por el medio que elegiste.";
  const status = "Recibida";
  return {
    subject: `Constancia FZAC ${input.requestNumber}`,
    html: consumerRefundEmailLayout({
      title: "Solicitud registrada",
      preheader: `Constancia del trámite ${input.requestNumber}.`,
      greeting,
      requestNumber: input.requestNumber,
      orderNumber: input.orderNumber,
      status,
      copy,
      actionUrl: input.actionUrl
    }),
    text: `${greeting}\n\n${copy}\n\nNúmero de trámite: ${input.requestNumber}${input.orderNumber ? `\nPedido informado: ${input.orderNumber}` : ""}\nEstado: ${status}\n\nSeguimiento: ${safeActionUrl(input.actionUrl)}`
  };
}

export function consumerRefundStatusEmailTemplate(input: ConsumerRefundEmailInput) {
  const greeting = `Hola ${input.name.trim() || "cliente"}.`;
  const status = input.status || "En revisión";
  const copy = "Actualizamos el estado de tu solicitud de atención al consumidor.";
  return {
    subject: `Actualización FZAC ${input.requestNumber}`,
    html: consumerRefundEmailLayout({
      title: "Actualización de tu solicitud",
      preheader: `Nuevo estado del trámite ${input.requestNumber}.`,
      greeting,
      requestNumber: input.requestNumber,
      orderNumber: input.orderNumber,
      status,
      copy,
      resolutionNote: input.resolutionNote,
      actionUrl: input.actionUrl
    }),
    text: `${greeting}\n\n${copy}\n\nNúmero de trámite: ${input.requestNumber}${input.orderNumber ? `\nPedido informado: ${input.orderNumber}` : ""}\nEstado: ${status}${input.resolutionNote ? `\nDetalle: ${input.resolutionNote}` : ""}\n\nSeguimiento: ${safeActionUrl(input.actionUrl)}`
  };
}
