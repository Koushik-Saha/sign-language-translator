'use client';

import { useRef, useCallback } from 'react';

interface HandDetectionResult {
    landmarks: any[];
    handedness: string;
    confidence: number;
}

interface UseHandDetectionReturn {
    initializeHandDetection: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<void>;
    isDetecting: boolean;
    lastDetection: HandDetectionResult | null;
}

export function useHandDetection(): UseHandDetectionReturn {
    const handsRef = useRef<any>(null);
    const isDetectingRef = useRef(false);
    const lastDetectionRef = useRef<HandDetectionResult | null>(null);

    const initializeHandDetection = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
        try {
            // Dynamic import of MediaPipe
            const { Hands } = await import('@mediapipe/hands');
            const { Camera } = await import('@mediapipe/camera_utils');
            const { drawConnectors, drawLandmarks } = await import('@mediapipe/drawing_utils');
            const { HAND_CONNECTIONS } = await import('@mediapipe/hands');

            const canvasCtx = canvas.getContext('2d');
            if (!canvasCtx) throw new Error('Cannot get canvas context');

            // Configure MediaPipe Hands
            const hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            hands.onResults((results) => {
                // Clear canvas
                canvasCtx.save();
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw video frame
                canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

                // Draw hand landmarks
                if (results.multiHandLandmarks) {
                    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                        const landmarks = results.multiHandLandmarks[i];
                        const handedness = results.multiHandedness[i].label;
                        const confidence = results.multiHandedness[i].score;

                        // Store detection result
                        lastDetectionRef.current = {
                            landmarks: landmarks,
                            handedness: handedness,
                            confidence: confidence
                        };

                        // Draw connections
                        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                            color: '#00FF00',
                            lineWidth: 2
                        });

                        // Draw landmarks
                        drawLandmarks(canvasCtx, landmarks, {
                            color: '#FF0000',
                            lineWidth: 1,
                            radius: 3
                        });

                        // Display hand info
                        canvasCtx.fillStyle = '#00FF00';
                        canvasCtx.font = '16px Arial';
                        canvasCtx.fillText(
                            `${handedness} Hand (${(confidence * 100).toFixed(1)}%)`,
                            10,
                            30 + (i * 25)
                        );
                    }
                }

                canvasCtx.restore();
            });

            // Initialize camera
            const camera = new Camera(video, {
                onFrame: async () => {
                    if (isDetectingRef.current) {
                        await hands.send({ image: video });
                    }
                },
                width: 640,
                height: 480
            });

            handsRef.current = hands;
            isDetectingRef.current = true;

            // Start camera
            camera.start();

            console.log('✅ Hand detection initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing hand detection:', error);
            throw error;
        }
    }, []);

    return {
        initializeHandDetection,
        isDetecting: isDetectingRef.current,
        lastDetection: lastDetectionRef.current
    };
}
