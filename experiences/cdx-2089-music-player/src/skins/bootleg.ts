import * as THREE from 'three'
import type { SkinDef, SkinCtx, SkinInstance } from './types'
import { makePlate, makeScrews, makeShadow } from '../kit/panels'
import { makeCanvasPanel, label, dataRow, barcode, roundRect, SANS } from '../kit/canvas2d'
import { PlaylistPanel, TransportBar, TimecodePanel } from '../kit/playlist'
import { SpectrumRing } from '../kit/viz'
import { zineTexture } from '../kit/proctex'
import { TRACKS } from '../audio/tracks'
import { damp } from '../tween'

// Ref 5 — bootleg pressing plant: huge halftone-printed disc, klein-blue
// spec plates, red RESTRICTED sticker, barcodes and rights-reserved noise.

export const BOOTLEG: SkinDef = {
  id: 'bootleg',
  name: 'BOOTLEG',
  vibe: 'PRESS PLANT',
  palette: {
    bgTop: 0x17246b,
    bgBot: 0x040817,
    ink: 0x101010,
    panel: 0x2231e8,
    accent: 0xd8261b,
    selector: 0x2231e8,
    selectorInk: 0xffffff,
    light: true,
  },
  bloom: { strength: 0.22, threshold: 0.92 },
  disc: {
    pos: [0.55, 0.02, 0.14],
    scale: 1.32,
    style: { irid: 0.3, holo: 0, ink: 0.85, desat: 0, artAmt: 1 },
  },

  build(ctx: SkinCtx): SkinInstance {
    const g = new THREE.Group()
    const CX = 0.55
    const CY = 0.02

    const shadow = makeShadow(6.4, 5.6, 0.28)
    shadow.position.set(0, -0.3, -0.42)
    g.add(shadow)

    // ---- paper sheet behind ----
    const paper = makePlate({
      w: 5.3,
      h: 4.1,
      r: 0.02,
      color: 0xefece5,
      texture: zineTexture({ size: 512, seed: 3, fg: '#c9c4b8', bg: '#efece5' }),
      texAmt: 0.25,
      texScale: [2, 1.6],
      grain: 0.015,
    })
    paper.position.set(0, 0, -0.26)
    g.add(paper)

    // giant outline wordmark across the top
    const wordmark = makeCanvasPanel({
      w: 4.9,
      h: 0.9,
      ppu: 300,
      draw: (c, W, H) => {
        c.save()
        c.font = `900 ${H * 0.74}px ${SANS}`
        c.lineJoin = 'round'
        c.strokeStyle = '#101010'
        c.lineWidth = H * 0.02
        c.textAlign = 'left'
        try {
          ;(c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${H * 0.08}px`
        } catch {
          /* noop */
        }
        c.strokeText('HOT DRUM', W * 0.01, H * 0.72)
        c.fillStyle = '#101010'
        c.font = `900 ${H * 0.22}px ${SANS}`
        c.fillText('™', W * 0.88, H * 0.3)
        c.restore()
        label(c, 'UNOFFICIAL PRESSING · 2089 · 74 MIN · STEREO', W * 0.012, H * 0.94, {
          size: H * 0.11,
          color: 'rgba(16,16,16,0.75)',
          ls: 3,
          weight: 700,
        })
      },
    })
    wordmark.mesh.position.set(0, 1.72, 0.05)
    g.add(wordmark.mesh)

    // ---- klein blue spec plate (top-left), wired to current track ----
    const blue = makePlate({
      w: 2.4,
      h: 1.12,
      r: 0.05,
      color: 0x2231e8,
      grain: 0.02,
    })
    blue.position.set(-1.42, 0.98, 0.32)
    const blueLabel = makeCanvasPanel({
      w: 2.4,
      h: 1.12,
      ppu: 320,
      draw: (c, W, H) => {
        const t = TRACKS[ctx.engine.trackIndex]
        c.strokeStyle = 'rgba(255,255,255,0.9)'
        c.lineWidth = 2
        c.strokeRect(W * 0.025, H * 0.06, W * 0.95, H * 0.88)
        label(c, 'UNDER 17 REQUIRES ACCOMPANYING PARENT OR ADULT GUARDIAN', W * 0.05, H * 0.15, {
          size: H * 0.05,
          color: 'rgba(255,255,255,0.85)',
          ls: 1,
        })
        // fit the title left of the BPM block
        c.save()
        c.font = `900 ${H * 0.24}px ${SANS}`
        let ts = H * 0.24
        while (ts > H * 0.1 && c.measureText(t.title).width > W * 0.6) {
          ts -= H * 0.015
          c.font = `900 ${ts}px ${SANS}`
        }
        c.restore()
        label(c, t.title, W * 0.05, H * 0.52, {
          size: ts,
          color: '#ffffff',
          weight: 900,
          ls: 1,
        })
        label(c, t.artist, W * 0.05, H * 0.68, { size: H * 0.09, color: 'rgba(255,255,255,0.9)', ls: 3, weight: 700 })
        // big BPM block
        label(c, String(t.bpm), W * 0.95, H * 0.5, {
          size: H * 0.3,
          color: '#fff',
          align: 'right',
          weight: 900,
        })
        label(c, 'BPM', W * 0.95, H * 0.62, { size: H * 0.08, color: 'rgba(255,255,255,0.85)', align: 'right', ls: 2 })
        dataRow(c, W * 0.05, H * 0.85, W * 0.4, 47, 'rgba(255,255,255,0.7)', H * 0.055)
        label(c, 'ALL RIGHTS RESERVED.', W * 0.05, H * 0.93, { size: H * 0.055, color: 'rgba(255,255,255,0.85)', ls: 1.5 })
        barcode(c, W * 0.66, H * 0.78, W * 0.28, H * 0.13, 12, 'rgba(255,255,255,0.95)')
      },
    })
    blueLabel.mesh.position.set(-1.42, 0.98, 0.34)
    g.add(blue, blueLabel.mesh)
    blueLabel.mesh.userData.cursor = 'pointer'
    blueLabel.mesh.userData.onTap = () => ctx.engine.next()
    ctx.addInteractive(blueLabel.mesh)
    ctx.engine.on('track', () => blueLabel.redraw())
    const blueScrews = makeScrews(
      [
        [-2.56, 1.48, 0.36],
        [-0.28, 1.48, 0.36],
        [-2.56, 0.48, 0.36],
        [-0.28, 0.48, 0.36],
      ],
      0.05,
    )
    g.add(blueScrews)

    // ---- vertical blue strip (right edge) ----
    const strip = makePlate({ w: 0.46, h: 2.7, r: 0.03, color: 0x2231e8 })
    strip.position.set(2.42, -0.25, 0.28)
    const stripLabel = makeCanvasPanel({
      w: 0.46,
      h: 2.7,
      ppu: 300,
      draw: (c, W, H) => {
        c.save()
        c.translate(W * 0.62, H * 0.975)
        c.rotate(-Math.PI / 2)
        label(c, 'HOT DRUM — COMPACT DISC DIGITAL AUDIO — 808', 0, 0, {
          size: W * 0.32,
          color: '#ffffff',
          ls: 4,
          weight: 800,
        })
        c.restore()
        barcode(c, W * 0.15, H * 0.955, W * 0.7, H * 0.03, 66, 'rgba(255,255,255,0.9)')
      },
    })
    stripLabel.mesh.position.set(2.42, -0.25, 0.3)
    g.add(strip, stripLabel.mesh)

    // ---- red RESTRICTED sticker (overlaps the disc) ----
    const redGroup = new THREE.Group()
    const red = makePlate({ w: 1.8, h: 0.82, r: 0.04, color: 0xd8261b, grain: 0.03 })
    const redLabel = makeCanvasPanel({
      w: 1.8,
      h: 0.82,
      ppu: 330,
      draw: (c, W, H) => {
        c.strokeStyle = '#fff'
        c.lineWidth = 3
        c.strokeRect(W * 0.02, H * 0.05, W * 0.96, H * 0.9)
        c.strokeRect(W * 0.035, H * 0.085, W * 0.93, H * 0.83)
        chipInv(c, 'R', W * 0.055, H * 0.14, H * 0.32)
        label(c, 'RESTRICTED', W * 0.2, H * 0.42, { size: H * 0.24, color: '#fff', weight: 900, ls: 2 })
        label(c, ctx.engine.playing ? 'NOW PLAYING — CLICK TO HOLD' : 'ON HOLD — CLICK TO PLAY', W * 0.2, H * 0.56, {
          size: H * 0.07,
          color: 'rgba(255,255,255,0.9)',
          ls: 1.5,
        })
        label(c, 'COPYRIGHT © FOR THE TEXT AND DESIGN IS PROTECTED IN ACCORDANCE WITH LOCAL LAW', W * 0.055, H * 0.72, {
          size: H * 0.048,
          color: 'rgba(255,255,255,0.8)',
        })
        label(c, '808-60063 CD-0001', W * 0.055, H * 0.88, { size: H * 0.09, color: '#fff', mono: true, weight: 700 })
        barcode(c, W * 0.62, H * 0.76, W * 0.32, H * 0.14, 21, '#fff')
      },
    })
    redLabel.mesh.position.z = 0.014
    redGroup.add(red, redLabel.mesh)
    redGroup.position.set(-0.9, -1.28, 0.62)
    redGroup.rotation.z = 0.02
    redGroup.traverse((o) => ((o as THREE.Mesh).renderOrder = 25))
    redLabel.mesh.userData.cursor = 'pointer'
    redLabel.mesh.userData.onTap = () => ctx.engine.toggle()
    ctx.addInteractive(redLabel.mesh)
    ctx.engine.on('state', () => redLabel.redraw())
    g.add(redGroup)

    function chipInv(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
      c.fillStyle = '#fff'
      roundRect(c, x, y, size, size, 2)
      c.fill()
      c.fillStyle = '#d8261b'
      c.font = `900 ${size * 0.78}px ${SANS}`
      c.fillText(text, x + size * 0.22, y + size * 0.8)
    }

    // ---- b/w halftone stickers ----
    const bw1 = makePlate({
      w: 1.05,
      h: 0.68,
      r: 0.02,
      color: 0xe8e4da,
      texture: zineTexture({ size: 512, seed: 31, fg: '#161616', bg: '#e8e4da' }),
      texAmt: 0.95,
    })
    bw1.position.set(-2.42, -1.22, 0.22)
    bw1.rotation.z = -0.03
    const bw1Label = makeCanvasPanel({
      w: 1.05,
      h: 0.68,
      ppu: 300,
      draw: (c, W, H) => {
        label(c, 'DUPBIN', W * 0.06, H * 0.28, { size: H * 0.2, color: '#111', weight: 900, ls: 1 })
        label(c, '86', W * 0.92, H * 0.88, { size: H * 0.3, color: '#111', weight: 900, align: 'right' })
      },
    })
    bw1Label.mesh.position.set(-2.42, -1.22, 0.24)
    bw1Label.mesh.rotation.z = -0.03
    g.add(bw1, bw1Label.mesh)

    const bw2 = makePlate({
      w: 0.8,
      h: 0.5,
      r: 0.02,
      color: 0xe8e4da,
      texture: zineTexture({ size: 512, seed: 57, fg: '#101010', bg: '#e8e4da' }),
      texAmt: 0.9,
    })
    bw2.position.set(1.62, 1.68, 0.4)
    bw2.rotation.z = 0.05
    bw2.renderOrder = 24
    g.add(bw2)

    // ---- playlist (stamped on the paper) ----
    const playlist = new PlaylistPanel(
      ctx.engine,
      {
        bg: '#f5f3ef',
        fg: '#101010',
        dim: '#8f8a80',
        accent: '#2231e8',
        header: 'BTLG-808',
        transparentBg: true,
      },
      1.8,
      1.35,
    )
    playlist.mesh.position.set(-1.52, -0.35, 0.3)
    g.add(playlist.mesh)
    ctx.addInteractive(playlist.mesh)

    // timecode
    const timecode = new TimecodePanel(
      ctx.engine,
      { fg: '#101010', dim: '#8f8a80', accent: '#d8261b' },
      { w: 1.5, h: 0.34, labelText: 'PRESS TIMER' },
    )
    timecode.mesh.position.set(-1.67, -1.86, 0.3)
    g.add(timecode.mesh)
    ctx.addInteractive(timecode.mesh)

    // transport
    const transport = new TransportBar(ctx.engine, { fg: '#101010', ring: '#101010' }, 1.0, 0.3)
    transport.mesh.position.set(0.55, -1.98, 0.3)
    g.add(transport.mesh)
    ctx.addInteractive(transport.mesh)

    // bottom rights row
    const rights = makeCanvasPanel({
      w: 3.4,
      h: 0.2,
      ppu: 300,
      draw: (c, W, H) => {
        dataRow(c, 0, H * 0.6, W * 0.35, 88, 'rgba(16,16,16,0.6)', H * 0.34)
        label(c, 'ALL RIGHTS RESERVED. C2089. REGISTERED DESIGN. TRADE MARKS.', W * 0.99, H * 0.6, {
          size: H * 0.3,
          color: 'rgba(16,16,16,0.7)',
          align: 'right',
          ls: 1.2,
          weight: 700,
        })
      },
    })
    rights.mesh.position.set(0.8, -2.32, 0.2)
    g.add(rights.mesh)

    // stark black spectrum ring
    const spectrum = new SpectrumRing({
      radius: 1.68,
      color: 0xe52d25,
      barW: 0.016,
      barLen: 0.15,
      opacity: 0.78,
    })
    spectrum.group.position.set(CX, CY, 0.3)
    g.add(spectrum.group)

    let redPulse = 1
    return {
      group: g,
      update(dt, t) {
        spectrum.update(ctx.engine, dt)
        timecode.update(dt)
        redPulse = damp(redPulse, 1 + ctx.engine.bands.pulse * 0.05, 12, dt)
        redGroup.scale.setScalar(redPulse)
        void t
      },
      dispose() {},
    }
  },
}
