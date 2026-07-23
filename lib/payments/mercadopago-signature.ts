import crypto from "node:crypto";

type SignatureInput = {
  webhookSecret: string;
  paymentsEnv: "test" | "production";
  dataId: string;
  xSignature: string | null;
  xRequestId: string | null;
};

function parseSignature(value: string | null) {
  return Object.fromEntries(
    String(value ?? "")
      .split(",")
      .map((part) => part.split("=").map((item) => item.trim()))
      .filter((part) => part.length === 2)
  );
}

export function validateMercadoPagoSignature(input: SignatureInput) {
  if (!input.webhookSecret) return input.paymentsEnv !== "production";
  if (!input.xSignature || !input.xRequestId || !input.dataId) return false;

  const signature = parseSignature(input.xSignature);
  const ts = signature.ts;
  const v1 = signature.v1;
  if (!ts || !v1 || !/^[a-f0-9]+$/i.test(v1)) return false;

  const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", input.webhookSecret).update(manifest).digest("hex");
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(v1, "utf8"));
}
