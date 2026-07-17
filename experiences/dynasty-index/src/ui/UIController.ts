import type { AppState, CardProfile } from '../types';

export interface UIHandlers {
  onSelect: (index: number) => void;
  onFlip: () => void;
  onInspect: () => void;
  onReset: () => void;
  onNotes: () => void;
  onMute: () => void;
  onUnlockAudio: () => void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing interface element: ${selector}`);
  return element;
}

export class UIController {
  readonly canvas: HTMLCanvasElement;

  private readonly shell: HTMLElement;
  private readonly profileIndex: HTMLElement;
  private readonly sport: HTMLElement;
  private readonly player: HTMLElement;
  private readonly archetype: HTMLElement;
  private readonly era: HTMLElement;
  private readonly treatment: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly rarity: HTMLElement;
  private readonly edition: HTMLElement;
  private readonly grade: HTMLElement;
  private readonly status: HTMLElement;
  private readonly liveRegion: HTMLElement;
  private readonly flipButton: HTMLButtonElement;
  private readonly inspectButton: HTMLButtonElement;
  private readonly notesButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly notesPanel: HTMLElement;
  private readonly notesTitle: HTMLElement;
  private readonly notesBody: HTMLElement;
  private readonly notesMaterial: HTMLElement;
  private readonly notesProvenance: HTMLElement;
  private readonly selectorButtons: HTMLButtonElement[];
  private readonly loading: HTMLElement;

  constructor(root: HTMLElement, cards: CardProfile[], handlers: UIHandlers) {
    root.innerHTML = `
      <main class="app-shell" aria-label="Dynasty Index collector vault">
        <div class="render-surface" aria-hidden="true">
          <canvas id="vault-canvas"></canvas>
        </div>

        <div class="loading-screen" role="status" aria-live="polite">
          <div class="loading-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <p>Accessing archive</p>
          <div class="loading-line"><span></span></div>
        </div>

        <div class="hud">
          <header class="topline">
            <div class="brand-lockup" aria-label="Dynasty Index">
              <span class="brand-glyph" aria-hidden="true">DI</span>
              <span class="brand-name">Dynasty<br />Index</span>
              <span class="brand-meta">Private archive<br />Collection 01—06</span>
            </div>
            <div class="archive-status">
              <span class="status-dot" aria-hidden="true"></span>
              <span data-status>Preparing specimen</span>
            </div>
            <button class="icon-button sound-toggle" type="button" aria-label="Mute audio" aria-pressed="false">
              <span class="sound-icon" aria-hidden="true"><i></i><i></i><i></i></span>
              <span data-sound-label>Sound on</span>
            </button>
          </header>

          <section class="profile-panel" aria-labelledby="profile-player">
            <div class="profile-kicker">
              <span class="profile-index" data-profile-index>01</span>
              <span data-sport>Basketball</span>
            </div>
            <div class="accent-rule" aria-hidden="true"><span></span></div>
            <h1 id="profile-player" data-player>Jalen Quill</h1>
            <p class="profile-archetype" data-archetype>The Vertical Phenom</p>
            <div class="profile-era">
              <span>Visual record</span>
              <strong data-era>Contemporary Kinetic / 2026</strong>
            </div>
            <p class="treatment" data-treatment>Prismatic foil + clear overlay</p>
            <dl class="stat-grid" data-stats></dl>
            <dl class="specimen-meta">
              <div><dt>Rarity</dt><dd data-rarity></dd></div>
              <div><dt>Edition</dt><dd data-edition></dd></div>
              <div><dt>Condition</dt><dd data-grade></dd></div>
            </dl>
          </section>

          <div class="interaction-copy" aria-hidden="true">
            <span>Drag to orbit</span>
            <span>Scroll to inspect depth</span>
          </div>

          <nav class="action-rail" aria-label="Inspection controls">
            <button type="button" data-action="flip"><span>F</span><strong>View reverse</strong></button>
            <button type="button" data-action="inspect"><span>I</span><strong>Inspect</strong></button>
            <button type="button" data-action="notes"><span>N</span><strong>Notes</strong></button>
            <button type="button" data-action="reset"><span>R</span><strong>Reset view</strong></button>
          </nav>

          <nav class="card-selector" aria-label="Select a card">
            <div class="selector-label">
              <span>Collection</span>
              <strong>Six specimens</strong>
            </div>
            <div class="selector-track">
              ${cards
                .map(
                  (card, index) => `
                    <button type="button" class="selector-item" data-card-index="${index}" aria-label="${card.index}: ${card.player}, ${card.sport}">
                      <span class="selector-number">${card.index}</span>
                      <span class="selector-copy"><strong>${card.player}</strong><small>${card.sport}</small></span>
                      <i aria-hidden="true"></i>
                    </button>`,
                )
                .join('')}
            </div>
          </nav>

          <aside class="collector-notes" aria-hidden="true" aria-labelledby="notes-heading">
            <div class="notes-topline">
              <span>Collector notes</span>
              <button type="button" data-close-notes aria-label="Close collector notes">Close</button>
            </div>
            <p class="notes-index" data-notes-title></p>
            <h2 id="notes-heading">Surface & provenance</h2>
            <p class="notes-body" data-notes-body></p>
            <dl>
              <div><dt>Construction</dt><dd data-notes-material></dd></div>
              <div><dt>Archive record</dt><dd data-notes-provenance></dd></div>
            </dl>
          </aside>
        </div>
        <div class="sr-only" aria-live="polite" data-live-region></div>
      </main>
    `;

    this.shell = requireElement(root, '.app-shell');
    this.canvas = requireElement(root, '#vault-canvas');
    this.profileIndex = requireElement(root, '[data-profile-index]');
    this.sport = requireElement(root, '[data-sport]');
    this.player = requireElement(root, '[data-player]');
    this.archetype = requireElement(root, '[data-archetype]');
    this.era = requireElement(root, '[data-era]');
    this.treatment = requireElement(root, '[data-treatment]');
    this.stats = requireElement(root, '[data-stats]');
    this.rarity = requireElement(root, '[data-rarity]');
    this.edition = requireElement(root, '[data-edition]');
    this.grade = requireElement(root, '[data-grade]');
    this.status = requireElement(root, '[data-status]');
    this.liveRegion = requireElement(root, '[data-live-region]');
    this.flipButton = requireElement(root, '[data-action="flip"]');
    this.inspectButton = requireElement(root, '[data-action="inspect"]');
    this.notesButton = requireElement(root, '[data-action="notes"]');
    this.muteButton = requireElement(root, '.sound-toggle');
    this.notesPanel = requireElement(root, '.collector-notes');
    this.notesTitle = requireElement(root, '[data-notes-title]');
    this.notesBody = requireElement(root, '[data-notes-body]');
    this.notesMaterial = requireElement(root, '[data-notes-material]');
    this.notesProvenance = requireElement(root, '[data-notes-provenance]');
    this.selectorButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-card-index]'));
    this.loading = requireElement(root, '.loading-screen');

    this.selectorButtons.forEach((button) => {
      button.addEventListener('click', () => {
        handlers.onUnlockAudio();
        handlers.onSelect(Number(button.dataset.cardIndex));
      });
    });
    this.flipButton.addEventListener('click', () => {
      handlers.onUnlockAudio();
      handlers.onFlip();
    });
    this.inspectButton.addEventListener('click', () => {
      handlers.onUnlockAudio();
      handlers.onInspect();
    });
    this.notesButton.addEventListener('click', handlers.onNotes);
    requireElement<HTMLButtonElement>(root, '[data-action="reset"]').addEventListener('click', handlers.onReset);
    requireElement<HTMLButtonElement>(root, '[data-close-notes]').addEventListener('click', handlers.onNotes);
    this.muteButton.addEventListener('click', () => {
      handlers.onUnlockAudio();
      handlers.onMute();
    });
  }

  render(card: CardProfile, state: AppState): void {
    this.shell.style.setProperty('--accent', card.accent);
    this.shell.style.setProperty('--accent-secondary', card.accentSecondary);
    this.profileIndex.textContent = card.index;
    this.sport.textContent = card.sport;
    this.player.textContent = card.player;
    this.archetype.textContent = card.archetype;
    this.era.textContent = card.era;
    this.treatment.textContent = card.treatmentLabel;
    this.rarity.textContent = card.rarity;
    this.edition.textContent = card.edition;
    this.grade.textContent = `${card.grade} / ${card.gradeLabel}`;
    this.stats.replaceChildren(
      ...card.stats.map((stat) => {
        const wrapper = document.createElement('div');
        const term = document.createElement('dt');
        const value = document.createElement('dd');
        term.textContent = stat.label;
        value.textContent = stat.value;
        wrapper.append(term, value);
        return wrapper;
      }),
    );

    this.notesTitle.textContent = `${card.index} — ${card.player} / ${card.title}`;
    this.notesBody.textContent = card.collectorNotes;
    this.notesMaterial.textContent = card.material;
    this.notesProvenance.textContent = card.provenance;

    this.selectorButtons.forEach((button, index) => {
      const selected = index === state.selectedIndex;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-current', selected ? 'true' : 'false');
      button.disabled = state.transitioning;
    });

    this.flipButton.querySelector('strong')!.textContent = state.side === 'front' ? 'View reverse' : 'View front';
    this.flipButton.setAttribute('aria-pressed', String(state.side === 'back'));
    this.inspectButton.querySelector('strong')!.textContent = state.inspection ? 'Exit focus' : 'Inspect';
    this.inspectButton.setAttribute('aria-pressed', String(state.inspection));
    this.notesButton.setAttribute('aria-pressed', String(state.notesOpen));
    this.muteButton.setAttribute('aria-pressed', String(state.muted));
    this.muteButton.setAttribute('aria-label', state.muted ? 'Enable audio' : 'Mute audio');
    requireElement(this.muteButton, '[data-sound-label]').textContent = state.muted ? 'Sound off' : 'Sound on';

    this.shell.classList.toggle('is-inspecting', state.inspection);
    this.shell.classList.toggle('notes-open', state.notesOpen);
    this.notesPanel.setAttribute('aria-hidden', String(!state.notesOpen));
  }

  setStatus(message: string, announce = false): void {
    this.status.textContent = message;
    if (announce) this.liveRegion.textContent = message;
  }

  setReady(): void {
    this.loading.classList.add('is-complete');
    window.setTimeout(() => this.loading.setAttribute('hidden', ''), 700);
  }

  setError(message: string): void {
    this.loading.classList.add('has-error');
    const label = this.loading.querySelector('p');
    if (label) label.textContent = message;
  }
}
