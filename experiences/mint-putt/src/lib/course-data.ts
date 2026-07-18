export type Vec2 = readonly [number, number];

export type HoleDefinition = {
  number: number;
  location: string;
  displayLocation: string;
  name: string;
  description: string;
  teeNorm: Vec2;
  cupNorm: Vec2;
  par: 2 | 3;
  feet: number;
  recommendedClub: string;
  accent: string;
  sky: string;
  hazard: "water" | "sand" | "rough" | "cliff" | "none";
};

export const COURSE_SLUG = "genesis-grove-california";
export const COURSE_NAME = "Mint Putt-Putt at Genesis Grove";
export const GENERATION_PREFIX = "GG26";

export const STYLE_GUIDE = {
  name: "MintLinksStyleGuide — Genesis Grove 2026",
  origin: "fictional-new-system" as const,
  officialBrandingUsed: false,
  palette: {
    mint: "#85F7BE",
    mintDeep: "#42C98C",
    charcoal: "#101713",
    ink: "#07100C",
    warmWhite: "#F3F1E8",
  },
  worldPrompt:
    "Premium stylized putt-putt world with one continuous main putting green, clean geometric landforms, tactile natural materials, luminous mint-green wayfinding accents, restrained holographic detail, readable mobile-game silhouettes, cinematic California atmosphere, and a clearly open playable center. Fictional environment; no logos, trademarks, park insignia, course branding, text, baked flag, baked cup, ball, golfer, or tee markers.",
  assetPrompt:
    "Premium stylized web-game prop, clean geometric construction, charcoal and warm-white body with a restrained mint-green accent, realistic scale, isolated object, neutral studio lighting, clean origin, no logo, no lettering, no ground plane, no extra objects.",
  materialPrompt:
    "Cohesive premium stylized PBR surface for a California putt-putt world, tactile but restrained, readable at mobile scale, physically plausible roughness, seamless tile, no text or logos.",
};

export const CLUBS = [
  "Driver",
  "3-Wood",
  "5-Wood",
  "Hybrid",
  "4-Iron",
  "5-Iron",
  "6-Iron",
  "7-Iron",
  "8-Iron",
  "9-Iron",
  "Pitching Wedge",
  "Gap Wedge",
  "Sand Wedge",
  "Lob Wedge",
  "Putter",
] as const;

export const CRITICAL_MODELS = [
  "Ball",
  "Tee Marker Left",
  "Tee Marker Right",
  "Cup Rim",
  "Cup Insert",
  "Pin",
  "Flag Pole",
] as const;

export const MATERIALS = [
  "Fairway Grass",
  "Putting Green",
  "Rough Grass",
  "Warm Sand",
  "Pacific Water",
  "Gameplay Soil",
] as const;

export const HOLES: HoleDefinition[] = [
  { number: 1, location: "Yosemite Valley", displayLocation: "Yosemite Valley, CA", name: "Half Dome Opening", description: "Granite walls, waterfall mist, pine meadow, bright Sierra morning.", teeNorm: [0.42, 0.66], cupNorm: [0.58, 0.34], par: 2, feet: 36, recommendedClub: "Putter", accent: "#A8D6C1", sky: "#B8E4ED", hazard: "water" },
  { number: 2, location: "Giant Sequoia Grove", displayLocation: "Sequoia National Park, CA", name: "Giants’ Passage", description: "Monumental sequoias, fern floor, shafts of warm forest light.", teeNorm: [0.58, 0.66], cupNorm: [0.42, 0.34], par: 2, feet: 34, recommendedClub: "Putter", accent: "#8FB58C", sky: "#E9C98B", hazard: "rough" },
  { number: 3, location: "Big Sur Coast", displayLocation: "Big Sur, CA", name: "Pacific Edge", description: "Rugged Pacific cliffs, coastal scrub, sea mist, dramatic open ocean.", teeNorm: [0.50, 0.68], cupNorm: [0.50, 0.32], par: 2, feet: 32, recommendedClub: "Putter", accent: "#77C7B7", sky: "#8CB7C8", hazard: "cliff" },
  { number: 4, location: "Carmel Cypress Coast", displayLocation: "Carmel, CA", name: "Cypress Bend", description: "Windswept Monterey cypress, rocky shoreline, refined coastal-golf atmosphere.", teeNorm: [0.41, 0.65], cupNorm: [0.59, 0.35], par: 2, feet: 38, recommendedClub: "Putter", accent: "#A8BC9C", sky: "#C8D7D2", hazard: "cliff" },
  { number: 5, location: "San Francisco Presidio", displayLocation: "San Francisco, CA", name: "Fog Gate", description: "Fog, coastal cypress, distant bridge-inspired silhouette, historic parkland.", teeNorm: [0.59, 0.65], cupNorm: [0.41, 0.35], par: 2, feet: 35, recommendedClub: "Putter", accent: "#AABEB3", sky: "#DCE1DB", hazard: "rough" },
  { number: 6, location: "Del Mar Coastal Bluffs", displayLocation: "Del Mar, CA", name: "Del Mar Drop", description: "Sandstone cliffs, Pacific surf, coastal sage, warm Southern California light.", teeNorm: [0.46, 0.67], cupNorm: [0.54, 0.33], par: 2, feet: 30, recommendedClub: "Putter", accent: "#D9B884", sky: "#AED8E0", hazard: "cliff" },
  { number: 7, location: "Lake Tahoe", displayLocation: "Lake Tahoe, CA", name: "Tahoe Blue", description: "Clear alpine water, granite shoreline, pine forest, distant snowy peaks.", teeNorm: [0.54, 0.67], cupNorm: [0.46, 0.33], par: 3, feet: 42, recommendedClub: "Putter", accent: "#79C8DA", sky: "#A9D7F1", hazard: "water" },
  { number: 8, location: "Joshua Tree", displayLocation: "Joshua Tree, CA", name: "Desert Geometry", description: "Sculpted boulders, Joshua trees, open high desert, amber sunset.", teeNorm: [0.40, 0.64], cupNorm: [0.60, 0.36], par: 3, feet: 40, recommendedClub: "Putter", accent: "#DBB06B", sky: "#EFA37A", hazard: "sand" },
  { number: 9, location: "Napa Valley", displayLocation: "Napa Valley, CA", name: "Vineyard Handoff", description: "Vineyards, rolling oak hills, elegant estate architecture, golden-hour light.", teeNorm: [0.60, 0.64], cupNorm: [0.40, 0.36], par: 2, feet: 36, recommendedClub: "Putter", accent: "#9EAF6E", sky: "#E9BF79", hazard: "rough" },
  { number: 10, location: "Malibu and Santa Monica Mountains", displayLocation: "Malibu, CA", name: "Malibu Traverse", description: "Ocean canyon, chaparral, ridgelines, broad Pacific outlook.", teeNorm: [0.44, 0.66], cupNorm: [0.56, 0.34], par: 3, feet: 44, recommendedClub: "Putter", accent: "#91BEA5", sky: "#B6D7D7", hazard: "cliff" },
  { number: 11, location: "Redwood Coast", displayLocation: "Redwood Coast, CA", name: "Redwood Corridor", description: "Towering coastal redwoods, mist, moss, ferns, filtered morning light.", teeNorm: [0.56, 0.66], cupNorm: [0.44, 0.34], par: 2, feet: 34, recommendedClub: "Putter", accent: "#6DA37D", sky: "#BAC8BD", hazard: "rough" },
  { number: 12, location: "Death Valley", displayLocation: "Death Valley, CA", name: "Salt and Shadow", description: "Dunes, salt-flat textures, multicolored mountains, stark desert atmosphere.", teeNorm: [0.48, 0.68], cupNorm: [0.52, 0.32], par: 3, feet: 39, recommendedClub: "Putter", accent: "#D7A36C", sky: "#E7C1A4", hazard: "sand" },
  { number: 13, location: "Palm Springs Oasis", displayLocation: "Palm Springs, CA", name: "Oasis Preview", description: "Desert palms, mountain wall, clean mid-century-inspired scenery, bright sky.", teeNorm: [0.52, 0.68], cupNorm: [0.48, 0.32], par: 2, feet: 31, recommendedClub: "Putter", accent: "#75C7A3", sky: "#8DD5E6", hazard: "water" },
  { number: 14, location: "Santa Barbara Riviera", displayLocation: "Santa Barbara, CA", name: "Riviera Material", description: "Coastal hills, red-tile-inspired architecture, gardens, distant island view.", teeNorm: [0.43, 0.65], cupNorm: [0.57, 0.35], par: 2, feet: 38, recommendedClub: "Putter", accent: "#C69270", sky: "#BCDCE2", hazard: "sand" },
  { number: 15, location: "Mendocino Headlands", displayLocation: "Mendocino, CA", name: "Headlands Splat", description: "Sea stacks, fog, wildflowers, dark coastal rock, windswept grass.", teeNorm: [0.57, 0.65], cupNorm: [0.43, 0.35], par: 2, feet: 35, recommendedClub: "Putter", accent: "#7A9F8C", sky: "#A8BCC2", hazard: "cliff" },
  { number: 16, location: "Laguna Beach Coves", displayLocation: "Laguna Beach, CA", name: "Cove Approval", description: "Turquoise coves, tide pools, sculpted cliffs, warm coastal vegetation.", teeNorm: [0.45, 0.67], cupNorm: [0.55, 0.33], par: 2, feet: 32, recommendedClub: "Putter", accent: "#57C4BC", sky: "#A9DBE3", hazard: "water" },
  { number: 17, location: "Mount Shasta", displayLocation: "Mount Shasta, CA", name: "Shasta World", description: "Snow-covered volcanic peak, alpine meadow, conifers, cold clear light.", teeNorm: [0.55, 0.67], cupNorm: [0.45, 0.33], par: 3, feet: 43, recommendedClub: "Putter", accent: "#9DBFC4", sky: "#B9DDF0", hazard: "rough" },
  { number: 18, location: "Catalina Island", displayLocation: "Catalina Island, CA", name: "California Final", description: "Island ridges, harbor-inspired scenery, Pacific sunset, grand finishing atmosphere.", teeNorm: [0.40, 0.66], cupNorm: [0.60, 0.34], par: 3, feet: 45, recommendedClub: "Putter", accent: "#E0A06F", sky: "#D88E90", hazard: "water" },
];

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function worldPrompt(hole: HoleDefinition) {
  return `${GENERATION_PREFIX} — ${hole.location}: ${hole.name}. ${STYLE_GUIDE.worldPrompt} Landscape direction: ${hole.description} Compose a top-down-friendly putt-putt hole inside the central 60% PlayBox. Build one continuous main putting green from the tee near normalized [${hole.teeNorm.join(", ")}] to the cup near [${hole.cupNorm.join(", ")}]. The tee box, complete roll corridor, and cup must all sit on that same unobstructed green. The outer 20–25% is scenery only. No baked gameplay objects. This is a fictional California-inspired landscape, not an exact replica or licensed property.`;
}
