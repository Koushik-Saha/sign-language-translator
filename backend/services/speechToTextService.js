const speech = require('@google-cloud/speech');
const { SpeechConfig, SpeechRecognizer, AudioConfig, ResultReason } = require('microsoft-cognitiveservices-speech-sdk');
const recorder = require('node-record-lpcm16');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { EventEmitter } = require('events');

class SpeechToTextService extends EventEmitter {
    constructor() {
        super();
        this.googleClient = null;
        this.azureConfig = null;
        this.activeRecognizers = new Map();
        this.initializeProviders();
    }

    async initializeProviders() {
        try {
            // Initialize Google Speech-to-Text
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                this.googleClient = new speech.SpeechClient();
                logger.info('Google Speech-to-Text client initialized');
            }

            // Initialize Azure Speech Services
            if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
                this.azureConfig = SpeechConfig.fromSubscription(
                    process.env.AZURE_SPEECH_KEY,
                    process.env.AZURE_SPEECH_REGION
                );
                logger.info('Azure Speech Services initialized');
            }

            if (!this.googleClient && !this.azureConfig) {
                logger.warn('No speech recognition providers configured. Using browser Web Speech API as fallback.');
            }

        } catch (error) {
            logger.error('Failed to initialize speech recognition providers', { error: error.message });
        }
    }

    async transcribeAudioFile(audioFilePath, options = {}) {
        const {
            provider = 'auto',
            language = 'en-US',
            encoding = 'LINEAR16',
            sampleRateHertz = 16000,
            enableAutomaticPunctuation = true,
            enableWordTimeOffsets = true
        } = options;

        try {
            const audioBytes = await fs.readFile(audioFilePath);
            
            if (provider === 'google' || (provider === 'auto' && this.googleClient)) {
                return await this.transcribeWithGoogle(audioBytes, {
                    language,
                    encoding,
                    sampleRateHertz,
                    enableAutomaticPunctuation,
                    enableWordTimeOffsets
                });
            } else if (provider === 'azure' || (provider === 'auto' && this.azureConfig)) {
                return await this.transcribeWithAzure(audioFilePath, { language });
            } else {
                throw new Error('No speech recognition provider available');
            }

        } catch (error) {
            logger.error('Audio transcription failed', {
                audioFilePath,
                provider,
                error: error.message
            });
            throw error;
        }
    }

    async transcribeWithGoogle(audioBytes, options) {
        if (!this.googleClient) {
            throw new Error('Google Speech client not initialized');
        }

        const audio = {
            content: audioBytes.toString('base64'),
        };

        const config = {
            encoding: options.encoding,
            sampleRateHertz: options.sampleRateHertz,
            languageCode: options.language,
            enableAutomaticPunctuation: options.enableAutomaticPunctuation,
            enableWordTimeOffsets: options.enableWordTimeOffsets,
            model: 'latest_long',
            useEnhanced: true,
        };

        const request = {
            audio: audio,
            config: config,
        };

        const [response] = await this.googleClient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0])
            .filter(alternative => alternative.transcript);

        return {
            provider: 'google',
            transcripts: transcription.map(alt => ({
                text: alt.transcript,
                confidence: alt.confidence,
                words: alt.words?.map(word => ({
                    word: word.word,
                    startTime: word.startTime,
                    endTime: word.endTime,
                    confidence: word.confidence
                })) || []
            })),
            fullTranscript: transcription.map(alt => alt.transcript).join(' '),
            metadata: {
                language: options.language,
                duration: transcription.reduce((max, alt) => {
                    if (alt.words && alt.words.length > 0) {
                        const lastWord = alt.words[alt.words.length - 1];
                        const endTime = parseFloat(lastWord.endTime?.seconds || 0) + 
                                      parseFloat(lastWord.endTime?.nanos || 0) / 1e9;
                        return Math.max(max, endTime);
                    }
                    return max;
                }, 0)
            }
        };
    }

    async transcribeWithAzure(audioFilePath, options) {
        if (!this.azureConfig) {
            throw new Error('Azure Speech config not initialized');
        }

        return new Promise((resolve, reject) => {
            this.azureConfig.speechRecognitionLanguage = options.language;
            
            const audioConfig = AudioConfig.fromWavFileInput(audioFilePath);
            const recognizer = new SpeechRecognizer(this.azureConfig, audioConfig);

            const results = [];
            let fullTranscript = '';

            recognizer.recognizing = (s, e) => {
                // Real-time recognition results
                this.emit('recognizing', {
                    text: e.result.text,
                    reason: e.result.reason
                });
            };

            recognizer.recognized = (s, e) => {
                if (e.result.reason === ResultReason.RecognizedSpeech) {
                    results.push({
                        text: e.result.text,
                        confidence: e.result.properties ? 
                            parseFloat(e.result.properties.getProperty('Speech.Result.Confidence')) : 1.0,
                        duration: e.result.duration,
                        offset: e.result.offset
                    });
                    fullTranscript += e.result.text + ' ';
                }
            };

            recognizer.canceled = (s, e) => {
                recognizer.stopContinuousRecognitionAsync();
                reject(new Error(`Recognition canceled: ${e.errorDetails}`));
            };

            recognizer.sessionStopped = (s, e) => {
                recognizer.stopContinuousRecognitionAsync();
                resolve({
                    provider: 'azure',
                    transcripts: results,
                    fullTranscript: fullTranscript.trim(),
                    metadata: {
                        language: options.language,
                        resultCount: results.length
                    }
                });
            };

            recognizer.startContinuousRecognitionAsync();
        });
    }

    startRealtimeRecognition(sessionId, options = {}) {
        const {
            provider = 'auto',
            language = 'en-US',
            continuous = true,
            interimResults = true
        } = options;

        try {
            if (this.activeRecognizers.has(sessionId)) {
                throw new Error(`Recognition session ${sessionId} already active`);
            }

            const recognitionSession = {
                sessionId,
                startTime: Date.now(),
                provider,
                language,
                status: 'starting'
            };

            this.activeRecognizers.set(sessionId, recognitionSession);

            if (provider === 'azure' || (provider === 'auto' && this.azureConfig)) {
                this.startAzureRealtimeRecognition(sessionId, options);
            } else {
                // Fallback to browser-based recognition (requires client-side implementation)
                this.startBrowserRealtimeRecognition(sessionId, options);
            }

            logger.info('Started real-time speech recognition', {
                sessionId,
                provider,
                language
            });

            return { success: true, sessionId };

        } catch (error) {
            logger.error('Failed to start real-time recognition', {
                sessionId,
                error: error.message
            });
            throw error;
        }
    }

    startAzureRealtimeRecognition(sessionId, options) {
        const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new SpeechRecognizer(this.azureConfig, audioConfig);

        const session = this.activeRecognizers.get(sessionId);
        session.recognizer = recognizer;
        session.status = 'listening';

        recognizer.recognizing = (s, e) => {
            this.emit('partialResult', {
                sessionId,
                text: e.result.text,
                confidence: 0.5, // Interim results have lower confidence
                interim: true,
                timestamp: Date.now()
            });
        };

        recognizer.recognized = (s, e) => {
            if (e.result.reason === ResultReason.RecognizedSpeech) {
                this.emit('result', {
                    sessionId,
                    text: e.result.text,
                    confidence: e.result.properties ? 
                        parseFloat(e.result.properties.getProperty('Speech.Result.Confidence')) : 1.0,
                    interim: false,
                    timestamp: Date.now(),
                    duration: e.result.duration,
                    offset: e.result.offset
                });
            }
        };

        recognizer.canceled = (s, e) => {
            session.status = 'error';
            this.emit('error', {
                sessionId,
                error: e.errorDetails,
                timestamp: Date.now()
            });
        };

        recognizer.sessionStopped = (s, e) => {
            session.status = 'stopped';
            this.emit('stopped', {
                sessionId,
                timestamp: Date.now()
            });
        };

        recognizer.startContinuousRecognitionAsync();
    }

    startBrowserRealtimeRecognition(sessionId, options) {
        // This would typically be handled on the client side
        // Here we provide the configuration for browser-based recognition
        const session = this.activeRecognizers.get(sessionId);
        session.status = 'listening';
        session.browserConfig = {
            continuous: options.continuous,
            interimResults: options.interimResults,
            language: options.language,
            maxAlternatives: 3
        };

        this.emit('browserConfigReady', {
            sessionId,
            config: session.browserConfig
        });
    }

    stopRealtimeRecognition(sessionId) {
        const session = this.activeRecognizers.get(sessionId);
        
        if (!session) {
            throw new Error(`No active recognition session found: ${sessionId}`);
        }

        if (session.recognizer) {
            session.recognizer.stopContinuousRecognitionAsync();
        }

        session.status = 'stopped';
        session.endTime = Date.now();

        this.activeRecognizers.delete(sessionId);

        logger.info('Stopped real-time speech recognition', {
            sessionId,
            duration: session.endTime - session.startTime
        });

        return { success: true, sessionId };
    }

    getActiveRecognitionSessions() {
        return Array.from(this.activeRecognizers.values()).map(session => ({
            sessionId: session.sessionId,
            status: session.status,
            provider: session.provider,
            language: session.language,
            duration: Date.now() - session.startTime
        }));
    }

    async processVoiceCommand(audioData, context = {}) {
        try {
            // Transcribe the voice command
            const transcription = await this.transcribeAudioBuffer(audioData, {
                language: context.language || 'en-US',
                enableAutomaticPunctuation: false // Commands don't need punctuation
            });

            const command = this.parseVoiceCommand(transcription.fullTranscript, context);
            
            return {
                success: true,
                transcript: transcription.fullTranscript,
                command,
                confidence: transcription.transcripts[0]?.confidence || 0
            };

        } catch (error) {
            logger.error('Voice command processing failed', {
                context,
                error: error.message
            });
            throw error;
        }
    }

    parseVoiceCommand(transcript, context) {
        const text = transcript.toLowerCase().trim();
        
        // Define voice commands
        const commands = {
            translation: {
                patterns: [
                    /^translate (.+)$/,
                    /^sign (.+)$/,
                    /^how do you sign (.+)$/
                ],
                action: 'translate_text',
                extract: (matches) => ({ text: matches[1] })
            },
            navigation: {
                patterns: [
                    /^go to (.+)$/,
                    /^open (.+)$/,
                    /^navigate to (.+)$/
                ],
                action: 'navigate',
                extract: (matches) => ({ page: matches[1] })
            },
            settings: {
                patterns: [
                    /^change language to (.+)$/,
                    /^set language (.+)$/,
                    /^switch to (.+) sign language$/
                ],
                action: 'change_language',
                extract: (matches) => ({ language: matches[1] })
            },
            recording: {
                patterns: [
                    /^start recording$/,
                    /^begin recording$/,
                    /^record$/
                ],
                action: 'start_recording'
            },
            help: {
                patterns: [
                    /^help$/,
                    /^what can you do$/,
                    /^show commands$/
                ],
                action: 'show_help'
            }
        };

        // Try to match against command patterns
        for (const [category, commandDef] of Object.entries(commands)) {
            for (const pattern of commandDef.patterns) {
                const matches = text.match(pattern);
                if (matches) {
                    const command = {
                        category,
                        action: commandDef.action,
                        confidence: 0.9
                    };

                    if (commandDef.extract) {
                        command.parameters = commandDef.extract(matches);
                    }

                    return command;
                }
            }
        }

        // If no specific command found, treat as general text for translation
        return {
            category: 'translation',
            action: 'translate_text',
            parameters: { text: transcript },
            confidence: 0.7
        };
    }

    async transcribeAudioBuffer(audioBuffer, options = {}) {
        // Convert buffer to temporary file for processing
        const tempFilePath = path.join(__dirname, '../temp', `audio_${Date.now()}.wav`);
        
        try {
            await fs.writeFile(tempFilePath, audioBuffer);
            const result = await this.transcribeAudioFile(tempFilePath, options);
            return result;
        } finally {
            // Clean up temporary file
            try {
                await fs.unlink(tempFilePath);
            } catch (unlinkError) {
                logger.warn('Failed to clean up temporary audio file', {
                    file: tempFilePath,
                    error: unlinkError.message
                });
            }
        }
    }

    getSupportedLanguages() {
        return {
            google: [
                'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 
                'pt-PT', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA'
            ],
            azure: [
                'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT',
                'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA'
            ],
            browser: [
                'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT',
                'pt-PT', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN'
            ]
        };
    }

    getProviderStatus() {
        return {
            google: !!this.googleClient,
            azure: !!this.azureConfig,
            activeRecognitions: this.activeRecognizers.size
        };
    }
}

module.exports = new SpeechToTextService();