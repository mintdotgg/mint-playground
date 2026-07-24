import * as THREE from 'three'
import type { RobotTheme } from '../theme'

type ColorUniform = { value: THREE.Color }

type StudioProfilePoint = {
  radius: number
  height: number
}

function colorUniform(color: THREE.ColorRepresentation): ColorUniform {
  return { value: new THREE.Color(color) }
}

function createCycloramaGeometry(): THREE.BufferGeometry {
  const radialSegments = 128
  const floorRadius = 11
  const curveRadius = 7
  const wallRadius = floorRadius + curveRadius
  const wallHeight = 32
  const profile: StudioProfilePoint[] = []

  for (let index = 1; index <= 24; index += 1) {
    profile.push({ radius: floorRadius * (index / 24), height: 0 })
  }

  for (let index = 1; index <= 24; index += 1) {
    const angle = (index / 24) * (Math.PI / 2)
    profile.push({
      radius: floorRadius + Math.sin(angle) * curveRadius,
      height: curveRadius * (1 - Math.cos(angle)),
    })
  }

  for (let index = 1; index <= 24; index += 1) {
    profile.push({
      radius: wallRadius,
      height: curveRadius + (wallHeight - curveRadius) * (index / 24),
    })
  }

  const vertices: number[] = [0, 0, 0]
  const indices: number[] = []
  const ringSize = radialSegments + 1

  profile.forEach((point) => {
    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2
      vertices.push(
        Math.cos(angle) * point.radius,
        point.height,
        Math.sin(angle) * point.radius,
      )
    }
  })

  for (let segment = 0; segment < radialSegments; segment += 1) {
    indices.push(0, 1 + segment + 1, 1 + segment)
  }

  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    const current = 1 + ring * ringSize
    const next = current + ringSize
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const inner = current + segment
      const innerNext = inner + 1
      const outer = next + segment
      const outerNext = outer + 1
      indices.push(inner, outerNext, outer, inner, innerNext, outerNext)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export class StudioEnvironment {
  private readonly fog: THREE.Fog

  private readonly floorUniforms = {
    uFloorNear: colorUniform('#c8c8c0'),
    uFloorGlow: colorUniform('#e2e0d8'),
    uHorizon: colorUniform('#a8aaa4'),
    uZenith: colorUniform('#747873'),
    uAccent: colorUniform('#ff4f12'),
    uGridInk: colorUniform('#151616'),
  }

  constructor(scene: THREE.Scene) {
    scene.background = null

    this.fog = new THREE.Fog(this.floorUniforms.uHorizon.value, 10, 42)
    scene.fog = this.fog

    scene.add(this.createCyclorama(), this.createShadowCatcher())
  }

  updateTheme(theme: RobotTheme): THREE.Color {
    const paper = new THREE.Color(theme.paper)
    const paperShadow = new THREE.Color(theme.paperShadow)
    const warmWhite = new THREE.Color('#f4f0e8')
    const pureWhite = new THREE.Color('#ffffff')

    // A high-contrast photographic sweep: the floor stays bright while the
    // wall falls off quickly just above the subject's feet.
    const zenith = paperShadow.clone().multiplyScalar(0.11)
    const horizon = paper.clone().lerp(warmWhite, 0.28)
    const floorNear = paper.clone().lerp(warmWhite, 0.14)
    const floorGlow = floorNear.clone().lerp(pureWhite, 0.16)

    this.floorUniforms.uFloorNear.value.copy(floorNear)
    this.floorUniforms.uFloorGlow.value.copy(floorGlow)
    this.floorUniforms.uHorizon.value.copy(horizon)
    this.floorUniforms.uZenith.value.copy(zenith)
    this.floorUniforms.uAccent.value.set(theme.accent)
    this.floorUniforms.uGridInk.value.set(theme.ink)
    this.fog.color.copy(horizon)

    return horizon
  }

  private createCyclorama(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
      fog: false,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFloorNear = this.floorUniforms.uFloorNear
      shader.uniforms.uFloorGlow = this.floorUniforms.uFloorGlow
      shader.uniforms.uHorizon = this.floorUniforms.uHorizon
      shader.uniforms.uZenith = this.floorUniforms.uZenith
      shader.uniforms.uAccent = this.floorUniforms.uAccent
      shader.uniforms.uGridInk = this.floorUniforms.uGridInk
      shader.vertexShader = `varying vec3 vStudioSurface;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vStudioSurface = position;',
      )
      shader.fragmentShader = `
        varying vec3 vStudioSurface;
        uniform vec3 uFloorNear;
        uniform vec3 uFloorGlow;
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uAccent;
        uniform vec3 uGridInk;
      ${shader.fragmentShader}`.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float studioDistance = length(vStudioSurface.xz);
        float horizonBlend = smoothstep(5.0, 32.0, studioDistance);
        vec3 studioBase = mix(uFloorNear, uHorizon, horizonBlend);

        float lightPool = 1.0 - smoothstep(0.4, 5.2, studioDistance);
        studioBase = mix(studioBase, uFloorGlow, lightPool * 0.34);

        float wallAmount = smoothstep(11.0, 18.0, studioDistance);
        // Drive the sweep while it is still curving away from the floor. That
        // places the photographic knee at the old horizon height in the front
        // camera instead of waiting for the high cylindrical wall.
        float curveRise = smoothstep(11.05, 14.2, studioDistance);
        float upperWallRise = smoothstep(7.0, 9.4, max(vStudioSurface.y, 0.0));
        float wallHeight = pow(max(curveRise, upperWallRise), 0.68);
        vec3 wallColor = mix(uHorizon, uZenith, wallHeight);
        studioBase = mix(studioBase, wallColor, wallAmount);

        vec2 surfaceDirection = normalize(vStudioSurface.xz);
        float frontalWall = pow(max(dot(surfaceDirection, vec2(0.0, -1.0)), 0.0), 5.0);
        float frontalMask = frontalWall * wallAmount;

        vec2 softboxCoordinate = vec2(
          vStudioSurface.x / 9.0,
          (vStudioSurface.y - 7.35) / 2.15
        );
        float softboxPool = exp(-dot(softboxCoordinate, softboxCoordinate) * 1.35) * frontalMask;
        studioBase = mix(studioBase, uFloorGlow, softboxPool * 0.26);

        float sweepLight = exp(-pow((studioDistance - 11.2) / 1.25, 2.0)) * frontalMask;
        studioBase = mix(studioBase, uFloorGlow, sweepLight * 0.22);

        float lateralFalloff = smoothstep(0.24, 0.92, abs(vStudioSurface.x) / 18.0) * frontalMask;
        studioBase = mix(studioBase, uZenith, lateralFalloff * 0.2);

        vec2 accentCoordinate = vec2(
          (vStudioSurface.x + 6.0) / 7.5,
          (vStudioSurface.y - 8.0) / 3.6
        );
        float accentSpill = exp(-dot(accentCoordinate, accentCoordinate)) * frontalMask;
        studioBase = mix(studioBase, uAccent, accentSpill * 0.04);

        vec2 gridCoordinate = vStudioSurface.xz / 0.5;
        vec2 gridWidth = max(fwidth(gridCoordinate), vec2(0.0001));
        vec2 gridDistance = abs(fract(gridCoordinate - 0.5) - 0.5) / gridWidth;
        float gridLine = 1.0 - min(min(gridDistance.x, gridDistance.y), 1.0);
        float gridEnvelope = smoothstep(1.35, 2.5, studioDistance)
          * (1.0 - smoothstep(6.5, 10.5, studioDistance));
        studioBase = mix(studioBase, uGridInk, gridLine * gridEnvelope * 0.035);

        diffuseColor.rgb = studioBase;`,
      )
    }
    material.customProgramCacheKey = () => 'robot-store-studio-cyclorama-v4'

    const cyclorama = new THREE.Mesh(createCycloramaGeometry(), material)
    cyclorama.name = 'seamless-studio-cyclorama'
    cyclorama.position.y = -0.018
    return cyclorama
  }

  private createShadowCatcher(): THREE.Mesh<THREE.CircleGeometry, THREE.ShadowMaterial> {
    const material = new THREE.ShadowMaterial({
      color: '#111111',
      opacity: 0.18,
      transparent: true,
      depthWrite: false,
    })
    const catcher = new THREE.Mesh(new THREE.CircleGeometry(9.6, 96), material)
    catcher.name = 'studio-shadow-catcher'
    catcher.rotation.x = -Math.PI / 2
    catcher.position.y = -0.011
    catcher.receiveShadow = true
    return catcher
  }
}
