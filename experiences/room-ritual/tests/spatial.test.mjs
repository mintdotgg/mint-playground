import assert from 'node:assert/strict'
import test from 'node:test'
import { clampFootprintToRoom, footprintFor, footprintsOverlap, snapValue } from '../src/scene/spatial.ts'

const product = {
  dimensions: { width: 2, depth: 1, height: 0.8 },
}

test('placement snaps to the five-centimeter planning grid', () => {
  assert.equal(snapValue(1.234), 1.25)
  assert.equal(snapValue(-0.026), -0.05)
})

test('rotated footprints detect overlap and spacing clearance', () => {
  const a = footprintFor({ position: [0, 0, 0], rotation: Math.PI / 4, planningScale: 1 }, product)
  const b = footprintFor({ position: [1.1, 0, 0], rotation: -Math.PI / 4, planningScale: 1 }, product)
  const distant = footprintFor({ position: [4, 0, 0], rotation: 0, planningScale: 1 }, product)
  assert.equal(footprintsOverlap(a, b), true)
  assert.equal(footprintsOverlap(a, distant, 0.5), false)
})

test('placement clamps the full rotated footprint inside the room', () => {
  const result = clampFootprintToRoom(10, -10, product, 1, Math.PI / 2, 7.2, 5.4)
  assert.equal(result.x, 3.1)
  assert.ok(Math.abs(result.z + 1.7) < Number.EPSILON * 2)
})
