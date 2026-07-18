import * as THREE from 'three'
import { seededRandom } from './canvas2d'

// Procedural stand-ins for textures we couldn't generate (credit budget):
// topo terrain, mars canyons, zine print, brushed metal. Value-noise fBm
// rendered once to canvas at startup.

function makeNoise2D(seed: number) {
  const rnd = seededRandom(seed)
  const size = 128
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const at = (x: number, y: number) => grid[((y & (size - 1)) * size + (x & (size - 1))) | 0]
  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct = 5, gain = 0.5, lac = 2.1) {
  let amp = 0.5
  let f = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f) * amp
    norm += amp
    amp *= gain
    f *= lac
  }
  return sum / norm
}

function canvasTexture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Satellite topo map with contour lines (ATLAS viewport). */
export function topoTexture(opts: {
  size?: number
  seed?: number
  land?: [string, string, string]
  contour?: string
  water?: string
}): THREE.CanvasTexture {
  const size = opts.size ?? 512
  const noise = makeNoise2D(opts.seed ?? 41)
  const ridged = makeNoise2D((opts.seed ?? 41) + 99)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  const land = (opts.land ?? ['#5c6650', '#8c8a68', '#c9c1a4']).map(hexToRgb)
  const contour = hexToRgb(opts.contour ?? '#2e2f2b')
  const water = hexToRgb(opts.water ?? '#3d4a49')
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 6
      const ny = (y / size) * 6
      let h = fbm(noise, nx, ny, 6)
      const ridge = 1 - Math.abs(fbm(ridged, nx * 0.8, ny * 0.8, 4) * 2 - 1)
      h = h * 0.65 + ridge * 0.35
      let r: number, gg: number, b: number
      if (h < 0.42) {
        ;[r, gg, b] = water
        const depth = (0.42 - h) * 2
        r *= 1 - depth * 0.5
        gg *= 1 - depth * 0.5
        b *= 1 - depth * 0.4
      } else {
        const t = Math.min(1, (h - 0.42) / 0.5)
        const c0 = t < 0.5 ? land[0] : land[1]
        const c1 = t < 0.5 ? land[1] : land[2]
        const tt = t < 0.5 ? t * 2 : (t - 0.5) * 2
        r = c0[0] + (c1[0] - c0[0]) * tt
        gg = c0[1] + (c1[1] - c0[1]) * tt
        b = c0[2] + (c1[2] - c0[2]) * tt
        // contour lines
        const lv = h * 14
        if (Math.abs(lv - Math.round(lv)) < 0.045) {
          r = r * 0.35 + contour[0] * 0.65
          gg = gg * 0.35 + contour[1] * 0.65
          b = b * 0.35 + contour[2] * 0.65
        }
      }
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = gg
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return canvasTexture(c)
}

/** Rust-orange canyon terrain (LACAILLE viewport). */
export function marsTexture(size = 512, seed = 77): THREE.CanvasTexture {
  return topoTexture({
    size,
    seed,
    land: ['#7a2f16', '#c65a24', '#e89a5b'],
    contour: '#3d1608',
    water: '#54200f',
  })
}

/** Xeroxed zine print noise (BOOTLEG plates, PRISM red block). */
export function zineTexture(opts: { size?: number; seed?: number; fg?: string; bg?: string }): THREE.CanvasTexture {
  const size = opts.size ?? 512
  const noise = makeNoise2D(opts.seed ?? 13)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = opts.bg ?? '#e8e4da'
  g.fillRect(0, 0, size, size)
  const img = g.getImageData(0, 0, size, size)
  const fg = hexToRgb(opts.fg ?? '#141414')
  const rnd = seededRandom((opts.seed ?? 13) * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(noise, (x / size) * 9, (y / size) * 9, 5)
      const grit = rnd()
      const ink = n < 0.44 || (n < 0.5 && grit > 0.75) || grit > 0.985
      if (ink) {
        const i = (y * size + x) * 4
        const a = n < 0.38 ? 1 : 0.55 + grit * 0.4
        img.data[i] = img.data[i] * (1 - a) + fg[0] * a
        img.data[i + 1] = img.data[i + 1] * (1 - a) + fg[1] * a
        img.data[i + 2] = img.data[i + 2] * (1 - a) + fg[2] * a
      }
    }
  }
  g.putImageData(img, 0, 0)
  // halftone dot band
  g.fillStyle = opts.fg ?? '#141414'
  for (let y = 0; y < size; y += 9) {
    for (let x = 0; x < size; x += 9) {
      const n = fbm(noise, (x / size) * 3 + 40, (y / size) * 3 + 40, 3)
      const r = Math.max(0, n - 0.42) * 9
      if (r > 0.6) {
        g.beginPath()
        g.arc(x, y, Math.min(4, r), 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  return canvasTexture(c, true)
}

/** Fine horizontal brushed metal. */
export function metalTexture(size = 256, seed = 5, base = '#3a3d43'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  const rnd = seededRandom(seed)
  for (let i = 0; i < size * 3; i++) {
    const y = Math.floor(rnd() * size)
    const w = 20 + rnd() * size
    const x = rnd() * size - w / 2
    const l = rnd()
    g.strokeStyle = l > 0.5 ? `rgba(255,255,255,${(l - 0.5) * 0.09})` : `rgba(0,0,0,${(0.5 - l) * 0.12})`
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x, y + 0.5)
    g.lineTo(x + w, y + 0.5)
    g.stroke()
  }
  return canvasTexture(c, true)
}

/** Fallback album art if a generated cover is missing: bold gradient + geometry. */
export function fallbackArt(accent: number, seed = 1): THREE.CanvasTexture {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const col = new THREE.Color(accent)
  const hex = `#${col.getHexString()}`
  const grad = g.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#101014')
  grad.addColorStop(1, '#26262e')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const rnd = seededRandom(seed * 31)
  g.strokeStyle = hex
  g.lineWidth = 3
  for (let i = 0; i < 7; i++) {
    g.globalAlpha = 0.25 + rnd() * 0.6
    g.beginPath()
    g.arc(size * (0.3 + rnd() * 0.4), size * (0.3 + rnd() * 0.4), 30 + rnd() * 180, 0, Math.PI * 2)
    g.stroke()
  }
  g.globalAlpha = 1
  g.fillStyle = hex
  g.fillRect(40, size - 90, 140, 10)
  return canvasTexture(c)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
