import type { SkinDef } from '../skins/types'
import type { ExperienceMode } from '../app'

export function setupGate(onStart: () => void) {
  const gate = document.getElementById('gate')!
  const btn = document.getElementById('gate-btn')!
  const start = () => {
    onStart()
    gate.classList.add('hidden')
    document.getElementById('dock')?.classList.add('on')
    const hint = document.getElementById('hint')
    hint?.classList.add('on')
    window.setTimeout(() => hint?.classList.replace('on', 'off'), 9000)
  }
  btn.addEventListener('click', start, { once: true })
}

export function setupDock(skins: SkinDef[], onPick: (id: string) => void, onResetView: () => void) {
  const chipsHost = document.getElementById('dock-chips')!
  document.getElementById('view-reset')?.addEventListener('click', onResetView)
  const chips = new Map<string, HTMLButtonElement>()
  for (const s of skins) {
    const b = document.createElement('button')
    b.className = 'chip'
    b.type = 'button'
    b.textContent = s.name.slice(0, 2).toUpperCase()
    b.title = s.name
    b.setAttribute('aria-label', `Select ${s.name} player`)
    b.setAttribute('aria-pressed', 'false')
    b.style.setProperty('--chip-bg', `#${s.palette.selector.toString(16).padStart(6, '0')}`)
    b.style.setProperty('--chip-fg', `#${s.palette.selectorInk.toString(16).padStart(6, '0')}`)
    b.addEventListener('click', () => onPick(s.id))
    chipsHost.appendChild(b)
    chips.set(s.id, b)
  }
  return {
    setActive(id: string) {
      for (const [k, b] of chips) {
        const active = k === id
        b.classList.toggle('active', active)
        b.setAttribute('aria-pressed', String(active))
      }
      const def = skins.find((s) => s.id === id)
      if (def) {
        document.documentElement.style.setProperty('--accent', `#${def.palette.accent.toString(16).padStart(6, '0')}`)
      }
    },
    setLocked(locked: boolean) {
      for (const button of chips.values()) button.disabled = locked
    },
  }
}

export function setupPortalControls(
  onEnter: () => void,
  onExit: () => void,
  onTogglePlayback: () => void,
  onNextTrack: () => void,
) {
  const enter = document.getElementById('portal-enter') as HTMLButtonElement
  const exit = document.getElementById('dance-exit') as HTMLButtonElement
  const floorControls = document.getElementById('floor-controls')!
  const play = document.getElementById('floor-play') as HTMLButtonElement
  const next = document.getElementById('floor-next') as HTMLButtonElement
  let powered = false
  let playing = false
  let mode: ExperienceMode = 'cd'

  const sync = () => {
    const enterVisible = powered && mode === 'cd'
    enter.classList.toggle('on', enterVisible)
    enter.tabIndex = enterVisible ? 0 : -1
    const exitVisible = powered && mode === 'floor'
    exit.classList.toggle('on', exitVisible)
    exit.tabIndex = exitVisible ? 0 : -1
    floorControls.classList.toggle('on', exitVisible)
    floorControls.setAttribute('aria-hidden', String(!exitVisible))
    play.tabIndex = exitVisible ? 0 : -1
    next.tabIndex = exitVisible ? 0 : -1
  }

  const syncPlayback = () => {
    play.textContent = playing ? 'PAUSE' : 'PLAY'
    play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music')
    play.setAttribute('aria-pressed', String(playing))
  }

  enter.addEventListener('click', onEnter)
  exit.addEventListener('click', onExit)
  play.addEventListener('click', onTogglePlayback)
  next.addEventListener('click', onNextTrack)
  syncPlayback()

  return {
    setPowered(value: boolean) {
      powered = value
      sync()
    },
    setMode(value: ExperienceMode) {
      mode = value
      sync()
    },
    setPlaying(value: boolean) {
      playing = value
      syncPlayback()
    },
  }
}
