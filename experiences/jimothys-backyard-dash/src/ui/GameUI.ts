import type { AudioSettings } from '../systems/AudioSystem';
import type { GamePhase, RaceResult, RaceSnapshot } from '../game/types';
import type { MintWorldStreamStatus } from '../systems/MintWorldStream';

type UiActions = {
  start: () => void;
  startEndless: () => void;
  resume: () => void;
  retry: () => void;
  restart: () => void;
  menu: () => void;
  pause: () => void;
  reload: () => void;
  audio: (settings: Partial<AudioSettings>) => void;
  reducedMotion: (value: boolean) => void;
};

const ordinal = (value: number): string => `${value}${value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'}`;

export function formatTime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  const tenths = Math.floor((value % 1) * 10);
  return `${minutes}:${seconds}.${tenths}`;
}

export class GameUI {
  private readonly loading = this.get('#loading-screen');
  private readonly mainMenu = this.get('#main-menu');
  private readonly hud = this.get('#hud');
  private readonly boost = this.get<HTMLButtonElement>('#boost-button');
  private readonly countdown = this.get('#countdown');
  private readonly sectionBanner = this.get('#section-banner');
  private readonly pausePanel = this.get('#pause-panel');
  private readonly helpPanel = this.get('#help-panel');
  private readonly settingsPanel = this.get('#settings-panel');
  private readonly resultsPanel = this.get('#results-panel');
  private readonly failedPanel = this.get('#failed-panel');
  private readonly loadingFill = this.get('#loading-fill');
  private readonly loadingLabel = this.get('#loading-label');
  private readonly loadError = this.get('#load-error');
  private readonly loadErrorMessage = this.get('#load-error-message');
  private readonly position = this.get('#position-value');
  private readonly speed = this.get('#speed-value');
  private readonly paceCounter = this.get('#pace-counter');
  private readonly startIntro = this.get('#start-intro');
  private readonly section = this.get('#section-value');
  private readonly timer = this.get('#timer-value');
  private readonly progress = this.get('#course-progress-fill');
  private readonly progressTrack = this.get('.course-progress');
  private readonly tokens = this.get('#token-value');
  private readonly combo = this.get('#combo-value');
  private readonly mischief = this.get('#mischief-fill');
  private readonly mischiefLabel = this.get('#mischief-label');
  private readonly powerStatus = this.get('#power-status');
  private readonly flash = this.get('#feedback-flash');
  private readonly failedSummary = this.get('#failed-summary');
  private readonly worldStreamStatus = this.get('#world-stream-status');
  private readonly worldStreamLabel = this.get('#world-stream-label');
  private readonly acorns = Array.from(document.querySelectorAll<HTMLElement>('.acorn'));
  private activePanel: HTMLElement | null = null;
  private phase: GamePhase = 'loading';
  private cleanup: (() => void)[] = [];
  private worldStatusTimer = 0;

  constructor(actions: UiActions, audioSettings: AudioSettings, reducedMotion: boolean) {
    this.bind('#start-button', actions.start);
    this.bind('#endless-button', actions.startEndless);
    this.bind('#pause-button', actions.pause);
    this.bind('#resume-button', actions.resume);
    this.bind('#retry-button', actions.retry);
    this.bind('#failed-retry-button', actions.retry);
    this.bind('#restart-button', actions.restart);
    this.bind('#menu-button', actions.menu);
    this.bind('#results-menu-button', actions.menu);
    this.bind('#failed-menu-button', actions.menu);
    this.bind('#reload-button', actions.reload);
    this.bind('#help-button', () => this.openPanel(this.helpPanel));
    this.bind('#settings-button', () => this.openPanel(this.settingsPanel));
    this.bind('#pause-settings-button', () => this.openPanel(this.settingsPanel));
    document.querySelectorAll<HTMLElement>('[data-close-panel]').forEach((button) => {
      const handler = () => this.closePanel();
      button.addEventListener('click', handler);
      this.cleanup.push(() => button.removeEventListener('click', handler));
    });

    this.wireRange('#master-volume', audioSettings.master, (value) => actions.audio({ master: value }));
    this.wireRange('#music-volume', audioSettings.music, (value) => actions.audio({ music: value }));
    this.wireRange('#effects-volume', audioSettings.effects, (value) => actions.audio({ effects: value }));
    this.wireToggle('#mute-toggle', audioSettings.muted, (value) => actions.audio({ muted: value }));
    this.wireToggle('#motion-toggle', reducedMotion, actions.reducedMotion);
  }

  setLoading(loaded: number, total: number, label: string): void {
    const ratio = total <= 0 ? 0 : loaded / total;
    this.loadingFill.style.width = `${Math.round(ratio * 100)}%`;
    this.loadingLabel.textContent = `${label} · ${Math.round(ratio * 100)}%`;
  }

  showLoadError(message: string): void {
    this.loadError.hidden = false;
    this.loadErrorMessage.textContent = message;
  }

  render(snapshot: RaceSnapshot): void {
    if (snapshot.phase !== this.phase) this.setPhase(snapshot.phase);
    this.position.textContent = ordinal(snapshot.position);
    this.speed.textContent = String(Math.round((snapshot.racers[0]?.speed ?? 0) * 3.6));
    this.paceCounter.classList.toggle('is-hot', snapshot.speedMultiplier >= 1.2);
    // Race and Endless share the same starting-line presentation. The loop
    // marker appears only once the endless run is actually underway.
    this.section.textContent = snapshot.mode === 'endless' && snapshot.phase !== 'countdown'
      ? `Loop ${snapshot.lap} · ${snapshot.sectionName}`
      : snapshot.sectionName;
    this.timer.textContent = formatTime(snapshot.elapsed);
    this.progress.style.width = `${snapshot.progress * 100}%`;
    this.progressTrack.classList.toggle('is-endless', snapshot.mode === 'endless');
    this.tokens.textContent = String(snapshot.tokens);
    this.combo.textContent = `×${Math.max(1, snapshot.combo)}`;
    this.mischief.style.width = `${snapshot.mischief}%`;
    this.boost.disabled = snapshot.mischief < 100 || snapshot.phase !== 'racing';
    this.boost.classList.toggle('is-ready', snapshot.mischief >= 100);
    this.mischiefLabel.textContent = snapshot.mischief >= 100 ? 'Boost ready!' : 'Gather Moon Tokens';
    this.acorns.forEach((acorn, index) => acorn.classList.toggle('is-full', index < snapshot.badges));
    const statuses: string[] = [];
    if (snapshot.shield) statuses.push('Cardboard Shield');
    if (snapshot.magnetTime > 0) statuses.push(`Glove Magnet ${Math.ceil(snapshot.magnetTime)}s`);
    if (snapshot.boostTime > 0) statuses.push(`Boost ${Math.ceil(snapshot.boostTime)}s`);
    this.powerStatus.hidden = statuses.length === 0;
    this.powerStatus.textContent = statuses.join(' · ');
    this.failedSummary.textContent = snapshot.mode === 'endless'
      ? `Loop ${snapshot.lap} · ${Math.floor(snapshot.racers[0]?.distance ?? 0).toLocaleString()} m · ${snapshot.tokens} Moon Tokens`
      : 'Jimothy is already ready for another dash.';
    if (snapshot.result) this.renderResults(snapshot.result);
  }

  showCountdown(value: number | 'GO'): void {
    this.countdown.textContent = String(value);
    this.countdown.classList.remove('is-popping');
    void this.countdown.offsetWidth;
    this.countdown.classList.add('is-popping');
  }

  showSection(name: string): void {
    const strong = this.sectionBanner.querySelector('strong');
    if (strong) strong.textContent = name.toUpperCase();
    this.sectionBanner.classList.remove('is-visible');
    void this.sectionBanner.offsetWidth;
    this.sectionBanner.classList.add('is-visible');
  }

  showWorldStreamStatus(status: MintWorldStreamStatus): void {
    window.clearTimeout(this.worldStatusTimer);
    this.worldStreamStatus.className = `world-stream-status is-${status.state}`;
    this.worldStreamLabel.textContent = status.message;
    this.worldStreamStatus.hidden = false;
    if (status.state !== 'loading') {
      this.worldStatusTimer = window.setTimeout(() => { this.worldStreamStatus.hidden = true; }, status.state === 'ready' ? 1200 : 3200);
    }
  }

  pulsePace(): void {
    this.paceCounter.classList.remove('is-surging');
    void this.paceCounter.offsetWidth;
    this.paceCounter.classList.add('is-surging');
  }

  feedback(type: 'token' | 'collision' | 'boost' | 'finish'): void {
    this.flash.className = '';
    void this.flash.offsetWidth;
    this.flash.classList.add(`is-${type}`);
  }

  updateMenuRecord(best: number | null, pickups: number | null): void {
    this.get('#menu-record').textContent = `Best time ${formatTime(best)} · Best tokens ${pickups ?? '—'}`;
  }

  dispose(): void {
    window.clearTimeout(this.worldStatusTimer);
    for (const cleanup of this.cleanup) cleanup();
    this.cleanup = [];
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.loading.classList.toggle('is-visible', phase === 'loading' || phase === 'boot');
    this.mainMenu.classList.toggle('is-visible', phase === 'menu');
    this.startIntro.classList.toggle('is-visible', phase === 'countdown');
    const inRace = phase === 'countdown' || phase === 'racing' || phase === 'paused';
    this.hud.classList.toggle('is-visible', inRace);
    this.boost.classList.toggle('is-visible', inRace);
    this.pausePanel.classList.toggle('is-visible', phase === 'paused');
    this.resultsPanel.classList.toggle('is-visible', phase === 'finished');
    this.failedPanel.classList.toggle('is-visible', phase === 'failed');
    if (phase !== 'paused') this.closePanel();
  }

  private renderResults(result: RaceResult): void {
    this.get('#result-place').textContent = ordinal(result.place);
    this.get('#result-time').textContent = formatTime(result.time);
    this.get('#result-tokens').textContent = String(result.tokens);
    this.get('#result-best').textContent = formatTime(result.bestTime);
    this.get('#result-record').textContent = String(result.pickupRecord);
    const list = this.get('#split-list');
    list.replaceChildren(...result.splits.map((split, index) => {
      const row = document.createElement('div');
      row.innerHTML = `<span>${index === result.splits.length - 1 ? 'Finish' : `Checkpoint ${index + 1}`}</span><strong>${formatTime(split)}</strong>`;
      return row;
    }));
  }

  private openPanel(panel: HTMLElement): void {
    this.closePanel();
    this.activePanel = panel;
    panel.classList.add('is-visible');
    window.setTimeout(() => panel.querySelector<HTMLElement>('button, input')?.focus(), 0);
  }

  private closePanel(): void {
    if (!this.activePanel) return;
    this.activePanel.classList.remove('is-visible');
    this.activePanel = null;
  }

  private bind(selector: string, callback: () => void): void {
    const element = this.get<HTMLButtonElement>(selector);
    element.addEventListener('click', callback);
    this.cleanup.push(() => element.removeEventListener('click', callback));
  }

  private wireRange(selector: string, value: number, callback: (value: number) => void): void {
    const input = this.get<HTMLInputElement>(selector);
    input.value = String(value);
    const handler = () => callback(Number(input.value));
    input.addEventListener('input', handler);
    this.cleanup.push(() => input.removeEventListener('input', handler));
  }

  private wireToggle(selector: string, value: boolean, callback: (value: boolean) => void): void {
    const input = this.get<HTMLInputElement>(selector);
    input.checked = value;
    const handler = () => callback(input.checked);
    input.addEventListener('change', handler);
    this.cleanup.push(() => input.removeEventListener('change', handler));
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
