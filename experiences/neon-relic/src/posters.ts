export interface LightDef {
  color: string
  intensity: number
  pos: [number, number, number]
}

export interface PosterDef {
  id: string
  index: string
  megaTitle: string
  megaSub: string // '|' separated fragments spread across the width
  nameTag: string
  brandLines: string
  chips: string[]
  codeTL: string
  codeTR: string
  codeBL: string
  codeBR: string
  infoCode: string
  tagline: string
  serial: string
  bigIndex: string
  ticker: string
  edgeLeft: string
  edgeRight: string
  strands: [string, string, string, string]
  paragraphHead: string
  paragraph: string
  stats: [string, string, string] // "LABEL — VALUE"
  model: {
    url: string
    /** normalized largest dimension of the model */
    height: number
    /** extra lift off the pedestal */
    yOffset: number
    rotationY: number
    /** multiplier for baked emissive maps (tames bloom hotspots) */
    emissive?: number
    /** minimum per-texel roughness (kills mirror-flat glint patches) */
    roughFloor?: number
  }
  turntableSpeed: number
  floatAmp: number
  env: {
    bg: string
    fog: string
    fogDensity: number
    floor: string
    backdrop: string
    pedestal: string
    key: LightDef
    rim: LightDef
    accentA: LightDef
    accentB: LightDef
    hemiSky: string
    hemiGround: string
    hemiIntensity: number
    bloom: number
    exposure: number
    particles: string
  }
  ui: {
    accent: string
    ink: string
    paper: string
  }
  cam: {
    pos: [number, number, number]
    target: [number, number, number]
  }
}

export const POSTERS: PosterDef[] = [
  {
    id: 'aether',
    index: '01',
    megaTitle: 'AETHER',
    megaSub: '///// EXHIBIT 01|SYNTHETIC PORTRAITURE WING|OFFSET 300DPI|NOT FOR RESALE /////',
    nameTag: 'AETHER©',
    brandLines: 'NEON\nMX',
    chips: ['HEXAGON', 'PENTAGON', 'MAYBE YOU SUCK'],
    codeTL: '// (99)_31',
    codeTR: '// (X1239)_31',
    codeBL: 'NEON INC — 83129 // 31',
    codeBR: '// 2131',
    infoCode: '// 2944 //////////',
    tagline: 'YOUR NEW\nHUMANOID',
    serial: '74 — — 55',
    bigIndex: '✕ 213',
    ticker:
      'AETHER UNIT 506 · DRI-SYNTH EPIDERMIS · 301023© 23 ミッション· CHAIN-LOCKED · YOUR NEW HUMANOID · ',
    edgeLeft: 'SYNTHETIC EPIDERMIS PROGRAM',
    edgeRight: 'UNIT 506 — DO NOT UNCHAIN',
    strands: ['ANTI-STATIC', '100% RECYCLED SOUL', 'MADE IN NEO-SEOUL', 'VER. 23.301023'],
    paragraphHead: 'FIELD NOTES /01',
    paragraph:
      'The unit arrived chained at the request of its previous owner. Diagnostics found no aggression — only a persistent dream loop, forty seconds long, repeating a street market in the rain. Handlers report the chain is cosmetic. The unit disagrees.',
    stats: ['HEIGHT — 2.55U', 'MASS — CLASSIFIED', 'EMPATHY — 97.4%'],
    model: {
      url: 'https://cdn.mint.gg/glb/porcelain-chain-android-normalized-c931a83aec063e6e.glb',
      height: 2.55,
      yOffset: 0.02,
      rotationY: 0,
    },
    turntableSpeed: 0.05,
    floatAmp: 0.015,
    env: {
      bg: '#cfd1cd',
      fog: '#cfd1cd',
      fogDensity: 0.028,
      floor: '#c4c6c2',
      backdrop: '#d8dad6',
      pedestal: '#b8bab6',
      key: { color: '#fff5e8', intensity: 3.4, pos: [3.4, 4.6, 3.2] },
      rim: { color: '#eaffff', intensity: 2.6, pos: [-3.2, 3.4, -3.4] },
      accentA: { color: '#c8ff00', intensity: 6, pos: [-3.2, 0.9, 2.6] },
      accentB: { color: '#ffffff', intensity: 8, pos: [2.4, 0.8, -1.6] },
      hemiSky: '#ffffff',
      hemiGround: '#9a9c98',
      hemiIntensity: 0.85,
      bloom: 0.18,
      exposure: 1.06,
      particles: '#ffffff',
    },
    ui: { accent: '#c8ff00', ink: '#141414', paper: '#cfd1cd' },
    cam: { pos: [0, 1.62, 4.1], target: [0, 1.38, 0] },
  },
  {
    id: 'prism',
    index: '02',
    megaTitle: 'PRISM',
    megaSub: '///// EXHIBIT 02|REFRACTIVE FAUNA WING|KEEP ENCLOSURE DARK|FEEDING CANCELLED /////',
    nameTag: 'SAUR//X',
    brandLines: 'CRYSTAL\nFAUNA',
    chips: ['REFRACTIVE', 'IDX 2.42', 'DO NOT FEED'],
    codeTL: '00 SHARDS',
    codeTR: '99% SPECTRAL · 909',
    codeBL: 'SPECIMEN B-12 // GLASS',
    codeBR: '// 4411',
    infoCode: '// SPECTRO ///////',
    tagline: 'LIGHT\nEATER',
    serial: 'RGB — — ∞',
    bigIndex: '◇ 442',
    ticker:
      'PRISM SAUR · FULL-SPECTRUM DISPERSION · CAGE CLASS IV · REFRACTIVE FAUNA PROGRAM · LIGHT EATER · ',
    edgeLeft: 'FULL-SPECTRUM DISPERSION',
    edgeRight: 'CAGE CLASS IV — KEEP DARK',
    strands: ['REFRACTS 99.7%', 'NO NATURAL PREDATOR', 'GROWN NOT CUT', 'IDX 2.42'],
    paragraphHead: 'SPECIMEN LOG /02',
    paragraph:
      'It eats light the way other animals eat time — slowly, then all at once. Keep the enclosure dark. What it cannot digest it throws back as color, and staff have described that color as "too honest". Feeding hours are cancelled indefinitely.',
    stats: ['SHARDS — 00', 'ALBEDO — 0.99', 'TEMPER — CRYSTALLINE'],
    model: {
      url: 'https://cdn.mint.gg/glb/prismatic-crystal-kaiju-normalized-3899a0a7fe8dad5c.glb',
      height: 3.1,
      yOffset: 0.02,
      rotationY: -0.5,
      emissive: 0.14,
      roughFloor: 0.38,
    },
    turntableSpeed: 0.09,
    floatAmp: 0.03,
    env: {
      bg: '#060608',
      fog: '#060608',
      fogDensity: 0.05,
      floor: '#161618',
      backdrop: '#0a0a0e',
      pedestal: '#1c1c20',
      key: { color: '#ffffff', intensity: 2.2, pos: [2.8, 4.2, 3.0] },
      rim: { color: '#4dd8ff', intensity: 3.5, pos: [-3.6, 3.0, -3.0] },
      accentA: { color: '#ff3b1f', intensity: 14, pos: [-2.4, 1.6, 2.2] },
      accentB: { color: '#8a5cff', intensity: 11, pos: [2.8, 1.0, -2.0] },
      hemiSky: '#404060',
      hemiGround: '#050508',
      hemiIntensity: 0.5,
      bloom: 0.3,
      exposure: 1.12,
      particles: '#7fdfff',
    },
    ui: { accent: '#ff3b1f', ink: '#ecebee', paper: '#060608' },
    cam: { pos: [0.2, 1.35, 4.6], target: [0, 1.0, 0] },
  },
  {
    id: 'glare',
    index: '03',
    megaTitle: 'GLARE',
    megaSub: '///// EXHIBIT 03|SYMBOL CONCEPT ©2018|DIGITAL STUDIO LLC|NATURE → NETWORK /////',
    nameTag: 'GLARE',
    brandLines: 'SYMBOL\nCONCEPT',
    chips: ['FIERCE', 'FUTURE-FORWARD', 'STYLE ©2018'],
    codeTL: '01 / DIGITAL STUDIO',
    codeTR: '©2018 GLARE, LLC.',
    codeBL: 'NATURE REPLACED BY NETWORK',
    codeBR: '01 // 01',
    infoCode: '// LITHIC ////////',
    tagline: 'ROCK\nSIGNAL',
    serial: '01 — — 01',
    bigIndex: '○ 018',
    ticker:
      'GLARE · THE MORE PEOPLE ADVANCE IN EXPLORING NATURE THE MORE COMPLEX THEIR CULTURAL SPACE BECOMES · ©2018 GLARE LLC · ',
    edgeLeft: 'NATURE REPLACED BY NETWORK',
    edgeRight: 'SYMBOL CONCEPT — ©2018',
    strands: ['FIERCE', 'FUTURE-FORWARD', 'COMPRESSION NOT DECAY', '01 — 01'],
    paragraphHead: 'MANIFESTO /03',
    paragraph:
      'The more people advance in exploring nature, the more complex their cultural space becomes. We stopped carving statues of gods and started stacking rocks with logos. This is not decay — this is compression. The stone remembers everything we sprayed on it.',
    stats: ['ROCKS — 09', 'CHROME — 02', 'MEANING — TBD'],
    model: {
      url: 'https://cdn.mint.gg/glb/graffiti-chrome-cairn-normalized-8759d0cc1a65c04c.glb',
      height: 2.3,
      yOffset: 0.05,
      rotationY: 0.3,
    },
    turntableSpeed: 0.12,
    floatAmp: 0.05,
    env: {
      bg: '#9c9c9c',
      fog: '#9c9c9c',
      fogDensity: 0.03,
      floor: '#8f8f8f',
      backdrop: '#a6a6a6',
      pedestal: '#7e7e7e',
      key: { color: '#ffffff', intensity: 3.2, pos: [3.0, 5.0, 2.6] },
      rim: { color: '#f2fff2', intensity: 2.2, pos: [-2.8, 3.6, -3.2] },
      accentA: { color: '#c6ff2e', intensity: 16, pos: [-2.2, 1.4, 2.0] },
      accentB: { color: '#ffffff', intensity: 6, pos: [2.6, 0.9, -1.8] },
      hemiSky: '#ffffff',
      hemiGround: '#707070',
      hemiIntensity: 0.9,
      bloom: 0.22,
      exposure: 1.0,
      particles: '#e8ffe0',
    },
    ui: { accent: '#c6ff2e', ink: '#191919', paper: '#9c9c9c' },
    cam: { pos: [0, 1.5, 4.4], target: [0, 1.05, 0] },
  },
  {
    id: 'goldspine',
    index: '04',
    megaTitle: 'RELIC',
    megaSub: '///// EXHIBIT 04|VAULT WING — RESTRICTED|PORCELAIN OVER 24K|NIGHT STAFF ONLY /////',
    nameTag: 'GOLDSPINE',
    brandLines: 'BIO\nMECH',
    chips: ['PEARL SHELL', 'AU-24 SERVOS', 'QUILL ARRAY'],
    codeTL: '791 / SCHEDULED',
    codeTR: '1723 25 — 29',
    codeBL: 'SPECIMEN 23 // VAULT',
    codeBR: '// 0x23',
    infoCode: '// OSSEOUS ///////',
    tagline: 'GILDED\nINSIDE',
    serial: '23 — — 29',
    bigIndex: '● 791',
    ticker:
      'GOLDSPINE RELIC · PORCELAIN OVER 24K ARMATURE · FIBER-OPTIC SPINE ONLINE · MUSEUM VAULT SPECIMEN · GILDED INSIDE · ',
    edgeLeft: 'PORCELAIN OVER 24K ARMATURE',
    edgeRight: 'VAULT SPECIMEN 23 — 29',
    strands: ['GILDED INSIDE', 'QUILLS TRACK VISITORS', 'HANDLE NEVER', '0x23'],
    paragraphHead: 'VAULT MEMO /04',
    paragraph:
      'Restoration found gold where bone should be, and bone where nothing should be. The quills still track visitors through the glass. Insurance requires we call it a sculpture; the night staff require we call it "sir". Both requirements are currently met.',
    stats: ['SERVOS — AU24', 'SPINE — FIBER', 'STATUS — AWAKE'],
    model: {
      url: 'https://cdn.mint.gg/glb/pearl-quill-stalker-normalized-beac862e4d9d17de.glb',
      height: 3.0,
      yOffset: 0.02,
      rotationY: 0.45,
      emissive: 0.08,
      roughFloor: 0.42,
    },
    turntableSpeed: 0.07,
    floatAmp: 0.02,
    env: {
      bg: '#0a0806',
      fog: '#0a0806',
      fogDensity: 0.045,
      floor: '#171310',
      backdrop: '#0e0b08',
      pedestal: '#221c14',
      key: { color: '#ffe6b8', intensity: 3.2, pos: [3.2, 4.4, 2.8] },
      rim: { color: '#3b8cff', intensity: 4.2, pos: [-3.4, 3.2, -3.0] },
      accentA: { color: '#e8b84b', intensity: 13, pos: [-2.4, 1.4, 2.2] },
      accentB: { color: '#2456ff', intensity: 9, pos: [2.6, 0.9, -2.2] },
      hemiSky: '#4a3c28',
      hemiGround: '#060505',
      hemiIntensity: 0.55,
      bloom: 0.26,
      exposure: 1.1,
      particles: '#ffd98a',
    },
    ui: { accent: '#e8b84b', ink: '#f0ede6', paper: '#0a0806' },
    cam: { pos: [-0.2, 1.4, 4.5], target: [0, 1.0, 0] },
  },
]
