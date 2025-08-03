import { AvatarPose, ASL_ALPHABET, GestureSequence, REST_POSITION } from './gestureLibrary'

export interface FingerspellingOptions {
  letterPauseDuration: number
  wordPauseDuration: number
  letterDuration: number
  emphasizeFirstLetter: boolean
  showLetterIndicator: boolean
}

export interface FingerspellingResult {
  word: string
  sequence: GestureSequence
  letterCount: number
  estimatedDuration: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export class FingerspellingService {
  private defaultOptions: FingerspellingOptions = {
    letterPauseDuration: 200,
    wordPauseDuration: 500,
    letterDuration: 800,
    emphasizeFirstLetter: true,
    showLetterIndicator: true
  }

  constructor(private options: Partial<FingerspellingOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options }
  }

  public fingerspellWord(word: string, customOptions?: Partial<FingerspellingOptions>): FingerspellingResult {
    const opts = { ...this.defaultOptions, ...this.options, ...customOptions }
    const cleanWord = this.sanitizeWord(word)
    const letters = cleanWord.split('')
    const poses: AvatarPose[] = []
    
    if (letters.length === 0) {
      return this.createEmptyResult(word)
    }

    // Add each letter with appropriate timing and emphasis
    letters.forEach((letter, index) => {
      const letterPose = ASL_ALPHABET[letter.toUpperCase()]
      
      if (letterPose) {
        // Emphasize first letter if option is enabled
        const duration = (opts.emphasizeFirstLetter && index === 0) 
          ? opts.letterDuration * 1.3 
          : opts.letterDuration

        poses.push({
          ...letterPose,
          name: `Letter ${letter.toUpperCase()}`,
          duration
        })

        // Add pause between letters (except after the last letter)
        if (index < letters.length - 1) {
          poses.push({
            ...REST_POSITION,
            name: 'Letter pause',
            duration: opts.letterPauseDuration
          })
        }
      } else {
        // Handle unknown characters (numbers, symbols, etc.)
        poses.push(this.createUnknownCharacterPose(letter, opts.letterDuration))
        
        if (index < letters.length - 1) {
          poses.push({
            ...REST_POSITION,
            name: 'Character pause',
            duration: opts.letterPauseDuration
          })
        }
      }
    })

    const totalDuration = poses.reduce((sum, pose) => sum + pose.duration, 0)
    const difficulty = this.calculateDifficulty(cleanWord)

    return {
      word: cleanWord,
      sequence: {
        word: cleanWord.toUpperCase(),
        poses,
        totalDuration
      },
      letterCount: cleanWord.length,
      estimatedDuration: totalDuration,
      difficulty
    }
  }

  public fingerspellSentence(sentence: string, customOptions?: Partial<FingerspellingOptions>): GestureSequence {
    const opts = { ...this.defaultOptions, ...this.options, ...customOptions }
    const words = this.tokenizeSentence(sentence)
    const allPoses: AvatarPose[] = []

    words.forEach((word, wordIndex) => {
      const wordResult = this.fingerspellWord(word, opts)
      allPoses.push(...wordResult.sequence.poses)

      // Add pause between words (except after the last word)
      if (wordIndex < words.length - 1) {
        allPoses.push({
          ...REST_POSITION,
          name: 'Word pause',
          duration: opts.wordPauseDuration
        })
      }
    })

    return {
      word: sentence.toUpperCase(),
      poses: allPoses,
      totalDuration: allPoses.reduce((sum, pose) => sum + pose.duration, 0)
    }
  }

  public createFingerspellingAlternatives(word: string): FingerspellingResult[] {
    const alternatives: FingerspellingResult[] = []
    
    // Standard fingerspelling
    alternatives.push(this.fingerspellWord(word))
    
    // Fast fingerspelling for experts
    alternatives.push(this.fingerspellWord(word, {
      letterDuration: 500,
      letterPauseDuration: 100,
      emphasizeFirstLetter: false
    }))
    
    // Slow fingerspelling for beginners
    alternatives.push(this.fingerspellWord(word, {
      letterDuration: 1200,
      letterPauseDuration: 400,
      emphasizeFirstLetter: true
    }))
    
    // Emphasized fingerspelling for clarity
    alternatives.push(this.fingerspellWord(word, {
      letterDuration: 1000,
      letterPauseDuration: 300,
      emphasizeFirstLetter: true
    }))

    return alternatives
  }

  public validateWord(word: string): {
    isValid: boolean
    unsupportedCharacters: string[]
    supportedLetters: string[]
    suggestions: string[]
  } {
    const cleanWord = this.sanitizeWord(word)
    const letters = cleanWord.split('')
    const unsupportedCharacters: string[] = []
    const supportedLetters: string[] = []
    const suggestions: string[] = []

    letters.forEach(letter => {
      const upperLetter = letter.toUpperCase()
      if (ASL_ALPHABET[upperLetter]) {
        supportedLetters.push(upperLetter)
      } else {
        unsupportedCharacters.push(letter)
      }
    })

    // Provide suggestions for improvements
    if (unsupportedCharacters.length > 0) {
      suggestions.push('Consider removing special characters and numbers')
      suggestions.push('Use only English letters A-Z for fingerspelling')
    }

    if (cleanWord.length > 10) {
      suggestions.push('Long words may be difficult to fingerspell - consider abbreviations')
    }

    return {
      isValid: unsupportedCharacters.length === 0,
      unsupportedCharacters,
      supportedLetters,
      suggestions
    }
  }

  public getOptimalFingerspellingSpeed(userLevel: 'beginner' | 'intermediate' | 'advanced'): FingerspellingOptions {
    const speedSettings = {
      beginner: {
        letterDuration: 1200,
        letterPauseDuration: 400,
        wordPauseDuration: 700,
        emphasizeFirstLetter: true,
        showLetterIndicator: true
      },
      intermediate: {
        letterDuration: 800,
        letterPauseDuration: 200,
        wordPauseDuration: 500,
        emphasizeFirstLetter: true,
        showLetterIndicator: false
      },
      advanced: {
        letterDuration: 500,
        letterPauseDuration: 100,
        wordPauseDuration: 300,
        emphasizeFirstLetter: false,
        showLetterIndicator: false
      }
    }

    return speedSettings[userLevel]
  }

  private sanitizeWord(word: string): string {
    // Remove special characters and normalize
    return word
      .replace(/[^a-zA-Z]/g, '') // Keep only letters
      .toUpperCase()
      .trim()
  }

  private tokenizeSentence(sentence: string): string[] {
    return sentence
      .split(/\s+/)
      .map(word => this.sanitizeWord(word))
      .filter(word => word.length > 0)
  }

  private createUnknownCharacterPose(character: string, duration: number): AvatarPose {
    // Create a generic "unknown" pose for unsupported characters
    return {
      name: `Unknown character: ${character}`,
      leftHand: {
        position: [-1.5, 1.5, 0],
        rotation: [0, 0, 0],
        fingers: {
          thumb: [0.8, 0],
          index: [0, 0],
          middle: [0, 0],
          ring: [0, 0],
          pinky: [0, 0]
        }
      },
      rightHand: {
        position: [1.5, 1.5, 0],
        rotation: [0, 0, 0.3], // Slight questioning gesture
        fingers: {
          thumb: [0.8, 0],
          index: [0, 0],
          middle: [0, 0],
          ring: [0, 0],
          pinky: [0, 0]
        }
      },
      duration
    }
  }

  private calculateDifficulty(word: string): 'easy' | 'medium' | 'hard' {
    const length = word.length
    
    // Check for difficult letter combinations
    const difficultCombinations = ['QX', 'ZQ', 'JK', 'VW']
    const hasDifficultCombination = difficultCombinations.some(combo => 
      word.includes(combo)
    )
    
    // Check for repetitive letters
    const hasRepetition = /(.).*\1/.test(word)
    
    if (length <= 3) return 'easy'
    if (length <= 6 && !hasDifficultCombination) return 'easy'
    if (length <= 8 && !hasDifficultCombination && !hasRepetition) return 'medium'
    return 'hard'
  }

  private createEmptyResult(word: string): FingerspellingResult {
    return {
      word,
      sequence: {
        word: word.toUpperCase(),
        poses: [],
        totalDuration: 0
      },
      letterCount: 0,
      estimatedDuration: 0,
      difficulty: 'easy'
    }
  }

  // Statistics and analysis methods
  public getLetterFrequency(text: string): Record<string, number> {
    const frequency: Record<string, number> = {}
    const cleanText = this.sanitizeWord(text)
    
    for (const letter of cleanText) {
      frequency[letter] = (frequency[letter] || 0) + 1
    }
    
    return frequency
  }

  public estimateFatigueLevel(text: string): {
    score: number // 0-100
    description: string
    recommendations: string[]
  } {
    const words = this.tokenizeSentence(text)
    const totalLetters = words.reduce((sum, word) => sum + word.length, 0)
    const avgWordLength = totalLetters / words.length
    
    let fatigueScore = 0
    const recommendations: string[] = []
    
    // Length-based fatigue
    if (totalLetters > 50) fatigueScore += 30
    if (totalLetters > 100) fatigueScore += 40
    
    // Word complexity fatigue
    if (avgWordLength > 6) fatigueScore += 20
    
    // Repetitive motion fatigue
    const letterFreq = this.getLetterFrequency(text)
    const maxFrequency = Math.max(...Object.values(letterFreq))
    if (maxFrequency > totalLetters * 0.2) fatigueScore += 10
    
    fatigueScore = Math.min(100, fatigueScore)
    
    let description = 'Low fatigue'
    if (fatigueScore > 30) description = 'Moderate fatigue'
    if (fatigueScore > 60) description = 'High fatigue'
    
    if (fatigueScore > 50) {
      recommendations.push('Consider breaking text into smaller segments')
      recommendations.push('Add rest periods between fingerspelling')
    }
    
    if (avgWordLength > 7) {
      recommendations.push('Look for shorter alternative words')
    }
    
    return {
      score: fatigueScore,
      description,
      recommendations
    }
  }
}