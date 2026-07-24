import type { CatalogRobot, MintRegistry } from '../types'

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

type ArSources = {
  glbUrl: string
  iosSrc: string
}

type NativeArPlatform = 'ios' | 'android' | 'unsupported'

function arSourcesForRobot(registry: MintRegistry, robotId: string): ArSources | null {
  const record = registry.assets[robotId]
  if (!record) return null

  const artifacts = Object.values(record.artifacts)
  const glb = artifacts.find((artifact) => artifact.role === 'canonical_model')
  const usdz = artifacts.find(
    (artifact) => artifact.role === 'ar_model' && artifact.format === 'usdz',
  )

  if (!glb?.runtimeUrl || !usdz?.runtimeUrl) return null
  return {
    glbUrl: glb.runtimeUrl,
    iosSrc: usdz.runtimeUrl,
  }
}

export function detectNativeArPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints = 0,
): NativeArPlatform {
  if (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  ) {
    return 'ios'
  }
  return /Android/i.test(userAgent) ? 'android' : 'unsupported'
}

export function createSceneViewerIntent(glbUrl: string, fallbackUrl: string): string {
  const modelUrl = new URL(glbUrl, fallbackUrl)
  modelUrl.hash = ''
  const parameters = new URLSearchParams({
    file: modelUrl.toString(),
    mode: 'ar_preferred',
    disable_occlusion: 'true',
  })
  return `intent://arvr.google.com/scene-viewer/1.2?${parameters.toString()}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
}

function launchLink(href: string, rel?: string): void {
  const link = document.createElement('a')
  link.href = href
  if (rel) link.rel = rel
  link.style.display = 'none'

  // Safari recognizes a USDZ link as an AR Quick Look launch target when the
  // `rel="ar"` anchor contains an image. No GLB renderer or conversion is
  // required in the page.
  if (rel === 'ar') link.append(document.createElement('img'))

  document.body.append(link)
  link.click()
  link.remove()
}

export class ModelArControl {
  private readonly button: HTMLButtonElement
  private readonly status: HTMLElement
  private readonly mobileViewport = window.matchMedia(MOBILE_VIEWPORT_QUERY)
  private readonly platform = detectNativeArPlatform(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
  )
  private selectedRobot: CatalogRobot | null = null
  private sources: ArSources | null = null

  private readonly onActivate = (): void => {
    this.activate()
  }

  constructor(
    root: HTMLElement,
    private readonly registry: MintRegistry,
  ) {
    const button = root.querySelector<HTMLButtonElement>('[data-ar-button]')
    const status = root.querySelector<HTMLElement>('[data-ar-status]')
    if (!button || !status) {
      throw new Error('Robot Store could not create the AR control.')
    }

    this.button = button
    this.status = status
    this.button.addEventListener('click', this.onActivate)
  }

  setRobot(robot: CatalogRobot): void {
    this.selectedRobot = robot
    this.sources = arSourcesForRobot(this.registry, robot.id)
    this.button.setAttribute(
      'aria-label',
      `View ${robot.display_name} in augmented reality`,
    )
    this.button.title = `View ${robot.display_name} in AR`
    this.setStatus('')
    this.updateReadyState()
  }

  destroy(): void {
    this.button.removeEventListener('click', this.onActivate)
  }

  private updateReadyState(): void {
    const isReady =
      this.mobileViewport.matches &&
      Boolean(this.sources) &&
      this.platform !== 'unsupported'
    if (isReady) {
      this.button.removeAttribute('aria-disabled')
    } else {
      this.button.setAttribute('aria-disabled', 'true')
    }
    this.button.setAttribute('aria-busy', 'false')
  }

  private setStatus(message: string): void {
    this.status.textContent = message
    this.status.toggleAttribute('hidden', !message)
  }

  private activate(): void {
    if (!this.mobileViewport.matches) {
      this.setStatus('Available only on mobile.')
      return
    }
    if (!this.selectedRobot || !this.sources) {
      this.setStatus('AR model is not available.')
      return
    }

    if (this.platform === 'ios') {
      this.setStatus('')
      launchLink(this.sources.iosSrc, 'ar')
      return
    }
    if (this.platform === 'android') {
      this.setStatus('')
      launchLink(createSceneViewerIntent(this.sources.glbUrl, window.location.href))
      return
    }

    this.setStatus('AR is not available on this device.')
  }
}
