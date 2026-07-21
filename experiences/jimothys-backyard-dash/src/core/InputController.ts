import type { RaceIntent } from '../game/types';

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
};

export function raceIntentForSwipe(dx: number, dy: number, threshold: number): RaceIntent | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }

  return dy < 0 ? 'jump' : 'scuttle';
}

export class InputController {
  private gesture: Gesture | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    const intent = this.keyIntent(event.code);
    if (!intent) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    this.emit(intent);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    this.gesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    try {
      this.surface.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events may not expose pointer capture.
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - this.gesture.startX;
    const dy = event.clientY - this.gesture.startY;
    const threshold = Math.max(30, Math.min(window.innerWidth, window.innerHeight) * 0.045);
    this.gesture = null;
    const intent = raceIntentForSwipe(dx, dy, threshold);
    if (intent) this.emit(intent);
  };

  private readonly onPointerCancel = (): void => {
    this.gesture = null;
  };

  private readonly onBoost = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.emit('boost');
  };

  private readonly onBlur = (): void => {
    this.gesture = null;
  };

  constructor(
    private readonly surface: HTMLElement,
    private readonly boostButton: HTMLButtonElement,
    private readonly emit: (intent: RaceIntent) => void,
  ) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('blur', this.onBlur);
    this.surface.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.surface.addEventListener('pointerup', this.onPointerUp, { passive: false });
    this.surface.addEventListener('pointercancel', this.onPointerCancel);
    this.surface.addEventListener('lostpointercapture', this.onPointerCancel);
    this.boostButton.addEventListener('pointerdown', this.onBoost, { passive: false });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onBlur);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    this.surface.removeEventListener('pointerup', this.onPointerUp);
    this.surface.removeEventListener('pointercancel', this.onPointerCancel);
    this.surface.removeEventListener('lostpointercapture', this.onPointerCancel);
    this.boostButton.removeEventListener('pointerdown', this.onBoost);
  }

  private keyIntent(code: string): RaceIntent | null {
    if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
    if (code === 'ArrowRight' || code === 'KeyD') return 'right';
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') return 'jump';
    if (code === 'ArrowDown' || code === 'KeyS') return 'scuttle';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'boost';
    if (code === 'Escape' || code === 'KeyP') return 'pause';
    return null;
  }
}
