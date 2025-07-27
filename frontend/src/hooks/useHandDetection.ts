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

            // Configure MediaPipe Hands
            const hands = new Hands({
                locateFile: (file: string) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            hands.onResults((results: any) => {
                // Clear canvas
                canvasCtx.save();
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw video frame
                canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

                // Draw hand landmarks
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                        const landmarks = results.multiHandLandmarks[i];
                        const handedness = results.multiHandedness?.[i]?.label || 'Unknown';
                        const confidence = results.multiHandedness?.[i]?.score || 0;

                        // Store detection result
                        lastDetectionRef.current = {
                            landmarks: landmarks,
                            handedness: handedness,
                            confidence: confidence
                        };

                        // Draw connections
                        if (drawConnectors && HAND_CONNECTIONS) {
                            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                                color: '#00FF00',
                                lineWidth: 2
                            });
                        }

                        // Draw landmarks
                        if (drawLandmarks) {
                            drawLandmarks(canvasCtx, landmarks, {
                                color: '#FF0000',
                                lineWidth: 1,
                                radius: 3
                            });
                        }

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

            console.log('Setting up camera...');

            // Initialize camera
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
