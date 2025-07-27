'use client';

import { useRef, useEffect, useState } from 'react';

interface CameraCaptureProps {
    onVideoReady?: (video: HTMLVideoElement) => void;
}

export default function CameraCapture({ onVideoReady }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        startCamera();
    }, []);

    const startCamera = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Request camera permission
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
                    if (onVideoReady && videoRef.current) {
                        onVideoReady(videoRef.current);
                    }
                };
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Unable to access camera. Please ensure you have given permission.');
            setIsLoading(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setHasPermission(false);
        }
    };

    return (
        <div className="flex flex-col items-center space-y-4 p-4">
            <h2 className="text-2xl font-bold text-gray-800">Sign Language Camera</h2>

            <div className="relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                        <div className="text-gray-600">Loading camera...</div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100 rounded-lg">
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

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="rounded-lg border-2 border-gray-300"
                    style={{ width: '640px', height: '480px', transform: 'scaleX(-1)' }}
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
                <p className="text-green-600 text-sm">✅ Camera is ready for sign language detection</p>
            )}
        </div>
    );
}
