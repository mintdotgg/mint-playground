import * as THREE from 'three'
import type { SkinCtx, SkinDef, SkinInstance } from './types'
import { SKINS } from './index'
import { tweens, easings, lerp } from '../tween'
import { rememberOpacity, setTreeOpacity, disposeTree } from '../kit/panels'
import type { DiscRig, DiscStyle } from '../kit/disc'
import { DeviceChassis } from '../kit/chassis'

export interface SkinHooks {
  onSkin: (def: SkinDef) => void
  resetInteractives: () => void
}

/**
 * Owns the active skin: builds, staggers layers in/out like a deck of
 * printed plates being restacked, and glides the shared disc between rigs.
 */
export class SkinManager {
  current: SkinInstance | null = null
  def: SkinDef = SKINS[0]
  private outgoing: THREE.Group[] = []
  private discStyle: DiscStyle = { ...SKINS[0].disc.style }

  constructor(
    private parent: THREE.Group,
    private ctx: SkinCtx,
    private disc: DiscRig,
    private hooks: SkinHooks,
  ) {}

  switchTo(id: string, instant = false) {
    const def = SKINS.find((s) => s.id === id)
    if (!def || (this.current && def.id === this.def.id)) return
    this.def = def

    // ---- retire old skin ----
    if (this.current) {
      const old = this.current.group
      this.outgoing.push(old)
      this.current = null
      const layers = [...old.children]
      layers.forEach((layer, i) => {
        const startZ = layer.position.z
        tweens.add({
          duration: 0.26,
          delay: i * 0.016,
          ease: easings.inCubic,
          onUpdate: (v) => {
            layer.position.z = startZ - v * 0.85
            if (!layer.userData.anchor) setTreeOpacity(layer, 1 - v)
            else layer.scale.setScalar(Math.max(0.001, 1 - v))
          },
        })
      })
      tweens.add({
        duration: 0.26 + layers.length * 0.016 + 0.05,
        onUpdate: () => undefined,
        onComplete: () => {
          this.parent.remove(old)
          disposeTree(old)
          this.outgoing = this.outgoing.filter((g) => g !== old)
        },
      })
    }

    // ---- build new skin ----
    this.hooks.resetInteractives()
    const inst = def.build(this.ctx)
    const chassis = new DeviceChassis(def, this.ctx.engine, this.ctx.anchors)
    inst.group.add(chassis.group)
    const skinUpdate = inst.update.bind(inst)
    inst.update = (dt, t) => {
      chassis.update(dt, t)
      skinUpdate(dt, t)
    }
    this.current = inst
    this.parent.add(inst.group)

    const layers = [...inst.group.children]
    layers.forEach((layer, i) => {
      rememberOpacity(layer)
      const targetZ = layer.position.z
      const anchor = Boolean(layer.userData.anchor)
      if (instant) return
      if (anchor) {
        const s = layer.scale.x
        layer.scale.setScalar(0.001)
        tweens.add({
          duration: 0.5,
          delay: 0.16 + i * 0.028,
          ease: easings.outBack,
          onUpdate: (v) => layer.scale.setScalar(Math.max(0.001, s * v)),
        })
      } else {
        layer.position.z = targetZ + 1.15
        setTreeOpacity(layer, 0)
        tweens.add({
          duration: 0.55,
          delay: 0.1 + i * 0.03,
          ease: easings.outExpo,
          onUpdate: (v) => {
            layer.position.z = lerp(targetZ + 1.15, targetZ, v)
            setTreeOpacity(layer, v)
          },
        })
      }
    })

    // ---- glide the disc ----
    const dg = this.disc.group
    const fromPos = dg.position.clone()
    const fromScale = dg.scale.x
    const [tx, ty, tz] = def.disc.pos
    const fromStyle = { ...this.discStyle }
    const toStyle = def.disc.style
    if (instant) {
      dg.position.set(tx, ty, tz)
      dg.scale.setScalar(def.disc.scale)
      this.disc.setStyle(toStyle)
      this.discStyle = { ...toStyle }
    } else {
      tweens.add({
        duration: 0.75,
        ease: easings.inOutCubic,
        onUpdate: (v) => {
          dg.position.set(lerp(fromPos.x, tx, v), lerp(fromPos.y, ty, v), lerp(fromPos.z, tz, v))
          dg.scale.setScalar(lerp(fromScale, def.disc.scale, v))
          this.discStyle = {
            irid: lerp(fromStyle.irid, toStyle.irid, v),
            holo: lerp(fromStyle.holo, toStyle.holo, v),
            ink: lerp(fromStyle.ink, toStyle.ink, v),
            desat: lerp(fromStyle.desat, toStyle.desat, v),
            artAmt: lerp(fromStyle.artAmt, toStyle.artAmt, v),
          }
          this.disc.setStyle(this.discStyle)
        },
      })
    }

    this.hooks.onSkin(def)
  }

  next(dir: 1 | -1 = 1) {
    const i = SKINS.findIndex((s) => s.id === this.def.id)
    const n = (i + dir + SKINS.length) % SKINS.length
    this.switchTo(SKINS[n].id)
  }

  update(dt: number, t: number) {
    this.current?.update(dt, t)
  }
}
