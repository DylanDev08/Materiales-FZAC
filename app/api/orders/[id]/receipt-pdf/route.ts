import { getOrderReceipt } from "@/lib/db/receipts";
import { getStoreLegalIdentity } from "@/lib/legal/store-identity";
import { generateOrderReceiptPdf } from "@/lib/pdf/order-receipt-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const receipt = await getOrderReceipt(id);

  if (!receipt) {
    return Response.json(
      { ok: false, message: "No encontramos un comprobante aprobado para este pedido." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const identity = getStoreLegalIdentity();
  const pdf = await generateOrderReceiptPdf(receipt, identity);
  const filename = `factura-fzac-${receipt.reference}.pdf`;

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
