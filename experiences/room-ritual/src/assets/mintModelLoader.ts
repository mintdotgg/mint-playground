import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { DecorProduct, FinishOption, Product } from '../types'
import { mintDecorModelPaths, mintModelPaths } from './mintAssets'

const loader = new GLTFLoader()
const baseLoads = new Map<string, Promise<THREE.Group>>()

const loadBase = (path: string) => {
  let promise = baseLoads.get(path)
  if (!promise) {
    promise = loader.loadAsync(path).then((gltf) => gltf.scene)
    baseLoads.set(path, promise)
  }
  return promise
}

const cloneMaterial = (material: THREE.Material, finish?: FinishOption, meshIndex = 0) => {
  if (!finish) return material.clone()
  const sourceMetalness = material instanceof THREE.MeshStandardMaterial ? material.metalness : 0
  const role = sourceMetalness > 0.45 ? 2 : meshIndex % 4 === 0 ? 1 : 0
  const target = [finish.primary, finish.secondary, finish.accent][role]
  const tint = new THREE.Color(target)
  const authored = new THREE.MeshStandardMaterial({
    name: material.name,
    color: tint,
    metalness: role === 2 ? Math.max(sourceMetalness, 0.55) : 0.04,
    roughness: role === 2 ? 0.32 : 0.72,
    emissive: new THREE.Color(target),
    emissiveIntensity: 0.18,
    side: material.side,
    transparent: material.transparent,
    opacity: material.opacity,
    alphaTest: material.alphaTest,
    depthWrite: material.depthWrite,
  })
  return authored
}

const normalizeModel = (
  source: THREE.Group,
  dimensions: { width: number; depth: number; height: number },
  finish?: FinishOption,
) => {
  const visual = source.clone(true)
  let meshIndex = 0
  visual.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry = object.geometry.clone()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    object.material = materials.map((material) => cloneMaterial(material, finish, meshIndex++))
    if (object.material.length === 1) object.material = object.material[0]
    object.castShadow = true
    object.receiveShadow = true
  })

  visual.updateMatrixWorld(true)
  const initial = new THREE.Box3().setFromObject(visual)
  const size = initial.getSize(new THREE.Vector3())
  visual.scale.set(
    dimensions.width / Math.max(size.x, 0.001),
    dimensions.height / Math.max(size.y, 0.001),
    dimensions.depth / Math.max(size.z, 0.001),
  )
  visual.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(visual)
  const center = fitted.getCenter(new THREE.Vector3())
  visual.position.x -= center.x
  visual.position.y -= fitted.min.y
  visual.position.z -= center.z

  const root = new THREE.Group()
  root.add(visual)
  root.userData.source = 'mint'
  return root
}

export const loadMintProductModel = async (product: Product, finish: FinishOption) => {
  const path = mintModelPaths[product.id]
  if (!path) return null
  const source = await loadBase(path)
  const root = normalizeModel(source, product.dimensions, finish)
  root.name = `${product.name} Mint Model`
  root.userData.productId = product.id
  root.userData.finishId = finish.id
  if (product.id === 'pilaster-credenza') {
    const drawerMaterial = new THREE.MeshStandardMaterial({ color: finish.primary, roughness: 0.55 })
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(product.dimensions.width * 0.34, 0.1, product.dimensions.depth * 0.8), drawerMaterial)
    drawer.name = 'detailDrawer'
    drawer.position.set(0, product.dimensions.height * 0.7, 0.02)
    drawer.userData.closedZ = drawer.position.z
    drawer.castShadow = true
    root.add(drawer)
  }
  return root
}

export const loadMintDecorModel = async (decor: DecorProduct) => {
  const path = mintDecorModelPaths[decor.id]
  if (!path) return null
  const source = await loadBase(path)
  const decorFinish: FinishOption = {
    id: `${decor.id}-palette`,
    name: decor.name,
    description: '',
    primary: decor.color,
    secondary: '#c8b493',
    accent: '#45423d',
    materialNames: [],
    priceDelta: 0,
  }
  const root = normalizeModel(source, decor.dimensions, decorFinish)
  root.name = `${decor.name} Mint Model`
  root.userData.decorId = decor.id
  return root
}
