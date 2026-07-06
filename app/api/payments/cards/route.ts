export async function GET() {
  return Response.json({
    provider: "CONFIGURED_PAYMENT_PROVIDER",
    directCardProcessing: false,
    tokenizedCardCheckout: true,
    message:
      "FZAC no procesa ni almacena tarjetas. El checkout usa tokenizacion del proveedor para debito/credito."
  });
}

export async function POST() {
  return Response.json(
    {
      ok: false,
      message:
        "Por seguridad y cumplimiento PCI, FZAC no recibe numeros de tarjeta ni CVV. Inicia el pago desde /checkout para usar el formulario tokenizado."
    },
    { status: 405 }
  );
}
