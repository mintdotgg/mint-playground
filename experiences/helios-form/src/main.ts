import './styles.css'
import { ShowroomAudio, type ShowroomAudioState } from './audio'
import { fleet } from './fleet'
import { VehicleShowroom } from './showroom'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App root not found')

app.innerHTML = `
  <main class="experience" aria-label="Helios Form exterior vehicle selector">
    <div id="viewport" aria-hidden="true"></div>

    <header class="topbar">
      <div class="brand" aria-label="Helios Form">
        <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
          <path d="M4 22h36M22 4v36" />
          <circle cx="22" cy="22" r="12" />
          <circle cx="22" cy="22" r="2.5" />
        </svg>
        <div class="brand-copy"><strong>HELIOS FORM</strong><span>ORBITAL MOBILITY SYSTEMS</span></div>
      </div>
      <div class="top-meta">
        <span>EXTERIOR CONFIGURATION</span>
        <i></i>
        <strong id="load-status">SYSTEM LINK</strong>
        <button class="sound-toggle" id="sound-toggle" type="button" aria-label="Enable showroom sound" aria-pressed="false">
          <span class="sound-bars" aria-hidden="true"><b></b><b></b><b></b></span>
          <span class="sound-label">SOUND READY</span>
        </button>
      </div>
    </header>

    <aside class="vehicle-copy" aria-live="polite">
      <div class="copy-inner" id="copy-inner">
        <div class="designation" id="designation"></div>
        <h1 id="vehicle-name"></h1>
        <div class="family" id="family"></div>
        <p class="description" id="description"></p>
        <div class="specs" id="specs"></div>
        <div class="availability"><i></i><span>FLIGHT-CERTIFIED CONFIGURATION</span></div>
      </div>
    </aside>

    <aside class="systems-dossier" aria-label="Selected vehicle onboard systems" aria-live="polite">
      <div class="dossier-heading">
        <span id="dossier-index">ONBOARD / 01</span>
        <strong id="dossier-ship">ASTERION SYSTEMS</strong>
      </div>
      <div class="dossier-inner" id="dossier-inner" role="list"></div>
      <div class="zoom-console" aria-label="Model zoom controls">
        <span>INSPECTION ZOOM</span>
        <div>
          <button id="zoom-out" type="button" aria-label="Zoom out">−</button>
          <output id="zoom-level" aria-live="polite">100%</output>
          <button id="zoom-in" type="button" aria-label="Zoom in">+</button>
        </div>
      </div>
    </aside>

    <div class="frame-index" aria-hidden="true">
      <span id="current-index">01</span>
      <i></i>
      <span>06</span>
    </div>

    <nav class="selector" aria-label="Vehicle selection">
      <button class="nav-button previous" id="previous" aria-label="Previous vehicle">
        <svg viewBox="0 0 24 24" fill="none"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <div class="fleet-strip" id="fleet-strip"></div>
      <button class="nav-button next" id="next" aria-label="Next vehicle">
        <span>NEXT</span>
        <svg viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" /></svg>
      </button>
      <p class="selector-hint"><span>←</span><span>→</span> NAVIGATE&nbsp;&nbsp; / &nbsp;&nbsp;<b>DRAG</b> ORBIT&nbsp;&nbsp; / &nbsp;&nbsp;<b>SCROLL</b> ZOOM</p>
    </nav>

    <div class="loader" id="loader" role="status" aria-live="polite">
      <div class="loader-core">
        <svg class="loader-mark" viewBox="0 0 58 58" aria-hidden="true">
          <circle cx="29" cy="29" r="22" />
          <path d="M29 4v12M29 42v12M4 29h12M42 29h12" />
        </svg>
        <div class="loader-label">CONNECTING TO VEHICLE ARCHIVE</div>
        <div class="loader-track"><i id="loader-fill"></i></div>
        <div class="loader-status" id="loader-status">INITIALIZING / 00%</div>
        <div class="error-panel" id="error-panel"></div>
      </div>
    </div>
  </main>
`

const root = document.querySelector<HTMLElement>('.experience')!
const copy = document.querySelector<HTMLElement>('#copy-inner')!
const strip = document.querySelector<HTMLElement>('#fleet-strip')!
const loader = document.querySelector<HTMLElement>('#loader')!
const loaderFill = document.querySelector<HTMLElement>('#loader-fill')!
const loaderStatus = document.querySelector<HTMLElement>('#loader-status')!
const loadStatus = document.querySelector<HTMLElement>('#load-status')!
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-toggle')!
const soundLabel = soundToggle.querySelector<HTMLElement>('.sound-label')!
const dossierInner = document.querySelector<HTMLElement>('#dossier-inner')!
const dossierIndex = document.querySelector<HTMLElement>('#dossier-index')!
const dossierShip = document.querySelector<HTMLElement>('#dossier-ship')!
const zoomLevel = document.querySelector<HTMLOutputElement>('#zoom-level')!

const updateAudioUi = (state: ShowroomAudioState): void => {
  const labels: Record<ShowroomAudioState['status'], string> = {
    ready: 'SOUND READY',
    loading: 'SOUND LOAD',
    on: 'SOUND ON',
    off: 'SOUND OFF',
    paused: 'SOUND PAUSED',
    error: 'SOUND ERROR',
  }
  soundLabel.textContent = labels[state.status]
  soundToggle.classList.toggle('is-active', state.status === 'on')
  soundToggle.classList.toggle('is-muted', state.status === 'off')
  soundToggle.setAttribute('aria-pressed', String(state.activated && !state.muted))
  soundToggle.setAttribute('aria-label', state.activated && !state.muted ? 'Mute showroom sound' : 'Enable showroom sound')
  soundToggle.dataset.audioState = state.status
  soundToggle.dataset.ambiencePlaying = String(state.ambiencePlaying)
  soundToggle.dataset.selectionPlays = String(state.selectionPlays)
  soundToggle.dataset.contextState = state.contextState
  root.dataset.audioState = state.status
}

const audio = new ShowroomAudio({
  selectionUrl: 'https://cdn.mint.gg/audio/xd7114dcf5k49vvpzmz78nedc98aee4c/vehicle-selector-confirmation-313e06-0df4b3cba5753b57.mp3',
  ambienceUrl: 'https://cdn.mint.gg/audio/xd7ba9ks7jt8ca3dm2q75cb4es8afpmv/orbital-showroom-ambience-7c5100-082d953b02a18606.mp3',
  onStateChange: updateAudioUi,
})

const activateAudioFromGesture = (event: Event): void => {
  if (event.target instanceof Element && event.target.closest('#sound-toggle')) return
  void audio.activate()
}

window.addEventListener('pointerdown', activateAudioFromGesture, { capture: true })
window.addEventListener('keydown', activateAudioFromGesture, { capture: true })
soundToggle.addEventListener('click', (event) => {
  event.stopPropagation()
  void audio.toggle()
})

strip.innerHTML = fleet.map((vehicle, index) => `
  <button class="vehicle-card" data-index="${index}" style="--card-accent:${vehicle.accent}" aria-label="Select ${vehicle.name}">
    <span class="card-number">${vehicle.sequence}</span>
    <img class="thumbnail" alt="" />
    <span class="card-copy"><strong>${vehicle.name}</strong><small>${vehicle.family}</small></span>
  </button>
`).join('')

const cards = [...document.querySelectorAll<HTMLButtonElement>('.vehicle-card')]
const fields = {
  designation: document.querySelector<HTMLElement>('#designation')!,
  name: document.querySelector<HTMLElement>('#vehicle-name')!,
  family: document.querySelector<HTMLElement>('#family')!,
  description: document.querySelector<HTMLElement>('#description')!,
  specs: document.querySelector<HTMLElement>('#specs')!,
  currentIndex: document.querySelector<HTMLElement>('#current-index')!,
}

let selectedIndex = 0
let selectionRevision = 0
let pointerStartX = 0
let swipePointerId: number | null = null
const pointerPositions = new Map<number, { x: number; y: number }>()
let pinchDistance: number | null = null

function renderDossier(index: number): void {
  const vehicle = fleet[index]
  const dossierImageUrl = new URL(vehicle.dossierImage, document.baseURI).href
  dossierIndex.textContent = `ONBOARD / ${vehicle.sequence}`
  dossierShip.textContent = `${vehicle.name} SYSTEMS`
  dossierInner.innerHTML = vehicle.dossier.map((item, itemIndex) => `
    <article class="dossier-card" role="listitem" style="--item-index:${itemIndex}">
      <div class="dossier-visual" data-slice="${itemIndex}" style="--dossier-image:url('${dossierImageUrl}')" aria-hidden="true">
        <i></i><span>0${itemIndex + 1}</span>
      </div>
      <div class="dossier-copy">
        <span>${item.category}</span>
        <strong>${item.title}</strong>
        <small>${item.detail}</small>
      </div>
    </article>
  `).join('')
}

function renderVehicle(index: number, animate = true): void {
  const vehicle = fleet[index]
  const apply = () => {
    root.style.setProperty('--accent', vehicle.accent)
    root.style.setProperty('--accent-rgb', vehicle.accentRgb)
    root.style.setProperty('--accent-2', vehicle.secondary)
    root.style.setProperty('--accent-2-rgb', vehicle.secondaryRgb)
    root.style.setProperty('--surface-rgb', vehicle.surfaceRgb)
    fields.designation.textContent = vehicle.designation
    fields.name.textContent = vehicle.name
    fields.family.textContent = vehicle.family
    fields.description.textContent = vehicle.description
    fields.currentIndex.textContent = vehicle.sequence
    renderDossier(index)
    fields.specs.innerHTML = vehicle.specs.map((spec) => `
      <div class="spec"><span>${spec.label}</span><strong>${spec.value}</strong></div>
    `).join('')
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index
      card.classList.toggle('is-active', active)
      card.setAttribute('aria-current', active ? 'true' : 'false')
    })
  }

  if (!animate) {
    apply()
    return
  }

  copy.classList.add('is-leaving')
  dossierInner.classList.add('is-leaving')
  window.setTimeout(() => {
    apply()
    copy.classList.remove('is-leaving')
    copy.classList.add('is-entering')
    dossierInner.classList.remove('is-leaving')
    dossierInner.classList.add('is-entering')
    window.setTimeout(() => {
      copy.classList.remove('is-entering')
      dossierInner.classList.remove('is-entering')
    }, 520)
  }, 105)
}

const wrap = (index: number): number => (index + fleet.length) % fleet.length

async function selectVehicle(index: number, direction?: number): Promise<void> {
  const nextIndex = wrap(index)
  void audio.playSelection()
  if (nextIndex === selectedIndex) return
  const revision = ++selectionRevision
  const resolvedDirection = direction ?? (nextIndex > selectedIndex ? 1 : -1)
  selectedIndex = nextIndex
  renderVehicle(selectedIndex)
  const transition = showroom.select(selectedIndex, resolvedDirection)
  syncZoomUi()
  await transition
  if (revision !== selectionRevision) return
  cards[selectedIndex]?.focus({ preventScroll: true })
}

renderVehicle(selectedIndex, false)

const showroom = new VehicleShowroom({
  container: document.querySelector<HTMLElement>('#viewport')!,
  fleet,
  onProgress: (loaded, total, label) => {
    const percentage = Math.round((loaded / total) * 100)
    loaderFill.style.width = `${percentage}%`
    loaderStatus.textContent = `${label.toUpperCase()} / ${String(percentage).padStart(2, '0')}%`
  },
  onThumbnail: (index, dataUrl) => {
    const image = cards[index]?.querySelector<HTMLImageElement>('.thumbnail')
    if (image) image.src = dataUrl
  },
})

cards.forEach((card) => card.addEventListener('click', () => {
  void selectVehicle(Number(card.dataset.index))
}))

document.querySelector('#previous')?.addEventListener('click', () => void selectVehicle(selectedIndex - 1, -1))
document.querySelector('#next')?.addEventListener('click', () => void selectVehicle(selectedIndex + 1, 1))

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') void selectVehicle(selectedIndex - 1, -1)
  if (event.key === 'ArrowRight') void selectVehicle(selectedIndex + 1, 1)
  if (event.key === '+' || event.key === '=') {
    showroom.adjustZoom(.12)
    syncZoomUi()
  }
  if (event.key === '-' || event.key === '_') {
    showroom.adjustZoom(-.12)
    syncZoomUi()
  }
  if (event.key === '0') {
    showroom.resetZoom()
    syncZoomUi()
  }
})

const viewport = document.querySelector<HTMLElement>('#viewport')!
const pinchSpan = (): number | null => {
  const points = [...pointerPositions.values()]
  if (points.length < 2) return null
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
}

const syncZoomUi = (): void => {
  const zoom = Number(viewport.dataset.zoom ?? 0)
  zoomLevel.value = `${Math.round(100 + zoom * .78)}%`
}

document.querySelector('#zoom-in')?.addEventListener('click', () => {
  showroom.adjustZoom(.14)
  syncZoomUi()
})
document.querySelector('#zoom-out')?.addEventListener('click', () => {
  showroom.adjustZoom(-.14)
  syncZoomUi()
})

viewport.addEventListener('wheel', (event) => {
  event.preventDefault()
  const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? .035 : .00145
  const amount = Math.max(-.14, Math.min(.14, -event.deltaY * scale))
  showroom.adjustZoom(amount)
  syncZoomUi()
}, { passive: false })

viewport.addEventListener('pointerdown', (event) => {
  pointerPositions.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointerPositions.size > 1) {
    showroom.cancelOrbit()
    swipePointerId = null
    pinchDistance = pinchSpan()
    viewport.setPointerCapture(event.pointerId)
    viewport.classList.remove('is-orbiting', 'is-orbitable')
    viewport.classList.add('is-zooming')
    return
  }
  pointerStartX = event.clientX
  if (showroom.beginOrbit(event.clientX, event.clientY, event.pointerId)) {
    viewport.setPointerCapture(event.pointerId)
    viewport.classList.add('is-orbiting')
    viewport.classList.remove('is-orbitable')
    swipePointerId = null
    return
  }
  swipePointerId = event.pointerId
})

viewport.addEventListener('pointermove', (event) => {
  if (pointerPositions.has(event.pointerId)) pointerPositions.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointerPositions.size > 1) {
    const distance = pinchSpan()
    if (distance !== null && pinchDistance !== null) {
      showroom.adjustZoom((distance - pinchDistance) * .006)
      syncZoomUi()
    }
    pinchDistance = distance
    return
  }
  if (showroom.updateOrbit(event.clientX, event.clientY, event.pointerId)) return
  viewport.classList.toggle('is-orbitable', showroom.hitTestActiveModel(event.clientX, event.clientY))
})

viewport.addEventListener('pointerup', (event) => {
  const wasPinching = pinchDistance !== null
  pointerPositions.delete(event.pointerId)
  if (pointerPositions.size < 2) pinchDistance = null
  const didOrbit = showroom.endOrbit(event.pointerId)
  viewport.classList.remove('is-orbiting', 'is-zooming')
  if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
  if (wasPinching) return
  if (didOrbit) {
    viewport.classList.toggle('is-orbitable', showroom.hitTestActiveModel(event.clientX, event.clientY))
    return
  }
  if (swipePointerId !== event.pointerId) return
  swipePointerId = null
  const distance = event.clientX - pointerStartX
  if (Math.abs(distance) > 55) void selectVehicle(selectedIndex + (distance < 0 ? 1 : -1), distance < 0 ? 1 : -1)
})

viewport.addEventListener('pointercancel', (event) => {
  showroom.cancelOrbit(event.pointerId)
  pointerPositions.delete(event.pointerId)
  if (pointerPositions.size < 2) pinchDistance = null
  swipePointerId = null
  viewport.classList.remove('is-orbiting', 'is-orbitable', 'is-zooming')
})

viewport.addEventListener('pointerleave', () => {
  if (!viewport.classList.contains('is-orbiting')) viewport.classList.remove('is-orbitable')
})

window.addEventListener('blur', () => {
  showroom.cancelOrbit()
  pointerPositions.clear()
  pinchDistance = null
  swipePointerId = null
  viewport.classList.remove('is-orbiting', 'is-orbitable', 'is-zooming')
})

try {
  await showroom.initialize()
  loader.classList.add('is-hidden')
  loadStatus.textContent = 'SYSTEM ONLINE'
} catch (error) {
  console.error(error)
  loader.classList.add('has-error')
  const panel = document.querySelector<HTMLElement>('#error-panel')!
  panel.innerHTML = `<strong>VEHICLE ARCHIVE UNAVAILABLE</strong><br>${error instanceof Error ? error.message : 'Unknown model loading error'}<br><br>Reload to retry the connection.`
  loadStatus.textContent = 'LINK ERROR'
}

window.addEventListener('beforeunload', () => {
  audio.dispose()
  showroom.dispose()
})
