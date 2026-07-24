import * as THREE from 'three'
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import type { RobotTheme } from '../theme'
import type { CatalogRobot } from '../types'
import { applySpatialPose, SpatialMotionController } from './SpatialMotion'

const SURFACE_SCALE = 0.00125
const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

function createVideoSurface(
  robot: CatalogRobot,
  theme: RobotTheme,
  lightweight: boolean,
): HTMLElement {
  const video = robot.watch_video
  const surface = document.createElement('article')
  surface.className = 'spatial-video'
  surface.style.setProperty('--video-accent', theme.accent)
  surface.style.setProperty('--video-ink', theme.ink)
  surface.style.setProperty('--video-paper', theme.paper)
  surface.setAttribute('aria-label', `Official video about ${robot.display_name}`)

  const frame = document.createElement('div')
  frame.className = 'spatial-video__frame'
  if (lightweight) {
    const link = document.createElement('a')
    link.className = 'spatial-video__mobile-link'
    link.href = video.watch_url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.setAttribute('aria-label', `Watch ${video.title} on YouTube`)

    const poster = document.createElement('img')
    poster.src = `https://i.ytimg.com/vi/${encodeURIComponent(video.video_id)}/hqdefault.jpg`
    poster.alt = ''
    poster.loading = 'lazy'
    poster.decoding = 'async'

    const label = document.createElement('span')
    label.textContent = 'WATCH OFFICIAL VIDEO ↗'
    link.append(poster, label)
    frame.append(link)
  } else {
    const iframe = document.createElement('iframe')
    iframe.src = `${video.embed_url}?rel=0&playsinline=1&modestbranding=1`
    iframe.title = `${video.title} — ${video.channel}`
    iframe.loading = 'lazy'
    iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share'
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    iframe.allowFullscreen = true
    frame.append(iframe)
  }

  surface.append(frame)
  return surface
}

export class WatchVideoLayer {
  private readonly scene = new THREE.Scene()
  private readonly renderer = new CSS3DRenderer()
  private readonly motion = new SpatialMotionController()
  private readonly lightweight = window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  private currentSurface: CSS3DObject | null = null

  constructor(host: HTMLElement) {
    this.renderer.domElement.className = 'showroom__css3d'
    this.renderer.domElement.setAttribute('aria-label', 'Interactive robot video layer')
    this.renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1))
    host.append(this.renderer.domElement)
  }

  update(
    robot: CatalogRobot,
    theme: RobotTheme,
    height: number,
    direction = 0,
    animateTransition = false,
  ): void {
    const target = {
      x: 0.78,
      y: height * 0.25 + 0.25,
      z: 0.5,
      scale: SURFACE_SCALE,
      rotationY: 0,
    }
    const next = new CSS3DObject(createVideoSurface(robot, theme, this.lightweight))
    next.name = `official-watch-video-${robot.id}`
    applySpatialPose(next, target)
    this.scene.add(next)

    const previous = this.currentSurface
    this.currentSurface = next

    if (!animateTransition || direction === 0) {
      if (previous) this.disposeSurface(previous)
      return
    }

    applySpatialPose(next, {
      x: target.x + direction * 0.6,
      y: target.y,
      z: target.z + 0.1,
      scale: SURFACE_SCALE * 0.72,
      rotationY: -direction * 0.18,
    })
    this.motion.move(next, target, {
      duration: 0.56,
      delay: 0.08,
      easing: 'enter',
    })

    if (previous) {
      this.motion.move(
        previous,
        {
          x: previous.position.x - direction * 0.72,
          y: previous.position.y + 0.02,
          z: previous.position.z + 0.12,
          scale: SURFACE_SCALE * 0.68,
          rotationY: direction * 0.2,
        },
        {
          duration: 0.34,
          easing: 'exit',
          onComplete: () => this.disposeSurface(previous),
        },
      )
    }
  }

  animate(delta: number): void {
    this.motion.update(delta)
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera)
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height)
  }

  get surfaceCount(): number {
    return this.scene.children.length
  }

  destroy(): void {
    this.motion.clear()
    for (const surface of [...this.scene.children]) {
      if (surface instanceof CSS3DObject) this.disposeSurface(surface)
    }
    this.renderer.domElement.remove()
  }

  private disposeSurface(surface: CSS3DObject): void {
    this.motion.cancel(surface)
    const iframe = surface.element.querySelector('iframe')
    if (iframe) iframe.src = 'about:blank'
    const image = surface.element.querySelector('img')
    if (image) image.removeAttribute('src')
    surface.removeFromParent()
    surface.element.remove()
  }
}
