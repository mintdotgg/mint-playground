import type { DecorProduct, FinishOption, Product } from '../types'

const finish = (
  id: string,
  name: string,
  description: string,
  primary: string,
  secondary: string,
  accent: string,
  materialNames: string[],
  priceDelta = 0,
): FinishOption => ({ id, name, description, primary, secondary, accent, materialNames, priceDelta })

export const products: Product[] = [
  {
    id: 'morrow-sofa',
    name: 'Morrow Sofa',
    category: 'Sofa',
    tagline: 'A low horizon of folded linen and timber.',
    story: 'Morrow treats the sofa as a small piece of architecture. Three generous cushions hover above an inset plinth while a continuous folded back reveals a smoked-oak rail from behind. Its silhouette is calm from across the room and deliberately tactile up close.',
    designer: {
      name: 'Nia Verne',
      location: 'Rotterdam, Netherlands',
      profile: 'Verne works between upholstery and architectural joinery, pairing deep comfort with visible structural gestures. Her studio prototypes every piece at full scale before reducing its lines to the essentials.',
    },
    dimensions: { width: 2.46, depth: 1.04, height: 0.7 },
    weightKg: 94,
    price: 7200,
    leadTimeWeeks: [10, 12],
    finishes: [
      finish('morrow-flax', 'Flax / Smoked Oak', 'Natural slub linen with a dark oak rail.', '#c9b99f', '#3d3028', '#b9bec0', ['Natural slub linen', 'Smoked oak', 'Brushed aluminum']),
      finish('morrow-chalk', 'Chalk / Pale Ash', 'Ivory bouclé softens the pale ash structure.', '#ded9cf', '#c6ae87', '#aeb3b5', ['Chalk bouclé', 'Pale ash', 'Brushed aluminum'], 420),
      finish('morrow-blue', 'Ultramarine / Smoked Oak', 'A saturated wool field over the darkest timber.', '#1734b5', '#332a25', '#bfc4c7', ['Ultramarine wool', 'Smoked oak', 'Brushed aluminum'], 580),
    ],
    construction: [
      { title: 'Floating plinth', description: 'A recessed laminated timber plinth carries the seat while preserving the low hovering silhouette.' },
      { title: 'Reversible cushions', description: 'Multi-density foam cores are wrapped in wool batting and finished with concealed zips.' },
      { title: 'Rear rail', description: 'The exposed timber rail locks the back frame and gives the sofa a finished view from every side.' },
    ],
    care: ['Vacuum upholstery with a soft brush monthly.', 'Blot spills immediately; do not rub.', 'Oil the exposed timber rail once every 18–24 months.'],
    campaignImage: 'https://cdn.mint.gg/images/xn76m6wqfv07e0jrm89q2ym7n18ayd7y/morrow-sofa-campaign-cb00d4-738b7228ea486a75.png',
  },
  {
    id: 'fold-lounge',
    name: 'Fold No. 2 Lounge',
    category: 'Lounge chair',
    tagline: 'A sling chair drawn as one emphatic fold.',
    story: 'Fold No. 2 balances the informality of a sling with the precision of cabinetmaking. Its seat and back read as one continuous upholstered plane, held between compact timber cheeks and a polished tension bar.',
    designer: {
      name: 'Emil Osei',
      location: 'Accra, Ghana',
      profile: 'Osei is a sculptor and self-taught furniture maker interested in tension, balance, and the point where soft materials become structural. His limited-edition work informs this more approachable studio collection.',
    },
    dimensions: { width: 0.88, depth: 0.96, height: 0.77 },
    weightKg: 31,
    price: 3600,
    leadTimeWeeks: [8, 10],
    finishes: [
      finish('fold-cognac', 'Cognac / Pale Ash', 'Saddle leather with clear-oiled ash.', '#9a5f36', '#c9b289', '#c3c7c8', ['Cognac saddle leather', 'Pale ash', 'Polished steel']),
      finish('fold-chalk', 'Chalk / Smoked Oak', 'Textural bouclé against dark open grain.', '#dfdbd2', '#3a2f29', '#bec3c5', ['Chalk bouclé', 'Smoked oak', 'Polished steel'], 180),
      finish('fold-blue', 'Ultramarine / Pale Ash', 'Dense blue wool with pale timber cheeks.', '#1b39bd', '#c8b18b', '#c4c8c9', ['Ultramarine wool', 'Pale ash', 'Polished steel'], 260),
    ],
    construction: [
      { title: 'Tension bar', description: 'A polished steel bar preloads the frame and keeps the sling geometry crisp.' },
      { title: 'Layered sling', description: 'Upholstery wraps a flexible laminated core so the chair gives without sagging.' },
      { title: 'Wedged joints', description: 'Visible cross-grain wedges lock each ash frame joint without decorative hardware.' },
    ],
    care: ['Dust leather with a dry cotton cloth.', 'Keep at least 50 cm from direct heat.', 'Tighten the concealed frame bolts annually.'],
    campaignImage: 'https://cdn.mint.gg/images/xn76f7d51ysq2mze5c0cmnx4dh8azcr9/fold-lounge-campaign-e07f7a-7d64e46195ab1d71.png',
  },
  {
    id: 'cairn-table',
    name: 'Cairn Coffee Table',
    category: 'Coffee table',
    tagline: 'Two stone volumes held in deliberate imbalance.',
    story: 'Cairn is built from two offset stone masses that appear to lean together. Rounded edges soften the weight, while recessed bronze feet lift the composition just enough for a shadow line to pass underneath.',
    designer: {
      name: 'Yuna Pell',
      location: 'Brussels, Belgium',
      profile: 'Pell studies the emotional weight of stone and cast metal. Her objects borrow the directness of monuments but are scaled for hands, books, cups, and daily rituals.',
    },
    dimensions: { width: 1.36, depth: 0.76, height: 0.34 },
    weightKg: 116,
    price: 4200,
    leadTimeWeeks: [12, 14],
    finishes: [
      finish('cairn-travertine', 'Warm Travertine', 'Honed and filled beige stone with bronze feet.', '#cbb795', '#bca27f', '#776047', ['Warm travertine', 'Patinated brass']),
      finish('cairn-rosso', 'Rosso Stone', 'Muted red-brown stone over dark bronze.', '#8b5348', '#74443d', '#5f4a3c', ['Rosso stone', 'Dark patinated brass'], 680),
      finish('cairn-dual', 'Travertine / Rosso', 'Contrasting interlocked stone volumes.', '#c6b18f', '#875048', '#6e5942', ['Warm travertine', 'Rosso stone', 'Patinated brass'], 440),
    ],
    construction: [
      { title: 'Book-matched blocks', description: 'Slabs are sequenced so the directional stone pores flow across each volume.' },
      { title: 'Hidden armature', description: 'A recessed aluminum structure keeps the two offset masses mechanically connected.' },
      { title: 'Bronze feet', description: 'Four adjustable feet protect the floor and create the table’s narrow shadow gap.' },
    ],
    care: ['Use coasters for acidic drinks and oils.', 'Clean with pH-neutral stone soap only.', 'Re-seal the stone every 18 months.'],
    campaignImage: 'https://cdn.mint.gg/images/xn711yt8kejv11qs7w4a4965t18az7h8/cairn-table-campaign-b3c77d-37a1d0f5301a37c0.png',
  },
  {
    id: 'span-table',
    name: 'Span Dining Table',
    category: 'Dining table',
    tagline: 'A timber plane tensioned by a cast-metal spine.',
    story: 'Span reduces the dining table to three legible moves: a softly pillowed timber top, two broad trestles, and a cast-metal rail held in clear view. The rail carries cable management and turns engineering into ornament.',
    designer: {
      name: 'Mara Cendre',
      location: 'Montréal, Canada',
      profile: 'Cendre trained in industrial design before opening a workshop focused on domestic structures. She leaves fasteners and load paths visible, then rounds every surface that meets the body.',
    },
    dimensions: { width: 2.2, depth: 0.96, height: 0.74 },
    weightKg: 82,
    price: 5800,
    leadTimeWeeks: [9, 11],
    finishes: [
      finish('span-ash', 'Pale Ash / Aluminum', 'Clear-oiled ash and satin cast aluminum.', '#c6ae86', '#b69569', '#aeb4b6', ['Pale ash', 'Brushed aluminum']),
      finish('span-smoked', 'Smoked Oak / Aluminum', 'Dark open-grain timber over a cool rail.', '#3a302b', '#2b2421', '#aeb4b6', ['Smoked oak', 'Brushed aluminum'], 320),
      finish('span-blue', 'Ultramarine / Ash', 'A lacquered blue rail beneath pale ash.', '#c7b18c', '#b59b73', '#1736b7', ['Pale ash', 'Ultramarine lacquered aluminum'], 260),
    ],
    construction: [
      { title: 'Cast spine', description: 'The visible rail ties both trestles together and carries concealed power and cable channels.' },
      { title: 'Pillowed edge', description: 'A compound routed edge makes the solid top appear thinner while remaining comfortable to touch.' },
      { title: 'Knock-down joints', description: 'Precision steel inserts let the table travel flat without weakening repeated assembly.' },
    ],
    care: ['Wipe with a barely damp cloth along the grain.', 'Use trivets beneath hot serving pieces.', 'Re-oil high-wear areas when the surface appears dry.'],
    campaignImage: 'https://cdn.mint.gg/images/xn76yd3svs72p9ps859hdp8sfd8azgw8/span-table-campaign-4554d5-294ac7fd293374dd.png',
  },
  {
    id: 'pilaster-credenza',
    name: 'Pilaster Credenza',
    category: 'Storage',
    tagline: 'A quiet façade with one precise moving line.',
    story: 'Pilaster turns storage into a small elevation. Fluted fronts repeat across four doors, interrupted only by a shallow central drawer. A solid travertine base gives the case weight while tiny brass pulls reward close inspection.',
    designer: {
      name: 'Teo Aven',
      location: 'Mexico City, Mexico',
      profile: 'Aven’s studio combines architectural millwork with saturated mineral color. His pieces are composed as façades, then detailed around the touch of a hand: a pull, a rounded corner, a damped hinge.',
    },
    dimensions: { width: 1.84, depth: 0.48, height: 0.78 },
    weightKg: 108,
    price: 6900,
    leadTimeWeeks: [14, 16],
    finishes: [
      finish('pilaster-clay', 'Clay / Travertine', 'Dusty clay lacquer, warm stone, aged brass.', '#9f7466', '#c4af8d', '#927247', ['Clay lacquered ash', 'Warm travertine', 'Patinated brass']),
      finish('pilaster-bone', 'Bone / Travertine', 'Warm bone lacquer over matching stone.', '#d7cfc0', '#c5af8d', '#927247', ['Bone lacquered ash', 'Warm travertine', 'Patinated brass']),
      finish('pilaster-blue', 'Ultramarine / Rosso', 'A blue façade grounded by muted red stone.', '#1736b6', '#845046', '#9b7849', ['Ultramarine lacquered ash', 'Rosso stone', 'Patinated brass'], 460),
    ],
    construction: [
      { title: 'Damped drawer', description: 'The shallow central drawer rides on concealed runners with a tuned soft-close action.' },
      { title: 'Fluted fronts', description: 'Solid ash fronts are individually milled before receiving six hand-sanded lacquer coats.' },
      { title: 'Stone plinth', description: 'The travertine base is hollowed internally to reduce weight while retaining its monolithic edge.' },
    ],
    care: ['Use a microfiber cloth without silicone polish.', 'Lift objects rather than dragging them across the top.', 'Clean brass gently; the patina is intended to deepen.'],
    campaignImage: 'https://cdn.mint.gg/images/xn7480zz70ptjk9ddnafc71g6h8ayfxm/pilaster-credenza-campaign-f9e663-ee723368d9cc5863.png',
  },
  {
    id: 'loop-daybed',
    name: 'Loop Daybed',
    category: 'Daybed',
    tagline: 'One continuous line gathers a place to pause.',
    story: 'Loop pairs a substantial upholstered deck with a single polished tube that rises to become both arm and back. It works equally well against a wall or floating in a room, where the full gesture remains visible.',
    designer: {
      name: 'Ivo Rusk',
      location: 'Copenhagen, Denmark',
      profile: 'Rusk designs furniture around a single drawn gesture. His work is materially direct, often pairing one continuous metal line with a heavier timber or upholstered volume.',
    },
    dimensions: { width: 1.94, depth: 0.82, height: 0.59 },
    weightKg: 58,
    price: 4950,
    leadTimeWeeks: [8, 10],
    finishes: [
      finish('loop-flax', 'Flax / Smoked Oak', 'Natural linen, dark timber, polished steel.', '#cab99d', '#3b302a', '#c8cccd', ['Natural slub linen', 'Smoked oak', 'Polished steel']),
      finish('loop-blue', 'Ultramarine / Smoked Oak', 'Blue wool on a dark deck and silver loop.', '#1838ba', '#392f29', '#c8cccd', ['Ultramarine wool', 'Smoked oak', 'Polished steel'], 260),
      finish('loop-cognac', 'Cognac / Pale Ash', 'Saddle leather over pale timber.', '#9c6037', '#c6af89', '#c9cdce', ['Cognac saddle leather', 'Pale ash', 'Polished steel'], 520),
    ],
    construction: [
      { title: 'Continuous loop', description: 'A single mandrel-bent stainless tube forms the arm, back, and rear support without a visible seam.' },
      { title: 'Sprung deck', description: 'A webbed timber deck gives the tailored cushion a softer first sit.' },
      { title: 'Tailored bolster', description: 'The loose bolster uses a weighted inner flap so it stays in place without straps.' },
    ],
    care: ['Rotate the loose cushion monthly.', 'Use a textile-safe upholstery brush.', 'Polish the steel with a clean cloth, following the tube.'],
    campaignImage: 'https://cdn.mint.gg/images/xn7682h51z32stafxnnyepz1q58ayeg8/loop-daybed-campaign-3fd6aa-73ff7b3a52158954.png',
  },
]

export const decorProducts: DecorProduct[] = [
  { id: 'ultramarine-grid', name: 'Grid Wool Rug', category: 'rug', price: 1280, leadTimeWeeks: [4, 6], color: '#1838b8', dimensions: { width: 2.8, depth: 2.0, height: 0.02 } },
  { id: 'travertine-tone', name: 'Tone Tufted Rug', category: 'rug', price: 1480, leadTimeWeeks: [5, 7], color: '#c4ad88', dimensions: { width: 2.6, depth: 1.9, height: 0.03 } },
  { id: 'arc-floor-lamp', name: 'Arc Floor Lamp', category: 'lighting', price: 980, leadTimeWeeks: [6, 8], color: '#252422', dimensions: { width: 0.7, depth: 0.5, height: 1.82 } },
  { id: 'column-table-lamp', name: 'Column Table Lamp', category: 'lighting', price: 520, leadTimeWeeks: [4, 5], color: '#c9b391', dimensions: { width: 0.28, depth: 0.28, height: 0.45 } },
  { id: 'rubber-plant', name: 'Tall Rubber Plant', category: 'plant', price: 320, leadTimeWeeks: [1, 2], color: '#334a37', dimensions: { width: 0.7, depth: 0.7, height: 1.65 } },
  { id: 'olive-planter', name: 'Olive Branch Planter', category: 'plant', price: 460, leadTimeWeeks: [2, 3], color: '#63715e', dimensions: { width: 0.8, depth: 0.8, height: 1.85 } },
  { id: 'blue-relief', name: 'Ultramarine Relief', category: 'art', price: 1100, leadTimeWeeks: [3, 5], color: '#1838b8', dimensions: { width: 1.2, depth: 0.06, height: 1.45 } },
  { id: 'floating-shelf', name: 'Floating Ash Shelf', category: 'shelf', price: 440, leadTimeWeeks: [4, 6], color: '#c6ae86', dimensions: { width: 1.4, depth: 0.26, height: 0.08 } },
]

export const productById = (id: string) => products.find((product) => product.id === id)
export const decorById = (id: string) => decorProducts.find((decor) => decor.id === id)

export const formatPrice = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(amount)

export const formatDimensions = (product: Product, scale = 1) => {
  const { width, depth, height } = product.dimensions
  return `${Math.round(width * scale * 100)} × ${Math.round(depth * scale * 100)} × ${Math.round(height * scale * 100)} cm`
}

export const deliveryWindow = ([min, max]: [number, number], from = new Date()) => {
  const start = new Date(from)
  const end = new Date(from)
  start.setDate(start.getDate() + min * 7)
  end.setDate(end.getDate() + max * 7)
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${formatter.format(start)}–${formatter.format(end)}`
}
