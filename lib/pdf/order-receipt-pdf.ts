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
  s += rect(0, PAGE_H - 108, PAGE_W, 108, BLACK);
  s += rect(0, PAGE_H - 114, PAGE_W, 6, GOLD);
  s += `q 58 0 0 58 34 ${PAGE_H - 88} cm /Im1 Do Q\n`;

  s += t(108, PAGE_H - 48, 18, identity.commercialName || "FZAC Materiales", true, "1 1 1");
  s += t(108, PAGE_H - 68, 9, "Materiales para construcción", false, "0.82 0.82 0.82");
  if (identity.taxId) s += t(108, PAGE_H - 84, 8, `CUIT ${identity.taxId}`, false, "0.72 0.72 0.72");
  s += t(420, PAGE_H - 46, 13, "COMPROBANTE FZAC", true, GOLD);
  s += t(420, PAGE_H - 66, 9, receipt.number, true, "1 1 1");
  s += t(420, PAGE_H - 82, 8, `Ref. ${receipt.reference}`, false, "0.75 0.75 0.75");

  let y = PAGE_H - 145;
  if (pageIndex === 0) {
    s += t(34, y, 8, "CLIENTE", true, MUTED);
    s += t(34, y - 18, 12, receipt.customer.name, true);
    s += t(34, y - 34, 8, receipt.customer.email, false, DARK);
    s += t(34, y - 49, 8, receipt.customer.phone, false, DARK);

    s += t(230, y, 8, "FECHA", true, MUTED);
    s += t(230, y - 18, 10, date(receipt.issuedAt), true);
    s += t(230, y - 36, 8, receipt.payment.provider, false, DARK);

    s += t(395, y, 8, "ENTREGA", true, MUTED);
    s += t(395, y - 18, 9, receipt.shipping.method, true);
    const addr = wrap(receipt.shipping.address, 30, 2);
    addr.forEach((row, i) => { s += t(395, y - 35 - i * 13, 7.5, row, false, DARK); });

    y -= 82;
    s += line(34, y, 561, y);
    y -= 24;
  }

  s += rect(34, y - 22, 527, 26, "0.95 0.95 0.95");
  s += t(44, y - 13, 8, "ITEM / CÓDIGO", true, DARK);
  s += t(355, y - 13, 8, "CANT.", true, DARK);
  s += t(415, y - 13, 8, "UNIT.", true, DARK);
  s += t(500, y - 13, 8, "TOTAL", true, DARK);
  y -= 33;

  for (const item of items) {
    const nameLines = wrap(item.name, 47, 2);
    const rowH = nameLines.length > 1 ? 40 : 31;
    s += line(34, y + 6, 561, y + 6, "0.9 0.9 0.9", 0.5);
    nameLines.forEach((row, i) => { s += t(44, y - i * 12, 8.5, row, i === 0); });
    s += t(44, y - (nameLines.length > 1 ? 26 : 14), 7, `Código: ${item.sku}`, false, MUTED);
    s += t(365, y, 8.5, item.quantity, false, DARK);
    s += t(415, y, 8.5, money(item.unitPrice), false, DARK);
    s += t(500, y, 8.5, money(item.subtotal), true, DARK);
    y -= rowH;
  }

  if (isLast) {
    y -= 10;
    s += line(330, y + 14, 561, y + 14, GOLD, 1.1);
    s += t(365, y, 8, "Subtotal", false, MUTED);
    s += t(485, y, 9, money(receipt.amounts.subtotal), true);
    y -= 18;
    s += t(365, y, 8, "Envío", false, MUTED);
    s += t(485, y, 9, receipt.amounts.shippingCost > 0 ? money(receipt.amounts.shippingCost) : "$ 0", true);
    y -= 22;
    s += rect(350, y - 8, 211, 28, GOLD);
    s += t(365, y, 10, "TOTAL", true, BLACK);
    s += t(470, y, 12, money(receipt.amounts.total), true, BLACK);
    y -= 42;
    s += t(34, y, 7.5, "IVA incluido según precio final informado.", false, MUTED);
    s += t(34, y - 14, 7.5, "Comprobante de compra FZAC. No reemplaza una factura fiscal emitida ante ARCA.", false, MUTED);
  }

  s += line(34, 34, 561, 34, "0.86 0.86 0.86", 0.5);
  s += t(34, 18, 7, identity.address || "FZAC Materiales", false, MUTED);
  s += t(500, 18, 7, `Página ${pageIndex + 1}/${pageCount}`, false, MUTED);
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
