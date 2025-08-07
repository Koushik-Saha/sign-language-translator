import React, { useState, useEffect, useRef, useCallback } from 'react';
import './EmotionalAvatar.css';

interface EmotionParameters {
  emotion: string;
  intensity: 'low' | 'medium' | 'high';
  features: {
    eyebrows?: {
      position: string;
      animation?: string;
      [key: string]: any;
    };
    eyes?: {
      shape: string;
      sparkle?: boolean;
      [key: string]: any;
    };
    mouth?: {
      shape: string;
      corners?: string;
      [key: string]: any;
    };
    cheeks?: {
      lift?: string;
      dimples?: boolean;
      [key: string]: any;
    };
    [key: string]: any;
  };
  duration: {
    min: number;
    max: number;
  };
}

interface EmotionSequenceItem {
  index: number;
  emotion: string;
  intensity: 'low' | 'medium' | 'high';
  duration: number;
  startTime: number;
  confidence: number;
  isTransition?: boolean;
}

interface EmotionalAvatarProps {
  currentText?: string;
  context?: 'general' | 'greetings' | 'questions' | 'commands' | 'expressions' | 'negations' | 'emergency' | 'learning' | 'social';
  signSequence?: Array<{
    word: string;
    duration: number;
  }>;
  autoAnalyzeEmotion?: boolean;
  defaultEmotion?: string;
  size?: 'small' | 'medium' | 'large';
  showEmotionControls?: boolean;
  onEmotionChange?: (emotion: string, intensity: string) => void;
  className?: string;
}

interface EmotionAnalysis {
  emotion: string;
  intensity: 'low' | 'medium' | 'high';
  confidence: number;
  context: string;
  alternatives?: string[];
}

const EmotionalAvatar: React.FC<EmotionalAvatarProps> = ({
  currentText = '',
  context = 'general',
  signSequence = [],
  autoAnalyzeEmotion = true,
  defaultEmotion = 'NEUTRAL',
  size = 'medium',
  showEmotionControls = false,
  onEmotionChange,
  className = ''
}) => {
  const [currentEmotion, setCurrentEmotion] = useState<string>(defaultEmotion);
  const [currentIntensity, setCurrentIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [emotionParameters, setEmotionParameters] = useState<EmotionParameters | null>(null);
  const [emotionSequence, setEmotionSequence] = useState<EmotionSequenceItem[]>([]);
  const [isSequencePlaying, setIsSequencePlaying] = useState<boolean>(false);
  const [availableEmotions, setAvailableEmotions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const animationFrameRef = useRef<number>();
  const sequenceTimeoutRef = useRef<NodeJS.Timeout>();
  const lastAnalyzedTextRef = useRef<string>('');

  // Load available emotions on mount\n  useEffect(() => {\n    const loadAvailableEmotions = async () => {\n      try {\n        const response = await fetch('/api/facial-expressions/emotions');\n        const data = await response.json();\n        \n        if (data.success) {\n          setAvailableEmotions(data.data.emotions.map((e: any) => e.name));\n        }\n      } catch (error) {\n        console.error('Error loading emotions:', error);\n      }\n    };\n\n    loadAvailableEmotions();\n  }, []);\n\n  // Auto-analyze emotion when text changes\n  useEffect(() => {\n    if (autoAnalyzeEmotion && currentText && currentText !== lastAnalyzedTextRef.current) {\n      analyzeTextEmotion(currentText);\n      lastAnalyzedTextRef.current = currentText;\n    }\n  }, [currentText, autoAnalyzeEmotion, context]);\n\n  // Generate emotion sequence when sign sequence changes\n  useEffect(() => {\n    if (signSequence.length > 0) {\n      generateEmotionSequence(signSequence);\n    }\n  }, [signSequence, context]);\n\n  // Load emotion parameters when emotion or intensity changes\n  useEffect(() => {\n    if (currentEmotion) {\n      loadEmotionParameters(currentEmotion, currentIntensity);\n    }\n  }, [currentEmotion, currentIntensity]);\n\n  const analyzeTextEmotion = async (text: string) => {\n    if (!text.trim()) return;\n    \n    setLoading(true);\n    setError('');\n    \n    try {\n      const response = await fetch('/api/facial-expressions/analyze', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n        },\n        body: JSON.stringify({ text, context }),\n      });\n      \n      const data = await response.json();\n      \n      if (data.success) {\n        const analysis: EmotionAnalysis = data.data;\n        setCurrentEmotion(analysis.emotion);\n        setCurrentIntensity(analysis.intensity);\n        \n        if (onEmotionChange) {\n          onEmotionChange(analysis.emotion, analysis.intensity);\n        }\n      } else {\n        setError(data.message || 'Failed to analyze emotion');\n      }\n    } catch (error) {\n      setError('Network error during emotion analysis');\n      console.error('Emotion analysis error:', error);\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const generateEmotionSequence = async (sequence: Array<{ word: string; duration: number }>) => {\n    if (sequence.length === 0) return;\n    \n    setLoading(true);\n    setError('');\n    \n    try {\n      const response = await fetch('/api/facial-expressions/sequence', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n        },\n        body: JSON.stringify({\n          signSequence: sequence,\n          context\n        }),\n      });\n      \n      const data = await response.json();\n      \n      if (data.success) {\n        setEmotionSequence(data.data.emotionSequence);\n      } else {\n        setError(data.message || 'Failed to generate emotion sequence');\n      }\n    } catch (error) {\n      setError('Network error during sequence generation');\n      console.error('Emotion sequence error:', error);\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const loadEmotionParameters = async (emotion: string, intensity: 'low' | 'medium' | 'high') => {\n    try {\n      const response = await fetch(`/api/facial-expressions/parameters/${emotion}?intensity=${intensity}`);\n      const data = await response.json();\n      \n      if (data.success) {\n        setEmotionParameters(data.data);\n      }\n    } catch (error) {\n      console.error('Error loading emotion parameters:', error);\n    }\n  };\n\n  const playEmotionSequence = useCallback(() => {\n    if (emotionSequence.length === 0) return;\n    \n    setIsSequencePlaying(true);\n    let currentIndex = 0;\n    \n    const playNextEmotion = () => {\n      if (currentIndex >= emotionSequence.length) {\n        setIsSequencePlaying(false);\n        return;\n      }\n      \n      const emotionItem = emotionSequence[currentIndex];\n      setCurrentEmotion(emotionItem.emotion);\n      setCurrentIntensity(emotionItem.intensity);\n      \n      if (onEmotionChange) {\n        onEmotionChange(emotionItem.emotion, emotionItem.intensity);\n      }\n      \n      sequenceTimeoutRef.current = setTimeout(() => {\n        currentIndex++;\n        playNextEmotion();\n      }, emotionItem.duration);\n    };\n    \n    playNextEmotion();\n  }, [emotionSequence, onEmotionChange]);\n\n  const stopEmotionSequence = () => {\n    setIsSequencePlaying(false);\n    if (sequenceTimeoutRef.current) {\n      clearTimeout(sequenceTimeoutRef.current);\n    }\n  };\n\n  const manuallySetEmotion = (emotion: string, intensity: 'low' | 'medium' | 'high' = 'medium') => {\n    if (isSequencePlaying) {\n      stopEmotionSequence();\n    }\n    \n    setCurrentEmotion(emotion);\n    setCurrentIntensity(intensity);\n    \n    if (onEmotionChange) {\n      onEmotionChange(emotion, intensity);\n    }\n  };\n\n  const getAvatarStyle = () => {\n    const baseStyle: React.CSSProperties = {};\n    \n    if (emotionParameters) {\n      const features = emotionParameters.features;\n      \n      // Apply emotion-based styling\n      if (features.eyes) {\n        if (features.eyes.shape === 'crescent') {\n          baseStyle.filter = (baseStyle.filter || '') + ' brightness(1.1)';\n        } else if (features.eyes.shape === 'wide') {\n          baseStyle.transform = (baseStyle.transform || '') + ' scale(1.05)';\n        }\n      }\n      \n      if (features.mouth) {\n        if (features.mouth.shape === 'smile') {\n          baseStyle.filter = (baseStyle.filter || '') + ' hue-rotate(10deg)';\n        } else if (features.mouth.shape === 'frown') {\n          baseStyle.filter = (baseStyle.filter || '') + ' hue-rotate(-10deg) brightness(0.95)';\n        }\n      }\n    }\n    \n    return baseStyle;\n  };\n\n  const getEmotionColor = (emotion: string): string => {\n    const emotionColors: { [key: string]: string } = {\n      'HAPPY': '#FFD700',\n      'SAD': '#4169E1',\n      'ANGRY': '#DC143C',\n      'SURPRISED': '#FF6347',\n      'FEARFUL': '#9370DB',\n      'DISGUSTED': '#32CD32',\n      'NEUTRAL': '#808080',\n      'THINKING': '#4682B4',\n      'CONFUSED': '#DAA520'\n    };\n    \n    return emotionColors[emotion] || '#808080';\n  };\n\n  const getIntensityOpacity = (intensity: 'low' | 'medium' | 'high'): number => {\n    switch (intensity) {\n      case 'low': return 0.6;\n      case 'medium': return 0.8;\n      case 'high': return 1.0;\n      default: return 0.8;\n    }\n  };\n\n  // Cleanup on unmount\n  useEffect(() => {\n    return () => {\n      if (animationFrameRef.current) {\n        cancelAnimationFrame(animationFrameRef.current);\n      }\n      if (sequenceTimeoutRef.current) {\n        clearTimeout(sequenceTimeoutRef.current);\n      }\n    };\n  }, []);\n\n  return (\n    <div className={`emotional-avatar ${size} ${className}`}>\n      {/* Avatar Display */}\n      <div \n        className=\"avatar-container\"\n        style={{\n          ...getAvatarStyle(),\n          borderColor: getEmotionColor(currentEmotion),\n          opacity: getIntensityOpacity(currentIntensity)\n        }}\n      >\n        <div className=\"avatar-face\">\n          {/* Basic avatar representation */}\n          <div className=\"avatar-base\">\n            <div className=\"face-outline\">\n              <div className={`eyes ${currentEmotion.toLowerCase()}`}>\n                <div className=\"eye left-eye\"></div>\n                <div className=\"eye right-eye\"></div>\n              </div>\n              <div className={`mouth ${currentEmotion.toLowerCase()}`}></div>\n              <div className={`eyebrows ${currentEmotion.toLowerCase()}`}>\n                <div className=\"eyebrow left-eyebrow\"></div>\n                <div className=\"eyebrow right-eyebrow\"></div>\n              </div>\n            </div>\n          </div>\n          \n          {/* Emotion indicator */}\n          <div className=\"emotion-indicator\">\n            <div \n              className=\"emotion-dot\"\n              style={{ backgroundColor: getEmotionColor(currentEmotion) }}\n            ></div>\n          </div>\n        </div>\n        \n        {loading && (\n          <div className=\"loading-overlay\">\n            <div className=\"loading-spinner\"></div>\n          </div>\n        )}\n      </div>\n      \n      {/* Current Emotion Display */}\n      <div className=\"current-emotion-display\">\n        <span className=\"emotion-name\">{currentEmotion}</span>\n        <span className=\"emotion-intensity\">{currentIntensity}</span>\n        {emotionParameters && (\n          <span className=\"emotion-confidence\">\n            {Math.round(emotionParameters.features ? 85 : 50)}%\n          </span>\n        )}\n      </div>\n      \n      {/* Error Display */}\n      {error && (\n        <div className=\"error-message\">\n          {error}\n        </div>\n      )}\n      \n      {/* Manual Controls (if enabled) */}\n      {showEmotionControls && (\n        <div className=\"emotion-controls\">\n          <div className=\"emotion-selector\">\n            <label>Emotion:</label>\n            <select \n              value={currentEmotion} \n              onChange={(e) => manuallySetEmotion(e.target.value, currentIntensity)}\n            >\n              {availableEmotions.map(emotion => (\n                <option key={emotion} value={emotion}>\n                  {emotion.charAt(0) + emotion.slice(1).toLowerCase()}\n                </option>\n              ))}\n            </select>\n          </div>\n          \n          <div className=\"intensity-selector\">\n            <label>Intensity:</label>\n            <select \n              value={currentIntensity} \n              onChange={(e) => manuallySetEmotion(currentEmotion, e.target.value as 'low' | 'medium' | 'high')}\n            >\n              <option value=\"low\">Low</option>\n              <option value=\"medium\">Medium</option>\n              <option value=\"high\">High</option>\n            </select>\n          </div>\n          \n          {emotionSequence.length > 0 && (\n            <div className=\"sequence-controls\">\n              <button \n                onClick={playEmotionSequence} \n                disabled={isSequencePlaying}\n              >\n                {isSequencePlaying ? 'Playing...' : 'Play Sequence'}\n              </button>\n              <button \n                onClick={stopEmotionSequence} \n                disabled={!isSequencePlaying}\n              >\n                Stop\n              </button>\n            </div>\n          )}\n        </div>\n      )}\n      \n      {/* Sequence Progress */}\n      {isSequencePlaying && emotionSequence.length > 0 && (\n        <div className=\"sequence-progress\">\n          <div className=\"progress-bar\">\n            {emotionSequence.map((item, index) => (\n              <div\n                key={index}\n                className={`progress-segment ${item.emotion.toLowerCase()}`}\n                style={{ \n                  width: `${(item.duration / emotionSequence.reduce((sum, i) => sum + i.duration, 0)) * 100}%`,\n                  backgroundColor: getEmotionColor(item.emotion),\n                  opacity: getIntensityOpacity(item.intensity)\n                }}\n              >\n                <span className=\"segment-label\">{item.emotion.charAt(0)}</span>\n              </div>\n            ))}\n          </div>\n        </div>\n      )}\n    </div>\n  );\n};\n\nexport default EmotionalAvatar;