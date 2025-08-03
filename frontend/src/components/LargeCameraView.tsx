// frontend/src/components/LargeCameraView.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {useTranslation} from "@/context/TranslationContext";

interface LargeCameraViewProps {
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    currentGesture: string;
    confidence: number;
    wordSequence: string[];
    currentWord: string;
    mode: 'letter' | 'word' | 'hybrid';
}

export const LargeCameraView: React.FC<LargeCameraViewProps> = ({
                                                                    isFullscreen,
                                                                    onToggleFullscreen,
                                                                    currentGesture,
                                                                    confidence,
                                                                    wordSequence,
                                                                    currentWord,
                                                                    mode
                                                                }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [gestureHistory, setGestureHistory] = useState<string[]>([]);

    const { addTranslation } = useTranslation();

    // Initialize camera
    const initializeCamera = useCallback(async () => {
        try {
            setIsLoading(true);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setStream(mediaStream);
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Error accessing camera:', error);
            setIsLoading(false);
        }
    }, []);

    // Clean up camera
    const cleanupCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }, [stream]);

    // Initialize camera on mount
    useEffect(() => {
        initializeCamera();
        return cleanupCamera;
    }, [initializeCamera, cleanupCamera]);

    // Update gesture history
    useEffect(() => {
        if (currentGesture && currentGesture !== gestureHistory[gestureHistory.length - 1]) {
            setGestureHistory(prev => [...prev.slice(-4), currentGesture]);
        }
    }, [currentGesture, gestureHistory]);

    // Handle escape key for fullscreen exit
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen) {
                onToggleFullscreen();
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'auto';
        };
    }, [isFullscreen, onToggleFullscreen]);

    const getModeDisplay = () => {
        switch (mode) {
            case 'letter': return '🔤 Letter Recognition';
            case 'word': return '💬 Word Recognition';
            case 'hybrid': return '🔄 Hybrid Mode';
            default: return '🤖 Recognition Mode';
        }
    };

    const getConfidenceColor = () => {
        if (confidence >= 0.8) return '#10b981';
        if (confidence >= 0.6) return '#f59e0b';
        return '#ef4444';
    };

    const containerClass = isFullscreen ? 'camera-container-large' : 'camera-container-windowed';
    const videoClass = isFullscreen ? 'camera-video-large' : 'camera-video-windowed';

    return (
        <div className={containerClass}>
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
                    <div className="text-white text-center">
                        <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-lg">Initializing Camera...</p>
                    </div>
                </div>
            )}

            {/* Video Element */}
            <video
                ref={videoRef}
                className={videoClass}
                autoPlay
                playsInline
                muted
                onLoadedData={() => setIsLoading(false)}
            />

            {/* Hand Landmarks Canvas */}
            <canvas
                ref={canvasRef}
                className="hand-landmarks"
                style={{
                    width: '100%',
                    height: isFullscreen ? 'calc(100vh - 120px)' : '100%'
                }}
            />

            {/* Camera Overlay */}
            <div className="camera-overlay">
                {/* Top Bar */}
                <div className="camera-top-bar">
                    <div className="mode-badge">
                        {getModeDisplay()}
                    </div>

                    <div className="flex gap-3">
                        {!isFullscreen && (
                            <button
                                onClick={onToggleFullscreen}
                                className="exit-fullscreen"
                                title="Enter Fullscreen"
                            >
                                ⛶
                            </button>
                        )}
                        {isFullscreen && (
                            <button
                                onClick={onToggleFullscreen}
                                className="exit-fullscreen"
                                title="Exit Fullscreen (ESC)"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Gesture Indicators */}
                <div className="gesture-indicators">
                    {gestureHistory.map((gesture, index) => (
                        <div
                            key={index}
                            className={`gesture-dot ${index === gestureHistory.length - 1 ? 'active' : ''}`}
                            title={gesture}
                        />
                    ))}
                </div>

                {/* Word Formation Display */}
                {mode !== 'letter' && (
                    <div className="word-formation">
                        <h4>Word Formation</h4>
                        <div className="word-letters">
                            {wordSequence.map((letter, index) => (
                                <span key={index} className="letter-pill">
                                    {letter}
                                </span>
                            ))}
                        </div>
                        {currentWord && (
                            <p className="current-word">{currentWord}</p>
                        )}
                    </div>
                )}

                {/* Bottom Detection Panel */}
                <div className="detection-panel-large">
                    <div className="detection-content">
                        {/* Current Gesture */}
                        <div className="detection-card">
                            <h3>👋 Current Gesture</h3>
                            <div className="value">
                                {currentGesture || 'None'}
                            </div>
                            <div className="confidence-bar">
                                <div
                                    className="confidence-fill"
                                    style={{
                                        width: `${confidence * 100}%`,
                                        background: getConfidenceColor()
                                    }}
                                />
                            </div>
                            <p className="description">
                                Confidence: {(confidence * 100).toFixed(1)}%
                            </p>
                        </div>

                        {/* Word Progress */}
                        <div className="detection-card">
                            <h3>📝 {mode === 'letter' ? 'Letters' : 'Words'}</h3>
                            <div className="value">
                                {mode === 'letter'
                                    ? wordSequence.join('')
                                    : currentWord || 'Building...'
                                }
                            </div>
                            <p className="description">
                                {mode === 'letter'
                                    ? `${wordSequence.length} letters detected`
                                    : `Sequence: ${wordSequence.length} gestures`
                                }
                            </p>
                        </div>

                        {/* Performance Stats */}
                        <div className="detection-card">
                            <h3>📊 Performance</h3>
                            <div className="value">
                                {stream?.getVideoTracks()[0]?.getSettings()?.frameRate || 30} FPS
                            </div>
                            <p className="description">
                                {stream?.getVideoTracks()[0]?.getSettings()?.width}x
                                {stream?.getVideoTracks()[0]?.getSettings()?.height} resolution
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Screen Reader Support */}
            <div className="sr-only" aria-live="polite">
                {currentGesture && `Current gesture: ${currentGesture}`}
                {currentWord && `, Current word: ${currentWord}`}
            </div>
        </div>
    );
};

export default LargeCameraView;
