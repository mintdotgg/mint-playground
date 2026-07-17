import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GROVE_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: .012 },
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
    uniform float uGrain;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(.2126, .7152, .0722));
      color.rgb = mix(vec3(luma), color.rgb, 1.13);
      color.rgb = (color.rgb - .5) * 1.055 + .5;
      color.rgb *= vec3(1.025, 1.01, .97);
      float edge = smoothstep(.24, .72, distance(vUv, vec2(.5)));
      color.rgb *= 1.0 - edge * .16;
      float grain = hash21(vUv * vec2(1463.0, 821.0) + floor(uTime * 12.0)) - .5;
      color.rgb += grain * uGrain;
      gl_FragColor = color;
    }
  `,
};

export class RenderPipeline {
  readonly enabled: boolean;
  readonly dprCap: number;
  readonly postPasses: number;

  private readonly composer: EffectComposer | null;
  private readonly gradePass: ShaderPass | null;
  private readonly outputPass: OutputPass | null;
  private reducedMotion = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    const compact = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    this.enabled = !compact;
    this.dprCap = compact ? 1.35 : 1.65;
    this.postPasses = this.enabled ? 1 : 0;

    if (!this.enabled) {
      this.composer = null;
      this.gradePass = null;
      this.outputPass = null;
      return;
    }

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gradePass = new ShaderPass(GROVE_GRADE_SHADER);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.outputPass);
    this.resize();
  }

  resize(): void {
    if (!this.composer) return;
    const canvas = this.renderer.domElement;
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    this.composer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  render(elapsed: number): void {
    if (!this.composer || !this.gradePass) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.gradePass.uniforms.uTime.value = this.reducedMotion ? 0 : elapsed;
    this.gradePass.uniforms.uGrain.value = this.reducedMotion ? 0 : .012;
    this.composer.render();
  }

  dispose(): void {
    this.gradePass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
  }
}
