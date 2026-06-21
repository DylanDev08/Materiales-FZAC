const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fm=webp&fit=crop&w=1400&q=86`;

export const categories = [
  { id: 'cat-1', name: 'Construcción en Seco', slug: 'construccion-seca', description: 'Placas, perfiles, fijaciones y aislaciones.', image: photo('photo-1581092918056-0c4c3acd3789') },
  { id: 'cat-2', name: 'Materiales', slug: 'materiales', description: 'Cemento, cal, áridos y productos base.', image: photo('photo-1503387762-592deb58ef4e') },
  { id: 'cat-3', name: 'Electricidad', slug: 'electricidad', description: 'Cables, cajas, térmicas y canalización.', image: photo('photo-1621905252507-b35492cc74b4') },
  { id: 'cat-4', name: 'Plomería', slug: 'plomeria', description: 'Caños, conexiones, selladores y accesorios sanitarios.', image: photo('photo-1585704032915-c3400ca199e7') },
  { id: 'cat-5', name: 'Pintura', slug: 'pintura', description: 'Pinturas, membranas, rodillos y terminaciones.', image: photo('photo-1562259949-e8e7689d7828') },
  { id: 'cat-6', name: 'Herramientas', slug: 'herramientas', description: 'Herramientas manuales y eléctricas para obra.', image: photo('photo-1581147036324-c1c89c2c8b5c') }
];

const rawProducts = [
  ['prod-1', 'placa-yeso-12-5mm-120x240', 'FZAC-PY-125', 'Placa de yeso 12,5 mm 1,20 x 2,40 m', 'Construcción en Seco', 'construccion-seca', 'Placas', 'Durlock', 82, 11200, 12800, photo('photo-1615874694520-474822394e73'), true, true, [['Medida', '1,20 x 2,40 m'], ['Espesor', '12,5 mm'], ['Uso', 'Tabiques y cielorrasos']]],
  ['prod-2', 'perfil-montante-70mm', 'FZAC-PM-069', 'Perfil montante galvanizado 70 mm', 'Construcción en Seco', 'construccion-seca', 'Perfilería', 'Barbieri', 120, 4300, 4850, photo('photo-1504917595217-d4dc5ebe6122'), true, true, [['Largo', '2,60 m'], ['Tipo', 'Montante'], ['Material', 'Acero galvanizado']]],
  ['prod-3', 'perfil-solera-70mm', 'FZAC-PS-070', 'Perfil solera galvanizada 70 mm', 'Construcción en Seco', 'construccion-seca', 'Perfilería', 'Barbieri', 105, 3900, null, photo('photo-1504917595217-d4dc5ebe6122'), true, false, [['Largo', '2,60 m'], ['Tipo', 'Solera']]],
  ['prod-4', 'cemento-portland-50kg', 'FZAC-CP-050', 'Cemento Portland bolsa 50 kg', 'Materiales', 'materiales', 'Cementos', 'Loma Negra', 65, 9800, 10500, photo('photo-1518005020951-eccb494ad742'), true, true, [['Presentación', 'Bolsa 50 kg'], ['Uso', 'Hormigones y morteros']]],
  ['prod-5', 'cal-hidratada-25kg', 'FZAC-CH-025', 'Cal hidratada bolsa 25 kg', 'Materiales', 'materiales', 'Cales', 'Milagro', 44, 5200, null, photo('photo-1518005020951-eccb494ad742'), false, false, [['Presentación', '25 kg'], ['Uso', 'Revoques y mezclas']]],
  ['prod-6', 'pegamento-porcelanato-30kg', 'FZAC-PP-030', 'Pegamento porcelanato flexible 30 kg', 'Materiales', 'materiales', 'Pegamentos', 'Klaukol', 74, 18900, 21400, photo('photo-1622015663319-e97e697503ee'), true, true, [['Presentación', '30 kg'], ['Uso', 'Porcelanato']]],
  ['prod-7', 'cable-unipolar-2-5mm-rollo', 'FZAC-CU-250', 'Cable unipolar 2,5 mm rollo 100 m', 'Electricidad', 'electricidad', 'Cables', 'Kalop', 34, 38900, 42500, photo('photo-1621905252507-b35492cc74b4'), true, true, [['Sección', '2,5 mm²'], ['Largo', '100 m']]],
  ['prod-8', 'termica-bipolar-25a', 'FZAC-TB-025', 'Llave térmica bipolar 25A', 'Electricidad', 'electricidad', 'Protección', 'Schneider', 18, 14200, 15800, photo('photo-1621905252507-b35492cc74b4'), false, true, [['Corriente', '25A'], ['Polos', '2']]],
  ['prod-9', 'cano-ppr-20mm', 'FZAC-PPR-020', 'Caño PP-R 20 mm x 4 m', 'Plomería', 'plomeria', 'Caños', 'Acqua System', 90, 7350, 8200, photo('photo-1585704032915-c3400ca199e7'), true, true, [['Diámetro', '20 mm'], ['Largo', '4 m']]],
  ['prod-10', 'llave-esferica-media', 'FZAC-LE-012', 'Llave esférica 1/2 pulgada', 'Plomería', 'plomeria', 'Válvulas', 'FV', 70, 9800, null, photo('photo-1585704032915-c3400ca199e7'), false, false, [['Medida', '1/2 pulgada']]],
  ['prod-11', 'latex-interior-20l', 'FZAC-LI-020', 'Látex interior blanco 20 L', 'Pintura', 'pintura', 'Látex', 'Alba', 14, 63500, 71000, photo('photo-1562259949-e8e7689d7828'), true, true, [['Contenido', '20 L'], ['Terminación', 'Mate']]],
  ['prod-12', 'membrana-liquida-20kg', 'FZAC-ML-020', 'Membrana líquida fibrada 20 kg', 'Pintura', 'pintura', 'Impermeabilizantes', 'Sika', 36, 95500, 108000, photo('photo-1562259949-e8e7689d7828'), true, true, [['Contenido', '20 kg'], ['Uso', 'Cubiertas y terrazas']]],
  ['prod-13', 'taladro-percutor-650w', 'FZAC-TP-650', 'Taladro percutor 650W', 'Herramientas', 'herramientas', 'Eléctricas', 'Bosch', 12, 82500, 89900, photo('photo-1581147036324-c1c89c2c8b5c'), true, true, [['Potencia', '650W'], ['Mandril', '13 mm']]],
  ['prod-14', 'set-llana-fratacho', 'FZAC-LL-SET', 'Set llana dentada y fratacho profesional', 'Herramientas', 'herramientas', 'Manuales', 'FZAC Pro', 39, 18200, null, photo('photo-1581147036324-c1c89c2c8b5c'), false, false, [['Contenido', '2 piezas']]]
];

export const products = rawProducts.map(([id, slug, sku, name, category, categorySlug, subcategory, brand, stock, price, comparePrice, image, featured, onSale, specifications]) => ({
  id,
  slug,
  sku,
  name,
  category,
  categorySlug,
  subcategory,
  brand,
  stock,
  stockMinimum: 5,
  unit: 'unidad',
  price,
  comparePrice,
  image,
  gallery: [image, image.replace('w=1400', 'w=1100'), image.replace('w=1400', 'w=850')],
  description: `${name} para obras, reformas y mantenimiento. Consultá stock, medidas y ficha técnica antes de confirmar la compra.`,
  specifications: specifications.map(([label, value]) => ({ label, value })),
  featured,
  onSale,
  active: true,
  createdAt: new Date().toISOString()
}));
