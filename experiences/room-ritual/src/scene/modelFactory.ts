import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { decorById, productById } from '../data/catalog'
import type { DecorProduct, FinishOption, Product } from '../types'

type MaterialRole = 'primary' | 'secondary' | 'accent' | 'dark' | 'linen' | 'leaf'

const buildMaterial = (role: MaterialRole, finish?: FinishOption) => {
  const color = role === 'primary' ? finish?.primary ?? '#c8b79c'
    : role === 'secondary' ? finish?.secondary ?? '#4b3b31'
      : role === 'accent' ? finish?.accent ?? '#b7bdc0'
        : role === 'leaf' ? '#344b36'
          : role === 'linen' ? '#e4ded2'
            : '#292723'
  const isMetal = role === 'accent'
  const resolvedColor = new THREE.Color(color)
  return new THREE.MeshStandardMaterial({
    color: resolvedColor,
    roughness: isMetal ? 0.26 : role === 'primary' ? 0.72 : 0.56,
    metalness: isMetal ? 0.78 : 0.03,
    emissive: resolvedColor,
    emissiveIntensity: 0.08,
  })
}

const roundedBox = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
  name: string,
) => {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, Math.min(radius, width / 4, height / 4, depth / 4)), material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const box = (width: number, height: number, depth: number, material: THREE.Material, name: string) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const cylinder = (radius: number, height: number, material: THREE.Material, name: string, radialSegments = 20) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const markProduct = (root: THREE.Group, product: Product, finishId: string) => {
  root.name = product.name
  root.userData.productId = product.id
  root.userData.finishId = finishId
  root.userData.source = 'authored-fallback'
  root.traverse((object) => {
    object.userData.productRoot = root
  })
  return root
}

export const buildProductModel = (productId: string, finishId: string) => {
  const product = productById(productId)
  if (!product) return new THREE.Group()
  const finish = product.finishes.find((candidate) => candidate.id === finishId) ?? product.finishes[0]
  const primary = buildMaterial('primary', finish)
  const secondary = buildMaterial('secondary', finish)
  const accent = buildMaterial('accent', finish)
  const root = new THREE.Group()
  const { width: w, depth: d, height: h } = product.dimensions

  if (productId === 'morrow-sofa') {
    const base = roundedBox(w * 0.94, 0.16, d * 0.8, 0.045, secondary, 'insetPlinth')
    base.position.y = 0.12
    root.add(base)
    const seatHeight = 0.22
    const cushionWidth = w * 0.285
    for (let index = 0; index < 3; index += 1) {
      const seat = roundedBox(cushionWidth, seatHeight, d * 0.62, 0.075, primary, `seatCushion${index + 1}`)
      seat.position.set((index - 1) * cushionWidth * 1.03, 0.31, 0.05)
      root.add(seat)
      const back = roundedBox(cushionWidth, h * 0.5, 0.18, 0.065, primary, `backCushion${index + 1}`)
      back.position.set((index - 1) * cushionWidth * 1.03, 0.48, -d * 0.33)
      back.rotation.x = -0.12
      root.add(back)
    }
    const rail = roundedBox(w * 0.96, 0.09, 0.1, 0.025, secondary, 'rearTimberRail')
    rail.position.set(0, 0.58, -d * 0.47)
    root.add(rail)
    for (const x of [-w * 0.38, w * 0.38]) {
      for (const z of [-d * 0.34, d * 0.32]) {
        const foot = box(0.07, 0.12, 0.07, accent, 'aluminumFoot')
        foot.userData.mobileOptional = true
        foot.position.set(x, 0.06, z)
        root.add(foot)
      }
    }
  } else if (productId === 'fold-lounge') {
    const seat = roundedBox(w * 0.68, 0.16, d * 0.56, 0.055, primary, 'foldedSeat')
    seat.position.set(0, 0.38, 0.06)
    seat.rotation.x = -0.08
    root.add(seat)
    const back = roundedBox(w * 0.68, h * 0.58, 0.14, 0.05, primary, 'foldedBack')
    back.position.set(0, 0.57, -d * 0.25)
    back.rotation.x = -0.23
    root.add(back)
    for (const x of [-w * 0.4, w * 0.4]) {
      const side = new THREE.Group()
      const rear = box(0.075, h * 0.78, 0.075, secondary, 'rearAshPost')
      rear.position.set(x, h * 0.39, -d * 0.27)
      rear.rotation.x = -0.14
      side.add(rear)
      const runner = box(0.075, 0.075, d * 0.75, secondary, 'ashRunner')
      runner.position.set(x, 0.18, 0.03)
      runner.rotation.x = -0.2
      side.add(runner)
      root.add(side)
    }
    const bar = cylinder(0.025, w * 0.88, accent, 'tensionBar', 24)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, 0.27, -d * 0.2)
    root.add(bar)
  } else if (productId === 'cairn-table') {
    const left = roundedBox(w * 0.62, h * 0.82, d * 0.82, 0.08, primary, 'stoneVolumeA')
    left.position.set(-w * 0.17, h * 0.47, 0.03)
    left.rotation.y = 0.08
    root.add(left)
    const right = roundedBox(w * 0.45, h * 0.62, d * 0.64, 0.07, secondary, 'stoneVolumeB')
    right.position.set(w * 0.27, h * 0.37, -d * 0.07)
    right.rotation.y = -0.1
    root.add(right)
    for (const x of [-w * 0.38, w * 0.38]) {
      const foot = cylinder(0.025, 0.07, accent, 'bronzeFoot', 16)
      foot.userData.mobileOptional = true
      foot.position.set(x, 0.035, 0)
      root.add(foot)
    }
  } else if (productId === 'span-table') {
    const top = roundedBox(w, 0.11, d, 0.045, primary, 'pillowedTop')
    top.position.y = h - 0.055
    root.add(top)
    for (const x of [-w * 0.34, w * 0.34]) {
      const trestle = roundedBox(0.18, h * 0.82, d * 0.72, 0.045, secondary, 'timberTrestle')
      trestle.position.set(x, h * 0.42, 0)
      root.add(trestle)
    }
    const rail = box(w * 0.75, 0.095, 0.095, accent, 'castSpine')
    rail.position.set(0, h * 0.42, 0)
    root.add(rail)
  } else if (productId === 'pilaster-credenza') {
    const plinth = roundedBox(w * 0.98, 0.16, d * 0.94, 0.035, secondary, 'stonePlinth')
    plinth.position.y = 0.08
    root.add(plinth)
    const casework = roundedBox(w, h * 0.75, d, 0.035, primary, 'casework')
    casework.position.y = 0.16 + h * 0.375
    root.add(casework)
    const frontZ = d * 0.51
    for (let index = 0; index < 4; index += 1) {
      const door = roundedBox(w * 0.235, h * 0.55, 0.025, 0.01, primary, `flutedDoor${index + 1}`)
      door.position.set((index - 1.5) * w * 0.247, 0.16 + h * 0.34, frontZ)
      root.add(door)
      for (let flute = -2; flute <= 2; flute += 1) {
        const rib = box(0.008, h * 0.48, 0.012, secondary, 'fluteShadow')
        rib.userData.mobileOptional = true
        rib.position.set(door.position.x + flute * w * 0.032, door.position.y, frontZ + 0.02)
        root.add(rib)
      }
      const handle = cylinder(0.012, 0.09, accent, 'brassPull', 12)
      handle.rotation.z = Math.PI / 2
      handle.position.set(door.position.x, door.position.y, frontZ + 0.055)
      root.add(handle)
    }
    const drawer = roundedBox(w * 0.36, 0.12, d * 0.88, 0.018, primary, 'detailDrawer')
    drawer.position.set(0, h * 0.68, 0.02)
    drawer.userData.closedZ = drawer.position.z
    root.add(drawer)
  } else if (productId === 'loop-daybed') {
    const deck = roundedBox(w, 0.2, d, 0.065, secondary, 'timberDeck')
    deck.position.y = 0.2
    root.add(deck)
    const cushion = roundedBox(w * 0.94, 0.2, d * 0.88, 0.07, primary, 'daybedCushion')
    cushion.position.set(0, 0.39, 0.01)
    root.add(cushion)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(w * 0.43, 0.28, d * 0.34),
      new THREE.Vector3(w * 0.43, h, d * 0.34),
      new THREE.Vector3(-w * 0.33, h, d * 0.34),
      new THREE.Vector3(-w * 0.43, h * 0.75, d * 0.18),
      new THREE.Vector3(-w * 0.43, 0.28, -d * 0.34),
    ], false, 'centripetal')
    const loop = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.025, 10, false), accent)
    loop.name = 'continuousSteelLoop'
    loop.castShadow = true
    root.add(loop)
  }

  return markProduct(root, product, finish.id)
}

export const buildDecorModel = (decorId: string) => {
  const decor = decorById(decorId)
  const root = new THREE.Group()
  if (!decor) return root
  const primary = new THREE.MeshStandardMaterial({ color: decor.color, roughness: 0.7 })
  const stone = new THREE.MeshStandardMaterial({ color: '#c8b493', roughness: 0.82 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2926', roughness: 0.4, metalness: 0.55 })
  const { width: w, depth: d, height: h } = decor.dimensions
  if (decor.category === 'lighting') {
    const base = cylinder(Math.max(w, d) * 0.16, 0.08, stone, 'lampBase')
    base.position.y = 0.04
    root.add(base)
    const stem = cylinder(0.018, h * 0.75, dark, 'lampStem', 12)
    stem.position.y = h * 0.4
    root.add(stem)
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.3, h * 0.22, 24, 1, true), primary)
    shade.position.y = h * 0.84
    root.add(shade)
  } else if (decor.category === 'plant') {
    const pot = cylinder(Math.max(w, d) * 0.22, h * 0.25, stone, 'planter')
    pot.position.y = h * 0.125
    root.add(pot)
    const stem = cylinder(0.025, h * 0.65, dark, 'plantStem', 10)
    stem.position.y = h * 0.53
    root.add(stem)
    const leafMaterial = new THREE.MeshStandardMaterial({ color: decor.color, roughness: 0.85, side: THREE.DoubleSide })
    for (let index = 0; index < 13; index += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (index % 3) * 0.035, 12, 8), leafMaterial)
      const angle = index * 2.399
      leaf.scale.set(1.5, 0.32, 0.72)
      leaf.position.set(Math.cos(angle) * (0.12 + (index % 4) * 0.06), h * (0.42 + index * 0.035), Math.sin(angle) * 0.24)
      leaf.rotation.y = angle
      leaf.castShadow = true
      leaf.name = `plantLeaf${index + 1}`
      if (index > 5) leaf.userData.mobileOptional = true
      root.add(leaf)
    }
  } else if (decor.category === 'art') {
    const frame = roundedBox(w, h, d, 0.025, dark, 'artFrame')
    frame.position.y = h / 2
    root.add(frame)
    const art = roundedBox(w * 0.92, h * 0.93, d * 0.35, 0.01, primary, 'artPanel')
    art.position.set(0, h / 2, d * 0.55)
    root.add(art)
  } else if (decor.category === 'shelf') {
    const shelf = roundedBox(w, h, d, 0.02, primary, 'floatingShelf')
    shelf.position.y = h / 2
    root.add(shelf)
  }
  root.name = decor.name
  root.userData.decorId = decor.id
  root.userData.source = 'authored-fallback'
  root.traverse((object) => { object.userData.decorRoot = root })
  return root
}

export const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => material.dispose())
  })
}

export const productForObject = (object: THREE.Object3D | null) => {
  let current = object
  while (current) {
    if (current.userData.instanceId) return current.userData.instanceId as string
    current = current.parent
  }
  return null
}

export const decorForObject = (object: THREE.Object3D | null) => {
  let current = object
  while (current) {
    if (current.userData.decorInstanceId) return current.userData.decorInstanceId as string
    current = current.parent
  }
  return null
}

export const getDecorCatalogItem = (decorId: string): DecorProduct | undefined => decorById(decorId)
