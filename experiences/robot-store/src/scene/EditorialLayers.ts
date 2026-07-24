import * as THREE from 'three'
import {
  formatHeight,
  formatPayload,
  formatPrice,
  formatRuntime,
  formatStatus,
  isFictionalPrice,
} from '../catalog'
import type { RobotTheme } from '../theme'
import type { CatalogRobot } from '../types'
import { disposeObject } from './placeholder'
import { applySpatialPose, SpatialMotionController } from './SpatialMotion'

const sans = 'Arial Black, Helvetica Neue, Arial, sans-serif'
const mono = 'SFMono-Regular, Menlo, Consolas, monospace'

type SpatialType = {
  mesh: THREE.Mesh
  position: [number, number, number]
  rotation?: [number, number, number]
  name: string
}

function clean(value: string, limit = 44): string {
  return value.replaceAll('_', ' ').toLocaleUpperCase().slice(0, limit)
}

function disclosed(value: string): string {
  return value === 'Not published' ? 'UNDISCLOSED' : value.toLocaleUpperCase()
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number): number {
  let size = startSize
  while (size > 20) {
    context.font = `900 ${size}px ${sans}`
    if (context.measureText(text).width <= maxWidth) return size
    size -= 2
  }
  return size
}

function trackedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  alignment: 'left' | 'right' = 'left',
): void {
  const characters = [...text]
  const trackedWidth = characters.reduce(
    (width, character, index) =>
      width + context.measureText(character).width + (index < characters.length - 1 ? tracking : 0),
    0,
  )
  let cursor = alignment === 'right' ? x - trackedWidth : x
  context.save()
  context.textAlign = 'left'
  for (const character of characters) {
    context.fillText(character, cursor, y)
    cursor += context.measureText(character).width + tracking
  }
  context.restore()
}

function canvasMesh(
  width: number,
  height: number,
  worldWidth: number,
  worldHeight: number,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
  opacity = 1,
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create spatial typography canvas.')
  context.clearRect(0, 0, width, height)
  draw(context, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), material)
}

function place(root: THREE.Group, spatial: SpatialType): THREE.Mesh {
  spatial.mesh.name = spatial.name
  spatial.mesh.position.set(...spatial.position)
  if (spatial.rotation) spatial.mesh.rotation.set(...spatial.rotation)
  root.add(spatial.mesh)
  return spatial.mesh
}

function modelWord(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  return canvasMesh(2048, 600, 2.65, 0.775, (context, width, height) => {
    const word = robot.model.toLocaleUpperCase()
    const size = fitText(context, word, width - 70, 420)
    context.font = `900 ${size}px ${sans}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = theme.accent
    context.fillText(word, width / 2, height * 0.51)
    context.globalCompositeOperation = 'destination-out'
    for (let x = 35; x < width; x += 24) context.fillRect(x, height * 0.785, 10, 3)
  }, 0.9)
}

function barcode(theme: RobotTheme): THREE.Mesh {
  return canvasMesh(1024, 170, 1.18, 0.2, (context, width) => {
    context.fillStyle = theme.ink
    let x = 18
    let index = 0
    while (x < width - 170) {
      const barWidth = [5, 11, 3, 7, 15][index % 5]
      context.fillRect(x, 8, barWidth, 94)
      x += barWidth + [4, 8, 3, 6][index % 4]
      index += 1
    }
    context.font = `600 22px ${mono}`
    context.fillText('ROBOT SYSTEM ARCHIVE / 2026', 18, 145)
    context.textAlign = 'right'
    context.fillText('F-01', width - 18, 145)
  })
}

function freeMeasurement(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  const heightValue = disclosed(formatHeight(robot))
  const primary = heightValue === 'UNDISCLOSED' ? clean(robot.market.locomotion) : heightValue
  return canvasMesh(1200, 480, 1.45, 0.58, (context, width) => {
    context.fillStyle = theme.accent
    context.fillRect(width - 89, 22, 64, 9)
    context.fillStyle = theme.ink
    context.font = `700 25px ${mono}`
    trackedText(context, 'PHYSICAL SYSTEM / 01', width - 25, 68, 3, 'right')
    const headerRuleLength = (width - 50) * 0.5
    context.fillRect(width - 25 - headerRuleLength, 87, headerRuleLength, 3)
    context.textAlign = 'right'
    context.font = `900 ${fitText(context, primary, width - 50, 70)}px ${sans}`
    context.fillText(primary, width - 25, 186)
    context.font = `650 22px ${mono}`
    context.fillText(`HEIGHT  ${heightValue}`, width - 25, 249)
    context.fillText(`PAYLOAD ${disclosed(formatPayload(robot))}`, width - 25, 293)
    context.fillText(`RUNTIME ${disclosed(formatRuntime(robot))}`, width - 25, 337)
    context.fillStyle = theme.inkMuted
    context.font = `550 20px ${mono}`
    context.fillText(clean(robot.market.form_factor, 52), width - 25, 403)
  })
}

function outlinedDeployment(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  return canvasMesh(760, 390, 0.82, 0.44, (context, width, height) => {
    context.strokeStyle = theme.ink
    context.lineWidth = 5
    context.strokeRect(14, 26, width - 28, height - 66)
    context.fillStyle = theme.accent
    context.fillRect(14, 26, 18, height - 66)
    context.fillStyle = theme.ink
    context.font = `700 24px ${mono}`
    trackedText(context, 'DEPLOYMENT STATE', 58, 78, 4)
    context.fillRect(58, 99, width - 96, 2)
    const status = clean(formatStatus(robot.market.status), 38)
    context.font = `900 ${fitText(context, status, width - 115, 48)}px ${sans}`
    context.fillText(status, 58, 173)
    context.font = `600 20px ${mono}`
    context.fillText(clean(robot.market.category, 54), 58, 226)
    context.fillText(clean(robot.market.availability, 54), 58, 270)
    context.font = `600 18px ${mono}`
    context.fillStyle = theme.inkMuted
    context.fillText('MARKET ROUTE / CONTACT LAYER', 58, 345)
  })
}

function capabilityStack(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  return canvasMesh(1300, 650, 1.48, 0.72, (context, width) => {
    context.fillStyle = theme.accent
    context.fillRect(width - 32, 20, 12, 575)
    context.fillStyle = theme.ink
    context.font = `700 25px ${mono}`
    trackedText(context, 'CAPABILITY STACK / ACTIVE', width - 62, 64, 3, 'right')
    const headerRuleLength = (width - 92) * 0.5
    const rowRuleLength = (width - 207) * 0.5
    context.fillRect(width - 30 - headerRuleLength, 84, headerRuleLength, 3)
    context.textAlign = 'right'
    let y = 145
    robot.capabilities.slice(0, 6).forEach((capability, index) => {
      context.font = `900 32px ${sans}`
      context.fillText(String(index + 1).padStart(2, '0'), width - 62, y)
      context.font = `650 21px ${mono}`
      context.fillText(clean(capability, 37), width - 145, y)
      context.fillRect(width - 145 - rowRuleLength, y + 18, rowRuleLength, 1)
      y += 73
    })
    context.fillStyle = theme.inkMuted
    context.font = `550 18px ${mono}`
    context.fillText('FUNCTION SET / NON-EXHAUSTIVE', width - 62, 617)
  })
}

function floatingPrice(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  return canvasMesh(1300, 520, 1.62, 0.62, (context, width) => {
    context.fillStyle = theme.accent
    context.font = `700 22px ${mono}`
    trackedText(context, isFictionalPrice(robot) ? 'CONCEPT MSRP' : 'PUBLISHED PRICE', 18, 58, 5)
    const price = formatPrice(robot.pricing.store_price.usd)
    context.fillStyle = theme.ink
    context.font = `900 ${fitText(context, price, width - 36, 88)}px ${sans}`
    context.fillText(price, 18, 205)
    context.fillStyle = theme.accent
    context.fillRect(18, 235, width * 0.5, 15)
    context.fillStyle = theme.ink
    context.font = `650 21px ${mono}`
    context.fillText('USD / ESTIMATED FOR CONCEPT*', 18, 305)
    context.fillStyle = theme.inkMuted
    context.font = `550 18px ${mono}`
    context.fillText('DISPLAY VALUE · NO TRANSACTION', 18, 428)
    context.textAlign = 'right'
    context.fillText('◢ PRICE NODE', width - 18, 428)
  })
}

function profileStrip(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  return canvasMesh(600, 260, 0.59, 0.26, (context, width, height) => {
    context.strokeStyle = theme.ink
    context.lineWidth = 4
    context.strokeRect(8, 10, width - 16, height - 20)
    context.fillStyle = theme.accent
    context.fillRect(width * 0.87 - 8, 10, width * 0.13, height - 20)
    context.fillStyle = theme.ink
    context.textAlign = 'right'
    context.font = `900 34px ${sans}`
    context.fillText(clean(robot.brand, 18), width * 0.84, 78)
    context.font = `650 18px ${mono}`
    context.fillText(`MODEL / ${clean(robot.model, 22)}`, width * 0.84, 130)
    context.fillText(`REV / ${clean(robot.revision, 28)}`, width * 0.84, 176)
    context.fillText(`FORM / ${clean(robot.market.locomotion, 18)}`, width * 0.84, 220)
  })
}

function qualityStamp(robot: CatalogRobot, theme: RobotTheme): THREE.Mesh {
  return canvasMesh(900, 330, 0.82, 0.3, (context, width, height) => {
    context.strokeStyle = theme.accent
    context.lineWidth = 9
    context.strokeRect(10, 10, width - 20, height - 20)
    context.fillStyle = theme.ink
    context.font = `900 38px ${sans}`
    context.fillText(`REF / ${robot.reference_coverage.score_out_of_5.toFixed(1)}`, 34, 82)
    context.font = `650 18px ${mono}`
    context.fillText(`SPEC / ${clean(robot.quality.spec_confidence)}`, 34, 139)
    context.fillText(`REVISION / ${clean(robot.quality.revision_confidence)}`, 34, 181)
    context.fillText(`IMAGE SET / ${robot.reference_images.length.toString().padStart(2, '0')}`, 34, 223)
    context.fillStyle = theme.accent
    context.fillRect(34, height - 52, width - 68, 12)
  })
}

function makeLine(start: THREE.Vector3, end: THREE.Vector3, theme: RobotTheme): THREE.Line {
  const horizontal = new THREE.Vector3(end.x, start.y, start.z)
  const vertical = new THREE.Vector3(end.x, end.y, start.z)
  const geometry = new THREE.BufferGeometry().setFromPoints([start, horizontal, vertical, end])
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: theme.ink, transparent: true, opacity: 0.42, depthTest: true }),
  )
}

function makeDot(position: THREE.Vector3, theme: RobotTheme, scale = 1): THREE.Mesh {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.022 * scale, 12, 8),
    new THREE.MeshBasicMaterial({ color: theme.accent, toneMapped: false }),
  )
  dot.position.copy(position)
  return dot
}

export class EditorialLayers {
  readonly root = new THREE.Group()
  private readonly motion = new SpatialMotionController()
  private currentGroup: THREE.Group | null = null

  constructor(scene: THREE.Scene) {
    this.root.name = 'fixed-spatial-information-rig'
    scene.add(this.root)
  }

  update(
    robot: CatalogRobot,
    theme: RobotTheme,
    height: number,
    direction = 0,
    animateTransition = false,
  ): void {
    const group = new THREE.Group()
    group.name = `editorial-rig-${robot.id}`

  place(group, {
    mesh: modelWord(robot, theme),
    position: [0, height * 1.3065, -1.38],
    rotation: [0, 0, 0],
    name: 'rear-model-word',
  })

    place(group, {
      mesh: barcode(theme),
      position: [0, height * 1.055, -0.74],
      rotation: [0, 0, 0],
      name: 'archive-barcode',
    })

    const bodyPosition = new THREE.Vector3(-1.15, height * 0.77, 0.08)
    const bodyAnchor = new THREE.Vector3(-0.17, height * 0.7, 0.05)
    const bodyLineEnd = new THREE.Vector3(-0.425, height * 0.77, 0.08)
    place(group, {
      mesh: freeMeasurement(robot, theme),
      position: bodyPosition.toArray() as [number, number, number],
      rotation: [0, 0, 0],
      name: 'physical-system-type',
    })
    group.add(makeLine(bodyAnchor, bodyLineEnd, theme), makeDot(bodyAnchor, theme, 1.25))

    const deploymentPosition = new THREE.Vector3(0.815, height * 0.77, -0.16)
    const deploymentAnchor = new THREE.Vector3(0.19, height * 0.61, 0.01)
    const deploymentLineEnd = new THREE.Vector3(0.405, height * 0.77, -0.16)
    place(group, {
      mesh: outlinedDeployment(robot, theme),
      position: deploymentPosition.toArray() as [number, number, number],
      rotation: [0, 0, 0],
      name: 'deployment-two-line-strip',
    })
    group.add(makeLine(deploymentAnchor, deploymentLineEnd, theme), makeDot(deploymentAnchor, theme))

    const capabilityPosition = new THREE.Vector3(-1.17, height * 0.28, -0.22)
    const capabilityAnchor = new THREE.Vector3(-0.16, height * 0.43, 0.02)
    const capabilityLineEnd = new THREE.Vector3(-0.43, height * 0.28, -0.22)
    place(group, {
      mesh: capabilityStack(robot, theme),
      position: capabilityPosition.toArray() as [number, number, number],
      rotation: [0, 0, 0],
      name: 'capability-free-stack',
    })
    group.add(makeLine(capabilityAnchor, capabilityLineEnd, theme), makeDot(capabilityAnchor, theme))

    const priceY = height * 0.25 - 0.25
    const pricePosition = new THREE.Vector3(1.22, priceY, 0.54)
    const priceAnchor = new THREE.Vector3(0.13, height * 0.19, 0.06)
    const priceLineEnd = new THREE.Vector3(0.41, priceY, 0.54)
    place(group, {
      mesh: floatingPrice(robot, theme),
      position: pricePosition.toArray() as [number, number, number],
      rotation: [0, 0, 0],
      name: 'unboxed-floating-price',
    })
    group.add(makeLine(priceAnchor, priceLineEnd, theme), makeDot(priceAnchor, theme, 1.3))

    place(group, {
      mesh: profileStrip(robot, theme),
      position: [-0.905, height * 0.78, 0.58],
      rotation: [0, 0, 0],
      name: 'identity-single-strip',
    })
    place(group, {
      mesh: qualityStamp(robot, theme),
      position: [1.05, height * 0.99, -0.94],
      rotation: [0, 0, 0],
      name: 'quality-outline-stamp',
    })
    const orbitRule = new THREE.Mesh(
      new THREE.TorusGeometry(height * 0.7, 0.005, 4, 96, Math.PI * 1.5),
      new THREE.MeshBasicMaterial({
        color: theme.accent,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    orbitRule.rotation.x = Math.PI / 2
    orbitRule.rotation.z = 0
    orbitRule.position.y = 0.018
    group.add(orbitRule)
    this.commitGroup(group, direction, animateTransition)
  }

  animate(delta: number): void {
    this.motion.update(delta)
    this.root.rotation.set(0, 0, 0)
  }

  destroy(): void {
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
          x: -direction * 2.5,
          y: 0,
          z: 0.34,
          scale: 0.87,
          rotationY: direction * 0.34,
        },
        {
          duration: 0.34,
          easing: 'exit',
          onComplete: () => this.disposeGroup(previous),
        },
      )
    }

    applySpatialPose(group, {
      x: direction * 2.75,
      y: 0,
      z: 0.32,
      scale: 0.9,
      rotationY: -direction * 0.42,
    })
    this.motion.move(
      group,
      { x: 0, y: 0, z: 0, scale: 1, rotationY: 0 },
      { duration: 0.64, delay: 0.06, easing: 'enter' },
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
