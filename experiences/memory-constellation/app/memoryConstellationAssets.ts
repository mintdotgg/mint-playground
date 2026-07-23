export const MEMORY_CONSTELLATION_ASSETS = {
  backdrop:
    "https://cdn.mint.gg/images/xn7cwrdt1msb6wtc5cxqdz97sd8b1836/memory-constellation-deep-sky-9cbe67-8d3aface417a52ce.png",
  denseBackdrop:
    "https://cdn.mint.gg/images/xn79pd38zsyxzcm24a4sqs4pe98atbr1/orbit-week-deep-space-d44948-2f28b6d70d5b2089.png",
  ambience:
    "https://cdn.mint.gg/audio/xd7e149p8x7k6z107msw542mp98b03fy/memory-constellation-quiet-observatory-93f6cd-1b12786666f6c056.mp3",
  stars: {
    family:
      "https://cdn.mint.gg/glb/point-light-family-core-normalized-71d18be8108641ea.glb",
    friendship:
      "https://cdn.mint.gg/glb/point-light-friendship-core-normalized-8eafc03c421770a5.glb",
    travel:
      "https://cdn.mint.gg/glb/point-light-travel-core-normalized-cfc5037e8a0757e8.glb",
    achievement:
      "https://cdn.mint.gg/glb/point-light-achievement-core-normalized-e2a8566bb6b8ff1e.glb",
    everyday:
      "https://cdn.mint.gg/glb/point-light-everyday-core-normalized-00ea42882aef259f.glb",
    growth:
      "https://cdn.mint.gg/glb/point-light-growth-core-normalized-8d249dc947a3cb15.glb",
  },
  sharpTwinkleMaterial: {
    basecolor:
      "https://cdn.mint.gg/materials/w170f22fj8xm8a8zxz3pz0wy7s8b1t87/family-basecolor-20820a-a5221360398724cd.png",
    normal:
      "https://cdn.mint.gg/materials/w170f22fj8xm8a8zxz3pz0wy7s8b1t87/family-normal-acfe3e-f36ac513c0ddae5a.png",
    roughness:
      "https://cdn.mint.gg/materials/w170f22fj8xm8a8zxz3pz0wy7s8b1t87/family-roughness-be484a-74b2f58521f844af.png",
  },
  flybys: {
    blueComet:
      "https://cdn.mint.gg/glb/blue-ice-comet-normalized-1490e4f56538d916.glb",
    goldComet:
      "https://cdn.mint.gg/glb/gold-dust-comet-normalized-8de2a2dfaf0a6634.glb",
    emberMeteor:
      "https://cdn.mint.gg/glb/ember-meteor-normalized-4c3c291ba1106af0.glb",
    coldMeteor:
      "https://cdn.mint.gg/glb/cold-stone-meteor-normalized-60d59788f6f4c1b1.glb",
  },
  filament:
    "https://cdn.mint.gg/glb/constellation-filament-normalized-33d854a755352df9.glb",
  yearBand:
    "https://cdn.mint.gg/glb/smoked-ivory-orbit-arc-normalized-ace2fa4ccb6f4aa7.glb",
} as const;

export type MemoryCategory = keyof typeof MEMORY_CONSTELLATION_ASSETS.stars;
