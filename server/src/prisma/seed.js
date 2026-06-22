import '../config/env.js';
import bcrypt from 'bcryptjs';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;
import { toSlug } from '../utils/slug.js';

const prisma = new PrismaClient();
const image = (id) => `https://images.unsplash.com/${id}?auto=format&fm=webp&fit=crop&w=1400&q=86`;
const isProduction = process.env.NODE_ENV === 'production';
const seedAdminEmail = (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'dylansalcedo333@gmail.com').trim().toLowerCase();
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
const seedClientEmail = process.env.SEED_CLIENT_EMAIL || 'cliente@materialesfzac.local';
const seedClientPassword = process.env.SEED_CLIENT_PASSWORD || (isProduction ? '' : 'dev-client-change-me-2026');

if (!seedAdminPassword || (isProduction && !seedClientPassword)) {
  throw new Error('SEED_ADMIN_PASSWORD es requerida para ejecutar seed. En produccion tambien defini SEED_CLIENT_PASSWORD.');
}

const categories = [
  { name: 'Construcción seca', slug: 'construccion-seca', description: 'Perfiles, placas, fijaciones y aislaciones para sistemas en seco.', image: image('photo-1581092918056-0c4c3acd3789'), sortOrder: 1 },
  { name: 'Materiales', slug: 'materiales', description: 'Cementos, ladrillos, áridos, pegamentos e impermeabilizantes.', image: image('photo-1503387762-592deb58ef4e'), sortOrder: 2 },
  { name: 'Electricidad', slug: 'electricidad', description: 'Cables, protecciones, cajas y canalización eléctrica.', image: image('photo-1621905252507-b35492cc74b4'), sortOrder: 3 },
  { name: 'Plomería', slug: 'plomeria', description: 'Caños, conexiones, válvulas y soluciones sanitarias.', image: image('photo-1585704032915-c3400ca199e7'), sortOrder: 4 },
  { name: 'Pintura', slug: 'pintura', description: 'Pinturas, membranas, selladores y accesorios de terminación.', image: image('photo-1562259949-e8e7689d7828'), sortOrder: 5 },
  { name: 'Herramientas', slug: 'herramientas', description: 'Herramientas manuales y eléctricas para uso profesional.', image: image('photo-1581147036324-c1c89c2c8b5c'), sortOrder: 6 }
];

const products = [
  ['Placa de yeso estándar 12.5 mm 1.20 x 2.40 m', 'FZAC-PY-125', 'construccion-seca', 'Placas', 'Durlock', 84, 12850, 14600, true, true, image('photo-1615874694520-474822394e73'), ['unidad', '1.20 x 2.40 m', 'Tabiques y cielorrasos interiores']],
  ['Perfil montante galvanizado 69 mm x 2.60 m', 'FZAC-PM-069', 'construccion-seca', 'Perfiles', 'Barbieri', 210, 4050, 4650, true, true, image('photo-1504917595217-d4dc5ebe6122'), ['unidad', '69 mm x 2.60 m', 'Estructuras para construcción seca']],
  ['Perfil solera galvanizada 70 mm x 2.60 m', 'FZAC-PS-070', 'construccion-seca', 'Perfiles', 'Barbieri', 180, 3650, null, true, false, image('photo-1504917595217-d4dc5ebe6122'), ['unidad', '70 mm x 2.60 m', 'Base y coronamiento de tabiques']],
  ['Lana de vidrio con foil 50 mm rollo 18 m²', 'FZAC-LV-050', 'construccion-seca', 'Aislaciones', 'Isover', 42, 64200, 71100, true, true, image('photo-1615874694520-474822394e73'), ['rollo', '50 mm / 18 m²', 'Aislación térmica y acústica']],
  ['Cemento Portland 50 kg', 'FZAC-CP-050', 'materiales', 'Cementos', 'Loma Negra', 96, 11800, 13200, true, true, image('photo-1518005020951-eccb494ad742'), ['bolsa', '50 kg', 'Hormigones y morteros']],
  ['Cal hidratada 25 kg', 'FZAC-CH-025', 'materiales', 'Cales', 'Milagro', 130, 6200, null, false, false, image('photo-1518005020951-eccb494ad742'), ['bolsa', '25 kg', 'Revoques y mezclas']],
  ['Pegamento porcelanato flexible 30 kg', 'FZAC-PP-030', 'materiales', 'Pegamentos', 'Klaukol', 74, 18900, 21400, true, true, image('photo-1622015663319-e97e697503ee'), ['bolsa', '30 kg', 'Porcelanatos y piezas grandes']],
  ['Ladrillo hueco 12 x 18 x 33 cm pallet 144 unidades', 'FZAC-LH-144', 'materiales', 'Ladrillos', 'Palmar', 18, 168000, 186000, true, false, image('photo-1604079628040-94301bb21b91'), ['pallet', '144 unidades', 'Mampostería tradicional']],
  ['Membrana líquida fibrada blanca 20 kg', 'FZAC-ML-020', 'pintura', 'Impermeabilizantes', 'Sika', 36, 95500, 108000, true, true, image('photo-1562259949-e8e7689d7828'), ['balde', '20 kg', 'Cubiertas y terrazas']],
  ['Látex interior premium blanco 20 L', 'FZAC-LI-020', 'pintura', 'Látex', 'Alba', 52, 78200, null, true, false, image('photo-1562259949-e8e7689d7828'), ['balde', '20 L', 'Interiores de alta terminación']],
  ['Cable unipolar 2.5 mm rollo 100 m', 'FZAC-CU-250', 'electricidad', 'Cables', 'Kalop', 61, 46300, 51200, true, true, image('photo-1621905252507-b35492cc74b4'), ['rollo', '100 m', 'Instalaciones eléctricas domiciliarias']],
  ['Caño corrugado reforzado 3/4 rollo 50 m', 'FZAC-CC-034', 'electricidad', 'Canalización', 'Tubelectric', 45, 24400, null, false, false, image('photo-1621905252507-b35492cc74b4'), ['rollo', '50 m', 'Canalización embutida']],
  ['Caño PP-R agua caliente/fría 20 mm x 4 m', 'FZAC-PPR-020', 'plomeria', 'Caños', 'Acqua System', 90, 7350, 8200, true, true, image('photo-1585704032915-c3400ca199e7'), ['unidad', '20 mm x 4 m', 'Agua fría y caliente']],
  ['Llave esférica 1/2 pulgada', 'FZAC-LE-012', 'plomeria', 'Válvulas', 'FV', 70, 9800, null, false, false, image('photo-1585704032915-c3400ca199e7'), ['unidad', '1/2 pulgada', 'Corte para instalación sanitaria']],
  ['Taladro percutor 13 mm 650 W', 'FZAC-TP-650', 'herramientas', 'Eléctricas', 'Bosch', 14, 126900, 142000, true, true, image('photo-1581147036324-c1c89c2c8b5c'), ['unidad', '650 W', 'Perforación en mampostería y metal']],
  ['Set de llana dentada y fratacho profesional', 'FZAC-LL-SET', 'herramientas', 'Manuales', 'FZAC Pro', 39, 18200, null, false, false, image('photo-1581147036324-c1c89c2c8b5c'), ['set', '2 piezas', 'Colocación y terminación']]
];

async function main() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.searchEvent.deleteMany();
  await prisma.productEvent.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.review.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.purchaseTicketItem.deleteMany();
  await prisma.purchaseTicket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash(seedAdminPassword, 12);
  const userPassword = await bcrypt.hash(seedClientPassword, 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin FZAC',
      email: seedAdminEmail,
      password: adminPassword,
      role: 'ADMIN',
      phone: '3415550101',
      preferences: { create: { orderUpdates: true, assistantHistory: true, theme: 'system' } }
    }
  });

  const client = await prisma.user.create({
    data: {
      name: 'Cliente Rosario',
      email: seedClientEmail,
      password: userPassword,
      phone: '3415550202',
      preferences: { create: { orderUpdates: true, assistantHistory: true, theme: 'system', preferredShipping: 'PICKUP' } },
      addresses: {
        create: {
          label: 'Obra Fisherton',
          street: 'Mendoza',
          number: '8200',
          city: 'Rosario',
          province: 'Santa Fe',
          postalCode: '2000',
          notes: 'Ingresar por portón lateral'
        }
      }
    }
  });

  const categoryRecords = {};
  for (const category of categories) {
    categoryRecords[category.slug] = await prisma.category.create({ data: category });
  }

  const productRecords = {};
  for (const [name, sku, categorySlug, subcategory, brand, stock, price, comparePrice, featured, onSale, img, spec] of products) {
    const product = await prisma.product.create({
      data: {
        name,
        slug: toSlug(name),
        sku,
        categoryId: categoryRecords[categorySlug].id,
        subcategory,
        brand,
        stock,
        stockMinimum: Math.max(5, Math.ceil(stock * 0.12)),
        unit: spec[0],
        price,
        comparePrice,
        image: img,
        gallery: [img, img.replace('w=1400', 'w=1100'), img.replace('w=1400', 'w=850')],
        description: `${name} seleccionado para obras profesionales, reformas y mantenimiento. Consultá la ficha técnica, el stock y la modalidad de entrega antes de confirmar la compra.`,
        specifications: {
          unidad: spec[0],
          medida: spec[1],
          uso: spec[2],
          marca: brand,
          garantia: 'Garantía oficial del fabricante',
          origen: 'Argentina'
        },
        featured,
        onSale,
        active: true
      }
    });
    productRecords[sku] = product;
  }

  await prisma.cartItem.create({
    data: { userId: client.id, productId: productRecords['FZAC-CP-050'].id, quantity: 2 }
  });

  await prisma.favorite.createMany({
    data: [
      { userId: client.id, productId: productRecords['FZAC-PY-125'].id },
      { userId: client.id, productId: productRecords['FZAC-TP-650'].id }
    ]
  });

  const paidOrder = await prisma.order.create({
    data: {
      userId: client.id,
      status: 'PREPARING',
      customerName: client.name,
      customerEmail: client.email,
      customerPhone: client.phone,
      shippingMethod: 'PICKUP',
      shippingCost: 0,
      subtotal: 33800,
      total: 33800,
      paidAt: new Date(),
      stripeCheckoutSessionId: 'seed_session_paid',
      stripePaymentIntentId: 'seed_payment_paid',
      items: {
        create: [
          { productId: productRecords['FZAC-PY-125'].id, sku: 'FZAC-PY-125', name: productRecords['FZAC-PY-125'].name, price: 12850, quantity: 2, image: productRecords['FZAC-PY-125'].image },
          { productId: productRecords['FZAC-PM-069'].id, sku: 'FZAC-PM-069', name: productRecords['FZAC-PM-069'].name, price: 4050, quantity: 2, image: productRecords['FZAC-PM-069'].image }
        ]
      },
      payment: {
        create: { status: 'PAID', amount: 33800, provider: 'MERCADOPAGO', providerSessionId: 'seed_preference_paid', providerPaymentIntentId: 'seed_payment_paid' }
      },
      ticket: {
        create: {
          number: 'FZAC-SEED-0001',
          customerName: client.name,
          customerEmail: client.email,
          customerPhone: client.phone,
          paymentProvider: 'MERCADOPAGO',
          paymentId: 'seed_payment_paid',
          subtotal: 33800,
          shippingCost: 0,
          total: 33800,
          shippingMethod: 'PICKUP',
          items: {
            create: [
              { productId: productRecords['FZAC-PY-125'].id, sku: 'FZAC-PY-125', name: productRecords['FZAC-PY-125'].name, unitPrice: 12850, quantity: 2, subtotal: 25700 },
              { productId: productRecords['FZAC-PM-069'].id, sku: 'FZAC-PM-069', name: productRecords['FZAC-PM-069'].name, unitPrice: 4050, quantity: 2, subtotal: 8100 }
            ]
          }
        }
      }
    }
  });

  await prisma.order.create({
    data: {
      userId: client.id,
      status: 'PENDING_PAYMENT',
      customerName: client.name,
      customerEmail: client.email,
      customerPhone: client.phone,
      shippingMethod: 'DELIVERY',
      shippingCost: 6500,
      subtotal: 95500,
      total: 102000,
      addressSnapshot: { street: 'Mendoza 8200', city: 'Rosario', province: 'Santa Fe', postalCode: '2000' },
      items: {
        create: [
          { productId: productRecords['FZAC-ML-020'].id, sku: 'FZAC-ML-020', name: productRecords['FZAC-ML-020'].name, price: 95500, quantity: 1, image: productRecords['FZAC-ML-020'].image }
        ]
      },
      payment: { create: { status: 'PENDING', amount: 102000, provider: 'MERCADOPAGO' } }
    }
  });

  const conversation = await prisma.chatConversation.create({
    data: { userId: client.id, channel: 'SUPPORT', status: 'WAITING_ADMIN', subject: 'Consulta sobre retiro de materiales' }
  });

  await prisma.chatMessage.createMany({
    data: [
      { conversationId: conversation.id, senderId: client.id, role: 'USER', content: '¿Puedo retirar las placas el viernes por la tarde?' },
      { conversationId: conversation.id, senderId: admin.id, role: 'ADMIN', content: 'Sí, cuando el pedido esté listo te avisamos desde esta conversación.' }
    ]
  });

  await prisma.productEvent.createMany({
    data: [
      { productId: productRecords['FZAC-PY-125'].id, userId: client.id, type: 'VIEW' },
      { productId: productRecords['FZAC-PY-125'].id, userId: client.id, type: 'ADD_TO_CART' },
      { productId: productRecords['FZAC-TP-650'].id, userId: client.id, type: 'VIEW' },
      { productId: productRecords['FZAC-CP-050'].id, userId: client.id, type: 'PURCHASE', metadata: { orderId: paidOrder.id } }
    ]
  });

  await prisma.searchEvent.createMany({
    data: [
      { userId: client.id, query: 'placa yeso', resultsCount: 3 },
      { userId: client.id, query: 'cemento', resultsCount: 2 },
      { query: 'taladro', resultsCount: 1, sessionId: 'seed-visitor' }
    ]
  });

  console.log('Seed completo: usuarios, catálogo, pedidos, pagos, favoritos, chat y analítica creados.');
  console.log(`Admin seed: ${seedAdminEmail}`);
  console.log(`Cliente seed: ${seedClientEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
