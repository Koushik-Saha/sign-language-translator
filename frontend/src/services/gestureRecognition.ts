// Simple ASL letter recognition based on hand landmarks
export interface GestureResult {
    letter: string;
    confidence: number;
    description: string;
}

export class GestureRecognizer {
    // Calculate distance between two landmarks
    private getDistance(point1: any, point2: any): number {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Check if finger is extended (comparing tip to base)
    private isFingerExtended(landmarks: any[], tipIndex: number, pipIndex: number): boolean {
        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];

        // For most fingers, tip should be higher (lower y value) than pip when extended
        return tip.y < pip.y;
    }

    // Check if thumb is extended (different logic due to thumb orientation)
    private isThumbExtended(landmarks: any[]): boolean {
        const thumbTip = landmarks[4];
        const thumbMcp = landmarks[2];

        // Thumb extended when tip is further from palm center than mcp
        return thumbTip.x > thumbMcp.x;
    }

    // Recognize basic ASL letters
    recognizeGesture(landmarks: any[]): GestureResult {
        if (!landmarks || landmarks.length !== 21) {
            return { letter: '', confidence: 0, description: 'Invalid hand data' };
        }

        // Check finger positions
        const isThumbUp = this.isThumbExtended(landmarks);
        const isIndexUp = this.isFingerExtended(landmarks, 8, 6);  // Index finger
        const isMiddleUp = this.isFingerExtended(landmarks, 12, 10); // Middle finger
        const isRingUp = this.isFingerExtended(landmarks, 16, 14);   // Ring finger
        const isPinkyUp = this.isFingerExtended(landmarks, 20, 18);  // Pinky finger

        // Count extended fingers
        const extendedCount = [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;

        // Simple letter recognition rules
        if (extendedCount === 0) {
            return { letter: 'S', confidence: 0.8, description: 'Closed fist' };
        }

        if (extendedCount === 1) {
            if (isIndexUp && !isThumbUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                return { letter: 'D', confidence: 0.85, description: 'Index finger up' };
            }
            if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                return { letter: 'A', confidence: 0.8, description: 'Thumb up (approximation)' };
            }
        }

        if (extendedCount === 2) {
            if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
                return { letter: 'V', confidence: 0.85, description: 'Peace sign' };
            }
            if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                return { letter: 'L', confidence: 0.8, description: 'Thumb and index' };
            }
        }

        if (extendedCount === 3) {
            if (isIndexUp && isMiddleUp && isRingUp && !isPinkyUp && !isThumbUp) {
                return { letter: 'W', confidence: 0.8, description: 'Three middle fingers' };
            }
        }

        if (extendedCount === 5) {
            return { letter: 'B', confidence: 0.7, description: 'Open hand (approximation)' };
        }

        // Default case
        return { letter: '?', confidence: 0.3, description: `${extendedCount} fingers extended` };
    }
}
