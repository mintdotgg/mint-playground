export const SEATLINE_MINT_ASSETS = {
  shells: {
    monument: "https://cdn.mint.gg/glb/lincoln-monument-imax-auditorium-normalized-8622b0c796ab53c0.glb",
    midtown: "https://cdn.mint.gg/glb/times-square-premium-auditorium-normalized-93b7ad2cfb0ccda4.glb",
    brooklyn: "https://cdn.mint.gg/glb/times-square-premium-auditorium-normalized-93b7ad2cfb0ccda4.glb",
  },
  screens: {
    imax: "https://cdn.mint.gg/glb/imax-screen-normalized-a6f53efcfe8b7795.glb",
    wide: "https://cdn.mint.gg/glb/wide-blank-projection-screen-normalized-a6c5c1d534825a8b.glb",
  },
  chairs: {
    cinema: "https://cdn.mint.gg/glb/oxblood-premium-recliner-normalized-cdf043ea1a1b24e4.glb",
    dineIn: "https://cdn.mint.gg/glb/oxblood-dine-in-recliner-normalized-28c4adc8e6848164.glb",
  },
  fixtures: {
    aisleBeacon: "https://cdn.mint.gg/glb/recessed-brass-aisle-beacon-normalized-ab54cabc1545d798.glb",
  },
  images: {
    mythicSea: "https://cdn.mint.gg/images/xn7bzp5qv91mqgkspjf7p9a9x18atk3c/seatline-mythic-sea-tableau-43db4f-25a14eaf3a9f27fb.png",
  },
} as const;

export type SeatlineShellKey = keyof typeof SEATLINE_MINT_ASSETS.shells;
export type SeatlineScreenKey = keyof typeof SEATLINE_MINT_ASSETS.screens;
export type SeatlineChairKey = keyof typeof SEATLINE_MINT_ASSETS.chairs;
