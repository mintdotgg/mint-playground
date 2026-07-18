// Minimal tween manager — one global ticker, no deps.

export type Ease = (t: number) => number

export const easings = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
}

interface TweenItem {
  t: number
  delay: number
  duration: number
  ease: Ease
  onUpdate: (v: number) => void
  onComplete?: () => void
  dead: boolean
}

export interface TweenHandle {
  kill: () => void
}

class TweenManager {
  private items: TweenItem[] = []

  add(opts: {
    duration: number
    delay?: number
    ease?: Ease
    onUpdate: (v: number) => void
    onComplete?: () => void
  }): TweenHandle {
    const item: TweenItem = {
      t: 0,
      delay: opts.delay ?? 0,
      duration: Math.max(0.0001, opts.duration),
      ease: opts.ease ?? easings.outCubic,
      onUpdate: opts.onUpdate,
      onComplete: opts.onComplete,
      dead: false,
    }
    this.items.push(item)
    return { kill: () => (item.dead = true) }
  }

  update(dt: number) {
    for (const it of this.items) {
      if (it.dead) continue
      if (it.delay > 0) {
        it.delay -= dt
        if (it.delay > 0) continue
      }
      it.t += dt / it.duration
      const k = Math.min(1, it.t)
      it.onUpdate(it.ease(k))
      if (k >= 1) {
        it.dead = true
        it.onComplete?.()
      }
    }
    if (this.items.length > 64) this.items = this.items.filter((i) => !i.dead)
  }
}

export const tweens = new TweenManager()

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
// frame-rate independent smoothing
export const damp = (cur: number, target: number, rate: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-rate * dt))
