import './styles.css'
import { CharacterShowcase } from './showcase'
import { roster } from './roster'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App root not found')

app.innerHTML = `
  <main class="experience" aria-label="Vanguard Protocol character selector">
    <div id="viewport" aria-hidden="true"></div>

    <header class="topline">
      <div class="brand">
        <div class="brand-mark"></div>
        <div class="brand-copy">VANGUARD PROTOCOL<small>COMBATANT ARCHIVE</small></div>
      </div>
      <div class="status"><i class="status-dot"></i><span id="load-status">ROSTER LINK ACTIVE</span></div>
    </header>

    <section class="character-copy" aria-live="polite">
      <div class="copy-inner" id="copy-inner">
        <div class="eyebrow" id="callsign"></div>
        <h1 id="name"></h1>
        <div class="role" id="role"></div>
        <p class="description" id="description"></p>
        <div class="origin">ORIGIN <strong id="origin"></strong></div>
        <div class="stats">
          <div class="stat"><span>MOBILITY</span><i class="stat-track"><b class="stat-fill"></b></i><span class="stat-value"></span></div>
          <div class="stat"><span>ARMOR</span><i class="stat-track"><b class="stat-fill"></b></i><span class="stat-value"></span></div>
          <div class="stat"><span>SYNC</span><i class="stat-track"><b class="stat-fill"></b></i><span class="stat-value"></span></div>
        </div>
      </div>
    </section>

    <aside class="loot-panel" id="loot-panel" aria-live="polite" aria-label="Selected character field cache">
      <div class="loot-panel-edge" aria-hidden="true"></div>
      <div class="loot-content" id="loot-content"></div>
    </aside>

    <div class="index-rail"><span>COMBATANT</span><div class="index-line"></div><b id="current-index">01</b><span>/ 05</span></div>

    <nav class="bottom-ui" aria-label="Character roster">
      <div class="controls-row">
        <button class="nav-button" id="previous" aria-label="Previous character">
          <svg viewBox="0 0 24 24" fill="none"><path d="m14.5 5-7 7 7 7" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <div class="roster-strip" id="roster"></div>
        <button class="nav-button" id="next" aria-label="Next character">
          <svg viewBox="0 0 24 24" fill="none"><path d="m9.5 5 7 7-7 7" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
      <p class="hint"><span>← →</span>&nbsp;&nbsp; NAVIGATE &nbsp;&nbsp;•&nbsp;&nbsp; DRAG TO ORBIT &nbsp;&nbsp;•&nbsp;&nbsp; SCROLL TO ZOOM</p>
    </nav>

    <div class="loader" id="loader">
      <div class="loader-inner">
        <div class="loader-diamond"></div>
        <div class="loader-label">INITIALIZING COMBATANT ARCHIVE</div>
        <div class="loader-track"><div class="loader-fill" id="loader-fill"></div></div>
        <div class="loader-status" id="loader-status">SECURE LINK / 00%</div>
        <div class="error-panel" id="error-panel"></div>
      </div>
    </div>
  </main>
`

const root = document.querySelector<HTMLElement>('.experience')!
const copy = document.querySelector<HTMLElement>('#copy-inner')!
const rosterElement = document.querySelector<HTMLElement>('#roster')!
const lootPanel = document.querySelector<HTMLElement>('#loot-panel')!
const lootContent = document.querySelector<HTMLElement>('#loot-content')!
const loader = document.querySelector<HTMLElement>('#loader')!
const loaderFill = document.querySelector<HTMLElement>('#loader-fill')!
const loaderStatus = document.querySelector<HTMLElement>('#loader-status')!
const loadStatus = document.querySelector<HTMLElement>('#load-status')!

rosterElement.innerHTML = roster.map((character, index) => `
  <button class="roster-card" data-index="${index}" style="--card-accent:${character.accent}" aria-label="Select ${character.name}">
    <img class="thumb" alt="" />
    <span class="card-index">${String(index + 1).padStart(2, '0')}</span>
    <span class="card-name">${character.name}</span>
  </button>
`).join('')

const cards = [...document.querySelectorAll<HTMLButtonElement>('.roster-card')]
const fields = {
  callsign: document.querySelector<HTMLElement>('#callsign')!,
  name: document.querySelector<HTMLElement>('#name')!,
  role: document.querySelector<HTMLElement>('#role')!,
  description: document.querySelector<HTMLElement>('#description')!,
  origin: document.querySelector<HTMLElement>('#origin')!,
  currentIndex: document.querySelector<HTMLElement>('#current-index')!,
  stats: [...document.querySelectorAll<HTMLElement>('.stat')],
}

let selected = 0
let locked = false
let swipePointerId: number | null = null
let swipeStartX = 0
let lootAnimationTimer = 0

function renderLoot(index: number, animate: boolean): void {
  const character = roster[index]
  lootPanel.dataset.character = character.id
  lootPanel.setAttribute('aria-label', `${character.name} field cache`)
  lootContent.innerHTML = `
    <header class="loot-heading">
      <span><i></i> FIELD CACHE</span>
      <b>${character.loot.rarity}</b>
    </header>
    <figure class="loot-cache">
      <img src="${character.loot.cacheImage}" alt="${character.loot.cacheName} equipment bag" />
      <figcaption><span>CHARACTER ISSUE</span><strong>${character.loot.cacheName}</strong></figcaption>
      <i class="loot-cache-scan" aria-hidden="true"></i>
    </figure>
    <div class="loot-list" role="list" aria-label="Cache contents">
      ${character.loot.items.map((item, itemIndex) => `
        <article class="loot-item" role="listitem" data-kind="${item.kind}" style="--loot-order:${itemIndex}">
          <span class="loot-icon" aria-hidden="true"><i></i></span>
          <span class="loot-copy"><small>${item.type}</small><strong>${item.name}</strong></span>
          <em>${item.code}</em>
        </article>
      `).join('')}
    </div>
  `

  if (!animate) return
  window.clearTimeout(lootAnimationTimer)
  lootPanel.classList.remove('is-leaving', 'is-entering')
  void lootPanel.offsetWidth
  lootPanel.classList.add('is-entering')
  lootAnimationTimer = window.setTimeout(() => lootPanel.classList.remove('is-entering'), 900)
}

function updateCopy(index: number, animate = true): void {
  const character = roster[index]
  const apply = () => {
    root.style.setProperty('--accent', character.accent)
    root.style.setProperty('--accent-rgb', character.accentRgb)
    root.style.setProperty('--accent-secondary', character.theme.secondary)
    root.style.setProperty('--accent-secondary-rgb', character.theme.secondaryRgb)
    root.style.setProperty('--theme-deep-rgb', character.theme.deepRgb)
    fields.callsign.textContent = character.callsign
    fields.name.textContent = character.name
    fields.role.textContent = character.role
    fields.description.textContent = character.description
    fields.origin.textContent = character.origin
    fields.currentIndex.textContent = String(index + 1).padStart(2, '0')
    fields.stats.forEach((stat, statIndex) => {
      stat.querySelector<HTMLElement>('.stat-fill')?.style.setProperty('--value', `${character.stats[statIndex]}%`)
      const value = stat.querySelector<HTMLElement>('.stat-value')
      if (value) value.textContent = String(character.stats[statIndex])
    })
    cards.forEach((card, cardIndex) => {
      card.classList.toggle('is-active', cardIndex === index)
      card.setAttribute('aria-current', cardIndex === index ? 'true' : 'false')
    })
    renderLoot(index, animate)
  }

  if (!animate) {
    apply()
    return
  }
  copy.classList.add('is-leaving')
  lootPanel.classList.add('is-leaving')
  window.setTimeout(() => {
    apply()
    copy.classList.remove('is-leaving')
    lootPanel.classList.remove('is-leaving')
    copy.classList.add('is-entering')
    window.setTimeout(() => copy.classList.remove('is-entering'), 680)
  }, 170)
}

function wrap(index: number): number { return (index + roster.length) % roster.length }

async function select(index: number, direction?: number): Promise<void> {
  const nextIndex = wrap(index)
  if (locked || nextIndex === selected) return
  locked = true
  const resolvedDirection = direction ?? (nextIndex > selected ? 1 : -1)
  selected = nextIndex
  updateCopy(selected)
  await showcase.select(selected, resolvedDirection)
  locked = false
}

updateCopy(selected, false)

const showcase = new CharacterShowcase({
  container: document.querySelector<HTMLElement>('#viewport')!,
  roster,
  onProgress: (loaded, total, label) => {
    const percentage = Math.round((loaded / total) * 100)
    loaderFill.style.width = `${percentage}%`
    loaderStatus.textContent = `${label.toUpperCase()} / ${String(percentage).padStart(2, '0')}%`
  },
  onThumbnail: (index, dataUrl) => {
    const image = cards[index]?.querySelector<HTMLImageElement>('.thumb')
    if (image) image.src = dataUrl
  },
})

cards.forEach((card) => card.addEventListener('click', () => {
  const index = Number(card.dataset.index)
  void select(index)
}))

document.querySelector('#previous')?.addEventListener('click', () => void select(selected - 1, -1))
document.querySelector('#next')?.addEventListener('click', () => void select(selected + 1, 1))

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') void select(selected - 1, -1)
  if (event.key === 'ArrowRight') void select(selected + 1, 1)
})

const viewport = document.querySelector<HTMLElement>('#viewport')!
viewport.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || !event.isPrimary) return
  swipePointerId = event.pointerId
  swipeStartX = event.clientX
})
viewport.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'touch' || event.pointerId !== swipePointerId) return
  const distance = event.clientX - swipeStartX
  swipePointerId = null
  if (Math.abs(distance) > 55) void select(selected + (distance < 0 ? 1 : -1), distance < 0 ? 1 : -1)
})
viewport.addEventListener('pointercancel', (event) => {
  if (event.pointerId === swipePointerId) swipePointerId = null
})

try {
  await showcase.initialize()
  loader.classList.add('is-hidden')
  loadStatus.textContent = 'ROSTER LINK ACTIVE'
} catch (error) {
  console.error(error)
  loader.classList.add('has-error')
  const panel = document.querySelector<HTMLElement>('#error-panel')!
  panel.innerHTML = `<strong>ARCHIVE LINK FAILED</strong><br>${error instanceof Error ? error.message : 'Unknown model loading error'}<br><br>Reload the page to retry.`
}

window.addEventListener('beforeunload', () => showcase.dispose())
