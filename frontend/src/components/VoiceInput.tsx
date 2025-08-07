'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, Languages } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  className?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: SpeechGrammarList;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: (event: any) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onstart: () => void;
  onend: () => void;
  onsoundstart: () => void;
  onsoundend: () => void;
  onspeechstart: () => void;
  onspeechend: () => void;
  onnomatch: () => void;
  onaudiostart: () => void;
  onaudioend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
  { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱' },
  { code: 'sv-SE', name: 'Swedish', flag: '🇸🇪' },
  { code: 'da-DK', name: 'Danish', flag: '🇩🇰' },
  { code: 'no-NO', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'pl-PL', name: 'Polish', flag: '🇵🇱' },
  { code: 'cs-CZ', name: 'Czech', flag: '🇨🇿' },
  { code: 'hu-HU', name: 'Hungarian', flag: '🇭🇺' },
];

export default function VoiceInput({
  onTranscript,
  onError,
  language = 'en-US',
  continuous = true,
  interimResults = true,
  maxAlternatives = 3,
  className = ''
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [showSettings, setShowSettings] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [autoStop, setAutoStop] = useState(true);
  const [alternatives, setAlternatives] = useState<SpeechRecognitionAlternative[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();
  const silenceTimeoutRef = useRef<NodeJS.Timeout>();

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      setupRecognition();
    }

    return () => {
      cleanup();
    };
  }, []);

  // Update language when prop changes
  useEffect(() => {
    setSelectedLanguage(language);
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
    }
  }, [language]);

  const setupRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    const recognition = recognitionRef.current;
    
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = selectedLanguage;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      setIsListening(true);
      setupAudioAnalysis();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      const currentAlternatives: SpeechRecognitionAlternative[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        // Collect alternatives
        for (let j = 0; j < result.length; j++) {
          currentAlternatives.push({
            transcript: result[j].transcript,
            confidence: result[j].confidence
          });
        }

        if (result.isFinal) {
          finalTranscript += transcript;
          setConfidence(confidence);
          resetSilenceTimeout();
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript + interimTranscript;
      setCurrentTranscript(fullTranscript);
      setAlternatives(currentAlternatives.slice(0, maxAlternatives));
      
      onTranscript(fullTranscript, !!finalTranscript);

      // Auto-stop after silence
      if (autoStop && finalTranscript) {
        setSilenceTimeout();
      }
    };

    recognition.onerror = (event: any) => {
      const errorMessage = getErrorMessage(event.error);
      onError?.(errorMessage);
      setIsListening(false);
      cleanup();
    };

    recognition.onend = () => {
      setIsListening(false);
      setAudioLevel(0);
      cleanup();
    };

    recognition.onsoundstart = () => {
      // Sound detected
    };

    recognition.onsoundend = () => {
      // Sound ended
    };

    recognition.onspeechstart = () => {
      clearSilenceTimeout();
    };

    recognition.onspeechend = () => {
      setSilenceTimeout();
    };
  }, [selectedLanguage, continuous, interimResults, maxAlternatives, onTranscript, onError, autoStop]);

  const setupAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: noiseReduction,
          noiseSuppression: noiseReduction,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

      analyserRef.current.fftSize = 256;
      microphoneRef.current.connect(analyserRef.current);

      analyzeAudio();
    } catch (error) {
      console.warn('Could not setup audio analysis:', error);
    }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  const setSilenceTimeout = () => {
    clearSilenceTimeout();
    silenceTimeoutRef.current = setTimeout(() => {
      if (autoStop && isListening) {
        stopListening();
      }
    }, 3000); // Stop after 3 seconds of silence
  };

  const resetSilenceTimeout = () => {
    clearSilenceTimeout();
    setSilenceTimeout();
  };

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = undefined;
    }
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    clearSilenceTimeout();
    setAudioLevel(0);
  };

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;

    try {
      setCurrentTranscript('');
      setConfidence(0);
      setAlternatives([]);
      recognitionRef.current.start();
    } catch (error) {
      onError?.('Failed to start voice recognition');
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      onError?.('Failed to stop voice recognition');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'no-speech':
        return 'No speech was detected';
      case 'audio-capture':
        return 'Audio capture failed';
      case 'not-allowed':
        return 'Permission to use microphone was denied';
      case 'network':
        return 'Network error occurred';
      case 'language-not-supported':
        return 'Language not supported';
      case 'service-not-allowed':
        return 'Speech recognition service not allowed';
      default:
        return `Speech recognition error: ${error}`;
    }
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    if (recognitionRef.current) {
      recognitionRef.current.lang = langCode;
    }
    if (isListening) {
      stopListening();
      setTimeout(startListening, 100);
    }
  };

  const getCurrentLanguage = () => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);
  };

  if (!isSupported) {
    return (
      <div className={`voice-input-unsupported ${className}`}>
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <VolumeX className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Voice input not supported</p>
            <p className="text-xs text-yellow-600 mt-1">
              Please use a modern browser like Chrome, Firefox, or Safari
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-input ${className}`}>
      {/* Main Voice Input Controls */}
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Microphone Button */}
        <button
          onClick={toggleListening}
          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>

        {/* Audio Level Indicator */}
        {isListening && (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-8 rounded-full transition-all duration-100 ${
                  audioLevel * 5 > i ? 'bg-green-500' : 'bg-gray-200'
                }`}
                style={{
                  height: `${Math.max(8, audioLevel * 40)}px`
                }}
              />
            ))}
          </div>
        )}

        {/* Language Selection */}
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-gray-500" />
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          aria-label="Voice settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Noise Reduction
              </label>
              <input
                type="checkbox"
                checked={noiseReduction}
                onChange={(e) => setNoiseReduction(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Auto Stop
              </label>
              <input
                type="checkbox"
                checked={autoStop}
                onChange={(e) => setAutoStop(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Current Transcript */}
      {currentTranscript && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">
              {isListening ? 'Listening...' : 'Last transcript:'}
            </span>
            {confidence > 0 && (
              <span className="text-xs text-blue-600">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          <p className="text-blue-900">{currentTranscript}</p>
        </div>
      )}

      {/* Alternative Transcripts */}
      {alternatives.length > 1 && (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Alternative interpretations:
          </h4>
          <div className="space-y-1">
            {alternatives.slice(1).map((alt, index) => (
              <button
                key={index}
                onClick={() => onTranscript(alt.transcript, true)}
                className="block w-full text-left p-2 text-sm text-gray-600 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
              >
                {alt.transcript}
                <span className="float-right text-xs text-gray-400">
                  {Math.round(alt.confidence * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Indicators */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`}
          />
          <span>{isListening ? 'Listening' : 'Ready'}</span>
        </div>
        
        {getCurrentLanguage() && (
          <div className="flex items-center gap-1">
            <span>{getCurrentLanguage()?.flag}</span>
            <span>{getCurrentLanguage()?.name}</span>
          </div>
        )}

        {audioLevel > 0 && (
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            <span>Volume: {Math.round(audioLevel * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}