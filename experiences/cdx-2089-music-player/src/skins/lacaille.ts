import * as THREE from 'three'
import type { SkinDef, SkinCtx, SkinInstance } from './types'
import { makeRingPlate, makeShadow, makeScrews } from '../kit/panels'
import { makeCanvasPanel, label, dataRow, ticksArc } from '../kit/canvas2d'
import { PlaylistPanel, makeNameplate } from '../kit/playlist'
import { SpectrumRing } from '../kit/viz'
import { placeAnchor, fallbackKnob } from '../kit/models'
import { marsTexture } from '../kit/proctex'
import { TRACKS, fmtTime } from '../audio/tracks'
import { damp } from '../tween'

// Ref 3 — expedition instrument on warm cream. Rust-orange planet viewport,
// giant white nameplate, arc of knobs, circular waveform emblem.

export const LACAILLE: SkinDef = {
  id: 'lacaille',
  name: 'LACAILLE',
  vibe: 'PLANETARY PRESS',
  palette: {
    bgTop: 0x5a2a1e,
    bgBot: 0x160907,
    ink: 0x141414,
    panel: 0x101114,
    accent: 0xe8551e,
    selector: 0xe8551e,
    selectorInk: 0xfff4e7,
    light: true,
  },
  bloom: { strength: 0.2, threshold: 0.92 },
  disc: {
    pos: [0.15, 0.12, 0.2],
    scale: 1.02,
    style: { irid: 0.48, holo: 0, ink: 0, desat: 0, artAmt: 1 },
  },

  build(ctx: SkinCtx): SkinInstance {
    const g = new THREE.Group()
    const CX = 0.15
    const CY = 0.12

    const shadow = makeShadow(6.0, 5.4, 0.35)
    shadow.position.set(CX, CY - 0.4, -0.4)
    g.add(shadow)

    // ---- planet viewport ----
    const mars = new THREE.Mesh(
      new THREE.CircleGeometry(1.72, 96),
      new THREE.MeshBasicMaterial({ map: marsTexture(512, 77) }),
    )
    mars.position.set(CX, CY, -0.12)
    g.add(mars)
    const marsRim = makeRingPlate(1.66, 1.74, 0x101114, 0.9)
    marsRim.position.set(CX, CY, -0.06)
    g.add(marsRim)

    // ---- chunky black bezel arcs ----
    const arcs: Array<[number, number, number]> = [
      // start, length, outer radius
      [Math.PI * 0.34, Math.PI * 0.4, 2.06],
      [Math.PI * 0.98, Math.PI * 0.62, 2.3],
      [Math.PI * 1.72, Math.PI * 0.2, 2.0],
      [-Math.PI * 0.12, Math.PI * 0.3, 2.14],
    ]
    for (const [start, len, rOut] of arcs) {
      const seg = makeRingPlate(1.74, rOut, 0x101114, 1, start, len)
      seg.position.set(CX, CY, 0)
      g.add(seg)
    }

    // arc tick furniture
    const furniture = makeCanvasPanel({
      w: 5.0,
      h: 5.0,
      ppu: 180,
      draw: (c, W, H) => {
        const cx = W / 2
        const cy = H / 2
        ticksArc(c, cx, cy, W * 0.404, Math.PI * 0.36, Math.PI * 0.72, 30, W * 0.009, 'rgba(240,240,238,0.7)', 2, 1)
        ticksArc(c, cx, cy, W * 0.442, -Math.PI * 0.1, Math.PI * 0.16, 12, W * 0.008, 'rgba(20,20,20,0.6)', 2, 1)
        label(c, 'TIME TO SPIN ON AXIS — 243 DAYS', cx - W * 0.31, cy - W * 0.395, {
          size: W * 0.014,
          color: 'rgba(240,240,238,0.75)',
          ls: 2.5,
        })
        label(c, '88.33 CH 627', cx + W * 0.16, cy + W * 0.43, {
          size: W * 0.014,
          color: 'rgba(20,20,20,0.55)',
          ls: 2,
          mono: true,
        })
        dataRow(c, cx - W * 0.44, cy + W * 0.31, W * 0.1, 23, 'rgba(20,20,20,0.5)', W * 0.011)
      },
    })
    furniture.mesh.position.set(CX, CY, 0.08)
    furniture.mesh.renderOrder = 22
    g.add(furniture.mesh)

    // ---- knob arc (bottom-left, generated model ×5) ----
    const knobs: THREE.Object3D[] = []
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.08 + i * 0.11)
      const kx = CX + Math.cos(a) * 2.0
      const ky = CY + Math.sin(a) * 2.0
      const knob = placeAnchor(ctx.anchors.knob, fallbackKnob, {
        pos: [kx, ky, 0.12],
        scale: 0.72,
        rotZ: a,
      })
      g.add(knob)
      knobs.push(knob)
      const ring = makeRingPlate(0.19, 0.215, 0xf3f0e8, 0.5)
      ring.position.set(kx, ky, 0.06)
      g.add(ring)
    }

    // ---- circular waveform scope (mid-left), canvas so the line is thick ----
    let scopeAcc = 0
    const scope = makeCanvasPanel({
      w: 1.18,
      h: 1.18,
      ppu: 300,
      draw: (c, W, H) => {
        const cx = W / 2
        const cy = H / 2
        c.fillStyle = '#fdfdfb'
        c.beginPath()
        c.arc(cx, cy, W * 0.48, 0, Math.PI * 2)
        c.fill()
        c.strokeStyle = '#101114'
        c.lineWidth = W * 0.045
        c.beginPath()
        c.arc(cx, cy, W * 0.455, 0, Math.PI * 2)
        c.stroke()
        // circular oscilloscope
        c.lineWidth = W * 0.012
        c.beginPath()
        const N = 140
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2
          const w = (ctx.engine.wave[Math.floor(((i % N) / N) * 1024)] - 128) / 128
          const r = W * 0.27 + w * W * 0.15 * (ctx.engine.playing ? 1 : 0.12)
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r
          if (i === 0) c.moveTo(x, y)
          else c.lineTo(x, y)
        }
        c.stroke()
        c.fillStyle = '#e8551e'
        c.beginPath()
        c.arc(cx, cy, W * 0.02, 0, Math.PI * 2)
        c.fill()
      },
    })
    scope.mesh.position.set(-1.98, CY + 0.6, 0.24)
    g.add(scope.mesh)
    const emblemLabel = makeCanvasPanel({
      w: 1.3,
      h: 0.18,
      ppu: 300,
      draw: (c, W, H) => {
        label(c, '07 — AUDIO SIGNATURE', W * 0.5, H * 0.7, {
          size: H * 0.44,
          color: 'rgba(20,20,20,0.7)',
          ls: 2,
          align: 'center',
          weight: 700,
        })
      },
    })
    emblemLabel.mesh.position.set(-1.98, CY + 1.38, 0.22)
    g.add(emblemLabel.mesh)

    // ---- giant nameplate (current track) ----
    const nameplate = makeNameplate({
      w: 2.7,
      h: 0.85,
      bg: '#fbfaf6',
      fg: '#111111',
      getTitle: () => {
        const t = TRACKS[ctx.engine.trackIndex]
        return {
          big: t.title.charAt(0) + t.title.slice(1).toLowerCase(),
          small: String(49 + ctx.engine.trackIndex) + '.21',
          index: t.artist,
        }
      },
    })
    nameplate.mesh.position.set(1.72, CY - 0.72, 0.4)
    nameplate.mesh.renderOrder = 24
    nameplate.mesh.userData.cursor = 'pointer'
    nameplate.mesh.userData.onTap = () => ctx.engine.toggle()
    ctx.addInteractive(nameplate.mesh)
    g.add(nameplate.mesh)
    ctx.engine.on('track', () => nameplate.redraw())

    // two data rows under nameplate — prev / next track, clickable
    const rowFor = (offset: number) =>
      makeCanvasPanel({
        w: 1.85,
        h: 0.24,
        ppu: 320,
        draw: (c, W, H) => {
          const n = TRACKS.length
          const idx = (ctx.engine.trackIndex + offset + n) % n
          const t = TRACKS[idx]
          c.fillStyle = '#101114'
          c.fillRect(0, 0, W, H)
          label(c, (offset > 0 ? 'NEXT — ' : 'PREV — ') + t.title, W * 0.04, H * 0.66, {
            size: H * 0.36,
            color: '#f2f0ea',
            ls: 1.5,
            weight: 700,
          })
          label(c, fmtTime(ctx.engine.durations[idx]), W * 0.96, H * 0.66, {
            size: H * 0.34,
            color: 'rgba(242,240,234,0.6)',
            mono: true,
            align: 'right',
          })
        },
      })
    const nextRow = rowFor(1)
    nextRow.mesh.position.set(2.14, CY - 1.32, 0.4)
    nextRow.mesh.renderOrder = 24
    nextRow.mesh.userData.cursor = 'pointer'
    nextRow.mesh.userData.onTap = () => ctx.engine.next()
    ctx.addInteractive(nextRow.mesh)
    const prevRow = rowFor(-1)
    prevRow.mesh.position.set(2.14, CY - 1.62, 0.4)
    prevRow.mesh.renderOrder = 24
    prevRow.mesh.userData.cursor = 'pointer'
    prevRow.mesh.userData.onTap = () => ctx.engine.prev()
    ctx.addInteractive(prevRow.mesh)
    g.add(nextRow.mesh, prevRow.mesh)
    ctx.engine.on('track', () => {
      nextRow.redraw()
      prevRow.redraw()
    })
    ctx.engine.on('durations', () => {
      nextRow.redraw()
      prevRow.redraw()
    })

    // ---- playlist (top-right, printed on the paper) ----
    const playlist = new PlaylistPanel(
      ctx.engine,
      {
        bg: '#f3f0e8',
        fg: '#141414',
        dim: '#8d8778',
        accent: '#e8551e',
        header: 'LACAILLE V21',
        transparentBg: true,
      },
      1.7,
      1.5,
    )
    playlist.mesh.position.set(2.0, CY + 1.28, 0.3)
    g.add(playlist.mesh)
    ctx.addInteractive(playlist.mesh)

    // ---- orange timecode chip ----
    let tcAcc = 0
    const tc = makeCanvasPanel({
      w: 1.0,
      h: 0.38,
      ppu: 320,
      draw: (c, W, H) => {
        c.fillStyle = '#e8551e'
        c.fillRect(0, 0, W, H)
        label(c, fmtTime(ctx.engine.time), W * 0.07, H * 0.66, {
          size: H * 0.44,
          color: '#fff',
          mono: true,
          weight: 700,
        })
        label(c, ctx.engine.playing ? 'PLAY' : 'HOLD', W * 0.94, H * 0.64, {
          size: H * 0.2,
          color: 'rgba(255,255,255,0.85)',
          align: 'right',
          ls: 1.5,
        })
      },
    })
    tc.mesh.position.set(-2.28, CY - 1.7, 0.3)
    tc.mesh.userData.cursor = 'pointer'
    tc.mesh.userData.onTap = () => ctx.engine.toggle()
    ctx.addInteractive(tc.mesh)
    g.add(tc.mesh)

    // date chips top-left
    const dateChips = makeCanvasPanel({
      w: 1.5,
      h: 0.5,
      ppu: 300,
      draw: (c, W, H) => {
        label(c, 'WED —', 0, H * 0.3, { size: H * 0.26, color: '#e8551e', weight: 700 })
        label(c, '17 JULY', 0, H * 0.62, { size: H * 0.26, color: '#e8551e', weight: 700 })
        label(c, '2089', W * 0.98, H * 0.3, { size: H * 0.26, color: '#e8551e', weight: 700, align: 'right' })
      },
    })
    dateChips.mesh.position.set(-2.16, CY + 1.98, 0.2)
    g.add(dateChips.mesh)

    // ---- satellite gauge bottom-right ----
    const sat = new THREE.Group()
    const satBase = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48), new THREE.MeshBasicMaterial({ color: 0x101114 }))
    const satArc = makeRingPlate(0.3, 0.4, 0xe8551e, 1, Math.PI * 0.2, Math.PI * 1.1)
    satArc.position.z = 0.02
    const satTicks = makeCanvasPanel({
      w: 1.1,
      h: 1.1,
      ppu: 240,
      draw: (c, W, H) => {
        ticksArc(c, W / 2, H / 2, W * 0.46, 0, Math.PI * 2, 24, W * 0.02, 'rgba(20,20,20,0.6)', 1.5, 1)
        label(c, '42', W * 0.5, H * 0.54, { size: W * 0.14, color: '#fff', align: 'center', weight: 700 })
      },
    })
    satTicks.mesh.position.z = 0.04
    const satNeedle = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.34), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    satNeedle.geometry.translate(0, 0.15, 0)
    satNeedle.position.z = 0.05
    sat.add(satBase, satArc, satTicks.mesh, satNeedle)
    sat.position.set(2.35, CY - 2.0, 0.24)
    sat.scale.setScalar(0.9)
    g.add(sat)

    const screws = makeScrews(
      [
        [CX - 2.2, CY + 1.35, 0.06],
        [CX + 1.9, CY + 2.0, 0.06],
        [CX - 1.4, CY - 2.15, 0.06],
      ],
      0.05,
    )
    g.add(screws)

    // spectrum ring in signal orange
    const spectrum = new SpectrumRing({
      radius: 2.2,
      color: 0xe8551e,
      barW: 0.014,
      barLen: 0.13,
      opacity: 0.85,
    })
    spectrum.group.position.set(CX, CY, 0.1)
    g.add(spectrum.group)

    let needleV = 0
    let satPulse = 1
    return {
      group: g,
      update(dt, t) {
        spectrum.update(ctx.engine, dt)
        scopeAcc += dt
        if (scopeAcc > 0.05) {
          scopeAcc = 0
          scope.redraw()
        }
        tcAcc += dt
        if (tcAcc > 0.12) {
          tcAcc = 0
          tc.redraw()
        }
        needleV = damp(needleV, ctx.engine.bands.mid, 7, dt)
        satNeedle.rotation.z = 0.8 - needleV * 2.6
        satPulse = damp(satPulse, 1 + ctx.engine.bands.pulse * 0.1, 10, dt)
        sat.scale.setScalar(0.9 * satPulse)
        knobs.forEach((k, i) => {
          if (ctx.engine.playing) k.rotation.z += dt * (0.3 + i * 0.14) * (0.25 + ctx.engine.bands.bass)
        })
        mars.rotation.z -= dt * 0.018
        void t
      },
      dispose() {},
    }
  },
}
