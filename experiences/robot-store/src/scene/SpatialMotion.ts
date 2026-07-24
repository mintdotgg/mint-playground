import * as THREE from 'three'

export type SpatialPose = {
  x: number
  y: number
  z: number
  scale: number
  rotationY: number
}

type SpatialMotion = {
  object: THREE.Object3D
  from: SpatialPose
  to: SpatialPose
  elapsed: number
  delay: number
  duration: number
  easing: 'enter' | 'exit'
  onComplete?: () => void
}

function poseOf(object: THREE.Object3D): SpatialPose {
  return {
    x: object.position.x,
    y: object.position.y,
    z: object.position.z,
    scale: object.scale.x,
    rotationY: object.rotation.y,
  }
}

function easeEnter(value: number): number {
  const inverse = 1 - value
  return 1 - inverse * inverse * inverse
}

function easeExit(value: number): number {
  return value * value * value
}

export function applySpatialPose(object: THREE.Object3D, pose: SpatialPose): void {
  object.position.set(pose.x, pose.y, pose.z)
  object.scale.setScalar(pose.scale)
  object.rotation.y = pose.rotationY
}

export class SpatialMotionController {
  private readonly motions = new Map<THREE.Object3D, SpatialMotion>()

  move(
    object: THREE.Object3D,
    to: SpatialPose,
    options: {
      duration: number
      delay?: number
      easing: SpatialMotion['easing']
      onComplete?: () => void
    },
  ): void {
    this.motions.set(object, {
      object,
      from: poseOf(object),
      to,
      elapsed: 0,
      delay: options.delay ?? 0,
      duration: Math.max(options.duration, 0.001),
      easing: options.easing,
      onComplete: options.onComplete,
    })
  }

  cancel(object: THREE.Object3D): void {
    this.motions.delete(object)
  }

  update(delta: number): void {
    for (const motion of [...this.motions.values()]) {
      motion.elapsed += delta
      if (motion.elapsed < motion.delay) continue

      const rawProgress = THREE.MathUtils.clamp(
        (motion.elapsed - motion.delay) / motion.duration,
        0,
        1,
      )
      const progress = motion.easing === 'enter' ? easeEnter(rawProgress) : easeExit(rawProgress)
      const pose: SpatialPose = {
        x: THREE.MathUtils.lerp(motion.from.x, motion.to.x, progress),
        y: THREE.MathUtils.lerp(motion.from.y, motion.to.y, progress),
        z: THREE.MathUtils.lerp(motion.from.z, motion.to.z, progress),
        scale: THREE.MathUtils.lerp(motion.from.scale, motion.to.scale, progress),
        rotationY: THREE.MathUtils.lerp(motion.from.rotationY, motion.to.rotationY, progress),
      }
      applySpatialPose(motion.object, pose)

      if (rawProgress < 1) continue
      this.motions.delete(motion.object)
      motion.onComplete?.()
    }
  }

  clear(): void {
    this.motions.clear()
  }
}
