export type FactionId = "water" | "earth" | "fire" | "air";
export type ChessRole = "king" | "queen" | "bishop" | "knight" | "rook" | "pawn";

export type WorldTransform = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
};

type FactionAssets = {
  shortName: string;
  glyph: string;
  motto: string;
  accent: string;
  clearColor: string;
  board: {
    url: string;
    gridFraction: number;
    tiltX?: number;
    depthScale?: number;
  };
  pieces: Record<ChessRole, string>;
  world: {
    id: string;
    label: string;
    lobbyPreview: string;
    runtimeUrl: string;
    colliderUrl: string;
    transform: WorldTransform;
    solidCourt?: {
      url: string;
      size: number;
      surfaceY: number;
      targetY: number;
    };
  };
};

const pieces = (faction: FactionId): Record<ChessRole, string> => ({
  king: {
    water: "https://cdn.mint.gg/glb/water-king-chief-arnook-normalized-86749b515607af49.glb",
    earth: "https://cdn.mint.gg/glb/earth-king-kuei-normalized-8437a567bb7ba669.glb",
    fire: "https://cdn.mint.gg/glb/fire-king-ozai-normalized-5a45e414ce370d5c.glb",
    air: "https://cdn.mint.gg/glb/air-king-aang-normalized-04b8af15291643b2.glb",
  }[faction],
  queen: {
    water: "https://cdn.mint.gg/glb/water-queen-katara-normalized-3d1a9e9c6966e969.glb",
    earth: "https://cdn.mint.gg/glb/earth-queen-toph-normalized-d737a857e37873b8.glb",
    fire: "https://cdn.mint.gg/glb/fire-queen-azula-normalized-42b088a2449217e6.glb",
    air: "https://cdn.mint.gg/glb/air-queen-yangchen-normalized-7fbd31f0074bc60c.glb",
  }[faction],
  bishop: {
    water: "https://cdn.mint.gg/glb/water-bishop-master-pakku-normalized-55248a4d16e4829f.glb",
    earth: "https://cdn.mint.gg/glb/earth-bishop-king-bumi-normalized-b47245e77ebcf125.glb",
    fire: "https://cdn.mint.gg/glb/fire-bishop-iroh-normalized-16170d70fccca26e.glb",
    air: "https://cdn.mint.gg/glb/air-bishop-monk-gyatso-normalized-2bc624eeca953a80.glb",
  }[faction],
  knight: {
    water: "https://cdn.mint.gg/glb/water-knight-sokka-normalized-2763ae5d846f2ec3.glb",
    earth: "https://cdn.mint.gg/glb/earth-knight-suki-normalized-e0d8c6bc964f5904.glb",
    fire: "https://cdn.mint.gg/glb/fire-knight-zuko-normalized-604315734b53bc74.glb",
    air: "https://cdn.mint.gg/glb/air-knight-appa-normalized-0ccc7cebbbde72c2.glb",
  }[faction],
  rook: {
    water: "https://cdn.mint.gg/glb/water-rook-ice-watchtower-normalized-792f1364ad981e22.glb",
    earth: "https://cdn.mint.gg/glb/earth-rook-ba-sing-se-gate-normalized-bdf2ad857aeee3b8.glb",
    fire: "https://cdn.mint.gg/glb/fire-rook-palace-tower-normalized-3b87b7a599b1b7c9.glb",
    air: "https://cdn.mint.gg/glb/air-rook-temple-tower-normalized-c4e8c8ce5905872a.glb",
  }[faction],
  pawn: {
    water: "https://cdn.mint.gg/glb/water-pawn-water-warrior-normalized-275b97bcfcada9d1.glb",
    earth: "https://cdn.mint.gg/glb/earth-pawn-earth-soldier-normalized-0b3a44c967044262.glb",
    fire: "https://cdn.mint.gg/glb/fire-pawn-fire-soldier-normalized-5060d30250acfb3e.glb",
    air: "https://cdn.mint.gg/glb/air-pawn-air-acolyte-normalized-b1f34d0111ce7aa5.glb",
  }[faction],
});

export const CONVERGENCE_FACTIONS: Record<FactionId, FactionAssets> = {
  water: {
    shortName: "Water Tribe",
    glyph: "水",
    motto: "Adapt and endure",
    accent: "#71d6f0",
    clearColor: "#071722",
    board: {
      url: "https://cdn.mint.gg/glb/water-tribe-board-normalized-3bc2c07c58236262.glb",
      gridFraction: 0.78,
      tiltX: -40.6,
      depthScale: 0.759,
    },
    pieces: pieces("water"),
    world: {
      id: "northern-moon-citadel",
      label: "Northern Moon Citadel",
      lobbyPreview:
        "https://cdn.mint.gg/assets/northern-water-tribe-courtyard-j9756wb2fjgtdq3hcdgswdzz7h8b1tne-preview-webp-8f354319f2d808ab.webp",
      runtimeUrl:
        "https://cdn.mint.gg/rad/northern-water-tribe-courtyard-dfe3d7a020b32e74-lod.rad",
      colliderUrl:
        "https://cdn.mint.gg/worlds/northern-water-tribe-courtyard-collider-867ab36046f00cb1.glb",
      transform: { x: 20, y: 1.5, z: -19.15, yaw: 86, scale: 5.12 },
    },
  },
  earth: {
    shortName: "Earth Kingdom",
    glyph: "土",
    motto: "Stand your ground",
    accent: "#c9b75b",
    clearColor: "#16160d",
    board: {
      url: "https://cdn.mint.gg/glb/earth-kingdom-board-normalized-382485ff7f69ae54.glb",
      gridFraction: 0.75,
      tiltX: 1.45,
    },
    pieces: pieces("earth"),
    world: {
      id: "jade-ring-court",
      label: "Jade Ring Court",
      lobbyPreview:
        "https://cdn.mint.gg/assets/ba-sing-se-terrace-j9704f9sr38rzak3atmn3xhtb98b0qtw-preview-webp-6147a2e16dbcec28.webp",
      runtimeUrl:
        "https://cdn.mint.gg/rad/ba-sing-se-terrace-e369787a6397d836-lod.rad",
      colliderUrl:
        "https://cdn.mint.gg/worlds/ba-sing-se-terrace-collider-08194297ef2100f9.glb",
      transform: { x: 0.9, y: 5.15, z: 58.6, yaw: 0, scale: 10.9 },
    },
  },
  fire: {
    shortName: "Fire Nation",
    glyph: "火",
    motto: "Strike with purpose",
    accent: "#f06b43",
    clearColor: "#1d0908",
    board: {
      url: "https://cdn.mint.gg/glb/fire-nation-board-normalized-5d91b6780457779c.glb",
      gridFraction: 0.89,
    },
    pieces: pieces("fire"),
    world: {
      id: "ember-crown-caldera",
      label: "Ember Crown Caldera",
      lobbyPreview:
        "https://cdn.mint.gg/assets/fire-nation-courtyard-j975wxzsgncqcqpyds4vtxfbrn8b1nyk-preview-webp-a6272e7d4a4d8179.webp",
      runtimeUrl:
        "https://cdn.mint.gg/rad/fire-nation-courtyard-acf9806faede0e5d-lod.rad",
      colliderUrl:
        "https://cdn.mint.gg/worlds/fire-nation-courtyard-collider-c65bec8011d0d0d1.glb",
      transform: { x: -0.1, y: 5.25, z: -0.1, yaw: 0, scale: 12 },
    },
  },
  air: {
    shortName: "Air Nomads",
    glyph: "氣",
    motto: "Move with freedom",
    accent: "#f2b657",
    clearColor: "#101820",
    board: {
      url: "https://cdn.mint.gg/glb/air-nomad-board-normalized-7547ab47f275b84e.glb",
      gridFraction: 0.88,
    },
    pieces: pieces("air"),
    world: {
      id: "grand-air-temple-solid-foundation-v5",
      label: "Grand Air Temple Foundation",
      lobbyPreview:
        "https://cdn.mint.gg/assets/southern-air-temple-courtyard-j978mjsbajqz8n2gx3dkbhma2h8b1nza-preview-webp-b44d12b9dc96d8a6.webp",
      runtimeUrl:
        "https://cdn.mint.gg/rad/southern-air-temple-courtyard-de80f3d362266569-lod.rad",
      colliderUrl:
        "https://cdn.mint.gg/worlds/southern-air-temple-courtyard-collider-aa96e8240b8c2f0f.glb",
      transform: { x: -0.45, y: -4.95, z: 13, yaw: 0, scale: 12.11 },
      solidCourt: {
        url: "https://cdn.mint.gg/glb/ivory-saffron-plinth-normalized-fdeee09a9781cedf.glb",
        size: 22,
        surfaceY: 0.069336,
        targetY: -1.08,
      },
    },
  },
};

export const CONVERGENCE_AUDIO = {
  ambience:
    "https://cdn.mint.gg/audio/xd7495f5xcjdw9s83z5swbb6mh8b1wht/convergence-chess-elemental-ambience-1f8308-392147002e6e09d5.mp3",
  move: "https://cdn.mint.gg/audio/xd7dd30zw65410cr3p1e5kdp3n8b17t3/convergence-chess-move-bfd81e-7d5c0adc1332e535.mp3",
  capture:
    "https://cdn.mint.gg/audio/xd73n3c2sxhegpc450ebs1tpfd8b1m0c/convergence-chess-capture-bbd5ac-7cf483d5817ae0a6.mp3",
  check:
    "https://cdn.mint.gg/audio/xd7fz0bxr0z0dx8250xfz7jcy18b0v6d/convergence-chess-check-32cb5a-d8729699ff34395e.mp3",
  victory:
    "https://cdn.mint.gg/audio/xd7dydb8080h6cjh708te8b0z98b1edq/convergence-chess-victory-bc4e99-10aa8f962759f569.mp3",
} as const;

export const CONVERGENCE_MINT = {
  factions: CONVERGENCE_FACTIONS,
  audio: CONVERGENCE_AUDIO,
} as const;
