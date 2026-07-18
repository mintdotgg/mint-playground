import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MINT_ASSET_URLS } from './runtime'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath(MINT_ASSET_URLS.dracoDecoderPath)

export const mintGltfLoader = new GLTFLoader()
mintGltfLoader.setDRACOLoader(dracoLoader)

let disposed = false

export function disposeMintGltfRuntime(): void {
  if (disposed) return
  disposed = true
  dracoLoader.dispose()
}
