import React, { useState, useRef, useEffect, useCallback } from 'react';
import EmotionalAvatar from './EmotionalAvatar';
import './CallRecorder.css';

interface OverlaySettings {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  size: 'small' | 'medium' | 'large';
  transparency: number;
  showEmotions: boolean;
  showConfidence: boolean;
  signLanguage: 'ASL' | 'BSL' | 'LSF' | 'ISL' | 'AUSLAN';
  theme: 'light' | 'dark' | 'auto';
}

interface RecordingStatus {
  recordingId: string;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  duration?: number;
  progress?: number;
  currentStep?: string;
  transcription?: {
    fullText: string;
    confidence: number;
  };
  translation?: {
    totalGestures: number;
    averageConfidence: number;
  };
}

interface TranslationOverlay {
  timestamp: number;
  text: string;
  signSequence: Array<{
    word: string;
    duration: number;
    confidence: number;
  }>;
  emotions?: {
    primary: string;
    intensity: string;
    confidence: number;
  };
  confidence?: number;
}

interface CallRecorderProps {
  sessionId?: string;
  onRecordingStart?: (recordingId: string) => void;
  onRecordingStop?: (recordingId: string, duration: number) => void;
  onTranscriptionUpdate?: (text: string, confidence: number) => void;
  onError?: (error: string) => void;
  className?: string;
}

const CallRecorder: React.FC<CallRecorderProps> = ({
  sessionId = '',
  onRecordingStart,
  onRecordingStop,
  onTranscriptionUpdate,
  onError,
  className = ''
}) => {
  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingId, setRecordingId] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  
  // Media state
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  
  // Translation overlay state
  const [currentOverlay, setCurrentOverlay] = useState<TranslationOverlay | null>(null);
  const [overlayHistory, setOverlayHistory] = useState<TranslationOverlay[]>([]);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    enabled: true,
    position: 'bottom-right',
    size: 'medium',
    transparency: 0.8,
    showEmotions: true,
    showConfidence: true,
    signLanguage: 'BSL',
    theme: 'light'
  });
  
  // UI state
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<{
    audio: boolean;
    granted: boolean;
  }>({ audio: false, granted: false });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  const statusPollingRef = useRef<NodeJS.Timeout>();
  const audioChunksRef = useRef<Blob[]>([]);

  // Request microphone permissions
  const requestPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });
      
      setMediaStream(stream);
      setPermissions({ audio: true, granted: true });
      setError('');
      
      return stream;
    } catch (error: any) {
      const errorMessage = error.name === 'NotAllowedError' 
        ? 'Microphone access denied. Please allow microphone access to record calls.'
        : 'Error accessing microphone. Please check your device settings.';
      
      setError(errorMessage);
      if (onError) onError(errorMessage);
      setPermissions({ audio: false, granted: false });
      throw error;
    }
  }, [onError]);

  // Initialize audio processing
  const initializeAudioProcessing = useCallback(async (stream: MediaStream) => {
    try {
      const context = new AudioContext({ sampleRate: 48000 });
      const source = context.createMediaStreamSource(stream);
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = async (event) => {
        if (!isRecording) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert to PCM16
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Send audio chunk for processing
        if (recordingId) {
          try {
            await processAudioChunk(pcmData.buffer, Date.now());
          } catch (error) {
            console.warn('Audio processing error:', error);
          }
        }
      };
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(context.destination);
      
      setAudioContext(context);
      setProcessor(scriptProcessor);
    } catch (error: any) {
      setError('Error initializing audio processing: ' + error.message);
      throw error;
    }
  }, [isRecording, recordingId]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    
    try {
      setIsProcessing(true);
      setError('');
      
      // Get media stream if not available
      let stream = mediaStream;
      if (!stream) {
        stream = await requestPermissions();
      }
      
      // Initialize audio processing
      await initializeAudioProcessing(stream);
      
      // Start server-side recording
      const response = await fetch('/api/call-recording/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId: sessionId || `session_${Date.now()}`,
          overlaySettings,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
          },
          tags: ['web_recording', 'real_time_translation']
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start recording on server');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to start recording');
      }

      // Initialize media recorder for backup
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      
      // Update state
      setRecordingId(result.data.recordingId);
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1000);
      }, 1000);
      
      if (onRecordingStart) {
        onRecordingStart(result.data.recordingId);
      }
      
    } catch (error: any) {
      setError(error.message || 'Failed to start recording');
      if (onError) onError(error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [
    isRecording, 
    mediaStream, 
    sessionId, 
    overlaySettings, 
    requestPermissions, 
    initializeAudioProcessing,
    onRecordingStart,
    onError
  ]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!isRecording || !recordingId) return;
    
    try {
      setIsProcessing(true);
      
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop audio processing
      if (processor && audioContext) {
        processor.disconnect();
        audioContext.close();
        setProcessor(null);
        setAudioContext(null);
      }
      
      // Clear intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      // Stop server-side recording
      const response = await fetch('/api/call-recording/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ recordingId })
      });

      if (!response.ok) {
        throw new Error('Failed to stop recording on server');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to stop recording');
      }

      // Update state
      setIsRecording(false);
      
      if (onRecordingStop) {
        onRecordingStop(recordingId, recordingDuration);
      }
      
      // Start polling for processing status
      pollRecordingStatus(recordingId);
      
    } catch (error: any) {
      setError(error.message || 'Failed to stop recording');
      if (onError) onError(error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, recordingId, recordingDuration, processor, audioContext, onRecordingStop, onError]);

  // Process audio chunk
  const processAudioChunk = async (audioBuffer: ArrayBuffer, timestamp: number) => {
    if (!recordingId) return;
    
    try {
      // Convert to base64
      const audioArray = new Uint8Array(audioBuffer);
      const audioBase64 = btoa(String.fromCharCode(...audioArray));
      
      const response = await fetch('/api/call-recording/process-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          recordingId,
          audioChunk: audioBase64,
          timestamp
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data.overlay) {
          // Update overlay with real-time translation
          setCurrentOverlay(result.data.overlay);
          setOverlayHistory(prev => [...prev.slice(-4), result.data.overlay]);
        }
        
        if (result.data.transcription && onTranscriptionUpdate) {
          onTranscriptionUpdate(
            result.data.transcription.text,
            result.data.transcription.confidence
          );
        }
      }
    } catch (error) {
      console.warn('Audio chunk processing failed:', error);
    }
  };

  // Poll recording status during processing
  const pollRecordingStatus = (recordingId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/call-recording/status/${recordingId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setRecordingStatus(result.data);
            
            if (['completed', 'failed'].includes(result.data.status)) {
              if (statusPollingRef.current) {
                clearTimeout(statusPollingRef.current);
              }
              return;
            }
          }
        }
        
        // Continue polling
        statusPollingRef.current = setTimeout(poll, 2000);
      } catch (error) {
        console.warn('Status polling error:', error);
        statusPollingRef.current = setTimeout(poll, 5000);
      }
    };
    
    poll();
  };

  // Update overlay settings
  const updateOverlaySettings = async (newSettings: Partial<OverlaySettings>) => {
    const updatedSettings = { ...overlaySettings, ...newSettings };
    setOverlaySettings(updatedSettings);
    
    // If recording is active, update server-side settings
    if (recordingId) {
      try {
        const response = await fetch(`/api/call-recording/overlay-settings/${recordingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(newSettings)
        });
        
        if (!response.ok) {
          console.warn('Failed to update server-side overlay settings');
        }
      } catch (error) {
        console.warn('Error updating overlay settings:', error);
      }
    }
  };

  // Format duration display
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get overlay position styles
  const getOverlayPositionStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      opacity: overlaySettings.transparency
    };
    
    switch (overlaySettings.position) {
      case 'top-left':
        return { ...baseStyle, top: '20px', left: '20px' };
      case 'top-right':
        return { ...baseStyle, top: '20px', right: '20px' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '20px', left: '20px' };
      case 'bottom-right':
        return { ...baseStyle, bottom: '20px', right: '20px' };
      case 'center':
        return { 
          ...baseStyle, 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)' 
        };
      default:
        return { ...baseStyle, bottom: '20px', right: '20px' };
    }
  };

  // Initialize permissions on mount
  useEffect(() => {
    requestPermissions().catch(() => {
      // Permissions will be requested when recording starts
    });
  }, [requestPermissions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (statusPollingRef.current) {
        clearTimeout(statusPollingRef.current);
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [mediaStream, audioContext]);

  return (
    <div className={`call-recorder ${className}`}>
      {/* Main Recording Interface */}
      <div className=\"recording-interface\">
        <div className=\"recording-status\">
          <div className={`recording-indicator ${isRecording ? 'active' : ''}`}>
            <div className=\"recording-dot\"></div>
            <span className=\"recording-text\">
              {isRecording ? 'Recording' : 'Ready'}
            </span>
          </div>
          
          {isRecording && (
            <div className=\"recording-duration\">
              {formatDuration(recordingDuration)}
            </div>
          )}
        </div>
        
        <div className=\"recording-controls\">
          {!isRecording ? (
            <button
              className=\"record-button start\"
              onClick={startRecording}
              disabled={isProcessing || !permissions.granted}
            >
              {isProcessing ? 'Starting...' : 'Start Recording'}
            </button>
          ) : (
            <button
              className=\"record-button stop\"
              onClick={stopRecording}
              disabled={isProcessing}
            >
              {isProcessing ? 'Stopping...' : 'Stop Recording'}
            </button>
          )}
          
          <button
            className=\"settings-button\"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️
          </button>
        </div>
      </div>
      
      {/* Permission Request */}
      {!permissions.granted && (
        <div className=\"permission-request\">
          <p>Microphone access is required for call recording.</p>
          <button onClick={requestPermissions}>
            Grant Microphone Access
          </button>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className=\"error-message\">
          <span className=\"error-icon\">⚠️</span>
          {error}
        </div>
      )}
      
      {/* Translation Overlay */}
      {overlaySettings.enabled && currentOverlay && (
        <div
          className={`translation-overlay ${overlaySettings.size} ${overlaySettings.theme}`}
          style={getOverlayPositionStyles()}
        >
          <div className=\"overlay-content\">
            {/* Original Text */}
            <div className=\"original-text\">
              {currentOverlay.text}
            </div>
            
            {/* Sign Language Translation */}
            <div className=\"sign-translation\">
              {currentOverlay.signSequence.map((sign, index) => (
                <span key={index} className=\"sign-word\">
                  {sign.word}
                  {overlaySettings.showConfidence && (
                    <span className=\"confidence-score\">
                      {Math.round(sign.confidence * 100)}%
                    </span>
                  )}
                </span>
              ))}
            </div>
            
            {/* Emotional Avatar */}
            {overlaySettings.showEmotions && currentOverlay.emotions && (
              <div className=\"emotion-display\">
                <EmotionalAvatar
                  currentText={currentOverlay.text}
                  defaultEmotion={currentOverlay.emotions.primary}
                  size=\"small\"
                  showEmotionControls={false}
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Settings Panel */}
      {showSettings && (
        <div className=\"settings-panel\">
          <div className=\"settings-header\">
            <h3>Recording Settings</h3>
            <button onClick={() => setShowSettings(false)}>×</button>
          </div>
          
          <div className=\"settings-content\">
            {/* Overlay Settings */}
            <div className=\"setting-group\">
              <label>
                <input
                  type=\"checkbox\"
                  checked={overlaySettings.enabled}
                  onChange={(e) => updateOverlaySettings({ enabled: e.target.checked })}
                />
                Enable Translation Overlay
              </label>
            </div>
            
            {overlaySettings.enabled && (
              <>
                <div className=\"setting-group\">
                  <label>Position:</label>
                  <select
                    value={overlaySettings.position}
                    onChange={(e) => updateOverlaySettings({ position: e.target.value as any })}
                  >
                    <option value=\"top-left\">Top Left</option>
                    <option value=\"top-right\">Top Right</option>
                    <option value=\"bottom-left\">Bottom Left</option>
                    <option value=\"bottom-right\">Bottom Right</option>
                    <option value=\"center\">Center</option>
                  </select>
                </div>
                
                <div className=\"setting-group\">
                  <label>Size:</label>
                  <select
                    value={overlaySettings.size}
                    onChange={(e) => updateOverlaySettings({ size: e.target.value as any })}
                  >
                    <option value=\"small\">Small</option>
                    <option value=\"medium\">Medium</option>
                    <option value=\"large\">Large</option>
                  </select>
                </div>
                
                <div className=\"setting-group\">
                  <label>Sign Language:</label>
                  <select
                    value={overlaySettings.signLanguage}
                    onChange={(e) => updateOverlaySettings({ signLanguage: e.target.value as any })}
                  >
                    <option value=\"ASL\">ASL (American)</option>
                    <option value=\"BSL\">BSL (British)</option>
                    <option value=\"LSF\">LSF (French)</option>
                    <option value=\"ISL\">ISL (Irish)</option>
                    <option value=\"AUSLAN\">Auslan (Australian)</option>
                  </select>
                </div>
                
                <div className=\"setting-group\">
                  <label>
                    Transparency: {Math.round(overlaySettings.transparency * 100)}%
                  </label>
                  <input
                    type=\"range\"
                    min=\"0.1\"
                    max=\"1.0\"
                    step=\"0.1\"
                    value={overlaySettings.transparency}
                    onChange={(e) => updateOverlaySettings({ transparency: parseFloat(e.target.value) })}
                  />
                </div>
                
                <div className=\"setting-group\">
                  <label>
                    <input
                      type=\"checkbox\"
                      checked={overlaySettings.showEmotions}
                      onChange={(e) => updateOverlaySettings({ showEmotions: e.target.checked })}
                    />
                    Show Emotions
                  </label>
                </div>
                
                <div className=\"setting-group\">
                  <label>
                    <input
                      type=\"checkbox\"
                      checked={overlaySettings.showConfidence}
                      onChange={(e) => updateOverlaySettings({ showConfidence: e.target.checked })}
                    />
                    Show Confidence Scores
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Processing Status */}
      {recordingStatus && recordingStatus.status === 'processing' && (
        <div className=\"processing-status\">
          <div className=\"processing-header\">
            <h4>Processing Recording...</h4>
            <div className=\"progress-bar\">
              <div 
                className=\"progress-fill\"
                style={{ width: `${recordingStatus.progress || 0}%` }}
              ></div>
            </div>
          </div>
          
          <div className=\"processing-details\">
            <p>Current Step: {recordingStatus.currentStep || 'Starting'}</p>
            <p>Progress: {recordingStatus.progress || 0}%</p>
          </div>
        </div>
      )}
      
      {/* Recording Complete */}
      {recordingStatus && recordingStatus.status === 'completed' && (
        <div className=\"recording-complete\">
          <h4>Recording Complete!</h4>
          <div className=\"completion-stats\">
            {recordingStatus.transcription && (
              <p>Transcribed: {recordingStatus.transcription.fullText.length} characters</p>
            )}
            {recordingStatus.translation && (
              <p>Translated: {recordingStatus.translation.totalGestures} gestures</p>
            )}
          </div>
          <button onClick={() => setRecordingStatus(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default CallRecorder;