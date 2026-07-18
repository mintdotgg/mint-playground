import * as THREE from 'three'
import type { SkinDef, SkinCtx, SkinInstance } from './types'
import { makePlate, makeRingPlate, makeScrews, makeShadow } from '../kit/panels'
import { makeCanvasPanel, label, crosshair, dataRow, chip, roundRect } from '../kit/canvas2d'
import { PlaylistPanel, TransportBar } from '../kit/playlist'
import { SpectrumRing } from '../kit/viz'
import { placeAnchor, fallbackKnob } from '../kit/models'
import { topoTexture } from '../kit/proctex'
import { TRACKS, fmtTime } from '../audio/tracks'
import { damp } from '../tween'

// Ref 2 — orbital survey instrument on lab-gray. Black bezel ring, terrain
// viewport, "01 Atlas" info card wired to the current track.

export const ATLAS: SkinDef = {
  id: 'atlas',
  name: 'ATLAS',
  vibe: 'ORBITAL SURVEY',
  palette: {
    bgTop: 0x30464a,
    bgBot: 0x091114,
    ink: 0x0c0d0f,
    panel: 0x0e0f12,
    accent: 0xff5a2a,
    selector: 0x5c7377,
    selectorInk: 0xf6f5ef,
    light: true,
  },
  bloom: { strength: 0.28, threshold: 0.9 },
  disc: {
    pos: [0, -0.08, 0.2],
    scale: 0.98,
    style: { irid: 0.5, holo: 0, ink: 0, desat: 0, artAmt: 1 },
  },

  build(ctx: SkinCtx): SkinInstance {
    const g = new THREE.Group()
    const CY = -0.08

    const shadow = makeShadow(5.8, 5.4, 0.4)
    shadow.position.set(0, CY - 0.3, -0.4)
    g.add(shadow)

    // ---- terrain viewport behind the disc ----
    const topo = topoTexture({ size: 512, seed: 41 })
    const world = new THREE.Mesh(
      new THREE.CircleGeometry(1.74, 96),
      new THREE.MeshBasicMaterial({ map: topo }),
    )
    world.position.set(0, CY, -0.12)
    g.add(world)
    // atmosphere haze on the terrain edge
    const haze = makeRingPlate(1.4, 1.76, 0xaeb3b7, 0.55)
    haze.position.set(0, CY, -0.08)
    g.add(haze)

    // ---- segmented black bezel ----
    const bezelSegs: Array<[number, number]> = [
      [Math.PI * 0.16, Math.PI * 0.56],
      [Math.PI * 0.82, Math.PI * 0.5],
      [Math.PI * 1.42, Math.PI * 0.36],
      [Math.PI * 1.86, Math.PI * 0.22],
    ]
    for (const [start, len] of bezelSegs) {
      const seg = makeRingPlate(1.76, 2.12, 0x0e0f12, 1, start, len)
      seg.position.set(0, CY, -0.02)
      g.add(seg)
    }
    const thinRing = makeRingPlate(1.72, 1.76, 0x0e0f12, 0.9)
    thinRing.position.set(0, CY, -0.02)
    g.add(thinRing)

    // bezel furniture: ticks, numerals, crosses
    const furniture = makeCanvasPanel({
      w: 4.7,
      h: 4.7,
      ppu: 190,
      draw: (c, W, H) => {
        const cx = W / 2
        const cy = H / 2
        const R = W * 0.442
        for (let i = 0; i < 96; i++) {
          const a = (i / 96) * Math.PI * 2
          if (a > Math.PI * 0.62 && a < Math.PI * 0.8) continue
          const major = i % 8 === 0
          c.strokeStyle = major ? 'rgba(240,242,245,0.85)' : 'rgba(230,233,238,0.4)'
          c.lineWidth = major ? 2.5 : 1.2
          const l = major ? W * 0.016 : W * 0.008
          c.beginPath()
          c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
          c.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l))
          c.stroke()
        }
        label(c, 'X10', cx + R * 0.86, cy - R * 0.78, { size: W * 0.022, color: 'rgba(240,242,245,0.9)', ls: 2 })
        label(c, 'X55', cx - R * 1.02, cy + R * 0.6, { size: W * 0.022, color: 'rgba(14,15,18,0.75)', ls: 2 })
        label(c, '05', cx - R * 0.1, cy + R * 1.06, { size: W * 0.02, color: 'rgba(14,15,18,0.6)', mono: true })
        crosshair(c, cx + R * 0.55, cy + R * 0.92, W * 0.01, 'rgba(14,15,18,0.7)')
        crosshair(c, cx - R * 0.92, cy - R * 0.5, W * 0.01, 'rgba(240,242,245,0.8)')
        dataRow(c, cx + R * 0.72, cy + R * 0.75, W * 0.12, 55, 'rgba(14,15,18,0.55)', W * 0.011)
      },
    })
    furniture.mesh.position.set(0, CY, 0.06)
    furniture.mesh.renderOrder = 22
    g.add(furniture.mesh)

    const bezelScrews = makeScrews(
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.15
        return [Math.cos(a) * 1.94, CY + Math.sin(a) * 1.94, 0.02] as [number, number, number]
      }),
      0.055,
    )
    g.add(bezelScrews)

    // ---- knob cluster (generated model ×3) ----
    const knobPanel = makePlate({
      w: 1.7,
      h: 0.62,
      r: 0.14,
      color: 0x0e0f12,
      border: { color: 0x2a2d33, width: 0.014 },
    })
    knobPanel.position.set(0, CY + 2.28, 0.02)
    g.add(knobPanel)
    const knobs: THREE.Object3D[] = []
    ;[-0.5, 0, 0.5].forEach((x, i) => {
      const seat = makeRingPlate(0.16, 0.205, 0x50545c, 0.9)
      seat.position.set(x, CY + 2.32, 0.1)
      g.add(seat)
      const knob = placeAnchor(ctx.anchors.knob, fallbackKnob, {
        pos: [x, CY + 2.32, 0.16],
        scale: 0.75,
        rotZ: i * 1.3,
      })
      g.add(knob)
      knobs.push(knob)
    })
    const knobLabels = makeCanvasPanel({
      w: 1.7,
      h: 0.14,
      ppu: 300,
      draw: (c, W, H) => {
        ;['GAIN', 'ORBIT', 'BAND'].forEach((t, i) => {
          label(c, t, W * (0.21 + i * 0.295), H * 0.75, {
            size: H * 0.5,
            color: 'rgba(238,240,243,0.8)',
            ls: 2,
            align: 'center',
            weight: 700,
          })
        })
      },
    })
    knobLabels.mesh.position.set(0, CY + 2.02, 0.1)
    g.add(knobLabels.mesh)

    // ---- info card (current track) with leader line ----
    let cardAcc = 0
    const card = makeCanvasPanel({
      w: 1.95,
      h: 1.18,
      ppu: 320,
      draw: (c, W, H) => {
        const t = TRACKS[ctx.engine.trackIndex]
        // angled corner card
        c.fillStyle = '#0b0c0e'
        c.beginPath()
        const cut = H * 0.16
        c.moveTo(0, 0)
        c.lineTo(W - cut, 0)
        c.lineTo(W, cut)
        c.lineTo(W, H)
        c.lineTo(0, H)
        c.closePath()
        c.fill()
        c.strokeStyle = 'rgba(255,255,255,0.22)'
        c.lineWidth = 1.5
        c.stroke()
        label(c, `CLASS ${String.fromCharCode(65 + ctx.engine.trackIndex)}`, W * 0.06, H * 0.17, {
          size: H * 0.075,
          color: 'rgba(235,237,240,0.55)',
          ls: 3,
        })
        // tiny bars top-right
        for (let i = 0; i < 12; i++) {
          c.fillStyle = i % 3 === 0 ? 'rgba(255,90,42,0.9)' : 'rgba(255,255,255,0.35)'
          c.fillRect(W * 0.58 + i * W * 0.024, H * 0.09, W * 0.011, H * 0.06)
        }
        label(c, String(ctx.engine.trackIndex + 1).padStart(2, '0'), W * 0.06, H * 0.52, {
          size: H * 0.24,
          color: 'rgba(235,237,240,0.5)',
          weight: 300,
        })
        const heroWord = t.title.split(' ')[0]
        const heroSize = heroWord.length > 8 ? H * 0.19 : heroWord.length > 6 ? H * 0.225 : H * 0.26
        label(c, heroWord, W * 0.24, H * 0.52, {
          size: heroSize,
          color: '#ffffff',
          weight: 800,
        })
        label(c, t.artist, W * 0.24, H * 0.64, { size: H * 0.085, color: 'rgba(235,237,240,0.6)', ls: 2 })
        // live composition bars
        const rows: Array<[string, number]> = [
          ['BASS', ctx.engine.bands.bass],
          ['HIGH', ctx.engine.bands.high],
        ]
        rows.forEach(([name, v], i) => {
          const y = H * (0.76 + i * 0.115)
          label(c, name as string, W * 0.06, y, { size: H * 0.07, color: '#fff', ls: 2, weight: 700 })
          c.fillStyle = 'rgba(255,255,255,0.18)'
          c.fillRect(W * 0.3, y - H * 0.052, W * 0.56, H * 0.055)
          c.fillStyle = '#fff'
          c.fillRect(W * 0.3, y - H * 0.052, W * 0.56 * Math.min(1, (v as number) * 1.4), H * 0.055)
          label(c, `${Math.round((v as number) * 100)} %`, W * 0.945, y, {
            size: H * 0.065,
            color: 'rgba(235,237,240,0.8)',
            align: 'right',
            mono: true,
          })
        })
      },
    })
    card.mesh.position.set(1.98, CY + 1.42, 0.34)
    card.mesh.renderOrder = 23
    card.mesh.userData.cursor = 'pointer'
    card.mesh.userData.onTap = () => ctx.engine.next()
    ctx.addInteractive(card.mesh)
    g.add(card.mesh)

    // leader line from card to disc center
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(1.05, CY + 0.85, 0.3),
      new THREE.Vector3(1.3, CY + 1.1, 0.3),
      new THREE.Vector3(1.3, CY + 1.1, 0.3),
      new THREE.Vector3(1.02, CY + 1.42, 0.3),
    ])
    const leader = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x0c0d0f }))
    leader.renderOrder = 21
    g.add(leader)
    const leaderDot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), new THREE.MeshBasicMaterial({ color: 0x0c0d0f }))
    leaderDot.position.set(1.05, CY + 0.85, 0.31)
    g.add(leaderDot)

    // ---- timecode chip (left) ----
    let tcAcc = 0
    const tcChip = makeCanvasPanel({
      w: 1.34,
      h: 0.44,
      ppu: 320,
      draw: (c, W, H) => {
        c.fillStyle = '#0b0c0e'
        roundRect(c, 0, 0, W, H, 5)
        c.fill()
        c.strokeStyle = 'rgba(255,255,255,0.2)'
        c.lineWidth = 1.5
        c.stroke()
        // rec square blinks with the beat
        c.fillStyle = ctx.engine.playing && ctx.engine.bands.pulse > 0.25 ? '#ff5a2a' : 'rgba(255,90,42,0.35)'
        c.fillRect(W * 0.05, H * 0.28, H * 0.16, H * 0.16)
        label(c, ctx.engine.playing ? 'TRACKING' : 'STANDBY', W * 0.05, H * 0.83, {
          size: H * 0.16,
          color: 'rgba(235,237,240,0.55)',
          ls: 2,
        })
        label(c, fmtTime(ctx.engine.time), W * 0.32, H * 0.62, {
          size: H * 0.42,
          color: '#fff',
          mono: true,
          weight: 700,
        })
        label(c, String(Math.floor((ctx.engine.time % 1) * 60)).padStart(2, '0'), W * 0.93, H * 0.62, {
          size: H * 0.2,
          color: 'rgba(235,237,240,0.6)',
          mono: true,
          align: 'right',
        })
      },
    })
    tcChip.mesh.position.set(-2.24, CY + 0.5, 0.3)
    tcChip.mesh.renderOrder = 23
    tcChip.mesh.userData.cursor = 'pointer'
    tcChip.mesh.userData.onTap = () => ctx.engine.toggle()
    ctx.addInteractive(tcChip.mesh)
    g.add(tcChip.mesh)

    // ---- playlist ----
    const playlist = new PlaylistPanel(
      ctx.engine,
      {
        bg: '#0b0c0e',
        fg: '#f2f4f6',
        dim: '#7c828a',
        accent: '#ff5a2a',
        header: 'ATLAS-151',
      },
      1.66,
      1.62,
    )
    playlist.mesh.position.set(-1.98, CY - 1.06, 0.3)
    playlist.mesh.renderOrder = 23
    g.add(playlist.mesh)
    ctx.addInteractive(playlist.mesh)

    // ---- transport ----
    const transport = new TransportBar(ctx.engine, { fg: '#0c0d0f', ring: '#0c0d0f' }, 1.0, 0.3)
    transport.mesh.position.set(0, CY - 2.16, 0.2)
    g.add(transport.mesh)
    ctx.addInteractive(transport.mesh)

    // ---- mini gauge bottom-right ----
    const gaugeBase = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 48),
      new THREE.MeshBasicMaterial({ color: 0x0e0f12 }),
    )
    gaugeBase.position.set(2.14, CY - 1.42, 0.2)
    const needle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff5a2a }),
    )
    needle.geometry.translate(0, 0.13, 0)
    needle.position.set(2.14, CY - 1.42, 0.24)
    const gaugeRing = makeRingPlate(0.3, 0.325, 0xffffff, 0.7)
    gaugeRing.position.set(2.14, CY - 1.42, 0.22)
    g.add(gaugeBase, needle, gaugeRing)

    // corner tag
    const corner = makeCanvasPanel({
      w: 1.2,
      h: 0.5,
      ppu: 300,
      draw: (c, W, H) => {
        label(c, 'N°', W * 0.62, H * 0.32, { size: H * 0.2, color: 'rgba(12,13,15,0.5)' })
        label(c, '151', W * 0.98, H * 0.38, { size: H * 0.38, color: 'rgba(12,13,15,0.85)', align: 'right', weight: 300 })
        chip(c, 'JAN — 2089 ©', W * 0.35, H * 0.55, { size: H * 0.16, bg: 'rgba(12,13,15,0.85)', fg: '#e8eaed' })
      },
    })
    corner.mesh.position.set(1.9, CY - 2.1, 0.2)
    g.add(corner.mesh)

    // spectrum ring — dark bars on light bg, wrapping the bezel
    const spectrum = new SpectrumRing({
      radius: 2.24,
      color: 0xff6b42,
      barW: 0.013,
      barLen: 0.12,
      opacity: 0.78,
    })
    spectrum.group.position.set(0, CY, 0.1)
    g.add(spectrum.group)

    let needleV = 0
    return {
      group: g,
      update(dt, t) {
        spectrum.update(ctx.engine, dt)
        cardAcc += dt
        if (cardAcc > 0.12) {
          cardAcc = 0
          card.redraw()
        }
        tcAcc += dt
        if (tcAcc > 0.1) {
          tcAcc = 0
          tcChip.redraw()
        }
        needleV = damp(needleV, ctx.engine.bands.level, 8, dt)
        needle.rotation.z = 1.9 - needleV * 3.4 + Math.sin(t * 9) * ctx.engine.bands.pulse * 0.08
        knobs.forEach((k, i) => {
          if (ctx.engine.playing) k.rotation.z += dt * (0.4 + i * 0.25) * (0.3 + ctx.engine.bands.mid)
        })
        world.rotation.z += dt * 0.02
      },
      dispose() {},
    }
  },
}
