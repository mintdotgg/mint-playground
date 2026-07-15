import { VIEWPORT } from './config.js';

export class InputController {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.activePointerId = null;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    // Window-level continuation is the fallback when a browser or embedded
    // webview unexpectedly drops pointer capture mid-drag. Pointer events from
    // the canvas bubble here too, so every active drag still has one owner.
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('blur', this.onWindowBlur);
  }

  toGamePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEWPORT.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEWPORT.height,
    };
  }

  onPointerDown(event) {
    if (this.activePointerId !== null) return;
    const point = this.toGamePoint(event);
    if (!this.handlers.start(point, event.pointerId, event.pointerType)) return;
    event.preventDefault();
    this.activePointerId = event.pointerId;
    try {
      this.canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic test events and a few embedded webviews do not register the
      // pointer with the UA even though the event itself is valid.
    }
  }

  onPointerMove(event) {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.handlers.move(this.toGamePoint(event), event.pointerId, event.pointerType);
  }

  onPointerUp(event) {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.handlers.end(this.toGamePoint(event), event.pointerId, event.pointerType);
    this.release(event.pointerId);
  }

  onPointerCancel(event) {
    if (event.pointerId !== this.activePointerId) return;
    this.handlers.cancel?.(event.pointerId);
    this.release(event.pointerId);
  }

  onWindowBlur() {
    this.cancelActivePointer();
  }

  cancelActivePointer() {
    if (this.activePointerId === null) return;
    const pointerId = this.activePointerId;
    this.handlers.cancel?.(pointerId);
    this.release(pointerId);
  }

  release(pointerId) {
    // Clear ownership first. Releasing capture can synchronously dispatch a
    // lostpointercapture event in some engines and must never cancel a shot
    // that has already reached pointerup.
    this.activePointerId = null;
    try {
      if (this.canvas.hasPointerCapture?.(pointerId)) {
        this.canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // A cancelled OS gesture may already have released capture.
    }
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('blur', this.onWindowBlur);
  }
}
