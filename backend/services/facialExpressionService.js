const logger = require('./logger');

class FacialExpressionService {
  constructor() {
    // Emotion categories with facial expression parameters
    this.emotions = {
      // Basic emotions
      'HAPPY': {
        name: 'Happy',
        category: 'positive',
        intensity: {
          low: { eyebrows: 0.2, eyes: 0.8, mouth: 0.7, cheeks: 0.6 },
          medium: { eyebrows: 0.4, eyes: 0.9, mouth: 0.85, cheeks: 0.8 },
          high: { eyebrows: 0.6, eyes: 1.0, mouth: 1.0, cheeks: 1.0 }
        },
        features: {
          eyebrows: { position: 'slightly_raised', animation: 'subtle_lift' },
          eyes: { shape: 'crescent', sparkle: true, squint: 0.3 },
          mouth: { shape: 'smile', corners: 'up', teeth: 'visible' },
          cheeks: { lift: 'raised', dimples: true },
          forehead: { wrinkles: 'minimal' }
        },
        duration: { min: 1000, max: 3000 },
        transitions: ['NEUTRAL', 'EXCITED', 'CONTENT', 'FRIENDLY']
      },

      'SAD': {
        name: 'Sad',
        category: 'negative',
        intensity: {
          low: { eyebrows: 0.3, eyes: 0.4, mouth: 0.2, overall: 0.3 },
          medium: { eyebrows: 0.6, eyes: 0.6, mouth: 0.4, overall: 0.5 },
          high: { eyebrows: 0.9, eyes: 0.8, mouth: 0.7, overall: 0.8 }
        },
        features: {
          eyebrows: { position: 'inner_raised', shape: 'angled_up' },
          eyes: { shape: 'droopy', moisture: true, gaze: 'downward' },
          mouth: { shape: 'frown', corners: 'down', lower_lip: 'protruding' },
          cheeks: { position: 'neutral', flush: false },
          forehead: { wrinkles: 'horizontal_lines' }
        },
        duration: { min: 2000, max: 5000 },
        transitions: ['NEUTRAL', 'WORRIED', 'DISAPPOINTED', 'MELANCHOLY']
      },

      'ANGRY': {
        name: 'Angry',
        category: 'negative',
        intensity: {
          low: { eyebrows: 0.4, eyes: 0.3, mouth: 0.2, tension: 0.3 },
          medium: { eyebrows: 0.7, eyes: 0.6, mouth: 0.5, tension: 0.6 },
          high: { eyebrows: 1.0, eyes: 0.9, mouth: 0.8, tension: 1.0 }
        },
        features: {
          eyebrows: { position: 'lowered', angle: 'inward', furrow: true },
          eyes: { shape: 'narrowed', intensity: 'piercing', squint: 0.7 },
          mouth: { shape: 'tight', corners: 'down', lips: 'pressed' },
          cheeks: { flush: true, tension: 'high' },
          forehead: { wrinkles: 'vertical_lines', tension: true },
          jaw: { clench: true, position: 'forward' }
        },
        duration: { min: 1500, max: 4000 },
        transitions: ['NEUTRAL', 'FRUSTRATED', 'STERN', 'ANNOYED']
      },

      'SURPRISED': {
        name: 'Surprised',
        category: 'reactive',
        intensity: {
          low: { eyebrows: 0.5, eyes: 0.6, mouth: 0.3, overall: 0.4 },
          medium: { eyebrows: 0.8, eyes: 0.9, mouth: 0.6, overall: 0.7 },
          high: { eyebrows: 1.0, eyes: 1.0, mouth: 0.9, overall: 1.0 }
        },
        features: {
          eyebrows: { position: 'raised_high', shape: 'arched' },
          eyes: { shape: 'wide_open', pupils: 'dilated', blink: 'reduced' },
          mouth: { shape: 'open', jaw: 'dropped', lips: 'parted' },
          cheeks: { position: 'neutral' },
          forehead: { wrinkles: 'raised_horizontal' }
        },
        duration: { min: 500, max: 2000 },
        transitions: ['NEUTRAL', 'HAPPY', 'CONFUSED', 'SHOCKED']
      },

      'FEARFUL': {
        name: 'Fearful',
        category: 'negative',
        intensity: {
          low: { eyebrows: 0.3, eyes: 0.4, mouth: 0.2, tension: 0.3 },
          medium: { eyebrows: 0.6, eyes: 0.7, mouth: 0.4, tension: 0.6 },
          high: { eyebrows: 0.9, eyes: 1.0, mouth: 0.7, tension: 1.0 }
        },
        features: {
          eyebrows: { position: 'raised_inner', shape: 'curved_up' },
          eyes: { shape: 'wide', white_visible: 'top_bottom', darting: true },
          mouth: { shape: 'slightly_open', tension: 'high', corners: 'neutral' },
          cheeks: { flush: false, tension: 'medium' },
          forehead: { wrinkles: 'horizontal', tension: true }
        },
        duration: { min: 1000, max: 3000 },
        transitions: ['NEUTRAL', 'WORRIED', 'ANXIOUS', 'STARTLED']
      },

      'DISGUSTED': {
        name: 'Disgusted',
        category: 'negative',
        intensity: {
          low: { nose: 0.3, mouth: 0.4, eyebrows: 0.2, overall: 0.3 },
          medium: { nose: 0.6, mouth: 0.7, eyebrows: 0.4, overall: 0.6 },
          high: { nose: 0.9, mouth: 1.0, eyebrows: 0.6, overall: 0.9 }
        },
        features: {
          eyebrows: { position: 'lowered', inner: 'down' },
          eyes: { shape: 'narrowed', squint: 0.5 },
          nose: { wrinkle: 'prominent', flare: true },
          mouth: { shape: 'turned_down', upper_lip: 'raised', asymmetric: true },
          cheeks: { raised: 'upper', squint_lines: true }
        },
        duration: { min: 1000, max: 2500 },
        transitions: ['NEUTRAL', 'ANNOYED', 'REPULSED', 'CONTEMPTUOUS']
      },

      // Additional nuanced emotions
      'NEUTRAL': {
        name: 'Neutral',
        category: 'baseline',
        intensity: {
          low: { overall: 0.0 },
          medium: { overall: 0.0 },
          high: { overall: 0.0 }
        },
        features: {
          eyebrows: { position: 'natural', relaxed: true },
          eyes: { shape: 'natural', gaze: 'forward' },
          mouth: { shape: 'relaxed', neutral: true },
          cheeks: { position: 'natural' },
          forehead: { smooth: true }
        },
        duration: { min: 500, max: 2000 },
        transitions: ['HAPPY', 'SAD', 'SURPRISED', 'THINKING', 'ATTENTIVE']
      },

      'THINKING': {
        name: 'Thinking',
        category: 'cognitive',
        intensity: {
          low: { eyebrows: 0.2, eyes: 0.3, mouth: 0.1 },
          medium: { eyebrows: 0.4, eyes: 0.5, mouth: 0.2 },
          high: { eyebrows: 0.6, eyes: 0.7, mouth: 0.3 }
        },
        features: {
          eyebrows: { position: 'slightly_furrowed', asymmetric: true },
          eyes: { shape: 'focused', gaze: 'upward_right', squint: 0.2 },
          mouth: { shape: 'pursed', corner: 'slightly_up', asymmetric: true },
          forehead: { wrinkles: 'light_horizontal' },
          head: { tilt: 'slight_right' }
        },
        duration: { min: 2000, max: 5000 },
        transitions: ['NEUTRAL', 'CONFUSED', 'UNDERSTANDING', 'FOCUSED']
      },

      'CONFUSED': {
        name: 'Confused',
        category: 'cognitive',
        intensity: {
          low: { eyebrows: 0.3, eyes: 0.2, mouth: 0.2 },
          medium: { eyebrows: 0.6, eyes: 0.4, mouth: 0.4 },
          high: { eyebrows: 0.9, eyes: 0.6, mouth: 0.6 }
        },
        features: {
          eyebrows: { position: 'asymmetric', one_raised: 'right', furrow: true },
          eyes: { shape: 'squinted', gaze: 'questioning', blink: 'frequent' },
          mouth: { shape: 'pursed', corners: 'down', slight_open: true },
          head: { tilt: 'questioning', slight_back: true }
        },
        duration: { min: 1500, max: 4000 },
        transitions: ['NEUTRAL', 'THINKING', 'UNDERSTANDING', 'FRUSTRATED']
      }
    };

    // Context-based emotion mapping for sign language
    this.contextEmotions = {
      'greetings': ['HAPPY', 'FRIENDLY', 'NEUTRAL'],
      'questions': ['CURIOUS', 'THINKING', 'ATTENTIVE'],
      'commands': ['NEUTRAL', 'FIRM', 'DIRECT'],
      'expressions': ['HAPPY', 'SAD', 'SURPRISED', 'EXCITED'],
      'negations': ['FIRM', 'CLEAR', 'EMPHATIC'],
      'emergency': ['URGENT', 'CONCERNED', 'ALERT'],
      'learning': ['ATTENTIVE', 'FOCUSED', 'ENCOURAGING'],
      'social': ['FRIENDLY', 'HAPPY', 'ENGAGING']
    };

    // Emotion combinations for complex expressions
    this.emotionBlends = {
      'BITTERSWEET': { primary: 'SAD', secondary: 'HAPPY', ratio: 0.6 },
      'SURPRISED_HAPPY': { primary: 'SURPRISED', secondary: 'HAPPY', ratio: 0.7 },
      'ANGRY_DISAPPOINTED': { primary: 'ANGRY', secondary: 'SAD', ratio: 0.8 },
      'THOUGHTFUL_CONCERNED': { primary: 'THINKING', secondary: 'WORRIED', ratio: 0.6 },
      'EXCITED_NERVOUS': { primary: 'HAPPY', secondary: 'ANXIOUS', ratio: 0.7 }
    };

    logger.info('Facial Expression Service initialized', {
      emotionCount: Object.keys(this.emotions).length,
      contextMappings: Object.keys(this.contextEmotions).length,
      blendCombinations: Object.keys(this.emotionBlends).length
    });
  }

  /**
   * Get emotion based on text analysis and context
   */
  analyzeTextEmotion(text, context = 'general') {
    try {
      // Normalize text for analysis
      const normalizedText = text.toLowerCase();
      
      // Emotion keywords mapping
      const emotionKeywords = {
        'HAPPY': ['happy', 'joy', 'smile', 'laugh', 'good', 'great', 'wonderful', 'excellent', 'amazing'],
        'SAD': ['sad', 'cry', 'sorry', 'hurt', 'pain', 'terrible', 'awful', 'bad', 'disappointed'],
        'ANGRY': ['angry', 'mad', 'hate', 'furious', 'annoyed', 'frustrated', 'irritated'],
        'SURPRISED': ['wow', 'amazing', 'incredible', 'unbelievable', 'shocking', 'surprising'],
        'FEARFUL': ['scared', 'afraid', 'fear', 'terrified', 'nervous', 'worried', 'anxious'],
        'DISGUSTED': ['disgusting', 'gross', 'yuck', 'awful', 'terrible', 'horrible'],
        'THINKING': ['think', 'consider', 'wonder', 'maybe', 'perhaps', 'possibly'],
        'CONFUSED': ['confused', 'what', 'how', 'why', 'understand', 'explain']
      };

      // Analyze text for emotional keywords
      const emotionScores = {};
      for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        const score = keywords.reduce((sum, keyword) => {
          return sum + (normalizedText.includes(keyword) ? 1 : 0);
        }, 0);
        if (score > 0) {
          emotionScores[emotion] = score;
        }
      }

      // Get context-appropriate emotions
      const contextEmotions = this.contextEmotions[context] || ['NEUTRAL'];
      
      // Determine primary emotion
      let primaryEmotion = 'NEUTRAL';
      let maxScore = 0;
      
      for (const [emotion, score] of Object.entries(emotionScores)) {
        if (score > maxScore) {
          maxScore = score;
          primaryEmotion = emotion;
        }
      }

      // Determine intensity based on text characteristics
      const intensity = this.calculateIntensity(text, primaryEmotion);
      
      // Get appropriate emotion for context
      const finalEmotion = contextEmotions.includes(primaryEmotion) ? primaryEmotion : contextEmotions[0];

      return {
        emotion: finalEmotion,
        intensity,
        confidence: Math.min(maxScore / 3, 1.0),
        context,
        alternatives: Object.keys(emotionScores).slice(0, 3),
        metadata: {
          textLength: text.length,
          keywordMatches: maxScore,
          contextOptions: contextEmotions
        }
      };

    } catch (error) {
      logger.error('Error analyzing text emotion', {
        error: error.message,
        text: text.substring(0, 100),
        context
      });

      return {
        emotion: 'NEUTRAL',
        intensity: 'medium',
        confidence: 0.5,
        context,
        error: error.message
      };
    }
  }

  /**
   * Calculate emotion intensity based on text characteristics
   */
  calculateIntensity(text, emotion) {
    const textUpper = text.toUpperCase();
    let intensity = 'medium';

    // Check for intensity indicators
    const exclamationCount = (text.match(/!/g) || []).length;
    const allCapsWords = (textUpper.match(/\b[A-Z]{2,}\b/g) || []).length;
    const emphasisWords = ['very', 'really', 'extremely', 'totally', 'absolutely', 'incredibly'];
    const emphasisCount = emphasisWords.reduce((count, word) => {
      return count + (text.toLowerCase().includes(word) ? 1 : 0);
    }, 0);

    // Calculate intensity score
    const intensityScore = exclamationCount + allCapsWords + emphasisCount;

    if (intensityScore >= 3) {
      intensity = 'high';
    } else if (intensityScore >= 1) {
      intensity = 'medium';
    } else {
      intensity = 'low';
    }

    return intensity;
  }

  /**
   * Get facial expression parameters for emotion
   */
  getExpressionParameters(emotion, intensity = 'medium') {
    try {
      const emotionData = this.emotions[emotion.toUpperCase()];
      if (!emotionData) {
        logger.warn('Unknown emotion requested', { emotion });
        return this.emotions['NEUTRAL'];
      }

      const intensityData = emotionData.intensity[intensity] || emotionData.intensity['medium'];
      
      return {
        ...emotionData,
        currentIntensity: intensity,
        parameters: intensityData,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error('Error getting expression parameters', {
        error: error.message,
        emotion,
        intensity
      });

      return this.emotions['NEUTRAL'];
    }
  }

  /**
   * Blend two emotions for complex expressions
   */
  blendEmotions(primaryEmotion, secondaryEmotion, blendRatio = 0.7) {
    try {
      const primary = this.emotions[primaryEmotion.toUpperCase()];
      const secondary = this.emotions[secondaryEmotion.toUpperCase()];

      if (!primary || !secondary) {
        throw new Error('Invalid emotions for blending');
      }

      // Blend facial features
      const blendedFeatures = {};
      for (const feature of Object.keys(primary.features)) {
        if (secondary.features[feature]) {
          blendedFeatures[feature] = {
            ...primary.features[feature],
            blend: {
              secondary: secondary.features[feature],
              ratio: blendRatio
            }
          };
        } else {
          blendedFeatures[feature] = primary.features[feature];
        }
      }

      return {
        name: `${primary.name} + ${secondary.name}`,
        category: 'blended',
        primary: primaryEmotion,
        secondary: secondaryEmotion,
        blendRatio,
        features: blendedFeatures,
        duration: {
          min: Math.max(primary.duration.min, secondary.duration.min),
          max: Math.max(primary.duration.max, secondary.duration.max)
        }
      };

    } catch (error) {
      logger.error('Error blending emotions', {
        error: error.message,
        primaryEmotion,
        secondaryEmotion,
        blendRatio
      });

      return this.emotions['NEUTRAL'];
    }
  }

  /**
   * Get emotion sequence for sign language phrase
   */
  generateEmotionSequence(signSequence, context = 'general') {
    try {
      const emotionSequence = [];

      for (const [index, sign] of signSequence.entries()) {
        // Analyze individual sign/word for emotion
        const wordEmotion = this.analyzeTextEmotion(sign.word || sign.text || '', context);
        
        // Consider position in sequence for emotion timing
        const position = index / (signSequence.length - 1); // 0 to 1
        const duration = sign.duration || 1500;

        // Adjust emotion intensity based on position
        let adjustedIntensity = wordEmotion.intensity;
        if (position < 0.3) {
          // Beginning - build up
          adjustedIntensity = this.adjustIntensity(wordEmotion.intensity, -0.2);
        } else if (position > 0.7) {
          // End - wind down
          adjustedIntensity = this.adjustIntensity(wordEmotion.intensity, -0.1);
        }

        emotionSequence.push({
          index,
          sign: sign.word || sign.text,
          emotion: wordEmotion.emotion,
          intensity: adjustedIntensity,
          duration,
          startTime: emotionSequence.reduce((sum, e) => sum + e.duration, 0),
          confidence: wordEmotion.confidence,
          transition: this.getTransitionType(
            index > 0 ? emotionSequence[index - 1].emotion : 'NEUTRAL',
            wordEmotion.emotion
          )
        });
      }

      // Smooth emotion transitions
      return this.smoothEmotionTransitions(emotionSequence);

    } catch (error) {
      logger.error('Error generating emotion sequence', {
        error: error.message,
        sequenceLength: signSequence.length,
        context
      });

      return [{
        index: 0,
        emotion: 'NEUTRAL',
        intensity: 'medium',
        duration: 1500,
        startTime: 0
      }];
    }
  }

  /**
   * Adjust emotion intensity
   */
  adjustIntensity(currentIntensity, adjustment) {
    const intensityLevels = ['low', 'medium', 'high'];
    const currentIndex = intensityLevels.indexOf(currentIntensity);
    const newIndex = Math.max(0, Math.min(2, currentIndex + Math.round(adjustment * 3)));
    return intensityLevels[newIndex];
  }

  /**
   * Get transition type between emotions
   */
  getTransitionType(fromEmotion, toEmotion) {
    if (fromEmotion === toEmotion) return 'hold';
    
    const from = this.emotions[fromEmotion];
    const to = this.emotions[toEmotion];
    
    if (!from || !to) return 'fade';
    
    // Check if emotions are in transition list
    if (from.transitions && from.transitions.includes(toEmotion)) {
      return 'smooth';
    }
    
    // Check category compatibility
    if (from.category === to.category) {
      return 'blend';
    }
    
    return 'fade';
  }

  /**
   * Smooth emotion transitions in sequence
   */
  smoothEmotionTransitions(emotionSequence) {
    const smoothedSequence = [...emotionSequence];
    
    for (let i = 1; i < smoothedSequence.length; i++) {
      const current = smoothedSequence[i];
      const previous = smoothedSequence[i - 1];
      
      // Add transition periods for dramatic emotion changes
      if (current.transition === 'fade') {
        // Insert brief neutral transition
        const transitionDuration = 300;
        current.startTime += transitionDuration;
        
        smoothedSequence.splice(i, 0, {
          index: i - 0.5,
          emotion: 'NEUTRAL',
          intensity: 'low',
          duration: transitionDuration,
          startTime: previous.startTime + previous.duration,
          isTransition: true
        });
      }
    }
    
    return smoothedSequence;
  }

  /**
   * Get available emotions list
   */
  getAvailableEmotions() {
    return Object.keys(this.emotions).map(emotion => ({
      name: emotion,
      displayName: this.emotions[emotion].name,
      category: this.emotions[emotion].category,
      intensityLevels: Object.keys(this.emotions[emotion].intensity)
    }));
  }

  /**
   * Get emotion by category
   */
  getEmotionsByCategory(category) {
    return Object.entries(this.emotions)
      .filter(([_, data]) => data.category === category)
      .map(([name, data]) => ({ name, ...data }));
  }

  /**
   * Validate emotion parameters
   */
  validateEmotion(emotion, intensity = 'medium') {
    const emotionExists = this.emotions.hasOwnProperty(emotion.toUpperCase());
    const validIntensity = ['low', 'medium', 'high'].includes(intensity);
    
    return {
      valid: emotionExists && validIntensity,
      emotion: emotionExists ? emotion.toUpperCase() : 'NEUTRAL',
      intensity: validIntensity ? intensity : 'medium',
      suggestions: emotionExists ? [] : this.getSimilarEmotions(emotion)
    };
  }

  /**
   * Get similar emotions for suggestions
   */
  getSimilarEmotions(emotion) {
    const input = emotion.toLowerCase();
    const matches = [];
    
    for (const [name, data] of Object.entries(this.emotions)) {
      if (name.toLowerCase().includes(input) || data.name.toLowerCase().includes(input)) {
        matches.push(name);
      }
    }
    
    return matches.slice(0, 3);
  }
}

module.exports = new FacialExpressionService();