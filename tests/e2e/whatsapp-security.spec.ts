import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { parseWhatsAppPayload } from "@/lib/whatsapp/message-parser";
import { duplicateReason, normalizeProductIdentity } from "@/lib/products/identity";
import {
  normalizeWhatsAppPhone,
  privatePhoneReference,
  verifyMetaSignature,
  verifyWebhookToken
} from "@/lib/whatsapp/security";

test("verifica token y firma de Meta sin comparaciones laxas", async () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const secret = "app-secret-de-prueba";
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  expect(verifyWebhookToken("token-correcto", "token-correcto")).toBe(true);
  expect(verifyWebhookToken("token-incorrecto", "token-correcto")).toBe(false);
  expect(verifyMetaSignature(body, signature, secret)).toBe(true);
  expect(verifyMetaSignature(`${body} `, signature, secret)).toBe(false);
  expect(verifyMetaSignature(body, null, secret)).toBe(false);
});

test("extrae solo mensajes soportados y limita el texto", async () => {
  const messages = parseWhatsAppPayload({
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          contacts: [{ wa_id: "5493415551234", profile: { name: "Cliente FZAC" } }],
          messages: [{
            from: "5493415551234",
            id: "wamid.prueba-0001",
            timestamp: "1789344000",
            type: "text",
            text: { body: "Necesito placas de durlock" }
          }]
        }
      }]
    }]
  });

  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({
    id: "wamid.prueba-0001",
    from: "5493415551234",
    body: "Necesito placas de durlock",
    type: "TEXT",
    customerName: "Cliente FZAC"
  });
  expect(parseWhatsAppPayload({ object: "otro", entry: [] })).toEqual([]);
});

test("el identificador telefónico es privado, estable y no contiene el número", async () => {
  expect(normalizeWhatsAppPhone("+54 9 341 555-1234")).toBe("5493415551234");
  const first = privatePhoneReference("+54 9 341 555-1234", "secreto-uno");
  const second = privatePhoneReference("5493415551234", "secreto-uno");
  const rotated = privatePhoneReference("5493415551234", "secreto-dos");

  expect(first).toEqual(second);
  expect(first?.last4).toBe("1234");
  expect(first?.hash).toHaveLength(64);
  expect(first?.hash).not.toContain("5493415551234");
  expect(rotated?.hash).not.toBe(first?.hash);
});

test("la migración hace idempotente el message_id y mantiene RLS forzado", async () => {
  const sql = (await Promise.all([
    "20260914031615_whatsapp_existing_chat_channel.sql",
    "20260914032417_whatsapp_chat_grants_hardening.sql"
  ].map((file) => readFile(path.join(process.cwd(), "supabase/migrations", file), "utf8")))).join("\n");
  expect(sql).toContain("chat_messages_external_message_id_unique");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("revoke all");
  expect(sql).toContain("grant select");
  expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
});

test("Render conserva el bot apagado y dry-run activo", async () => {
  const yaml = await readFile(path.join(process.cwd(), "render.yaml"), "utf8");
  expect(yaml).toMatch(/WHATSAPP_BOT_ENABLED[\s\S]{0,80}value:\s*"false"/);
  expect(yaml).toMatch(/WHATSAPP_BOT_DRY_RUN[\s\S]{0,80}value:\s*"true"/);
  expect(yaml).toMatch(/WHATSAPP_ACCESS_TOKEN\s*\n\s+sync:\s+false/);
  expect(yaml).not.toMatch(/WHATSAPP_ACCESS_TOKEN\s*\n\s+value:/);
});

test("la carga administrativa detecta duplicados normalizados sin confundir medidas", async () => {
  expect(normalizeProductIdentity("Placa Durlock 12,5 mm 1,20 x 2,40 mts")).toBe(
    normalizeProductIdentity("PLACA DURLOCK 12.5 mm 1.20x2.40 m")
  );
  const existing = [{ id: "uno", name: "Placa Durlock 12,5 mm", slug: "placa-durlock", sku: "FZ-100" }];
  expect(duplicateReason({ name: "PLACA DURLOCK 12.5 mm", slug: "otra", sku: "FZ-101" }, existing)).toContain("coincide");
  expect(duplicateReason({ name: "Placa Durlock 9,5 mm", slug: "placa-95", sku: "FZ-095" }, existing)).toBeNull();
});
