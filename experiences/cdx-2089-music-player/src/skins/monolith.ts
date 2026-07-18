import * as THREE from 'three'
import type { SkinDef, SkinCtx, SkinInstance } from './types'
import { makePlate, makeGlassDisc, makeRingPlate, makeScrews, makeShadow } from '../kit/panels'
import { makeCanvasPanel, label, dataRow, barcode } from '../kit/canvas2d'
import { PlaylistPanel, TransportBar, TimecodePanel } from '../kit/playlist'
import { SpectrumRing, LedCluster } from '../kit/viz'
import { placeAnchor, fallbackRail } from '../kit/models'
import { metalTexture } from '../kit/proctex'

// Ref 1 — matte-black armored CD deck. Playlist tower on the left,
// huge disc bay behind smoked glass on the right.

const DISC_X = 0.62

export const MONOLITH: SkinDef = {
  id: 'monolith',
  name: 'MONOLITH',
  vibe: 'STEALTH DECK',
  palette: {
    bgTop: 0x182331,
    bgBot: 0x030609,
    ink: 0xe8eaed,
    panel: 0x0d0e11,
    accent: 0xe8eaed,
    selector: 0x262c35,
    selectorInk: 0xf2f5f7,
    light: false,
  },
  bloom: { strength: 0.55, threshold: 0.87 },
  disc: {
    pos: [DISC_X, 0, 0.16],
    scale: 1.12,
    style: { irid: 0.38, holo: 0, ink: 0, desat: 0.2, artAmt: 1 },
  },

  build(ctx: SkinCtx): SkinInstance {
    const g = new THREE.Group()
    const metal = metalTexture(256, 5, '#33363c')

    // grounding shadow
    const shadow = makeShadow(6.4, 5.2, 0.55)
    shadow.position.set(0, -0.25, -0.4)
    g.add(shadow)

    // ---- disc bay ----
    const bayBase = new THREE.Mesh(
      new THREE.CircleGeometry(1.66, 96),
      new THREE.MeshBasicMaterial({ color: 0x0a0b0d }),
    )
    bayBase.position.set(DISC_X, 0, -0.1)
    const bayWall = makeRingPlate(1.42, 1.66, 0x16181d)
    bayWall.position.set(DISC_X, 0, -0.04)
    g.add(bayBase, bayWall)

    // bezel furniture ring (ticks + arc text)
    const bezel = makeCanvasPanel({
      w: 3.6,
      h: 3.6,
      ppu: 200,
      draw: (c, W, H) => {
        const cx = W / 2
        const cy = H / 2
        const R = W * 0.478
        c.strokeStyle = 'rgba(220,225,232,0.5)'
        c.lineWidth = 2
        c.beginPath()
        c.arc(cx, cy, R, 0, Math.PI * 2)
        c.stroke()
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2
          const l = i % 6 === 0 ? W * 0.018 : W * 0.008
          c.strokeStyle = i % 6 === 0 ? 'rgba(230,233,238,0.6)' : 'rgba(160,165,172,0.35)'
          c.lineWidth = i % 6 === 0 ? 2.5 : 1.5
          c.beginPath()
          c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
          c.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l))
          c.stroke()
        }
        // arc text
        const put = (text: string, a0: number) => {
          c.save()
          c.translate(cx, cy)
          c.rotate(a0)
          c.font = `700 ${W * 0.016}px "Helvetica Neue", Arial`
          c.fillStyle = 'rgba(210,214,220,0.75)'
          for (const ch of text) {
            c.save()
            c.translate(0, -R * 1.035)
            c.fillText(ch, -W * 0.005, 0)
            c.restore()
            c.rotate(0.032)
          }
          c.restore()
        }
        put('CD RENDER CONCEPT 09', -Math.PI * 0.42)
        put('CDX-2089 · 700MB · 74:00', Math.PI * 0.52)
      },
    })
    bezel.mesh.position.set(DISC_X, 0, 0.4)
    bezel.mesh.renderOrder = 22
    g.add(bezel.mesh)

    // ---- grip rails around the bay (generated model, cloned) ----
    const railAngles = [0.9, 0.0, -0.9]
    for (const a of railAngles) {
      const rail = placeAnchor(ctx.anchors.rail, fallbackRail, {
        pos: [DISC_X + Math.cos(a) * 1.86, Math.sin(a) * 1.86, 0.1],
        scale: 0.62,
        rotZ: a + Math.PI / 2,
      })
      g.add(rail)
    }
    const railTop = placeAnchor(ctx.anchors.rail, fallbackRail, {
      pos: [-1.55, 1.92, 0.1],
      scale: 0.55,
    })
    const railBot = placeAnchor(ctx.anchors.rail, fallbackRail, {
      pos: [-1.55, -1.92, 0.1],
      scale: 0.55,
    })
    g.add(railTop, railBot)

    // ---- left tower ----
    const tower = makePlate({
      w: 2.0,
      h: 3.6,
      r: 0.1,
      color: 0x0d0e11,
      border: { color: 0x272a30, width: 0.018 },
      texture: metal,
      texAmt: 0.35,
      texScale: [2, 4],
      grain: 0.02,
    })
    tower.position.set(-1.55, 0, 0.02)
    const towerInner = makePlate({
      w: 1.84,
      h: 3.42,
      r: 0.07,
      color: 0x0a0b0e,
      border: { color: 0x1c1f24, width: 0.012 },
    })
    towerInner.position.set(-1.55, 0, 0.08)
    g.add(tower, towerInner)
    const screws = makeScrews(
      [
        [-2.42, 1.68, 0.12],
        [-0.68, 1.68, 0.12],
        [-2.42, -1.68, 0.12],
        [-0.68, -1.68, 0.12],
      ],
      0.07,
    )
    g.add(screws)

    // playlist
    const playlist = new PlaylistPanel(
      ctx.engine,
      {
        bg: '#07080a',
        fg: '#e8eaed',
        dim: '#71767e',
        accent: '#e8eaed',
        header: 'CDX-2089',
        border: '#22252b',
      },
      1.7,
      2.34,
    )
    playlist.mesh.position.set(-1.55, 0.42, 0.16)
    g.add(playlist.mesh)
    ctx.addInteractive(playlist.mesh)

    // timecode + transport
    const timecode = new TimecodePanel(
      ctx.engine,
      { fg: '#e8eaed', dim: '#71767e', bg: '#07080a', accent: '#e8eaed' },
      { w: 1.7, h: 0.42, labelText: 'ELAPSED // TOTAL' },
    )
    timecode.mesh.position.set(-1.55, -1.02, 0.16)
    g.add(timecode.mesh)
    ctx.addInteractive(timecode.mesh)

    const transport = new TransportBar(ctx.engine, { fg: '#e8eaed', ring: '#3a3e45' }, 1.1, 0.34)
    transport.mesh.position.set(-1.55, -1.5, 0.16)
    g.add(transport.mesh)
    ctx.addInteractive(transport.mesh)

    const leds = new LedCluster([0xffffff, 0x9fe8ff, 0xff4d1f], 0.022, 0.08)
    leds.group.position.set(-2.28, -1.5, 0.16)
    g.add(leds.group)

    // serial footer
    const serial = makeCanvasPanel({
      w: 1.7,
      h: 0.16,
      ppu: 300,
      draw: (c, W, H) => {
        dataRow(c, 0, H * 0.7, W * 0.6, 91, 'rgba(160,166,174,0.7)', H * 0.42)
        barcode(c, W * 0.68, H * 0.15, W * 0.3, H * 0.7, 17, 'rgba(200,205,212,0.8)')
      },
    })
    serial.mesh.position.set(-1.55, -1.74, 0.16)
    g.add(serial.mesh)

    // ---- smoked glass window over the disc ----
    const glass = makeGlassDisc(1.42, 0x07080a, 0.38)
    glass.position.set(DISC_X, 0, 0.46)
    glass.renderOrder = 24
    g.add(glass)
    const glassBezel = makeRingPlate(1.36, 1.44, 0x1a1d22)
    glassBezel.position.set(DISC_X, 0, 0.47)
    glassBezel.renderOrder = 25
    g.add(glassBezel)
    const bezelScrews = makeScrews(
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.26
        return [DISC_X + Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0.48] as [number, number, number]
      }),
      0.06,
    )
    bezelScrews.renderOrder = 26
    g.add(bezelScrews)

    // spectrum ring — the constant heartbeat
    const spectrum = new SpectrumRing({
      radius: 1.72,
      color: 0xdfe3e8,
      barW: 0.014,
      barLen: 0.14,
      opacity: 0.85,
    })
    spectrum.group.position.set(DISC_X, 0, 0.34)
    g.add(spectrum.group)

    // top caption
    const caption = makeCanvasPanel({
      w: 3.2,
      h: 0.2,
      ppu: 300,
      draw: (c, W, H) => {
        label(c, 'CONCEPTUAL DISC SYSTEM — UNIT 01 / MONOLITH', 0, H * 0.68, {
          size: H * 0.4,
          color: 'rgba(190,195,203,0.65)',
          ls: 3,
          weight: 700,
        })
      },
    })
    caption.mesh.position.set(0.8, 2.06, 0.2)
    g.add(caption.mesh)

    return {
      group: g,
      update(dt) {
        spectrum.update(ctx.engine, dt)
        timecode.update(dt)
        leds.update(ctx.engine, dt)
      },
      dispose() {
        /* geometry/material disposal handled by manager */
      },
    }
  },
}
