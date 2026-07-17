export type CardSide = 'front' | 'back';

export type TreatmentKind =
  | 'prismatic'
  | 'metallic'
  | 'archival'
  | 'refractive'
  | 'frosted'
  | 'microline';

export interface CardStat {
  label: string;
  value: string;
}

export interface CardLighting {
  key: string;
  rim: string;
  fill: string;
  exposure: number;
  keyIntensity: number;
}

export interface CardCamera {
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
}

export interface CardProfile {
  id: string;
  index: string;
  player: string;
  monogram: string;
  sport: string;
  archetype: string;
  era: string;
  title: string;
  accent: string;
  accentSecondary: string;
  ink: string;
  background: string;
  artworkPath: string;
  treatment: TreatmentKind;
  treatmentLabel: string;
  rarity: string;
  edition: string;
  grade: string;
  gradeLabel: string;
  material: string;
  provenance: string;
  collectorNotes: string;
  stats: CardStat[];
  lighting: CardLighting;
  camera: CardCamera;
  atmosphere: string;
}

export interface AppState {
  selectedIndex: number;
  side: CardSide;
  inspection: boolean;
  notesOpen: boolean;
  muted: boolean;
  transitioning: boolean;
}
