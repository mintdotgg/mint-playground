import * as THREE from 'three';

type PointerState = {
  active: boolean;
  id: number | null;
  centerX: number;
  centerY: number;
  radius: number;
};

type LookPointer = {
  id: number | null;
  x: number;
  y: number;
};

export class InputController {
  private readonly keys = new Set<string>();
  private readonly movement = new THREE.Vector2();
  private readonly stickMovement = new THREE.Vector2();
  private readonly lookDelta = new THREE.Vector2();
  private readonly pointerState: PointerState = {
    active: false,
    id: null,
    centerX: 0,
    centerY: 0,
    radius: 1,
  };
  private readonly lookPointer: LookPointer = { id: null, x: 0, y: 0 };

  private attackQueued = false;
  private explosiveQueued = false;
  private guardDown = false;
  private sprintDown = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stick: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly slashButton: HTMLButtonElement,
    private readonly guardButton: HTMLButtonElement,
    private readonly sprintButton: HTMLButtonElement,
    private readonly blastButton: HTMLButtonElement,
    private readonly onPauseRequest: () => void,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearHeldInputs);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.stick.addEventListener('pointerdown', this.onStickDown);
    this.stick.addEventListener('pointermove', this.onStickMove);
    this.stick.addEventListener('pointerup', this.onStickUp);
    this.stick.addEventListener('pointercancel', this.onStickUp);
    this.bindHoldButton(this.guardButton, (value) => { this.guardDown = value; });
    this.bindHoldButton(this.sprintButton, (value) => { this.sprintDown = value; });
    this.slashButton.addEventListener('pointerdown', this.onSlashDown);
    this.blastButton.addEventListener('pointerdown', this.onBlastDown);
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestPointerLock(): void {
    if (matchMedia('(pointer: coarse)').matches) return;
    void this.canvas.requestPointerLock().catch(() => undefined);
  }

  readMovement(target: THREE.Vector2): THREE.Vector2 {
    this.movement.set(0, 0);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.movement.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.movement.x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.movement.y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.movement.y -= 1;
    this.movement.add(this.stickMovement);
    if (this.movement.lengthSq() > 1) this.movement.normalize();
    return target.copy(this.movement);
  }

  consumeLook(target: THREE.Vector2): THREE.Vector2 {
    target.copy(this.lookDelta);
    this.lookDelta.set(0, 0);
    return target;
  }

  consumeAttack(): boolean {
    const queued = this.attackQueued;
    this.attackQueued = false;
    return queued;
  }

  consumeExplosive(): boolean {
    const queued = this.explosiveQueued;
    this.explosiveQueued = false;
    return queued;
  }

  isGuardHeld(): boolean {
    return this.guardDown || this.keys.has('KeyQ');
  }

  isSprintHeld(): boolean {
    return this.sprintDown || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearHeldInputs);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.stick.removeEventListener('pointerdown', this.onStickDown);
    this.stick.removeEventListener('pointermove', this.onStickMove);
    this.stick.removeEventListener('pointerup', this.onStickUp);
    this.stick.removeEventListener('pointercancel', this.onStickUp);
    this.slashButton.removeEventListener('pointerdown', this.onSlashDown);
    this.blastButton.removeEventListener('pointerdown', this.onBlastDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && !event.repeat) {
      event.preventDefault();
      this.onPauseRequest();
      return;
    }
    this.keys.add(event.code);
    if ((event.code === 'Space' || event.code === 'KeyF') && !event.repeat) this.attackQueued = true;
    if (event.code === 'KeyE' && !event.repeat) this.explosiveQueued = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.isPointerLocked) return;
    this.lookDelta.x += event.movementX;
    this.lookDelta.y += event.movementY;
  };

  private readonly onCanvasPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      if (event.button === 0) this.attackQueued = true;
      if (event.button === 2) this.guardDown = true;
      return;
    }
    if (this.lookPointer.id !== null) return;
    this.lookPointer.id = event.pointerId;
    this.lookPointer.x = event.clientX;
    this.lookPointer.y = event.clientY;
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic pointer. */ }
  };

  private readonly onCanvasPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.lookPointer.id) return;
    this.lookDelta.x += (event.clientX - this.lookPointer.x) * 1.4;
    this.lookDelta.y += (event.clientY - this.lookPointer.y) * 1.4;
    this.lookPointer.x = event.clientX;
    this.lookPointer.y = event.clientY;
  };

  private readonly onCanvasPointerUp = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button === 2) this.guardDown = false;
    if (event.pointerId === this.lookPointer.id) this.lookPointer.id = null;
  };

  private readonly onStickDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = this.stick.getBoundingClientRect();
    this.pointerState.active = true;
    this.pointerState.id = event.pointerId;
    this.pointerState.centerX = rect.left + rect.width / 2;
    this.pointerState.centerY = rect.top + rect.height / 2;
    this.pointerState.radius = rect.width * 0.42;
    try { this.stick.setPointerCapture(event.pointerId); } catch { /* Synthetic pointer. */ }
    this.updateStick(event.clientX, event.clientY);
  };

  private readonly onStickMove = (event: PointerEvent) => {
    if (!this.pointerState.active || event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.updateStick(event.clientX, event.clientY);
  };

  private readonly onStickUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.pointerState.active = false;
    this.pointerState.id = null;
    this.stickMovement.set(0, 0);
    this.updateKnob();
  };

  private readonly onSlashDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.attackQueued = true;
  };

  private readonly onBlastDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.explosiveQueued = true;
  };

  private readonly preventContextMenu = (event: MouseEvent) => event.preventDefault();
  private readonly onVisibilityChange = () => { if (document.hidden) this.clearHeldInputs(); };

  private readonly clearHeldInputs = () => {
    this.keys.clear();
    this.attackQueued = false;
    this.explosiveQueued = false;
    this.guardDown = false;
    this.sprintDown = false;
    this.stickMovement.set(0, 0);
    this.lookDelta.set(0, 0);
    this.updateKnob();
  };

  private bindHoldButton(button: HTMLButtonElement, setter: (value: boolean) => void): void {
    const down = (event: PointerEvent) => { event.preventDefault(); event.stopPropagation(); setter(true); };
    const up = (event: PointerEvent) => { event.preventDefault(); setter(false); };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
  }

  private updateStick(clientX: number, clientY: number): void {
    const dx = clientX - this.pointerState.centerX;
    const dy = clientY - this.pointerState.centerY;
    this.stickMovement.set(dx / this.pointerState.radius, -dy / this.pointerState.radius);
    if (this.stickMovement.lengthSq() > 1) this.stickMovement.normalize();
    this.updateKnob();
  }

  private updateKnob(): void {
    const distance = 39;
    this.knob.style.transform = `translate(calc(-50% + ${this.stickMovement.x * distance}px), calc(-50% + ${-this.stickMovement.y * distance}px))`;
  }
}
