import type * as THREE from 'three'
import type { AudioEngine } from '../audio/engine'
import type { DiscStyle } from '../kit/disc'
import type { AnchorSet } from '../kit/models'

export interface SkinPalette {
  bgTop: number
  bgBot: number
  ink: number
  panel: number
  accent: number
  selector: number
  selectorInk: number
  light: boolean
}

export interface SkinCtx {
  engine: AudioEngine
  anchors: AnchorSet
  holoTex: THREE.Texture | null
  addInteractive: (mesh: THREE.Object3D) => void
}

export interface SkinInstance {
  group: THREE.Group
  update: (dt: number, t: number) => void
  dispose: () => void
}

export interface SkinDef {
  id: string
  name: string
  vibe: string
  palette: SkinPalette
  bloom: { strength: number; threshold: number }
  disc: {
    pos: [number, number, number]
    scale: number
    style: DiscStyle
  }
  build: (ctx: SkinCtx) => SkinInstance
}
