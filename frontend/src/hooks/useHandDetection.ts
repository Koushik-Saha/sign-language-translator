'use client';

import { useRef, useCallback, useState } from 'react';
import { GestureRecognizer, GestureResult } from '@/services/gestureRecognition';

interface HandDetectionResult {
    landmarks: any[];
    handedness: string;
    confidence: number;
}

interface UseHandDetectionReturn {
    initializeHandDetection: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<void>;
    isDetecting: boolean;
    lastDetection: HandDetectionResult | null;
    currentGesture: GestureResult | null;
    currentLandmarks: any[] | null;
}

// Load MediaPipe from CDN
const loadMediaPipeScript = () => {
    return new Promise((resolve, reject) => {
        if ((window as any).Hands) {
            resolve((window as any).Hands);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script.onload = () => {
            const cameraScript = document.createElement('script');
            cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
            cameraScript.onload = () => {
                const drawingScript = document.createElement('script');
                drawingScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
                drawingScript.onload = () => resolve((window as any).Hands);
                drawingScript.onerror = reject;
                document.head.appendChild(drawingScript);
            };
            cameraScript.onerror = reject;
            document.head.appendChild(cameraScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

export function useHandDetection(): UseHandDetectionReturn {
    const handsRef = useRef<any>(null);
    const isDetectingRef = useRef(false);
    const lastDetectionRef = useRef<HandDetectionResult | null>(null);
    const [currentGesture, setCurrentGesture] = useState<GestureResult | null>(null);
    const [currentLandmarks, setCurrentLandmarks] = useState<any[] | null>(null);
    const gestureRecognizer = useRef(new GestureRecognizer());
    const noHandFrames = useRef(0);

    const initializeHandDetection = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
        try {
            console.log('Loading MediaPipe...');
            await loadMediaPipeScript();

            const canvasCtx = canvas.getContext('2d');
            if (!canvasCtx) throw new Error('Cannot get canvas context');

            // Access MediaPipe from window object
            const { Hands, HAND_CONNECTIONS } = (window as any);
            const { Camera } = (window as any);
            const { drawConnectors, drawLandmarks } = (window as any);

            console.log('MediaPipe loaded, creating Hands instance...');

            // Configure MediaPipe Hands with optimized settings
            const hands = new Hands({
                locateFile: (file: string) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.8, // Increased for better accuracy
                minTrackingConfidence: 0.7   // Increased for stability
            });

            hands.onResults((results: any) => {
                // Clear canvas
                canvasCtx.save();
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw video frame
                canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

                // Draw hand landmarks and recognize gestures
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    const landmarks = results.multiHandLandmarks[0];
                    const handedness = results.multiHandedness?.[0]?.label || 'Unknown';
                    const confidence = results.multiHandedness?.[0]?.score || 0;

                    // Store detection result
                    lastDetectionRef.current = {
                        landmarks: landmarks,
                        handedness: handedness,
                        confidence: confidence
                    };

                    // Reset no-hand counter
                    noHandFrames.current = 0;

                    // Recognize gesture
                    const gestureResult = gestureRecognizer.current.recognizeGesture(landmarks);
                    setCurrentGesture(gestureResult);
                    setCurrentLandmarks(landmarks);

                    // Draw connections with quality-based color
                    const connectionColor = gestureResult.quality === 'excellent' ? '#00FF00' :
                        gestureResult.quality === 'good' ? '#FFFF00' :
                            gestureResult.quality === 'fair' ? '#FFA500' : '#FF0000';

                    if (drawConnectors && HAND_CONNECTIONS) {
                        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                            color: connectionColor,
                            lineWidth: 2
                        });
                    }

                    // Draw landmarks with confidence-based size
                    if (drawLandmarks) {
                        const landmarkRadius = Math.max(2, gestureResult.confidence * 5);
                        drawLandmarks(canvasCtx, landmarks, {
                            color: '#FF0000',
                            lineWidth: 1,
                            radius: landmarkRadius
                        });
                    }

                    // FIXED: Draw text with proper mirroring
                    canvasCtx.save();
                    canvasCtx.scale(-1, 1);
                    canvasCtx.translate(-canvas.width, 0);

                    // Display hand info
                    canvasCtx.fillStyle = connectionColor;
                    canvasCtx.font = '16px Arial';
                    canvasCtx.fillText(
                        `${handedness} Hand (${(confidence * 100).toFixed(1)}%)`,
                        10,
                        30
                    );

                    // Display recognized letter with quality indicator
                    if (gestureResult.letter && gestureResult.letter !== '?') {
                        canvasCtx.fillStyle = '#FFD700';
                        canvasCtx.font = 'bold 28px Arial';
                        canvasCtx.fillText(
                            `Letter: ${gestureResult.letter}`,
                            10,
                            65
                        );

                        canvasCtx.fillStyle = connectionColor;
                        canvasCtx.font = '14px Arial';
                        canvasCtx.fillText(
                            `Quality: ${gestureResult.quality.toUpperCase()}`,
                            10,
                            85
                        );

                        canvasCtx.fillStyle = '#FFFFFF';
                        canvasCtx.font = '12px Arial';
                        canvasCtx.fillText(
                            `Confidence: ${(gestureResult.confidence * 100).toFixed(1)}%`,
                            10,
                            105
                        );
                    }

                    canvasCtx.restore();
                } else {
                    // No hands detected - clear history after several frames
                    noHandFrames.current++;
                    if (noHandFrames.current > 10) {
                        gestureRecognizer.current.clearHistory();
                        setCurrentGesture(null);
                        setCurrentLandmarks(null);
                        lastDetectionRef.current = null;
                    }
                }

                canvasCtx.restore();
            });

            console.log('Setting up camera...');

            // Initialize camera with improved settings
            const camera = new Camera(video, {
                onFrame: async () => {
                    if (isDetectingRef.current && hands) {
                        await hands.send({ image: video });
                    }
                },
                width: 640,
                height: 480
            });

            handsRef.current = hands;
            isDetectingRef.current = true;

            // Start camera
            await camera.start();

            console.log('✅ Enhanced hand detection with improved recognition initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing hand detection:', error);
            throw error;
        }
    }, []);

    return {
        initializeHandDetection,
        isDetecting: isDetectingRef.current,
        lastDetection: lastDetectionRef.current,
        currentGesture,
        currentLandmarks
    };
}
