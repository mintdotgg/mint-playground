import type { PlacedItem, Product } from '../types'

export interface Footprint {
  cx: number
  cz: number
  halfWidth: number
  halfDepth: number
  rotation: number
}

export const footprintFor = (item: PlacedItem, product: Product): Footprint => ({
  cx: item.position[0],
  cz: item.position[2],
  halfWidth: product.dimensions.width * item.planningScale * 0.5,
  halfDepth: product.dimensions.depth * item.planningScale * 0.5,
  rotation: item.rotation,
})

const axesFor = (footprint: Footprint) => {
  const c = Math.cos(footprint.rotation)
  const s = Math.sin(footprint.rotation)
  return [
    { x: c, z: s },
    { x: -s, z: c },
  ]
}

const projectionRadius = (footprint: Footprint, axis: { x: number; z: number }) => {
  const [right, forward] = axesFor(footprint)
  return Math.abs(axis.x * right.x + axis.z * right.z) * footprint.halfWidth
    + Math.abs(axis.x * forward.x + axis.z * forward.z) * footprint.halfDepth
}

export const footprintsOverlap = (a: Footprint, b: Footprint, clearance = 0) => {
  const axes = [...axesFor(a), ...axesFor(b)]
  const delta = { x: b.cx - a.cx, z: b.cz - a.cz }
  return axes.every((axis) => {
    const distance = Math.abs(delta.x * axis.x + delta.z * axis.z)
    return distance < projectionRadius(a, axis) + projectionRadius(b, axis) + clearance
  })
}

export const clampFootprintToRoom = (
  x: number,
  z: number,
  product: Product,
  scale: number,
  rotation: number,
  roomWidth: number,
  roomDepth: number,
) => {
  const halfWidth = product.dimensions.width * scale * 0.5
  const halfDepth = product.dimensions.depth * scale * 0.5
  const c = Math.abs(Math.cos(rotation))
  const s = Math.abs(Math.sin(rotation))
  const extentX = c * halfWidth + s * halfDepth
  const extentZ = s * halfWidth + c * halfDepth
  return {
    x: Math.max(-roomWidth / 2 + extentX, Math.min(roomWidth / 2 - extentX, x)),
    z: Math.max(-roomDepth / 2 + extentZ, Math.min(roomDepth / 2 - extentZ, z)),
  }
}

export const snapValue = (value: number, step = 0.05) => Math.round(value / step) * step
