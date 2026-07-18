import { App } from './app'
import { SKINS } from './skins/index'
import { setupDock, setupGate, setupPortalControls } from './ui/dom'
import { disposeMintGltfRuntime } from './assets/gltf-runtime'
import { disposeAudioRuntime } from './audio/engine'

async function boot() {
  const container = document.getElementById('app')!
  const app = await App.create(container)

  const dock = setupDock(SKINS, (id) => app.setSkin(id), () => app.resetView())
  dock.setActive(SKINS[0].id)
  app.onSkinChange = (def) => dock.setActive(def.id)

  const portal = setupPortalControls(
    () => app.enterDanceFloor(),
    () => app.exitDanceFloor(),
    () => app.engine.toggle(),
    () => app.engine.next(),
  )
  app.engine.on('state', () => portal.setPlaying(app.engine.playing))
  portal.setPlaying(app.engine.playing)
  app.onModeChange = (mode) => {
    portal.setMode(mode)
    dock.setLocked(mode === 'entering' || mode === 'exiting')
  }
  portal.setMode('cd')

  setupGate(() => {
    app.powerOn()
    portal.setPowered(true)
  })
  // debug handle for scene inspection
  ;(window as unknown as { __app: App }).__app = app
}

void boot()

window.addEventListener('pagehide', () => {
  disposeMintGltfRuntime()
  disposeAudioRuntime()
}, { once: true })
