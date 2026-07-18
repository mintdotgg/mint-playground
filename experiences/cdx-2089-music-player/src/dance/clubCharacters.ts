import * as THREE from 'three'
import type { Bands } from '../audio/engine'
import { mintGltfLoader } from '../assets/gltf-runtime'
import { MINT_ASSET_URLS } from '../assets/runtime'

type DancerAsset = {
  name: string
  tagColor: number
  url: string
  phase: number
}

const DANCER_ASSETS: DancerAsset[] = [
  {
    name: 'Coral Circuit / Boom',
    tagColor: 0xff5a87,
    url: MINT_ASSET_URLS.dancers.coralCircuit,
    phase: 0.02,
  },
  {
    name: 'Chrome Pulse / All Night',
    tagColor: 0x79e7ff,
    url: MINT_ASSET_URLS.dancers.chromePulse,
    phase: 0.31,
  },
  {
    name: 'Neon Night / Hip Hop',
    tagColor: 0xb986ff,
    url: MINT_ASSET_URLS.dancers.neonNight,
    phase: 0.57,
  },
  {
    name: 'Signal Runner / Jazz',
    tagColor: 0xffbd55,
    url: MINT_ASSET_URLS.dancers.signalRunner,
    phase: 0.78,
  },
]

const PLAYER_NAMES = [
  'Maya', 'Theo', 'Sofia', 'Marcus', 'Amara', 'Eli', 'Nina', 'Luca',
  'Priya', 'Jonah', 'Lena', 'Noah', 'Samira', 'Jamie', 'Avery', 'Mateo',
]

function pickPlayerNames(count: number) {
  const names = [...PLAYER_NAMES]
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[names[i], names[j]] = [names[j], names[i]]
  }
  return names.slice(0, count)
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function createPlayerTag(asset: DancerAsset, playerName: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 192
  const ctx = canvas.getContext('2d')!
  const accent = `#${asset.tagColor.toString(16).padStart(6, '0')}`

  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 8
  roundedRect(ctx, 16, 28, 736, 120, 52)
  ctx.fillStyle = 'rgba(5, 8, 15, 0.74)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.beginPath()
  ctx.arc(62, 88, 10, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.font = '600 48px Inter, Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(playerName, 94, 88)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }))
  sprite.name = `player-tag-${playerName.toLowerCase()}`
  sprite.position.set(0, 0.82, 0)
  sprite.scale.set(0.32, 0.08, 1)
  sprite.renderOrder = 80
  return sprite
}

/**
 * Keep a looping dance inside its assigned stage slot. Mint's clips contain
 * legitimate vertical bounce, but some also contain horizontal hip travel.
 * Pinning only the hip track's X/Z values preserves the authored dance while
 * preventing a character from wandering through the arena wall.
 */
function pinHorizontalRootMotion(clip: THREE.AnimationClip) {
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.VectorKeyframeTrack)) continue
    if (!/(?:^|[./])Hips\.position$/i.test(track.name)) continue

    const values = track.values
    const originX = values[0]
    const originZ = values[2]
    for (let i = 0; i < values.length; i += 3) {
      values[i] = originX
      values[i + 2] = originZ
    }
  }
  clip.resetDuration()
}

export class ClubAvatar {
  readonly root = new THREE.Group()
  readonly ready: Promise<void>
  private mixer: THREE.AnimationMixer | null = null

  constructor(private asset: DancerAsset, playerName: string) {
    this.root.name = `mint-dancer-${asset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    this.root.add(createPlayerTag(asset, playerName))
    this.ready = this.load()
  }

  private async load() {
    try {
      const gltf = await mintGltfLoader.loadAsync(this.asset.url)
      const model = gltf.scene
      model.name = `${this.root.name}-model`
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.frustumCulled = false
          object.castShadow = true
          object.receiveShadow = true
        }
      })

      // Mint's canonical character GLBs are Y-up and +Z-forward. Normalize by
      // measured bounds so differently proportioned dancers share one floor.
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const targetHeight = 0.72
      const scale = size.y > 0.001 ? targetHeight / size.y : 1

      const presentation = new THREE.Group()
      presentation.name = `${this.root.name}-presentation`
      presentation.scale.setScalar(scale)
      model.position.set(-center.x, -bounds.min.y, -center.z)
      presentation.add(model)
      this.root.add(presentation)

      const sourceClip = gltf.animations[0]
      if (!sourceClip) throw new Error('Mint dancer GLB does not contain an animation clip')

      const clip = sourceClip.clone()
      pinHorizontalRootMotion(clip)
      this.mixer = new THREE.AnimationMixer(model)
      const action = this.mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      action.play()
      action.time = clip.duration * this.asset.phase
    } catch (error) {
      console.error(`Unable to load ${this.asset.name} from Mint`, error)
    }
  }

  update(dt: number, bands: Bands, playing: boolean) {
    if (!this.mixer) return
    const energy = Math.min(1, bands.level * 3.2)
    this.mixer.timeScale = playing ? 0.86 + energy * 0.44 : 0.24
    this.mixer.update(dt)
  }
}

export function createMiamiClubPack() {
  const names = pickPlayerNames(DANCER_ASSETS.length)
  return DANCER_ASSETS.map((asset, i) => new ClubAvatar(asset, names[i]))
}
