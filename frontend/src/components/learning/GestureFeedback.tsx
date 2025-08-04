'use client';

import React, { useEffect, useState } from 'react';

interface GestureFeedbackProps {
  targetGesture: string;
  detectedGesture?: string;
  confidence?: number;
  isActive: boolean;
  onFeedback?: (feedback: FeedbackResult) => void;
}

interface FeedbackResult {
  correct: boolean;
  confidence: number;
  suggestions: string[];
  accuracy: number;
}

export default function GestureFeedback({ 
  targetGesture, 
  detectedGesture, 
  confidence = 0, 
  isActive,
  onFeedback 
}: GestureFeedbackProps) {
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (detectedGesture && targetGesture && isActive) {
      const isCorrect = detectedGesture.toUpperCase() === targetGesture.toUpperCase();
      const accuracy = isCorrect ? confidence * 100 : 0;
      
      const suggestions = generateSuggestions(targetGesture, detectedGesture, isCorrect);
      
      const result: FeedbackResult = {
        correct: isCorrect,
        confidence,
        suggestions,
        accuracy
      };
      
      setFeedback(result);
      onFeedback?.(result);
    }
  }, [detectedGesture, targetGesture, confidence, isActive, onFeedback]);

  const generateSuggestions = (target: string, detected: string, isCorrect: boolean): string[] => {
    if (isCorrect) {
      return ['Great job! Perfect execution!'];
    }

    const suggestions = [];
    
    if (!detected) {
      suggestions.push('Make sure your hand is clearly visible in the camera');
      suggestions.push('Check that lighting is adequate');
    } else {
      suggestions.push(`You signed &quot;${detected}&quot; but the target is &quot;${target}&quot;`);
      suggestions.push('Double-check your hand position and finger placement');
      suggestions.push('Make sure your gesture is held steady for recognition');
    }

    // Add specific suggestions based on common mistakes
    if (target.length === 1) {
      suggestions.push(`For letter "${target}", focus on the specific hand shape and orientation`);
    }

    return suggestions;
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBackground = (conf: number) => {
    if (conf >= 0.8) return 'bg-green-100';
    if (conf >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (!isActive) {
    return (
      <div className="bg-gray-100 rounded-lg p-6 text-center">
        <div className="text-gray-500 mb-2">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none"  viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <p className="text-gray-600">Position yourself in the camera view to start practicing</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Practice: <span className="text-blue-600">{targetGesture}</span>
        </h3>
        <p className="text-gray-600">Make the gesture and hold it steady for recognition</p>
      </div>

      {feedback ? (
        <div className={`rounded-lg p-4 mb-4 ${
          feedback.correct ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200'
        } border-2`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              {feedback.correct ? (
                <svg className="w-6 h-6 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`font-semibold ${
                feedback.correct ? 'text-green-800' : 'text-red-800'
              }`}>
                {feedback.correct ? 'Correct!' : 'Not quite right'}
              </span>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              getConfidenceBackground(confidence)
            } ${getConfidenceColor(confidence)}`}>
              {Math.round(confidence * 100)}% confidence
            </div>
          </div>

          {detectedGesture && (
            <p className="text-sm text-gray-700 mb-2">
              Detected: <span className="font-medium">{detectedGesture}</span>
            </p>
          )}

          <div className="text-sm">
            {feedback.suggestions.map((suggestion, index) => (
              <p key={index} className={`mb-1 ${
                feedback.correct ? 'text-green-700' : 'text-red-700'
              }`}>
                • {suggestion}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 rounded-lg p-4 mb-4 border-2 border-blue-200">
          <div className="flex items-center">
            <div className="animate-pulse w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
            <span className="text-blue-800 font-medium">Waiting for gesture...</span>
          </div>
          <p className="text-blue-700 text-sm mt-2">
            Make sure your hand is clearly visible and well-lit
          </p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowHint(!showHint)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none"  viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showHint ? 'Hide Hint' : 'Show Hint'}
        </button>

        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            confidence >= 0.8 ? 'bg-green-500' : 
            confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-sm text-gray-600">
            {confidence >= 0.8 ? 'Excellent' : 
             confidence >= 0.6 ? 'Good' : 'Needs work'}
          </span>
        </div>
      </div>

      {showHint && (
        <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Hint for "{targetGesture}":</h4>
          <p className="text-yellow-700 text-sm">
            {getGestureHint(targetGesture)}
          </p>
        </div>
      )}
    </div>
  );
}

function getGestureHint(gesture: string): string {
  const hints: { [key: string]: string } = {
    'A': 'Make a fist with your thumb on the side, not tucked inside.',
    'B': 'Hold your hand flat with fingers together and straight up, thumb tucked across palm.',
    'C': 'Curve your hand like you\'re holding a small cup.',
    'D': 'Point your index finger up while other fingers touch your thumb.',
    'E': 'Curl all fingers down to touch your thumb, forming a claw shape.',
    'F': 'Touch your thumb to your index finger, other fingers straight up.',
    'G': 'Point your index finger and thumb horizontally, like making a gun shape.',
    'H': 'Extend your index and middle fingers horizontally, side by side.',
    'I': 'Make a fist with your pinky finger extended straight up.',
    'J': 'Make the "I" sign and draw a J in the air with your pinky.',
    'K': 'Point your index and middle fingers up in a V, with thumb between them.',
    'L': 'Make an L shape with your thumb and index finger.',
    'M': 'Make a fist with your thumb under your first three fingers.',
    'N': 'Make a fist with your thumb under your first two fingers.',
    'O': 'Make a circle with all your fingers and thumb.',
    'P': 'Like K but pointing downward.',
    'Q': 'Like G but pointing downward.',
    'R': 'Cross your index and middle fingers.',
    'S': 'Make a fist with your thumb over your fingers.',
    'T': 'Make a fist with your thumb between your index and middle fingers.',
    'U': 'Extend your index and middle fingers straight up together.',
    'V': 'Make a peace sign with your index and middle fingers.',
    'W': 'Extend your index, middle, and ring fingers.',
    'X': 'Make a fist and curve your index finger like a hook.',
    'Y': 'Extend your thumb and pinky, fold other fingers down.',
    'Z': 'Draw a Z in the air with your index finger.',
    'HELLO': 'Wave your open hand with fingers extended.',
    'THANK': 'Touch your chin with your fingertips, then move hand forward.',
    'PLEASE': 'Rub your open palm in a circle on your chest.',
    'SORRY': 'Make a fist and rub it in a circle on your chest.',
  };

  return hints[gesture.toUpperCase()] || 'Practice the hand shape slowly and hold it steady for recognition.';
}
