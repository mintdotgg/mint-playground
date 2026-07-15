import * as THREE from 'three'

export interface DissolveHandle {
  uniforms: {
    uDissolve: { value: number }
    uEdgeColor: { value: THREE.Color }
  }
}

/**
 * Patches every material in a model with a world-space noise dissolve.
 * uDissolve: 0 = fully visible, 1 = fully dissolved.
 * A thin emissive edge in the poster accent color burns along the threshold.
 *
 * roughFloor clamps per-texel roughness from below: generated models often
 * carry mirror-flat patches in their roughness maps that catch point lights
 * as harsh white glints ("shimmer"). Raising the floor keeps the material
 * readable while killing the sparkle.
 */
export function makeDissolvable(root: THREE.Object3D, roughFloor = 0): DissolveHandle[] {
  const handles: DissolveHandle[] = []

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of materials) {
      const m = mat as THREE.MeshStandardMaterial
      const uniforms = {
        uDissolve: { value: 0 },
        uEdgeColor: { value: new THREE.Color('#c8ff00') },
        uRoughFloor: { value: roughFloor },
      }

      m.onBeforeCompile = (shader) => {
        shader.uniforms.uDissolve = uniforms.uDissolve
        shader.uniforms.uEdgeColor = uniforms.uEdgeColor
        shader.uniforms.uRoughFloor = uniforms.uRoughFloor

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vDissolveWorld;'
          )
          .replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\nvDissolveWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          )

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec3 vDissolveWorld;
uniform float uDissolve;
uniform vec3 uEdgeColor;
uniform float uRoughFloor;

float dHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float dNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x),
        mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x),
        mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float dFbm(vec3 p) {
  float v = 0.0;
  v += 0.55 * dNoise(p * 2.2);
  v += 0.30 * dNoise(p * 5.1);
  v += 0.15 * dNoise(p * 11.7);
  return v;
}`
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
roughnessFactor = max(roughnessFactor, uRoughFloor);`
          )
          .replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
{
  float n = dFbm(vDissolveWorld);
  float cut = uDissolve * 1.12;
  if (n < cut) discard;
  float edge = smoothstep(cut, cut + 0.09, n);
  gl_FragColor.rgb = mix(uEdgeColor * 1.9, gl_FragColor.rgb, edge);
}`
          )
      }
      m.needsUpdate = true
      handles.push({ uniforms })
    }
  })

  return handles
}

export function setDissolve(handles: DissolveHandle[], v: number, edge?: THREE.Color) {
  for (const h of handles) {
    h.uniforms.uDissolve.value = v
    if (edge) h.uniforms.uEdgeColor.value.copy(edge)
  }
}
