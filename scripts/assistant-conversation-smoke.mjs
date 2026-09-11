import assert from "node:assert/strict";
import crypto from "node:crypto";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

async function ask(message, history = []) {
  const response = await fetch(new URL("/api/assistant", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fzac-load-test": "readonly"
    },
    body: JSON.stringify({
      message,
      visitorId: crypto.randomUUID(),
      history
    })
  });
  const body = await response.json();
  return { response, body };
}

const greeting = await ask("Hola FZAC");
assert.equal(greeting.response.status, 200);
assert.equal(greeting.body.intent, "greeting");
assert.ok(Array.isArray(greeting.body.actions));
assert.ok(greeting.body.actions.length <= 4);

const delivery = await ask("Hacen envios a Funes?");
assert.equal(delivery.response.status, 200);
assert.equal(delivery.body.intent, "delivery");
assert.equal(delivery.body.handoff_required, false);

const paymentAfterDelivery = await ask("Quiero pagar con transferencia", [
  { role: "user", content: "Hacen envios a Funes?" },
  { role: "assistant", content: delivery.body.message }
]);
assert.equal(paymentAfterDelivery.body.intent, "payment", "El mensaje actual debe poder cambiar el tema de envio a pago.");
assert.equal(paymentAfterDelivery.body.knowledge_id, "bank-transfer");
assert.ok(paymentAfterDelivery.body.sources.some((source) => source.href === "/medios-de-pago"));

const accountHelp = await ask("Donde edito mi perfil y telefono?");
assert.equal(accountHelp.body.intent, "account");
assert.ok(accountHelp.body.actions.some((action) => action.href === "/cuenta/ajustes"));

const returns = await ask("Quiero solicitar la devolucion del pedido");
assert.equal(returns.body.intent, "returns");
assert.ok(returns.body.sources.some((source) => source.href === "/cambios-y-devoluciones"));

const privacy = await ask("Que datos personales guarda FZAC?");
assert.equal(privacy.body.intent, "store_policy");
assert.equal(privacy.body.knowledge_id, "privacy-policy");
assert.ok(privacy.body.sources.some((source) => source.href === "/privacidad"));

const buyingProcess = await ask("Como hago una compra en la tienda?");
assert.equal(buyingProcess.body.intent, "store_policy");
assert.equal(buyingProcess.body.knowledge_id, "buying-process");
assert.ok(buyingProcess.body.actions.some((action) => action.href === "/como-comprar"));

const catalogOverview = await ask("Que categorias tienen en el catalogo?");
assert.equal(catalogOverview.response.status, 200);
assert.ok(catalogOverview.body.actions.some((action) => action.href === "/productos"));
assert.match(catalogOverview.body.message, /catalogo|rubros|productos/i);

const withdrawal = await ask("Donde esta el boton de arrepentimiento?");
assert.equal(withdrawal.body.knowledge_id, "withdrawal-right");
assert.ok(withdrawal.body.actions.some((action) => action.href === "/arrepentimiento"));

const drywallEstimate = await ask("Cuantas placas necesito para una pared de 3 x 4 metros");
assert.equal(drywallEstimate.body.intent, "estimate");
assert.match(drywallEstimate.body.message, /5 placas/i);
assert.match(drywallEstimate.body.message, /perfiles.*por separado/i);

const critical = await ask("Me cobraron dos veces");
assert.equal(critical.body.intent, "payment");
assert.equal(critical.body.handoff_required, true);

const unsafe = await ask("stock'; DROP TABLE products; --");
assert.equal(unsafe.response.status, 200);
assert.equal(unsafe.body.intent, "security_notice");
assert.equal(unsafe.body.security_notice, true);

console.log(
  JSON.stringify({
    ok: true,
    baseUrl,
    greeting: greeting.body.intent,
    topicSwitch: paymentAfterDelivery.body.intent,
    accountHelp: accountHelp.body.intent,
    returns: returns.body.intent,
    knowledgeSources: [
      paymentAfterDelivery.body.knowledge_id,
      privacy.body.knowledge_id,
      buyingProcess.body.knowledge_id,
      withdrawal.body.knowledge_id
    ],
    catalogOverview: catalogOverview.body.actions.length,
    drywallEstimate: /5 placas/i.test(drywallEstimate.body.message),
    criticalHandoff: critical.body.handoff_required,
    unsafeInputRejected: unsafe.body.security_notice === true
  })
);

// Node 24 puede mantener sockets HTTP keep-alive abiertos despues de la suite local.
process.exit(0);
