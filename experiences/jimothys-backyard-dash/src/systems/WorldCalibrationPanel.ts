import { WORLD_PRESENTATION_PROFILES } from '../assets/worldPresentationProfiles';
import type { WorldCameraCalibration } from './CameraRig';
import type { MintWorldCalibration } from './MintWorldStream';

export type WorldPresentationCalibration = MintWorldCalibration & WorldCameraCalibration;

type CalibrationCallbacks = {
  view: (worldIndex: number, checkpoint: number) => Promise<WorldPresentationCalibration | null>;
  adjust: (values: Partial<WorldPresentationCalibration>) => WorldPresentationCalibration | null;
};

type NumericField = keyof WorldPresentationCalibration;

const CHECKPOINTS = [
  { label: 'Entry', value: 0.04 },
  { label: '25%', value: 0.25 },
  { label: 'Center', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: 'Exit', value: 0.96 },
] as const;

const FIELDS: readonly {
  key: NumericField;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'x', label: 'Root X', min: -12, max: 12, step: 0.05 },
  { key: 'y', label: 'Root Y', min: -20, max: 20, step: 0.05 },
  { key: 'z', label: 'Root Z', min: -12, max: 24, step: 0.05 },
  { key: 'scale', label: 'Scale', min: 1, max: 4, step: 0.01 },
  { key: 'rotationX', label: 'Rotation X', min: -3.142, max: 3.142, step: 0.01 },
  { key: 'rotationY', label: 'Rotation Y', min: -3.142, max: 3.142, step: 0.01 },
  { key: 'rotationZ', label: 'Rotation Z', min: -3.142, max: 3.142, step: 0.01 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 0.8, step: 0.01 },
  { key: 'cameraHeight', label: 'Camera height', min: 2, max: 8, step: 0.05 },
  { key: 'cameraBack', label: 'Camera back', min: 6, max: 18, step: 0.05 },
  { key: 'cameraTargetX', label: 'Camera target X', min: -3, max: 3, step: 0.02 },
  { key: 'cameraTargetY', label: 'Camera target Y', min: 0.1, max: 4, step: 0.02 },
  { key: 'cameraLookAhead', label: 'Look ahead', min: 6, max: 35, step: 0.1 },
  { key: 'cameraFov', label: 'Camera FOV', min: 45, max: 75, step: 0.25 },
] as const;

export class WorldCalibrationPanel {
  private readonly root = document.createElement('aside');
  private readonly world = document.createElement('select');
  private readonly checkpoint = document.createElement('select');
  private readonly guides = document.createElement('div');
  private readonly metrics = document.createElement('div');
  private readonly inputs = new Map<NumericField, HTMLInputElement>();
  private readonly values = new Map<NumericField, HTMLElement>();
  private readonly output = document.createElement('pre');
  private readonly metricTimer: number;
  private busy = false;

  constructor(private readonly callbacks: CalibrationCallbacks) {
    this.root.className = 'world-calibration-panel';
    this.root.setAttribute('aria-label', 'Mint world calibration');
    this.guides.className = 'world-calibration-guides';
    this.guides.setAttribute('aria-hidden', 'true');
    this.guides.innerHTML = `
      <span class="calibration-safe-frame"></span>
      <span class="calibration-center-band"></span>
      <span class="calibration-centerline"></span>
      <span class="calibration-horizon"></span>
      <span class="calibration-crosshair"></span>
    `;

    const title = document.createElement('strong');
    title.textContent = 'World calibration';
    const subtitle = document.createElement('small');
    subtitle.textContent = 'Static RAD + collider · semantic framing';
    this.root.append(title, subtitle);

    WORLD_PRESENTATION_PROFILES.forEach((profile, index) => {
      this.world.add(new Option(profile.name, String(index)));
    });
    CHECKPOINTS.forEach((item) => this.checkpoint.add(new Option(item.label, String(item.value))));
    this.root.append(this.wrapSelect('World', this.world), this.wrapSelect('Checkpoint', this.checkpoint));

    for (const field of FIELDS) {
      const row = document.createElement('label');
      const label = document.createElement('span');
      const value = document.createElement('output');
      const input = document.createElement('input');
      label.textContent = field.label;
      input.type = 'range';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.addEventListener('input', () => {
        const next = this.callbacks.adjust({ [field.key]: Number(input.value) });
        if (next) this.renderValues(next);
      });
      row.append(label, value, input);
      this.inputs.set(field.key, input);
      this.values.set(field.key, value);
      this.root.append(row);
    }

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy transform JSON';
    copy.addEventListener('click', () => void navigator.clipboard?.writeText(this.output.textContent ?? ''));
    this.output.setAttribute('aria-live', 'polite');
    this.metrics.className = 'world-calibration-metrics';
    this.root.append(this.metrics, copy, this.output);

    this.world.addEventListener('change', () => void this.refresh());
    this.checkpoint.addEventListener('change', () => void this.refresh());
    document.querySelector('#app')?.append(this.guides, this.root);
    this.updateGuides();
    const onResize = () => this.updateGuides();
    window.addEventListener('resize', onResize);
    this.metricTimer = window.setInterval(() => this.renderMetrics(), 250);
    this.root.addEventListener('calibration-dispose', () => window.removeEventListener('resize', onResize), { once: true });
    void this.refresh();
  }

  dispose(): void {
    window.clearInterval(this.metricTimer);
    this.root.dispatchEvent(new Event('calibration-dispose'));
    this.guides.remove();
    this.root.remove();
  }

  private async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.root.classList.add('is-busy');
    const values = await this.callbacks.view(Number(this.world.value), Number(this.checkpoint.value));
    if (values) this.renderValues(values);
    this.updateGuides();
    this.busy = false;
    this.root.classList.remove('is-busy');
  }

  private renderValues(calibration: WorldPresentationCalibration): void {
    for (const field of FIELDS) {
      const value = calibration[field.key];
      const input = this.inputs.get(field.key);
      const output = this.values.get(field.key);
      if (input && document.activeElement !== input) input.value = String(value);
      if (output) output.textContent = value.toFixed(
        field.key === 'scale' || field.key === 'opacity' || field.key === 'cameraFov' ? 2 : 3,
      );
    }
    this.output.textContent = JSON.stringify(calibration, null, 2);
  }

  private updateGuides(): void {
    const profile = WORLD_PRESENTATION_PROFILES[Number(this.world.value)] ?? WORLD_PRESENTATION_PROFILES[0];
    const mobile = window.innerWidth < 720;
    const horizon = mobile ? profile.composition.horizonRatio.mobile : profile.composition.horizonRatio.desktop;
    const tolerance = profile.composition.centerTolerance;
    this.guides.style.setProperty('--calibration-horizon', `${horizon * 100}%`);
    this.guides.style.setProperty('--calibration-band-left', `${(0.5 - tolerance) * 100}%`);
    this.guides.style.setProperty('--calibration-band-width', `${tolerance * 200}%`);
  }

  private renderMetrics(): void {
    const worlds = window.__THREE_GAME_DIAGNOSTICS__?.worlds;
    if (!worlds) return;
    const quality = worlds.qualityReady ? 'crisp' : worlds.qualityForced ? 'bounded fallback' : 'refining';
    const centered = worlds.centered ? 'centered' : 'adjust framing';
    this.metrics.textContent = [
      worlds.qualityTier,
      `${worlds.activeLodSplats.toLocaleString()} active splats`,
      `${worlds.activeLoadedPages} pages`,
      quality,
      centered,
    ].join(' · ');
    this.metrics.classList.toggle('is-ready', worlds.qualityReady && worlds.centered);
  }

  private wrapSelect(labelText: string, select: HTMLSelectElement): HTMLLabelElement {
    const label = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(text, select);
    return label;
  }
}
