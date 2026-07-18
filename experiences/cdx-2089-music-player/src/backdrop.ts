import * as THREE from 'three'
import { tweens, easings } from './tween'
import type { SkinPalette } from './skins/types'

/** One flat, screen-space color per skin. No image, texture, gradient, or motion. */
export class Backdrop {
  mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uColor: { value: new THREE.Color(0x111921) },
      },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position.xy, 0.9999, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColor;
        void main() {
          gl_FragColor = vec4(uColor, 1.0);
        }
      `,
    })

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -10
  }

  setPalette(p: SkinPalette) {
    const from = (this.mat.uniforms.uColor.value as THREE.Color).clone()
    // Collapse the old two-color palette into one restrained solid shade.
    const target = new THREE.Color(p.bgTop).lerp(new THREE.Color(p.bgBot), 0.32)
    tweens.add({
      duration: 0.55,
      ease: easings.inOutCubic,
      onUpdate: (v) => {
        ;(this.mat.uniforms.uColor.value as THREE.Color).lerpColors(from, target, v)
      },
    })
  }
}
