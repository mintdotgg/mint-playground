import mintRegistryJson from '../../mint-assets.json'
import { ModelArControl } from '../ar/ModelArControl'
import { catalog, formatPrice, formatStatus } from '../catalog'
import { RobotShowroom } from '../scene/RobotShowroom'
import type { StoreSnapshot } from '../store/StoreState'
import { StoreState } from '../store/StoreState'
import { themeForRobot } from '../theme'
import type { AssetDisplayStatus, CatalogRobot, MintRegistry } from '../types'

const mintRegistry = mintRegistryJson as unknown as MintRegistry

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character,
  )
}

function arrow(direction: 'left' | 'right'): string {
  const path = direction === 'left' ? 'M20 12H4m6-6-6 6 6 6' : 'M4 12h16m-6-6 6 6-6 6'
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="${path}"></path></svg>`
}

function controlIcon(control: 'motion' | 'rotate' | 'dither'): string {
  if (control === 'motion') {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>'
  }
  if (control === 'rotate') {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M19 7v5h-5"></path><path d="M19 12a7 7 0 1 1-2.05-4.95"></path></svg>'
  }
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="1.5"></circle><circle cx="12" cy="6" r="1.5"></circle><circle cx="18" cy="6" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle><circle cx="6" cy="18" r="1.5"></circle><circle cx="12" cy="18" r="1.5"></circle><circle cx="18" cy="18" r="1.5"></circle></svg>'
}

function previewImageUrl(robotId: string): string | null {
  const record = mintRegistry.assets[robotId]
  const preview = record
    ? Object.values(record.artifacts).find((artifact) => artifact.role === 'preview_image')
    : undefined
  return preview?.runtimeUrl ?? null
}

function officialProductUrl(robot: CatalogRobot): string | null {
  const candidate = robot.reference_images.find((reference) =>
    reference.page_url.startsWith('https://'),
  )
  return candidate?.page_url ?? null
}

function carouselItem(robot: CatalogRobot, index: number, selectedId: string): string {
  const selected = robot.id === selectedId
  const theme = themeForRobot(robot)
  const previewUrl = previewImageUrl(robot.id)
  const media = previewUrl
    ? `<img class="carousel-item__preview" src="${escapeHtml(previewUrl)}" alt="" loading="eager" decoding="async" draggable="false">`
    : '<span class="carousel-item__figure"><i></i><b></b><em></em></span>'
  return `
    <button
      type="button"
      class="carousel-item${selected ? ' is-selected' : ''}"
      data-action="select"
      data-robot-id="${escapeHtml(robot.id)}"
      aria-pressed="${String(selected)}"
      aria-label="Show ${escapeHtml(robot.display_name)}"
      style="--item-accent:${theme.accent}"
    >
      <span class="carousel-item__media" aria-hidden="true">
        ${media}
      </span>
      <span class="carousel-item__copy" aria-hidden="true">
        <small>${String(index + 1).padStart(2, '0')} / ${escapeHtml(robot.brand)}</small>
        <strong>${escapeHtml(robot.model)}</strong>
      </span>
    </button>
  `
}

function selectionDirection(previous: CatalogRobot, next: CatalogRobot): -1 | 0 | 1 {
  if (previous.id === next.id) return 0
  const previousIndex = catalog.robots.findIndex((robot) => robot.id === previous.id)
  const nextIndex = catalog.robots.findIndex((robot) => robot.id === next.id)
  let delta = nextIndex - previousIndex
  const half = catalog.robots.length / 2
  if (delta > half) delta -= catalog.robots.length
  if (delta < -half) delta += catalog.robots.length
  return delta > 0 ? 1 : -1
}

function carouselWindow(centerIndex: number): Array<{ robot: CatalogRobot; index: number }> {
  const radius = 3
  return Array.from({ length: radius * 2 + 1 }, (_, slot) => {
    const index = (centerIndex + slot - radius + catalog.robots.length) % catalog.robots.length
    return { robot: catalog.robots[index], index }
  })
}

export class StoreUi {
  private snapshot: StoreSnapshot
  private readonly showroom: RobotShowroom
  private readonly arControl: ModelArControl
  private assetStatus: AssetDisplayStatus = { kind: 'loading', message: 'Indexing robot archive' }
  private unsubscribeState: (() => void) | null = null
  private unsubscribeAssetStatus: (() => void) | null = null
  private dockViewport: HTMLElement | null = null
  private dockAnimationFrame = 0
  private dockPointerX: number | null = null
  private shellTransitionTimer = 0
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  private readonly onDockPointerMove = (event: PointerEvent): void => {
    if (this.reducedMotion) return
    this.dockPointerX = event.clientX
    if (this.dockAnimationFrame) return
    this.dockAnimationFrame = requestAnimationFrame(() => {
      this.dockAnimationFrame = 0
      if (this.dockPointerX === null) return
      this.applyDockMagnification(this.dockPointerX)
    })
  }

  private readonly onDockPointerLeave = (): void => {
    this.resetDockMagnification()
  }

  private readonly onDockFocusIn = (event: FocusEvent): void => {
    if (this.reducedMotion) return
    const item = (event.target as HTMLElement).closest<HTMLElement>('.carousel-item')
    if (!item) return
    requestAnimationFrame(() => {
      if (!item.matches(':focus-visible')) return
      const bounds = item.getBoundingClientRect()
      this.applyDockMagnification(bounds.left + bounds.width / 2)
    })
  }

  private readonly onDockFocusOut = (): void => {
    requestAnimationFrame(() => {
      if (!this.dockViewport?.contains(document.activeElement)) this.resetDockMagnification()
    })
  }

  private readonly onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.state.previous()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.state.next()
    }
    if (event.key.toLocaleLowerCase() === 'r') this.showroom.resetCamera()
    if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      this.updateMotionState(this.showroom.toggleAutoOrbit())
    }
  }

  constructor(
    private readonly root: HTMLElement,
    private readonly state: StoreState,
  ) {
    this.snapshot = state.snapshot()
    this.renderShell()
    const showroomHost = this.root.querySelector<HTMLElement>('[data-showroom-host]')
    if (!showroomHost) throw new Error('Robot Store could not create the showroom canvas host.')
    this.showroom = new RobotShowroom(showroomHost)
    this.arControl = new ModelArControl(this.root, mintRegistry)
    this.bindEvents()
    this.unsubscribeAssetStatus = this.showroom.subscribeToAssetStatus((status) => {
      this.assetStatus = status
      this.updateAssetStatus()
    })
    this.unsubscribeState = state.subscribe((snapshot) => {
      const robotChanged = snapshot.selectedRobot.id !== this.snapshot.selectedRobot.id
      const direction = robotChanged
        ? selectionDirection(this.snapshot.selectedRobot, snapshot.selectedRobot)
        : 0
      this.snapshot = snapshot
      this.renderDynamicRegions(direction)
      if (robotChanged) {
        this.arControl.setRobot(snapshot.selectedRobot)
        void this.showroom.setRobot(snapshot.selectedRobot)
      }
    })
    window.addEventListener('keydown', this.onWindowKeyDown)
    this.arControl.setRobot(this.snapshot.selectedRobot)
    void this.showroom.setRobot(this.snapshot.selectedRobot)
  }

  destroy(): void {
    this.unsubscribeState?.()
    this.unsubscribeAssetStatus?.()
    window.removeEventListener('keydown', this.onWindowKeyDown)
    if (this.dockViewport) {
      this.dockViewport.removeEventListener('pointermove', this.onDockPointerMove)
      this.dockViewport.removeEventListener('pointerleave', this.onDockPointerLeave)
      this.dockViewport.removeEventListener('pointercancel', this.onDockPointerLeave)
      this.dockViewport.removeEventListener('focusin', this.onDockFocusIn)
      this.dockViewport.removeEventListener('focusout', this.onDockFocusOut)
    }
    if (this.dockAnimationFrame) cancelAnimationFrame(this.dockAnimationFrame)
    if (this.shellTransitionTimer) window.clearTimeout(this.shellTransitionTimer)
    this.arControl.destroy()
    this.showroom.destroy()
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="editorial-shell">
        <main class="showroom" aria-label="Interactive robot system archive">
          <div class="showroom__canvas" data-showroom-host></div>
          <div class="registration-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </main>

        <header class="corner corner--top-left">
          <span class="archive-mark" aria-hidden="true">F/<b>01</b></span>
          <span class="corner__copy">
            <strong>FUTURE<br>FORM</strong>
            <small>ROBOT SYSTEM ARCHIVE<br>SPECIMEN STUDY / 2026</small>
          </span>
        </header>

        <div class="corner corner--top-right">
          <span class="system-identity" data-system-identity></span>
          <span class="system-index" data-system-index></span>
        </div>

        <div class="corner corner--bottom-left">
          <div class="micro-control-stack">
            <button type="button" class="micro-button" data-action="toggle-motion" aria-pressed="true" aria-label="Turn motion off" title="Motion: on">
              <span class="micro-button__icon">${controlIcon('motion')}</span>
              <span class="micro-button__label" data-control-label>MOTION / ON</span>
            </button>
            <button type="button" class="micro-button" data-action="toggle-auto-rotate" aria-pressed="false" aria-label="Turn auto rotate on" title="Auto rotate: off">
              <span class="micro-button__icon">${controlIcon('rotate')}</span>
              <span class="micro-button__label" data-control-label>ROTATE / OFF</span>
            </button>
            <button type="button" class="micro-button" data-action="toggle-dither" aria-pressed="true" aria-label="Turn dither off" title="Dither: on">
              <span class="micro-button__icon">${controlIcon('dither')}</span>
              <span class="micro-button__label" data-control-label>DITHER / ON</span>
            </button>
            <button type="button" class="micro-button" data-action="reset-camera">RESET VIEW</button>
          </div>
          <span class="input-hint">360° ORBIT · PAN · ZOOM · ← →</span>
        </div>

        <div class="corner corner--bottom-right">
          <span class="asset-status" data-asset-status role="status" aria-live="polite"></span>
          <span class="concept-note">CONCEPT DISPLAY · NO TRANSACTION</span>
        </div>

        <a
          class="product-buy-link"
          data-buy-link
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>BUY</span>
          <small>OFFICIAL SITE</small>
          <b aria-hidden="true">↗</b>
        </a>

        <section class="robot-carousel" aria-label="Choose a robot" data-robot-dock>
          <div class="ar-control">
            <span class="ar-control__status" data-ar-status role="status" aria-live="polite" hidden></span>
            <button
              type="button"
              class="ar-control__button"
              data-ar-button
              aria-label="View selected robot in augmented reality"
              aria-disabled="true"
              aria-busy="false"
            >
              <span class="ar-control__mark" aria-hidden="true">AR</span>
              <span>VIEW IN AR</span>
            </button>
          </div>
          <button type="button" class="carousel-arrow carousel-arrow--left" data-action="previous" aria-label="Previous robot">${arrow('left')}</button>
          <div class="carousel-viewport" data-carousel-viewport>
            <div class="carousel-track" data-carousel-track></div>
          </div>
          <button type="button" class="carousel-arrow carousel-arrow--right" data-action="next" aria-label="Next robot">${arrow('right')}</button>
        </section>

        <div class="paper-grain" aria-hidden="true"></div>
      </div>
    `
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const actionTarget = target.closest<HTMLElement>('[data-action]')
      if (!actionTarget) return
      const action = actionTarget.dataset.action
      const robotId = actionTarget.dataset.robotId

      if (action === 'select' && robotId) this.state.select(robotId)
      if (action === 'previous') this.state.previous()
      if (action === 'next') this.state.next()
      if (action === 'reset-camera') this.showroom.resetCamera()
      if (action === 'toggle-motion') this.updateMotionState(this.showroom.toggleAutoOrbit())
      if (action === 'toggle-auto-rotate') {
        this.updateAutoRotateState(this.showroom.toggleAutoRotate())
      }
      if (action === 'toggle-dither') this.updateDitherState(this.showroom.toggleDither())
    })

    this.dockViewport = this.root.querySelector<HTMLElement>('[data-carousel-viewport]')
    this.dockViewport?.addEventListener('pointermove', this.onDockPointerMove)
    this.dockViewport?.addEventListener('pointerleave', this.onDockPointerLeave)
    this.dockViewport?.addEventListener('pointercancel', this.onDockPointerLeave)
    this.dockViewport?.addEventListener('focusin', this.onDockFocusIn)
    this.dockViewport?.addEventListener('focusout', this.onDockFocusOut)
  }

  private renderDynamicRegions(direction = 0): void {
    const robot = this.snapshot.selectedRobot
    const theme = themeForRobot(robot)
    const selectedIndex = catalog.robots.findIndex((candidate) => candidate.id === robot.id)
    const shell = this.root.querySelector<HTMLElement>('.editorial-shell')
    shell?.style.setProperty('--accent', theme.accent)
    shell?.style.setProperty('--paper', theme.paper)
    shell?.style.setProperty('--paper-shadow', theme.paperShadow)
    shell?.style.setProperty('--ink', theme.ink)
    shell?.style.setProperty('--ink-muted', theme.inkMuted)
    if (shell && direction !== 0 && !this.reducedMotion) {
      shell.style.setProperty('--selection-shift', `${direction * 26}px`)
      shell.style.setProperty('--selection-tilt', `${direction * -6}deg`)
      shell.classList.remove('is-switching-robot')
      void shell.offsetWidth
      shell.classList.add('is-switching-robot')
      if (this.shellTransitionTimer) window.clearTimeout(this.shellTransitionTimer)
      this.shellTransitionTimer = window.setTimeout(() => {
        shell.classList.remove('is-switching-robot')
        this.shellTransitionTimer = 0
      }, 680)
    }

    const identity = this.root.querySelector<HTMLElement>('[data-system-identity]')
    if (identity) {
      identity.innerHTML = `<small>${escapeHtml(robot.brand)}</small><strong>${escapeHtml(robot.model)}</strong><em>${escapeHtml(formatStatus(robot.market.status))}</em>`
    }

    const index = this.root.querySelector<HTMLElement>('[data-system-index]')
    if (index) index.innerHTML = `<strong>${String(selectedIndex + 1).padStart(2, '0')}</strong><i>/</i><span>${String(catalog.robots.length).padStart(2, '0')}</span>`

    const buyLink = this.root.querySelector<HTMLAnchorElement>('[data-buy-link]')
    const officialUrl = officialProductUrl(robot)
    if (buyLink) {
      if (officialUrl) {
        buyLink.href = officialUrl
        buyLink.setAttribute('aria-label', `Buy or learn more about ${robot.display_name} on the official website`)
        buyLink.removeAttribute('aria-disabled')
      } else {
        buyLink.removeAttribute('href')
        buyLink.setAttribute('aria-label', `No official website is available for ${robot.display_name}`)
        buyLink.setAttribute('aria-disabled', 'true')
      }
    }

    const track = this.root.querySelector<HTMLElement>('[data-carousel-track]')
    if (track) {
      const visibleRobots = carouselWindow(selectedIndex)
      const windowKey = visibleRobots.map(({ robot: candidate }) => candidate.id).join('|')
      if (track.dataset.windowKey !== windowKey) {
        track.innerHTML = visibleRobots
          .map(({ robot: candidate, index: candidateIndex }) =>
            carouselItem(candidate, candidateIndex, robot.id),
          )
          .join('')
        track.dataset.windowKey = windowKey
      }

      track.querySelectorAll<HTMLButtonElement>('.carousel-item').forEach((item) => {
        const isSelected = item.dataset.robotId === robot.id
        item.classList.toggle('is-selected', isSelected)
        item.setAttribute('aria-pressed', String(isSelected))
      })

    }

    document.title = `${robot.display_name} — Future Form`
    this.updateAssetStatus()
  }

  private updateMotionState(enabled: boolean): void {
    this.updateToggleControl('toggle-motion', 'MOTION', enabled)
  }

  private updateAutoRotateState(enabled: boolean): void {
    this.updateToggleControl('toggle-auto-rotate', 'AUTO ROTATE', enabled)
  }

  private updateDitherState(enabled: boolean): void {
    this.updateToggleControl('toggle-dither', 'DITHER', enabled)
  }

  private updateToggleControl(action: string, label: string, enabled: boolean): void {
    const button = this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
    if (!button) return
    const visibleLabel = button.querySelector<HTMLElement>('[data-control-label]')
    if (visibleLabel) visibleLabel.textContent = `${label === 'AUTO ROTATE' ? 'ROTATE' : label} / ${enabled ? 'ON' : 'OFF'}`
    button.setAttribute('aria-pressed', String(enabled))
    button.setAttribute('aria-label', `Turn ${label.toLocaleLowerCase()} ${enabled ? 'off' : 'on'}`)
    button.title = `${label}: ${enabled ? 'on' : 'off'}`
  }

  private applyDockMagnification(pointerX: number): void {
    const items = this.dockViewport?.querySelectorAll<HTMLElement>('.carousel-item')
    if (!items?.length) return
    this.dockViewport?.classList.add('is-dock-active')

    items.forEach((item) => {
      const bounds = item.getBoundingClientRect()
      const distance = Math.abs(pointerX - (bounds.left + bounds.width / 2))
      const normalized = Math.min(distance / 118, 1)
      const influence = (Math.cos(normalized * Math.PI) + 1) / 2
      item.style.setProperty('--dock-scale', (1 + influence * 0.48).toFixed(3))
      item.style.setProperty('--dock-lift', `${(-influence * 14).toFixed(2)}px`)
      item.style.zIndex = String(1 + Math.round(influence * 20))
    })
  }

  private resetDockMagnification(): void {
    this.dockPointerX = null
    if (this.dockAnimationFrame) cancelAnimationFrame(this.dockAnimationFrame)
    this.dockAnimationFrame = 0
    this.dockViewport?.classList.remove('is-dock-active')
    this.dockViewport?.querySelectorAll<HTMLElement>('.carousel-item').forEach((item) => {
      item.style.removeProperty('--dock-scale')
      item.style.removeProperty('--dock-lift')
      item.style.removeProperty('z-index')
    })
  }

  private updateAssetStatus(): void {
    const element = this.root.querySelector<HTMLElement>('[data-asset-status]')
    if (!element) return
    element.className = `asset-status asset-status--${this.assetStatus.kind}`
    element.innerHTML = `<i></i><span>${escapeHtml(this.assetStatus.message)}</span><b>${formatPrice(this.snapshot.selectedRobot.pricing.store_price.usd)}</b>`
  }
}
