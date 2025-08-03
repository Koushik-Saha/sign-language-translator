'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import { AvatarPose, HandPosition, GestureSequence } from '../services/gestureLibrary'
import { AnimationPipeline, AnimationFrame } from '../services/animationPipeline'

interface SignAvatarProps {
  sequences?: (AvatarPose | GestureSequence)[]
  isAnimating: boolean
  animationSpeed?: 'slow' | 'normal' | 'fast'
  onAnimationComplete?: () => void
  showControls?: boolean
  currentWord?: string
}

function Hand({ position, rotation }: HandPosition & { isLeft?: boolean }) {
  const handRef = useRef<THREE.Group>(null)
  
  useFrame(() => {
    if (handRef.current) {
      handRef.current.position.set(...position)
      handRef.current.rotation.set(...rotation)
    }
  })

  return (
    <group ref={handRef}>
      {/* Palm */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.3]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      
      {/* Thumb */}
      <group position={[-0.4, 0.3, 0]} rotation={[0, 0, -0.5]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.18, 0.4, 0.18]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
      </group>
      
      {/* Index Finger */}
      <group position={[-0.3, 0.6, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.15, 0.8, 0.15]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.13, 0.4, 0.13]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
      </group>
      
      {/* Middle Finger */}
      <group position={[0, 0.6, 0]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.15, 1.0, 0.15]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.13, 0.4, 0.13]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
      </group>
      
      {/* Ring Finger */}
      <group position={[0.3, 0.6, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.15, 0.8, 0.15]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.13, 0.4, 0.13]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
      </group>
      
      {/* Pinky */}
      <group position={[0.5, 0.6, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.12, 0.6, 0.12]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.1, 0.3, 0.1]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
      </group>
    </group>
  )
}

function Avatar({ 
  sequences, 
  isAnimating, 
  animationSpeed = 'normal',
  onAnimationComplete,
  currentWord 
}: SignAvatarProps) {
  const avatarRef = useRef<THREE.Group>(null)
  const [currentFrame, setCurrentFrame] = useState<AnimationFrame | null>(null)
  const [animationPipeline] = useState(() => new AnimationPipeline())
  
  const defaultPose: AvatarPose = {
    name: 'Rest',
    leftHand: {
      position: [-2, 0, 0],
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
      position: [2, 0, 0],
      rotation: [0, 0, 0],
      fingers: {
        thumb: [0, 0],
        index: [0, 0],
        middle: [0, 0],
        ring: [0, 0],
        pinky: [0, 0]
      }
    },
    duration: 1000
  }

  // Set up animation pipeline callback
  useEffect(() => {
    const handleFrameUpdate = (frame: AnimationFrame) => {
      setCurrentFrame(frame)
    }

    animationPipeline.onFrameUpdate = handleFrameUpdate
    
    return () => {
      animationPipeline.stopAnimation()
    }
  }, [animationPipeline])

  // Handle animation start/stop
  useEffect(() => {
    if (isAnimating && sequences && sequences.length > 0) {
      animationPipeline.setAnimationSpeed(animationSpeed)
      animationPipeline.startAnimation(sequences)
    } else {
      animationPipeline.stopAnimation()
      if (onAnimationComplete) {
        onAnimationComplete()
      }
    }
  }, [isAnimating, sequences, animationSpeed, animationPipeline, onAnimationComplete])

  const leftHandPose = currentFrame?.leftHand || defaultPose.leftHand
  const rightHandPose = currentFrame?.rightHand || defaultPose.rightHand

  return (
    <group ref={avatarRef}>
      {/* Head */}
      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      
      {/* Body */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1.5, 2, 0.8]} />
        <meshStandardMaterial color="#4a90e2" />
      </mesh>
      
      {/* Arms */}
      <mesh position={[-1.2, 1.5, 0]}>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      <mesh position={[1.2, 1.5, 0]}>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      
      {/* Hands */}
      <Hand {...leftHandPose} isLeft={true} />
      <Hand {...rightHandPose} isLeft={false} />
      
      {/* Current word display */}
      {currentWord && (
        <Text
          position={[0, 4.5, 0]}
          fontSize={0.5}
          color="black"
          anchorX="center"
          anchorY="middle"
        >
          {currentWord}
        </Text>
      )}
    </group>
  )
}

export default function SignAvatar({ 
  sequences, 
  isAnimating, 
  animationSpeed = 'normal',
  onAnimationComplete,
  showControls = true,
  currentWord 
}: SignAvatarProps) {
  return (
    <div className="w-full h-96 bg-gray-100 rounded-lg">
      <Canvas camera={{ position: [0, 2, 8], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <Avatar 
          sequences={sequences}
          isAnimating={isAnimating}
          animationSpeed={animationSpeed}
          onAnimationComplete={onAnimationComplete}
          currentWord={currentWord}
        />
        {showControls && (
          <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
        )}
      </Canvas>
    </div>
  )
}