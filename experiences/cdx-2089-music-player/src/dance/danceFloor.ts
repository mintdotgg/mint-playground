import * as THREE from 'three'
import type { AudioEngine } from '../audio/engine'
import { TRACKS, fmtTime } from '../audio/tracks'
import { DISC_THICKNESS } from '../kit/disc'
import type { SkinDef } from '../skins/types'
import { tweens, easings, damp } from '../tween'
import { createMiamiClubPack, type ClubAvatar } from './clubCharacters'

type DataPanel = {
  mesh: THREE.Mesh
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  role: number
}

const colorCss = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`

/**
 * Place a plane on the outside of the arena with an explicit local frame.
 * X follows the wall tangent, Y follows the conical rise, and Z faces outward.
 * Using only setFromUnitVectors() leaves roll undefined and made each panel
 * appear to lean in a different direction.
 */
function frameOnArenaWall(object: THREE.Object3D, angle: number, radius: number, height: number) {
  const outward = new THREE.Vector3(
    Math.cos(angle) * 0.84,
    Math.sin(angle) * 0.84,
    0.54,
  ).normalize()
  const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0).normalize()
  const wallUp = outward.clone().cross(tangent).normalize()
  const basis = new THREE.Matrix4().makeBasis(tangent, wallUp, outward)

  object.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, height)
  object.quaternion.setFromRotationMatrix(basis)
}

function makeDataPanel(role: number): DataPanel {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.29),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      depthTest: false,
      // Panels intentionally face outward around the arena. Their backs must
      // stay hidden or canvas typography appears mirrored across the stage.
      side: THREE.FrontSide,
      toneMapped: false,
    }),
  )
  mesh.renderOrder = 28
  return { mesh, canvas, ctx, texture, role }
}

/** Live stage architecture attached to the disc, outside its rotating spinner. */
export class DanceFloor {
  readonly group = new THREE.Group()
  private avatars: ClubAvatar[] = createMiamiClubPack()
  private bars: THREE.InstancedMesh
  private barMat: THREE.MeshStandardMaterial
  private tierMats: THREE.MeshStandardMaterial[] = []
  private accentMats: Array<THREE.MeshBasicMaterial | THREE.MeshStandardMaterial> = []
  private pulseRings: THREE.Mesh[] = []
  private panels: DataPanel[] = []
  private dummy = new THREE.Object3D()
  private skin: SkinDef | null = null
  private panelAcc = 0
  private visibilityTween: { kill: () => void } | null = null

  constructor(private engine: AudioEngine) {
    this.group.name = 'dance-floor-stage'
    this.group.visible = false
    this.group.position.z = 0.1

    // This stage group is raised above the player, so dancer-local Z needs to
    // compensate for that offset. Their Mint presentations are grounded at
    // root Y=0; after the Y-up -> Z-up rotation this lands their soles just
    // above the actual CD face instead of leaving a permanent air gap.
    const discFaceZ = DISC_THICKNESS / 2
    const dancerFloorClearance = 0.006
    const dancerFloorZ = discFaceZ - this.group.position.z + dancerFloorClearance
    const contactShadowZ = discFaceZ - this.group.position.z + 0.002

    const tierSpecs: Array<[number, number, number]> = [
      [1.62, 1.91, 0.08],
      [1.95, 2.25, 0.18],
      [2.29, 2.66, 0.3],
    ]
    for (const [inner, outer, z] of tierSpecs) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x141923,
        metalness: 0.54,
        roughness: 0.4,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
      const tier = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 160), mat)
      tier.position.z = z
      this.tierMats.push(mat)
      this.group.add(tier)
    }

    const floorWashMat = new THREE.MeshBasicMaterial({
      color: 0xff4d88,
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const floorWash = new THREE.Mesh(new THREE.RingGeometry(0.2, 1.56, 160), floorWashMat)
    floorWash.position.z = 0.012
    floorWash.renderOrder = 8
    this.accentMats.push(floorWashMat)
    this.group.add(floorWash)

    for (const [r, z, opacity] of [[0.52, 0.025, 0.35], [1.02, 0.028, 0.24], [1.49, 0.03, 0.4]] as const) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff4d88,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 128), mat)
      ring.position.z = z
      this.pulseRings.push(ring)
      this.accentMats.push(mat)
      this.group.add(ring)
    }

    const barGeo = new THREE.BoxGeometry(0.026, 0.074, 1)
    barGeo.translate(0, 0, 0.5)
    this.barMat = new THREE.MeshStandardMaterial({
      color: 0xff4d88,
      emissive: 0xff4d88,
      emissiveIntensity: 0.4,
      metalness: 0.38,
      roughness: 0.25,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    })
    this.bars = new THREE.InstancedMesh(barGeo, this.barMat, 128)
    this.bars.renderOrder = 18
    this.group.add(this.bars)

    const avatarPositions: Array<[number, number, number]> = [
      [-0.65, -0.42, -0.22],
      [0.62, -0.38, 0.26],
      [-0.52, 0.6, 0.58],
      [0.57, 0.61, -0.62],
    ]
    const contactShadowGeometry = new THREE.CircleGeometry(1, 32)
    const contactShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.avatars.forEach((avatar, i) => {
      const [x, y, heading] = avatarPositions[i]
      const contactShadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial)
      contactShadow.name = `club-contact-shadow-${i + 1}`
      contactShadow.position.set(x, y, contactShadowZ)
      contactShadow.scale.set(0.16, 0.09, 1)
      contactShadow.renderOrder = 9
      this.group.add(contactShadow)

      const wrapper = new THREE.Group()
      wrapper.name = `club-slot-${i + 1}`
      // Mint characters are Y-up while the player face is locally Z-up.
      // Compose the transforms explicitly so heading remains a yaw around the
      // floor normal. Setting Euler X then Z with the default XYZ order makes
      // the Z heading tilt the character's up axis instead.
      const standUpright = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      )
      const faceStage = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        heading,
      )
      wrapper.quaternion.copy(faceStage).multiply(standUpright)
      wrapper.position.set(x, y, dancerFloorZ)
      wrapper.add(avatar.root)
      this.group.add(wrapper)
    })

    const panelAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
    panelAngles.forEach((angle, role) => {
      const panel = makeDataPanel(role)
      frameOnArenaWall(panel.mesh, angle, 2.56, 0.78)
      this.panels.push(panel)
      this.group.add(panel.mesh)
    })
  }

  setSkin(def: SkinDef) {
    this.skin = def
    const accent = new THREE.Color(def.palette.accent)
    this.barMat.color.copy(accent)
    this.barMat.emissive.copy(accent)
    for (const mat of this.accentMats) mat.color.copy(accent)
    const tierBase = new THREE.Color(def.palette.bgTop).lerp(new THREE.Color(def.palette.panel), 0.58)
    this.tierMats.forEach((mat, i) => mat.color.copy(tierBase).offsetHSL(0, 0, i * 0.035))
    this.redrawPanels()
  }

  show() {
    this.visibilityTween?.kill()
    this.group.visible = true
    this.group.scale.setScalar(0.001)
    this.visibilityTween = tweens.add({
      duration: 0.9,
      delay: 0.28,
      ease: easings.outBack,
      onUpdate: (v) => this.group.scale.setScalar(Math.max(0.001, v)),
    })
  }

  hide() {
    this.visibilityTween?.kill()
    const from = this.group.scale.x
    this.visibilityTween = tweens.add({
      duration: 0.48,
      ease: easings.inCubic,
      onUpdate: (v) => this.group.scale.setScalar(Math.max(0.001, from * (1 - v))),
      onComplete: () => {
        this.group.visible = false
      },
    })
  }

  update(dt: number, time: number) {
    if (!this.group.visible) return
    const playing = this.engine.playing
    const level = playing ? Math.min(1, this.engine.bands.level * 3.1) : 0.08
    const pulse = this.engine.bands.pulse

    for (let i = 0; i < 128; i++) {
      const mirrored = i < 64 ? i / 64 : (128 - i) / 64
      const bin = Math.min(1023, 2 + Math.floor(Math.pow(mirrored, 1.55) * 420))
      const raw = this.engine.freq[bin] / 255
      const idle = 0.08 + Math.sin(time * 1.7 + i * 0.31) * 0.025
      const energy = playing ? Math.min(1, raw * 2.8 + level * 0.22) : idle
      const angle = (i / 128) * Math.PI * 2 - Math.PI / 2 + time * 0.025
      const r = 2.43
      this.dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.3)
      this.dummy.rotation.set(0, 0, angle)
      this.dummy.scale.set(i % 8 === 0 ? 1.7 : 1, i % 8 === 0 ? 1.2 : 1, 0.08 + energy * 0.54 + pulse * 0.08)
      this.dummy.updateMatrix()
      this.bars.setMatrixAt(i, this.dummy.matrix)
    }
    this.bars.instanceMatrix.needsUpdate = true
    this.barMat.emissiveIntensity = damp(this.barMat.emissiveIntensity, 0.26 + level * 0.55 + pulse * 0.4, 10, dt)

    this.pulseRings.forEach((ring, i) => {
      const s = 1 + pulse * (0.035 + i * 0.015) + Math.sin(time * (0.5 + i * 0.17)) * 0.003
      ring.scale.setScalar(s)
      ring.rotation.z = time * (i % 2 === 0 ? 0.035 : -0.025)
    })
    this.avatars.forEach((avatar) => avatar.update(dt, this.engine.bands, playing))

    this.panelAcc += dt
    if (this.panelAcc > 0.12) {
      this.panelAcc = 0
      this.redrawPanels()
    }
  }

  private redrawPanels() {
    if (!this.skin) return
    const track = TRACKS[this.engine.trackIndex]
    const accent = colorCss(this.skin.palette.accent)
    for (const panel of this.panels) {
      const { ctx, canvas, role } = panel
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(5,7,10,0.9)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.72
      ctx.lineWidth = 6
      ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6)
      ctx.globalAlpha = 1
      ctx.fillStyle = accent
      ctx.font = '700 25px Helvetica, Arial, sans-serif'
      ctx.letterSpacing = '7px'
      ctx.fillText(`${this.skin.name} / FLOOR 0${role + 1}`, 42, 48)
      ctx.fillStyle = '#f3f5f7'

      if (role === 0) {
        ctx.font = '800 58px Helvetica, Arial, sans-serif'
        ctx.fillText(track.title, 42, 126)
        ctx.font = '600 25px Helvetica, Arial, sans-serif'
        ctx.fillStyle = 'rgba(243,245,247,0.68)'
        ctx.fillText(`${track.artist}  ·  ${track.genre}`, 44, 178)
      } else if (role === 1) {
        ctx.font = '800 76px Helvetica, Arial, sans-serif'
        ctx.fillText(String(track.bpm), 42, 139)
        ctx.font = '700 24px Helvetica, Arial, sans-serif'
        ctx.fillStyle = 'rgba(243,245,247,0.62)'
        ctx.fillText('BPM / LIVE TEMPO', 46, 185)
      } else if (role === 2) {
        ctx.font = '800 64px Helvetica, Arial, sans-serif'
        ctx.fillText(`${fmtTime(this.engine.time)} / ${fmtTime(this.engine.duration)}`, 42, 137)
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(44, 174, 900, 18)
        ctx.fillStyle = accent
        ctx.fillRect(44, 174, 900 * this.engine.progress, 18)
      } else {
        const b = this.engine.bands
        ctx.font = '700 27px Helvetica, Arial, sans-serif'
        ctx.fillText(`BASS  ${Math.round(b.bass * 100).toString().padStart(2, '0')}`, 42, 103)
        ctx.fillText(`MID   ${Math.round(b.mid * 100).toString().padStart(2, '0')}`, 42, 147)
        ctx.fillText(`HIGH  ${Math.round(b.high * 100).toString().padStart(2, '0')}`, 42, 191)
      }
      panel.texture.needsUpdate = true
    }
  }
}
