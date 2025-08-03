import { GestureSequence, AvatarPose, getGestureForWord, createFingerspellingSequence, REST_POSITION } from './gestureLibrary'

export interface ParsedText {
  words: string[]
  sequences: (GestureSequence | AvatarPose)[]
  totalDuration: number
  requiresFingerspelling: string[]
}

export class TextToSignParser {
  private commonWords: Set<string>
  
  constructor() {
    // Initialize with common ASL vocabulary
    this.commonWords = new Set([
      'HELLO', 'HI', 'BYE', 'GOODBYE', 'YES', 'NO', 'PLEASE', 'THANK', 'THANKS',
      'SORRY', 'HELP', 'LOVE', 'GOOD', 'BAD', 'DAY', 'NIGHT', 'WATER', 'FOOD',
      'HOME', 'WORK', 'FAMILY', 'FRIEND', 'TIME', 'MONEY', 'HAPPY', 'SAD'
    ])
  }

  public parseText(text: string): ParsedText {
    // Clean and tokenize the input text
    const words = this.tokenizeText(text)
    const sequences: (GestureSequence | AvatarPose)[] = []
    const requiresFingerspelling: string[] = []
    let totalDuration = 0

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const gesture = getGestureForWord(word)
      
      if (gesture) {
        // Word has a known sign
        sequences.push(gesture)
        
        if ('totalDuration' in gesture) {
          totalDuration += gesture.totalDuration
        } else {
          totalDuration += gesture.duration
        }
      } else {
        // Word needs to be fingerspelled
        requiresFingerspelling.push(word)
        const fingerspelledSequence = createFingerspellingSequence(word)
        sequences.push(fingerspelledSequence)
        totalDuration += fingerspelledSequence.totalDuration
      }

      // Add pause between words (except for the last word)
      if (i < words.length - 1) {
        const pauseDuration = 300
        sequences.push({
          ...REST_POSITION,
          name: 'Word pause',
          duration: pauseDuration
        })
        totalDuration += pauseDuration
      }
    }

    return {
      words,
      sequences,
      totalDuration,
      requiresFingerspelling
    }
  }

  private tokenizeText(text: string): string[] {
    // Remove punctuation and split into words
    const cleanText = text
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toUpperCase()

    if (!cleanText) return []

    return cleanText.split(' ').filter(word => word.length > 0)
  }

  public addToVocabulary(word: string, gesture: GestureSequence | AvatarPose): void {
    this.commonWords.add(word.toUpperCase())
    // In a real implementation, you would save this to a persistent store
  }

  public isInVocabulary(word: string): boolean {
    return this.commonWords.has(word.toUpperCase())
  }

  public getVocabularySize(): number {
    return this.commonWords.size
  }

  public getSupportedWords(): string[] {
    return Array.from(this.commonWords).sort()
  }

  // Method to estimate signing speed (words per minute)
  public estimateSigningTime(text: string, signingSpeedWPM: number = 120): number {
    const words = this.tokenizeText(text)
    // Average signing speed is typically 120-180 WPM for fluent signers
    const timeInMinutes = words.length / signingSpeedWPM
    return timeInMinutes * 60 * 1000 // Convert to milliseconds
  }

  // Method to check text complexity
  public analyzeTextComplexity(text: string): {
    totalWords: number
    knownSigns: number
    fingerspelledWords: number
    complexityScore: number // 0-1, where 1 is most complex
  } {
    const words = this.tokenizeText(text)
    let knownSigns = 0
    let fingerspelledWords = 0

    words.forEach(word => {
      if (getGestureForWord(word)) {
        knownSigns++
      } else {
        fingerspelledWords++
      }
    })

    const complexityScore = fingerspelledWords / words.length

    return {
      totalWords: words.length,
      knownSigns,
      fingerspelledWords,
      complexityScore
    }
  }

  // Method to suggest alternative phrasings for better signing
  public suggestAlternatives(text: string): string[] {
    const suggestions: string[] = []
    const words = this.tokenizeText(text)
    
    // Simple substitution suggestions
    const substitutions: Record<string, string> = {
      'OKAY': 'OK',
      'ALRIGHT': 'OK',
      'AUTOMOBILE': 'CAR',
      'RESIDENCE': 'HOME',
      'EMPLOYMENT': 'WORK',
      'BEVERAGE': 'DRINK',
      'MEAL': 'FOOD'
    }

    words.forEach(word => {
      if (substitutions[word] && this.isInVocabulary(substitutions[word])) {
        suggestions.push(`Consider using "${substitutions[word]}" instead of "${word}"`)
      }
    })

    return suggestions
  }
}