// frontend/src/components/CameraCapture.tsx (Updated for Step 20)
'use client';

import { useRef, useEffect, useState } from 'react';
import { useHandDetection } from '@/hooks/useHandDetection';
import { useTranslation } from '@/context/TranslationContext';
import { useEnhancedWordFormation } from '@/hooks/useEnhancedWordFormation';
import { useWordRecognition } from '@/hooks/useWordRecognition';
import LargeCameraView from "@/components/LargeCameraView";

type RecognitionMode = 'letter' | 'word' | 'hybrid';

export default function CameraCapture() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isDetectionActive, setIsDetectionActive] = useState(false);
    const [announceMessage, setAnnounceMessage] = useState('');
    const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>('hybrid');

    // NEW: Large camera view state
    const [showLargeCameraView, setShowLargeCameraView] = useState(false);

    const { initializeHandDetection, currentGesture } = useHandDetection();
    const {
        currentWord,
        setCurrentWord,
        addTranslation,
        isTranslating,
        setIsTranslating
    } = useTranslation();

    // Letter recognition hooks
    const {
        addLetter,
        removeLetter,
        clearWord,
        submitWord,
        selectPrediction,
        predictions,
        nextLetterSuggestions,
        wordStatus,
        hasAutoTranslateTimer
    } = useEnhancedWordFormation();

    // Word recognition hooks
    const {
        currentWordResult,
        isRecognizing,
        wordSuggestions,
        sequenceStatus,
        recognitionHistory,
        confidenceThreshold,
        autoTranslateWords,
        processGestureForWord,
        startWordRecognition,
        stopWordRecognition,
        recognizeCurrentSequence,
        selectWordSuggestion,
        getWordsByCategory,
        updateSettings,
        clearSequence,
        wordCategories
    } = useWordRecognition();

    // Announce messages to screen readers
    const announceToScreenReader = (message: string) => {
        setAnnounceMessage(message);
        setTimeout(() => setAnnounceMessage(''), 1000);
    };

    // Fix hydration by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            startCamera();
        }
    }, [mounted]);

    // Handle recognition mode changes
    useEffect(() => {
        if (recognitionMode === 'word' && isDetectionActive) {
            startWordRecognition();
        } else if (recognitionMode === 'letter' && isRecognizing) {
            stopWordRecognition();
        }
    }, [recognitionMode, isDetectionActive]);

    // Process gestures for both letter and word recognition
    useEffect(() => {
        if (currentGesture && currentGesture.letter && currentGesture.letter !== '?') {
            // Always process for word recognition if in word or hybrid mode
            if (recognitionMode === 'word' || recognitionMode === 'hybrid') {
                processGestureForWord(
                    currentGesture.letter,
                    [], // landmarks would be passed from hand detection
                    currentGesture.confidence
                );
            }
        }
    }, [currentGesture, recognitionMode, processGestureForWord]);

    const startCamera = async () => {
        try {
            setIsLoading(true);
            setError(null);
            announceToScreenReader("Starting camera...");

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    setIsLoading(false);
                    setHasPermission(true);
                    announceToScreenReader("Camera is ready for sign language recognition");
                };
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Unable to access camera. Please ensure you have given permission.');
            setIsLoading(false);
            announceToScreenReader("Camera access failed. Please check permissions.");
        }
    };

    const startDetection = async () => {
        if (videoRef.current && canvasRef.current && !isDetectionActive) {
            try {
                setError(null);
                announceToScreenReader("Starting hand detection...");
                await initializeHandDetection(videoRef.current, canvasRef.current);
                setIsDetectionActive(true);

                // Start word recognition if in word mode
                if (recognitionMode === 'word' || recognitionMode === 'hybrid') {
                    startWordRecognition();
                }

                announceToScreenReader("Hand detection is now active. Begin signing.");
            } catch (err) {
                console.error('Error starting detection:', err);
                setError('Failed to start hand detection. Please try again.');
                announceToScreenReader("Hand detection failed to start.");
            }
        }
    };

    const handleCaptureLetter = () => {
        if (currentGesture && currentGesture.letter && currentGesture.letter !== '?') {
            if (recognitionMode === 'letter' || recognitionMode === 'hybrid') {
                addLetter(currentGesture.letter, currentGesture.confidence);
                announceToScreenReader(`Letter ${currentGesture.letter} captured`);
            }
        }
    };

    const handleModeSwitch = (mode: RecognitionMode) => {
        setRecognitionMode(mode);
        announceToScreenReader(`Switched to ${mode} recognition mode`);

        // Clear current data when switching modes
        if (mode === 'word') {
            setCurrentWord('');
        } else if (mode === 'letter') {
            clearSequence();
        }
    };

    // Don't render until mounted (prevents hydration errors)
    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-xl" role="status">
                <div className="text-gray-500 font-medium">Initializing camera system...</div>
            </div>
        );
    }

    // NEW: Toggle large camera view
    const toggleLargeCameraView = () => {
        setShowLargeCameraView(!showLargeCameraView);
        announceToScreenReader(showLargeCameraView ? "Exited large camera view" : "Entered large camera view");
    };

    // NEW: Render LargeCameraView if active
    if (showLargeCameraView) {
        return (
            <LargeCameraView
                isFullscreen={showLargeCameraView}
                onToggleFullscreen={toggleLargeCameraView}
                currentGesture={currentGesture?.letter || ''}
                confidence={currentGesture?.confidence || 0}
                wordSequence={sequenceStatus.length > 0 ?
                    Array.from({length: sequenceStatus.length}, (_, i) => currentGesture?.letter || '') :
                    currentWord.split('')
                }
                currentWord={currentWordResult?.word || currentWord}
                mode={recognitionMode}
            />
        );
    }

    return (
        <div className="w-full max-w-full space-y-6">
            {/* Live region for screen reader announcements */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {announceMessage}
            </div>

            {/* Recognition Mode Selector */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="font-bold text-purple-900 mb-3 text-lg flex items-center gap-2">
                    <span role="img" aria-label="Recognition mode">🎯</span>
                    Recognition Mode
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['letter', 'word', 'hybrid'] as RecognitionMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => handleModeSwitch(mode)}
                            className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-4 ${
                                recognitionMode === mode
                                    ? 'bg-purple-600 text-white focus:ring-purple-300'
                                    : 'bg-white border-2 border-purple-200 text-purple-700 hover:bg-purple-50 focus:ring-purple-200'
                            }`}
                            aria-pressed={recognitionMode === mode}
                        >
                            <div className="text-center">
                                <div className="text-lg mb-1">
                                    {mode === 'letter' ? '🔤' : mode === 'word' ? '💬' : '🔄'}
                                </div>
                                <div className="capitalize">{mode}</div>
                                <div className="text-xs mt-1 opacity-75">
                                    {mode === 'letter' ? 'Spell words letter by letter' :
                                        mode === 'word' ? 'Recognize complete ASL words' :
                                            'Both letter and word recognition'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main video container */}
            <div className="mb-6">
                <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full max-w-full h-102">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
                            <div className="text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <div className="text-gray-700 font-medium">Loading camera...</div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-20">
                            <div className="text-center p-6">
                                <div className="text-4xl mb-4">⚠️</div>
                                <p className="text-red-700 font-medium mb-4">{error}</p>
                                <button
                                    onClick={startCamera}
                                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
                                >
                                    🔄 Try Again
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Video element */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isDetectionActive ? 'hidden' : ''}`}
                        style={{ transform: 'scaleX(-1)' }}
                        aria-label="Live camera feed for sign language recognition"
                    />

                    {/* Canvas for hand detection overlay */}
                    <canvas
                        ref={canvasRef}
                        width={640}
                        height={480}
                        className={`ml-0.5 w-full h-full object-cover ${!isDetectionActive ? 'hidden' : ''}`}
                        style={{ transform: 'scaleX(-1)' }}
                        aria-label="Hand detection visualization"
                    />

                    {/* Status overlay */}
                    <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-2 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full ${
                                isDetectionActive ? 'bg-red-500 animate-pulse' :
                                    hasPermission ? 'bg-green-500' : 'bg-gray-500'
                            }`} />
                            <span className="font-medium capitalize">
                                {recognitionMode} Mode
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Gesture Display */}
            {isDetectionActive && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center gap-2">
                        <span role="img" aria-label="Current gesture">👋</span>
                        Current Gesture Detection
                    </h3>

                    {currentGesture ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Letter Recognition */}
                            <div className="bg-white rounded-lg p-4 border border-blue-200">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-blue-900 mb-2">
                                        {currentGesture.letter}
                                    </div>
                                    <div className="text-sm text-blue-700">
                                        Confidence: {(currentGesture.confidence * 100).toFixed(1)}%
                                    </div>
                                    <div className={`text-xs mt-1 px-2 py-1 rounded ${
                                        currentGesture.quality === 'excellent' ? 'bg-green-100 text-green-800' :
                                            currentGesture.quality === 'good' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                    }`}>
                                        {currentGesture.quality.toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            {/* Word Recognition Status */}
                            {(recognitionMode === 'word' || recognitionMode === 'hybrid') && (
                                <div className="bg-white rounded-lg p-4 border border-purple-200">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-purple-900 mb-2">
                                            {currentWordResult ? currentWordResult.word : 'Analyzing...'}
                                        </div>
                                        {currentWordResult && (
                                            <>
                                                <div className="text-sm text-purple-700">
                                                    {(currentWordResult.confidence * 100).toFixed(1)}% confidence
                                                </div>
                                                <div className="text-xs text-purple-600 mt-1">
                                                    {currentWordResult.category}
                                                </div>
                                            </>
                                        )}
                                        <div className="text-xs text-gray-600 mt-2">
                                            Sequence: {sequenceStatus.length} gestures
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-2">
                                {(recognitionMode === 'letter' || recognitionMode === 'hybrid') && (
                                    <button
                                        onClick={handleCaptureLetter}
                                        disabled={!currentGesture.letter || currentGesture.letter === '?' || currentGesture.confidence < 0.6}
                                        className={`w-full px-3 py-2 rounded-lg font-semibold text-sm ${
                                            currentGesture.letter && currentGesture.letter !== '?' && currentGesture.confidence >= 0.6
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        📝 Capture Letter
                                    </button>
                                )}

                                {(recognitionMode === 'word' || recognitionMode === 'hybrid') && (
                                    <button
                                        onClick={recognizeCurrentSequence}
                                        disabled={sequenceStatus.length === 0}
                                        className={`w-full px-3 py-2 rounded-lg font-semibold text-sm ${
                                            sequenceStatus.length > 0
                                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        💬 Recognize Word
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="text-4xl mb-2">🤲</div>
                            <div className="text-gray-600">Position your hands in view and start signing</div>
                        </div>
                    )}
                </div>
            )}

            {/* Word Suggestions Panel */}
            {(recognitionMode === 'word' || recognitionMode === 'hybrid') && wordSuggestions.length > 0 && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                    <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                        <span role="img" aria-label="Word suggestions">💡</span>
                        Word Suggestions
                    </h3>

                    <div className="flex flex-wrap gap-2">
                        {wordSuggestions.map((word, index) => (
                            <button
                                key={`${word}-${index}`}
                                onClick={() => selectWordSuggestion(word)}
                                className="px-3 py-2 bg-purple-100 border border-purple-300 text-purple-800 rounded-lg hover:bg-purple-200 font-medium text-sm transition-colors"
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Letter Formation (Letter Mode) */}
            {(recognitionMode === 'letter' || recognitionMode === 'hybrid') && isDetectionActive && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-green-900 text-lg flex items-center gap-2">
                            <span role="img" aria-label="Word formation">📝</span>
                            Letter-by-Letter Formation
                        </h3>
                        {hasAutoTranslateTimer && (
                            <div className="text-xs text-blue-700 flex items-center bg-blue-100 px-2 py-1 rounded">
                                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                                Auto-translating...
                            </div>
                        )}
                    </div>

                    <div className="text-xl font-mono bg-white border-2 rounded-lg p-3 mb-3 min-h-12 flex items-center">
                        {currentWord || <span className="text-gray-400">Letters will appear here...</span>}
                    </div>

                    {predictions.length > 0 && (
                        <div className="mb-3">
                            <div className="text-xs font-medium text-gray-700 mb-1">Word Predictions:</div>
                            <div className="flex flex-wrap gap-1">
                                {predictions.map((prediction, index) => (
                                    <button
                                        key={prediction}
                                        onClick={() => selectPrediction(prediction)}
                                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                                    >
                                        {prediction}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setCurrentWord(currentWord.slice(0, -1))}
                            disabled={!currentWord}
                            className={`px-3 py-2 rounded-lg font-medium text-sm ${
                                currentWord ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-gray-300 text-gray-500'
                            }`}
                        >
                            🗑️ Delete
                        </button>

                        <button
                            onClick={() => setCurrentWord('')}
                            disabled={!currentWord}
                            className={`px-3 py-2 rounded-lg font-medium text-sm ${
                                currentWord ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-300 text-gray-500'
                            }`}
                        >
                            📄 Clear
                        </button>

                        <button
                            onClick={submitWord}
                            disabled={!currentWord || isTranslating}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm ${
                                currentWord && !isTranslating
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-gray-300 text-gray-500'
                            }`}
                        >
                            {isTranslating ? '⏳ Translating...' : '✨ Translate'}
                        </button>
                    </div>
                </div>
            )}

            {/* Word Categories Quick Access */}
            {(recognitionMode === 'word' || recognitionMode === 'hybrid') && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                    <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                        Quick Word Categories
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {wordCategories.map((category) => (
                            <div key={category} className="text-center">
                                <div className="text-sm font-medium text-orange-800 capitalize mb-1">
                                    {category}
                                </div>
                                <div className="text-xs text-orange-600">
                                    {getWordsByCategory(category).length} words
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Control Buttons */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span role="img" aria-label="Controls">🎛️</span>
                    Camera Controls
                </h3>

                <div className="flex flex-wrap gap-3 justify-center">
                    <button
                        onClick={startCamera}
                        disabled={hasPermission}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold min-w-32 justify-center ${
                            hasPermission ? 'bg-gray-300 text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                    >
                        📹 Start Camera
                    </button>

                    <button
                        onClick={startDetection}
                        disabled={!hasPermission || isDetectionActive}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold min-w-32 justify-center ${
                            !hasPermission || isDetectionActive ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        🔍 Start Detection
                    </button>

                    <button
                        onClick={() => {
                            if (videoRef.current && videoRef.current.srcObject) {
                                const stream = videoRef.current.srcObject as MediaStream;
                                stream.getTracks().forEach(track => track.stop());
                                videoRef.current.srcObject = null;
                                setHasPermission(false);
                                setIsDetectionActive(false);
                                stopWordRecognition();
                            }
                        }}
                        disabled={!hasPermission}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold min-w-32 justify-center ${
                            !hasPermission ? 'bg-gray-300 text-gray-500' : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    >
                        ⏹️ Stop Camera
                    </button>
                </div>
            </div>
        </div>
    );
}
