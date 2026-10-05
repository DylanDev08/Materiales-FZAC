import "server-only";

export type BankTransferDetails = {
  alias: string;
  cvu: string;
  holder: string;
};

export function getBankTransferDetails(): BankTransferDetails | null {
  const alias = String(process.env.FZAC_BANK_ALIAS ?? "").trim();
  const cvu = String(process.env.FZAC_BANK_CVU ?? "").replace(/\s+/g, "").trim();
  const holder = String(process.env.FZAC_BANK_ACCOUNT_HOLDER ?? "").trim();
  if (!alias || !cvu || !holder) return null;
  return { alias, cvu, holder };
}

function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ");
}

function pdfEscape(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

export function createBankTransferPdf(input: {
  details: BankTransferDetails;
  orderReference?: string | null;
  amount?: number | null;
}) {
  const lines = [
    "FZAC MATERIALES - DATOS PARA TRANSFERENCIA",
    "",
    `Alias: ${input.details.alias}`,
    `CVU: ${input.details.cvu}`,
    `Titular: ${input.details.holder}`,
    ...(input.orderReference ? ["", `Pedido: ${input.orderReference}`] : []),
    ...(typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0
      ? [`Total del pedido: ${money(input.amount)}`]
      : []),
    "",
    "IMPORTANTE",
    "Realiza la transferencia unicamente por el monto confirmado en este chat.",
    "Luego envia el comprobante por WhatsApp.",
    "El pago queda pendiente hasta que un responsable de FZAC lo valide.",
    "Una vez aprobado, coordinamos proveedor, retiro/despacho y flete.",
    "",
    "Si tu pedido requiere envio, comparti tambien tu ubicacion exacta por WhatsApp."
  ];

  const streamLines = ["BT", "/F1 18 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index === 0) {
      streamLines.push(`(${pdfEscape(line)}) Tj`);
      streamLines.push("/F1 11 Tf");
      return;
    }
    streamLines.push("0 -24 Td");
    streamLines.push(`(${pdfEscape(line)}) Tj`);
  });
  streamLines.push("ET");
  const stream = streamLines.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(stream).byteLength} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(new TextEncoder().encode(pdf).byteLength);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
