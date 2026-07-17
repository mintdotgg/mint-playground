import { Minimap, type MinimapSnapshot } from './Minimap';

export type HudSnapshot = {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  xp: number;
  xpTarget: number;
  level: number;
  coins: number;
  explosiveCost: number;
  explosiveReady: boolean;
  wave: number;
  maxWaves: number;
  enemiesRemaining: number;
  combo: number;
  minimap: Omit<MinimapSnapshot, 'wave' | 'maxWaves'>;
  boss?: { name: string; health: number; maxHealth: number };
};

export type UpgradeOption = {
  id: string;
  icon: string;
  label: string;
  description: string;
};

export type EndSnapshot = {
  victory: boolean;
  score: number;
  coins: number;
  wave: number;
  elapsed: number;
};

type HudCallbacks = {
  start(): void;
  resume(): void;
  restart(): void;
  mute(): boolean;
};

export class Hud {
  private readonly healthFill = this.getElement('#health-fill');
  private readonly healthValue = this.getElement('#health-value');
  private readonly staminaFill = this.getElement('#stamina-fill');
  private readonly staminaValue = this.getElement('#stamina-value');
  private readonly xpFill = this.getElement('#xp-fill');
  private readonly xpValue = this.getElement('#xp-value');
  private readonly levelValue = this.getElement('#level-value');
  private readonly weaponLevelFill = this.getElement('#weapon-level-fill');
  private readonly coinValue = this.getElement('#coin-value');
  private readonly explosiveStatus = this.getElement('#explosive-status');
  private readonly explosiveCost = this.getElement('#explosive-cost');
  private readonly blastButton = this.getButton('#blast-button');
  private readonly blastCost = this.getElement('#blast-cost');
  private readonly waveLabel = this.getElement('#wave-label');
  private readonly objectiveLine = this.getElement('#objective-line');
  private readonly bossMeter = this.getElement('#boss-meter');
  private readonly bossName = this.getElement('#boss-name');
  private readonly bossValue = this.getElement('#boss-value');
  private readonly bossFill = this.getElement('#boss-fill');
  private readonly comboLine = this.getElement('#combo-line');
  private readonly comboValue = this.getElement('#combo-value');
  private readonly eventBanner = this.getElement('#event-banner');
  private readonly reticle = this.getElement('#reticle');
  private readonly damageVignette = this.getElement('#damage-vignette');
  private readonly sprintVignette = this.getElement('#sprint-vignette');
  private readonly impactFlash = this.getElement('#impact-flash');
  private readonly loadingScreen = this.getElement('#loading-screen');
  private readonly loadingStatus = this.getElement('#loading-status');
  private readonly loadingDetail = this.getElement('#loading-detail');
  private readonly loadingFill = this.getElement('#loading-fill');
  private readonly introScreen = this.getElement('#intro-screen');
  private readonly pauseScreen = this.getElement('#pause-screen');
  private readonly upgradeScreen = this.getElement('#upgrade-screen');
  private readonly upgradeOptions = this.getElement('#upgrade-options');
  private readonly upgradeCountdown = this.getElement('#upgrade-countdown');
  private readonly upgradeTimerFill = this.getElement('#upgrade-timer-fill');
  private readonly endScreen = this.getElement('#end-screen');
  private readonly endEyebrow = this.getElement('#end-eyebrow');
  private readonly endTitle = this.getElement('#end-title');
  private readonly endSummary = this.getElement('#end-summary');
  private readonly endScore = this.getElement('#end-score');
  private readonly endCoins = this.getElement('#end-coins');
  private readonly endWave = this.getElement('#end-wave');
  private readonly endTime = this.getElement('#end-time');
  private readonly minimap = new Minimap(
    this.getCanvas('#minimap-canvas'),
    this.getElement('#minimap-level'),
    this.getElement('#minimap-count'),
  );
  private bannerTimer: number | null = null;
  private upgradeTimer: number | null = null;
  private upgradeKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private readonly endCountFrames = new Map<HTMLElement, number>();

  constructor(callbacks: HudCallbacks) {
    this.getButton('#start-button').addEventListener('click', callbacks.start);
    this.getButton('#resume-button').addEventListener('click', callbacks.resume);
    this.getButton('#restart-pause-button').addEventListener('click', callbacks.restart);
    this.getButton('#retry-button').addEventListener('click', callbacks.restart);
    this.getButton('#mute-button').addEventListener('click', (event) => {
      const muted = callbacks.mute();
      (event.currentTarget as HTMLButtonElement).textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
    });
  }

  setLoading(progress: number, status: string, detail: string): void {
    this.loadingScreen.classList.add('active');
    this.loadingStatus.textContent = status;
    this.loadingDetail.textContent = detail;
    this.loadingFill.style.width = `${Math.max(4, Math.min(100, progress * 100))}%`;
  }

  showLoadError(message: string): void {
    this.setLoading(1, 'The grove could not form', message);
    this.loadingFill.style.background = '#ff563f';
  }

  showIntro(): void {
    this.loadingScreen.classList.remove('active');
    this.introScreen.classList.add('active');
  }

  hideIntro(): void { this.introScreen.classList.remove('active'); }
  showPause(): void { this.pauseScreen.classList.add('active'); }
  hidePause(): void { this.pauseScreen.classList.remove('active'); }

  update(snapshot: HudSnapshot): void {
    this.healthFill.style.transform = `scaleX(${snapshot.health / snapshot.maxHealth})`;
    this.healthValue.textContent = `${Math.ceil(snapshot.health)}/${snapshot.maxHealth}`;
    this.staminaFill.style.transform = `scaleX(${snapshot.stamina / snapshot.maxStamina})`;
    this.staminaValue.textContent = `${Math.ceil(snapshot.stamina)}/${snapshot.maxStamina}`;
    this.xpFill.style.transform = `scaleX(${snapshot.xp / snapshot.xpTarget})`;
    this.xpValue.textContent = `${snapshot.xp}/${snapshot.xpTarget}`;
    this.levelValue.textContent = `LV ${snapshot.level}`;
    this.weaponLevelFill.style.transform = `scaleX(${Math.min(1, snapshot.xp / snapshot.xpTarget)})`;
    this.coinValue.textContent = String(snapshot.coins);
    this.explosiveCost.textContent = `${snapshot.explosiveCost} ◆`;
    this.blastCost.textContent = `${snapshot.explosiveCost}◆`;
    this.explosiveStatus.classList.toggle('ready', snapshot.explosiveReady);
    this.blastButton.classList.toggle('ready', snapshot.explosiveReady);
    this.explosiveStatus.setAttribute('aria-label', snapshot.explosiveReady
      ? `Grove Blast ready. Press E to spend ${snapshot.explosiveCost} coins.`
      : `Grove Blast costs ${snapshot.explosiveCost} coins.`);
    this.waveLabel.textContent = snapshot.boss ? 'THORNHEART RITUAL' : `GROVE I · WAVE ${snapshot.wave}/${snapshot.maxWaves}`;
    this.objectiveLine.textContent = snapshot.boss ? 'Break the glowing heart' : `${snapshot.enemiesRemaining} corrupted creature${snapshot.enemiesRemaining === 1 ? '' : 's'} remain`;
    this.comboLine.classList.toggle('hidden', snapshot.combo < 2);
    this.comboValue.textContent = String(snapshot.combo);
    this.minimap.update({
      ...snapshot.minimap,
      wave: snapshot.wave,
      maxWaves: snapshot.maxWaves,
    });
    if (snapshot.boss) {
      this.bossMeter.classList.remove('hidden');
      this.bossName.textContent = snapshot.boss.name.toUpperCase();
      this.bossValue.textContent = `${Math.ceil(snapshot.boss.health)}/${snapshot.boss.maxHealth}`;
      this.bossFill.style.transform = `scaleX(${snapshot.boss.health / snapshot.boss.maxHealth})`;
    } else {
      this.bossMeter.classList.add('hidden');
    }
  }

  setSprinting(active: boolean): void { this.sprintVignette.classList.toggle('active', active); }

  flashDamage(blocked: boolean): void {
    this.damageVignette.animate(
      [{ opacity: blocked ? .3 : .78 }, { opacity: 0 }],
      { duration: blocked ? 180 : 420, easing: 'ease-out' },
    );
  }

  flashHit(): void {
    this.reticle.classList.remove('hit');
    void this.reticle.offsetWidth;
    this.reticle.classList.add('hit');
  }

  flashKill(): void {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.impactFlash.animate(
      [{ opacity: reduced ? .12 : .36 }, { opacity: 0 }],
      { duration: reduced ? 70 : 135, easing: 'ease-out' },
    );
  }

  flashExplosion(): void {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.impactFlash.animate(
      [{ opacity: reduced ? .18 : .78 }, { opacity: 0 }],
      { duration: reduced ? 80 : 190, easing: 'ease-out' },
    );
  }

  pulseCoins(): void {
    this.coinValue.parentElement?.classList.remove('hud-punch');
    void this.coinValue.offsetWidth;
    this.coinValue.parentElement?.classList.add('hud-punch');
  }

  banner(message: string, duration = 1200): void {
    this.eventBanner.textContent = message;
    this.eventBanner.classList.remove('hidden');
    if (this.bannerTimer !== null) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.eventBanner.classList.add('hidden'), duration);
  }

  showUpgrade(options: readonly UpgradeOption[], onSelect: (id: string) => void, durationMs = 5000): void {
    this.hideUpgrade();
    this.upgradeOptions.replaceChildren();
    let chosen = false;
    const choose = (index: number) => {
      const option = options[index];
      if (chosen || !option) return;
      chosen = true;
      this.hideUpgrade();
      onSelect(option.id);
    };

    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-option';
      button.innerHTML = `<span class="upgrade-hotkey">${index + 1}</span><span class="upgrade-icon">${option.icon}</span><span class="upgrade-copy"><strong>${option.label}</strong><small>${option.description}</small></span>`;
      button.setAttribute('aria-label', `${index + 1}: ${option.label}. ${option.description}`);
      button.addEventListener('click', () => choose(index), { once: true });
      this.upgradeOptions.append(button);
    });

    this.upgradeKeyHandler = (event: KeyboardEvent) => {
      const digit = event.code.match(/^(?:Digit|Numpad)([1-3])$/)?.[1];
      if (!digit) return;
      event.preventDefault();
      choose(Number(digit) - 1);
    };
    window.addEventListener('keydown', this.upgradeKeyHandler);
    this.upgradeScreen.classList.add('active');

    const startedAt = performance.now();
    const tick = () => {
      const remaining = Math.max(0, durationMs - (performance.now() - startedAt));
      const ratio = remaining / durationMs;
      this.upgradeCountdown.textContent = (remaining / 1000).toFixed(1);
      this.upgradeTimerFill.style.transform = `scaleX(${ratio})`;
      if (remaining <= 0) {
        choose(0);
        return;
      }
      this.upgradeTimer = window.setTimeout(tick, 50);
    };
    tick();
  }

  hideUpgrade(): void {
    if (this.upgradeTimer !== null) window.clearTimeout(this.upgradeTimer);
    this.upgradeTimer = null;
    if (this.upgradeKeyHandler) window.removeEventListener('keydown', this.upgradeKeyHandler);
    this.upgradeKeyHandler = null;
    this.upgradeScreen.classList.remove('active');
  }

  showEnd(snapshot: EndSnapshot): void {
    this.cancelEndCounters();
    this.pauseScreen.classList.remove('active');
    this.endEyebrow.textContent = snapshot.victory ? 'THE OLD GROVE BREATHES AGAIN' : 'THE THORNS CLOSE IN';
    this.endTitle.textContent = snapshot.victory ? 'THORNHEART BROKEN' : 'RUN ENDED';
    this.endSummary.textContent = snapshot.victory ? 'The ritual is shattered. Your blade leaves the grove brighter than it found it.' : 'Read the attack rings, guard the heavy blows, and keep stamina for the next opening.';
    this.endScreen.classList.add('active');
    this.countTo(this.endScore, snapshot.score, 1250, (value) => Math.round(value).toLocaleString('en-US'));
    this.countTo(this.endCoins, snapshot.coins, 900, (value) => String(Math.round(value)));
    this.countTo(this.endWave, snapshot.wave, 650, (value) => String(Math.round(value)));
    this.countTo(this.endTime, snapshot.elapsed, 1100, (value) => this.formatTime(value));
  }

  hideEnd(): void {
    this.cancelEndCounters();
    this.endScreen.classList.remove('active');
  }

  private countTo(element: HTMLElement, target: number, duration: number, format: (value: number) => string): void {
    const finalValue = Math.max(0, target);
    element.textContent = format(0);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = format(finalValue);
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(finalValue * eased);
      if (progress < 1) {
        this.endCountFrames.set(element, requestAnimationFrame(tick));
        return;
      }
      this.endCountFrames.delete(element);
      element.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.08)', filter: 'brightness(1.35)' }, { transform: 'scale(1)' }],
        { duration: 240, easing: 'ease-out' },
      );
    };
    this.endCountFrames.set(element, requestAnimationFrame(tick));
  }

  private cancelEndCounters(): void {
    for (const frame of this.endCountFrames.values()) cancelAnimationFrame(frame);
    this.endCountFrames.clear();
  }

  private formatTime(value: number): string {
    const wholeSeconds = Math.max(0, Math.floor(value));
    const minutes = Math.floor(wholeSeconds / 60).toString().padStart(2, '0');
    const seconds = (wholeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }

  private getButton(selector: string): HTMLButtonElement {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (!button) throw new Error(`Missing UI button: ${selector}`);
    return button;
  }

  private getCanvas(selector: string): HTMLCanvasElement {
    const canvas = document.querySelector<HTMLCanvasElement>(selector);
    if (!canvas) throw new Error(`Missing UI canvas: ${selector}`);
    return canvas;
  }
}
