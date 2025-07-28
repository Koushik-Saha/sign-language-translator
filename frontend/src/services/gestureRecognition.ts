// Enhanced ASL letter recognition with more letters and better accuracy
export interface GestureResult {
    letter: string;
    confidence: number;
    description: string;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export class GestureRecognizer {
    private gestureHistory: string[] = [];
    private readonly historySize = 5; // For gesture stabilization

    // Calculate distance between two landmarks
    private getDistance(point1: any, point2: any): number {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = (point1.z || 0) - (point2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // Calculate angle between three points
    private getAngle(p1: any, p2: any, p3: any): number {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
    }

    // Check if finger is extended with better accuracy
    private isFingerExtended(landmarks: any[], tipIndex: number, pipIndex: number, mcpIndex: number): boolean {
        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];
        const mcp = landmarks[mcpIndex];

        // Calculate finger extension based on angle and position
        const angle = this.getAngle(mcp, pip, tip);
        const tipToPip = this.getDistance(tip, pip);
        const pipToMcp = this.getDistance(pip, mcp);

        // Extended if angle is close to straight and tip is further from palm
        return angle > 140 && tip.y < pip.y && tipToPip > pipToMcp * 0.7;
    }

    // Enhanced thumb detection
    private isThumbExtended(landmarks: any[]): boolean {
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const thumbMcp = landmarks[2];
        const indexMcp = landmarks[5];

        // Thumb is extended if it's far from index finger and properly positioned
        const thumbToIndex = this.getDistance(thumbTip, indexMcp);
        const angle = this.getAngle(thumbMcp, thumbIp, thumbTip);

        return thumbToIndex > 0.08 && angle > 120;
    }

    // Check if fingers are curled (for letters like M, N)
    private isFingerCurled(landmarks: any[], tipIndex: number, pipIndex: number, mcpIndex: number): boolean {
        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];
        const mcp = landmarks[mcpIndex];

        const angle = this.getAngle(mcp, pip, tip);
        return angle < 90 && tip.y > pip.y;
    }

    // Enhanced gesture recognition with more letters
    recognizeGesture(landmarks: any[]): GestureResult {
        if (!landmarks || landmarks.length !== 21) {
            return { letter: '', confidence: 0, description: 'Invalid hand data', quality: 'poor' };
        }

        // Get finger states
        const isThumbUp = this.isThumbExtended(landmarks);
        const isIndexUp = this.isFingerExtended(landmarks, 8, 6, 5);
        const isMiddleUp = this.isFingerExtended(landmarks, 12, 10, 9);
        const isRingUp = this.isFingerExtended(landmarks, 16, 14, 13);
        const isPinkyUp = this.isFingerExtended(landmarks, 20, 18, 17);

        // Get curled states for more complex letters
        const isIndexCurled = this.isFingerCurled(landmarks, 8, 6, 5);
        const isMiddleCurled = this.isFingerCurled(landmarks, 12, 10, 9);
        const isRingCurled = this.isFingerCurled(landmarks, 16, 14, 13);
        const isPinkyCurled = this.isFingerCurled(landmarks, 20, 18, 17);

        const extendedCount = [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;
        const curledCount = [isIndexCurled, isMiddleCurled, isRingCurled, isPinkyCurled].filter(Boolean).length;

        let result: GestureResult;

        // Enhanced letter recognition
        if (extendedCount === 0 && curledCount >= 3) {
            if (isThumbUp) {
                result = { letter: 'A', confidence: 0.9, description: 'Closed fist with thumb up', quality: 'excellent' };
            } else {
                result = { letter: 'S', confidence: 0.85, description: 'Closed fist', quality: 'good' };
            }
        }
        else if (extendedCount === 1) {
            if (isIndexUp && !isThumbUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                result = { letter: 'D', confidence: 0.9, description: 'Index finger pointing up', quality: 'excellent' };
            }
            else if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                result = { letter: 'T', confidence: 0.8, description: 'Thumb between fingers', quality: 'good' };
            }
            else if (isPinkyUp && !isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp) {
                result = { letter: 'I', confidence: 0.85, description: 'Pinky finger up', quality: 'good' };
            }
            else {
                result = { letter: '?', confidence: 0.3, description: 'Single finger extended', quality: 'fair' };
            }
        }
        else if (extendedCount === 2) {
            if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
                if (isThumbUp) {
                    result = { letter: 'K', confidence: 0.8, description: 'Index, middle, thumb', quality: 'good' };
                } else {
                    result = { letter: 'V', confidence: 0.9, description: 'Peace sign', quality: 'excellent' };
                }
            }
            else if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                result = { letter: 'L', confidence: 0.85, description: 'L-shape with thumb and index', quality: 'good' };
            }
            else if (isThumbUp && isPinkyUp && !isIndexUp && !isMiddleUp && !isRingUp) {
                result = { letter: 'Y', confidence: 0.8, description: 'Thumb and pinky extended', quality: 'good' };
            }
            else if (isIndexUp && isPinkyUp && !isMiddleUp && !isRingUp) {
                result = { letter: 'U', confidence: 0.75, description: 'Index and pinky up', quality: 'fair' };
            }
            else {
                result = { letter: '?', confidence: 0.4, description: 'Two fingers extended', quality: 'fair' };
            }
        }
        else if (extendedCount === 3) {
            if (isIndexUp && isMiddleUp && isRingUp && !isPinkyUp && !isThumbUp) {
                result = { letter: 'W', confidence: 0.85, description: 'Three middle fingers up', quality: 'good' };
            }
            else if (isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
                result = { letter: 'F', confidence: 0.8, description: 'Thumb, index, middle up', quality: 'good' };
            }
            else {
                result = { letter: '?', confidence: 0.4, description: 'Three fingers extended', quality: 'fair' };
            }
        }
        else if (extendedCount === 4) {
            if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
                result = { letter: 'B', confidence: 0.8, description: 'Four fingers up, thumb tucked', quality: 'good' };
            }
            else {
                result = { letter: '?', confidence: 0.4, description: 'Four fingers extended', quality: 'fair' };
            }
        }
        else if (extendedCount === 5) {
            result = { letter: 'C', confidence: 0.7, description: 'Open hand (C-shape approximation)', quality: 'fair' };
        }
        else if (curledCount >= 3 && isThumbUp) {
            // Special cases for curled fingers
            if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
                result = { letter: 'E', confidence: 0.75, description: 'Fingers curled, thumb out', quality: 'fair' };
            } else {
                result = { letter: 'M', confidence: 0.6, description: 'Fingers tucked under thumb', quality: 'fair' };
            }
        }
        else {
            result = { letter: '?', confidence: 0.2, description: `${extendedCount} fingers extended`, quality: 'poor' };
        }

        // Add to gesture history for stabilization
        if (result.confidence > 0.5) {
            this.gestureHistory.push(result.letter);
            if (this.gestureHistory.length > this.historySize) {
                this.gestureHistory.shift();
            }

            // Get most common gesture in recent history
            const letterCounts = this.gestureHistory.reduce((acc, letter) => {
                acc[letter] = (acc[letter] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const mostCommon = Object.entries(letterCounts)
                .sort(([,a], [,b]) => b - a)[0];

            if (mostCommon && mostCommon[1] >= Math.ceil(this.historySize / 2)) {
                result.letter = mostCommon[0];
                result.confidence = Math.min(result.confidence + 0.1, 1.0); // Boost confidence for stable gestures
                result.quality = result.confidence > 0.9 ? 'excellent' : result.confidence > 0.7 ? 'good' : 'fair';
            }
        }

        return result;
    }

    // Clear history when hand is not detected
    clearHistory(): void {
        this.gestureHistory = [];
    }
}
