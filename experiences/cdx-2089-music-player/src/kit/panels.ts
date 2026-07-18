import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Shared rounded-rect SDF plate shader — the core of the "stacked PNG layer"
// illusion. Cheap, resolution-independent, with optional border + texture.

const PLATE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PLATE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform vec3 uBorderColor;
  uniform float uOpacity;
  uniform float uRadius;      // corner radius in world units
  uniform vec2 uSize;         // plate size in world units
  uniform float uBorder;      // border width in world units (0 = none)
  uniform float uTexAmt;
  uniform sampler2D uTex;
  uniform vec2 uTexScale;
  uniform float uGrainAmt;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRoundBox(p, uSize * 0.5, uRadius);
    float aa = max(fwidth(d) * 1.2, 1e-4);
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    if (alpha <= 0.003) discard;

    vec3 col = uColor;
    if (uTexAmt > 0.001) {
      vec3 t = texture2D(uTex, vUv * uTexScale).rgb;
      col = mix(col, col * t * 2.0, uTexAmt);
    }
    // subtle top-lit shading so plates don't read dead flat
    col *= 1.0 + (vUv.y - 0.5) * 0.10;
    if (uGrainAmt > 0.001) {
      col += (hash(vUv * 617.0) - 0.5) * uGrainAmt;
    }
    if (uBorder > 0.0001) {
      float bd = 1.0 - smoothstep(-uBorder - aa, -uBorder + aa, d);
      col = mix(uBorderColor, col, bd);
    }
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`

export interface PlateOpts {
  w: number
  h: number
  r?: number
  /** physical chassis thickness behind the printed face */
  depth?: number
  color: number
  opacity?: number
  border?: { color: number; width: number }
  texture?: THREE.Texture
  texAmt?: number
  texScale?: [number, number]
  grain?: number
}

export function makePlate(o: PlateOpts): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLATE_VERT,
    fragmentShader: PLATE_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uBorderColor: { value: new THREE.Color(o.border?.color ?? 0xffffff) },
      uOpacity: { value: o.opacity ?? 1 },
      uRadius: { value: o.r ?? Math.min(o.w, o.h) * 0.08 },
      uSize: { value: new THREE.Vector2(o.w, o.h) },
      uBorder: { value: o.border?.width ?? 0 },
      uTexAmt: { value: o.texture ? (o.texAmt ?? 1) : 0 },
      uTex: { value: o.texture ?? new THREE.Texture() },
      uTexScale: { value: new THREE.Vector2(...(o.texScale ?? [1, 1])) },
      uGrainAmt: { value: o.grain ?? 0 },
    },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), mat)
  mesh.userData.isPlate = true

  // The canvas/SDF face stays razor-sharp, but now sits on a real beveled
  // manufactured body. This makes every existing skin react to perspective,
  // parallax and directional light instead of reading as a stack of PNGs.
  const depth = o.depth ?? Math.min(0.12, Math.max(0.055, Math.min(o.w, o.h) * 0.12))
  const radius = Math.min(o.r ?? Math.min(o.w, o.h) * 0.08, Math.min(o.w, o.h) * 0.22)
  const alpha = o.opacity ?? 1
  const bodyMat = alpha < 0.78
    ? new THREE.MeshPhysicalMaterial({
        color: o.color,
        transparent: true,
        opacity: Math.max(0.18, alpha * 0.82),
        transmission: Math.min(0.28, (1 - alpha) * 0.45),
        thickness: depth,
        roughness: 0.24,
        metalness: 0.08,
        clearcoat: 0.75,
        clearcoatRoughness: 0.2,
        depthWrite: false,
      })
    : new THREE.MeshStandardMaterial({
        color: o.color,
        roughness: 0.38,
        metalness: 0.38,
      })
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(o.w * 0.992, o.h * 0.992, depth, 4, Math.max(0.01, radius * 0.82)),
    bodyMat,
  )
  body.name = 'plate-depth-body'
  body.position.z = -depth * 0.5 - 0.006
  body.userData.plateDepth = depth
  mesh.add(body)
  return mesh
}

/**
 * Soft dark blob — fake drop shadow / grounding shadow.
 * Canvas radial gradient on MeshBasicMaterial: alpha is baked and bounded,
 * so no shader edge cases and transitions can fade it like any panel.
 */
export function makeShadow(w: number, h: number, strength = 0.5, color = 0x000000): THREE.Mesh {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const col = new THREE.Color(color)
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`
  const grad = g.createRadialGradient(128, 128, 20, 128, 128, 126)
  grad.addColorStop(0, `rgba(${rgb},${strength})`)
  grad.addColorStop(0.65, `rgba(${rgb},${strength * 0.45})`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
  mesh.renderOrder = -5
  return mesh
}

/** Smoked-glass circle with fresnel sheen (the MONOLITH disc window). */
export function makeGlassDisc(radius: number, tint: number, opacity: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      uniform vec3 uTint;
      uniform float uOpacity;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(clamp(1.0 - abs(dot(V, normalize(vNormal))), 0.0, 1.0), 2.0);
        // diagonal sheen band
        float band = 1.0 - smoothstep(0.0, 0.55, abs(p.x * 0.7 + p.y * 0.55 - 0.18));
        float edge = smoothstep(0.86, 1.0, r);
        vec3 col = uTint + vec3(0.35) * band * 0.22 + vec3(0.5) * fres * 0.35 + vec3(0.4) * edge * 0.3;
        float a = uOpacity + fres * 0.25 + band * 0.08;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
  })
  return new THREE.Mesh(new THREE.CircleGeometry(radius, 96), mat)
}

/** Flat annulus ring plate. */
export function makeRingPlate(
  rIn: number,
  rOut: number,
  color: number,
  opacity = 1,
  thetaStart = 0,
  thetaLen = Math.PI * 2,
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  const face = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 128, 1, thetaStart, thetaLen), mat)

  // Give every bezel segment a deep, beveled profile. A polygonal annulus is
  // more reliable here than a torus because several skins use partial arcs.
  const points = Math.max(12, Math.ceil(72 * (thetaLen / (Math.PI * 2))))
  const shape = new THREE.Shape()
  for (let i = 0; i <= points; i++) {
    const a = thetaStart + (i / points) * thetaLen
    const x = Math.cos(a) * rOut
    const y = Math.sin(a) * rOut
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  for (let i = points; i >= 0; i--) {
    const a = thetaStart + (i / points) * thetaLen
    shape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn)
  }
  shape.closePath()
  const depth = Math.min(0.14, Math.max(0.055, (rOut - rIn) * 0.5))
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.018, (rOut - rIn) * 0.1),
    bevelThickness: 0.012,
    curveSegments: 2,
  })
  bodyGeo.translate(0, 0, -depth - 0.018)
  const body = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshStandardMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      roughness: 0.32,
      metalness: 0.58,
      depthWrite: opacity > 0.75,
    }),
  )
  body.name = 'bezel-depth-body'
  face.add(body)
  return face
}

/** Instanced hardware screws — sprinkle on plates for that bolted look. */
export function makeScrews(points: Array<[number, number, number?]>, size = 0.05): THREE.Group {
  const group = new THREE.Group()
  group.name = 'hardware-screws'
  const headGeo = new THREE.CylinderGeometry(size * 0.46, size * 0.5, size * 0.24, 18, 1)
  headGeo.rotateX(Math.PI / 2)
  const head = new THREE.InstancedMesh(
    headGeo,
    new THREE.MeshStandardMaterial({ color: 0x5d636c, metalness: 0.92, roughness: 0.28 }),
    points.length,
  )
  const slot = new THREE.InstancedMesh(
    new THREE.BoxGeometry(size * 0.58, size * 0.1, size * 0.06),
    new THREE.MeshStandardMaterial({ color: 0x121419, metalness: 0.5, roughness: 0.5 }),
    points.length,
  )
  const m = new THREE.Matrix4()
  const slotM = new THREE.Matrix4()
  const s = new THREE.Vector3(1, 1, 1)
  points.forEach((p, i) => {
    const a = (i * 1.7) % Math.PI
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a)
    m.compose(new THREE.Vector3(p[0], p[1], p[2] ?? 0), q, s)
    head.setMatrixAt(i, m)
    slotM.compose(new THREE.Vector3(p[0], p[1], (p[2] ?? 0) + size * 0.135), q, s)
    slot.setMatrixAt(i, slotM)
  })
  head.instanceMatrix.needsUpdate = true
  slot.instanceMatrix.needsUpdate = true
  group.add(head, slot)
  return group
}

/** Set opacity on any plate/canvas/basic material mesh tree (for transitions). */
export function setTreeOpacity(root: THREE.Object3D, v: number) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.Material & {
      uniforms?: Record<string, { value: unknown }>
      opacity: number
    }
    if (!mat) return
    const base = (mesh.userData.baseOpacity as number | undefined) ?? 1
    if ('uniforms' in mat && mat.uniforms?.uOpacity) {
      ;(mat.uniforms.uOpacity as { value: number }).value = base * v
    } else if ('opacity' in mat) {
      mat.transparent = true
      mat.opacity = base * v
    }
  })
}

/** Remember each material's designed opacity so transitions can scale it. */
export function rememberOpacity(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.Material & {
      uniforms?: Record<string, { value: unknown }>
      opacity: number
    }
    if (!mat) return
    if ('uniforms' in mat && mat.uniforms?.uOpacity) {
      mesh.userData.baseOpacity = (mat.uniforms.uOpacity as { value: number }).value
    } else if ('opacity' in mat) {
      mesh.userData.baseOpacity = mat.opacity
    }
  })
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.userData.shared) return
    if (mesh.isMesh) {
      if (!mesh.userData.sharedGeometry) mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const mm = m as THREE.Material & { map?: THREE.Texture; uniforms?: Record<string, { value: unknown }> }
        if (mm.map && mm.map instanceof THREE.CanvasTexture) mm.map.dispose()
        mm.dispose?.()
      }
    }
  })
}
