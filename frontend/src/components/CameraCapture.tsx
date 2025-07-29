'use client';

import { useRef, useEffect, useState } from 'react';
import { useHandDetection } from '@/hooks/useHandDetection';
import { useTranslation } from '@/context/TranslationContext';
import { useEnhancedWordFormation } from '@/hooks/useEnhancedWordFormation';


export default function CameraCapture() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isDetectionActive, setIsDetectionActive] = useState(false);

    const { initializeHandDetection, currentGesture } = useHandDetection();
    const {
        currentWord,
        setCurrentWord,
        addTranslation,
        isTranslating,
        setIsTranslating
    } = useTranslation();

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

    // Fix hydration by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            startCamera();
        }
    }, [mounted]);

    const startCamera = async () => {
        try {
            setIsLoading(true);
            setError(null);

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
                };
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Unable to access camera. Please ensure you have given permission.');
            setIsLoading(false);
        }
    };

    const startDetection = async () => {
        if (videoRef.current && canvasRef.current && !isDetectionActive) {
            try {
                setError(null);
                await initializeHandDetection(videoRef.current, canvasRef.current);
                setIsDetectionActive(true);
            } catch (err) {
                console.error('Error starting detection:', err);
                setError('Failed to start hand detection. Please try again.');
            }
        }
    };

    // Update the handleCaptureLetter function:
    const handleCaptureLetter = () => {
        if (currentGesture && currentGesture.letter && currentGesture.letter !== '?') {
            addLetter(currentGesture.letter, currentGesture.confidence);
        }
    };

    const handleRemoveLetter = () => {
        setCurrentWord(currentWord.slice(0, -1));
    };

    const handleClearWord = () => {
        setCurrentWord('');
    };

    const handleSubmitWord = async () => {
        if (!currentWord.trim() || isTranslating) return;

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

        } catch (error) {
            console.error('Error submitting word:', error);
            setError('Failed to translate word. Please try again.');
        } finally {
            setIsTranslating(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setHasPermission(false);
            setIsDetectionActive(false);
        }
    };

    // Don't render until mounted (prevents hydration errors)
    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-500">Initializing...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center space-y-4 p-4">
            <h2 className="text-2xl font-bold text-gray-800">Sign Language Camera</h2>

            <div className="relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg z-10">
                        <div className="text-gray-600">Loading camera...</div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100 rounded-lg z-10">
                        <div className="text-red-600 text-center p-4">
                            <p>{error}</p>
                            <button
                                onClick={startCamera}
                                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Video element (hidden when detection is active) */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`rounded-lg border-2 border-gray-300 ${isDetectionActive ? 'hidden' : ''}`}
                    style={{ width: '640px', height: '480px', transform: 'scaleX(-1)' }}
                />

                {/* Canvas for hand detection overlay */}
                <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className={`rounded-lg border-2 border-gray-300 ${!isDetectionActive ? 'hidden' : ''}`}
                    style={{ transform: 'scaleX(-1)' }}
                />
            </div>

            {/* Current Gesture Display - Enhanced */}
            {isDetectionActive && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full max-w-md">
                    <h3 className="font-semibold text-blue-800 mb-2">Current Gesture</h3>
                    {currentGesture ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold text-blue-900">
                                    Letter: {currentGesture.letter}
                                </div>
                                {/* Quality indicator */}
                                <div className={`px-2 py-1 rounded text-xs font-medium ${
                                    currentGesture.quality === 'excellent' ? 'bg-green-100 text-green-800' :
                                        currentGesture.quality === 'good' ? 'bg-yellow-100 text-yellow-800' :
                                            currentGesture.quality === 'fair' ? 'bg-orange-100 text-orange-800' :
                                                'bg-red-100 text-red-800'
                                }`}>
                                    {currentGesture.quality.toUpperCase()}
                                </div>
                            </div>
                            <div className="text-sm text-blue-700">
                                Confidence: {(currentGesture.confidence * 100).toFixed(1)}%
                            </div>
                            <div className="text-sm text-blue-600">
                                {currentGesture.description}
                            </div>

                            {/* Enhanced Capture Letter Button */}
                            <button
                                onClick={handleCaptureLetter}
                                disabled={!currentGesture.letter || currentGesture.letter === '?' || currentGesture.confidence < 0.6}
                                className={`w-full mt-2 px-4 py-2 rounded font-medium ${
                                    currentGesture.letter && currentGesture.letter !== '?' && currentGesture.confidence >= 0.6
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {currentGesture.confidence >= 0.6 ? 'Capture Letter' : 'Improve Gesture Quality'}
                            </button>
                        </div>
                    ) : (
                        <div className="text-gray-500">No gesture detected</div>
                    )}
                </div>
            )}

            {/* Enhanced Word Formation Display */}
            {isDetectionActive && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-full max-w-md">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-green-800">Current Word</h3>
                        {hasAutoTranslateTimer && (
                            <div className="text-xs text-blue-600 flex items-center">
                                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                                Auto-translating...
                            </div>
                        )}
                    </div>

                    <div className={`text-2xl font-mono bg-white border rounded p-2 min-h-[50px] flex items-center ${
                        wordStatus.status === 'complete' ? 'border-green-500 bg-green-50' :
                            wordStatus.status === 'likely' ? 'border-yellow-500 bg-yellow-50' :
                                'border-gray-300'
                    }`}>
                        {currentWord || <span className="text-gray-400">Letters will appear here...</span>}
                    </div>

                    {/* Word Status Indicator */}
                    {currentWord && (
                        <div className="mt-2 text-sm">
        <span className={`px-2 py-1 rounded text-xs ${
            wordStatus.status === 'complete' ? 'bg-green-100 text-green-800' :
                wordStatus.status === 'likely' ? 'bg-yellow-100 text-yellow-800' :
                    wordStatus.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
        }`}>
          {wordStatus.status === 'complete' ? '✅ Complete Word' :
              wordStatus.status === 'likely' ? '🎯 Likely Word' :
                  wordStatus.status === 'partial' ? '🔤 Partial Word' :
                      '❓ Unknown Word'}
            ({(wordStatus.confidence * 100).toFixed(0)}%)
        </span>
                        </div>
                    )}

                    {/* Word Predictions */}
                    {predictions.length > 0 && (
                        <div className="mt-3">
                            <div className="text-xs text-gray-600 mb-1">Suggestions:</div>
                            <div className="flex flex-wrap gap-1">
                                {predictions.map((prediction, index) => (
                                    <button
                                        key={prediction}
                                        onClick={() => selectPrediction(prediction)}
                                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                    >
                                        {prediction}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Letter Suggestions */}
                    {nextLetterSuggestions.length > 0 && (
                        <div className="mt-2">
                            <div className="text-xs text-gray-600 mb-1">Next letters:</div>
                            <div className="flex gap-1">
                                {nextLetterSuggestions.map((letter) => (
                                    <span
                                        key={letter}
                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                                    >
              {letter}
            </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex space-x-2 mt-3">
                        <button
                            onClick={removeLetter}
                            disabled={!currentWord}
                            className={`px-3 py-1 rounded text-sm ${
                                currentWord
                                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Delete
                        </button>

                        <button
                            onClick={clearWord}
                            disabled={!currentWord}
                            className={`px-3 py-1 rounded text-sm ${
                                currentWord
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Clear
                        </button>

                        <button
                            onClick={submitWord}
                            disabled={!currentWord || isTranslating}
                            className={`flex-1 px-3 py-1 rounded text-sm ${
                                currentWord && !isTranslating
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {isTranslating ? 'Translating...' : 'Translate Word'}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex space-x-4">
                <button
                    onClick={startCamera}
                    disabled={hasPermission}
                    className={`px-6 py-2 rounded-lg font-medium ${
                        hasPermission
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                >
                    Start Camera
                </button>

                <button
                    onClick={startDetection}
                    disabled={!hasPermission || isDetectionActive}
                    className={`px-6 py-2 rounded-lg font-medium ${
                        !hasPermission || isDetectionActive
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                >
                    Start Detection
                </button>

                <button
                    onClick={stopCamera}
                    disabled={!hasPermission}
                    className={`px-6 py-2 rounded-lg font-medium ${
                        !hasPermission
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                >
                    Stop Camera
                </button>
            </div>

            {hasPermission && (
                <p className="text-green-600 text-sm">
                    ✅ Camera ready {isDetectionActive && '• Hand detection active'}
                </p>
            )}
        </div>
    );
}
