import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const tokenize = (value) =>
  [...new Set(normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3))]
    .slice(0, 8);

const hasAny = (text, terms) => terms.some((term) => text.includes(term));

const productView = (product) => ({
  id: product.id,
  slug: product.slug,
  sku: product.sku,
  name: product.name,
  brand: product.brand,
  category: product.category?.name || null,
  categorySlug: product.category?.slug || null,
  price: Number(product.price || 0),
  comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
  stock: Number(product.stock || 0),
  image: product.image,
  description: product.description
});

const searchProducts = async (message) => {
  const terms = tokenize(message);

  const where = {
    active: true,
    stock: { gt: 0 }
  };

  if (terms.length) {
    where.OR = terms.flatMap((term) => [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { brand: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
      { subcategory: { contains: term, mode: 'insensitive' } },
      { category: { name: { contains: term, mode: 'insensitive' } } }
    ]);
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: [{ featured: 'desc' }, { onSale: 'desc' }, { stock: 'desc' }],
    take: 8
  });

  return products.map(productView);
};

const extractOutputText = (response) => {
  if (typeof response?.output_text === 'string') return response.output_text;

  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && content.text) return content.text;
    }
  }

  return '';
};

const productSummary = (products) => {
  if (!products.length) return '';

  const names = products
    .slice(0, 3)
    .map((product) => `${product.name} ($${product.price}, stock ${product.stock})`)
    .join(', ');

  return ` En catalogo encontre estas opciones relacionadas: ${names}.`;
};

const fallbackReply = ({ message, products }) => {
  const text = normalize(message);
  const productsText = productSummary(products);

  if (hasAny(text, ['humano', 'persona', 'admin', 'asesor', 'atencion', 'vendedor', 'representante'])) {
    return 'Puedo ayudarte por aca y tambien podes pedir que la conversacion pase a atencion FZAC con el boton "Hablar con una persona". Si estas logueado, queda guardada en Mi cuenta.';
  }

  if (hasAny(text, ['como compro', 'comprar', 'compra', 'checkout', 'finalizar pedido'])) {
    return `Para comprar, elegi los productos, agregalos al carrito, revisa cantidades y continua al checkout. Ahi completas tus datos, elegis envio o retiro y pagas por Mercado Pago. El pedido se confirma cuando el pago queda aprobado.${productsText}`;
  }

  if (hasAny(text, ['registr', 'cuenta', 'login', 'iniciar sesion', 'ingresar'])) {
    return 'Para usar tu cuenta, entra a Iniciar sesion o Registro desde la web. Con una cuenta podes guardar tus datos, revisar pedidos y pedir seguimiento de conversaciones con atencion FZAC.';
  }

  if (hasAny(text, ['recuperar', 'olvide', 'contrasena', 'password', 'clave'])) {
    return 'Si no podes entrar a tu cuenta, usa la opcion de recuperacion si esta disponible en la pantalla de ingreso. Si el problema continua, pedi atencion FZAC para que revisen tu caso sin compartir contrasenas por chat.';
  }

  if (hasAny(text, ['carrito', 'agregar', 'cantidad', 'quitar'])) {
    return `Desde cada producto podes agregar unidades al carrito. Antes de pagar conviene revisar cantidades, medidas y disponibilidad. El stock se reserva de forma definitiva cuando el pago queda aprobado.${productsText}`;
  }

  if (hasAny(text, ['pago', 'pagar', 'mercado pago', 'tarjeta', 'transferencia', 'rechazado', 'pendiente'])) {
    return 'El checkout principal funciona con Mercado Pago. Si el pago queda pendiente, espera la confirmacion. Si se rechaza, podes volver al carrito y reintentar con otro medio. El pedido se confirma solo con pago aprobado.';
  }

  if (hasAny(text, ['envio', 'enviar', 'retiro', 'retirar', 'sucursal', 'entrega', 'domicilio'])) {
    return 'Durante el checkout podes elegir envio o retiro segun las opciones disponibles. Para materiales pesados o pedidos grandes, conviene confirmar condiciones de entrega con atencion FZAC antes de cerrar la compra.';
  }

  if (hasAny(text, ['estado', 'pedido', 'seguimiento', 'despues de pagar', 'orden', 'ticket', 'factura'])) {
    return 'Despues de pagar, el sistema registra el pedido y genera el comprobante interno cuando el pago queda aprobado. Desde Mi cuenta podes revisar tus pedidos. Si necesitas seguimiento puntual, pedi atencion FZAC.';
  }

  if (hasAny(text, ['devolucion', 'devolver', 'cambio', 'garantia', 'cancelar'])) {
    return 'Para cambios, devoluciones o cancelaciones, lo mejor es hablar con atencion FZAC indicando el pedido y el producto. No tires el comprobante y conserva el material en buen estado hasta recibir indicaciones.';
  }

  if (hasAny(text, ['drywall', 'durlock', 'construccion en seco', 'pared', 'cielorraso', 'tabique'])) {
    return `Para una pared de drywall suelen evaluarse placas, perfiles, fijaciones, masilla, cinta y accesorios segun medida y uso. Puedo buscar productos del catalogo, pero la seleccion final debe confirmarla un profesional si hay estructura, humedad, fuego o aislacion de por medio.${productsText}`;
  }

  if (hasAny(text, ['agua', 'instalacion', 'gas', 'electricidad', 'estructura', 'seguridad'])) {
    return `Puedo orientarte con materiales generales y productos disponibles, pero para instalaciones de agua, gas, electricidad, estructura o seguridad es importante consultar a un profesional matriculado. No conviene definir una compra critica solo por chat.${productsText}`;
  }

  if (hasAny(text, ['categoria', 'categorias', 'rubro', 'ofertas', 'catalogo', 'producto', 'precio', 'stock'])) {
    if (!products.length) {
      return 'Puedo ayudarte a buscar por producto, marca, medida, rubro o uso. No encontre una coincidencia exacta en este momento; proba con otro nombre o pedi que atencion FZAC revise la consulta.';
    }

    return `Encontre productos relacionados con tu consulta.${productsText} Revisa la ficha del producto antes de agregar al carrito para confirmar medidas, precio y stock.`;
  }

  if (hasAny(text, ['fzac', 'materiales fzac', 'quienes son', 'contacto', 'horario'])) {
    return 'Materiales FZAC pertenece a Fortaleza Construcciones. Puedo ayudarte con catalogo, compras, pagos, envios, retiros y pedidos. Para informacion comercial especifica, pedi atencion FZAC.';
  }

  if (products.length) {
    return `Encontre opciones relacionadas con tu consulta.${productsText} Puedo ayudarte a compararlas, revisar el uso general o derivarte a atencion FZAC para confirmar detalles.`;
  }

  return 'Puedo ayudarte con productos, compras, pagos, envios, retiros, cuenta, pedidos, devoluciones y contacto con atencion FZAC. Contame que necesitas resolver y lo vemos paso a paso.';
};

const buildPrompt = ({ message, products, history }) => {
  const productContext = products.length
    ? products
        .map(
          (product) =>
            `- ${product.name} | SKU ${product.sku || 'Sin SKU'} | Marca ${product.brand || 'Sin marca'} | Categoria ${product.category || 'Sin categoria'} | Precio ARS ${product.price} | Stock ${product.stock}`
        )
        .join('\n')
    : '- No se encontraron productos exactos.';

  const historyText = (history || [])
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join('\n');

  return `Historial reciente:\n${historyText || 'Sin historial previo'}\n\nConsulta actual:\n${message}\n\nProductos disponibles relacionados:\n${productContext}`;
};

const openAiReply = async ({ message, products, history, userId }) => {
  if (!env.ASSISTANT_ENABLED || !env.OPENAI_API_KEY) {
    return fallbackReply({ message, products });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      instructions:
        'Sos FZAC Asistente, el asistente comercial de Materiales FZAC, tienda perteneciente a Fortaleza Construcciones en Rosario, Argentina. Responde siempre en espanol rioplatense, claro, breve y humano. Ayuda con catalogo, compras, registro, login, recuperacion de cuenta, carrito, Mercado Pago, pago aprobado, pago pendiente, pago rechazado, envios, retiros, cambios, devoluciones, estado de pedido, tickets, recomendaciones generales de materiales y contacto con atencion FZAC. Usa solamente los productos incluidos en el contexto para afirmar precio, stock, marca o disponibilidad. No inventes precios, stock, descuentos, horarios, direcciones ni condiciones comerciales. No muestres JSON, IDs internos, slugs, rutas internas, errores tecnicos ni nombres de infraestructura. Si hay productos, podes compararlos y sugerir complementarios de forma general. Para agua, gas, electricidad, estructura, seguridad, cargas, fuego o humedad, no des asesoramiento profesional definitivo: recomenda consultar a un profesional matriculado. Si el usuario pide una persona, indica que puede usar el boton Hablar con una persona y que, si esta logueado, la conversacion queda guardada en Mi cuenta.',
      input: buildPrompt({ message, products, history }),
      max_output_tokens: 520,
      store: false,
      safety_identifier: userId ? `fzac-${userId}` : undefined
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error('El asistente inteligente no esta disponible temporalmente.');
    error.details = detail;
    throw error;
  }

  const data = await response.json();
  return extractOutputText(data) || fallbackReply({ message, products });
};

export const assistantService = {
  searchProducts,

  async chat({ message, conversationId, visitorId, user }) {
    const products = await searchProducts(message);

    let conversation = null;

    if (conversationId) {
      const accessWhere = user?.role === 'ADMIN'
        ? { id: conversationId }
        : {
            id: conversationId,
            OR: [
              ...(user ? [{ userId: user.id }] : []),
              ...(visitorId ? [{ visitorId }] : [])
            ]
          };

      conversation = await prisma.chatConversation.findFirst({
        where: accessWhere,
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 30 }
        }
      });
    }

    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: {
          userId: user?.id || null,
          visitorId: user ? null : visitorId || null,
          channel: 'AI',
          status: 'OPEN',
          subject: String(message).slice(0, 90)
        },
        include: { messages: true }
      });
    }

    const history = conversation.messages || [];

    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: user?.id || null,
        role: 'USER',
        content: message,
        metadata: { visitorId: visitorId || null }
      }
    });

    let answer;
    let aiMode = 'openai';

    try {
      answer = await openAiReply({ message, products, history, userId: user?.id });
    } catch {
      answer = fallbackReply({ message, products });
      aiMode = 'fallback';
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: answer,
        metadata: {
          aiMode,
          products: products.slice(0, 5).map((product) => product.id)
        }
      }
    });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: 'OPEN' }
    });

    return {
      conversationId: conversation.id,
      message: assistantMessage,
      answer,
      products: products.slice(0, 5),
      mode: aiMode
    };
  }
};
