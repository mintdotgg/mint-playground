import * as THREE from 'three'
import { damp } from '../tween'
import type { Bands } from '../audio/engine'
import { fallbackArt } from './proctex'

export const DISC_THICKNESS = 0.085

export interface DiscStyle {
  /** angle-dependent rainbow diffraction amount */
  irid: number
  /** generated holo-foil texture blend (PRISM) */
  holo: number
  /** halftone print treatment (BOOTLEG) */
  ink: number
  /** desaturate art (behind smoked glass) */
  desat: number
  /** art visibility */
  artAmt: number
}

const FACE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FACE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  uniform sampler2D uArt;
  uniform sampler2D uHolo;
  uniform float uArtAmt;
  uniform float uHoloAmt;
  uniform float uIridAmt;
  uniform float uInkAmt;
  uniform float uDesat;
  uniform float uSpin;
  uniform float uSpeed;
  uniform float uPulse;
  uniform float uTime;
  uniform vec3 uPaper;
  uniform float uOpacity;

  const float PI = 3.14159265;

  vec3 rainbow(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.0, 0.33, 0.67)));
  }

  vec2 rot(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    vec3 V = normalize(cameraPosition - vWorldPos);
    // clamp: |dot| can exceed 1 by float error -> pow(neg, frac) = NaN,
    // and bloom's mip blur smears one NaN pixel into a black rectangle
    float fres = pow(clamp(1.0 - abs(dot(V, normalize(vNormal))), 0.0, 1.0), 1.6);

    // ------- angular motion blur on the art (the spinning smear) -------
    // Preserve the physical cue of rotation without smearing the album art
    // beyond recognition. The disc itself carries most of the motion now.
    float blur = clamp(uSpeed * 0.016, 0.0, 0.045);
    vec3 art = vec3(0.0);
    for (int i = -4; i <= 4; i++) {
      float a = (float(i) / 4.0) * blur;
      vec2 q = rot(p, a) * 0.5 + 0.5;
      art += texture2D(uArt, q).rgb;
    }
    art /= 9.0;
    float artLuma = dot(art, vec3(0.299, 0.587, 0.114));
    art = mix(art, vec3(artLuma), uDesat);

    // ------- halftone print treatment (bootleg CD face) -------
    if (uInkAmt > 0.001) {
      vec2 g = rot(p, 0.6) * 90.0;
      vec2 cell = fract(g) - 0.5;
      float dot_ = length(cell);
      float radius = (1.0 - artLuma) * 0.62;
      float ht = 1.0 - smoothstep(radius - 0.12, radius, dot_);
      vec3 print = mix(uPaper, vec3(0.05), ht);
      // keep some pure black shapes crisp
      print = mix(print, vec3(0.04), smoothstep(0.32, 0.1, artLuma));
      art = mix(art, print, uInkAmt);
    }

    // ------- zone composition -------
    vec3 col = vec3(0.0);
    float alpha = uOpacity;
    float aa = max(fwidth(r) * 1.5, 1e-4);

    // polycarbonate clear ring near hub
    float clearZone = 1.0 - smoothstep(0.205, 0.205 + aa, r);
    // mirror stacking band
    float mirror = smoothstep(0.20, 0.215, r) * (1.0 - smoothstep(0.335, 0.35, r));
    // printed / art zone
    float artZone = smoothstep(0.34, 0.355, r) * (1.0 - smoothstep(0.955, 0.97, r));
    // outer clear edge
    float edge = smoothstep(0.955, 0.97, r);

    // clear inner: dark tinted see-through
    col += clearZone * vec3(0.10, 0.105, 0.115) * (0.8 + fres);
    alpha = mix(alpha, uOpacity * 0.5, clearZone);

    // mirror band: brushed silver + strong rainbow
    float bandGrad = sin((r - 0.2) / 0.135 * PI);
    vec3 silver = mix(vec3(0.42), vec3(0.85), bandGrad * 0.5 + 0.5);
    col += mirror * silver * (0.55 + fres * 0.8);

    // art zone
    vec3 zone = mix(vec3(0.16, 0.165, 0.18), art, uArtAmt);
    // fine data grooves
    float grooves = sin(r * 720.0 + ang * 2.0) * 0.5 + 0.5;
    zone *= 1.0 + grooves * 0.045 * (1.0 - uInkAmt);
    col += artZone * zone;

    // outer edge: translucent rim
    col += edge * vec3(0.30, 0.32, 0.35) * (0.5 + fres);
    alpha = mix(alpha, uOpacity * 0.55, edge);

    // ------- generated holo foil layer -------
    if (uHoloAmt > 0.001) {
      vec2 hq = rot(p, -uSpin * 0.25) * 0.5 + 0.5;
      vec3 holo = texture2D(uHolo, hq).rgb;
      col = mix(col, col * 0.35 + holo * 1.05, uHoloAmt * (artZone + mirror));
    }

    // ------- CD diffraction rainbow -------
    float streaks = pow(0.5 + 0.5 * sin(ang * 2.0 + uSpin * 0.6 + r * 3.0), 2.0);
    float ir = uIridAmt * (mirror * 1.2 + artZone * 0.55 + edge * 0.4);
    vec3 rb = rainbow(ang * 0.477 + r * 1.35 - uSpin * 0.12 + fres * 0.6);
    col += rb * ir * streaks * (0.22 + 0.85 * fres);

    // ------- anisotropic specular sweeps (fixed to light, not disc) -------
    float sweepA = pow(max(0.0, cos(ang - 1.05 - sin(uTime * 0.23) * 0.25)), 30.0);
    float sweepB = pow(max(0.0, cos(ang - 1.05 + PI - sin(uTime * 0.23) * 0.25)), 30.0);
    float sweep = (sweepA + sweepB) * (0.10 + clamp(uSpeed * 0.02, 0.0, 0.16));
    col += vec3(1.0) * sweep * (mirror + artZone * 0.8);

    // beat pulse lifts the whole face a touch
    col *= 1.0 + uPulse * 0.10;

    gl_FragColor = vec4(col, alpha);
  }
`

function buildFallbackHub(): THREE.Object3D {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2e34, metalness: 0.85, roughness: 0.4 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.6, roughness: 0.55 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.25, 0.075, 64), metal)
  base.rotation.x = Math.PI / 2
  base.position.z = 0.038
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.024, 14, 64), dark)
  ring.position.z = 0.078
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.105, 0.055, 48), dark)
  boss.rotation.x = Math.PI / 2
  boss.position.z = 0.078
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.052, 0.024), dark)
  slot.position.z = 0.11
  slot.rotation.z = -0.72
  g.add(base, ring, boss, slot)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.026, 8), dark)
    bolt.rotation.x = Math.PI / 2
    bolt.position.set(Math.cos(a) * 0.218, Math.sin(a) * 0.218, 0.078)
    g.add(bolt)
  }
  return g
}

/**
 * The compact disc — shared across every skin. One spinner (disc itself)
 * plus a stationary hub clamp on top.
 */
export class DiscRig {
  group = new THREE.Group()
  readonly portalHitTarget: THREE.Mesh
  private spinner = new THREE.Group()
  private hubMount = new THREE.Group()
  private portalGroup = new THREE.Group()
  private portalRingMat: THREE.MeshStandardMaterial
  private portalFaceMat: THREE.MeshBasicMaterial
  private portalLabelCtx: CanvasRenderingContext2D
  private portalLabelTexture: THREE.CanvasTexture
  private portalAccent = new THREE.Color(0xff4d1f)
  private faceMat: THREE.ShaderMaterial
  private angle = 0
  private speed = 0
  private danceMode = false
  private surfaceScale = 1
  private artCache = new Map<string, THREE.Texture>()

  constructor(holoTex: THREE.Texture | null) {
    const hole = 0.125
    const thick = DISC_THICKNESS

    this.faceMat = new THREE.ShaderMaterial({
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uArt: { value: fallbackArt(0x7fd8ff) },
        uHolo: { value: holoTex ?? new THREE.Texture() },
        uArtAmt: { value: 1 },
        uHoloAmt: { value: 0 },
        uIridAmt: { value: 0.5 },
        uInkAmt: { value: 0 },
        uDesat: { value: 0 },
        uSpin: { value: 0 },
        uSpeed: { value: 0 },
        uPulse: { value: 0 },
        uTime: { value: 0 },
        uPaper: { value: new THREE.Color(0xe9e6dd) },
        uOpacity: { value: 1 },
      },
    })

    const face = new THREE.Mesh(new THREE.RingGeometry(hole, 1, 160, 1), this.faceMat)
    face.position.z = thick / 2
    face.renderOrder = 5

    const back = new THREE.Mesh(
      new THREE.RingGeometry(hole, 1, 96, 1),
      new THREE.MeshStandardMaterial({ color: 0x484c55, metalness: 0.9, roughness: 0.35 }),
    )
    back.rotation.y = Math.PI
    back.position.z = -thick / 2

    const rimGeo = new THREE.CylinderGeometry(1, 1, thick, 128, 1, true)
    rimGeo.rotateX(Math.PI / 2)
    const rim = new THREE.Mesh(
      rimGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x8b919a,
        transparent: true,
        opacity: 0.76,
        transmission: 0.18,
        thickness: thick,
        metalness: 0.42,
        roughness: 0.2,
        clearcoat: 1,
        side: THREE.DoubleSide,
      }),
    )
    const holeGeo = new THREE.CylinderGeometry(hole, hole, thick, 48, 1, true)
    holeGeo.rotateX(Math.PI / 2)
    const holeRim = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x30333a, side: THREE.DoubleSide }))

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(0.982, 0.018, 12, 160),
      new THREE.MeshStandardMaterial({ color: 0xb7c1cc, metalness: 0.85, roughness: 0.18 }),
    )
    edge.position.z = thick * 0.44
    const clearHubRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.012, 10, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xd8e3eb,
        transparent: true,
        opacity: 0.72,
        transmission: 0.3,
        roughness: 0.16,
        depthWrite: false,
      }),
    )
    clearHubRing.position.z = thick * 0.55

    this.spinner.add(face, back, rim, holeRim, edge, clearHubRing)
    this.hubMount.add(buildFallbackHub())
    this.hubMount.position.z = thick / 2

    const portalCanvas = document.createElement('canvas')
    portalCanvas.width = 512
    portalCanvas.height = 512
    this.portalLabelCtx = portalCanvas.getContext('2d')!
    this.portalLabelTexture = new THREE.CanvasTexture(portalCanvas)
    this.portalLabelTexture.colorSpace = THREE.SRGBColorSpace
    this.portalLabelTexture.anisotropy = 4

    const portalBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.045, 64),
      new THREE.MeshStandardMaterial({
        color: 0x080a0e,
        metalness: 0.72,
        roughness: 0.3,
      }),
    )
    portalBody.geometry.rotateX(Math.PI / 2)
    portalBody.position.z = 0.176

    this.portalRingMat = new THREE.MeshStandardMaterial({
      color: this.portalAccent,
      emissive: this.portalAccent,
      emissiveIntensity: 0.42,
      metalness: 0.55,
      roughness: 0.2,
    })
    const portalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.139, 0.009, 10, 64),
      this.portalRingMat,
    )
    portalRing.position.z = 0.203

    this.portalFaceMat = new THREE.MeshBasicMaterial({
      map: this.portalLabelTexture,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: true,
      side: THREE.FrontSide,
      toneMapped: false,
    })
    this.portalHitTarget = new THREE.Mesh(
      new THREE.CircleGeometry(0.132, 64),
      this.portalFaceMat,
    )
    this.portalHitTarget.name = 'portal-enter-3d'
    this.portalHitTarget.position.z = 0.207
    this.portalHitTarget.renderOrder = 22
    this.portalHitTarget.userData.cursor = 'pointer'

    this.portalGroup.name = 'portal-button-3d'
    this.portalGroup.visible = false
    this.portalGroup.add(portalBody, portalRing, this.portalHitTarget)
    this.redrawPortalLabel()
    this.group.add(this.spinner, this.hubMount, this.portalGroup)
  }

  /** Replace the procedural hub when an authored model is supplied. */
  setHub(model: THREE.Object3D | null) {
    if (!model) return
    this.hubMount.clear()
    this.hubMount.add(model)
  }

  setStyle(s: DiscStyle) {
    const u = this.faceMat.uniforms
    u.uIridAmt.value = s.irid
    u.uHoloAmt.value = s.holo
    u.uInkAmt.value = s.ink
    u.uDesat.value = s.desat
    u.uArtAmt.value = s.artAmt
  }

  setArt(url: string | null, accent: number) {
    const u = this.faceMat.uniforms
    if (!url) {
      u.uArt.value = fallbackArt(accent)
      return
    }
    const cached = this.artCache.get(url)
    if (cached) {
      u.uArt.value = cached
      return
    }
    const fallback = fallbackArt(accent)
    u.uArt.value = fallback
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        this.artCache.set(url, tex)
        // only apply if we're still on the same request
        if (u.uArt.value === fallback) u.uArt.value = tex
      },
      undefined,
      () => {
        /* keep fallback */
      },
    )
  }

  setPlaying(_playing: boolean) {
    // speed handled in update via target
  }

  setDanceMode(active: boolean) {
    this.danceMode = active
  }

  setPortalVisible(visible: boolean) {
    this.portalGroup.visible = visible
    if (!visible) this.setPortalHovered(false)
  }

  setPortalHovered(hovered: boolean) {
    this.portalGroup.scale.setScalar(hovered ? 1.07 : 1)
    this.portalRingMat.emissiveIntensity = hovered ? 0.95 : 0.42
  }

  setPortalAccent(accent: number) {
    this.portalAccent.setHex(accent)
    this.portalRingMat.color.copy(this.portalAccent)
    this.portalRingMat.emissive.copy(this.portalAccent)
    this.redrawPortalLabel()
  }

  private redrawPortalLabel() {
    const ctx = this.portalLabelCtx
    const accent = `#${this.portalAccent.getHexString()}`
    ctx.clearRect(0, 0, 512, 512)
    ctx.beginPath()
    ctx.arc(256, 256, 246, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(5, 7, 11, 0.96)'
    ctx.fill()
    ctx.lineWidth = 10
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(245, 247, 250, 0.94)'
    ctx.font = '700 70px Helvetica Neue, Arial, sans-serif'
    ctx.fillText('ENTER', 256, 226)
    ctx.fillStyle = accent
    ctx.font = '700 42px Helvetica Neue, Arial, sans-serif'
    ctx.fillText('FLOOR', 256, 304)
    this.portalLabelTexture.needsUpdate = true
  }

  update(dt: number, bands: Bands, playing: boolean, time: number) {
    // About one revolution every 7.7 seconds: clearly spinning, but slow
    // enough for the artwork and printed treatment to remain identifiable.
    // In floor mode the printed surface drifts very slowly beneath the dancers
    // instead of rotating them off their visual footing.
    const target = playing ? (this.danceMode ? 0.12 : 0.82) : 0
    this.speed = damp(this.speed, target, playing ? 2.2 : 1.1, dt)
    this.surfaceScale = damp(this.surfaceScale, this.danceMode ? 1.62 : 1, 3.4, dt)
    this.spinner.scale.setScalar(this.surfaceScale)
    this.angle += this.speed * dt
    this.spinner.rotation.z = -this.angle
    // subtle physical wobble while spinning
    const wob = Math.min(1, this.speed / 0.82) * 0.0035
    this.spinner.rotation.x = Math.sin(this.angle * 0.9) * wob
    this.spinner.rotation.y = Math.cos(this.angle * 1.1) * wob

    const u = this.faceMat.uniforms
    u.uSpin.value = this.angle
    u.uSpeed.value = this.speed
    u.uPulse.value = bands.pulse
    u.uTime.value = time
    const hubPulse = 1 + bands.pulse * 0.05
    this.hubMount.scale.setScalar(hubPulse)
  }
}
