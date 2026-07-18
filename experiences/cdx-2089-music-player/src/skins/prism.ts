import * as THREE from 'three'
import type { SkinDef, SkinCtx, SkinInstance } from './types'
import { makePlate, makeScrews, makeShadow } from '../kit/panels'
import { makeCanvasPanel, label, dataRow, barcode, SANS } from '../kit/canvas2d'
import { PlaylistPanel, TransportBar, TimecodePanel } from '../kit/playlist'
import { SpectrumRing } from '../kit/viz'
import { zineTexture } from '../kit/proctex'
import { TRACKS } from '../audio/tracks'

// Ref 4 — Y2K acid design: giant holographic disc pinned between translucent
// acrylic plates, chrome wordmark sprayed across it, screws everywhere.

export const PRISM: SkinDef = {
  id: 'prism',
  name: 'PRISM',
  vibe: 'ACID ACRYLIC',
  palette: {
    bgTop: 0x24152d,
    bgBot: 0x040207,
    ink: 0xf2f4f6,
    panel: 0x101014,
    accent: 0xb6ff2e,
    selector: 0xb6ff2e,
    selectorInk: 0x10150a,
    light: false,
  },
  bloom: { strength: 0.36, threshold: 0.88 },
  disc: {
    pos: [0.1, 0.08, 0.22],
    scale: 1.3,
    style: { irid: 0.9, holo: 0.55, ink: 0, desat: 0, artAmt: 0.62 },
  },

  build(ctx: SkinCtx): SkinInstance {
    const g = new THREE.Group()
    const CX = 0.1
    const CY = 0.08

    const shadow = makeShadow(6.2, 5.6, 0.7, 0x000000)
    shadow.position.set(CX, CY - 0.2, -0.5)
    g.add(shadow)

    // ---- square outline frame behind ----
    const frame = makePlate({
      w: 3.7,
      h: 3.7,
      r: 0.06,
      color: 0x0d0d10,
      opacity: 0.5,
      border: { color: 0x8b948e, width: 0.022 },
      grain: 0.03,
    })
    frame.position.set(CX, CY, -0.24)
    frame.rotation.z = 0.03
    g.add(frame)
    const frameScrews = makeScrews(
      [
        [CX - 1.72, CY + 1.72, -0.2],
        [CX + 1.72, CY + 1.72, -0.2],
        [CX - 1.72, CY - 1.72, -0.2],
        [CX + 1.72, CY - 1.72, -0.2],
      ],
      0.08,
    )
    g.add(frameScrews)

    // ---- acrylic plates (translucent, engraved) ----
    const acrylic = (
      w: number,
      h: number,
      color: number,
      opacity: number,
      draw: (c: CanvasRenderingContext2D, W: number, H: number) => void,
    ) => {
      const grp = new THREE.Group()
      const plate = makePlate({
        w,
        h,
        r: 0.05,
        color,
        opacity,
        border: { color: 0xffffff, width: 0.01 },
      })
      const engraving = makeCanvasPanel({ w, h, ppu: 300, draw })
      engraving.mesh.position.z = 0.012
      grp.add(plate, engraving.mesh)
      return grp
    }

    const greenPlate = acrylic(2.1, 1.5, 0x86d94e, 0.3, (c, W, H) => {
      label(c, 'REALTIME COMPILATION — 2089', W * 0.05, H * 0.12, {
        size: H * 0.05,
        color: 'rgba(10,30,8,0.85)',
        ls: 2,
        weight: 700,
      })
      TRACKS.slice(0, 4).forEach((t, i) => {
        label(c, `${String(i + 1).padStart(2, '0')}  ${t.title} — ${t.artist}`, W * 0.05, H * (0.22 + i * 0.08), {
          size: H * 0.045,
          color: 'rgba(10,30,8,0.7)',
          mono: true,
        })
      })
      c.save()
      c.translate(W * 0.5, H * 0.78)
      c.scale(1, -1) // mirrored press type
      c.font = `900 ${H * 0.3}px ${SANS}`
      c.fillStyle = 'rgba(12,40,10,0.35)'
      c.textAlign = 'center'
      c.fillText('PRISM', 0, 0)
      c.restore()
      dataRow(c, W * 0.05, H * 0.94, W * 0.5, 71, 'rgba(10,30,8,0.6)', H * 0.04)
    })
    greenPlate.position.set(CX + 1.42, CY + 1.28, -0.08)
    greenPlate.rotation.z = -0.1
    g.add(greenPlate)

    const yellowPlate = acrylic(2.3, 0.95, 0xd9f25e, 0.36, (c, W, H) => {
      label(c, 'VARIOUS ARTISTS · RIU 2089 · CDX SERIES', W * 0.04, H * 0.2, {
        size: H * 0.09,
        color: 'rgba(40,42,6,0.8)',
        ls: 1.5,
        weight: 700,
      })
      TRACKS.slice(3).forEach((t, i) => {
        label(c, `${String(i + 4).padStart(2, '0')}  ${t.title} [${t.bpm} BPM]`, W * 0.04, H * (0.42 + i * 0.17), {
          size: H * 0.085,
          color: 'rgba(40,42,6,0.65)',
          mono: true,
        })
      })
      barcode(c, W * 0.72, H * 0.15, W * 0.24, H * 0.28, 33, 'rgba(40,42,6,0.75)')
    })
    yellowPlate.position.set(CX - 1.5, CY - 1.42, 0.66)
    yellowPlate.rotation.z = 0.06
    yellowPlate.traverse((o) => ((o as THREE.Mesh).renderOrder = 24))
    g.add(yellowPlate)

    // clear strip, right side, vertical
    const strip = acrylic(0.5, 2.9, 0xcfe8dc, 0.22, (c, W, H) => {
      c.save()
      c.translate(W * 0.6, H * 0.97)
      c.rotate(-Math.PI / 2)
      label(c, 'READ ME — COMPACT DISC MEMORY ARCHIVE — PLAY LOUD', 0, 0, {
        size: W * 0.22,
        color: 'rgba(230,255,240,0.75)',
        ls: 3,
        weight: 700,
      })
      c.restore()
    })
    strip.position.set(CX + 2.18, CY + 0.1, 0.5)
    strip.traverse((o) => ((o as THREE.Mesh).renderOrder = 24))
    g.add(strip)

    // ---- red zine block ----
    const red = makePlate({
      w: 1.2,
      h: 0.9,
      r: 0.03,
      color: 0xd0281a,
      texture: zineTexture({ size: 512, seed: 99, fg: '#5e0d05', bg: '#d0281a' }),
      texAmt: 0.85,
      texScale: [1.4, 1],
    })
    red.position.set(CX - 1.98, CY + 0.62, 0.12)
    const redLabel = makeCanvasPanel({
      w: 1.2,
      h: 0.9,
      ppu: 300,
      draw: (c, W, H) => {
        label(c, 'SIDE A', W * 0.08, H * 0.2, { size: H * 0.11, color: '#ffe9e4', ls: 4, weight: 800 })
        label(c, 'LOSSLESS', W * 0.08, H * 0.88, { size: H * 0.08, color: 'rgba(255,233,228,0.8)', ls: 3 })
      },
    })
    redLabel.mesh.position.set(CX - 1.98, CY + 0.62, 0.14)
    g.add(red, redLabel.mesh)

    // ---- chrome wordmark across the disc (current track) ----
    const chrome = makeCanvasPanel({
      w: 3.3,
      h: 0.9,
      ppu: 340,
      draw: (c, W, H) => {
        const t = TRACKS[ctx.engine.trackIndex]
        const word = t.title.split(' ')[0]
        c.save()
        c.translate(W / 2, H * 0.68)
        c.transform(1, -0.045, -0.22, 1, 0, 0)
        c.font = `900 ${H * 0.62}px ${SANS}`
        c.textAlign = 'center'
        const grad = c.createLinearGradient(0, -H * 0.55, 0, H * 0.18)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.42, '#c9d4dd')
        grad.addColorStop(0.55, '#5d6b78')
        grad.addColorStop(0.72, '#eef4f8')
        grad.addColorStop(1, '#8fa0ae')
        c.lineJoin = 'round'
        c.strokeStyle = 'rgba(10,12,14,0.9)'
        c.lineWidth = H * 0.085
        c.strokeText(word, 0, 0)
        c.fillStyle = grad
        c.fillText(word, 0, 0)
        // top shine line
        c.strokeStyle = 'rgba(255,255,255,0.65)'
        c.lineWidth = H * 0.012
        c.strokeText(word, 0, -H * 0.02)
        c.restore()
        label(c, `${t.artist} · ${t.genre}`, W / 2, H * 0.9, {
          size: H * 0.09,
          color: 'rgba(214,255,150,0.9)',
          align: 'center',
          ls: 4,
          weight: 700,
        })
      },
    })
    chrome.mesh.position.set(CX, CY - 0.72, 0.78)
    chrome.mesh.rotation.z = -0.04
    chrome.mesh.renderOrder = 26
    chrome.mesh.userData.cursor = 'pointer'
    chrome.mesh.userData.onTap = () => ctx.engine.toggle()
    ctx.addInteractive(chrome.mesh)
    g.add(chrome.mesh)
    ctx.engine.on('track', () => chrome.redraw())

    // ---- playlist on a clear plate ----
    const playlist = new PlaylistPanel(
      ctx.engine,
      {
        bg: '#0c1408',
        fg: '#dfffe4',
        dim: '#7fa88a',
        accent: '#b6ff2e',
        header: 'PRISM // RT',
        transparentBg: false,
        border: 'rgba(182,255,46,0.4)',
      },
      1.62,
      1.5,
    )
    playlist.mesh.position.set(CX + 1.88, CY - 1.18, 0.3)
    playlist.mesh.renderOrder = 23
    g.add(playlist.mesh)
    ctx.addInteractive(playlist.mesh)

    // timecode
    const timecode = new TimecodePanel(
      ctx.engine,
      { fg: '#eaffd8', dim: '#86a06c', accent: '#b6ff2e' },
      { w: 1.3, h: 0.36, labelText: 'RUNTIME' },
    )
    timecode.mesh.position.set(CX - 1.92, CY - 0.42, 0.3)
    timecode.mesh.renderOrder = 23
    g.add(timecode.mesh)
    ctx.addInteractive(timecode.mesh)

    // transport
    const transport = new TransportBar(ctx.engine, { fg: '#eaffea', ring: 'rgba(182,255,46,0.8)' }, 1.05, 0.32)
    transport.mesh.position.set(CX, CY - 2.02, 0.4)
    transport.mesh.renderOrder = 23
    g.add(transport.mesh)
    ctx.addInteractive(transport.mesh)

    // floating micro chips
    const chip1 = makeCanvasPanel({
      w: 0.72,
      h: 0.2,
      ppu: 320,
      draw: (c, W, H) => {
        c.fillStyle = 'rgba(226,255,120,0.9)'
        c.fillRect(0, 0, W, H)
        label(c, 'RKU-2089', W * 0.08, H * 0.68, { size: H * 0.4, color: '#1c2606', mono: true, weight: 700 })
      },
    })
    chip1.mesh.position.set(CX - 1.2, CY + 1.7, 0.5)
    chip1.mesh.rotation.z = 0.12
    chip1.mesh.renderOrder = 24
    g.add(chip1.mesh)

    const spectrum = new SpectrumRing({
      radius: 1.66,
      color: 0xb6ff2e,
      barW: 0.02,
      barLen: 0.22,
      opacity: 0.85,
      additive: true,
    })
    spectrum.group.position.set(CX, CY, 0.36)
    g.add(spectrum.group)

    return {
      group: g,
      update(dt, t) {
        spectrum.update(ctx.engine, dt)
        timecode.update(dt)
        // acrylic float
        greenPlate.position.y = CY + 1.28 + Math.sin(t * 0.6) * 0.02
        yellowPlate.position.y = CY - 1.42 + Math.sin(t * 0.7 + 1.4) * 0.022
        yellowPlate.rotation.z = 0.06 + Math.sin(t * 0.4) * 0.008
        strip.position.x = CX + 2.18 + Math.sin(t * 0.5 + 0.7) * 0.012
        chrome.mesh.position.y = CY - 0.72 + Math.sin(t * 0.8) * 0.014
      },
      dispose() {},
    }
  },
}
