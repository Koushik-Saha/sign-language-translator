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
    const [announceMessage, setAnnounceMessage] = useState('');

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
            addLetter(currentGesture.letter, currentGesture.confidence);
            announceToScreenReader(`Letter ${currentGesture.letter} captured`);
        }
    };

    const handleRemoveLetter = () => {
        if (currentWord) {
            setCurrentWord(currentWord.slice(0, -1));
            announceToScreenReader("Last letter removed");
        }
    };

    const handleClearWord = () => {
        if (currentWord) {
            setCurrentWord('');
            announceToScreenReader("All letters cleared");
        }
    };

    const handleSubmitWord = async () => {
        if (!currentWord.trim() || isTranslating) return;

        setIsTranslating(true);
        announceToScreenReader(`Translating word: ${currentWord}`);

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

            addTranslation({
                original: result.original,
                translation: result.translation,
                confidence: result.confidence || 0.8,
                type: 'sign_to_text'
            });

            announceToScreenReader(`Translation complete: ${result.translation}`);

        } catch (error) {
            console.error('Error submitting word:', error);
            setError('Failed to translate word. Please try again.');
            announceToScreenReader("Translation failed. Please try again.");
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
            announceToScreenReader("Camera stopped");
        }
    };

    // Don't render until mounted (prevents hydration errors)
    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-xl" role="status" aria-label="Initializing camera system">
                <div className="text-gray-500 font-medium">Initializing camera system...</div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full">
            {/* Live region for screen reader announcements */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {announceMessage}
            </div>

            {/* Main video container */}
            <div className="mb-6">
                <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full max-w-full h-102">
                    {isLoading && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20"
                            role="status"
                            aria-label="Loading camera"
                        >
                            <div className="text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <div className="text-gray-700 font-medium">Loading camera...</div>
                                <div className="text-sm text-gray-500 mt-2">Allow camera permissions when prompted</div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-red-50 z-20"
                            role="alert"
                            aria-label="Camera error"
                        >
                            <div className="text-center p-6">
                                <div className="text-4xl mb-4" role="img" aria-label="Error">⚠️</div>
                                <p className="text-red-700 font-medium mb-4 max-w-md">{error}</p>
                                <button
                                    onClick={startCamera}
                                    className="bg-red-600 hover:bg-red-700 focus:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-red-200"
                                    aria-describedby="retry-desc"
                                >
                                    🔄 Try Again
                                </button>
                                <div id="retry-desc" className="sr-only">
                                    Attempt to restart the camera and request permissions again
                                </div>
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
                        aria-describedby="video-instructions"
                    />

                    {/* Canvas for hand detection overlay */}
                    <canvas
                        ref={canvasRef}
                        width={640}
                        height={480}
                        className={`ml-0.5 w-full h-full object-cover ${!isDetectionActive ? 'hidden' : ''}`}
                        style={{ transform: 'scaleX(-1)' }}
                        aria-label="Hand detection visualization"
                        aria-describedby="canvas-instructions"
                    />

                    {/* Video overlay with status */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                        <div className="flex justify-between items-center text-white text-sm">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-3 h-3 rounded-full ${
                                        isDetectionActive ? 'bg-red-500 animate-pulse' :
                                            hasPermission ? 'bg-green-500' : 'bg-gray-500'
                                    }`}
                                    role="img"
                                    aria-label={
                                        isDetectionActive ? "Detection active" :
                                            hasPermission ? "Camera ready" : "Camera inactive"
                                    }
                                />
                                <span className="font-medium">
                                    {isDetectionActive ? 'Detecting' : hasPermission ? 'Ready' : 'Inactive'}
                                </span>
                            </div>

                            {/* Confidence indicator */}
                            {currentGesture && (
                                <div className="flex items-center gap-2">
                                    <span>Confidence:</span>
                                    <div
                                        className="w-16 h-2 bg-white/30 rounded-full overflow-hidden"
                                        role="progressbar"
                                        aria-valuenow={Math.round(currentGesture.confidence * 100)}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label={`Recognition confidence ${Math.round(currentGesture.confidence * 100)}%`}
                                    >
                                        <div
                                            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
                                            style={{ width: `${currentGesture.confidence * 100}%` }}
                                        />
                                    </div>
                                    <span className="font-bold">
                                        {Math.round(currentGesture.confidence * 100)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hidden instructions for screen readers */}
                <div id="video-instructions" className="sr-only">
                    Position yourself clearly in the camera view with good lighting.
                    Keep your hands visible and sign at a moderate pace for best recognition results.
                </div>
                <div id="canvas-instructions" className="sr-only">
                    Hand detection overlay showing recognized gestures and hand landmarks in real-time.
                </div>
            </div>

            {/* Current Gesture Display */}
            {isDetectionActive && (
                <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center gap-2">
                        <span role="img" aria-label="Current gesture">👋</span>
                        Current Gesture
                    </h3>
                    {currentGesture ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold text-blue-900 bg-white rounded-lg px-3 py-2 border border-blue-300">
                                    Letter: {currentGesture.letter}
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-bold ${
                                    currentGesture.quality === 'excellent' ? 'bg-green-100 text-green-800' :
                                        currentGesture.quality === 'good' ? 'bg-yellow-100 text-yellow-800' :
                                            currentGesture.quality === 'fair' ? 'bg-orange-100 text-orange-800' :
                                                'bg-red-100 text-red-800'
                                }`}>
                                    {currentGesture.quality.toUpperCase()}
                                </div>
                            </div>

                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <div className="text-sm font-medium text-blue-700 mb-1">
                                    Confidence: {(currentGesture.confidence * 100).toFixed(1)}%
                                </div>
                                <div className="text-sm text-blue-600">
                                    {currentGesture.description}
                                </div>
                            </div>

                            <button
                                onClick={handleCaptureLetter}
                                disabled={!currentGesture.letter || currentGesture.letter === '?' || currentGesture.confidence < 0.6}
                                className={`w-full px-4 py-3 rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-4 ${
                                    currentGesture.letter && currentGesture.letter !== '?' && currentGesture.confidence >= 0.6
                                        ? 'bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 text-white focus:ring-blue-300'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                                aria-describedby="capture-letter-desc"
                            >
                                <span className="mr-2" role="img" aria-label="Capture">📝</span>
                                {currentGesture.confidence >= 0.6 ? 'Capture Letter' : 'Improve Gesture Quality'}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="text-4xl mb-2" role="img" aria-label="Waiting">🤲</div>
                            <div className="text-gray-600">Position your hands in view and start signing</div>
                        </div>
                    )}
                </div>
            )}

            {/* Word Formation Display */}
            {isDetectionActive && (
                <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-green-900 text-lg flex items-center gap-2">
                            <span role="img" aria-label="Word formation">📝</span>
                            Current Word
                        </h3>
                        {hasAutoTranslateTimer && (
                            <div className="text-xs text-blue-700 flex items-center bg-blue-100 px-2 py-1 rounded border border-blue-300">
                                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                                Auto-translating...
                            </div>
                        )}
                    </div>

                    <div
                        className={`text-xl font-mono bg-white border-2 rounded-lg p-3 mb-3 min-h-12 flex items-center transition-all duration-200 ${
                            wordStatus.status === 'complete' ? 'border-green-500 bg-green-50' :
                                wordStatus.status === 'likely' ? 'border-yellow-500 bg-yellow-50' :
                                    'border-gray-300'
                        }`}
                        aria-live="polite"
                        aria-label="Current word being formed"
                    >
                        {currentWord || <span className="text-gray-400">Letters will appear here...</span>}
                    </div>

                    {/* Word Status */}
                    {currentWord && (
                        <div className="mb-3" role="status" aria-live="polite">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                wordStatus.status === 'complete' ? 'bg-green-100 text-green-800' :
                                    wordStatus.status === 'likely' ? 'bg-yellow-100 text-yellow-800' :
                                        wordStatus.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-700'
                            }`}>
                                <span role="img">
                                    {wordStatus.status === 'complete' ? '✅' :
                                        wordStatus.status === 'likely' ? '🎯' :
                                            wordStatus.status === 'partial' ? '🔤' : '❓'}
                                </span>
                                {wordStatus.status === 'complete' ? 'Complete' :
                                    wordStatus.status === 'likely' ? 'Likely' :
                                        wordStatus.status === 'partial' ? 'Partial' : 'Unknown'}
                                {' '}({(wordStatus.confidence * 100).toFixed(0)}%)
                            </span>
                        </div>
                    )}

                    {/* Predictions */}
                    {predictions.length > 0 && (
                        <div className="mb-3">
                            <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <span role="img" aria-label="Suggestions">💡</span>
                                Suggestions:
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {predictions.map((prediction, index) => (
                                    <button
                                        key={prediction}
                                        onClick={() => {
                                            selectPrediction(prediction);
                                            announceToScreenReader(`Selected prediction: ${prediction}`);
                                        }}
                                        className="px-2 py-1 text-xs bg-blue-100 border border-blue-300 text-blue-800 rounded hover:bg-blue-200 focus:bg-blue-200 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    >
                                        {prediction}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Letters */}
                    {nextLetterSuggestions.length > 0 && (
                        <div className="mb-4">
                            <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <span role="img" aria-label="Next letters">🔤</span>
                                Next letters:
                            </div>
                            <div className="flex gap-1 flex-wrap">
                                {nextLetterSuggestions.map((letter) => (
                                    <span
                                        key={letter}
                                        className="px-1 py-0.5 text-xs bg-gray-100 border border-gray-300 text-gray-700 rounded font-mono"
                                    >
                                        {letter}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Control buttons */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleRemoveLetter}
                            disabled={!currentWord}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-4 ${
                                currentWord
                                    ? 'bg-yellow-500 hover:bg-yellow-600 focus:bg-yellow-600 text-white focus:ring-yellow-300'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <span role="img" aria-label="Delete">🗑️</span>
                            Delete
                        </button>

                        <button
                            onClick={handleClearWord}
                            disabled={!currentWord}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-4 ${
                                currentWord
                                    ? 'bg-red-500 hover:bg-red-600 focus:bg-red-600 text-white focus:ring-red-300'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <span role="img" aria-label="Clear">📄</span>
                            Clear
                        </button>

                        <button
                            onClick={handleSubmitWord}
                            disabled={!currentWord || isTranslating}
                            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-4 flex-1 justify-center ${
                                currentWord && !isTranslating
                                    ? 'bg-green-600 hover:bg-green-700 focus:bg-green-700 text-white focus:ring-green-300'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <span role="img" aria-label="Translate">
                                {isTranslating ? '⏳' : '✨'}
                            </span>
                            {isTranslating ? 'Translating...' : 'Translate'}
                        </button>
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
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-4 min-w-32 justify-center ${
                            hasPermission
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 focus:bg-green-700 text-white focus:ring-green-300'
                        }`}
                    >
                        <span role="img" aria-label="Start camera">📹</span>
                        Start Camera
                    </button>

                    <button
                        onClick={startDetection}
                        disabled={!hasPermission || isDetectionActive}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-4 min-w-32 justify-center ${
                            !hasPermission || isDetectionActive
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 text-white focus:ring-blue-300'
                        }`}
                    >
                        <span role="img" aria-label="Start detection">🔍</span>
                        Start Detection
                    </button>

                    <button
                        onClick={stopCamera}
                        disabled={!hasPermission}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-4 min-w-32 justify-center ${
                            !hasPermission
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 focus:bg-red-700 text-white focus:ring-red-300'
                        }`}
                    >
                        <span role="img" aria-label="Stop camera">⏹️</span>
                        Stop Camera
                    </button>
                </div>
            </div>

            {/* System Status */}
            {hasPermission && (
                <div className="mt-4 flex items-center justify-center gap-4 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true"></div>
                        <span className="text-green-700 font-medium">Camera Ready</span>
                    </div>
                    {isDetectionActive && (
                        <>
                            <div className="w-px h-3 bg-green-300" aria-hidden="true"></div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true"></div>
                                <span className="text-green-700 font-medium">Hand Detection Active</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Styles for this component */}
            <style jsx>{`
                .sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }
                
                @media (prefers-reduced-motion: reduce) {
                    .animate-pulse, .animate-spin {
                        animation: none !important;
                    }
                    .transition-all {
                        transition: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
