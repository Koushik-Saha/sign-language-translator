// Complete ASL A-Z letter recognition
export interface GestureResult {
    letter: string;
    confidence: number;
    description: string;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export class GestureRecognizer {
    private gestureHistory: string[] = [];
    private readonly historySize = 5;

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
        const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
        return angle * (180 / Math.PI);
    }

    // Enhanced finger detection
    private isFingerExtended(landmarks: any[], tipIndex: number, pipIndex: number, mcpIndex: number): boolean {
        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];
        const mcp = landmarks[mcpIndex];

        const angle = this.getAngle(mcp, pip, tip);
        return angle > 140 && tip.y < pip.y;
    }

    // Enhanced thumb detection
    private isThumbExtended(landmarks: any[]): boolean {
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const thumbMcp = landmarks[2];
        const indexMcp = landmarks[5];

        const thumbToIndex = this.getDistance(thumbTip, indexMcp);
        const angle = this.getAngle(thumbMcp, thumbIp, thumbTip);

        return thumbToIndex > 0.08 && angle > 120;
    }

    // Check if finger is curled
    private isFingerCurled(landmarks: any[], tipIndex: number, pipIndex: number): boolean {
        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];
        return tip.y > pip.y + 0.02;
    }

    // Check finger positions for specific letters
    private getFingerStates(landmarks: any[]) {
        return {
            thumb: {
                extended: this.isThumbExtended(landmarks),
                curled: !this.isThumbExtended(landmarks)
            },
            index: {
                extended: this.isFingerExtended(landmarks, 8, 6, 5),
                curled: this.isFingerCurled(landmarks, 8, 6),
                bent: this.getAngle(landmarks[5], landmarks[6], landmarks[8]) < 120
            },
            middle: {
                extended: this.isFingerExtended(landmarks, 12, 10, 9),
                curled: this.isFingerCurled(landmarks, 12, 10),
                bent: this.getAngle(landmarks[9], landmarks[10], landmarks[12]) < 120
            },
            ring: {
                extended: this.isFingerExtended(landmarks, 16, 14, 13),
                curled: this.isFingerCurled(landmarks, 16, 14)
            },
            pinky: {
                extended: this.isFingerExtended(landmarks, 20, 18, 17),
                curled: this.isFingerCurled(landmarks, 20, 18)
            }
        };
    }

    // Complete A-Z recognition
    recognizeGesture(landmarks: any[]): GestureResult {
        if (!landmarks || landmarks.length !== 21) {
            return { letter: '', confidence: 0, description: 'Invalid hand data', quality: 'poor' };
        }

        const fingers = this.getFingerStates(landmarks);
        const extendedCount = Object.values(fingers).filter(f => f.extended).length;

        let result: GestureResult;

        // A - Closed fist with thumb alongside
        if (!fingers.thumb.extended && fingers.index.curled && fingers.middle.curled &&
            fingers.ring.curled && fingers.pinky.curled) {
            result = { letter: 'A', confidence: 0.9, description: 'Closed fist, thumb alongside', quality: 'excellent' };
        }

        // B - Four fingers up, thumb across palm
        else if (!fingers.thumb.extended && fingers.index.extended && fingers.middle.extended &&
            fingers.ring.extended && fingers.pinky.extended) {
            result = { letter: 'B', confidence: 0.85, description: 'Four fingers straight up', quality: 'good' };
        }

        // C - Curved hand shape
        else if (extendedCount === 5 && this.getDistance(landmarks[4], landmarks[8]) < 0.08) {
            result = { letter: 'C', confidence: 0.7, description: 'Curved hand like letter C', quality: 'fair' };
        }

        // D - Index up, others curled, thumb touches middle finger
        else if (fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && fingers.thumb.extended) {
            const thumbToMiddle = this.getDistance(landmarks[4], landmarks[12]);
            if (thumbToMiddle < 0.05) {
                result = { letter: 'D', confidence: 0.85, description: 'Index up, thumb touches middle', quality: 'good' };
            } else {
                result = { letter: 'D', confidence: 0.8, description: 'Index finger pointing up', quality: 'good' };
            }
        }

        // E - All fingers curled, thumb curled over
        else if (fingers.thumb.curled && fingers.index.curled && fingers.middle.curled &&
            fingers.ring.curled && fingers.pinky.curled) {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            if (thumbTip.y < indexTip.y) {
                result = { letter: 'E', confidence: 0.75, description: 'Fingers curled, thumb over', quality: 'fair' };
            } else {
                result = { letter: 'S', confidence: 0.8, description: 'Closed fist', quality: 'good' };
            }
        }

        // F - Index and thumb touch, others up
        else if (fingers.middle.extended && fingers.ring.extended && fingers.pinky.extended) {
            const thumbToIndex = this.getDistance(landmarks[4], landmarks[8]);
            if (thumbToIndex < 0.04) {
                result = { letter: 'F', confidence: 0.8, description: 'OK sign with three fingers up', quality: 'good' };
            } else {
                result = { letter: 'W', confidence: 0.75, description: 'Three fingers up', quality: 'fair' };
            }
        }

        // G - Index pointing sideways
        else if (fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && fingers.thumb.extended) {
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];
            if (Math.abs(indexTip.x - thumbTip.x) > 0.08) {
                result = { letter: 'G', confidence: 0.75, description: 'Index and thumb pointing sideways', quality: 'fair' };
            } else {
                result = { letter: 'L', confidence: 0.8, description: 'L-shape', quality: 'good' };
            }
        }

        // H - Index and middle sideways
        else if (fingers.index.extended && fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            if (Math.abs(indexTip.x - middleTip.x) < 0.03) {
                result = { letter: 'H', confidence: 0.8, description: 'Index and middle sideways', quality: 'good' };
            } else {
                result = { letter: 'V', confidence: 0.85, description: 'Peace sign', quality: 'good' };
            }
        }

        // I - Pinky up
        else if (!fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended &&
            fingers.pinky.extended && !fingers.thumb.extended) {
            result = { letter: 'I', confidence: 0.85, description: 'Pinky finger up', quality: 'good' };
        }

        // J - Pinky up with motion (static approximation)
        else if (!fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended &&
            fingers.pinky.extended && !fingers.thumb.extended) {
            const pinkyTip = landmarks[20];
            if (pinkyTip.x < landmarks[0].x) { // Pinky towards thumb side
                result = { letter: 'J', confidence: 0.7, description: 'Pinky with J motion', quality: 'fair' };
            } else {
                result = { letter: 'I', confidence: 0.85, description: 'Pinky finger up', quality: 'good' };
            }
        }

        // K - Index up, middle bent, thumb touches middle
        else if (fingers.index.extended && fingers.middle.bent && !fingers.ring.extended &&
            !fingers.pinky.extended) {
            result = { letter: 'K', confidence: 0.8, description: 'Index up, middle bent', quality: 'good' };
        }

        // L - Thumb and index at right angle
        else if (fingers.thumb.extended && fingers.index.extended && !fingers.middle.extended &&
            !fingers.ring.extended && !fingers.pinky.extended) {
            const angle = this.getAngle(landmarks[4], landmarks[0], landmarks[8]);
            if (angle > 70 && angle < 110) {
                result = { letter: 'L', confidence: 0.9, description: 'L-shape, thumb and index', quality: 'excellent' };
            } else {
                result = { letter: 'L', confidence: 0.75, description: 'Thumb and index extended', quality: 'fair' };
            }
        }

        // M - Three fingers over thumb
        else if (fingers.thumb.curled && fingers.index.curled && fingers.middle.curled &&
            fingers.ring.curled && !fingers.pinky.extended) {
            result = { letter: 'M', confidence: 0.7, description: 'Three fingers over thumb', quality: 'fair' };
        }

        // N - Two fingers over thumb
        else if (fingers.thumb.curled && fingers.index.curled && fingers.middle.curled &&
            !fingers.ring.curled && !fingers.pinky.curled) {
            result = { letter: 'N', confidence: 0.7, description: 'Two fingers over thumb', quality: 'fair' };
        }

        // O - All fingers curved forming O
        else if (extendedCount === 5) {
            const thumbToIndex = this.getDistance(landmarks[4], landmarks[8]);
            const thumbToMiddle = this.getDistance(landmarks[4], landmarks[12]);
            if (thumbToIndex < 0.06 && thumbToMiddle < 0.08) {
                result = { letter: 'O', confidence: 0.75, description: 'Fingers forming O shape', quality: 'fair' };
            } else {
                result = { letter: 'C', confidence: 0.7, description: 'Open hand', quality: 'fair' };
            }
        }

        // P - Index and middle down, like K but pointing down
        else if (!fingers.index.extended && fingers.middle.bent && !fingers.ring.extended &&
            !fingers.pinky.extended && fingers.thumb.extended) {
            result = { letter: 'P', confidence: 0.75, description: 'Index and middle pointing down', quality: 'fair' };
        }

        // Q - Thumb and index pointing down
        else if (fingers.thumb.extended && fingers.index.extended && !fingers.middle.extended &&
            !fingers.ring.extended && !fingers.pinky.extended) {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            if (thumbTip.y > landmarks[0].y && indexTip.y > landmarks[0].y) {
                result = { letter: 'Q', confidence: 0.75, description: 'Thumb and index pointing down', quality: 'fair' };
            } else {
                result = { letter: 'G', confidence: 0.7, description: 'Thumb and index sideways', quality: 'fair' };
            }
        }

        // R - Index and middle crossed
        else if (fingers.index.extended && fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            const crossDistance = this.getDistance(indexTip, middleTip);
            if (crossDistance < 0.03) {
                result = { letter: 'R', confidence: 0.8, description: 'Index and middle crossed', quality: 'good' };
            } else {
                result = { letter: 'V', confidence: 0.85, description: 'Peace sign', quality: 'good' };
            }
        }

        // S - Closed fist
        else if (!fingers.thumb.extended && fingers.index.curled && fingers.middle.curled &&
            fingers.ring.curled && fingers.pinky.curled) {
            result = { letter: 'S', confidence: 0.85, description: 'Closed fist', quality: 'good' };
        }

        // T - Thumb between index and middle
        else if (fingers.thumb.extended && fingers.index.curled && fingers.middle.curled &&
            fingers.ring.curled && fingers.pinky.curled) {
            const thumbTip = landmarks[4];
            const indexPip = landmarks[6];
            const middlePip = landmarks[10];
            const thumbBetween = Math.abs((thumbTip.x - indexPip.x) - (middlePip.x - thumbTip.x)) < 0.02;
            if (thumbBetween) {
                result = { letter: 'T', confidence: 0.8, description: 'Thumb between fingers', quality: 'good' };
            } else {
                result = { letter: 'A', confidence: 0.75, description: 'Fist with thumb', quality: 'fair' };
            }
        }

        // U - Index and middle up together
        else if (fingers.index.extended && fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            if (Math.abs(indexTip.x - middleTip.x) < 0.02) {
                result = { letter: 'U', confidence: 0.85, description: 'Index and middle together', quality: 'good' };
            } else {
                result = { letter: 'V', confidence: 0.8, description: 'Peace sign', quality: 'good' };
            }
        }

        // V - Index and middle spread apart
        else if (fingers.index.extended && fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            result = { letter: 'V', confidence: 0.9, description: 'Peace sign - victory', quality: 'excellent' };
        }

        // W - Three fingers up
        else if (fingers.index.extended && fingers.middle.extended && fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            result = { letter: 'W', confidence: 0.85, description: 'Three fingers up', quality: 'good' };
        }

        // X - Index finger bent/hooked
        else if (fingers.index.bent && !fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            result = { letter: 'X', confidence: 0.8, description: 'Index finger hooked', quality: 'good' };
        }

        // Y - Thumb and pinky extended
        else if (fingers.thumb.extended && !fingers.index.extended && !fingers.middle.extended &&
            !fingers.ring.extended && fingers.pinky.extended) {
            result = { letter: 'Y', confidence: 0.85, description: 'Thumb and pinky extended', quality: 'good' };
        }

        // Z - Index finger making Z motion (static approximation)
        else if (fingers.index.extended && !fingers.middle.extended && !fingers.ring.extended &&
            !fingers.pinky.extended && !fingers.thumb.extended) {
            const indexTip = landmarks[8];
            const wrist = landmarks[0];
            if (indexTip.x < wrist.x) { // Index pointing towards body
                result = { letter: 'Z', confidence: 0.7, description: 'Index finger Z motion', quality: 'fair' };
            } else {
                result = { letter: 'D', confidence: 0.8, description: 'Index finger up', quality: 'good' };
            }
        }

        // Default case
        else {
            result = { letter: '?', confidence: 0.3, description: `${extendedCount} fingers extended`, quality: 'poor' };
        }

        // Stabilization with gesture history
        if (result.confidence > 0.5) {
            this.gestureHistory.push(result.letter);
            if (this.gestureHistory.length > this.historySize) {
                this.gestureHistory.shift();
            }

            const letterCounts = this.gestureHistory.reduce((acc, letter) => {
                acc[letter] = (acc[letter] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const mostCommon = Object.entries(letterCounts)
                .sort(([,a], [,b]) => b - a)[0];

            if (mostCommon && mostCommon[1] >= Math.ceil(this.historySize / 2)) {
                result.letter = mostCommon[0];
                result.confidence = Math.min(result.confidence + 0.1, 1.0);
                result.quality = result.confidence > 0.9 ? 'excellent' : result.confidence > 0.7 ? 'good' : 'fair';
            }
        }

        return result;
    }

    clearHistory(): void {
        this.gestureHistory = [];
    }
}
