// frontend/src/components/LargeCameraView.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from "@/context/TranslationContext";

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
    const [error, setError] = useState<string | null>(null);

    const { addTranslation } = useTranslation();

    // Initialize camera with high resolution
    const initializeCamera = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: isFullscreen ? 1920 : 1280 },
                    height: { ideal: isFullscreen ? 1080 : 720 },
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
            setError('Failed to access camera. Please check permissions.');
            setIsLoading(false);
        }
    }, [isFullscreen]);

    // Clean up camera
    const cleanupCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }, [stream]);

    // Initialize camera on mount and fullscreen changes
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

    return (
        <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'w-full h-full'}`}>
            <CameraDisplay
                videoRef={videoRef}
                canvasRef={canvasRef}
                isLoading={isLoading}
                error={error}
                isFullscreen={isFullscreen}
                onRetry={initializeCamera}
            />

            <CameraOverlay
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
                mode={mode}
                gestureHistory={gestureHistory}
                currentGesture={currentGesture}
                confidence={confidence}
                currentWord={currentWord}
                wordSequence={wordSequence}
                stream={stream}
            />
        </div>
    );
};

// Camera Display Component
interface CameraDisplayProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    isLoading: boolean;
    error: string | null;
    isFullscreen: boolean;
    onRetry: () => void;
}

const CameraDisplay: React.FC<CameraDisplayProps> = ({
                                                         videoRef,
                                                         canvasRef,
                                                         isLoading,
                                                         error,
                                                         isFullscreen,
                                                         onRetry
                                                     }) => {
    if (isLoading) {
        return (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
                <div className="text-white text-center">
                    <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-6"></div>
                    <p className="text-2xl font-semibold">Initializing Camera...</p>
                    <p className="text-lg text-gray-300 mt-2">Setting up high-resolution capture</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="absolute inset-0 bg-red-900 flex items-center justify-center z-50">
                <div className="text-white text-center max-w-md p-8">
                    <div className="text-6xl mb-6">⚠️</div>
                    <p className="text-xl font-semibold mb-4">{error}</p>
                    <button
                        onClick={onRetry}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
                    >
                        🔄 Retry Camera Access
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Main Video Element */}
            <video
                ref={videoRef}
                className={`w-full ${isFullscreen ? 'h-screen' : 'h-[600px]'} object-cover transform scale-x-[-1] bg-black`}
                autoPlay
                playsInline
                muted
                onLoadedData={() => console.log('Video loaded')}
            />

            {/* Hand Landmarks Canvas Overlay */}
            <canvas
                ref={canvasRef}
                className={`absolute top-0 left-0 w-full ${isFullscreen ? 'h-screen' : 'h-[600px]'} pointer-events-none transform scale-x-[-1]`}
                style={{ zIndex: 10 }}
            />
        </>
    );
};

// Camera Overlay Component
interface CameraOverlayProps {
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    mode: string;
    gestureHistory: string[];
    currentGesture: string;
    confidence: number;
    currentWord: string;
    wordSequence: string[];
    stream: MediaStream | null;
}

const CameraOverlay: React.FC<CameraOverlayProps> = ({
                                                         isFullscreen,
                                                         onToggleFullscreen,
                                                         mode,
                                                         gestureHistory,
                                                         currentGesture,
                                                         confidence,
                                                         currentWord,
                                                         wordSequence,
                                                         stream
                                                     }) => {
    const getModeDisplay = () => {
        switch (mode) {
            case 'letter': return '🔤 Letter Recognition';
            case 'word': return '💬 Word Recognition';
            case 'hybrid': return '🔄 Hybrid Mode';
            default: return '🤖 Recognition Mode';
        }
    };

    const getConfidenceColor = () => {
        if (confidence >= 0.8) return 'bg-green-500';
        if (confidence >= 0.6) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
            {/* Top Control Bar */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6">
                <div className="flex justify-between items-center pointer-events-auto">
                    <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
                        <span className="text-white font-bold text-lg">{getModeDisplay()}</span>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={onToggleFullscreen}
                            className="bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 border border-white/20 hover:border-white/40"
                            title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
                        >
                            {isFullscreen ? '🗗 Exit' : '⛶ Fullscreen'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Gesture History Indicators */}
            <div className="absolute top-24 left-6">
                <div className="flex gap-2">
                    {gestureHistory.map((gesture, index) => (
                        <div
                            key={index}
                            className={`w-4 h-4 rounded-full border-2 border-white ${
                                index === gestureHistory.length - 1
                                    ? 'bg-green-400 animate-pulse'
                                    : 'bg-white/60'
                            }`}
                            title={gesture}
                        />
                    ))}
                </div>
            </div>

            {/* Current Detection Panel */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                <div className="pointer-events-auto">
                    <DetectionPanel
                        currentGesture={currentGesture}
                        confidence={confidence}
                        currentWord={currentWord}
                        wordSequence={wordSequence}
                        mode={mode}
                        stream={stream}
                        confidenceColorClass={getConfidenceColor()}
                    />
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
