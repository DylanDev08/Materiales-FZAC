export async function GET() {
  return Response.json({
    provider: "MERCADOPAGO",
    directCardProcessing: false,
    message:
      "FZAC no procesa ni almacena tarjetas. Las tarjetas de credito/debito deben abonarse mediante Mercado Pago u otro proveedor PCI habilitado."
  });
}

export async function POST() {
  return Response.json(
    {
      ok: false,
      message:
        "Por seguridad y cumplimiento PCI, FZAC no recibe numeros de tarjeta ni CVV. Inicia el pago desde /api/checkout para usar el proveedor configurado."
    },
    { status: 405 }
  );
}
