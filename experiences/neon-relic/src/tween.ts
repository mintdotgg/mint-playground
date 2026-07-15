export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Normalized segment progress: 0 before start, 1 after start+dur. */
export const seg = (elapsed: number, start: number, dur: number) =>
  clamp01((elapsed - start) / dur)

/** One-shot event tracker for timeline callbacks. */
export class FireOnce {
  private fired = new Set<string>()
  fire(key: string, when: boolean, fn: () => void) {
    if (when && !this.fired.has(key)) {
      this.fired.add(key)
      fn()
    }
  }
  reset() {
    this.fired.clear()
  }
}
