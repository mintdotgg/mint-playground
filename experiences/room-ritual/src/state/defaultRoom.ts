import type { RoomDocument } from '../types'

export const ROOM_WIDTH = 7.2
export const ROOM_DEPTH = 5.4
export const ROOM_HEIGHT = 3.2

export const defaultRoom: RoomDocument = {
  schemaVersion: 1,
  wallColor: 'bone',
  floorFinish: 'travertine',
  rugId: 'ultramarine-grid',
  lighting: 'day',
  items: [
    { id: 'placed-morrow', productId: 'morrow-sofa', position: [-1.6, 0, -1.68], rotation: 0, planningScale: 1, finishId: 'morrow-flax' },
    { id: 'placed-fold', productId: 'fold-lounge', position: [-2.65, 0, -0.1], rotation: 0.42, planningScale: 1, finishId: 'fold-cognac' },
    { id: 'placed-cairn', productId: 'cairn-table', position: [-1.25, 0, -0.25], rotation: -0.08, planningScale: 1, finishId: 'cairn-travertine' },
    { id: 'placed-span', productId: 'span-table', position: [1.72, 0, 1.1], rotation: 0, planningScale: 1, finishId: 'span-ash' },
    { id: 'placed-pilaster', productId: 'pilaster-credenza', position: [2.45, 0, -2.35], rotation: 0, planningScale: 1, finishId: 'pilaster-clay' },
    { id: 'placed-loop', productId: 'loop-daybed', position: [-1.78, 0, 1.83], rotation: 0, planningScale: 1, finishId: 'loop-flax' },
  ],
  decor: [
    { id: 'decor-lamp', decorId: 'arc-floor-lamp', position: [-3.02, 0, -1.9], rotation: 0, scale: 1 },
    { id: 'decor-plant', decorId: 'rubber-plant', position: [3.05, 0, -2.06], rotation: 0, scale: 1 },
    { id: 'decor-art', decorId: 'blue-relief', position: [0.85, 1.35, -2.66], rotation: 0, scale: 1 },
  ],
}

export const cloneRoom = (room: RoomDocument): RoomDocument => structuredClone(room)
