export type MintWorldRuntime = {
  runtimeUrl: string;
  collider: { runtimeUrl: string };
};

export type Destination = {
  id: string;
  index: number;
  name: string;
  shortName: string;
  kicker: string;
  description: string;
  coordinate: string;
  latitude: number;
  longitude: number;
  accent: string;
  accentSoft: string;
  thumbnail: string;
  editorial: {
    issue: string;
    chapter: string;
    leadLabel: string;
    leadTitle: string;
    leadCopy: string;
    story: string[];
    sideLabel: string;
    sideTitle: string;
    folio: string;
    footer: string;
    edgeLeft: string;
    edgeRight: string;
    nextIssue: string;
  };
  runtime: MintWorldRuntime;
};

export const DESTINATIONS: Destination[] = [
  {
    id: 'celestial',
    index: 2,
    name: 'Celestial Observatory Palace',
    shortName: 'The Observatory',
    kicker: 'Astral dominion',
    description: 'A midnight palace of radial galleries, gilded instruments, and impossible constellations.',
    coordinate: '28° N · 025° W',
    latitude: 28,
    longitude: -25,
    accent: '#d8b86c',
    accentSoft: '#88a8d8',
    thumbnail: 'https://cdn.mint.gg/images/xn7c44t3k1e1h8sp6wdx8fexch8afmwr/celestial-observatory-palace-atlas-thumbnail-79ac47-5cbf4118b6bbf684.png',
    editorial: {
      issue: 'ISSUE 02 · 08.2089',
      chapter: 'NIGHT ARCHITECTURE',
      leadLabel: 'OBSERVATORY DOSSIER',
      leadTitle: 'The cartographers of dark light',
      leadCopy: 'Seventeen radial galleries. One impossible sky.',
      story: [
        'At 02:14 local time, every brass dial in the palace turns toward a star that does not yet exist. The resident astronomers call this the future meridian: a thin seam where prediction becomes architecture.',
        'The observatory was raised around seventeen radial galleries, each tuned to a different century of light. Walk far enough and the corridors seem to rotate while the sky remains perfectly still.',
        'Visitors are asked to leave clocks at the western gate. Inside, time is measured by lens temperature, the pitch of the celestial engines, and the soft blue interval before a constellation appears.',
        'At dawn the instruments close like flowers. For eleven quiet minutes the palace belongs only to dust, moonlight, and the maps waiting to become true.',
      ],
      sideLabel: 'FIELD NOTES / 360°',
      sideTitle: 'How to read a constellation that has not happened yet',
      folio: 'FF–089.002',
      footer: 'Gilded machines · midnight routes · celestial interiors',
      edgeLeft: 'ARCHIVE 07 / LIGHT INDEX 118',
      edgeRight: 'NIGHT OFFICE / TRANSMISSION 02:14',
      nextIssue: 'Below the sandstone line',
    },
    runtime: {
      runtimeUrl: 'https://cdn.mint.gg/rad/celestial-observatory-palace-d4703b809c711045-lod.rad',
      collider: {
        runtimeUrl: 'https://cdn.mint.gg/worlds/celestial-observatory-palace-collider-glb-a3786dc78327ebac.glb',
      },
    },
  },
  {
    id: 'stepwell',
    index: 3,
    name: 'Palace of the Infinite Stepwell',
    shortName: 'The Stepwell',
    kicker: 'Sunken geometry',
    description: 'Carved sandstone descends through a luminous maze toward a still emerald heart.',
    coordinate: '15° S · 040° E',
    latitude: -15,
    longitude: 40,
    accent: '#d88a48',
    accentSoft: '#75c4a7',
    thumbnail: 'https://cdn.mint.gg/images/xn729nqc7ja343z22wpcxsd0es8ae5wp/palace-of-the-infinite-stepwell-atlas-thumbnail-876567-f152fd689961ec2a.png',
    editorial: {
      issue: 'ISSUE 03 · 09.2089',
      chapter: 'THE DESCENT ISSUE',
      leadLabel: 'SUNKEN PALACES',
      leadTitle: 'A geometry with no final floor',
      leadCopy: 'Sandstone, shadow and the cool emerald heart below.',
      story: [
        'The first stair begins in heat. By the sixth landing the air has cooled, the city has vanished overhead, and every direction appears to lead further beneath the desert.',
        'No surviving plan agrees on the palace depth. Surveyors return with elegant drawings that contradict their own measurements, as though the stone quietly rearranges itself between visits.',
        'Water gathers at the lowest visible court in a perfect emerald square. It reflects rooms that cannot be reached and columns that do not exist anywhere above the surface.',
        'Local keepers descend before sunrise to read the shadows. They say the stepwell is not unfinished; it is simply still deciding how deep memory needs to be.',
      ],
      sideLabel: 'WATER / MEMORY',
      sideTitle: 'Inside the last rooms where the desert keeps its silence',
      folio: 'FF–089.003',
      footer: 'Infinite stairs · subterranean light · ritual water',
      edgeLeft: 'SURVEY 40E / DESCENT LOG 006',
      edgeRight: 'WATER TABLE / UNKNOWN DEPTH',
      nextIssue: 'Night crossing without a port',
    },
    runtime: {
      runtimeUrl: 'https://cdn.mint.gg/rad/imperial-indian-stepwell-475dd4bea444bc6b-lod.rad',
      collider: {
        runtimeUrl: 'https://cdn.mint.gg/worlds/imperial-indian-stepwell-collider-glb-aa7fb588c899d238.glb',
      },
    },
  },
  {
    id: 'conservatory',
    index: 1,
    name: 'Art Nouveau Cloud Conservatory',
    shortName: 'Cloud Garden',
    kicker: 'Botanical altitude',
    description: 'A glass-and-copper winter garden drifting above a boundless gold-lit cloud sea.',
    coordinate: '50° N · 095° E',
    latitude: 50,
    longitude: 95,
    accent: '#73c7a2',
    accentSoft: '#e4c984',
    thumbnail: 'https://cdn.mint.gg/images/xn7dmvh9gjd0dr392geghn78px8aff4j/art-nouveau-cloud-conservatory-atlas-thumbnail-1696ef-2be5156e60d8b6fe.png',
    editorial: {
      issue: 'ISSUE 01 · 07.2089',
      chapter: 'BOTANICAL ALTITUDE',
      leadLabel: 'CLOUD CULTURE',
      leadTitle: 'Gardens above weather',
      leadCopy: 'Copper ribs, rare palms and a horizon made entirely of gold.',
      story: [
        'The conservatory drifts at the precise altitude where rain becomes mist. Its copper ribs flex with the pressure, turning the entire glasshouse into a slow instrument played by weather.',
        'Gardeners cultivate species collected from abandoned climates: silver palms from drowned coasts, night orchids from orbital farms, and mosses that remember the taste of mountain stone.',
        'Every afternoon the cloud deck opens beneath the eastern nave. For a few minutes roots, walkways, and suspended ponds appear to float over an uninterrupted field of gold.',
        'Nothing here is planted permanently. The garden migrates room by room, following light across the structure as the structure follows wind across the world.',
      ],
      sideLabel: 'NEW BOTANY / 2,400 M',
      sideTitle: 'The glasshouse that learned to drift',
      folio: 'FF–089.001',
      footer: 'Living structures · aerial horticulture · soft futures',
      edgeLeft: 'SPECIMEN 88 / HUMIDITY 94%',
      edgeRight: 'AERIAL WARD / LATITUDE 50N',
      nextIssue: 'Return to the dark-sky palace',
    },
    runtime: {
      runtimeUrl: 'https://cdn.mint.gg/rad/art-nouveau-sky-garden-ed9ad30f883f3d64-lod.rad',
      collider: {
        runtimeUrl: 'https://cdn.mint.gg/worlds/art-nouveau-sky-garden-collider-glb-f2540e94b5776fb9.glb',
      },
    },
  },
  {
    id: 'oceanliner',
    index: 4,
    name: 'Midnight Art Deco Ocean Liner',
    shortName: 'Midnight Liner',
    kicker: 'Longitude unknown',
    description: 'Brass promenades and lacquered ballrooms sail forever through a moon-blue night.',
    coordinate: '36° S · 112° W',
    latitude: -36,
    longitude: -112,
    accent: '#d2a45f',
    accentSoft: '#4b89c8',
    thumbnail: 'https://cdn.mint.gg/images/xn76g9f1kv821c0j1evt35ygws8af864/midnight-art-deco-ocean-liner-atlas-thumbnail-756bbe-b03cb5abdab870c0.png',
    editorial: {
      issue: 'ISSUE 04 · 10.2089',
      chapter: 'PERPETUAL VOYAGE',
      leadLabel: 'MIDNIGHT PASSAGE',
      leadTitle: 'The last liner never docks',
      leadCopy: 'Brass promenades and lacquered rooms beyond every known port.',
      story: [
        'The Far Horizon departed Marseille in 2071 with twelve hundred guests and no published arrival. Eighteen years later its ballroom remains open, its lamps remain warm, and the coastline has never returned.',
        'Every deck follows a different hour. Breakfast moves through the winter garden at midnight; the observation salon holds a permanent blue dusk; cabin clocks are decorative and politely ignored.',
        'The ship receives supplies from silent tenders beyond the fog. No passenger has seen a crew transfer, yet fresh flowers appear each evening and the orchestra never repeats a song.',
        'Some believe the liner is crossing an ocean. Others insist the ocean is moving around it. Either way, the wake points toward a port that has not been built.',
      ],
      sideLabel: 'CABIN 112 / OPEN SEA',
      sideTitle: 'A grand tour through the architecture of forever',
      folio: 'FF–089.004',
      footer: 'Moon routes · ocean interiors · after-hours modernism',
      edgeLeft: 'PASSENGER LOG / NIGHT 6,402',
      edgeRight: 'DECK 09 / LONGITUDE WITHHELD',
      nextIssue: 'The furnaces beneath the world',
    },
    runtime: {
      runtimeUrl: 'https://cdn.mint.gg/rad/midnight-art-deco-liner-0df4117f06b7f16c-lod.rad',
      collider: {
        runtimeUrl: 'https://cdn.mint.gg/worlds/midnight-art-deco-liner-collider-glb-1dded86947840c36.glb',
      },
    },
  },
  {
    id: 'forge',
    index: 5,
    name: 'Volcanic Cathedral Forge',
    shortName: 'The Forge',
    kicker: 'Mantle sanctuary',
    description: 'An ancient basalt nave where monumental engines draw light from the planet’s core.',
    coordinate: '08° N · 165° E',
    latitude: 8,
    longitude: 165,
    accent: '#e26237',
    accentSoft: '#8f6ad8',
    thumbnail: 'https://cdn.mint.gg/images/xn7b8bnpk3hc8v7ytsgk5v31c58af2dd/volcanic-cathedral-forge-atlas-thumbnail-b1a12d-96fdb0a3ec2de1cd.png',
    editorial: {
      issue: 'ISSUE 05 · 11.2089',
      chapter: 'MANTLE ARCHITECTURE',
      leadLabel: 'THE HEAT BELOW',
      leadTitle: 'Cathedrals under the crust',
      leadCopy: 'Basalt engines, sacred industry and light drawn from a planet.',
      story: [
        'Eight kilometres below the mantle sanctuary, heat is treated as both material and memory. The forge keepers shape it through basalt chambers older than the language carved into their doors.',
        'Each engine is tuned to a geological frequency. When the great bellows open, the nave answers in red light and the floor vibrates with the slow pulse of the planet.',
        'Tools are never carried out. Finished objects cool in black-water chapels, receive a number rather than a name, and disappear upward before the next shift begins.',
        'The keepers speak rarely about the surface. Their calendar follows eruptions, pressure tides, and the centuries between one perfect alloy and the next.',
      ],
      sideLabel: 'DEPTH / 08 KM',
      sideTitle: 'Meet the keepers of the eternal furnace',
      folio: 'FF–089.005',
      footer: 'Volcanic craft · monumental machines · core rituals',
      edgeLeft: 'CORE WARD / PRESSURE 410 MPA',
      edgeRight: 'SHIFT 31 / BASALT INDEX 09',
      nextIssue: 'Botany above the cloud belt',
    },
    runtime: {
      runtimeUrl: 'https://cdn.mint.gg/rad/volcanic-forge-cathedral-b355da009a574457-lod.rad',
      collider: {
        runtimeUrl: 'https://cdn.mint.gg/worlds/volcanic-forge-cathedral-collider-glb-3000e570241813eb.glb',
      },
    },
  },
].sort((left, right) => left.index - right.index);

export function destinationById(id: string): Destination {
  const destination = DESTINATIONS.find((candidate) => candidate.id === id);
  if (!destination) throw new Error(`Unknown destination: ${id}`);
  return destination;
}
