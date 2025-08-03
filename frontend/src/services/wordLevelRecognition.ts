export interface WordGesturePattern {
    word: string;
    gestures: string[];
    duration: number; // milliseconds
    handMovements?: MovementPattern[];
    confidence: number;
    category: 'greeting' | 'common' | 'question' | 'emotion' | 'family' | 'action';
}

export interface MovementPattern {
    type: 'static' | 'linear' | 'circular' | 'shake' | 'tap';
    direction?: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward';
    repetitions?: number;
    speed: 'slow' | 'medium' | 'fast';
}

export interface GestureSequence {
    gestures: string[];
    timestamps: number[];
    landmarks: any[][];
    movements: MovementPattern[];
}

export interface WordRecognitionResult {
    word: string;
    confidence: number;
    category: string;
    description: string;
    gestures: string[];
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    completeness: number; // 0-1, how complete the word gesture is
}

export class WordLevelRecognizer {
    private wordVocabulary: WordGesturePattern[] = [
        // Greetings
        { word: 'HELLO', gestures: ['OPEN_HAND', 'WAVE'], duration: 1500, handMovements: [{ type: 'shake', speed: 'medium', repetitions: 2 }], confidence: 0.9, category: 'greeting' },
        { word: 'HI', gestures: ['WAVE'], duration: 1000, handMovements: [{ type: 'shake', speed: 'fast', repetitions: 3 }], confidence: 0.85, category: 'greeting' },
        { word: 'BYE', gestures: ['OPEN_HAND', 'WAVE'], duration: 2000, handMovements: [{ type: 'shake', speed: 'slow', repetitions: 4 }], confidence: 0.9, category: 'greeting' },
        { word: 'GOODBYE', gestures: ['OPEN_HAND', 'WAVE', 'CLOSE'], duration: 3000, handMovements: [{ type: 'linear', direction: 'right', speed: 'slow' }], confidence: 0.8, category: 'greeting' },

        // Common Responses
        { word: 'YES', gestures: ['FIST', 'NOD'], duration: 1200, handMovements: [{ type: 'linear', direction: 'down', speed: 'medium', repetitions: 2 }], confidence: 0.9, category: 'common' },
        { word: 'NO', gestures: ['INDEX_MIDDLE', 'SHAKE'], duration: 1000, handMovements: [{ type: 'shake', speed: 'fast', repetitions: 3 }], confidence: 0.85, category: 'common' },
        { word: 'PLEASE', gestures: ['OPEN_HAND', 'CIRCULAR'], duration: 1500, handMovements: [{ type: 'circular', speed: 'medium' }], confidence: 0.8, category: 'common' },
        { word: 'THANK_YOU', gestures: ['OPEN_HAND', 'FORWARD'], duration: 1800, handMovements: [{ type: 'linear', direction: 'forward', speed: 'medium' }], confidence: 0.9, category: 'common' },
        { word: 'SORRY', gestures: ['FIST', 'CIRCULAR'], duration: 2000, handMovements: [{ type: 'circular', speed: 'slow' }], confidence: 0.8, category: 'emotion' },

        // Questions
        { word: 'WHAT', gestures: ['INDEX', 'SHAKE'], duration: 800, handMovements: [{ type: 'shake', speed: 'fast', repetitions: 2 }], confidence: 0.85, category: 'question' },
        { word: 'WHERE', gestures: ['INDEX', 'POINT'], duration: 1000, handMovements: [{ type: 'linear', direction: 'left', speed: 'medium' }, { type: 'linear', direction: 'right', speed: 'medium' }], confidence: 0.8, category: 'question' },
        { word: 'WHEN', gestures: ['INDEX', 'CIRCULAR'], duration: 1200, handMovements: [{ type: 'circular', speed: 'medium' }], confidence: 0.75, category: 'question' },
        { word: 'HOW', gestures: ['FIST', 'ROLL'], duration: 1500, handMovements: [{ type: 'circular', speed: 'slow' }], confidence: 0.8, category: 'question' },
        { word: 'WHY', gestures: ['Y_HAND', 'TOUCH_FOREHEAD'], duration: 1200, handMovements: [{ type: 'tap', repetitions: 1, speed: 'medium' }], confidence: 0.85, category: 'question' },

        // Family
        { word: 'MOTHER', gestures: ['FIVE', 'TOUCH_CHIN'], duration: 1000, handMovements: [{ type: 'tap', repetitions: 1, speed: 'medium' }], confidence: 0.9, category: 'family' },
        { word: 'FATHER', gestures: ['FIVE', 'TOUCH_FOREHEAD'], duration: 1000, handMovements: [{ type: 'tap', repetitions: 1, speed: 'medium' }], confidence: 0.9, category: 'family' },
        { word: 'FAMILY', gestures: ['F', 'CIRCULAR'], duration: 2000, handMovements: [{ type: 'circular', speed: 'slow' }], confidence: 0.8, category: 'family' },

        // Actions
        { word: 'EAT', gestures: ['PINCH', 'TO_MOUTH'], duration: 1000, handMovements: [{ type: 'linear', direction: 'up', speed: 'medium', repetitions: 2 }], confidence: 0.85, category: 'action' },
        { word: 'DRINK', gestures: ['C_SHAPE', 'TO_MOUTH'], duration: 1200, handMovements: [{ type: 'linear', direction: 'up', speed: 'slow' }], confidence: 0.8, category: 'action' },
        { word: 'SLEEP', gestures: ['FLAT_HAND', 'TO_CHEEK'], duration: 1500, handMovements: [{ type: 'static', speed: 'slow' }], confidence: 0.85, category: 'action' },
        { word: 'HELP', gestures: ['FIST_ON_PALM', 'UP'], duration: 1200, handMovements: [{ type: 'linear', direction: 'up', speed: 'medium' }], confidence: 0.9, category: 'action' },

        // Emotions
        { word: 'HAPPY', gestures: ['FLAT_HAND', 'UP_CHEST'], duration: 1000, handMovements: [{ type: 'linear', direction: 'up', speed: 'fast', repetitions: 2 }], confidence: 0.85, category: 'emotion' },
        { word: 'SAD', gestures: ['FIVE', 'DOWN_FACE'], duration: 1500, handMovements: [{ type: 'linear', direction: 'down', speed: 'slow' }], confidence: 0.8, category: 'emotion' },
        { word: 'LOVE', gestures: ['CROSSED_ARMS'], duration: 2000, handMovements: [{ type: 'static', speed: 'slow' }], confidence: 0.9, category: 'emotion' },

        // Time
        { word: 'TODAY', gestures: ['NOW', 'DAY'], duration: 1800, handMovements: [{ type: 'linear', direction: 'down', speed: 'medium' }], confidence: 0.8, category: 'common' },
        { word: 'TOMORROW', gestures: ['A', 'FORWARD'], duration: 1500, handMovements: [{ type: 'linear', direction: 'forward', speed: 'medium' }], confidence: 0.75, category: 'common' },
        { word: 'YESTERDAY', gestures: ['A', 'BACKWARD'], duration: 1500, handMovements: [{ type: 'linear', direction: 'backward', speed: 'medium' }], confidence: 0.75, category: 'common' },
    ];

    private gestureSequence: GestureSequence = {
        gestures: [],
        timestamps: [],
        landmarks: [],
        movements: []
    };

    private readonly maxSequenceLength = 10;
    private readonly gestureTimeout = 3000; // 3 seconds
    private lastGestureTime = 0;
    private recognitionHistory: WordRecognitionResult[] = [];

    // Add gesture to current sequence
    addGestureToSequence(gesture: string, landmarks: any[], timestamp: number): void {
        // Clear old gestures if timeout exceeded
        if (timestamp - this.lastGestureTime > this.gestureTimeout) {
            this.clearSequence();
        }

        // Validate landmarks before adding
        if (!landmarks || !Array.isArray(landmarks) || landmarks.length === 0) {
            console.warn('Invalid landmarks provided to addGestureToSequence');
            return;
        }

        this.gestureSequence.gestures.push(gesture);
        this.gestureSequence.timestamps.push(timestamp);
        this.gestureSequence.landmarks.push(landmarks);

        // Detect movement pattern with safety checks
        try {
            const movement = this.detectMovementPattern(landmarks, this.gestureSequence.landmarks);
            if (movement) {
                this.gestureSequence.movements.push(movement);
            }
        } catch (error) {
            console.warn('Error detecting movement pattern:', error);
        }

        // Limit sequence length
        if (this.gestureSequence.gestures.length > this.maxSequenceLength) {
            this.gestureSequence.gestures.shift();
            this.gestureSequence.timestamps.shift();
            this.gestureSequence.landmarks.shift();
            if (this.gestureSequence.movements.length > 0) {
                this.gestureSequence.movements.shift();
            }
        }

        this.lastGestureTime = timestamp;
    }

    // FIXED: Detect movement patterns from landmark history with proper null checks
    private detectMovementPattern(currentLandmarks: any[], landmarkHistory: any[][]): MovementPattern | null {
        try {
            // Enhanced validation
            if (!landmarkHistory || landmarkHistory.length < 3) {
                return null;
            }

            // Get recent landmarks with validation
            const recent = landmarkHistory.slice(-3);

            // Validate each landmark array
            const validRecent = recent.filter(landmarks =>
                landmarks &&
                Array.isArray(landmarks) &&
                landmarks.length > 0 &&
                landmarks[0] &&
                typeof landmarks[0] === 'object'
            );

            if (validRecent.length < 3) {
                return { type: 'static', speed: 'slow' };
            }

            // Extract wrist positions (index 0) with safety checks
            const wristPositions = validRecent.map(landmarks => {
                const wrist = landmarks[0];
                // Ensure wrist has required properties
                if (!wrist || typeof wrist.x !== 'number' || typeof wrist.y !== 'number') {
                    return null;
                }
                return {
                    x: wrist.x,
                    y: wrist.y,
                    z: typeof wrist.z === 'number' ? wrist.z : 0
                };
            }).filter(Boolean); // Remove null entries

            // Need at least 3 valid wrist positions
            if (wristPositions.length < 3) {
                return { type: 'static', speed: 'slow' };
            }

            // Calculate movement vectors safely
            const first = wristPositions[0];
            const last = wristPositions[wristPositions.length - 1];

            const dx = last.x - first.x;
            const dy = last.y - first.y;
            const dz = last.z - first.z;

            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

            // Static if very little movement
            if (distance < 0.02) {
                return { type: 'static', speed: 'slow' };
            }

            // Determine movement type and direction
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            const absZ = Math.abs(dz);

            let direction: string;
            let type: 'linear' | 'circular' = 'linear';

            // Determine primary direction
            if (absX > absY && absX > absZ) {
                direction = dx > 0 ? 'right' : 'left';
            } else if (absY > absZ) {
                direction = dy > 0 ? 'down' : 'up';
            } else {
                direction = dz > 0 ? 'forward' : 'backward';
            }

            // Determine speed based on distance
            let speed: 'slow' | 'medium' | 'fast';
            if (distance > 0.1) {
                speed = 'fast';
            } else if (distance > 0.05) {
                speed = 'medium';
            } else {
                speed = 'slow';
            }

            // Check for circular motion (simplified)
            if (wristPositions.length >= 3) {
                const midPoint = wristPositions[Math.floor(wristPositions.length / 2)];
                const area = Math.abs(
                    (first.x * (midPoint.y - last.y) +
                        midPoint.x * (last.y - first.y) +
                        last.x * (first.y - midPoint.y)) / 2
                );

                if (area > 0.01) {
                    type = 'circular';
                }
            }

            return {
                type,
                direction: direction as any,
                speed
            };

        } catch (error) {
            console.warn('Error in detectMovementPattern:', error);
            return { type: 'static', speed: 'slow' };
        }
    }

    // FIXED: Recognize word from current gesture sequence with better error handling
    recognizeWord(): WordRecognitionResult | null {
        try {
            if (this.gestureSequence.gestures.length === 0) {
                return null;
            }

            let bestMatch: WordRecognitionResult | null = null;
            let bestScore = 0;

            for (const pattern of this.wordVocabulary) {
                try {
                    const score = this.calculateWordScore(pattern);

                    if (score > bestScore && score > 0.5) {
                        bestScore = score;
                        bestMatch = {
                            word: pattern.word,
                            confidence: score,
                            category: pattern.category,
                            description: this.getWordDescription(pattern),
                            gestures: pattern.gestures,
                            quality: this.getQualityFromScore(score),
                            completeness: this.calculateCompleteness(pattern)
                        };
                    }
                } catch (error) {
                    console.warn(`Error calculating score for pattern ${pattern.word}:`, error);
                    continue;
                }
            }

            // Add to recognition history
            if (bestMatch && bestMatch.confidence > 0.6) {
                this.recognitionHistory.push(bestMatch);
                if (this.recognitionHistory.length > 5) {
                    this.recognitionHistory.shift();
                }
            }

            return bestMatch;
        } catch (error) {
            console.error('Error in recognizeWord:', error);
            return null;
        }
    }

    // Calculate word matching score with error handling
    private calculateWordScore(pattern: WordGesturePattern): number {
        try {
            let score = 0;
            const sequence = this.gestureSequence;

            // Gesture sequence matching (40% of score)
            const gestureScore = this.matchGestureSequence(pattern.gestures, sequence.gestures);
            score += gestureScore * 0.4;

            // Movement pattern matching (30% of score)
            const movementScore = this.matchMovementPatterns(pattern.handMovements || [], sequence.movements);
            score += movementScore * 0.3;

            // Timing matching (20% of score)
            const timingScore = this.matchTiming(pattern.duration, sequence.timestamps);
            score += timingScore * 0.2;

            // Completeness (10% of score)
            const completenessScore = this.calculateCompleteness(pattern);
            score += completenessScore * 0.1;

            return Math.min(Math.max(score, 0), 1.0); // Clamp between 0 and 1
        } catch (error) {
            console.warn('Error calculating word score:', error);
            return 0;
        }
    }

    // Match gesture sequences using fuzzy matching
    private matchGestureSequence(patternGestures: string[], sequenceGestures: string[]): number {
        if (!patternGestures || !sequenceGestures || patternGestures.length === 0 || sequenceGestures.length === 0) {
            return 0;
        }

        try {
            // Simple substring matching with flexibility
            let matches = 0;
            const maxMatches = Math.min(patternGestures.length, sequenceGestures.length);

            for (let i = 0; i < patternGestures.length; i++) {
                const patternGesture = patternGestures[i];

                // Look for pattern gesture in recent sequence
                for (let j = Math.max(0, sequenceGestures.length - maxMatches); j < sequenceGestures.length; j++) {
                    if (this.gesturesMatch(patternGesture, sequenceGestures[j])) {
                        matches++;
                        break;
                    }
                }
            }

            return matches / patternGestures.length;
        } catch (error) {
            console.warn('Error matching gesture sequence:', error);
            return 0;
        }
    }

    // Check if two gestures match (with fuzzy matching)
    private gesturesMatch(pattern: string, gesture: string): boolean {
        if (!pattern || !gesture) return false;

        // Direct match
        if (pattern === gesture) return true;

        // Fuzzy matching for similar gestures
        const similarGestures: Record<string, string[]> = {
            'OPEN_HAND': ['FIVE', 'FLAT_HAND'],
            'FIST': ['A', 'S'],
            'INDEX': ['D', 'POINT'],
            'PINCH': ['F', 'O'],
            'C_SHAPE': ['C', 'O'],
            'Y_HAND': ['Y', 'I_LOVE_YOU']
        };

        return similarGestures[pattern]?.includes(gesture) || false;
    }

    // Match movement patterns
    private matchMovementPatterns(patternMovements: MovementPattern[], sequenceMovements: MovementPattern[]): number {
        if (!patternMovements || patternMovements.length === 0) return 1; // No movement required
        if (!sequenceMovements || sequenceMovements.length === 0) return 0;

        try {
            let matches = 0;
            for (const patternMovement of patternMovements) {
                for (const sequenceMovement of sequenceMovements) {
                    if (this.movementsMatch(patternMovement, sequenceMovement)) {
                        matches++;
                        break;
                    }
                }
            }

            return matches / patternMovements.length;
        } catch (error) {
            console.warn('Error matching movement patterns:', error);
            return 0;
        }
    }

    // Check if movements match
    private movementsMatch(pattern: MovementPattern, movement: MovementPattern): boolean {
        if (!pattern || !movement) return false;
        if (pattern.type !== movement.type) return false;
        if (pattern.direction && pattern.direction !== movement.direction) return false;
        return true;
    }

    // Match timing
    private matchTiming(expectedDuration: number, timestamps: number[]): number {
        if (!timestamps || timestamps.length < 2) return 0.5;

        try {
            const actualDuration = timestamps[timestamps.length - 1] - timestamps[0];
            if (actualDuration <= 0 || expectedDuration <= 0) return 0.5;

            const ratio = Math.min(actualDuration, expectedDuration) / Math.max(actualDuration, expectedDuration);
            return Math.max(ratio, 0);
        } catch (error) {
            console.warn('Error matching timing:', error);
            return 0.5;
        }
    }

    // Calculate word completeness
    private calculateCompleteness(pattern: WordGesturePattern): number {
        try {
            const sequence = this.gestureSequence;
            const gestureProgress = pattern.gestures.length > 0 ?
                Math.min(sequence.gestures.length / pattern.gestures.length, 1) : 1;
            const movementProgress = pattern.handMovements && pattern.handMovements.length > 0 ?
                Math.min(sequence.movements.length / pattern.handMovements.length, 1) : 1;

            return (gestureProgress + movementProgress) / 2;
        } catch (error) {
            console.warn('Error calculating completeness:', error);
            return 0.5;
        }
    }

    // Get word description
    private getWordDescription(pattern: WordGesturePattern): string {
        try {
            const gestureList = pattern.gestures?.join(' → ') || 'unknown';
            const movements = pattern.handMovements?.map(m => `${m.type} ${m.direction || ''}`).join(', ') || 'static';
            return `${gestureList} with ${movements} movement`;
        } catch (error) {
            console.warn('Error getting word description:', error);
            return `${pattern.word} gesture`;
        }
    }

    // Get quality from score
    private getQualityFromScore(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
        if (typeof score !== 'number' || isNaN(score)) return 'poor';
        if (score >= 0.9) return 'excellent';
        if (score >= 0.7) return 'good';
        if (score >= 0.5) return 'fair';
        return 'poor';
    }

    // Get word suggestions based on current sequence
    getWordSuggestions(): string[] {
        try {
            const suggestions: { word: string; score: number }[] = [];

            for (const pattern of this.wordVocabulary) {
                try {
                    const score = this.calculateWordScore(pattern);
                    if (score > 0.3) {
                        suggestions.push({ word: pattern.word, score });
                    }
                } catch (error) {
                    console.warn(`Error getting suggestion for ${pattern.word}:`, error);
                    continue;
                }
            }

            return suggestions
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(s => s.word);
        } catch (error) {
            console.warn('Error getting word suggestions:', error);
            return [];
        }
    }

    // Get words by category
    getWordsByCategory(category: string): string[] {
        try {
            return this.wordVocabulary
                .filter(pattern => pattern.category === category)
                .map(pattern => pattern.word);
        } catch (error) {
            console.warn('Error getting words by category:', error);
            return [];
        }
    }

    // Clear current sequence
    clearSequence(): void {
        this.gestureSequence = {
            gestures: [],
            timestamps: [],
            landmarks: [],
            movements: []
        };
    }

    // Get current sequence status
    getSequenceStatus(): {
        length: number;
        duration: number;
        lastGesture: string | null;
        suggestions: string[];
    } {
        try {
            const sequence = this.gestureSequence;
            return {
                length: sequence.gestures.length,
                duration: sequence.timestamps.length > 1 ?
                    sequence.timestamps[sequence.timestamps.length - 1] - sequence.timestamps[0] : 0,
                lastGesture: sequence.gestures[sequence.gestures.length - 1] || null,
                suggestions: this.getWordSuggestions()
            };
        } catch (error) {
            console.warn('Error getting sequence status:', error);
            return {
                length: 0,
                duration: 0,
                lastGesture: null,
                suggestions: []
            };
        }
    }

    // Get recognition history
    getRecognitionHistory(): WordRecognitionResult[] {
        return [...this.recognitionHistory];
    }
}
