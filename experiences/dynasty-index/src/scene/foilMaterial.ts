import * as THREE from 'three';
import type { CardProfile, TreatmentKind } from '../types';

const modeByTreatment: Record<TreatmentKind, number> = {
  prismatic: 0,
  metallic: 1,
  archival: 2,
  refractive: 3,
  frosted: 4,
  microline: 5,
};

export interface FoilMaterialController {
  material: THREE.ShaderMaterial;
  setCard: (card: CardProfile) => void;
  setInspection: (active: boolean) => void;
  setLightPosition: (position: THREE.Vector3) => void;
  update: (elapsed: number) => void;
}

export function createFoilMaterial(): FoilMaterialController {
  const uniforms = {
    uTime: { value: 0 },
    uMode: { value: 0 },
    uAccent: { value: new THREE.Color('#ff624c') },
    uAccentSecondary: { value: new THREE.Color('#5577ff') },
    uIntensity: { value: 0.44 },
    uLightPosition: { value: new THREE.Vector3(2, 4, 4) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uMode;
      uniform vec3 uAccent;
      uniform vec3 uAccentSecondary;
      uniform float uIntensity;
      uniform vec3 uLightPosition;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(uLightPosition - vWorldPosition);
        vec3 halfDirection = normalize(viewDirection + lightDirection);
        float specular = pow(max(dot(normal, halfDirection), 0.0), 52.0);
        float grazing = pow(1.0 - abs(dot(normal, viewDirection)), 2.2);
        float angle = dot(viewDirection.xy, vec2(0.71, 0.43)) + dot(lightDirection.xy, vec2(0.24, 0.76));
        float sweep = 0.5 + 0.5 * sin((vUv.x * 1.45 + vUv.y * 0.72 + angle * 0.8) * 22.0 + uTime * 0.18);
        vec3 spectrum = 0.55 + 0.45 * cos(6.28318 * (vec3(0.02, 0.35, 0.67) + sweep * 0.82 + angle * 0.24));
        float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeMask = 1.0 - smoothstep(0.018, 0.105, edgeDistance);
        float diagonal = smoothstep(0.2, 0.86, 0.5 + 0.5 * sin((vUv.x + vUv.y * 0.62) * 74.0 + angle * 9.0));
        float microline = pow(0.5 + 0.5 * sin((vUv.x * 0.8 + vUv.y) * 265.0 + angle * 17.0), 11.0);
        float registerGrid = max(
          pow(0.5 + 0.5 * sin(vUv.x * 94.0), 18.0),
          pow(0.5 + 0.5 * sin(vUv.y * 122.0), 22.0)
        );
        float frost = hash21(floor(vUv * 430.0)) * 0.34 + hash21(floor(vUv * 91.0)) * 0.18;

        float mask = 0.0;
        vec3 color = mix(uAccent, spectrum, 0.72);

        if (uMode < 0.5) {
          mask = edgeMask * 0.35 + diagonal * 0.1 + registerGrid * 0.05;
          color = mix(mix(uAccent, uAccentSecondary, sweep), spectrum, 0.7);
        } else if (uMode < 1.5) {
          mask = edgeMask * 0.16 + registerGrid * 0.23 + diagonal * 0.07;
          color = mix(uAccent, vec3(1.0, 0.82, 0.5), specular + sweep * 0.18);
        } else if (uMode < 2.5) {
          mask = edgeMask * 0.025 + frost * 0.02;
          color = mix(uAccent, vec3(0.95, 0.82, 0.63), 0.5);
        } else if (uMode < 3.5) {
          mask = edgeMask * 0.62 + registerGrid * 0.08;
          color = mix(uAccent, spectrum, 0.78);
        } else if (uMode < 4.5) {
          mask = edgeMask * 0.2 + frost * 0.33 + registerGrid * 0.06;
          color = mix(uAccentSecondary, vec3(0.78, 1.0, 1.0), sweep);
        } else {
          mask = edgeMask * 0.18 + microline * 0.48 + diagonal * 0.05;
          color = mix(mix(uAccent, uAccentSecondary, sweep), spectrum, 0.64);
        }

        float lightResponse = 0.13 + specular * 1.55 + grazing * 0.35 + sweep * 0.12;
        float alpha = clamp(mask * lightResponse * uIntensity, 0.0, 0.4);
        gl_FragColor = vec4(color * (0.75 + specular * 1.4), alpha);
      }
    `,
  });

  return {
    material,
    setCard(card) {
      uniforms.uMode.value = modeByTreatment[card.treatment];
      uniforms.uAccent.value.set(card.accent);
      uniforms.uAccentSecondary.value.set(card.accentSecondary);
    },
    setInspection(active) {
      uniforms.uIntensity.value = active ? 0.78 : 0.44;
    },
    setLightPosition(position) {
      uniforms.uLightPosition.value.copy(position);
    },
    update(elapsed) {
      uniforms.uTime.value = elapsed;
    },
  };
}
