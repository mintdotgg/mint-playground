export type Character = {
  id: string
  callsign: string
  name: string
  role: string
  origin: string
  description: string
  accent: string
  accentRgb: string
  theme: {
    secondary: string
    secondaryRgb: string
    deepRgb: string
    fog: string
    key: string
    fill: string
    exposure: number
    bloom: number
  }
  loot: {
    cacheImage: string
    cacheName: string
    rarity: string
    items: readonly {
      name: string
      type: string
      code: string
      kind: 'core' | 'blade' | 'utility' | 'relic'
    }[]
  }
  model: string
  animation: {
    idle: string
    signature: string
    signatureName: string
    thumbnailPose: number
  }
  stats: readonly [number, number, number]
}

export const roster: readonly Character[] = [
  {
    id: 'nyx-7',
    callsign: 'INFILTRATOR  /  01',
    name: 'NYX–7',
    role: 'Rift Operative',
    origin: 'Lagrange Blacksite',
    description: 'A silent synthetic hunter built to cross the seam between signal and shadow.',
    accent: '#a58bff',
    accentRgb: '165, 139, 255',
    theme: {
      secondary: '#ff4fd8',
      secondaryRgb: '255, 79, 216',
      deepRgb: '25, 8, 47',
      fog: '#10081d',
      key: '#e5d9ff',
      fill: '#5854cf',
      exposure: 1.14,
      bloom: 0.58,
    },
    loot: {
      cacheImage: 'https://cdn.mint.gg/images/gs7ggtzzcr4tentcqp1gzawr2d8af729/nyx-riftwalker-cache-d14340-1bdba6e5e471180c.png',
      cacheName: 'Riftwalker Cache',
      rarity: 'EXOTIC / PHASEBOUND',
      items: [
        { name: 'Rift Shard', type: 'POWER CORE', code: 'RS–09', kind: 'core' },
        { name: 'Phase Dagger', type: 'EDGE MODULE', code: 'PD–77', kind: 'blade' },
        { name: 'Null Cloak Cell', type: 'TACTICAL', code: 'NC–12', kind: 'utility' },
        { name: 'Ghost Key', type: 'RELIC', code: 'GK–Ø', kind: 'relic' },
      ],
    },
    model: 'https://cdn.mint.gg/glb/roundhouse-kick-md8affx7-glb-a5433796aa767add.glb',
    animation: {
      idle: 'https://cdn.mint.gg/glb/idle-02-eh8ae1x4-glb-79e4de98acf7d714.glb',
      signature: 'https://cdn.mint.gg/glb/roundhouse-kick-md8affx7-glb-a5433796aa767add.glb',
      signatureName: 'Roundhouse Kick',
      thumbnailPose: 0.5,
    },
    stats: [92, 67, 81],
  },
  {
    id: 'morrow',
    callsign: 'SIEGE  /  02',
    name: 'MORROW',
    role: 'Plagueborn',
    origin: 'Cinder Quarantine',
    description: 'The rescue suit survived. Its operator became something built to breach the impossible.',
    accent: '#b8ff5c',
    accentRgb: '184, 255, 92',
    theme: {
      secondary: '#ff7b32',
      secondaryRgb: '255, 123, 50',
      deepRgb: '20, 31, 6',
      fog: '#0d1607',
      key: '#d9ff9d',
      fill: '#d56728',
      exposure: 1.08,
      bloom: 0.48,
    },
    loot: {
      cacheImage: 'https://cdn.mint.gg/images/gs7xkjw42vg19r90nnmj105nms8ae42g/morrow-outbreak-cache-3a9c0b-447dbfde139d309e.png',
      cacheName: 'Outbreak Cache',
      rarity: 'VOLATILE / SEALED',
      items: [
        { name: 'Plague Core', type: 'BIO CORE', code: 'PC–31', kind: 'core' },
        { name: 'Spore Grenade', type: 'ORDNANCE', code: 'SG–04', kind: 'utility' },
        { name: 'Salvaged Injector', type: 'FIELD KIT', code: 'SI–88', kind: 'blade' },
        { name: 'Patient Zero Tag', type: 'RELIC', code: 'PZ–1', kind: 'relic' },
      ],
    },
    model: 'https://cdn.mint.gg/glb/punch-combo-xh8aef0m-glb-babac76d66db3434.glb',
    animation: {
      idle: 'https://cdn.mint.gg/glb/idle-02-c58aftth-glb-8228e84f80cb8830.glb',
      signature: 'https://cdn.mint.gg/glb/punch-combo-xh8aef0m-glb-babac76d66db3434.glb',
      signatureName: 'Punch Combo',
      thumbnailPose: 0.54,
    },
    stats: [54, 98, 72],
  },
  {
    id: 'aegis-04',
    callsign: 'VANGUARD  /  03',
    name: 'AEGIS–04',
    role: 'Orbital Vanguard',
    origin: 'Titan Drop Command',
    description: 'First through the atmosphere. Last to leave the line. A walking fortress with a human pulse.',
    accent: '#ffbd5a',
    accentRgb: '255, 189, 90',
    theme: {
      secondary: '#4f8fff',
      secondaryRgb: '79, 143, 255',
      deepRgb: '8, 23, 44',
      fog: '#071323',
      key: '#fff0cf',
      fill: '#3f74d9',
      exposure: 1.16,
      bloom: 0.5,
    },
    loot: {
      cacheImage: 'https://cdn.mint.gg/images/gs7xw7qtwvbfewvyhwh1n5kwj58afn0j/aegis-vanguard-cache-ce42bb-0848c4b83bf6ddcd.png',
      cacheName: 'Vanguard Drop Kit',
      rarity: 'MIL-SPEC / OMEGA',
      items: [
        { name: 'Drop Beacon', type: 'NAV MODULE', code: 'DB–17', kind: 'core' },
        { name: 'Kinetic Plate', type: 'ARMOR', code: 'KP–40', kind: 'utility' },
        { name: 'Orbital Charge', type: 'ORDNANCE', code: 'OC–6', kind: 'blade' },
        { name: 'Titan Dog Tag', type: 'RELIC', code: 'TD–04', kind: 'relic' },
      ],
    },
    model: 'https://cdn.mint.gg/glb/elbow-strike-0h8afp62-glb-ef2006bd4825f13c.glb',
    animation: {
      idle: 'https://cdn.mint.gg/glb/idle-02-y18af10h-glb-5ac0fda34a758e9b.glb',
      signature: 'https://cdn.mint.gg/glb/elbow-strike-0h8afp62-glb-ef2006bd4825f13c.glb',
      signatureName: 'Elbow Strike',
      thumbnailPose: 0.52,
    },
    stats: [76, 93, 88],
  },
  {
    id: 'vanta',
    callsign: 'ANOMALY  /  04',
    name: 'VANTA',
    role: 'Void Wraith',
    origin: 'Uncharted Dark',
    description: 'No confirmed species. No recorded voice. Only a constellation where the target used to be.',
    accent: '#55d9ff',
    accentRgb: '85, 217, 255',
    theme: {
      secondary: '#8a5cff',
      secondaryRgb: '138, 92, 255',
      deepRgb: '3, 20, 43',
      fog: '#030f20',
      key: '#c9f7ff',
      fill: '#7046d8',
      exposure: 1.12,
      bloom: 0.64,
    },
    loot: {
      cacheImage: 'https://cdn.mint.gg/images/gs7gkk05w1vmgr63713p8y0g598afzc2/vanta-void-cache-2cf781-7b096450755737dd.png',
      cacheName: 'Null Reliquary',
      rarity: 'ANOMALOUS / UNBOUND',
      items: [
        { name: 'Void Prism', type: 'POWER CORE', code: 'VP–∞', kind: 'core' },
        { name: 'Gravity Needle', type: 'EDGE MODULE', code: 'GN–3', kind: 'blade' },
        { name: 'Phase Core', type: 'TACTICAL', code: 'PH–X', kind: 'utility' },
        { name: 'Star-Silk Seal', type: 'RELIC', code: 'SS–9', kind: 'relic' },
      ],
    },
    model: 'https://cdn.mint.gg/glb/stand-dodge-3-9n8aegw1-glb-902e6b3ad1e9c486.glb',
    animation: {
      idle: 'https://cdn.mint.gg/glb/idle-02-018af51w-glb-73c0eab5eaea7c7a.glb',
      signature: 'https://cdn.mint.gg/glb/stand-dodge-3-9n8aegw1-glb-902e6b3ad1e9c486.glb',
      signatureName: 'Stand Dodge',
      thumbnailPose: 0.5,
    },
    stats: [96, 61, 94],
  },
  {
    id: 'solara',
    callsign: 'COMMAND  /  05',
    name: 'SOLARA',
    role: 'Dawnforged',
    origin: 'Helios Crown',
    description: 'A solar commander carrying the light of a small star into every collapsing front.',
    accent: '#ffd86f',
    accentRgb: '255, 216, 111',
    theme: {
      secondary: '#ff674d',
      secondaryRgb: '255, 103, 77',
      deepRgb: '49, 17, 4',
      fog: '#211006',
      key: '#fff6cf',
      fill: '#e85832',
      exposure: 1.2,
      bloom: 0.55,
    },
    loot: {
      cacheImage: 'https://cdn.mint.gg/images/gs7nbk80vpht91m0fzc2b150dn8ae983/solara-dawn-cache-44d6d2-aebfe59b90da6f0b.png',
      cacheName: 'Dawnforged Cache',
      rarity: 'ASCENDANT / SOLAR',
      items: [
        { name: 'Dawn Cell', type: 'POWER CORE', code: 'DC–01', kind: 'core' },
        { name: 'Flare Edge', type: 'BLADE MODULE', code: 'FE–7', kind: 'blade' },
        { name: 'Helios Sigil', type: 'COMMAND', code: 'HS–5', kind: 'utility' },
        { name: 'Phoenix Seal', type: 'RELIC', code: 'PS–Ω', kind: 'relic' },
      ],
    },
    model: 'https://cdn.mint.gg/glb/left-jab-from-guard-g58af9qw-glb-34447a3b6e4e8da3.glb',
    animation: {
      idle: 'https://cdn.mint.gg/glb/idle-02-1n8ae3tb-glb-f753fd939cb3354f.glb',
      signature: 'https://cdn.mint.gg/glb/left-jab-from-guard-g58af9qw-glb-34447a3b6e4e8da3.glb',
      signatureName: 'Left Jab from Guard',
      thumbnailPose: 0.46,
    },
    stats: [82, 86, 99],
  },
]
