import type { Category, ItemDef, Slot, StyleTag, Fabric, PatternId, Rarity, UnlockRule } from './types'

// Catálogo de prendas. Cada entrada se construye en 3D a partir de su
// plantilla (`model`) y parámetros; el color y estampado son editables.

interface Opts {
  params?: ItemDef['params']
  color2?: string
  pattern?: PatternId
  editable?: boolean
  rarity?: Rarity
  price?: number
  unlock?: UnlockRule
  story?: string
}

const SLOT_OF: Record<Category, Slot> = {
  tops: 'top',
  bottoms: 'bottom',
  dresses: 'dress',
  jackets: 'jacket',
  shoes: 'shoes',
  bags: 'bag',
  jewelry: 'necklace',
  glasses: 'glasses',
  hats: 'hat',
  hairAcc: 'hairAcc',
}

function it(
  id: string,
  name: string,
  category: Category,
  model: string,
  fabric: Fabric,
  color: string,
  tags: StyleTag[],
  o: Opts = {},
  slot?: Slot,
): ItemDef {
  return {
    id,
    name,
    category,
    slot: slot ?? SLOT_OF[category],
    model,
    params: o.params,
    fabric,
    color,
    color2: o.color2,
    pattern: o.pattern ?? 'liso',
    editable: o.editable ?? true,
    tags,
    rarity: o.rarity ?? 'comun',
    price: o.price,
    unlock: o.unlock,
    story: o.story,
  }
}

const sp = (price: number): Opts => ({ rarity: 'especial', price })

export const ITEMS: ItemDef[] = [
  // ───────────── TOPS ─────────────
  it('top-corazon', 'Top escote corazón', 'tops', 'top', 'satin', '#ff5fae', ['glam', 'y2k', 'fiesta'], {
    params: { neck: 'sweetheart', hem: 1.07, sleeve: 0, straps: 'thin' },
  }),
  it('top-babytee', 'Camiseta baby tee', 'tops', 'top', 'cotton', '#ffb3d9', ['street', 'y2k'], {
    params: { neck: 'crew', hem: 1.05, sleeve: 0.45 },
    pattern: 'estrellas',
    color2: '#ff2d8a',
  }),
  it('top-halter', 'Top halter satinado', 'tops', 'top', 'satin', '#c9a7ff', ['glam', 'fiesta', 'elegante'], {
    params: { neck: 'halter', hem: 1.04, sleeve: 0, straps: 'halter' },
  }),
  it('top-palabra', 'Palabra de honor de lentejuelas', 'tops', 'top', 'sequin', '#ff2d8a', ['fiesta', 'glam'], {
    params: { neck: 'tube', hem: 1.06, sleeve: 0 },
    pattern: 'lentejuelas',
  }),
  it('top-corse', 'Corsé de vinilo', 'tops', 'top', 'vinyl', '#1c1626', ['rock', 'fiesta'], {
    params: { neck: 'sweetheart', hem: 0.99, sleeve: 0, lacing: true },
  }),
  it('top-rejilla', 'Top de rejilla', 'tops', 'top', 'mesh', '#1c1626', ['rock', 'y2k'], {
    params: { neck: 'crew', hem: 1.03, sleeve: 2 },
    pattern: 'rejilla',
  }),
  it('top-campesina', 'Blusa campesina', 'tops', 'top', 'cotton', '#ffffff', ['boho', 'romantico', 'ibiza'], {
    params: { neck: 'off', hem: 1.0, sleeve: 0.55, puff: true },
    pattern: 'flores',
    color2: '#ff9fd0',
  }),
  it('top-sport', 'Top deportivo', 'tops', 'top', 'knit', '#3de0c4', ['deportivo', 'street'], {
    params: { neck: 'square', hem: 1.09, sleeve: 0, straps: 'wide' },
  }),
  it('top-jersey', 'Jersey crop de punto', 'tops', 'top', 'knit', '#f3e6d4', ['invierno', 'romantico'], {
    params: { neck: 'crew', hem: 1.03, sleeve: 2, cozy: true },
  }),
  it('top-holo', 'Top holográfico', 'tops', 'top', 'holo', '#e6dcff', ['y2k', 'fiesta', 'glam'], {
    ...sp(60),
    params: { neck: 'halter', hem: 1.06, sleeve: 0, straps: 'halter' },
  }),
  it('top-body-v', 'Body escote en V', 'tops', 'top', 'satin', '#1c1626', ['elegante', 'glam'], {
    params: { neck: 'v', hem: 0.95, sleeve: 2 },
  }),
  it('top-bikini', 'Top de bikini', 'tops', 'top', 'cotton', '#ff9b4a', ['playa', 'ibiza'], {
    params: { neck: 'bikini', hem: 1.12, sleeve: 0, straps: 'halter' },
    pattern: 'corazones',
    color2: '#ffffff',
  }),
  it('top-crochet', 'Top de crochet ibicenco', 'tops', 'top', 'knit', '#ffffff', ['boho', 'ibiza', 'playa'], {
    ...sp(55),
    params: { neck: 'v', hem: 1.06, sleeve: 0, straps: 'thin', fringe: true },
    pattern: 'rejilla',
  }),
  it('top-tirantes', 'Camiseta de tirantes', 'tops', 'top', 'cotton', '#7fd6ff', ['street', 'playa', 'deportivo'], {
    params: { neck: 'square', hem: 1.0, sleeve: 0, straps: 'wide' },
    pattern: 'rayas',
    color2: '#ffffff',
  }),
  it('top-conchas', 'Top de conchas de Cala Comte', 'tops', 'shellTop', 'pearl', '#ffd1e8', ['magico', 'playa', 'ibiza'], {
    rarity: 'secreta',
    unlock: { kind: 'challenge', challengeId: 'reto-sirena' },
    color2: '#c9a7ff',
    story: 'Para la sirena que va a vivir frente al mar.',
  }),

  // ───────────── PARTES DE ABAJO ─────────────
  it('pant-flare', 'Vaqueros acampanados', 'bottoms', 'pants', 'denim', '#5b84d6', ['y2k', 'street'], {
    params: { waist: 0.95, length: 1, flare: 0.05 },
    pattern: 'denim',
  }),
  it('skirt-plaid', 'Minifalda plisada escocesa', 'bottoms', 'skirt', 'cotton', '#ff5fae', ['y2k', 'rock'], {
    params: { waist: 0.98, hem: 0.74, flare: 0.05, pleats: 18 },
    pattern: 'escoces',
    color2: '#1c1626',
  }),
  it('pant-cargo', 'Pantalón cargo baggy', 'bottoms', 'pants', 'cotton', '#c0c4d6', ['street', 'deportivo'], {
    params: { waist: 0.96, length: 1, flare: 0.02, baggy: 1 },
  }),
  it('short-denim', 'Shorts vaqueros', 'bottoms', 'pants', 'denim', '#7fa2e0', ['playa', 'street', 'ibiza'], {
    params: { waist: 0.97, length: 0.2, flare: 0.01 },
    pattern: 'denim',
  }),
  it('skirt-vinyl', 'Minifalda de vinilo', 'bottoms', 'skirt', 'vinyl', '#1c1626', ['rock', 'fiesta'], {
    params: { waist: 0.99, hem: 0.73, flare: 0.015 },
  }),
  it('skirt-boho', 'Falda larga de volantes', 'bottoms', 'skirt', 'cotton', '#ff9b4a', ['boho', 'romantico'], {
    params: { waist: 0.99, hem: 0.12, flare: 0.15, tiers: 3 },
    pattern: 'flores',
    color2: '#fff16a',
  }),
  it('pant-chandal', 'Pantalón de chándal brillante', 'bottoms', 'pants', 'satin', '#ff2d8a', ['deportivo', 'street', 'y2k'], {
    params: { waist: 0.97, length: 1, flare: 0.03, stripe: true },
    color2: '#ffffff',
  }),
  it('legging-leo', 'Leggings de leopardo', 'bottoms', 'pants', 'cotton', '#e3b45a', ['rock', 'fiesta'], {
    params: { waist: 1.0, length: 0.95, flare: 0, tight: true },
    pattern: 'leopardo',
    color2: '#1c1626',
  }),
  it('skirt-satin', 'Falda midi de satén', 'bottoms', 'skirt', 'satin', '#c9a7ff', ['elegante', 'romantico'], {
    params: { waist: 1.01, hem: 0.36, flare: 0.07 },
  }),
  it('pant-cuero', 'Pantalón de cuero', 'bottoms', 'pants', 'leather', '#2a1d2e', ['rock', 'glam'], {
    ...sp(70),
    params: { waist: 0.98, length: 1, flare: 0.0, tight: true },
  }),
  it('skirt-sequin', 'Minifalda de lentejuelas', 'bottoms', 'skirt', 'sequin', '#e3b45a', ['fiesta', 'glam'], {
    ...sp(65),
    params: { waist: 0.99, hem: 0.74, flare: 0.03 },
    pattern: 'lentejuelas',
  }),
  it('skirt-pareo', 'Pareo de playa', 'bottoms', 'skirt', 'satin', '#3de0c4', ['playa', 'ibiza', 'boho'], {
    params: { waist: 0.95, hem: 0.42, flare: 0.08, slit: 1 },
    pattern: 'flores',
    color2: '#ffffff',
  }),
  it('skirt-tul', 'Falda de tul', 'bottoms', 'skirt', 'mesh', '#ffb3d9', ['romantico', 'fiesta'], {
    params: { waist: 1.0, hem: 0.62, flare: 0.14, tiers: 2 },
  }),
  it('pant-palazzo', 'Palazzo blanco ibicenco', 'bottoms', 'pants', 'satin', '#ffffff', ['ibiza', 'boho', 'elegante'], {
    ...sp(60),
    params: { waist: 1.0, length: 1, flare: 0.09, baggy: 1.4 },
  }),

  // ───────────── VESTIDOS Y MONOS ─────────────
  it('dress-sequin', 'Vestido mini de lentejuelas', 'dresses', 'dress', 'sequin', '#c9a7ff', ['fiesta', 'glam', 'y2k'], {
    params: { neck: 'tube', sleeve: 0, hem: 0.72, flare: 0.03 },
    pattern: 'lentejuelas',
  }),
  it('dress-slip', 'Vestido lencero de satén', 'dresses', 'dress', 'satin', '#ffb3d9', ['elegante', 'romantico', 'glam'], {
    params: { neck: 'cowl', sleeve: 0, straps: 'thin', hem: 0.38, flare: 0.06 },
  }),
  it('dress-ibicenco', 'Vestido ibicenco de encaje', 'dresses', 'dress', 'cotton', '#ffffff', ['ibiza', 'boho', 'romantico'], {
    ...sp(90),
    params: { neck: 'off', sleeve: 0.5, puff: true, hem: 0.12, flare: 0.16, tiers: 3 },
    pattern: 'rejilla',
  }),
  it('mono-denim', 'Mono vaquero', 'dresses', 'jumpsuit', 'denim', '#5b84d6', ['street', 'y2k'], {
    params: { neck: 'square', sleeve: 0, straps: 'wide', length: 1, flare: 0.03, baggy: 0.6 },
    pattern: 'denim',
  }),
  it('dress-tul', 'Vestido de tul princesa', 'dresses', 'dress', 'mesh', '#ff9fd0', ['romantico', 'fiesta', 'magico'], {
    params: { neck: 'sweetheart', sleeve: 0, hem: 0.5, flare: 0.2, tiers: 2 },
  }),
  it('dress-holo', 'Vestido holográfico', 'dresses', 'dress', 'holo', '#e6dcff', ['y2k', 'fiesta', 'glam'], {
    ...sp(110),
    params: { neck: 'halter', sleeve: 0, straps: 'halter', hem: 0.74, flare: 0.04 },
  }),
  it('mono-chandal', 'Mono deportivo', 'dresses', 'jumpsuit', 'satin', '#8f5bff', ['deportivo', 'street'], {
    params: { neck: 'crew', sleeve: 2, length: 1, flare: 0.02, baggy: 0.5, stripe: true },
    color2: '#ffffff',
  }),
  it('dress-babydoll', 'Vestido babydoll de cuadros', 'dresses', 'dress', 'cotton', '#ff5fae', ['romantico', 'y2k'], {
    params: { neck: 'square', sleeve: 0.4, puff: true, hem: 0.7, flare: 0.1 },
    pattern: 'escoces',
    color2: '#ffffff',
  }),
  it('dress-rock', 'Vestido de vinilo', 'dresses', 'dress', 'vinyl', '#e8243c', ['rock', 'fiesta'], {
    params: { neck: 'sweetheart', sleeve: 0, straps: 'thin', hem: 0.74, flare: 0.015 },
  }),
  it('dress-flores', 'Vestido largo de flores', 'dresses', 'dress', 'cotton', '#fff16a', ['boho', 'playa', 'romantico'], {
    params: { neck: 'v', sleeve: 0, straps: 'thin', hem: 0.1, flare: 0.13, tiers: 2 },
    pattern: 'flores',
    color2: '#ff5fae',
  }),
  it('mono-palazzo', 'Mono palazzo de gala', 'dresses', 'jumpsuit', 'satin', '#e3b45a', ['glam', 'elegante'], {
    params: { neck: 'halter', sleeve: 0, straps: 'halter', length: 1, flare: 0.1, baggy: 1.3 },
  }),
  it('dress-punto', 'Vestido de punto', 'dresses', 'dress', 'knit', '#c0c4d6', ['invierno', 'elegante'], {
    params: { neck: 'crew', sleeve: 2, hem: 0.58, flare: 0.02, cozy: true },
  }),
  it('dress-gala', 'Vestido de gala con abertura', 'dresses', 'dress', 'sequin', '#e8243c', ['glam', 'elegante', 'fiesta'], {
    ...sp(140),
    params: { neck: 'v', sleeve: 0, straps: 'thin', hem: 0.04, flare: 0.1, slit: 1 },
    pattern: 'lentejuelas',
  }),
  it('dress-sirena', 'Cola de sirena de Es Vedrà', 'dresses', 'mermaid', 'scales', '#3de0c4', ['magico', 'playa', 'ibiza', 'glam'], {
    rarity: 'secreta',
    unlock: { kind: 'challenge', challengeId: 'reto-sirena' },
    pattern: 'escamas',
    color2: '#8f5bff',
    story: 'Escamas del color del agua de las calas: nuestro mar a partir de ahora.',
  }),
  it('dress-hada', 'Vestido de hada de los almendros', 'dresses', 'fairy', 'petal', '#ffd1ec', ['magico', 'romantico', 'ibiza'], {
    rarity: 'secreta',
    unlock: { kind: 'challenge', challengeId: 'reto-hada' },
    color2: '#c9a7ff',
    story: 'Pétalos como los almendros en flor de Santa Agnès en enero.',
  }),

  // ───────────── CHAQUETAS Y CAPAS ─────────────
  it('jk-denim', 'Cazadora vaquera crop', 'jackets', 'jacket', 'denim', '#7fa2e0', ['street', 'y2k'], {
    params: { hem: 1.03, sleeve: 2, collar: 'lapel' },
    pattern: 'denim',
  }),
  it('jk-biker', 'Cazadora motera', 'jackets', 'jacket', 'leather', '#1c1626', ['rock'], {
    params: { hem: 0.98, sleeve: 2, collar: 'lapel', zips: true },
  }),
  it('jk-fur', 'Abrigo de pelo rosa', 'jackets', 'jacket', 'fur', '#ffb3d9', ['glam', 'invierno'], {
    params: { hem: 0.8, sleeve: 2, collar: 'fur', puffer: 0.5 },
  }),
  it('jk-bomber', 'Bomber satinada', 'jackets', 'jacket', 'satin', '#c9a7ff', ['street', 'deportivo'], {
    params: { hem: 1.0, sleeve: 2, collar: 'rib', puffer: 0.3 },
  }),
  it('jk-puffer', 'Plumífero crop', 'jackets', 'jacket', 'vinyl', '#7fd6ff', ['invierno', 'street', 'y2k'], {
    params: { hem: 1.04, sleeve: 2, collar: 'high', puffer: 1, quilt: true },
  }),
  it('jk-blazer', 'Blazer oversize', 'jackets', 'jacket', 'cotton', '#f3e6d4', ['elegante', 'glam'], {
    params: { hem: 0.84, sleeve: 2, collar: 'lapel' },
  }),
  it('jk-chandal', 'Chaqueta de chándal', 'jackets', 'jacket', 'satin', '#ff2d8a', ['deportivo', 'street'], {
    params: { hem: 1.0, sleeve: 2, collar: 'high', stripe: true },
    color2: '#ffffff',
  }),
  it('jk-kimono', 'Kimono de flecos', 'jackets', 'jacket', 'satin', '#ffffff', ['boho', 'ibiza', 'playa'], {
    params: { hem: 0.7, sleeve: 1.2, collar: 'none', open: 1, fringe: true },
    pattern: 'flores',
    color2: '#ff9b4a',
  }),
  it('jk-bolero', 'Bolero de punto', 'jackets', 'jacket', 'knit', '#ffb3d9', ['romantico'], {
    params: { hem: 1.1, sleeve: 2, collar: 'none', open: 1 },
  }),
  it('jk-vinyl', 'Chaqueta de vinilo', 'jackets', 'jacket', 'vinyl', '#ff2d8a', ['rock', 'y2k', 'fiesta'], {
    ...sp(85),
    params: { hem: 1.0, sleeve: 2, collar: 'lapel' },
  }),
  it('jk-holo', 'Chaqueta holográfica', 'jackets', 'jacket', 'holo', '#e6dcff', ['y2k', 'fiesta'], {
    ...sp(95),
    params: { hem: 1.02, sleeve: 2, collar: 'high', puffer: 0.6 },
  }),
  it('jk-hoodie', 'Sudadera crop con capucha', 'jackets', 'jacket', 'cotton', '#b8f25c', ['street', 'deportivo'], {
    params: { hem: 1.02, sleeve: 2, collar: 'hood', closed: 1 },
  }),
  it('jk-capa', 'Capa de lentejuelas', 'jackets', 'cape', 'sequin', '#e3b45a', ['fiesta', 'glam'], {
    ...sp(120),
    pattern: 'lentejuelas',
  }),
  it('jk-alas', 'Alas de hada de luz', 'jackets', 'wings', 'holo', '#e8f6ff', ['magico', 'romantico'], {
    rarity: 'secreta',
    unlock: { kind: 'challenge', challengeId: 'reto-hada' },
    color2: '#ffb3e6',
    story: 'Para volar juntos hasta la isla.',
  }),

  // ───────────── CALZADO ─────────────
  it('sh-plataforma', 'Plataformas de charol', 'shoes', 'platform', 'vinyl', '#ff5fae', ['y2k', 'glam', 'fiesta']),
  it('sh-botas-vinilo', 'Botas altas de vinilo', 'shoes', 'kneeboots', 'vinyl', '#1c1626', ['rock', 'fiesta'], {
    params: { heel: 1 },
  }),
  it('sh-chunky', 'Deportivas chunky', 'shoes', 'sneakers', 'leather', '#ffffff', ['street', 'deportivo'], {
    color2: '#ff5fae',
  }),
  it('sh-aguja', 'Tacones de aguja plateados', 'shoes', 'heels', 'metal', '#c0c4d6', ['glam', 'elegante', 'fiesta']),
  it('sh-sandalias', 'Sandalias de tiras doradas', 'shoes', 'sandals', 'metal', '#e3b45a', ['playa', 'ibiza', 'boho']),
  it('sh-cowboy', 'Botas camperas', 'shoes', 'boots', 'leather', '#8a5a3c', ['boho', 'rock'], {
    params: { heel: 0.5, cowboy: true },
  }),
  it('sh-militar', 'Botines militares', 'shoes', 'boots', 'leather', '#1c1626', ['rock', 'street'], {
    params: { heel: 0.2, lug: true },
  }),
  it('sh-bailarinas', 'Bailarinas de satén', 'shoes', 'ballet', 'satin', '#ffb3d9', ['romantico', 'elegante']),
  it('sh-esparto', 'Cuñas de esparto', 'shoes', 'wedge', 'cotton', '#ffffff', ['ibiza', 'playa', 'boho'], {
    color2: '#d9b98a',
  }),
  it('sh-holo', 'Plataformas holográficas', 'shoes', 'platform', 'holo', '#e6dcff', ['y2k', 'fiesta'], sp(70)),
  it('sh-pelo', 'Botas de pelo', 'shoes', 'boots', 'fur', '#f3e6d4', ['invierno'], { params: { heel: 0.1, fluffy: true } }),
  it('sh-bota-alta-dep', 'Zapatillas de bota', 'shoes', 'sneakers', 'cotton', '#1c1626', ['street', 'rock'], {
    params: { high: true },
    color2: '#ffffff',
  }),
  it('sh-cristal', 'Tacones de cristal', 'shoes', 'heels', 'gem', '#e8f6ff', ['glam', 'magico', 'fiesta'], sp(100)),
  it('sh-chanclas', 'Chanclas con corazón', 'shoes', 'flipflops', 'plastic', '#ff7aa8', ['playa']),

  // ───────────── BOLSOS ─────────────
  it('bag-baguette', 'Bolso baguette', 'bags', 'baguette', 'satin', '#c9a7ff', ['y2k', 'glam'], { pattern: 'purpurina' }),
  it('bag-corazon', 'Bolso corazón', 'bags', 'heartBag', 'vinyl', '#ff2d8a', ['y2k', 'fiesta', 'romantico']),
  it('bag-mochila', 'Minimochila', 'bags', 'backpack', 'vinyl', '#7fd6ff', ['street', 'y2k']),
  it('bag-clutch', 'Clutch joya', 'bags', 'clutch', 'gem', '#e3b45a', ['glam', 'elegante', 'fiesta']),
  it('bag-cesta', 'Capazo de mimbre', 'bags', 'basket', 'cotton', '#d9b98a', ['ibiza', 'playa', 'boho']),
  it('bag-tote', 'Tote de playa', 'bags', 'tote', 'cotton', '#ffffff', ['playa', 'street'], { pattern: 'rayas', color2: '#3de0c4' }),
  it('bag-rinonera', 'Riñonera brillante', 'bags', 'fanny', 'holo', '#e6dcff', ['street', 'deportivo', 'y2k']),
  it('bag-tachas', 'Bolso de tachuelas', 'bags', 'studded', 'leather', '#1c1626', ['rock']),
  it('bag-flecos', 'Bandolera de flecos', 'bags', 'fringeBag', 'leather', '#8a5a3c', ['boho']),
  it('bag-peluche', 'Bolso de pelo', 'bags', 'furBag', 'fur', '#ff9fd0', ['invierno', 'glam']),
  it('bag-disco', 'Bolso bola de discoteca', 'bags', 'discoBag', 'metal', '#c0c4d6', ['fiesta', 'y2k'], sp(75)),
  it('bag-concha', 'Bolso concha', 'bags', 'shellBag', 'pearl', '#ffd1e8', ['playa', 'magico', 'ibiza'], sp(80)),

  // ───────────── JOYAS ─────────────
  it('ear-aros', 'Aros dorados XL', 'jewelry', 'hoops', 'metal', '#e3b45a', ['glam', 'street', 'y2k'], {}, 'earrings'),
  it('ear-estrella', 'Pendientes estrella', 'jewelry', 'starStuds', 'gem', '#fff3b0', ['y2k', 'fiesta'], {}, 'earrings'),
  it('ear-cruz', 'Pendientes de cruz', 'jewelry', 'crossDrops', 'metal', '#c0c4d6', ['rock'], {}, 'earrings'),
  it('ear-plumas', 'Pendientes de plumas', 'jewelry', 'featherDrops', 'cotton', '#3de0c4', ['boho', 'ibiza'], {}, 'earrings'),
  it('ear-corazon', 'Aros de corazón', 'jewelry', 'heartHoops', 'metal', '#ff7ac8', ['romantico', 'y2k'], {}, 'earrings'),
  it('nk-choker', 'Gargantilla de terciopelo', 'jewelry', 'choker', 'satin', '#1c1626', ['rock', 'y2k'], {}, 'necklace'),
  it('nk-cadena', 'Cadena con candado', 'jewelry', 'chainLock', 'metal', '#c0c4d6', ['rock', 'street'], {}, 'necklace'),
  it('nk-corazon', 'Collar corazón brillante', 'jewelry', 'heartPendant', 'gem', '#ff5fae', ['glam', 'romantico'], {}, 'necklace'),
  it('nk-perlas', 'Collar de perlas', 'jewelry', 'pearls', 'pearl', '#fff6f0', ['elegante', 'romantico'], {}, 'necklace'),
  it('nk-conchas', 'Collar de conchas', 'jewelry', 'shells', 'pearl', '#f3e6d4', ['playa', 'ibiza', 'boho'], {}, 'necklace'),
  it('br-pulseras', 'Pulseras de colores', 'jewelry', 'bangles', 'plastic', '#ff5fae', ['y2k', 'street'], {}, 'bracelet'),
  it('br-reloj', 'Reloj inteligente', 'jewelry', 'watch', 'plastic', '#f1e6dc', ['deportivo', 'street'], {}, 'bracelet'),
  it('br-tachas', 'Brazalete de tachuelas', 'jewelry', 'studCuff', 'leather', '#1c1626', ['rock'], {}, 'bracelet'),
  it('br-oro', 'Esclava dorada', 'jewelry', 'cuff', 'metal', '#e3b45a', ['glam', 'elegante'], {}, 'bracelet'),
  it('nk-diamantes', 'Gargantilla de diamantes', 'jewelry', 'diamondChoker', 'gem', '#ffffff', ['glam', 'fiesta', 'elegante'], sp(90), 'necklace'),
  it('ear-perla-mar', 'Perlas del Mediterráneo', 'jewelry', 'pearlDrops', 'pearl', '#fff6f0', ['magico', 'ibiza', 'elegante'], {
    rarity: 'secreta',
    unlock: { kind: 'challengesCompleted', count: 10 },
    story: 'Dos perlas: una para cada una de nuestras llaves de casa.',
  }, 'earrings'),

  // ───────────── GAFAS ─────────────
  it('gl-corazon', 'Gafas de corazón', 'glasses', 'heartGlasses', 'plastic', '#ff2d8a', ['y2k', 'playa', 'romantico']),
  it('gl-estrella', 'Gafas de estrella', 'glasses', 'starGlasses', 'plastic', '#fff16a', ['y2k', 'fiesta']),
  it('gl-gata', 'Gafas ojo de gato', 'glasses', 'catEye', 'plastic', '#1c1626', ['glam', 'elegante', 'rock']),
  it('gl-redondas', 'Gafas redondas hippies', 'glasses', 'round', 'metal', '#e3b45a', ['boho', 'ibiza']),
  it('gl-visera', 'Gafas pantalla holográficas', 'glasses', 'shield', 'holo', '#e6dcff', ['y2k', 'deportivo', 'fiesta']),
  it('gl-aviador', 'Gafas de aviador', 'glasses', 'aviator', 'metal', '#c0c4d6', ['rock', 'street']),
  it('gl-cuadradas', 'Gafas rectangulares mini', 'glasses', 'rect', 'plastic', '#8f5bff', ['y2k', 'street']),
  it('gl-mariposa', 'Gafas mariposa', 'glasses', 'butterfly', 'plastic', '#ff9fd0', ['y2k', 'glam']),
  it('gl-ovaladas', 'Gafas ovaladas', 'glasses', 'oval', 'plastic', '#e8243c', ['rock', 'y2k']),
  it('gl-deporte', 'Gafas deportivas', 'glasses', 'sport', 'plastic', '#3de0c4', ['deportivo', 'street']),
  it('gl-playa', 'Gafas XL de playa', 'glasses', 'big', 'plastic', '#f3e6d4', ['playa', 'glam', 'ibiza']),
  it('gl-brillantes', 'Gafas con brillantes', 'glasses', 'gemGlasses', 'gem', '#ffffff', ['glam', 'fiesta'], sp(70)),

  // ───────────── GORROS ─────────────
  it('hat-pescador', 'Gorro de pescador', 'hats', 'bucket', 'cotton', '#ffb3d9', ['y2k', 'street'], { pattern: 'leopardo', color2: '#8a3a24' }),
  it('hat-boina', 'Boina', 'hats', 'beret', 'knit', '#e8243c', ['romantico', 'elegante']),
  it('hat-vaquero', 'Sombrero vaquero rosa', 'hats', 'cowboy', 'vinyl', '#ff5fae', ['fiesta', 'boho', 'y2k']),
  it('hat-lana', 'Gorro de lana', 'hats', 'beanie', 'knit', '#c9a7ff', ['invierno', 'street']),
  it('hat-gorra', 'Gorra deportiva', 'hats', 'cap', 'cotton', '#1c1626', ['deportivo', 'street']),
  it('hat-pamela', 'Pamela de paja', 'hats', 'sunhat', 'cotton', '#f3e6d4', ['playa', 'ibiza', 'boho', 'elegante'], { color2: '#ff9b4a' }),
  it('hat-fedora', 'Fedora', 'hats', 'fedora', 'cotton', '#2a1d2e', ['rock', 'boho']),
  it('hat-pelo', 'Gorro de pelo', 'hats', 'furHat', 'fur', '#ffffff', ['invierno', 'glam']),
  it('hat-visera', 'Visera de vinilo', 'hats', 'visor', 'vinyl', '#7fd6ff', ['deportivo', 'y2k', 'playa']),
  it('hat-corona', 'Corona de reina del baile', 'hats', 'crown', 'metal', '#e3b45a', ['glam', 'fiesta', 'magico'], sp(90)),
  it('hat-bandana', 'Bandana', 'hats', 'bandana', 'cotton', '#e8243c', ['street', 'rock', 'boho'], { pattern: 'corazones', color2: '#ffffff' }),
  it('hat-panuelo', 'Pañuelo de seda', 'hats', 'headscarf', 'satin', '#fff16a', ['elegante', 'playa'], { pattern: 'flores', color2: '#3de0c4' }),

  // ───────────── ACCESORIOS DEL PELO ─────────────
  it('ha-mariposas', 'Pinzas mariposa', 'hairAcc', 'butterflyClips', 'plastic', '#c9a7ff', ['y2k', 'romantico']),
  it('ha-coletero', 'Coletero de satén', 'hairAcc', 'scrunchie', 'satin', '#ff5fae', ['y2k', 'street', 'romantico']),
  it('ha-diadema', 'Diadema acolchada', 'hairAcc', 'headband', 'satin', '#ff2d8a', ['glam', 'elegante', 'y2k']),
  it('ha-tiara', 'Tiara de cristal', 'hairAcc', 'tiara', 'gem', '#e8f6ff', ['glam', 'fiesta', 'magico']),
  it('ha-lazo', 'Lazo gigante', 'hairAcc', 'bow', 'satin', '#ff9fd0', ['romantico', 'y2k']),
  it('ha-flor', 'Flor de buganvilla', 'hairAcc', 'flower', 'cotton', '#e0218a', ['ibiza', 'boho', 'playa']),
  it('ha-estrellas', 'Horquillas de estrella', 'hairAcc', 'starPins', 'metal', '#fff16a', ['y2k', 'fiesta']),
  it('ha-pinza', 'Pinza de carey', 'hairAcc', 'claw', 'plastic', '#8a5a3c', ['street', 'elegante']),
  it('ha-corona-flores', 'Corona de flores', 'hairAcc', 'flowerCrown', 'cotton', '#ffb3d9', ['boho', 'romantico', 'ibiza']),
  it('ha-perlas', 'Horquillas de perlas', 'hairAcc', 'pearlPins', 'pearl', '#fff6f0', ['elegante', 'romantico']),
  it('ha-imperdibles', 'Horquillas imperdible', 'hairAcc', 'safetyPins', 'metal', '#c0c4d6', ['rock']),
  it('ha-cinta', 'Cinta deportiva', 'hairAcc', 'sweatband', 'knit', '#3de0c4', ['deportivo', 'street']),
  it('ha-tiara-perlas', 'Tiara de perlas de sirena', 'hairAcc', 'pearlTiara', 'pearl', '#ffe3f2', ['magico', 'ibiza', 'playa'], {
    rarity: 'secreta',
    unlock: { kind: 'heart' },
    story: 'Encontraste el corazón escondido. Como yo te encontré a ti.',
  }),
  it('ha-corona-hada', 'Corona de hada', 'hairAcc', 'fairyCrown', 'gem', '#ffd6f5', ['magico', 'romantico'], {
    rarity: 'secreta',
    unlock: { kind: 'ending' },
    story: 'La corona de la reina de nuestra nueva casa.',
  }),
]

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'tops', name: 'Tops' },
  { id: 'bottoms', name: 'Abajo' },
  { id: 'dresses', name: 'Vestidos' },
  { id: 'jackets', name: 'Chaquetas' },
  { id: 'shoes', name: 'Calzado' },
  { id: 'bags', name: 'Bolsos' },
  { id: 'jewelry', name: 'Joyas' },
  { id: 'glasses', name: 'Gafas' },
  { id: 'hats', name: 'Gorros' },
  { id: 'hairAcc', name: 'Pelo' },
]

export const ACCESSORY_SLOTS = ['bag', 'earrings', 'necklace', 'bracelet', 'glasses', 'hat', 'hairAcc'] as const

export const PATTERNS: { id: PatternId; name: string }[] = [
  { id: 'liso', name: 'Liso' },
  { id: 'denim', name: 'Denim' },
  { id: 'escoces', name: 'Escocés' },
  { id: 'leopardo', name: 'Leopardo' },
  { id: 'cebra', name: 'Cebra' },
  { id: 'purpurina', name: 'Purpurina' },
  { id: 'lentejuelas', name: 'Lentejuelas' },
  { id: 'saten', name: 'Satén' },
  { id: 'rejilla', name: 'Rejilla' },
  { id: 'corazones', name: 'Corazones' },
  { id: 'estrellas', name: 'Estrellas' },
  { id: 'flores', name: 'Flores' },
  { id: 'rayas', name: 'Rayas' },
  { id: 'escamas', name: 'Escamas' },
]
