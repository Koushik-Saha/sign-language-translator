const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

class GestureLibraryService {
  constructor() {
    this.libraries = {
      ASL: null,  // American Sign Language
      BSL: null,  // British Sign Language
      LSF: null,  // Langue des Signes Française (French Sign Language)
      ISL: null,  // International Sign Language
      AUSLAN: null  // Australian Sign Language
    };
    
    this.gestureData = new Map();
    this.loadGestureLibraries();
  }

  async loadGestureLibraries() {
    try {
      // Load BSL (British Sign Language) library
      this.libraries.BSL = await this.loadBSLLibrary();
      
      // Load LSF (Langue des Signes Française) library
      this.libraries.LSF = await this.loadLSFLibrary();
      
      // Load additional sign language libraries
      this.libraries.ASL = await this.loadASLLibrary();
      this.libraries.ISL = await this.loadISLLibrary();
      this.libraries.AUSLAN = await this.loadAUSLANLibrary();

      logger.info('Gesture libraries loaded successfully', {
        loadedLibraries: Object.keys(this.libraries).filter(key => this.libraries[key])
      });
    } catch (error) {
      logger.error('Error loading gesture libraries:', error);
    }
  }

  async loadBSLLibrary() {
    try {
      const bslLibrary = {
        name: 'British Sign Language',
        code: 'BSL',
        region: 'United Kingdom',
        alphabet: this.getBSLAlphabet(),
        numbers: this.getBSLNumbers(),
        commonWords: this.getBSLCommonWords(),
        phrases: this.getBSLPhrases(),
        grammar: this.getBSLGrammar(),
        handshapes: this.getBSLHandshapes(),
        movements: this.getBSLMovements(),
        expressions: this.getBSLExpressions()
      };

      this.gestureData.set('BSL', bslLibrary);
      return bslLibrary;
    } catch (error) {
      logger.error('Error loading BSL library:', error);
      return null;
    }
  }

  async loadLSFLibrary() {
    try {
      const lsfLibrary = {
        name: 'Langue des Signes Française',
        code: 'LSF',
        region: 'France',
        alphabet: this.getLSFAlphabet(),
        numbers: this.getLSFNumbers(),
        commonWords: this.getLSFCommonWords(),
        phrases: this.getLSFPhrases(),
        grammar: this.getLSFGrammar(),
        handshapes: this.getLSFHandshapes(),
        movements: this.getLSFMovements(),
        expressions: this.getLSFExpressions()
      };

      this.gestureData.set('LSF', lsfLibrary);
      return lsfLibrary;
    } catch (error) {
      logger.error('Error loading LSF library:', error);
      return null;
    }
  }

  async loadASLLibrary() {
    try {
      const aslLibrary = {
        name: 'American Sign Language',
        code: 'ASL',
        region: 'United States',
        alphabet: this.getASLAlphabet(),
        numbers: this.getASLNumbers(),
        commonWords: this.getASLCommonWords(),
        phrases: this.getASLPhrases(),
        grammar: this.getASLGrammar(),
        handshapes: this.getASLHandshapes(),
        movements: this.getASLMovements(),
        expressions: this.getASLExpressions()
      };

      this.gestureData.set('ASL', aslLibrary);
      return aslLibrary;
    } catch (error) {
      logger.error('Error loading ASL library:', error);
      return null;
    }
  }

  async loadISLLibrary() {
    try {
      const islLibrary = {
        name: 'International Sign',
        code: 'ISL',
        region: 'International',
        alphabet: this.getISLAlphabet(),
        numbers: this.getISLNumbers(),
        commonWords: this.getISLCommonWords(),
        phrases: this.getISLPhrases(),
        grammar: this.getISLGrammar(),
        handshapes: this.getISLHandshapes(),
        movements: this.getISLMovements(),
        expressions: this.getISLExpressions()
      };

      this.gestureData.set('ISL', islLibrary);
      return islLibrary;
    } catch (error) {
      logger.error('Error loading ISL library:', error);
      return null;
    }
  }

  async loadAUSLANLibrary() {
    try {
      const auslanLibrary = {
        name: 'Australian Sign Language',
        code: 'AUSLAN',
        region: 'Australia',
        alphabet: this.getAUSLANAlphabet(),
        numbers: this.getAUSLANNumbers(),
        commonWords: this.getAUSLANCommonWords(),
        phrases: this.getAUSLANPhrases(),
        grammar: this.getAUSLANGrammar(),
        handshapes: this.getAUSLANHandshapes(),
        movements: this.getAUSLANMovements(),
        expressions: this.getAUSLANExpressions()
      };

      this.gestureData.set('AUSLAN', auslanLibrary);
      return auslanLibrary;
    } catch (error) {
      logger.error('Error loading AUSLAN library:', error);
      return null;
    }
  }

  // BSL (British Sign Language) specific data
  getBSLAlphabet() {
    return {
      'A': {
        handshape: 'closed_fist_thumb_up',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Closed fist with thumb pointing upward, palm facing forward'
      },
      'B': {
        handshape: 'flat_hand_thumb_folded',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Flat hand with fingers extended, thumb folded across palm'
      },
      'C': {
        handshape: 'c_shape',
        orientation: 'palm_left',
        location: 'neutral_space',
        movement: 'static',
        description: 'Hand curved in C shape, palm facing left'
      },
      'D': {
        handshape: 'index_extended_others_closed',
        orientation: 'palm_left',
        location: 'neutral_space',
        movement: 'static',
        description: 'Index finger extended upward, other fingers closed, palm facing left'
      },
      'E': {
        handshape: 'flat_hand',
        orientation: 'palm_down',
        location: 'neutral_space',
        movement: 'static',
        description: 'Flat hand with all fingers extended, palm facing down'
      },
      'F': {
        handshape: 'three_fingers_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Index, middle, and ring fingers extended, thumb and pinky folded'
      },
      'G': {
        handshape: 'index_extended_others_closed',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Index finger pointing forward, other fingers closed'
      },
      'H': {
        handshape: 'two_fingers_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Index and middle fingers extended, others closed'
      },
      'I': {
        handshape: 'pinky_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Pinky finger extended upward, other fingers closed'
      },
      'J': {
        handshape: 'pinky_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'trace_j',
        description: 'Pinky extended, trace letter J in the air'
      },
      // Continue for remaining letters...
    };
  }

  getBSLNumbers() {
    return {
      '0': {
        handshape: 'flat_hand',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static'
      },
      '1': {
        handshape: 'index_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static'
      },
      '2': {
        handshape: 'two_fingers_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static'
      },
      '3': {
        handshape: 'three_fingers_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static'
      },
      '4': {
        handshape: 'four_fingers_extended',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static'
      },
      '5': {
        handshape: 'open_hand',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static'
      },
      // Continue for remaining numbers...
    };
  }

  getBSLCommonWords() {
    return {
      'HELLO': {
        handshape: 'open_hand',
        orientation: 'palm_forward',
        location: 'forehead',
        movement: 'forward_wave',
        description: 'Open hand near forehead, wave forward',
        category: 'greetings'
      },
      'GOODBYE': {
        handshape: 'open_hand',
        orientation: 'palm_down',
        location: 'neutral_space',
        movement: 'wave_down',
        description: 'Open hand waving downward',
        category: 'greetings'
      },
      'PLEASE': {
        handshape: 'flat_hand',
        orientation: 'palm_down',
        location: 'chest',
        movement: 'circular',
        description: 'Flat hand on chest making circular motion',
        category: 'politeness'
      },
      'THANK_YOU': {
        handshape: 'flat_hand',
        orientation: 'palm_up',
        location: 'chin',
        movement: 'forward',
        description: 'Flat hand starts at chin, moves forward',
        category: 'politeness'
      },
      'SORRY': {
        handshape: 'closed_fist',
        orientation: 'palm_down',
        location: 'chest',
        movement: 'circular',
        description: 'Closed fist on chest making circular motion',
        category: 'politeness'
      },
      'YES': {
        handshape: 'closed_fist',
        orientation: 'knuckles_forward',
        location: 'neutral_space',
        movement: 'nod_down_up',
        description: 'Closed fist nodding down and up',
        category: 'responses'
      },
      'NO': {
        handshape: 'two_fingers_extended',
        orientation: 'palm_down',
        location: 'neutral_space',
        movement: 'side_to_side',
        description: 'Two fingers extended, shake side to side',
        category: 'responses'
      },
      'WATER': {
        handshape: 'w_handshape',
        orientation: 'palm_left',
        location: 'mouth',
        movement: 'tap',
        description: 'W handshape tapping near mouth',
        category: 'needs'
      },
      'FOOD': {
        handshape: 'flat_o',
        orientation: 'palm_up',
        location: 'mouth',
        movement: 'to_mouth',
        description: 'Flat O shape moving toward mouth',
        category: 'needs'
      },
      'HELP': {
        handshape: 'open_hand',
        orientation: 'palm_up',
        location: 'chest',
        movement: 'lifting',
        description: 'Open hand palm up, lifting motion from chest',
        category: 'needs'
      },
      'FRIEND': {
        handshape: 'index_extended',
        orientation: 'palm_down',
        location: 'neutral_space',
        movement: 'interlocking',
        description: 'Two index fingers interlocking',
        category: 'relationships',
        both_hands: true
      },
      'FAMILY': {
        handshape: 'f_handshape',
        orientation: 'palm_out',
        location: 'neutral_space',
        movement: 'circular',
        description: 'F handshapes making circular motion',
        category: 'relationships',
        both_hands: true
      },
      'LOVE': {
        handshape: 'closed_fist',
        orientation: 'knuckles_out',
        location: 'heart',
        movement: 'cross_over_heart',
        description: 'Both fists crossing over heart',
        category: 'emotions',
        both_hands: true
      },
      'HAPPY': {
        handshape: 'open_hand',
        orientation: 'palm_back',
        location: 'chest',
        movement: 'upward_circular',
        description: 'Open hands making upward circular motion on chest',
        category: 'emotions',
        both_hands: true
      },
      'SAD': {
        handshape: 'open_hand',
        orientation: 'palm_back',
        location: 'face',
        movement: 'downward',
        description: 'Open hands moving downward from face',
        category: 'emotions',
        both_hands: true
      },
      'HOME': {
        handshape: 'flat_o',
        orientation: 'fingertips_together',
        location: 'cheek_to_cheek',
        movement: 'arc',
        description: 'Fingertips together, arc from cheek to cheek',
        category: 'places'
      },
      'WORK': {
        handshape: 'closed_fist',
        orientation: 'knuckles_down',
        location: 'neutral_space',
        movement: 'hammering',
        description: 'Both fists making hammering motion',
        category: 'activities',
        both_hands: true
      }
    };
  }

  getBSLPhrases() {
    return {
      'HOW_ARE_YOU': {
        sequence: ['HOW', 'YOU'],
        description: 'Combination of HOW and YOU signs',
        category: 'greetings'
      },
      'NICE_TO_MEET_YOU': {
        sequence: ['NICE', 'MEET', 'YOU'],
        description: 'Combination of NICE, MEET, and YOU signs',
        category: 'greetings'
      },
      'I_LOVE_YOU': {
        sequence: ['I', 'LOVE', 'YOU'],
        description: 'Combination of I, LOVE, and YOU signs',
        category: 'emotions'
      },
      'GOOD_MORNING': {
        sequence: ['GOOD', 'MORNING'],
        description: 'Combination of GOOD and MORNING signs',
        category: 'greetings'
      },
      'GOOD_NIGHT': {
        sequence: ['GOOD', 'NIGHT'],
        description: 'Combination of GOOD and NIGHT signs',
        category: 'greetings'
      }
    };
  }

  getBSLGrammar() {
    return {
      word_order: 'SVO', // Subject-Verb-Object (flexible)
      tense_markers: {
        past: 'backward_shoulder',
        future: 'forward_space',
        present: 'neutral_space'
      },
      question_markers: {
        yes_no: 'raised_eyebrows',
        wh_question: 'lowered_eyebrows'
      },
      negation: {
        head_shake: true,
        sign_NOT: true
      },
      plural_markers: {
        repetition: true,
        number_incorporation: true
      }
    };
  }

  getBSLHandshapes() {
    return {
      '1': 'index_extended',
      '5': 'open_hand',
      'A': 'closed_fist_thumb_side',
      'B': 'flat_hand',
      'C': 'curved_hand',
      'D': 'index_up_thumb_side',
      'F': 'three_fingers_extended',
      'G': 'index_extended_horizontal',
      'H': 'two_fingers_extended',
      'I': 'pinky_extended',
      'L': 'l_shape',
      'O': 'flat_o',
      'U': 'two_fingers_up',
      'V': 'peace_sign',
      'W': 'three_fingers_up',
      'Y': 'thumb_pinky_extended'
    };
  }

  getBSLMovements() {
    return {
      'static': 'No movement',
      'linear': 'Straight line movement',
      'circular': 'Circular movement',
      'arc': 'Arc-shaped movement',
      'zigzag': 'Back and forth movement',
      'tap': 'Quick contact movement',
      'brush': 'Light contact movement',
      'wave': 'Waving movement',
      'nod': 'Up and down movement',
      'shake': 'Side to side movement',
      'twist': 'Rotation movement',
      'wiggle': 'Small rapid movements'
    };
  }

  getBSLExpressions() {
    return {
      'neutral': 'Relaxed facial expression',
      'question': 'Raised eyebrows, slightly forward head',
      'wh_question': 'Lowered eyebrows, concentrated look',
      'negation': 'Head shake, sometimes pursed lips',
      'affirmation': 'Slight nod',
      'intensity': 'Raised eyebrows, wide eyes',
      'doubt': 'Slightly squinted eyes, head tilt',
      'surprise': 'Wide eyes, raised eyebrows, open mouth',
      'focus': 'Direct gaze, concentrated expression'
    };
  }

  // LSF (Langue des Signes Française) specific data
  getLSFAlphabet() {
    return {
      'A': {
        handshape: 'closed_fist',
        orientation: 'palm_left',
        location: 'neutral_space',
        movement: 'static',
        description: 'Closed fist, palm facing left'
      },
      'B': {
        handshape: 'flat_hand',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'static',
        description: 'Flat hand, palm facing forward'
      },
      // Continue with LSF-specific alphabet...
    };
  }

  getLSFNumbers() {
    return {
      '1': {
        handshape: 'index_extended',
        orientation: 'palm_back',
        location: 'neutral_space',
        movement: 'static'
      },
      '2': {
        handshape: 'two_fingers_extended',
        orientation: 'palm_back',
        location: 'neutral_space',
        movement: 'static'
      },
      // Continue with LSF-specific numbers...
    };
  }

  getLSFCommonWords() {
    return {
      'BONJOUR': {
        handshape: 'flat_hand',
        orientation: 'palm_down',
        location: 'forehead',
        movement: 'salute',
        description: 'Flat hand salute motion from forehead',
        category: 'greetings',
        french_word: 'Bonjour'
      },
      'AU_REVOIR': {
        handshape: 'open_hand',
        orientation: 'palm_forward',
        location: 'neutral_space',
        movement: 'wave',
        description: 'Open hand waving forward',
        category: 'greetings',
        french_word: 'Au revoir'
      },
      'S_IL_VOUS_PLAIT': {
        handshape: 'flat_hand',
        orientation: 'palm_up',
        location: 'chest',
        movement: 'forward',
        description: 'Flat hand moving forward from chest',
        category: 'politeness',
        french_word: 'S\'il vous plaît'
      },
      'MERCI': {
        handshape: 'flat_hand',
        orientation: 'palm_up',
        location: 'lips',
        movement: 'kiss_forward',
        description: 'Hand kiss motion forward',
        category: 'politeness',
        french_word: 'Merci'
      },
      // Continue with more LSF words...
    };
  }

  getLSFPhrases() {
    return {
      'COMMENT_ALLEZ_VOUS': {
        sequence: ['COMMENT', 'VOUS'],
        description: 'How are you in LSF',
        category: 'greetings',
        french_phrase: 'Comment allez-vous?'
      },
      // Continue with LSF phrases...
    };
  }

  getLSFGrammar() {
    return {
      word_order: 'SOV', // Subject-Object-Verb (more common in LSF)
      tense_markers: {
        past: 'backward_space',
        future: 'forward_space',
        present: 'neutral_space'
      },
      question_markers: {
        yes_no: 'raised_eyebrows_forward_lean',
        wh_question: 'furrowed_brow'
      },
      negation: {
        head_shake: true,
        sign_NOT: true,
        facial_expression: 'negative_expression'
      }
    };
  }

  // ASL, ISL, and AUSLAN methods would follow similar patterns...
  getASLAlphabet() { return {}; } // Implement ASL alphabet
  getASLNumbers() { return {}; }
  getASLCommonWords() { return {}; }
  getASLPhrases() { return {}; }
  getASLGrammar() { return {}; }
  getASLHandshapes() { return {}; }
  getASLMovements() { return {}; }
  getASLExpressions() { return {}; }

  getISLAlphabet() { return {}; } // Implement ISL alphabet
  getISLNumbers() { return {}; }
  getISLCommonWords() { return {}; }
  getISLPhrases() { return {}; }
  getISLGrammar() { return {}; }
  getISLHandshapes() { return {}; }
  getISLMovements() { return {}; }
  getISLExpressions() { return {}; }

  getAUSLANAlphabet() { return {}; } // Implement AUSLAN alphabet
  getAUSLANNumbers() { return {}; }
  getAUSLANCommonWords() { return {}; }
  getAUSLANPhrases() { return {}; }
  getAUSLANGrammar() { return {}; }
  getAUSLANHandshapes() { return {}; }
  getAUSLANMovements() { return {}; }
  getAUSLANExpressions() { return {}; }

  // Public API methods
  
  /**
   * Get available sign language libraries
   */
  getAvailableLibraries() {
    return Object.keys(this.libraries).filter(key => this.libraries[key] !== null);
  }

  /**
   * Get specific gesture library
   */
  getLibrary(code) {
    return this.gestureData.get(code.toUpperCase());
  }

  /**
   * Search for a gesture across libraries
   */
  searchGesture(word, libraries = ['ASL', 'BSL', 'LSF']) {
    const results = [];
    const upperWord = word.toUpperCase();

    for (const libCode of libraries) {
      const library = this.gestureData.get(libCode);
      if (!library) continue;

      // Search in common words
      if (library.commonWords && library.commonWords[upperWord]) {
        results.push({
          library: libCode,
          word: upperWord,
          gesture: library.commonWords[upperWord],
          type: 'word'
        });
      }

      // Search in alphabet
      if (library.alphabet && library.alphabet[upperWord]) {
        results.push({
          library: libCode,
          word: upperWord,
          gesture: library.alphabet[upperWord],
          type: 'letter'
        });
      }

      // Search in numbers
      if (library.numbers && library.numbers[upperWord]) {
        results.push({
          library: libCode,
          word: upperWord,
          gesture: library.numbers[upperWord],
          type: 'number'
        });
      }

      // Search in phrases
      if (library.phrases) {
        for (const [phrase, data] of Object.entries(library.phrases)) {
          if (phrase.includes(upperWord) || data.sequence.includes(upperWord)) {
            results.push({
              library: libCode,
              word: upperWord,
              gesture: data,
              type: 'phrase',
              fullPhrase: phrase
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Translate text to sign language sequence
   */
  translateToSignSequence(text, targetLibrary = 'BSL') {
    const library = this.gestureData.get(targetLibrary);
    if (!library) {
      throw new Error(`Library ${targetLibrary} not available`);
    }

    const words = text.toUpperCase().split(/\s+/).filter(w => w.length > 0);
    const sequence = [];

    for (const word of words) {
      // Check for exact word match
      if (library.commonWords && library.commonWords[word]) {
        sequence.push({
          word,
          gesture: library.commonWords[word],
          method: 'sign',
          library: targetLibrary
        });
      } else if (library.phrases && library.phrases[word]) {
        // Check for phrase match
        sequence.push({
          word,
          gesture: library.phrases[word],
          method: 'phrase',
          library: targetLibrary
        });
      } else {
        // Fall back to fingerspelling
        const letters = word.split('');
        for (const letter of letters) {
          if (library.alphabet && library.alphabet[letter]) {
            sequence.push({
              word: letter,
              gesture: library.alphabet[letter],
              method: 'fingerspelling',
              library: targetLibrary,
              partOf: word
            });
          }
        }
      }
    }

    return {
      originalText: text,
      targetLibrary,
      sequence,
      metadata: {
        totalSigns: sequence.length,
        fingerspelledWords: sequence.filter(s => s.method === 'fingerspelling').length,
        directSigns: sequence.filter(s => s.method === 'sign').length,
        phrases: sequence.filter(s => s.method === 'phrase').length
      }
    };
  }

  /**
   * Get gesture categories for a library
   */
  getGestureCategories(libraryCode) {
    const library = this.gestureData.get(libraryCode);
    if (!library || !library.commonWords) return [];

    const categories = new Set();
    Object.values(library.commonWords).forEach(gesture => {
      if (gesture.category) {
        categories.add(gesture.category);
      }
    });

    return Array.from(categories).sort();
  }

  /**
   * Get gestures by category
   */
  getGesturesByCategory(libraryCode, category) {
    const library = this.gestureData.get(libraryCode);
    if (!library || !library.commonWords) return [];

    return Object.entries(library.commonWords)
      .filter(([word, gesture]) => gesture.category === category)
      .map(([word, gesture]) => ({
        word,
        ...gesture
      }));
  }

  /**
   * Compare gestures across libraries
   */
  compareGesturesAcrossLibraries(word) {
    const upperWord = word.toUpperCase();
    const comparison = {};

    for (const [libCode, library] of this.gestureData.entries()) {
      if (library.commonWords && library.commonWords[upperWord]) {
        comparison[libCode] = library.commonWords[upperWord];
      }
    }

    return comparison;
  }

  /**
   * Get gesture complexity score
   */
  getGestureComplexity(gesture) {
    let complexity = 0;

    // Base complexity
    complexity += 1;

    // Movement complexity
    if (gesture.movement && gesture.movement !== 'static') {
      complexity += 1;
    }

    // Two-handed signs are more complex
    if (gesture.both_hands) {
      complexity += 1;
    }

    // Location complexity
    if (gesture.location && gesture.location !== 'neutral_space') {
      complexity += 0.5;
    }

    // Orientation changes add complexity
    if (gesture.orientation && gesture.orientation.includes('change')) {
      complexity += 0.5;
    }

    return Math.round(complexity * 10) / 10;
  }

  /**
   * Generate learning sequence for a set of words
   */
  generateLearningSequence(words, targetLibrary = 'BSL') {
    const library = this.gestureData.get(targetLibrary);
    if (!library) {
      throw new Error(`Library ${targetLibrary} not available`);
    }

    const sequence = words.map(word => {
      const upperWord = word.toUpperCase();
      let gesture = null;

      if (library.commonWords && library.commonWords[upperWord]) {
        gesture = library.commonWords[upperWord];
      } else if (library.alphabet && library.alphabet[upperWord]) {
        gesture = library.alphabet[upperWord];
      }

      return {
        word: upperWord,
        gesture,
        complexity: gesture ? this.getGestureComplexity(gesture) : null,
        hasGesture: !!gesture
      };
    });

    // Sort by complexity (easier first)
    sequence.sort((a, b) => {
      if (!a.hasGesture) return 1;
      if (!b.hasGesture) return -1;
      return a.complexity - b.complexity;
    });

    return {
      targetLibrary,
      totalWords: words.length,
      availableGestures: sequence.filter(s => s.hasGesture).length,
      sequence
    };
  }
}

module.exports = new GestureLibraryService();