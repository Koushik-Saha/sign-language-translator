'use client';

import { useState, useCallback } from 'react';

export interface WordEntry {
    id: string;
    word: string;
    timestamp: Date;
    confidence: number;
}

export function useWordFormation() {
    const [currentWord, setCurrentWord] = useState<string>('');
    const [wordHistory, setWordHistory] = useState<WordEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const addLetter = useCallback((letter: string, confidence: number) => {
        if (letter && letter !== '?') {
            setCurrentWord(prev => prev + letter);
        }
    }, []);

    const removeLetter = useCallback(() => {
        setCurrentWord(prev => prev.slice(0, -1));
    }, []);

    const clearWord = useCallback(() => {
        setCurrentWord('');
    }, []);

    const submitWord = useCallback(async () => {
        if (!currentWord.trim()) return;

        setIsLoading(true);
        try {
            // Send to backend API
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

            const result = await response.json();

            // Add to history
            const newEntry: WordEntry = {
                id: Date.now().toString(),
                word: currentWord,
                timestamp: new Date(),
                confidence: 0.8 // Average confidence for now
            };

            setWordHistory(prev => [newEntry, ...prev].slice(0, 10)); // Keep last 10
            setCurrentWord(''); // Clear current word

            return result;
        } catch (error) {
            console.error('Error submitting word:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [currentWord]);

    return {
        currentWord,
        wordHistory,
        isLoading,
        addLetter,
        removeLetter,
        clearWord,
        submitWord
    };
}
