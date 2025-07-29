'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/context/TranslationContext';
import { WordPredictor } from '@/services/wordPrediction';

export function useEnhancedWordFormation() {
    const { currentWord, setCurrentWord, addTranslation, isTranslating, setIsTranslating } = useTranslation();
    const [predictions, setPredictions] = useState<string[]>([]);
    const [nextLetterSuggestions, setNextLetterSuggestions] = useState<string[]>([]);
    const [lastGestureTime, setLastGestureTime] = useState<number>(0);
    const [autoTranslateTimer, setAutoTranslateTimer] = useState<NodeJS.Timeout | null>(null);

    const wordPredictor = useRef(new WordPredictor());
    const gestureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update predictions when word changes
    const updatePredictions = useCallback((word: string) => {
        const newPredictions = wordPredictor.current.getPredictions(word);
        const nextLetters = wordPredictor.current.getNextLetterSuggestions(word);

        setPredictions(newPredictions);
        setNextLetterSuggestions(nextLetters);
    }, []);

    // Enhanced add letter with auto-features
    const addLetter = useCallback((letter: string, confidence: number) => {
        if (!letter || letter === '?' || confidence < 0.6) return;

        const newWord = currentWord + letter;
        setCurrentWord(newWord);
        updatePredictions(newWord);
        setLastGestureTime(Date.now());

        // Clear any existing timers
        if (gestureTimeoutRef.current) {
            clearTimeout(gestureTimeoutRef.current);
        }
        if (autoTranslateTimer) {
            clearTimeout(autoTranslateTimer);
        }

        // Check if word is likely complete and set auto-translate
        const isComplete = wordPredictor.current.isLikelyComplete(newWord);
        if (isComplete) {
            const timer = setTimeout(() => {
                submitWord();
            }, 2000); // Auto-translate after 2 seconds of no new letters
            setAutoTranslateTimer(timer);
        }

        // Set gesture timeout (clear word if no activity for 10 seconds)
        gestureTimeoutRef.current = setTimeout(() => {
            if (Date.now() - lastGestureTime > 9000) {
                clearWord();
            }
        }, 10000);
    }, [currentWord, lastGestureTime]);

    // Remove letter
    const removeLetter = useCallback(() => {
        const newWord = currentWord.slice(0, -1);
        setCurrentWord(newWord);
        updatePredictions(newWord);

        // Clear auto-translate timer
        if (autoTranslateTimer) {
            clearTimeout(autoTranslateTimer);
            setAutoTranslateTimer(null);
        }
    }, [currentWord, autoTranslateTimer]);

    // Clear word
    const clearWord = useCallback(() => {
        setCurrentWord('');
        setPredictions([]);
        setNextLetterSuggestions([]);

        // Clear all timers
        if (autoTranslateTimer) {
            clearTimeout(autoTranslateTimer);
            setAutoTranslateTimer(null);
        }
        if (gestureTimeoutRef.current) {
            clearTimeout(gestureTimeoutRef.current);
        }
    }, [autoTranslateTimer]);

    // Select prediction
    const selectPrediction = useCallback((prediction: string) => {
        setCurrentWord(prediction);
        setPredictions([]);
        setNextLetterSuggestions([]);

        // Auto-translate after selection
        setTimeout(() => {
            submitWord();
        }, 500);
    }, []);

    // Submit word
    const submitWord = useCallback(async () => {
        if (!currentWord.trim() || isTranslating) return;

        // Clear timers
        if (autoTranslateTimer) {
            clearTimeout(autoTranslateTimer);
            setAutoTranslateTimer(null);
        }

        setIsTranslating(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    word: currentWord,
                    type: 'sign_to_text'
                }),
            });

            if (!response.ok) {
                throw new Error('Translation failed');
            }

            const result = await response.json();

            // Add to translation history
            addTranslation({
                original: result.original,
                translation: result.translation,
                confidence: result.confidence || 0.8,
                type: 'sign_to_text'
            });

            // Clear predictions after successful translation
            setPredictions([]);
            setNextLetterSuggestions([]);

        } catch (error) {
            console.error('Error submitting word:', error);
            throw error;
        } finally {
            setIsTranslating(false);
        }
    }, [currentWord, isTranslating, autoTranslateTimer, addTranslation, setIsTranslating]);

    // Get word completion status
    const getWordStatus = useCallback(() => {
        if (!currentWord) return { status: 'empty', confidence: 0 };

        const confidence = wordPredictor.current.getCompletionConfidence(currentWord);
        const isComplete = wordPredictor.current.isLikelyComplete(currentWord);

        return {
            status: isComplete ? 'complete' : confidence > 0.7 ? 'likely' : confidence > 0.3 ? 'partial' : 'unknown',
            confidence
        };
    }, [currentWord]);

    return {
        addLetter,
        removeLetter,
        clearWord,
        submitWord,
        selectPrediction,
        predictions,
        nextLetterSuggestions,
        wordStatus: getWordStatus(),
        hasAutoTranslateTimer: autoTranslateTimer !== null
    };
}
