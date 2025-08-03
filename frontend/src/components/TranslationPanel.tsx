'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/context/TranslationContext';


export default function TranslationPanel() {
    const { translationHistory, lastTranslation, isTranslating } = useTranslation();
    const [speechEnabled, setSpeechEnabled] = useState(true);

    // Text-to-speech function
    const speakText = (text: string) => {
        if (speechEnabled && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
        }
    };

    // Auto-speak when new translation arrives
    React.useEffect(() => {
        if (lastTranslation && lastTranslation.type === 'sign_to_text') {
            speakText(lastTranslation.translation);
        }
    }, [lastTranslation]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                    Translation Output
                </h3>

                {/* Speech toggle */}
                <button
                    onClick={() => setSpeechEnabled(!speechEnabled)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        speechEnabled
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                >
                    🔊 {speechEnabled ? 'ON' : 'OFF'}
                </button>
            </div>

            {/* Current Translation Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
                {isTranslating ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-blue-600">Translating...</span>
                    </div>
                ) : lastTranslation ? (
                    <div className="space-y-3">
                        <div className="text-sm text-gray-600">Latest Translation</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {lastTranslation.translation}
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>From: &quot;{lastTranslation.original}&quot;</span>
                            <span>Confidence: {(lastTranslation.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => speakText(lastTranslation.translation)}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                disabled={!speechEnabled}
                            >
                                🔊 Speak
                            </button>
                            <button
                                onClick={() => navigator.clipboard.writeText(lastTranslation.translation)}
                                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                            >
                                📋 Copy
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 text-lg mb-2">🤟</div>
                        <p className="text-gray-500">
                            Start signing to see translations here
                        </p>
                    </div>
                )}
            </div>

            {/* Translation History */}
            <div className="flex-1">
                <h4 className="font-semibold text-gray-700 mb-3">Translation History</h4>

                {translationHistory.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {translationHistory.map((item) => (
                            <div
                                key={item.id}
                                className="bg-gray-50 border rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-900">
                                        {item.translation}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {item.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    From: &quot;{item.original}&quot; ({(item.confidence * 100).toFixed(1)}%)
                                </div>
                                <div className="flex space-x-2 mt-2">
                                    <button
                                        onClick={() => speakText(item.translation)}
                                        className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                                        disabled={!speechEnabled}
                                    >
                                        🔊
                                    </button>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(item.translation)}
                                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <div className="text-2xl mb-2">📝</div>
                        <p>Translation history will appear here</p>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setTranslationHistory([])}
                        disabled={translationHistory.length === 0}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                            translationHistory.length > 0
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Clear History
                    </button>

                    <button
                        onClick={() => {
                            const allTranslations = translationHistory
                                .map(t => `${t.original} → ${t.translation}`)
                                .join('\n');
                            navigator.clipboard.writeText(allTranslations);
                        }}
                        disabled={translationHistory.length === 0}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                            translationHistory.length > 0
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Export All
                    </button>
                </div>
            </div>
        </div>
    );
}
