import * as THREE from 'three'
import { makeCanvasPanel, type CanvasPanel, label, roundRect, MONO, SANS } from './canvas2d'
import type { AudioEngine } from '../audio/engine'
import { TRACKS, fmtTime } from '../audio/tracks'

export interface PlaylistStyle {
  bg: string
  fg: string
  dim: string
  accent: string
  header: string
  transparentBg?: boolean
  border?: string
}

/** Track list screen — the Winamp soul of the machine. Click a row to play. */
export class PlaylistPanel {
  panel: CanvasPanel
  get mesh() {
    return this.panel.mesh
  }

  constructor(
    private engine: AudioEngine,
    private style: PlaylistStyle,
    w: number,
    h: number,
  ) {
    this.panel = makeCanvasPanel({ w, h, ppu: 300, draw: (c, W, H) => this.draw(c, W, H) })
    this.mesh.userData.onTap = (uv: THREE.Vector2) => {
      const row = this.rowAt(uv.y)
      if (row === null) return
      if (row === this.engine.trackIndex) this.engine.toggle()
      else this.engine.load(row, true)
    }
    this.mesh.userData.cursor = 'pointer'
    const refresh = () => this.panel.redraw()
    engine.on('track', refresh)
    engine.on('state', refresh)
    engine.on('durations', refresh)
  }

  private headerPx(H: number) {
    return H * 0.14
  }
  private padPx(W: number) {
    return W * 0.045
  }

  private rowAt(v: number): number | null {
    const H = this.panel.ph
    const y = (1 - v) * H
    const top = this.headerPx(H) + this.padPx(this.panel.pw) * 0.6
    const rowH = (H - top - this.padPx(this.panel.pw)) / TRACKS.length
    const i = Math.floor((y - top) / rowH)
    return i >= 0 && i < TRACKS.length ? i : null
  }

  private draw(c: CanvasRenderingContext2D, W: number, H: number) {
    const s = this.style
    const pad = this.padPx(W)
    if (!s.transparentBg) {
      c.fillStyle = s.bg
      roundRect(c, 0, 0, W, H, W * 0.02)
      c.fill()
    }
    if (s.border) {
      c.strokeStyle = s.border
      c.lineWidth = 2
      roundRect(c, 1, 1, W - 2, H - 2, W * 0.02)
      c.stroke()
    }
    const headH = this.headerPx(H)
    // header
    label(c, s.header, pad, headH * 0.62, {
      size: headH * 0.34,
      weight: 800,
      color: s.fg,
      ls: headH * 0.1,
    })
    label(c, 'PLAYLIST', pad, headH * 0.92, {
      size: headH * 0.16,
      weight: 600,
      color: s.dim,
      ls: headH * 0.09,
    })
    label(c, `${String(this.engine.trackIndex + 1).padStart(2, '0')}/${String(TRACKS.length).padStart(2, '0')}`, W - pad, headH * 0.62, {
      size: headH * 0.22,
      color: s.dim,
      mono: true,
      align: 'right',
    })
    c.fillStyle = s.dim
    c.globalAlpha = 0.5
    c.fillRect(pad, headH, W - pad * 2, 1.5)
    c.globalAlpha = 1

    const top = headH + pad * 0.6
    const rowH = (H - top - pad) / TRACKS.length
    TRACKS.forEach((t, i) => {
      const y = top + i * rowH
      const sel = i === this.engine.trackIndex
      const dead = this.engine.unavailable.has(i)
      if (sel) {
        c.fillStyle = s.accent
        roundRect(c, pad * 0.5, y + rowH * 0.08, W - pad, rowH * 0.86, 3)
        c.fill()
      }
      const fg = sel ? s.bg : dead ? s.dim : s.fg
      const dim = sel ? s.bg : s.dim
      const tx = pad + rowH * 0.72
      label(c, String(i + 1).padStart(2, '0'), pad * 0.9, y + rowH * 0.48, {
        size: rowH * 0.3,
        color: dim,
        mono: true,
        baseline: 'middle',
      })
      label(c, t.title, tx, y + rowH * 0.4, {
        size: rowH * 0.32,
        weight: 700,
        color: fg,
        ls: 1,
        baseline: 'middle',
      })
      label(c, `${t.artist} · ${t.genre}${dead ? ' · OFFLINE' : ''}`, tx, y + rowH * 0.76, {
        size: rowH * 0.2,
        weight: 500,
        color: dim,
        ls: 1.5,
        baseline: 'middle',
      })
      const dur = this.engine.durations[i]
      label(c, sel && this.engine.playing ? '▶' : fmtTime(dur), W - pad, y + rowH * 0.5, {
        size: rowH * 0.26,
        color: sel ? s.bg : s.dim,
        mono: true,
        align: 'right',
        baseline: 'middle',
      })
    })
  }
}

/** prev / play-pause / next, one panel, three hit zones. */
export class TransportBar {
  panel: CanvasPanel
  get mesh() {
    return this.panel.mesh
  }

  constructor(
    private engine: AudioEngine,
    private colors: { fg: string; bg?: string; ring: string },
    w = 0.9,
    h = 0.3,
  ) {
    this.panel = makeCanvasPanel({ w, h, ppu: 300, draw: (c, W, H) => this.draw(c, W, H) })
    this.mesh.userData.cursor = 'pointer'
    this.mesh.userData.onTap = (uv: THREE.Vector2) => {
      if (uv.x < 1 / 3) this.engine.prev()
      else if (uv.x < 2 / 3) this.engine.toggle()
      else this.engine.next()
    }
    engine.on('state', () => this.panel.redraw())
  }

  private draw(c: CanvasRenderingContext2D, W: number, H: number) {
    const s = this.colors
    const r = H * 0.42
    const cx = [W * 0.168, W * 0.5, W * 0.832]
    if (s.bg) {
      c.fillStyle = s.bg
      roundRect(c, 0, 0, W, H, H / 2)
      c.fill()
    }
    cx.forEach((x, i) => {
      c.strokeStyle = s.ring
      c.lineWidth = 2.5
      c.beginPath()
      c.arc(x, H / 2, r, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = s.fg
      const g = r * 0.42
      if (i === 0) {
        this.tri(c, x + g * 0.7, H / 2, -g)
        this.tri(c, x - g * 0.35, H / 2, -g)
      } else if (i === 2) {
        this.tri(c, x - g * 0.7, H / 2, g)
        this.tri(c, x + g * 0.35, H / 2, g)
      } else if (this.engine.playing) {
        c.fillRect(x - g * 0.8, H / 2 - g, g * 0.55, g * 2)
        c.fillRect(x + g * 0.25, H / 2 - g, g * 0.55, g * 2)
      } else {
        this.tri(c, x - g * 0.4, H / 2, g * 1.6)
      }
    })
  }

  private tri(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    c.beginPath()
    c.moveTo(x, y - Math.abs(s) * 0.62)
    c.lineTo(x, y + Math.abs(s) * 0.62)
    c.lineTo(x + s, y)
    c.closePath()
    c.fill()
  }
}

/** Elapsed / total readout with a clickable seek bar. */
export class TimecodePanel {
  panel: CanvasPanel
  private acc = 0
  get mesh() {
    return this.panel.mesh
  }

  constructor(
    private engine: AudioEngine,
    private colors: { fg: string; dim: string; bg?: string; accent: string },
    private opts: { w?: number; h?: number; labelText?: string } = {},
  ) {
    this.panel = makeCanvasPanel({
      w: opts.w ?? 1.1,
      h: opts.h ?? 0.34,
      ppu: 300,
      draw: (c, W, H) => this.draw(c, W, H),
    })
    this.mesh.userData.cursor = 'pointer'
    this.mesh.userData.onTap = (uv: THREE.Vector2) => {
      // bottom half = seek bar
      if (uv.y < 0.5) this.engine.seek(THREE.MathUtils.clamp((uv.x - 0.05) / 0.9, 0, 1))
      else this.engine.toggle()
    }
  }

  update(dt: number) {
    this.acc += dt
    if (this.acc > 0.12) {
      this.acc = 0
      this.panel.redraw()
    }
  }

  private draw(c: CanvasRenderingContext2D, W: number, H: number) {
    const s = this.colors
    if (s.bg) {
      c.fillStyle = s.bg
      roundRect(c, 0, 0, W, H, 6)
      c.fill()
    }
    const e = this.engine
    label(c, this.opts.labelText ?? 'TIMECODE', W * 0.05, H * 0.3, {
      size: H * 0.14,
      color: s.dim,
      ls: 2,
      weight: 700,
    })
    label(c, `${fmtTime(e.time)}`, W * 0.05, H * 0.62, {
      size: H * 0.3,
      color: s.fg,
      mono: true,
      weight: 700,
    })
    label(c, `/ ${fmtTime(e.duration)}`, W * 0.05 + H * 0.85, H * 0.62, {
      size: H * 0.19,
      color: s.dim,
      mono: true,
    })
    label(c, `TRK ${String(e.trackIndex + 1).padStart(2, '0')}`, W * 0.95, H * 0.45, {
      size: H * 0.17,
      color: s.dim,
      mono: true,
      align: 'right',
    })
    // seek bar
    const bx = W * 0.05
    const bw = W * 0.9
    const by = H * 0.78
    c.fillStyle = s.dim
    c.globalAlpha = 0.35
    c.fillRect(bx, by, bw, H * 0.05)
    c.globalAlpha = 1
    c.fillStyle = s.accent
    c.fillRect(bx, by, bw * e.progress, H * 0.05)
    // playhead
    c.fillRect(bx + bw * e.progress - 1.5, by - H * 0.045, 3, H * 0.14)
  }
}

/** Big wordmark plate (nameplates like "Lacaille"). */
export function makeNameplate(opts: {
  w: number
  h: number
  bg: string
  fg: string
  getTitle: () => { big: string; small?: string; index?: string }
  italic?: boolean
  outline?: boolean
}) {
  const panel = makeCanvasPanel({
    w: opts.w,
    h: opts.h,
    ppu: 340,
    draw: (c, W, H) => {
      if (opts.bg !== 'transparent') {
        c.fillStyle = opts.bg
        // angled tag corner like the reference cards
        c.beginPath()
        c.moveTo(0, 0)
        c.lineTo(W - H * 0.35, 0)
        c.lineTo(W, H * 0.35)
        c.lineTo(W, H)
        c.lineTo(0, H)
        c.closePath()
        c.fill()
      }
      const t = opts.getTitle()
      if (t.index) {
        label(c, t.index, W * 0.045, H * 0.32, { size: H * 0.2, color: opts.fg, mono: true, weight: 500 })
      }
      c.save()
      if (opts.italic) c.transform(1, 0, -0.12, 1, H * 0.08, 0)
      const fits = (size: number) => {
        c.font = `800 ${size}px ${SANS}`
        return c.measureText(t.big).width < W * 0.9
      }
      let size = H * 0.52
      while (size > H * 0.2 && !fits(size)) size -= H * 0.02
      c.font = `800 ${size}px ${SANS}`
      if (opts.outline) {
        c.strokeStyle = opts.fg
        c.lineWidth = Math.max(1.5, size * 0.035)
        c.strokeText(t.big, W * 0.045, H * 0.78)
      } else {
        c.fillStyle = opts.fg
        c.fillText(t.big, W * 0.045, H * 0.78)
      }
      c.restore()
      if (t.small) {
        label(c, t.small, W * 0.955, H * 0.3, {
          size: H * 0.13,
          color: opts.fg,
          align: 'right',
          mono: true,
        })
      }
    },
  })
  return panel
}

export { MONO, SANS }
