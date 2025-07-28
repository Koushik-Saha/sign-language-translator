'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface TranslationResult {
    id: string;
    original: string;
    translation: string;
    confidence: number;
    timestamp: Date;
    type: 'sign_to_text' | 'text_to_sign';
}

interface TranslationContextType {
    currentWord: string;
    setCurrentWord: (word: string) => void;
    translationHistory: TranslationResult[];
    addTranslation: (result: Omit<TranslationResult, 'id' | 'timestamp'>) => void;
    isTranslating: boolean;
    setIsTranslating: (loading: boolean) => void;
    lastTranslation: TranslationResult | null;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
    const [currentWord, setCurrentWord] = useState<string>('');
    const [translationHistory, setTranslationHistory] = useState<TranslationResult[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [lastTranslation, setLastTranslation] = useState<TranslationResult | null>(null);

    const addTranslation = (result: Omit<TranslationResult, 'id' | 'timestamp'>) => {
        const newTranslation: TranslationResult = {
            ...result,
            id: Date.now().toString(),
            timestamp: new Date(),
        };

        setTranslationHistory(prev => [newTranslation, ...prev].slice(0, 10)); // Keep last 10
        setLastTranslation(newTranslation);
        setCurrentWord(''); // Clear current word after translation
    };

    return (
        <TranslationContext.Provider value={{
            currentWord,
            setCurrentWord,
            translationHistory,
            addTranslation,
            isTranslating,
            setIsTranslating,
            lastTranslation,
        }}>
            {children}
        </TranslationContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(TranslationContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a TranslationProvider');
    }
    return context;
}
