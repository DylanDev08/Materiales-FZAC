import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { OrderReceipt } from "@/lib/db/receipts";

type Identity = {
  commercialName: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
};

const PAGE_W = 595;
const PAGE_H = 842;
const GOLD = "0.957 0.769 0";
const BLACK = "0.035 0.035 0.035";
const DARK = "0.12 0.12 0.12";
const MUTED = "0.42 0.42 0.42";

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xFF]/g, "");
}

function esc(value: unknown) {
  return clean(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function money(value: number) {
  return clean(new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value));
}

function date(value: string) {
  return clean(new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value)));
}

function t(x: number, y: number, size: number, value: unknown, bold = false, color = BLACK) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${esc(value)}) Tj ET\n`;
}

function rect(x: number, y: number, w: number, h: number, color: string) {
  return `q ${color} rg ${x} ${y} ${w} ${h} re f Q\n`;
}

function line(x1: number, y1: number, x2: number, y2: number, color = "0.82 0.82 0.82", width = 0.7) {
  return `q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q\n`;
}

function wrap(value: string, max = 42, lines = 2) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= max) {
      current = next;
      continue;
    }
    if (current) out.push(current);
    current = word;
    if (out.length >= lines - 1) break;
  }
  if (current && out.length < lines) out.push(current);
  if (words.join(" ").length > out.join(" ").length && out.length) {
    out[out.length - 1] = `${out[out.length - 1].slice(0, Math.max(0, max - 3))}...`;
  }
  return out;
}

function streamObject(content: Buffer) {
  return Buffer.concat([
    Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
    content,
    Buffer.from("\nendstream", "latin1")
  ]);
}

async function logoJpeg() {
  const source = await readFile(path.join(process.cwd(), "public", "logoFZAC.jpg"));
  return sharp(source)
    .resize({ width: 120, height: 120, fit: "cover" })
    .flatten({ background: "#050505" })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
}

function pageContent(
  receipt: NonNullable<OrderReceipt>,
  identity: Identity,
  items: NonNullable<OrderReceipt>["items"],
  pageIndex: number,
  pageCount: number,
  isLast: boolean
) {
  let s = "";
  s += rect(0, 0, PAGE_W, PAGE_H, "1 1 1");

  const left = 34;
  const right = 561;
  const width = right - left;

  // Header: clean commercial document, inspired by purchase-order layout.
  s += `q 72 0 0 72 ${left} ${PAGE_H - 102} cm /Im1 Do Q\n`;
  s += t(118, PAGE_H - 50, 15, identity.commercialName || "FZAC Materiales", true, BLACK);
  s += t(118, PAGE_H - 68, 8.5, identity.address || "Rosario, Santa Fe", false, DARK);
  if (identity.taxId) s += t(118, PAGE_H - 84, 8, `CUIT ${identity.taxId}`, false, DARK);

  s += t(375, PAGE_H - 44, 17, "COMPROBANTE DE COMPRA", true, BLACK);
  s += t(433, PAGE_H - 63, 8, "FECHA", true, MUTED);
  s += t(485, PAGE_H - 63, 8.5, date(receipt.issuedAt), false, DARK);
  s += t(433, PAGE_H - 79, 8, "N°", true, MUTED);
  s += t(485, PAGE_H - 79, 8.5, receipt.number, true, DARK);
  s += t(433, PAGE_H - 95, 8, "REF.", true, MUTED);
  s += t(485, PAGE_H - 95, 8.5, receipt.reference, false, DARK);

  s += rect(left, PAGE_H - 126, width, 5, GOLD);
  let y = PAGE_H - 148;

  if (pageIndex === 0) {
    // Two-column identity block.
    const colGap = 18;
    const colW = (width - colGap) / 2;

    s += rect(left, y - 17, colW, 20, BLACK);
    s += t(left + 10, y - 11, 8, "CLIENTE", true, "1 1 1");
    s += rect(left + colW + colGap, y - 17, colW, 20, BLACK);
    s += t(left + colW + colGap + 10, y - 11, 8, "ENTREGA / RETIRO", true, "1 1 1");

    y -= 34;
    s += t(left + 2, y, 10.5, receipt.customer.name, true);
    s += t(left + 2, y - 16, 8, receipt.customer.email, false, DARK);
    s += t(left + 2, y - 31, 8, receipt.customer.phone, false, DARK);

    const shipX = left + colW + colGap + 2;
    s += t(shipX, y, 10, receipt.shipping.method, true);
    const shipLines = wrap(receipt.shipping.address, 38, 3);
    shipLines.forEach((row, i) => { s += t(shipX, y - 16 - i * 13, 7.8, row, false, DARK); });

    y -= 58;
    s += rect(left, y - 17, width, 20, GOLD);
    s += t(left + 10, y - 11, 8, "PAGO / OPERACIÓN", true, BLACK);

    y -= 33;
    s += t(left + 2, y, 8, "Medio de pago", true, MUTED);
    s += t(left + 88, y, 8.5, receipt.payment.provider, false, DARK);
    s += t(left + 230, y, 8, "Estado", true, MUTED);
    s += t(left + 275, y, 8.5, receipt.status, true, DARK);
    s += t(left + 380, y, 8, "Referencia", true, MUTED);
    s += t(left + 440, y, 8.5, receipt.reference, false, DARK);

    y -= 28;
  }

  // Table headers with fixed columns.
  const colSku = left;
  const colDesc = left + 86;
  const colQty = left + 325;
  const colUnit = left + 388;
  const colTotal = left + 462;

  s += rect(left, y - 19, width, 22, BLACK);
  s += t(colSku + 6, y - 12, 7.5, "CÓDIGO", true, "1 1 1");
  s += t(colDesc + 6, y - 12, 7.5, "DESCRIPCIÓN", true, "1 1 1");
  s += t(colQty + 6, y - 12, 7.5, "CANT.", true, "1 1 1");
  s += t(colUnit + 6, y - 12, 7.5, "P/U", true, "1 1 1");
  s += t(colTotal + 6, y - 12, 7.5, "TOTAL", true, "1 1 1");
  y -= 26;

  for (const item of items) {
    const rowTop = y + 7;
    const nameLines = wrap(item.name, 42, 2);
    const rowH = nameLines.length > 1 ? 40 : 30;

    s += line(left, rowTop, right, rowTop, "0.82 0.82 0.82", 0.55);
    s += line(colDesc, rowTop, colDesc, y - rowH + 7, "0.86 0.86 0.86", 0.45);
    s += line(colQty, rowTop, colQty, y - rowH + 7, "0.86 0.86 0.86", 0.45);
    s += line(colUnit, rowTop, colUnit, y - rowH + 7, "0.86 0.86 0.86", 0.45);
    s += line(colTotal, rowTop, colTotal, y - rowH + 7, "0.86 0.86 0.86", 0.45);

    s += t(colSku + 5, y - 4, 7.4, item.sku, false, DARK);
    nameLines.forEach((row, i) => { s += t(colDesc + 6, y - 4 - i * 12, 8.2, row, i === 0, DARK); });
    s += t(colQty + 18, y - 4, 8.5, item.quantity, false, DARK);
    s += t(colUnit + 7, y - 4, 8.2, money(item.unitPrice), false, DARK);
    s += t(colTotal + 7, y - 4, 8.2, money(item.subtotal), true, DARK);
    y -= rowH;
  }

  // Keep a clean body area even for few products.
  const minBottom = isLast ? 214 : 82;
  while (y > minBottom + 72) {
    s += line(left, y + 7, right, y + 7, "0.93 0.93 0.93", 0.35);
    s += line(colDesc, y + 7, colDesc, y - 20, "0.94 0.94 0.94", 0.3);
    s += line(colQty, y + 7, colQty, y - 20, "0.94 0.94 0.94", 0.3);
    s += line(colUnit, y + 7, colUnit, y - 20, "0.94 0.94 0.94", 0.3);
    s += line(colTotal, y + 7, colTotal, y - 20, "0.94 0.94 0.94", 0.3);
    y -= 27;
  }

  if (isLast) {
    const boxTop = 190;
    const notesW = 318;
    const totalsX = left + notesW + 16;
    const totalsW = right - totalsX;

    s += rect(left, boxTop, notesW, 20, GOLD);
    s += t(left + 8, boxTop + 6, 8, "COMENTARIOS / ACLARACIONES", true, BLACK);
    s += line(left, boxTop, left, 86, "0.78 0.78 0.78", 0.7);
    s += line(left + notesW, boxTop, left + notesW, 86, "0.78 0.78 0.78", 0.7);
    s += line(left, 86, left + notesW, 86, "0.78 0.78 0.78", 0.7);
    s += t(left + 8, boxTop - 18, 7.5, "Comprobante emitido por FZAC luego de confirmar el pago.", false, MUTED);
    s += t(left + 8, boxTop - 32, 7.5, "Conservá este documento como respaldo de la operación.", false, MUTED);

    const totalRows = [
      ["SUBTOTAL", money(receipt.amounts.subtotal)],
      ["ENVÍO", receipt.amounts.shippingCost > 0 ? money(receipt.amounts.shippingCost) : "$ 0"],
      ["IVA INCLUIDO", money(receipt.amounts.ivaIncluded)]
    ];
    let ty = boxTop + 2;
    for (const [label, value] of totalRows) {
      s += rect(totalsX, ty - 18, totalsW, 20, "0.96 0.96 0.96");
      s += t(totalsX + 8, ty - 11, 7.7, label, true, MUTED);
      s += t(totalsX + 95, ty - 11, 8.5, value, true, DARK);
      ty -= 22;
    }
    s += rect(totalsX, ty - 20, totalsW, 24, GOLD);
    s += t(totalsX + 8, ty - 12, 9, "TOTAL", true, BLACK);
    s += t(totalsX + 95, ty - 12, 11, money(receipt.amounts.total), true, BLACK);

    s += t(left, 58, 7.2, "Comprobante de compra FZAC. No reemplaza una factura fiscal emitida ante ARCA.", false, MUTED);
  }

  s += line(left, 40, right, 40, "0.82 0.82 0.82", 0.5);
  s += t(left, 24, 7, identity.address || "FZAC Materiales", false, MUTED);
  s += t(478, 24, 7, `Página ${pageIndex + 1}/${pageCount}`, false, MUTED);
  return Buffer.from(s, "latin1");
}

export async function generateOrderReceiptPdf(receipt: NonNullable<OrderReceipt>, identity: Identity) {
  const logo = await logoJpeg();
  const firstPageCapacity = 10;
  const nextPageCapacity = 15;
  const chunks: NonNullable<OrderReceipt>["items"][] = [];
  let cursor = 0;
  chunks.push(receipt.items.slice(0, firstPageCapacity));
  cursor = firstPageCapacity;
  while (cursor < receipt.items.length) {
    chunks.push(receipt.items.slice(cursor, cursor + nextPageCapacity));
    cursor += nextPageCapacity;
  }
  if (!chunks.length) chunks.push([]);

  const pageCount = chunks.length;
  const pageIds = chunks.map((_, index) => 6 + index * 2);
  const contentIds = chunks.map((_, index) => 7 + index * 2);
  const objects = new Map<number, Buffer>();

  objects.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
  objects.set(2, Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`, "latin1"));
  objects.set(3, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"));
  objects.set(4, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"));
  objects.set(5, Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.info.width} /Height ${logo.info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n`, "latin1"),
    logo.data,
    Buffer.from("\nendstream", "latin1")
  ]));

  chunks.forEach((items, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const content = pageContent(receipt, identity, items, index, pageCount, index === pageCount - 1);
    objects.set(pageId, Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents ${contentId} 0 R >>`,
      "latin1"
    ));
    objects.set(contentId, streamObject(content));
  });

  const maxId = Math.max(...objects.keys());
  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1");
  const parts: Buffer[] = [header];
  const offsets = new Array(maxId + 1).fill(0);
  let offset = header.length;

  for (let id = 1; id <= maxId; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`Missing PDF object ${id}`);
    const object = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, "latin1"),
      body,
      Buffer.from("\nendobj\n", "latin1")
    ]);
    offsets[id] = offset;
    parts.push(object);
    offset += object.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(parts);
}
