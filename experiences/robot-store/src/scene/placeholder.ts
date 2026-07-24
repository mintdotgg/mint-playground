import * as THREE from 'three'
import type { RobotTheme } from '../theme'
import type { CatalogRobot } from '../types'

function heightFor(robot: CatalogRobot): number {
  const height = robot.specs.dimensions.height_m
  if (typeof height === 'number') return height
  if (height && typeof height === 'object') return height.max
  return robot.market.locomotion === 'wheeled' ? 1.45 : 1.7
}

type ProxyMaterials = {
  body: THREE.MeshStandardMaterial
  secondary: THREE.MeshStandardMaterial
  joint: THREE.MeshStandardMaterial
  accent: THREE.MeshStandardMaterial
  visor: THREE.MeshPhysicalMaterial
}

function proxyMaterials(theme: RobotTheme): ProxyMaterials {
  return {
    body: new THREE.MeshStandardMaterial({ color: theme.proxyBody, metalness: 0.16, roughness: 0.74 }),
    secondary: new THREE.MeshStandardMaterial({ color: '#585b57', metalness: 0.22, roughness: 0.62 }),
    joint: new THREE.MeshStandardMaterial({ color: '#101110', metalness: 0.48, roughness: 0.42 }),
    accent: new THREE.MeshStandardMaterial({ color: theme.accent, metalness: 0.08, roughness: 0.48 }),
    visor: new THREE.MeshPhysicalMaterial({
      color: '#0c0d0d',
      roughness: 0.12,
      metalness: 0.52,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
    }),
  }
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function createBipedRig(height: number, materials: ProxyMaterials): THREE.Group {
  const group = new THREE.Group()
  const hipY = height * 0.47
  const shoulderY = height * 0.72
  const limbRadius = height * 0.037

  addMesh(
    group,
    new THREE.CapsuleGeometry(height * 0.125, height * 0.2, 7, 16),
    materials.body,
    [0, height * 0.63, 0],
    [1.12, 1, 0.7],
  )
  addMesh(
    group,
    new THREE.BoxGeometry(height * 0.17, height * 0.085, height * 0.012),
    materials.accent,
    [0, height * 0.665, height * 0.104],
  )
  addMesh(
    group,
    new THREE.SphereGeometry(height * 0.087, 24, 16),
    materials.secondary,
    [0, height * 0.9, 0],
    [0.86, 1, 0.78],
  )
  addMesh(
    group,
    new THREE.BoxGeometry(height * 0.105, height * 0.022, height * 0.018),
    materials.visor,
    [0, height * 0.91, height * 0.068],
  )
  addMesh(
    group,
    new THREE.CylinderGeometry(height * 0.055, height * 0.06, height * 0.075, 16),
    materials.joint,
    [0, height * 0.81, 0],
  )
  addMesh(
    group,
    new THREE.BoxGeometry(height * 0.21, height * 0.105, height * 0.12),
    materials.secondary,
    [0, hipY, 0],
  )

  for (const side of [-1, 1]) {
    const armX = side * height * 0.165
    const upperArm = addMesh(
      group,
      new THREE.CapsuleGeometry(limbRadius, height * 0.16, 5, 12),
      materials.body,
      [armX, height * 0.62, 0],
    )
    upperArm.rotation.z = side * -0.055
    addMesh(
      group,
      new THREE.SphereGeometry(limbRadius * 1.32, 16, 10),
      materials.accent,
      [armX + side * height * 0.008, height * 0.51, 0],
    )
    const forearm = addMesh(
      group,
      new THREE.CapsuleGeometry(limbRadius * 0.9, height * 0.155, 5, 12),
      materials.secondary,
      [armX + side * height * 0.012, height * 0.405, 0],
    )
    forearm.rotation.z = side * -0.025
    addMesh(
      group,
      new THREE.BoxGeometry(height * 0.062, height * 0.075, height * 0.055),
      materials.joint,
      [armX + side * height * 0.014, height * 0.3, 0],
    )

    const legX = side * height * 0.072
    addMesh(
      group,
      new THREE.CapsuleGeometry(limbRadius * 1.12, height * 0.19, 5, 12),
      materials.body,
      [legX, height * 0.36, 0],
    )
    addMesh(
      group,
      new THREE.SphereGeometry(limbRadius * 1.42, 16, 10),
      materials.accent,
      [legX, height * 0.255, 0],
    )
    addMesh(
      group,
      new THREE.CapsuleGeometry(limbRadius, height * 0.17, 5, 12),
      materials.secondary,
      [legX, height * 0.145, 0],
    )
    addMesh(
      group,
      new THREE.BoxGeometry(height * 0.096, height * 0.045, height * 0.155),
      materials.joint,
      [legX, height * 0.035, height * 0.038],
    )
  }

  const shoulderBand = addMesh(
    group,
    new THREE.BoxGeometry(height * 0.4, height * 0.024, height * 0.13),
    materials.joint,
    [0, shoulderY, 0],
  )
  shoulderBand.rotation.z = -0.015
  return group
}

function createWheeledRig(height: number, materials: ProxyMaterials): THREE.Group {
  const group = new THREE.Group()
  const baseHeight = height * 0.13

  addMesh(
    group,
    new THREE.CylinderGeometry(height * 0.23, height * 0.27, baseHeight, 20),
    materials.joint,
    [0, baseHeight * 0.5, 0],
    [1, 1, 0.75],
  )
  addMesh(
    group,
    new THREE.BoxGeometry(height * 0.28, height * 0.045, height * 0.2),
    materials.accent,
    [0, baseHeight * 0.88, height * 0.02],
  )
  addMesh(
    group,
    new THREE.CylinderGeometry(height * 0.045, height * 0.055, height * 0.43, 14),
    materials.secondary,
    [0, baseHeight + height * 0.22, 0],
  )
  addMesh(
    group,
    new THREE.CapsuleGeometry(height * 0.13, height * 0.18, 6, 16),
    materials.body,
    [0, height * 0.6, 0],
    [1.3, 1, 0.68],
  )
  addMesh(
    group,
    new THREE.BoxGeometry(height * 0.17, height * 0.075, height * 0.012),
    materials.accent,
    [0, height * 0.63, height * 0.102],
  )
  addMesh(
    group,
    new THREE.SphereGeometry(height * 0.07, 24, 16),
    materials.secondary,
    [0, height * 0.85, 0],
    [1, 0.82, 0.8],
  )
  addMesh(
    group,
    new THREE.BoxGeometry(height * 0.095, height * 0.02, height * 0.015),
    materials.visor,
    [0, height * 0.855, height * 0.054],
  )

  for (const side of [-1, 1]) {
    const x = side * height * 0.2
    const arm = addMesh(
      group,
      new THREE.CapsuleGeometry(height * 0.032, height * 0.3, 5, 12),
      materials.body,
      [x, height * 0.49, 0],
    )
    arm.rotation.z = side * -0.08
    addMesh(
      group,
      new THREE.BoxGeometry(height * 0.076, height * 0.065, height * 0.058),
      materials.accent,
      [x + side * height * 0.018, height * 0.29, 0],
    )
  }
  return group
}

export function createTemporarySilhouette(robot: CatalogRobot, theme: RobotTheme): THREE.Group {
  const height = heightFor(robot)
  const materials = proxyMaterials(theme)
  const wheeled = robot.market.locomotion === 'wheeled' || robot.market.form_factor.includes('wheeled')
  const group = wheeled ? createWheeledRig(height, materials) : createBipedRig(height, materials)
  group.name = `calibration-proxy-${robot.id}`
  group.userData.temporarySilhouette = true

  const datum = new THREE.Mesh(
    new THREE.TorusGeometry(height * 0.285, height * 0.006, 5, 64),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.72, depthWrite: false }),
  )
  datum.rotation.x = Math.PI / 2
  datum.position.y = height * 0.015
  group.add(datum)
  return group
}

export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const skeletons = new Set<THREE.Skeleton>()

  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (renderable.geometry) geometries.add(renderable.geometry)
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton)
    if (!renderable.material) return
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material]
    objectMaterials.forEach((material) => materials.add(material))
  })

  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value)
    })
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  skeletons.forEach((skeleton) => skeleton.dispose())
  textures.forEach((texture) => {
    const image = texture.image as unknown
    texture.dispose()
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close()
  })
}
