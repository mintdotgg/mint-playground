import * as THREE from 'three'
import type { RobotTheme } from '../theme'
import type { CatalogRobot } from '../types'
import { disposeObject } from './placeholder'
import { applySpatialPose, SpatialMotionController } from './SpatialMotion'

type ReferenceImage = CatalogRobot['reference_images'][number]

const referenceImageUrls = import.meta.glob<string>(
  '../reference-images/**/*.{avif,jpg,jpeg,png,webp,svg}',
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
)

type ImagePlacement = {
  x: number
  y: number
  z: number
  maxWidth: number
  maxHeight: number
  opacity: number
}

const placements: ImagePlacement[] = [
  { x: -0.62, y: 0.58, z: -1.02, maxWidth: 0.86, maxHeight: 1.02, opacity: 0.76 },
  { x: 1.34, y: 0.88, z: -0.62, maxWidth: 0.58, maxHeight: 0.42, opacity: 0.92 },
  { x: -1.34, y: 0.23, z: -0.5, maxWidth: 0.52, maxHeight: 0.38, opacity: 0.9 },
]

function selectReferences(robot: CatalogRobot): ReferenceImage[] {
  const references = robot.reference_images
  const ordered = [
    references[0],
    ...references.filter((reference) => /detail|mechanical/.test(reference.view)),
    ...references,
  ].filter((reference): reference is ReferenceImage => Boolean(reference))

  return [...new Map(ordered.map((reference) => [reference.id, reference])).values()].slice(0, 3)
}

function localReferenceUrl(robot: CatalogRobot, reference: ReferenceImage): string {
  const pathname = new URL(reference.direct_url).pathname
  const extension = pathname.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '.jpg'
  const localPath = `../reference-images/${robot.id}/${reference.id}${extension}`
  const runtimeUrl = referenceImageUrls[localPath]
  if (!runtimeUrl) {
    throw new Error(`Missing authored reference image: ${robot.id}/${reference.id}${extension}`)
  }
  return runtimeUrl
}

function labelMesh(
  reference: ReferenceImage,
  theme: RobotTheme,
  width: number,
  alignment: 'left' | 'right',
): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 180
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create product-reference label canvas.')
  context.clearRect(0, 0, canvas.width, canvas.height)
  const rightAligned = alignment === 'right'
  const textX = rightAligned ? canvas.width - 48 : 48
  context.fillStyle = theme.accent
  context.fillRect(rightAligned ? canvas.width - 22 : 0, 0, 22, canvas.height)
  context.fillStyle = theme.ink
  context.textAlign = alignment
  context.font = '700 21px SFMono-Regular, Menlo, Consolas, monospace'
  context.fillText(`${reference.view.replaceAll('_', ' ').toLocaleUpperCase()} / ${reference.role.toLocaleUpperCase()}`.slice(0, 72), textX, 60)
  context.fillStyle = theme.inkMuted
  context.font = '550 16px SFMono-Regular, Menlo, Consolas, monospace'
  context.fillText(`OFFICIAL MANUFACTURER / ${reference.revision_alignment.replaceAll('_', ' ').toLocaleUpperCase()}`.slice(0, 88), textX, 110)
  context.fillStyle = theme.ink
  context.fillRect(rightAligned ? 0 : 48, 140, canvas.width - 48, 3)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(width, Math.max(0.09, width * 0.15)), material)
}

function imageDimensions(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as HTMLImageElement & { width?: number; height?: number }
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1,
  }
}

function createReferenceGroup(
  texture: THREE.Texture,
  reference: ReferenceImage,
  theme: RobotTheme,
  placement: ImagePlacement,
  height: number,
): THREE.Group {
  const group = new THREE.Group()
  const source = imageDimensions(texture)
  const aspect = source.width / Math.max(source.height, 1)
  let width = placement.maxWidth
  let imageHeight = width / aspect
  if (imageHeight > placement.maxHeight) {
    imageHeight = placement.maxHeight
    width = imageHeight * aspect
  }

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(width, imageHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: placement.opacity,
      // Reference images are spatial surfaces: draw them before other transparent
      // editorial layers and let visible pixels occlude anything behind them.
      depthWrite: true,
      depthTest: true,
      alphaTest: 0.02,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  )
  image.name = `official-reference-${reference.id}`
  image.renderOrder = -1
  group.add(image)

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width + 0.025, imageHeight + 0.025)),
    new THREE.LineBasicMaterial({ color: theme.ink, transparent: true, opacity: 0.58 }),
  )
  frame.position.z = 0.006
  group.add(frame)

  const signal = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(width * 0.28, 0.22), 0.018),
    new THREE.MeshBasicMaterial({ color: theme.accent, toneMapped: false }),
  )
  const inwardDirection = placement.x < 0 ? 1 : -1
  signal.position.set(
    inwardDirection * (width * 0.5 - Math.min(width * 0.14, 0.11)),
    imageHeight * 0.5 + 0.03,
    0.012,
  )
  group.add(signal)

  const label = labelMesh(reference, theme, width, placement.x < 0 ? 'right' : 'left')
  label.position.set(0, -imageHeight * 0.5 - Math.max(0.065, width * 0.08), 0.012)
  group.add(label)

  group.position.set(placement.x, height * placement.y, placement.z)
  group.rotation.set(0, 0, 0)
  return group
}

export class ReferenceImageLayers {
  readonly root = new THREE.Group()
  private readonly loader = new THREE.TextureLoader()
  private readonly motion = new SpatialMotionController()
  private currentGroup: THREE.Group | null = null
  private revision = 0

  constructor(scene: THREE.Scene) {
    this.root.name = 'official-product-reference-images'
    scene.add(this.root)
  }

  update(
    robot: CatalogRobot,
    theme: RobotTheme,
    height: number,
    direction = 0,
    animateTransition = false,
  ): void {
    const revision = ++this.revision
    const group = new THREE.Group()
    group.name = `reference-rig-${robot.id}`
    this.commitGroup(group, direction, animateTransition)

    selectReferences(robot).forEach((reference, index) => {
      const placement = placements[index]
      this.loader.load(
        localReferenceUrl(robot, reference),
        (texture) => {
          if (revision !== this.revision) {
            texture.dispose()
            return
          }
          group.add(createReferenceGroup(texture, reference, theme, placement, height))
        },
        undefined,
        () => {
          console.warn(`Official product reference unavailable: ${robot.id}/${reference.id}`)
        },
      )
    })
  }

  animate(delta: number): void {
    this.motion.update(delta)
  }

  destroy(): void {
    this.revision += 1
    this.motion.clear()
    this.root.removeFromParent()
    this.clear()
  }

  private commitGroup(group: THREE.Group, direction: number, animateTransition: boolean): void {
    const previous = this.currentGroup
    this.currentGroup = group
    this.root.add(group)

    if (!animateTransition || direction === 0) {
      if (previous) this.disposeGroup(previous)
      return
    }

    if (previous) {
      this.motion.move(
        previous,
        {
          x: -direction * 2.25,
          y: 0,
          z: 0.46,
          scale: 0.86,
          rotationY: direction * 0.62,
        },
        {
          duration: 0.31,
          easing: 'exit',
          onComplete: () => this.disposeGroup(previous),
        },
      )
    }

    applySpatialPose(group, {
      x: direction * 2.4,
      y: 0,
      z: 0.44,
      scale: 0.86,
      rotationY: -direction * 0.72,
    })
    this.motion.move(
      group,
      { x: 0, y: 0, z: 0, scale: 1, rotationY: 0 },
      { duration: 0.68, delay: 0.1, easing: 'enter' },
    )
  }

  private disposeGroup(group: THREE.Group): void {
    this.motion.cancel(group)
    group.removeFromParent()
    disposeObject(group)
  }

  private clear(): void {
    this.currentGroup = null
    for (const child of [...this.root.children]) {
      this.disposeGroup(child as THREE.Group)
    }
  }
}
