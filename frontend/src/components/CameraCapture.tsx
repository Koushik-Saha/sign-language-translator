'use client';

import { useRef, useEffect, useState } from 'react';
import { useHandDetection } from '@/hooks/useHandDetection';

export default function CameraCapture() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isDetectionActive, setIsDetectionActive] = useState(false);

    const { initializeHandDetection } = useHandDetection();

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
