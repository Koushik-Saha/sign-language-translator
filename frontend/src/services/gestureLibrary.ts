export interface HandPosition {
  position: [number, number, number]
  rotation: [number, number, number]
  fingers: {
    thumb: number[]
    index: number[]
    middle: number[]
    ring: number[]
    pinky: number[]
  }
}

export interface AvatarPose {
  leftHand: HandPosition
  rightHand: HandPosition
  duration: number
  name: string
}

export interface GestureSequence {
  poses: AvatarPose[]
  totalDuration: number
  word: string
}

// ASL Alphabet gestures
export const ASL_ALPHABET: Record<string, AvatarPose> = {
  A: {
    name: 'Letter A',
    leftHand: {
      position: [-1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [0.5, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
    },
    rightHand: {
      position: [1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [0.5, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
    },
    duration: 1000
  },
  
  B: {
    name: 'Letter B',
    leftHand: {
      position: [-1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [1.2, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
    },
    rightHand: {
      position: [1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [1.2, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
    },
    duration: 1000
  },

  C: {
    name: 'Letter C',
    leftHand: {
      position: [-1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [0.8, 0], index: [0.8, 0], middle: [0.8, 0], ring: [0.8, 0], pinky: [0.8, 0] }
    },
    rightHand: {
      position: [1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [0.8, 0], index: [0.8, 0], middle: [0.8, 0], ring: [0.8, 0], pinky: [0.8, 0] }
    },
    duration: 1000
  },

  D: {
    name: 'Letter D',
    leftHand: {
      position: [-1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [1.0, 0], index: [0, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
    },
    rightHand: {
      position: [1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [1.0, 0], index: [0, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
    },
    duration: 1000
  },

  E: {
    name: 'Letter E',
    leftHand: {
      position: [-1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [1.2, 0], index: [1.2, 0], middle: [1.2, 0], ring: [1.2, 0], pinky: [1.2, 0] }
    },
    rightHand: {
      position: [1.5, 1, 0],
      rotation: [0, 0, 0],
      fingers: { thumb: [1.2, 0], index: [1.2, 0], middle: [1.2, 0], ring: [1.2, 0], pinky: [1.2, 0] }
    },
    duration: 1000
  }
}

// Common ASL words
export const COMMON_SIGNS: Record<string, GestureSequence> = {
  HELLO: {
    word: 'HELLO',
    totalDuration: 2000,
    poses: [
      {
        name: 'Hello start',
        leftHand: {
          position: [-1.5, 2, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        rightHand: {
          position: [1.5, 2, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        duration: 500
      },
      {
        name: 'Hello wave',
        leftHand: {
          position: [-1.5, 2.5, 0],
          rotation: [0, 0, -0.3],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        rightHand: {
          position: [1.5, 2.5, 0],
          rotation: [0, 0, 0.3],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        duration: 1000
      },
      {
        name: 'Hello end',
        leftHand: {
          position: [-1.5, 2, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        rightHand: {
          position: [1.5, 2, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        duration: 500
      }
    ]
  },

  THANK: {
    word: 'THANK',
    totalDuration: 1500,
    poses: [
      {
        name: 'Thank you start',
        leftHand: {
          position: [-1.5, 2.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        rightHand: {
          position: [1.5, 2.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        duration: 300
      },
      {
        name: 'Thank you motion',
        leftHand: {
          position: [-1.5, 1.5, 1],
          rotation: [-0.5, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        rightHand: {
          position: [1.5, 1.5, 1],
          rotation: [-0.5, 0, 0],
          fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
        },
        duration: 1200
      }
    ]
  },

  YES: {
    word: 'YES',
    totalDuration: 1200,
    poses: [
      {
        name: 'Yes fist',
        leftHand: {
          position: [-1.5, 1.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0.8, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        rightHand: {
          position: [1.5, 1.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0.8, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        duration: 400
      },
      {
        name: 'Yes nod down',
        leftHand: {
          position: [-1.5, 1.2, 0],
          rotation: [0.3, 0, 0],
          fingers: { thumb: [0.8, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        rightHand: {
          position: [1.5, 1.2, 0],
          rotation: [0.3, 0, 0],
          fingers: { thumb: [0.8, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        duration: 400
      },
      {
        name: 'Yes nod up',
        leftHand: {
          position: [-1.5, 1.5, 0],
          rotation: [-0.2, 0, 0],
          fingers: { thumb: [0.8, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        rightHand: {
          position: [1.5, 1.5, 0],
          rotation: [-0.2, 0, 0],
          fingers: { thumb: [0.8, 0], index: [1.5, 0], middle: [1.5, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        duration: 400
      }
    ]
  },

  NO: {
    word: 'NO',
    totalDuration: 1000,
    poses: [
      {
        name: 'No fingers together',
        leftHand: {
          position: [-1.5, 1.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0.5, 0], index: [0, 0], middle: [0, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        rightHand: {
          position: [1.5, 1.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0.5, 0], index: [0, 0], middle: [0, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        duration: 300
      },
      {
        name: 'No fingers apart',
        leftHand: {
          position: [-1.5, 1.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0.8, 0], index: [0, 0], middle: [0, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        rightHand: {
          position: [1.5, 1.5, 0],
          rotation: [0, 0, 0],
          fingers: { thumb: [0.8, 0], index: [0, 0], middle: [0, 0], ring: [1.5, 0], pinky: [1.5, 0] }
        },
        duration: 700
      }
    ]
  }
}

// Default rest position
export const REST_POSITION: AvatarPose = {
  name: 'Rest',
  leftHand: {
    position: [-1.5, 0.5, 0],
    rotation: [0, 0, 0],
    fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
  },
  rightHand: {
    position: [1.5, 0.5, 0],
    rotation: [0, 0, 0],
    fingers: { thumb: [0, 0], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0] }
  },
  duration: 500
}

export function getGestureForWord(word: string): GestureSequence | AvatarPose | null {
  const upperWord = word.toUpperCase()
  
  // Check common signs first
  if (COMMON_SIGNS[upperWord]) {
    return COMMON_SIGNS[upperWord]
  }
  
  // Check single letters
  if (upperWord.length === 1 && ASL_ALPHABET[upperWord]) {
    return ASL_ALPHABET[upperWord]
  }
  
  return null
}

export function createFingerspellingSequence(word: string): GestureSequence {
  const letters = word.toUpperCase().split('')
  const poses: AvatarPose[] = []
  
  letters.forEach((letter, index) => {
    if (ASL_ALPHABET[letter]) {
      poses.push({
        ...ASL_ALPHABET[letter],
        name: `Letter ${letter}`,
        duration: 800
      })
      
      // Add brief pause between letters
      if (index < letters.length - 1) {
        poses.push({
          ...REST_POSITION,
          name: 'Letter pause',
          duration: 200
        })
      }
    }
  })
  
  return {
    word: word.toUpperCase(),
    poses,
    totalDuration: poses.reduce((sum, pose) => sum + pose.duration, 0)
  }
}