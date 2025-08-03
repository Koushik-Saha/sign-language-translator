'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WordLevelRecognizer, WordRecognitionResult } from '@/services/wordLevelRecognition';
import { useTranslation } from '@/context/TranslationContext';

export interface WordRecognitionState {
    currentWordResult: WordRecognitionResult | null;
    isRecognizing: boolean;
    wordSuggestions: string[];
    sequenceStatus: {
        length: number;
        duration: number;
        lastGesture: string | null;
        suggestions: string[];
    };
    recognitionHistory: WordRecognitionResult[];
    confidenceThreshold: number;
    autoTranslateWords: boolean;
}

export function useWordRecognition() {
    const { addTranslation, isTranslating, setIsTranslating } = useTranslation();
    const wordRecognizer = useRef(new WordLevelRecognizer());

    const [state, setState] = useState<WordRecognitionState>({
        currentWordResult: null,
        isRecognizing: false,
        wordSuggestions: [],
        sequenceStatus: { length: 0, duration: 0, lastGesture: null, suggestions: [] },
        recognitionHistory: [],
        confidenceThreshold: 0.7,
        autoTranslateWords: true
    });

    const [lastGestureTime, setLastGestureTime] = useState(0);
    const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const autoTranslateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Process new gesture for word recognition
    const processGestureForWord = useCallback((gesture: string, landmarks: any[], confidence: number) => {
        if (!gesture || gesture === '?' || confidence < 0.6) return;

        const timestamp = Date.now();

        // Add gesture to sequence
        wordRecognizer.current.addGestureToSequence(gesture, landmarks, timestamp);
        setLastGestureTime(timestamp);

        // Update sequence status
        const sequenceStatus = wordRecognizer.current.getSequenceStatus();
        setState(prev => ({
            ...prev,
            sequenceStatus,
            wordSuggestions: sequenceStatus.suggestions
        }));

        // Clear any existing auto-translate timeout
        if (autoTranslateTimeoutRef.current) {
            clearTimeout(autoTranslateTimeoutRef.current);
        }

        // Set auto-translate timeout for complete words
        if (state.autoTranslateWords) {
            autoTranslateTimeoutRef.current = setTimeout(() => {
                attemptWordRecognition();
            }, 2000); // 2 seconds after last gesture
        }
    }, [state.autoTranslateWords]);

    // Attempt word recognition
    const attemptWordRecognition = useCallback(async () => {
        const result = wordRecognizer.current.recognizeWord();

        if (result && result.confidence >= state.confidenceThreshold) {
            setState(prev => ({
                ...prev,
                currentWordResult: result,
                recognitionHistory: wordRecognizer.current.getRecognitionHistory()
            }));

            // Auto-translate high-confidence words
            if (result.confidence >= 0.8 && state.autoTranslateWords && !isTranslating) {
                await translateRecognizedWord(result);
            }
        } else {
            setState(prev => ({
                ...prev,
                currentWordResult: result
            }));
        }
    }, [state.confidenceThreshold, state.autoTranslateWords, isTranslating]);

    // Translate recognized word
    const translateRecognizedWord = useCallback(async (wordResult: WordRecognitionResult) => {
        if (isTranslating) return;

        setIsTranslating(true);

        try {
            // For word-level recognition, we'll create a simple translation
            // In a real implementation, this would connect to a proper ASL-to-text API
            const translation = formatWordForTranslation(wordResult.word);

            addTranslation({
                original: `${wordResult.word} (${wordResult.category})`,
                translation: translation,
                confidence: wordResult.confidence,
                type: 'sign_to_text'
            });

            // Clear the word sequence after successful recognition
            wordRecognizer.current.clearSequence();
            setState(prev => ({
                ...prev,
                currentWordResult: null,
                sequenceStatus: { length: 0, duration: 0, lastGesture: null, suggestions: [] },
                wordSuggestions: []
            }));

        } catch (error) {
            console.error('Error translating word:', error);
        } finally {
            setIsTranslating(false);
        }
    }, [isTranslating, addTranslation, setIsTranslating]);

    // Format word for translation
    const formatWordForTranslation = (word: string): string => {
        const wordTranslations: Record<string, string> = {
            'HELLO': 'Hello!',
            'HI': 'Hi there!',
            'BYE': 'Goodbye!',
            'GOODBYE': 'Goodbye!',
            'YES': 'Yes',
            'NO': 'No',
            'PLEASE': 'Please',
            'THANK_YOU': 'Thank you',
            'SORRY': 'I\'m sorry',
            'WHAT': 'What?',
            'WHERE': 'Where?',
            'WHEN': 'When?',
            'HOW': 'How?',
            'WHY': 'Why?',
            'MOTHER': 'Mother',
            'FATHER': 'Father',
            'FAMILY': 'Family',
            'EAT': 'Eat',
            'DRINK': 'Drink',
            'SLEEP': 'Sleep',
            'HELP': 'Help me',
            'HAPPY': 'I am happy',
            'SAD': 'I am sad',
            'LOVE': 'Love',
            'TODAY': 'Today',
            'TOMORROW': 'Tomorrow',
            'YESTERDAY': 'Yesterday'
        };

        return wordTranslations[word] || word.toLowerCase().replace('_', ' ');
    };

    // Start word recognition mode
    const startWordRecognition = useCallback(() => {
        setState(prev => ({ ...prev, isRecognizing: true }));

        // Start continuous recognition check
        recognitionIntervalRef.current = setInterval(() => {
            attemptWordRecognition();
        }, 500); // Check every 500ms
    }, [attemptWordRecognition]);

    // Stop word recognition mode
    const stopWordRecognition = useCallback(() => {
        setState(prev => ({ ...prev, isRecognizing: false }));

        if (recognitionIntervalRef.current) {
            clearInterval(recognitionIntervalRef.current);
            recognitionIntervalRef.current = null;
        }

        if (autoTranslateTimeoutRef.current) {
            clearTimeout(autoTranslateTimeoutRef.current);
            autoTranslateTimeoutRef.current = null;
        }

        wordRecognizer.current.clearSequence();
        setState(prev => ({
            ...prev,
            currentWordResult: null,
            sequenceStatus: { length: 0, duration: 0, lastGesture: null, suggestions: [] },
            wordSuggestions: []
        }));
    }, []);

    // Manually trigger word recognition
    const recognizeCurrentSequence = useCallback(async () => {
        await attemptWordRecognition();
    }, [attemptWordRecognition]);

    // Select word suggestion
    const selectWordSuggestion = useCallback(async (word: string) => {
        // Create a result for the selected word
        const selectedResult: WordRecognitionResult = {
            word: word,
            confidence: 0.9,
            category: 'manual',
            description: 'Manually selected word',
            gestures: [],
            quality: 'excellent',
            completeness: 1.0
        };

        await translateRecognizedWord(selectedResult);
    }, [translateRecognizedWord]);

    // Get words by category
    const getWordsByCategory = useCallback((category: string): string[] => {
        return wordRecognizer.current.getWordsByCategory(category);
    }, []);

    // Update settings
    const updateSettings = useCallback((updates: Partial<Pick<WordRecognitionState, 'confidenceThreshold' | 'autoTranslateWords'>>) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    // Clear sequence manually
    const clearSequence = useCallback(() => {
        wordRecognizer.current.clearSequence();
        setState(prev => ({
            ...prev,
            currentWordResult: null,
            sequenceStatus: { length: 0, duration: 0, lastGesture: null, suggestions: [] },
            wordSuggestions: []
        }));
    }, []);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (recognitionIntervalRef.current) {
                clearInterval(recognitionIntervalRef.current);
            }
            if (autoTranslateTimeoutRef.current) {
                clearTimeout(autoTranslateTimeoutRef.current);
            }
        };
    }, []);

    // Auto-clear sequence after inactivity
    useEffect(() => {
        if (lastGestureTime === 0) return;

        const timeoutId = setTimeout(() => {
            const timeSinceLastGesture = Date.now() - lastGestureTime;
            if (timeSinceLastGesture > 5000) { // 5 seconds of inactivity
                clearSequence();
            }
        }, 5500);

        return () => clearTimeout(timeoutId);
    }, [lastGestureTime, clearSequence]);

    return {
        // State
        currentWordResult: state.currentWordResult,
        isRecognizing: state.isRecognizing,
        wordSuggestions: state.wordSuggestions,
        sequenceStatus: state.sequenceStatus,
        recognitionHistory: state.recognitionHistory,
        confidenceThreshold: state.confidenceThreshold,
        autoTranslateWords: state.autoTranslateWords,

        // Actions
        processGestureForWord,
        startWordRecognition,
        stopWordRecognition,
        recognizeCurrentSequence,
        selectWordSuggestion,
        getWordsByCategory,
        updateSettings,
        clearSequence,
        translateRecognizedWord,

        // Word categories
        wordCategories: ['greeting', 'common', 'question', 'emotion', 'family', 'action']
    };
}
