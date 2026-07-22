export type Vec3Tuple = [number, number, number]

export type LightingPreset = 'day' | 'evening' | 'gallery' | 'warm-home'
export type WallColor = 'bone' | 'clay' | 'chalk' | 'ultramarine'
export type FloorFinish = 'travertine' | 'smoked-oak' | 'pale-ash'

export interface FinishOption {
  id: string
  name: string
  description: string
  primary: string
  secondary: string
  accent: string
  materialNames: string[]
  priceDelta?: number
}

export interface ConstructionDetail {
  title: string
  description: string
}

export interface DesignerProfile {
  name: string
  location: string
  profile: string
}

export interface Product {
  id: string
  name: string
  category: string
  tagline: string
  story: string
  designer: DesignerProfile
  dimensions: { width: number; depth: number; height: number }
  weightKg: number
  price: number
  leadTimeWeeks: [number, number]
  finishes: FinishOption[]
  construction: ConstructionDetail[]
  care: string[]
  campaignImage?: string
}

export interface DecorProduct {
  id: string
  name: string
  category: 'rug' | 'lighting' | 'plant' | 'art' | 'shelf' | 'object'
  price: number
  leadTimeWeeks: [number, number]
  color: string
  dimensions: { width: number; depth: number; height: number }
}

export interface PlacedItem {
  id: string
  productId: string
  position: Vec3Tuple
  rotation: number
  planningScale: number
  finishId: string
}

export interface PlacedDecor {
  id: string
  decorId: string
  position: Vec3Tuple
  rotation: number
  scale: number
}

export interface RoomDocument {
  schemaVersion: 1
  wallColor: WallColor
  floorFinish: FloorFinish
  rugId: 'ultramarine-grid' | 'travertine-tone' | 'none'
  lighting: LightingPreset
  items: PlacedItem[]
  decor: PlacedDecor[]
}

export interface SavedConfiguration {
  id: string
  name: string
  createdAt: string
  room: RoomDocument
  thumbnail?: string
}

export type MoodEntryType = 'product' | 'finish' | 'image'

export interface MoodEntry {
  id: string
  type: MoodEntryType
  productId: string
  finishId?: string
  addedAt: string
}

export interface CartLine {
  id: string
  kind: 'product' | 'decor'
  catalogId: string
  finishId?: string
  quantity: number
}
