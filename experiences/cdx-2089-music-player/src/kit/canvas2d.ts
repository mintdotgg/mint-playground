import * as THREE from 'three'

export const MONO = 'ui-monospace, "SF Mono", Menlo, "Roboto Mono", monospace'
export const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif'

export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CanvasPanel {
  mesh: THREE.Mesh
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  redraw: () => void
  setDraw: (fn: DrawFn) => void
  w: number
  h: number
  pw: number
  ph: number
}

export type DrawFn = (ctx: CanvasRenderingContext2D, W: number, H: number) => void

/**
 * A world-space plane whose surface is a 2D canvas. The workhorse for every
 * screen, label, sticker and readout — crisp text, dynamic redraw.
 */
export function makeCanvasPanel(opts: {
  w: number
  h: number
  ppu?: number // canvas pixels per world unit
  draw: DrawFn
  transparent?: boolean
}): CanvasPanel {
  const ppu = opts.ppu ?? 256
  const pw = Math.max(8, Math.round(opts.w * ppu))
  const ph = Math.max(8, Math.round(opts.h * ppu))
  const canvas = document.createElement('canvas')
  canvas.width = pw
  canvas.height = ph
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.w, opts.h), mat)

  let drawFn = opts.draw
  const redraw = () => {
    ctx.clearRect(0, 0, pw, ph)
    drawFn(ctx, pw, ph)
    texture.needsUpdate = true
  }
  redraw()

  return {
    mesh,
    canvas,
    ctx,
    texture,
    redraw,
    setDraw: (fn) => (drawFn = fn),
    w: opts.w,
    h: opts.h,
    pw,
    ph,
  }
}

// ---------------------------------------------------------------- draw utils

export interface LabelOpts {
  size?: number
  weight?: number | string
  color?: string
  ls?: number // letter spacing px
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  mono?: boolean
  font?: string
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: LabelOpts = {}) {
  ctx.save()
  ctx.font = `${o.weight ?? 600} ${o.size ?? 20}px ${o.font ?? (o.mono ? MONO : SANS)}`
  ctx.fillStyle = o.color ?? '#fff'
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = o.baseline ?? 'alphabetic'
  try {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${o.ls ?? 0}px`
  } catch {
    /* older engines */
  }
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Fake barcode block. */
export function barcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed = 7,
  color = '#fff',
) {
  const rnd = seededRandom(seed)
  ctx.save()
  ctx.fillStyle = color
  let cx = x
  while (cx < x + w) {
    const bw = 1 + Math.floor(rnd() * 4)
    if (rnd() > 0.42) ctx.fillRect(cx, y, bw, h)
    cx += bw + 1 + Math.floor(rnd() * 3)
  }
  ctx.restore()
}

/** Row of tiny data glyphs (fake spec text). */
export function dataRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  seed: number,
  color: string,
  size = 9,
) {
  const rnd = seededRandom(seed)
  const glyphs = '0123456789ABCDEF·-/+'
  let s = ''
  const n = Math.floor(w / (size * 0.62))
  for (let i = 0; i < n; i++) s += glyphs[Math.floor(rnd() * glyphs.length)]
  label(ctx, s, x, y, { size, color, mono: true, weight: 500, ls: 1 })
}

/** Arc of tick marks (instrument bezel furniture). */
export function ticksArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  n: number,
  len: number,
  color: string,
  width = 2,
  every = 1,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  for (let i = 0; i <= n; i++) {
    if (i % every !== 0) continue
    const a = a0 + ((a1 - a0) * i) / n
    const l = len * (i % 5 === 0 ? 1.6 : 1)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.lineTo(cx + Math.cos(a) * (r - l), cy + Math.sin(a) * (r - l))
    ctx.stroke()
  }
  ctx.restore()
}

export function crosshair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, w = 1.5) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(x - s, y)
  ctx.lineTo(x + s, y)
  ctx.moveTo(x, y - s)
  ctx.lineTo(x, y + s)
  ctx.stroke()
  ctx.restore()
}

export function dotGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cols: number,
  rows: number,
  gap: number,
  r: number,
  color: string,
) {
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      ctx.beginPath()
      ctx.arc(x + i * gap, y + j * gap, r, 0, Math.PI * 2)
      ctx.fill()
    }
  ctx.restore()
}

/** Inverted chip label, e.g. [ REC ] */
export function chip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: { size?: number; pad?: number; bg?: string; fg?: string; r?: number } = {},
) {
  const size = o.size ?? 14
  const pad = o.pad ?? 6
  ctx.save()
  ctx.font = `700 ${size}px ${SANS}`
  const w = ctx.measureText(text).width + pad * 2
  const h = size + pad * 1.1
  ctx.fillStyle = o.bg ?? '#fff'
  roundRect(ctx, x, y, w, h, o.r ?? 2)
  ctx.fill()
  ctx.fillStyle = o.fg ?? '#000'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + pad, y + h / 2 + 1)
  ctx.restore()
  return { w, h }
}
