import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { decorById, productById } from '../data/catalog'
import type {
  CartLine,
  FloorFinish,
  LightingPreset,
  MoodEntry,
  MoodEntryType,
  RoomDocument,
  SavedConfiguration,
  WallColor,
} from '../types'
import { clampFootprintToRoom, footprintFor, footprintsOverlap } from '../scene/spatial'
import { cloneRoom, defaultRoom, ROOM_DEPTH, ROOM_WIDTH } from './defaultRoom'

export type DrawerName = 'mood' | 'saves' | 'compare' | 'cart' | 'checkout' | 'room' | null

interface AddMoodInput {
  type: MoodEntryType
  productId: string
  finishId?: string
}

interface AppState {
  room: RoomDocument
  past: RoomDocument[]
  future: RoomDocument[]
  interactionBase: RoomDocument | null
  selectedItemId: string | null
  selectedProductId: string
  hoveredItemId: string | null
  collisionIds: string[]
  measurementsVisible: boolean
  inspectMode: boolean
  drawer: DrawerName
  savedConfigurations: SavedConfiguration[]
  compareIds: [string | null, string | null]
  mood: MoodEntry[]
  cart: CartLine[]
  audioEnabled: boolean
  ambienceEnabled: boolean
  cameraResetKey: number
  selectItem: (id: string | null) => void
  selectProduct: (id: string) => void
  setHoveredItem: (id: string | null) => void
  setCollisionIds: (ids: string[]) => void
  addProduct: (productId: string, position?: [number, number, number]) => string | null
  duplicateSelected: () => void
  removeSelected: () => void
  beginInteraction: () => void
  previewItemTransform: (id: string, patch: Partial<{ x: number; z: number; rotation: number; scale: number }>) => void
  commitInteraction: () => void
  cancelInteraction: () => void
  nudgeSelected: (dx: number, dz: number) => void
  rotateSelected: (radians: number) => void
  setSelectedScale: (scale: number) => void
  setSelectedFinish: (finishId: string) => void
  setLighting: (lighting: LightingPreset) => void
  setWallColor: (color: WallColor) => void
  setFloorFinish: (finish: FloorFinish) => void
  setRug: (rugId: RoomDocument['rugId']) => void
  toggleDecor: (decorId: string) => void
  toggleMeasurements: () => void
  setInspectMode: (enabled: boolean) => void
  resetRoom: () => void
  requestCameraReset: () => void
  undo: () => void
  redo: () => void
  openDrawer: (drawer: DrawerName) => void
  saveConfiguration: (name: string, thumbnail?: string) => void
  loadConfiguration: (id: string) => void
  deleteConfiguration: (id: string) => void
  setCompareId: (slot: 0 | 1, id: string | null) => void
  toggleMood: (entry: AddMoodInput) => void
  addCartProduct: (productId: string, finishId?: string) => void
  addCartDecor: (decorId: string) => void
  updateCartQuantity: (id: string, quantity: number) => void
  setCartFinish: (id: string, finishId: string) => void
  removeCartLine: (id: string) => void
  clearCart: () => void
  setAudioEnabled: (enabled: boolean) => void
  setAmbienceEnabled: (enabled: boolean) => void
}

const makeId = (prefix: string) => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`

const documentsEqual = (a: RoomDocument, b: RoomDocument) => JSON.stringify(a) === JSON.stringify(b)

const collisionIdsFor = (room: RoomDocument, selectedId: string) => {
  const selected = room.items.find((item) => item.id === selectedId)
  const selectedProduct = selected ? productById(selected.productId) : undefined
  if (!selected || !selectedProduct) return []
  const selectedFootprint = footprintFor(selected, selectedProduct)
  return room.items.filter((item) => {
    if (item.id === selectedId) return false
    const product = productById(item.productId)
    return product ? footprintsOverlap(selectedFootprint, footprintFor(item, product), 0.03) : false
  }).map((item) => item.id)
}

const commitDocument = (state: AppState, room: RoomDocument): Partial<AppState> => ({
  room,
  past: [...state.past.slice(-39), cloneRoom(state.room)],
  future: [],
  interactionBase: null,
})

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      room: cloneRoom(defaultRoom),
      past: [],
      future: [],
      interactionBase: null,
      selectedItemId: 'placed-morrow',
      selectedProductId: 'morrow-sofa',
      hoveredItemId: null,
      collisionIds: [],
      measurementsVisible: true,
      inspectMode: false,
      drawer: null,
      savedConfigurations: [],
      compareIds: [null, null],
      mood: [],
      cart: [],
      audioEnabled: true,
      ambienceEnabled: false,
      cameraResetKey: 0,

      selectItem: (id) => set((state) => {
        const productId = id ? state.room.items.find((item) => item.id === id)?.productId : undefined
        return {
          selectedItemId: id,
          selectedProductId: productId ?? state.selectedProductId,
          inspectMode: id ? state.inspectMode : false,
        }
      }),
      selectProduct: (id) => set((state) => ({
        selectedProductId: id,
        selectedItemId: state.room.items.find((item) => item.productId === id)?.id ?? null,
        inspectMode: false,
      })),
      setHoveredItem: (id) => set({ hoveredItemId: id }),
      setCollisionIds: (ids) => set({ collisionIds: ids }),

      addProduct: (productId, position = [0, 0, 0]) => {
        const product = productById(productId)
        if (!product) return null
        const id = makeId('placed')
        set((state) => {
          const next = cloneRoom(state.room)
          next.items.push({
            id,
            productId,
            position,
            rotation: 0,
            planningScale: 1,
            finishId: product.finishes[0].id,
          })
          return {
            ...commitDocument(state, next),
            selectedItemId: id,
            selectedProductId: productId,
          }
        })
        return id
      },
      duplicateSelected: () => set((state) => {
        const source = state.room.items.find((item) => item.id === state.selectedItemId)
        if (!source) return state
        const next = cloneRoom(state.room)
        const copy = {
          ...structuredClone(source),
          id: makeId('placed'),
          position: [source.position[0] + 0.25, 0, source.position[2] + 0.25] as [number, number, number],
        }
        next.items.push(copy)
        return { ...commitDocument(state, next), selectedItemId: copy.id }
      }),
      removeSelected: () => set((state) => {
        if (!state.selectedItemId) return state
        const next = cloneRoom(state.room)
        next.items = next.items.filter((item) => item.id !== state.selectedItemId)
        return { ...commitDocument(state, next), selectedItemId: null, inspectMode: false, collisionIds: [] }
      }),

      beginInteraction: () => set((state) => state.interactionBase ? state : { interactionBase: cloneRoom(state.room) }),
      previewItemTransform: (id, patch) => set((state) => {
        const next = cloneRoom(state.room)
        const item = next.items.find((candidate) => candidate.id === id)
        const product = item ? productById(item.productId) : undefined
        if (!item || !product) return state
        const rotation = patch.rotation ?? item.rotation
        const scale = Math.max(0.85, Math.min(1.15, patch.scale ?? item.planningScale))
        const desiredX = patch.x ?? item.position[0]
        const desiredZ = patch.z ?? item.position[2]
        const clamped = clampFootprintToRoom(desiredX, desiredZ, product, scale, rotation, ROOM_WIDTH, ROOM_DEPTH)
        item.position = [clamped.x, 0, clamped.z]
        item.rotation = rotation
        item.planningScale = scale
        return {
          room: next,
          collisionIds: state.selectedItemId === id ? collisionIdsFor(next, id) : state.collisionIds,
        }
      }),
      commitInteraction: () => set((state) => {
        if (!state.interactionBase) return state
        if (documentsEqual(state.interactionBase, state.room)) return { interactionBase: null }
        return {
          past: [...state.past.slice(-39), state.interactionBase],
          future: [],
          interactionBase: null,
        }
      }),
      cancelInteraction: () => set((state) => state.interactionBase ? { room: state.interactionBase, interactionBase: null, collisionIds: [] } : state),
      nudgeSelected: (dx, dz) => {
        const state = get()
        if (!state.selectedItemId) return
        const item = state.room.items.find((candidate) => candidate.id === state.selectedItemId)
        if (!item) return
        state.beginInteraction()
        get().previewItemTransform(item.id, { x: item.position[0] + dx, z: item.position[2] + dz })
        get().commitInteraction()
      },
      rotateSelected: (radians) => {
        const state = get()
        if (!state.selectedItemId) return
        const item = state.room.items.find((candidate) => candidate.id === state.selectedItemId)
        if (!item) return
        state.beginInteraction()
        get().previewItemTransform(item.id, { rotation: item.rotation + radians })
        get().commitInteraction()
      },
      setSelectedScale: (scale) => {
        const state = get()
        if (!state.selectedItemId) return
        state.beginInteraction()
        get().previewItemTransform(state.selectedItemId, { scale })
        get().commitInteraction()
      },
      setSelectedFinish: (finishId) => set((state) => {
        const next = cloneRoom(state.room)
        const item = next.items.find((candidate) => candidate.id === state.selectedItemId)
        if (!item || item.finishId === finishId) return state
        item.finishId = finishId
        return commitDocument(state, next)
      }),

      setLighting: (lighting) => set((state) => {
        if (state.room.lighting === lighting) return state
        const next = cloneRoom(state.room)
        next.lighting = lighting
        return commitDocument(state, next)
      }),
      setWallColor: (wallColor) => set((state) => {
        if (state.room.wallColor === wallColor) return state
        const next = cloneRoom(state.room)
        next.wallColor = wallColor
        return commitDocument(state, next)
      }),
      setFloorFinish: (floorFinish) => set((state) => {
        if (state.room.floorFinish === floorFinish) return state
        const next = cloneRoom(state.room)
        next.floorFinish = floorFinish
        return commitDocument(state, next)
      }),
      setRug: (rugId) => set((state) => {
        if (state.room.rugId === rugId) return state
        const next = cloneRoom(state.room)
        next.rugId = rugId
        return commitDocument(state, next)
      }),
      toggleDecor: (decorId) => set((state) => {
        const decorProduct = decorById(decorId)
        if (!decorProduct || decorProduct.category === 'rug') return state
        const next = cloneRoom(state.room)
        const existing = next.decor.find((item) => item.decorId === decorId)
        if (existing) next.decor = next.decor.filter((item) => item.id !== existing.id)
        else next.decor.push({ id: makeId('decor'), decorId, position: [2.7, 0, 1.9], rotation: 0, scale: 1 })
        return commitDocument(state, next)
      }),
      toggleMeasurements: () => set((state) => ({ measurementsVisible: !state.measurementsVisible })),
      setInspectMode: (inspectMode) => set((state) => ({ inspectMode: state.selectedItemId ? inspectMode : false })),
      resetRoom: () => set((state) => ({
        ...commitDocument(state, cloneRoom(defaultRoom)),
        selectedItemId: 'placed-morrow',
        selectedProductId: 'morrow-sofa',
        inspectMode: false,
        collisionIds: [],
        cameraResetKey: state.cameraResetKey + 1,
      })),
      requestCameraReset: () => set((state) => ({ cameraResetKey: state.cameraResetKey + 1, inspectMode: false })),
      undo: () => set((state) => {
        const previous = state.past.at(-1)
        if (!previous) return state
        return {
          room: cloneRoom(previous),
          past: state.past.slice(0, -1),
          future: [cloneRoom(state.room), ...state.future.slice(0, 39)],
          interactionBase: null,
          collisionIds: [],
        }
      }),
      redo: () => set((state) => {
        const next = state.future[0]
        if (!next) return state
        return {
          room: cloneRoom(next),
          past: [...state.past.slice(-39), cloneRoom(state.room)],
          future: state.future.slice(1),
          interactionBase: null,
          collisionIds: [],
        }
      }),

      openDrawer: (drawer) => set((state) => ({ drawer: state.drawer === drawer ? null : drawer })),
      saveConfiguration: (name, thumbnail) => set((state) => ({
        savedConfigurations: [{
          id: makeId('room'),
          name: name.trim() || `Room ${state.savedConfigurations.length + 1}`,
          createdAt: new Date().toISOString(),
          room: cloneRoom(state.room),
          thumbnail,
        }, ...state.savedConfigurations].slice(0, 12),
      })),
      loadConfiguration: (id) => set((state) => {
        const saved = state.savedConfigurations.find((config) => config.id === id)
        if (!saved) return state
        return {
          ...commitDocument(state, cloneRoom(saved.room)),
          drawer: null,
          selectedItemId: saved.room.items[0]?.id ?? null,
          selectedProductId: saved.room.items[0]?.productId ?? state.selectedProductId,
          cameraResetKey: state.cameraResetKey + 1,
        }
      }),
      deleteConfiguration: (id) => set((state) => ({
        savedConfigurations: state.savedConfigurations.filter((config) => config.id !== id),
        compareIds: state.compareIds.map((candidate) => candidate === id ? null : candidate) as [string | null, string | null],
      })),
      setCompareId: (slot, id) => set((state) => {
        const compareIds = [...state.compareIds] as [string | null, string | null]
        compareIds[slot] = id
        return { compareIds }
      }),

      toggleMood: (entry) => set((state) => {
        const key = `${entry.type}:${entry.productId}:${entry.finishId ?? ''}`
        const existing = state.mood.find((item) => item.id === key)
        return existing
          ? { mood: state.mood.filter((item) => item.id !== key) }
          : { mood: [{ ...entry, id: key, addedAt: new Date().toISOString() }, ...state.mood] }
      }),
      addCartProduct: (productId, finishId) => set((state) => {
        const product = productById(productId)
        if (!product) return state
        const resolvedFinish = finishId ?? product.finishes[0].id
        const existing = state.cart.find((line) => line.kind === 'product' && line.catalogId === productId && line.finishId === resolvedFinish)
        if (existing) return { cart: state.cart.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line) }
        return { cart: [...state.cart, { id: makeId('cart'), kind: 'product', catalogId: productId, finishId: resolvedFinish, quantity: 1 }] }
      }),
      addCartDecor: (decorId) => set((state) => {
        if (!decorById(decorId)) return state
        const existing = state.cart.find((line) => line.kind === 'decor' && line.catalogId === decorId)
        if (existing) return { cart: state.cart.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line) }
        return { cart: [...state.cart, { id: makeId('cart'), kind: 'decor', catalogId: decorId, quantity: 1 }] }
      }),
      updateCartQuantity: (id, quantity) => set((state) => ({
        cart: quantity <= 0 ? state.cart.filter((line) => line.id !== id) : state.cart.map((line) => line.id === id ? { ...line, quantity: Math.min(20, quantity) } : line),
      })),
      setCartFinish: (id, finishId) => set((state) => ({ cart: state.cart.map((line) => line.id === id ? { ...line, finishId } : line) })),
      removeCartLine: (id) => set((state) => ({ cart: state.cart.filter((line) => line.id !== id) })),
      clearCart: () => set({ cart: [] }),
      setAudioEnabled: (audioEnabled) => set({ audioEnabled, ambienceEnabled: audioEnabled ? get().ambienceEnabled : false }),
      setAmbienceEnabled: (ambienceEnabled) => set((state) => ({ ambienceEnabled: state.audioEnabled ? ambienceEnabled : false })),
    }),
    {
      name: 'room-ritual-state',
      version: 1,
      partialize: (state) => ({
        room: state.room,
        selectedProductId: state.selectedProductId,
        measurementsVisible: state.measurementsVisible,
        savedConfigurations: state.savedConfigurations,
        mood: state.mood,
        cart: state.cart,
        audioEnabled: state.audioEnabled,
        ambienceEnabled: state.ambienceEnabled,
      }),
    },
  ),
)
