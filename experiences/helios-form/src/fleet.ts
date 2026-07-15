export type Vehicle = {
  id: string
  sequence: string
  name: string
  family: string
  designation: string
  description: string
  model: string
  accent: string
  accentRgb: string
  secondary: string
  secondaryRgb: string
  surfaceRgb: string
  sceneColor: string
  dossierImage: string
  dossier: readonly [
    { category: string; title: string; detail: string },
    { category: string; title: string; detail: string },
    { category: string; title: string; detail: string },
  ]
  yaw: number
  displayScale: number
  lift: number
  specs: readonly [
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
  ]
}

export const fleet: readonly Vehicle[] = [
  {
    id: 'asterion-interceptor',
    sequence: '01',
    name: 'ASTERION',
    family: 'Orbital interceptor',
    designation: 'AX–01 / FLIGHT SYSTEM',
    description: 'A zero-drag orbital frame engineered for silent transfer between atmosphere and darkspace.',
    model: 'https://cdn.mint.gg/glb/asterion-interceptor-normalized-bdc5d443342e05eb.glb',
    accent: '#00aee8',
    accentRgb: '0, 174, 232',
    secondary: '#365cff',
    secondaryRgb: '54, 92, 255',
    surfaceRgb: '196, 226, 238',
    sceneColor: '#aabcc7',
    dossierImage: 'https://cdn.mint.gg/images/xn71vgq9am6mgpxtnn2c3x0y5s8afaxr/asterion-onboard-dossier-a35a63-b3a103319a2d29d5.png',
    dossier: [
      { category: 'FLIGHT KIT', title: 'Peregrine EVA Suite', detail: 'VECTOR PACK / MAG SEALS' },
      { category: 'MESS', title: 'Solo Orbit Café', detail: 'THERMAL BREW / RATION DOCK' },
      { category: 'INTERIOR', title: 'Velocity Cockpit', detail: 'HORIZON HUD / G-SEAT' },
    ],
    yaw: 0.08,
    displayScale: 1.18,
    lift: 0.22,
    specs: [
      { label: 'VELOCITY', value: 'M 12.8' },
      { label: 'RANGE', value: '18.4 AU' },
      { label: 'CREW', value: '01' },
    ],
  },
  {
    id: 'lumen-survey-drone',
    sequence: '02',
    name: 'LUMEN',
    family: 'Deep-space survey drone',
    designation: 'LM–7 / AUTONOMOUS',
    description: 'Petal-vector propulsion and a full-spectrum observatory turn empty space into legible terrain.',
    model: 'https://cdn.mint.gg/glb/lumen-survey-drone-normalized-cae0c71f3e7c1c69.glb',
    accent: '#8b4ee8',
    accentRgb: '139, 78, 232',
    secondary: '#e240e9',
    secondaryRgb: '226, 64, 233',
    surfaceRgb: '226, 207, 239',
    sceneColor: '#b4a8c4',
    dossierImage: 'https://cdn.mint.gg/images/xn79pt01ezv62rk5pttxyks5718afgdr/lumen-onboard-dossier-f5a5a9-8cde5f0be0fdc56a.png',
    dossier: [
      { category: 'SCIENCE KIT', title: 'Spectral Array', detail: 'SAMPLE VAULT / REPAIR SWARM' },
      { category: 'SERVICE BAY', title: 'Autonomous Refit', detail: 'CHARGE PETALS / FLUID RACK' },
      { category: 'CORE', title: 'Observatory Core', detail: '360 LIDAR / STAR MAP' },
    ],
    yaw: -0.12,
    displayScale: 0.92,
    lift: 0.2,
    specs: [
      { label: 'ENDURANCE', value: '9.6 YR' },
      { label: 'SENSORS', value: '360°' },
      { label: 'CREW', value: '00' },
    ],
  },
  {
    id: 'vesper-courier',
    sequence: '03',
    name: 'VESPER',
    family: 'Orbital courier',
    designation: 'VS–4 / GRAND TOURING',
    description: 'A manta-form civilian shuttle shaped around quiet acceleration and uninterrupted horizon glass.',
    model: 'https://cdn.mint.gg/glb/vesper-courier-normalized-1f73880a61e0273b.glb',
    accent: '#ef7a19',
    accentRgb: '239, 122, 25',
    secondary: '#ff3f68',
    secondaryRgb: '255, 63, 104',
    surfaceRgb: '242, 216, 191',
    sceneColor: '#c7b1a7',
    dossierImage: 'https://cdn.mint.gg/images/xn7149qz58mq24xkv01bxecw3s8afzg6/vesper-onboard-dossier-aa2162-2f8c71d88e117dd4.png',
    dossier: [
      { category: 'COURIER KIT', title: 'Cipher Luggage', detail: 'DISPATCH SAFE / TRAVEL SET' },
      { category: 'GALLEY', title: 'Horizon Café', detail: 'ESPRESSO RAIL / LOUNGE PAIR' },
      { category: 'CABIN', title: 'Grand Touring Deck', detail: 'TWIN SEATS / SKYGLASS' },
    ],
    yaw: 0.1,
    displayScale: 1.17,
    lift: 0.26,
    specs: [
      { label: 'VELOCITY', value: 'M 8.4' },
      { label: 'RANGE', value: '6.2 AU' },
      { label: 'CREW', value: '02' },
    ],
  },
  {
    id: 'kestrel-skimmer',
    sequence: '04',
    name: 'KESTREL',
    family: 'Antigravity skimmer',
    designation: 'KS–9 / SURFACE FLIGHT',
    description: 'Four field-vector nacelles hold a precision line one meter above any planetary surface.',
    model: 'https://cdn.mint.gg/glb/kestrel-skimmer-normalized-2020f9d491a3e96b.glb',
    accent: '#48a915',
    accentRgb: '72, 169, 21',
    secondary: '#00a990',
    secondaryRgb: '0, 169, 144',
    surfaceRgb: '218, 239, 201',
    sceneColor: '#b4c4b1',
    dossierImage: 'https://cdn.mint.gg/images/xn745j1vef5m248p4hcqwa7n8n8aeynn/kestrel-onboard-dossier-64a269-a782e27c39caa764.png',
    dossier: [
      { category: 'SURFACE KIT', title: 'Terrain Loadout', detail: 'CLIMB RIG / FIELD CALIBRATOR' },
      { category: 'GALLEY', title: 'Trail Café', detail: 'HYDRATION DOCK / SNACK MODULES' },
      { category: 'COCKPIT', title: 'Vector Flight Cell', detail: 'TERRAIN RADAR / TWIN YOKES' },
    ],
    yaw: 0.06,
    displayScale: 1.13,
    lift: 0.22,
    specs: [
      { label: 'VELOCITY', value: '680 KM/H' },
      { label: 'ALTITUDE', value: '1.2 KM' },
      { label: 'CREW', value: '02' },
    ],
  },
  {
    id: 'helix-vtol',
    sequence: '05',
    name: 'HELIX',
    family: 'Urban VTOL',
    designation: 'HX–2 / CITY TRANSIT',
    description: 'Twin annular lift systems fold a full metropolitan flight envelope into a remarkably small frame.',
    model: 'https://cdn.mint.gg/glb/helix-vtol-normalized-4912d91bd16d1cc2.glb',
    accent: '#e72458',
    accentRgb: '231, 36, 88',
    secondary: '#7448f3',
    secondaryRgb: '116, 72, 243',
    surfaceRgb: '237, 203, 219',
    sceneColor: '#c0adb8',
    dossierImage: 'https://cdn.mint.gg/images/xn7daxg5bgy9dzqetq516sgp2h8afqg9/helix-onboard-dossier-6d1f82-8b1a10186493d73f.png',
    dossier: [
      { category: 'CITY KIT', title: 'Metro Loadout', detail: 'COMMUTER HELM / MED POD' },
      { category: 'CABIN', title: 'Sky Café', detail: 'ESPRESSO WALL / FOUR SEATS' },
      { category: 'FLIGHT DECK', title: 'Urban Command', detail: 'TRAFFIC MESH / LIFT HUD' },
    ],
    yaw: -0.08,
    displayScale: 1.05,
    lift: 0.18,
    specs: [
      { label: 'VELOCITY', value: '420 KM/H' },
      { label: 'RANGE', value: '1,280 KM' },
      { label: 'CREW', value: '04' },
    ],
  },
  {
    id: 'orison-explorer',
    sequence: '06',
    name: 'ORISON',
    family: 'Planetary explorer',
    designation: 'OR–11 / EXPEDITION',
    description: 'A long-range science platform built to land cleanly where maps, weather and certainty end.',
    model: 'https://cdn.mint.gg/glb/orison-explorer-normalized-d1a9615fc39aec00.glb',
    accent: '#00a184',
    accentRgb: '0, 161, 132',
    secondary: '#8ebd20',
    secondaryRgb: '142, 189, 32',
    surfaceRgb: '199, 235, 229',
    sceneColor: '#a9c2bf',
    dossierImage: 'https://cdn.mint.gg/images/xn795ab5zzdqz2jyjav6syw2dx8afctr/orison-onboard-dossier-4fcac2-6041bcf8054dc8cb.png',
    dossier: [
      { category: 'EXPEDITION', title: 'Survey Loadout', detail: 'GEOLOGY LAB / WEATHER DRONE' },
      { category: 'GALLEY', title: 'Long-Range Mess', detail: 'HYDROPONICS / SIX PLACES' },
      { category: 'COMMAND', title: 'Science Deck', detail: 'NAV TABLE / FIELD STATIONS' },
    ],
    yaw: 0.12,
    displayScale: 1.1,
    lift: 0.2,
    specs: [
      { label: 'ENDURANCE', value: '420 D' },
      { label: 'RANGE', value: '22.7 AU' },
      { label: 'CREW', value: '06' },
    ],
  },
]
