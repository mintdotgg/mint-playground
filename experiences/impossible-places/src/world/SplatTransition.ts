import type { Destination } from '../destinations';

type Phase = 'idle' | 'burst' | 'hold' | 'reveal';

type Sample = {
  x: number;
  y: number;
  color: string;
  size: number;
  random: number;
};

type Particle = Sample & {
  targetX: number;
  targetY: number;
  scatterX: number;
  scatterY: number;
  burstX: number;
  burstY: number;
};

type ParticleSet = {
  particles: Particle[];
  buckets: Map<string, Particle[]>;
};

const BURST_DURATION = 680;
const REVEAL_DURATION = 1_180;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function easeOutQuint(value: number): number {
  return 1 - Math.pow(1 - value, 5);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp01((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function quantizedColor(red: number, green: number, blue: number): string {
  const quantize = (channel: number) => Math.min(255, Math.round(channel / 51) * 51);
  return `${quantize(red)},${quantize(green)},${quantize(blue)}`;
}

export class SplatTransition {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly images = new Map<string, HTMLImageElement>();
  private phase: Phase = 'idle';
  private phaseStartedAt = 0;
  private outgoing?: ParticleSet;
  private incoming?: ParticleSet;
  private outgoingDestination?: Destination;
  private incomingDestination?: Destination;
  private revealResolve?: () => void;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private paused = false;
  private seed = 4_177;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Unable to create the splat-transition canvas');
    this.context = context;
    this.resize();
  }

  async prepare(destinations: Destination[]): Promise<void> {
    await Promise.allSettled(destinations.map((destination) => this.loadImage(destination)));
  }

  private async loadImage(destination: Destination): Promise<HTMLImageElement | undefined> {
    const cached = this.images.get(destination.id);
    if (cached) return cached;

    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    const canvasUrl = new URL(destination.thumbnail);
    canvasUrl.searchParams.set('canvas', '1');
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener(
        'error',
        () => reject(new Error(`Unable to load transition thumbnail for ${destination.name}`)),
        { once: true },
      );
      image.src = canvasUrl.href;
    });
    this.images.set(destination.id, image);
    return image;
  }

  async beginInitial(destination: Destination): Promise<void> {
    await this.loadImage(destination);
    this.outgoing = undefined;
    this.outgoingDestination = undefined;
    this.incomingDestination = destination;
    this.incoming = this.buildParticleSet(destination, this.seed + destination.index * 97);
    this.phase = 'hold';
    this.phaseStartedAt = performance.now();
    this.canvas.dataset.active = 'true';
  }

  async begin(outgoing: Destination, incoming: Destination): Promise<void> {
    await Promise.all([this.loadImage(outgoing), this.loadImage(incoming)]);
    this.outgoingDestination = outgoing;
    this.incomingDestination = incoming;
    this.outgoing = this.buildParticleSet(outgoing, this.seed + outgoing.index * 97);
    this.incoming = this.buildParticleSet(incoming, this.seed + incoming.index * 131);
    this.phase = this.reducedMotion ? 'hold' : 'burst';
    this.phaseStartedAt = performance.now();
    this.canvas.dataset.active = 'true';
  }

  reveal(): Promise<void> {
    if (this.phase === 'idle') return Promise.resolve();
    this.phase = 'reveal';
    this.phaseStartedAt = performance.now();
    return new Promise((resolve) => {
      this.revealResolve = resolve;
    });
  }

  cancel(): void {
    this.finishReveal();
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  get motionScale(): number {
    return this.reducedMotion ? 0.05 : 1;
  }

  resize(): void {
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.canvas.width = Math.round(this.width * pixelRatio);
    this.canvas.height = Math.round(this.height * pixelRatio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (this.outgoingDestination) {
      this.outgoing = this.buildParticleSet(
        this.outgoingDestination,
        this.seed + this.outgoingDestination.index * 97,
      );
    }
    if (this.incomingDestination) {
      this.incoming = this.buildParticleSet(
        this.incomingDestination,
        this.seed + this.incomingDestination.index * 131,
      );
    }
  }

  private buildParticleSet(destination: Destination, seed: number): ParticleSet {
    const image = this.images.get(destination.id);
    if (!image) return { particles: [], buckets: new Map() };

    const aspect = this.width / this.height;
    const desiredCount = this.width < 700 ? 1_850 : 3_200;
    const sampleWidth = Math.max(32, Math.round(Math.sqrt(desiredCount * aspect)));
    const sampleHeight = Math.max(32, Math.round(sampleWidth / aspect));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) return { particles: [], buckets: new Map() };

    const imageAspect = image.naturalWidth / image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    if (imageAspect > aspect) {
      sourceWidth = sourceHeight * aspect;
      sourceX = (image.naturalWidth - sourceWidth) * 0.5;
    } else {
      sourceHeight = sourceWidth / aspect;
      sourceY = (image.naturalHeight - sourceHeight) * 0.5;
    }
    sampleContext.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sampleWidth,
      sampleHeight,
    );

    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const random = seededRandom(seed);
    const diagonal = Math.hypot(this.width, this.height);
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    const particles: Particle[] = [];

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const pixelIndex = (y * sampleWidth + x) * 4;
        const alpha = pixels[pixelIndex + 3] ?? 0;
        if (alpha < 48) continue;
        const red = pixels[pixelIndex] ?? 0;
        const green = pixels[pixelIndex + 1] ?? 0;
        const blue = pixels[pixelIndex + 2] ?? 0;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        if (luminance < 8 && random() > 0.2) continue;

        const targetX = ((x + 0.5) / sampleWidth) * this.width;
        const targetY = ((y + 0.5) / sampleHeight) * this.height;
        const dx = targetX - centerX;
        const dy = targetY - centerY;
        const length = Math.max(Math.hypot(dx, dy), 1);
        const radialX = dx / length;
        const radialY = dy / length;
        const tangentX = -radialY;
        const tangentY = radialX;
        const scatterDistance = diagonal * (0.16 + random() * 0.52);
        const tangentDistance = diagonal * (random() - 0.5) * 0.14;
        const randomValue = random();

        particles.push({
          x,
          y,
          color: quantizedColor(red, green, blue),
          size: 0.75 + random() * (this.width < 700 ? 1.45 : 1.8),
          random: randomValue,
          targetX,
          targetY,
          scatterX: targetX + radialX * scatterDistance + tangentX * tangentDistance,
          scatterY: targetY + radialY * scatterDistance + tangentY * tangentDistance,
          burstX: targetX + radialX * scatterDistance * 1.18 + tangentX * tangentDistance * 1.8,
          burstY: targetY + radialY * scatterDistance * 1.18 + tangentY * tangentDistance * 1.8,
        });
      }
    }

    const buckets = new Map<string, Particle[]>();
    for (const particle of particles) {
      const bucket = buckets.get(particle.color);
      if (bucket) bucket.push(particle);
      else buckets.set(particle.color, [particle]);
    }
    return { particles, buckets };
  }

  update(now: number): void {
    if (this.phase === 'idle') return;

    if (this.phase === 'burst' && now - this.phaseStartedAt >= BURST_DURATION) {
      this.phase = 'hold';
      this.phaseStartedAt = now;
    }

    const elapsed = now - this.phaseStartedAt;
    let backgroundAlpha = 0.92;
    let particleAlpha = 0.8;
    let activeSet = this.incoming;
    let positionFor = (particle: Particle): [number, number, number] => {
      const drift = (this.paused ? 0 : elapsed) * 0.001;
      return [
        particle.scatterX + Math.sin(drift * 1.7 + particle.random * 19) * 9,
        particle.scatterY + Math.cos(drift * 1.35 + particle.random * 23) * 7,
        particle.size * 0.82,
      ];
    };

    if (this.phase === 'burst') {
      const progress = clamp01(elapsed / BURST_DURATION);
      const eased = easeInCubic(progress);
      activeSet = this.outgoing;
      backgroundAlpha = smoothstep(0, 0.7, progress) * 0.94;
      particleAlpha = 1 - smoothstep(0.55, 1, progress) * 0.58;
      positionFor = (particle) => [
        particle.targetX + (particle.burstX - particle.targetX) * eased,
        particle.targetY + (particle.burstY - particle.targetY) * eased,
        particle.size * (1 + progress * 1.55),
      ];
    } else if (this.phase === 'reveal') {
      const duration = this.reducedMotion ? 80 : REVEAL_DURATION;
      const progress = clamp01(elapsed / duration);
      const converge = easeOutQuint(clamp01(progress / 0.7));
      activeSet = this.incoming;
      backgroundAlpha = 0.94 * (1 - smoothstep(0.18, 1, progress));
      particleAlpha = 0.92 * (1 - smoothstep(0.55, 1, progress));
      positionFor = (particle) => {
        const delayedProgress = easeOutQuint(
          clamp01((converge - particle.random * 0.12) / 0.88),
        );
        return [
          particle.scatterX + (particle.targetX - particle.scatterX) * delayedProgress,
          particle.scatterY + (particle.targetY - particle.scatterY) * delayedProgress,
          particle.size * (0.75 + (1 - delayedProgress) * 0.8),
        ];
      };
      if (progress >= 1) {
        this.finishReveal();
        return;
      }
    }

    this.context.clearRect(0, 0, this.width, this.height);
    this.context.fillStyle = `rgba(3, 5, 9, ${backgroundAlpha})`;
    this.context.fillRect(0, 0, this.width, this.height);
    if (!this.reducedMotion && activeSet) {
      this.drawParticles(activeSet, particleAlpha, positionFor);
    }
  }

  private drawParticles(
    set: ParticleSet,
    alpha: number,
    positionFor: (particle: Particle) => [number, number, number],
  ): void {
    this.context.save();
    this.context.globalCompositeOperation = 'screen';
    for (const [color, particles] of set.buckets) {
      this.context.beginPath();
      for (const particle of particles) {
        const [x, y, size] = positionFor(particle);
        this.context.rect(x, y, size, size);
      }
      this.context.fillStyle = `rgba(${color}, ${alpha})`;
      this.context.fill();
    }
    this.context.restore();
  }

  private finishReveal(): void {
    this.phase = 'idle';
    this.canvas.dataset.active = 'false';
    this.context.clearRect(0, 0, this.width, this.height);
    this.outgoing = undefined;
    this.incoming = undefined;
    this.outgoingDestination = undefined;
    this.incomingDestination = undefined;
    this.revealResolve?.();
    this.revealResolve = undefined;
  }
}
