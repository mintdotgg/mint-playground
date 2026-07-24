import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const DITHER_PRESET = {
  strength: 0.06,
  gridSize: 2,
  pixelation: 2,
  grayscale: false,
  invert: false,
  contrast: 1.4,
}

const studioFinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGrainStrength: { value: 0.018 },
    uVignetteStrength: { value: 0.115 },
    uDitherAmount: { value: 0 },
    uDitherStrength: { value: DITHER_PRESET.strength },
    uDitherGridSize: { value: DITHER_PRESET.gridSize },
    uDitherPixelation: { value: DITHER_PRESET.pixelation },
    uDitherGrayscale: { value: DITHER_PRESET.grayscale ? 1 : 0 },
    uDitherInvert: { value: DITHER_PRESET.invert ? 1 : 0 },
    uDitherContrast: { value: DITHER_PRESET.contrast },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGrainStrength;
    uniform float uVignetteStrength;
    uniform float uDitherAmount;
    uniform float uDitherStrength;
    uniform float uDitherGridSize;
    uniform float uDitherPixelation;
    uniform float uDitherGrayscale;
    uniform float uDitherInvert;
    uniform float uDitherContrast;
    varying vec2 vUv;

    const mat4 BAYER_THRESHOLDS = mat4(
      0.03125, 0.53125, 0.15625, 0.65625,
      0.78125, 0.28125, 0.90625, 0.40625,
      0.21875, 0.71875, 0.09375, 0.59375,
      0.96875, 0.46875, 0.84375, 0.34375
    );

    float filmNoise(vec2 pixel, float frame) {
      vec2 seed = pixel + vec2(frame * 113.0, -frame * 79.0);
      return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float bayerThreshold(vec2 cellCoord) {
      ivec2 index = ivec2(mod(cellCoord, 4.0));
      return BAYER_THRESHOLDS[index.x][index.y];
    }

    void main() {
      vec2 fragCoord = vUv * uResolution;
      vec2 ditherCell = floor(fragCoord / uDitherGridSize);
      float pixelSize = max(uDitherGridSize * uDitherPixelation, 1.0);
      vec2 pixelCell = floor(fragCoord / pixelSize);
      vec2 pixelatedUv = (pixelCell + 0.5) * pixelSize / uResolution;
      float ditherMix = uDitherAmount * uDitherStrength;
      vec2 sampleUv = mix(vUv, pixelatedUv, ditherMix);
      vec4 sampleColor = texture2D(tDiffuse, sampleUv);
      vec3 color = max(sampleColor.rgb, vec3(0.0));
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      // Preserve the graphic palette while giving the midtones a restrained
      // photographic separation before ACES/output conversion.
      color = mix(vec3(luma), color, 1.035);
      color *= mix(0.975, 1.018, smoothstep(0.08, 1.15, luma));

      vec2 lens = vUv * 2.0 - 1.0;
      lens.x *= uResolution.x / max(uResolution.y, 1.0);
      float vignette = smoothstep(0.56, 1.36, length(lens));
      color *= 1.0 - vignette * uVignetteStrength;

      float noise = filmNoise(gl_FragCoord.xy, floor(uTime * 18.0));
      float grainEnvelope = mix(1.0, 0.58, smoothstep(0.35, 1.4, luma));
      color += (noise - 0.5) * uGrainStrength * grainEnvelope * (1.0 - ditherMix * 0.7);

      // CanvasUI-inspired ordered Bayer finish, mixed over the studio image
      // instead of replacing it. Color-channel dithering is the readable
      // default; grayscale remains an optional property.
      vec3 perceptual = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
      perceptual = clamp((perceptual - 0.5) * uDitherContrast + 0.5, 0.0, 1.0);
      float ditherLuma = dot(perceptual, vec3(0.2126, 0.7152, 0.0722));
      float threshold = bayerThreshold(ditherCell);
      vec3 colorBits = step(vec3(threshold), perceptual);
      vec3 grayscaleBits = vec3(step(threshold, ditherLuma));
      vec3 ditherColor = mix(colorBits, grayscaleBits, uDitherGrayscale);
      ditherColor = mix(ditherColor, 1.0 - ditherColor, uDitherInvert);
      ditherColor = mix(vec3(0.012), vec3(0.94), ditherColor);
      color = mix(color, ditherColor, ditherMix);

      gl_FragColor = vec4(max(color, vec3(0.0)), sampleColor.a);
    }
  `,
}

export class StudioPostProcessing {
  private readonly composer: EffectComposer
  private readonly finishPass: ShaderPass
  private readonly outputPass: OutputPass
  private ditherEnabled = true
  private ditherAmount = 0

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    const size = renderer.getSize(new THREE.Vector2())

    this.finishPass = new ShaderPass(studioFinishShader)
    this.composer.addPass(this.finishPass)

    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    this.setSize(size.x, size.y, renderer.getPixelRatio())
  }

  render(delta: number, elapsed: number): void {
    this.finishPass.uniforms.uTime.value = elapsed
    this.ditherAmount = THREE.MathUtils.damp(
      this.ditherAmount,
      this.ditherEnabled ? 1 : 0,
      12,
      delta,
    )
    this.finishPass.uniforms.uDitherAmount.value = this.ditherAmount
    this.composer.render(delta)
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    this.finishPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio)
    this.finishPass.uniforms.uDitherGridSize.value = Math.max(
      DITHER_PRESET.gridSize * pixelRatio,
      1,
    )
  }

  toggleDither(): boolean {
    this.ditherEnabled = !this.ditherEnabled
    return this.ditherEnabled
  }

  get isDitherEnabled(): boolean {
    return this.ditherEnabled
  }

  get passCount(): number {
    return 3
  }

  dispose(): void {
    this.finishPass.dispose()
    this.outputPass.dispose()
    this.composer.dispose()
  }
}
