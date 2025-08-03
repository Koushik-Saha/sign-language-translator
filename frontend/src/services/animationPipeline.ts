import { AvatarPose, GestureSequence, HandPosition } from './gestureLibrary'

export interface AnimationState {
  currentPose: AvatarPose
  targetPose: AvatarPose
  progress: number // 0 to 1
  isAnimating: boolean
  startTime: number
  duration: number
}

export interface AnimationFrame {
  leftHand: HandPosition
  rightHand: HandPosition
  timestamp: number
}

export class AnimationPipeline {
  private animationState: AnimationState | null = null
  private animationQueue: (AvatarPose | GestureSequence)[] = []
  private currentSequenceIndex = 0
  private currentPoseIndex = 0
  public onFrameUpdate?: (frame: AnimationFrame) => void
  private animationId?: number

  constructor(onFrameUpdate?: (frame: AnimationFrame) => void) {
    this.onFrameUpdate = onFrameUpdate
  }

  public startAnimation(sequences: (AvatarPose | GestureSequence)[]): void {
    this.animationQueue = [...sequences]
    this.currentSequenceIndex = 0
    this.currentPoseIndex = 0
    
    if (this.animationQueue.length > 0) {
      this.startNextPose()
      this.animate()
    }
  }

  public stopAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = undefined
    }
    this.animationState = null
    this.animationQueue = []
    this.currentSequenceIndex = 0
    this.currentPoseIndex = 0
  }

  public pauseAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = undefined
    }
  }

  public resumeAnimation(): void {
    if (this.animationState && !this.animationId) {
      this.animate()
    }
  }

  public isAnimating(): boolean {
    return this.animationState?.isAnimating ?? false
  }

  public getCurrentProgress(): number {
    return this.animationState?.progress ?? 0
  }

  private startNextPose(): void {
    if (this.currentSequenceIndex >= this.animationQueue.length) {
      this.stopAnimation()
      return
    }

    const currentItem = this.animationQueue[this.currentSequenceIndex]
    let targetPose: AvatarPose

    if ('poses' in currentItem) {
      // It's a GestureSequence
      if (this.currentPoseIndex >= currentItem.poses.length) {
        // Move to next sequence
        this.currentSequenceIndex++
        this.currentPoseIndex = 0
        this.startNextPose()
        return
      }
      targetPose = currentItem.poses[this.currentPoseIndex]
    } else {
      // It's a single AvatarPose
      targetPose = currentItem
    }

    const currentPose = this.animationState?.targetPose ?? this.getRestPose()

    this.animationState = {
      currentPose,
      targetPose,
      progress: 0,
      isAnimating: true,
      startTime: performance.now(),
      duration: targetPose.duration
    }
  }

  private animate = (): void => {
    if (!this.animationState) return

    const now = performance.now()
    const elapsed = now - this.animationState.startTime
    const progress = Math.min(elapsed / this.animationState.duration, 1)

    this.animationState.progress = progress

    // Interpolate between current and target poses
    const interpolatedFrame = this.interpolatePoses(
      this.animationState.currentPose,
      this.animationState.targetPose,
      this.easeInOutCubic(progress)
    )

    // Update the frame
    if (this.onFrameUpdate) {
      this.onFrameUpdate({
        ...interpolatedFrame,
        timestamp: now
      })
    }

    if (progress >= 1) {
      // Animation complete, move to next pose
      this.animationState.currentPose = this.animationState.targetPose
      
      // Check if we need to move to next pose in sequence or next sequence
      const currentItem = this.animationQueue[this.currentSequenceIndex]
      if ('poses' in currentItem) {
        this.currentPoseIndex++
        if (this.currentPoseIndex >= currentItem.poses.length) {
          this.currentSequenceIndex++
          this.currentPoseIndex = 0
        }
      } else {
        this.currentSequenceIndex++
      }

      this.startNextPose()
    } else {
      this.animationId = requestAnimationFrame(this.animate)
    }
  }

  private interpolatePoses(fromPose: AvatarPose, toPose: AvatarPose, t: number): AnimationFrame {
    return {
      leftHand: this.interpolateHandPosition(fromPose.leftHand, toPose.leftHand, t),
      rightHand: this.interpolateHandPosition(fromPose.rightHand, toPose.rightHand, t),
      timestamp: performance.now()
    }
  }

  private interpolateHandPosition(from: HandPosition, to: HandPosition, t: number): HandPosition {
    return {
      position: [
        this.lerp(from.position[0], to.position[0], t),
        this.lerp(from.position[1], to.position[1], t),
        this.lerp(from.position[2], to.position[2], t)
      ],
      rotation: [
        this.lerpAngle(from.rotation[0], to.rotation[0], t),
        this.lerpAngle(from.rotation[1], to.rotation[1], t),
        this.lerpAngle(from.rotation[2], to.rotation[2], t)
      ],
      fingers: {
        thumb: [
          this.lerp(from.fingers.thumb[0] ?? 0, to.fingers.thumb[0] ?? 0, t),
          this.lerp(from.fingers.thumb[1] ?? 0, to.fingers.thumb[1] ?? 0, t)
        ],
        index: [
          this.lerp(from.fingers.index[0] ?? 0, to.fingers.index[0] ?? 0, t),
          this.lerp(from.fingers.index[1] ?? 0, to.fingers.index[1] ?? 0, t)
        ],
        middle: [
          this.lerp(from.fingers.middle[0] ?? 0, to.fingers.middle[0] ?? 0, t),
          this.lerp(from.fingers.middle[1] ?? 0, to.fingers.middle[1] ?? 0, t)
        ],
        ring: [
          this.lerp(from.fingers.ring[0] ?? 0, to.fingers.ring[0] ?? 0, t),
          this.lerp(from.fingers.ring[1] ?? 0, to.fingers.ring[1] ?? 0, t)
        ],
        pinky: [
          this.lerp(from.fingers.pinky[0] ?? 0, to.fingers.pinky[0] ?? 0, t),
          this.lerp(from.fingers.pinky[1] ?? 0, to.fingers.pinky[1] ?? 0, t)
        ]
      }
    }
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t
  }

  private lerpAngle(start: number, end: number, t: number): number {
    // Handle angle wrapping for smooth rotation
    let diff = end - start
    if (diff > Math.PI) diff -= 2 * Math.PI
    if (diff < -Math.PI) diff += 2 * Math.PI
    return start + diff * t
  }

  private easeInOutCubic(t: number): number {
    // Smooth easing function for natural movement
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  }

  private getRestPose(): AvatarPose {
    return {
      name: 'Rest',
      leftHand: {
        position: [-1.5, 0.5, 0],
        rotation: [0, 0, 0],
        fingers: {
          thumb: [0, 0],
          index: [0, 0],
          middle: [0, 0],
          ring: [0, 0],
          pinky: [0, 0]
        }
      },
      rightHand: {
        position: [1.5, 0.5, 0],
        rotation: [0, 0, 0],
        fingers: {
          thumb: [0, 0],
          index: [0, 0],
          middle: [0, 0],
          ring: [0, 0],
          pinky: [0, 0]
        }
      },
      duration: 500
    }
  }

  // Animation presets for different signing styles
  public setAnimationSpeed(speed: 'slow' | 'normal' | 'fast'): void {
    const speedMultipliers = {
      slow: 1.5,
      normal: 1.0,
      fast: 0.7
    }

    const multiplier = speedMultipliers[speed]
    
    // Adjust duration of all poses in queue
    this.animationQueue = this.animationQueue.map(item => {
      if ('poses' in item) {
        return {
          ...item,
          poses: item.poses.map(pose => ({
            ...pose,
            duration: pose.duration * multiplier
          })),
          totalDuration: item.totalDuration * multiplier
        }
      } else {
        return {
          ...item,
          duration: item.duration * multiplier
        }
      }
    })
  }

  public getAnimationProgress(): {
    currentSequence: number
    totalSequences: number
    currentPose: number
    totalPoses: number
    overallProgress: number
  } {
    const totalSequences = this.animationQueue.length
    let totalPoses = 0
    let completedPoses = 0

    this.animationQueue.forEach((item, index) => {
      const poses = 'poses' in item ? item.poses.length : 1
      totalPoses += poses

      if (index < this.currentSequenceIndex) {
        completedPoses += poses
      } else if (index === this.currentSequenceIndex) {
        completedPoses += this.currentPoseIndex
      }
    })

    return {
      currentSequence: this.currentSequenceIndex,
      totalSequences,
      currentPose: this.currentPoseIndex,
      totalPoses,
      overallProgress: totalPoses > 0 ? completedPoses / totalPoses : 0
    }
  }
}