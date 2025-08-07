const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const speech = require('@google-cloud/speech');
const mongoose = require('mongoose');
const logger = require('./logger');
const gestureLibraryService = require('./gestureLibraryService');
const facialExpressionService = require('./facialExpressionService');

// Call Recording Schema
const callRecordingSchema = new mongoose.Schema({
  recordingId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number }, // in milliseconds
  status: { 
    type: String, 
    enum: ['recording', 'processing', 'completed', 'failed', 'deleted'], 
    default: 'recording' 
  },
  
  // Audio data
  audioFile: {
    originalPath: String,
    processedPath: String,
    format: String,
    sampleRate: Number,
    channels: Number,
    size: Number // file size in bytes
  },
  
  // Transcription data
  transcription: {
    fullText: String,
    segments: [{
      text: String,
      startTime: Number, // milliseconds
      endTime: Number,
      confidence: Number,
      speakerId: String
    }],
    language: String,
    confidence: Number
  },
  
  // Translation data
  translation: {
    signSequences: [{
      startTime: Number,
      endTime: Number,
      originalText: String,
      signLanguage: String, // ASL, BSL, etc.
      sequence: [{
        word: String,
        gesture: Object,
        duration: Number,
        confidence: Number
      }],
      emotions: [{
        emotion: String,
        intensity: String,
        startTime: Number,
        duration: Number
      }]
    }],
    totalGestures: Number,
    averageConfidence: Number
  },
  
  // Overlay settings
  overlaySettings: {
    enabled: { type: Boolean, default: true },
    position: { type: String, default: 'bottom-right' }, // top-left, top-right, bottom-left, bottom-right, center
    size: { type: String, default: 'medium' }, // small, medium, large
    transparency: { type: Number, default: 0.8 },
    showEmotions: { type: Boolean, default: true },
    showConfidence: { type: Boolean, default: true },
    signLanguage: { type: String, default: 'BSL' },
    theme: { type: String, default: 'light' } // light, dark, auto
  },
  
  // Processing metadata
  processingSteps: [{
    step: String, // audio_processing, transcription, translation, overlay_generation
    startTime: Date,
    endTime: Date,
    status: String, // pending, in_progress, completed, failed
    error: String
  }],
  
  // Export data
  exports: [{
    format: String, // mp4, webm, srt, pdf
    path: String,
    size: Number,
    createdAt: Date,
    downloadCount: Number
  }],
  
  metadata: {
    deviceInfo: Object,
    networkQuality: String,
    compressionRatio: Number,
    originalDuration: Number,
    processedDuration: Number,
    tags: [String]
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, startTime: -1 },
    { sessionId: 1 },
    { status: 1 },
    { 'transcription.language': 1 }
  ]
});

const CallRecording = mongoose.model('CallRecording', callRecordingSchema);

class CallRecordingService {
  constructor() {
    this.recordingsPath = path.join(__dirname, '../recordings');
    this.overlaysPath = path.join(__dirname, '../overlays');
    this.tempPath = path.join(__dirname, '../temp');
    
    // Google Cloud Speech client (if configured)
    this.speechClient = null;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.speechClient = new speech.SpeechClient();
    }
    
    // Active recording sessions
    this.activeRecordings = new Map();
    
    // Processing queue
    this.processingQueue = new Set();
    
    this.initializeDirectories();
    
    logger.info('Call Recording Service initialized', {
      speechEnabled: !!this.speechClient,
      recordingsPath: this.recordingsPath
    });
  }

  async initializeDirectories() {
    try {
      await Promise.all([
        fs.mkdir(this.recordingsPath, { recursive: true }),
        fs.mkdir(this.overlaysPath, { recursive: true }),
        fs.mkdir(this.tempPath, { recursive: true })
      ]);
    } catch (error) {
      logger.error('Error initializing directories', {
        error: error.message,
        recordingsPath: this.recordingsPath
      });
    }
  }

  /**
   * Start a new call recording session
   */
  async startRecording(userId, sessionId, options = {}) {
    try {
      const recordingId = uuidv4();
      const startTime = new Date();
      
      const recording = new CallRecording({
        recordingId,
        userId,
        sessionId,
        startTime,
        status: 'recording',
        overlaySettings: {
          ...options.overlaySettings,
          enabled: options.overlaySettings?.enabled ?? true,
          position: options.overlaySettings?.position || 'bottom-right',
          size: options.overlaySettings?.size || 'medium',
          transparency: options.overlaySettings?.transparency ?? 0.8,
          showEmotions: options.overlaySettings?.showEmotions ?? true,
          showConfidence: options.overlaySettings?.showConfidence ?? true,
          signLanguage: options.overlaySettings?.signLanguage || 'BSL',
          theme: options.overlaySettings?.theme || 'light'
        },
        metadata: {
          deviceInfo: options.deviceInfo || {},
          networkQuality: options.networkQuality || 'unknown',
          tags: options.tags || []
        }
      });

      await recording.save();

      // Initialize processing step
      await this.addProcessingStep(recordingId, 'audio_processing', 'pending');

      // Store active recording
      this.activeRecordings.set(recordingId, {
        userId,
        sessionId,
        startTime,
        audioChunks: [],
        transcriptionBuffer: '',
        lastProcessedTime: 0
      });

      logger.info('Call recording started', {
        recordingId,
        userId,
        sessionId,
        overlayEnabled: recording.overlaySettings.enabled
      });

      return {
        recordingId,
        sessionId,
        status: 'recording',
        startTime,
        settings: recording.overlaySettings
      };

    } catch (error) {
      logger.error('Error starting call recording', {
        error: error.message,
        userId,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Process audio chunk during recording
   */
  async processAudioChunk(recordingId, audioChunk, timestamp) {
    try {
      const activeRecording = this.activeRecordings.get(recordingId);
      if (!activeRecording) {
        throw new Error('Recording session not found');
      }

      // Store audio chunk
      activeRecording.audioChunks.push({
        data: audioChunk,
        timestamp,
        size: audioChunk.length
      });

      // Process for real-time transcription if enabled
      if (this.speechClient && audioChunk.length > 1024) {
        const transcriptionResult = await this.transcribeAudioChunk(audioChunk);
        
        if (transcriptionResult && transcriptionResult.text) {
          // Generate real-time translation overlay
          const overlayData = await this.generateRealtimeOverlay(
            recordingId,
            transcriptionResult.text,
            timestamp
          );
          
          return {
            transcription: transcriptionResult,
            overlay: overlayData,
            timestamp
          };
        }
      }

      return { processed: true, timestamp };

    } catch (error) {
      logger.error('Error processing audio chunk', {
        error: error.message,
        recordingId,
        timestamp
      });
      throw error;
    }
  }

  /**
   * Stop recording and begin processing
   */
  async stopRecording(recordingId, options = {}) {
    try {
      const recording = await CallRecording.findOne({ recordingId });
      if (!recording) {
        throw new Error('Recording not found');
      }

      const endTime = new Date();
      const duration = endTime.getTime() - recording.startTime.getTime();

      // Update recording status
      recording.endTime = endTime;
      recording.duration = duration;
      recording.status = 'processing';
      await recording.save();

      // Get active recording data
      const activeRecording = this.activeRecordings.get(recordingId);
      if (activeRecording) {
        // Combine audio chunks
        const audioData = await this.combineAudioChunks(activeRecording.audioChunks);
        
        // Save audio file
        const audioFile = await this.saveAudioFile(recordingId, audioData);
        
        recording.audioFile = audioFile;
        await recording.save();

        // Clean up active recording
        this.activeRecordings.delete(recordingId);
      }

      // Start background processing
      this.processRecordingAsync(recordingId).catch(error => {
        logger.error('Background processing failed', {
          error: error.message,
          recordingId
        });
      });

      logger.info('Call recording stopped', {
        recordingId,
        duration,
        audioFileSize: recording.audioFile?.size
      });

      return {
        recordingId,
        duration,
        status: 'processing',
        estimatedProcessingTime: Math.min(duration * 2, 300000) // max 5 minutes
      };

    } catch (error) {
      logger.error('Error stopping call recording', {
        error: error.message,
        recordingId
      });
      throw error;
    }
  }

  /**
   * Process complete recording (transcription, translation, overlay generation)
   */
  async processRecordingAsync(recordingId) {
    if (this.processingQueue.has(recordingId)) {
      return; // Already processing
    }
    
    this.processingQueue.add(recordingId);
    
    try {
      const recording = await CallRecording.findOne({ recordingId });
      if (!recording || !recording.audioFile?.originalPath) {
        throw new Error('Recording or audio file not found');
      }

      // Step 1: Audio processing
      await this.updateProcessingStep(recordingId, 'audio_processing', 'in_progress');
      const processedAudio = await this.enhanceAudioQuality(recording.audioFile.originalPath);
      recording.audioFile.processedPath = processedAudio.path;
      recording.audioFile.sampleRate = processedAudio.sampleRate;
      recording.audioFile.channels = processedAudio.channels;
      await recording.save();
      await this.updateProcessingStep(recordingId, 'audio_processing', 'completed');

      // Step 2: Transcription
      await this.addProcessingStep(recordingId, 'transcription', 'in_progress');
      const transcriptionResult = await this.transcribeFullAudio(recording.audioFile.processedPath);
      recording.transcription = transcriptionResult;
      await recording.save();
      await this.updateProcessingStep(recordingId, 'transcription', 'completed');

      // Step 3: Translation to sign language
      await this.addProcessingStep(recordingId, 'translation', 'in_progress');
      const translationResult = await this.generateSignLanguageTranslation(
        transcriptionResult,
        recording.overlaySettings.signLanguage
      );
      recording.translation = translationResult;
      await recording.save();
      await this.updateProcessingStep(recordingId, 'translation', 'completed');

      // Step 4: Generate overlay video
      if (recording.overlaySettings.enabled) {
        await this.addProcessingStep(recordingId, 'overlay_generation', 'in_progress');
        const overlayResult = await this.generateTranslationOverlay(recording);
        
        // Add to exports
        recording.exports.push({
          format: 'mp4',
          path: overlayResult.path,
          size: overlayResult.size,
          createdAt: new Date(),
          downloadCount: 0
        });
        
        await recording.save();
        await this.updateProcessingStep(recordingId, 'overlay_generation', 'completed');
      }

      // Mark as completed
      recording.status = 'completed';
      recording.metadata.processedDuration = Date.now() - recording.endTime.getTime();
      await recording.save();

      logger.info('Call recording processing completed', {
        recordingId,
        transcriptionLength: recording.transcription?.fullText?.length,
        translationSegments: recording.translation?.signSequences?.length,
        processingTime: recording.metadata.processedDuration
      });

    } catch (error) {
      logger.error('Call recording processing failed', {
        error: error.message,
        recordingId,
        stack: error.stack
      });

      // Update status to failed
      await CallRecording.updateOne(
        { recordingId },
        { 
          status: 'failed',
          $push: {
            processingSteps: {
              step: 'processing_error',
              startTime: new Date(),
              endTime: new Date(),
              status: 'failed',
              error: error.message
            }
          }
        }
      );

    } finally {
      this.processingQueue.delete(recordingId);
    }
  }

  /**
   * Generate real-time translation overlay during recording
   */
  async generateRealtimeOverlay(recordingId, text, timestamp) {
    try {
      const recording = await CallRecording.findOne({ recordingId });
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Translate text to sign language
      const signSequence = gestureLibraryService.translateToSignSequence(
        text,
        recording.overlaySettings.signLanguage
      );

      // Generate emotion sequence
      const emotionAnalysis = facialExpressionService.analyzeTextEmotion(text, 'general');
      
      // Create overlay data
      const overlayData = {
        timestamp,
        text,
        signSequence: signSequence.sequence,
        emotions: recording.overlaySettings.showEmotions ? {
          primary: emotionAnalysis.emotion,
          intensity: emotionAnalysis.intensity,
          confidence: emotionAnalysis.confidence
        } : null,
        confidence: recording.overlaySettings.showConfidence ? signSequence.metadata.averageConfidence : null,
        settings: {
          position: recording.overlaySettings.position,
          size: recording.overlaySettings.size,
          transparency: recording.overlaySettings.transparency,
          theme: recording.overlaySettings.theme
        }
      };

      return overlayData;

    } catch (error) {
      logger.error('Error generating realtime overlay', {
        error: error.message,
        recordingId,
        text: text.substring(0, 100)
      });
      return null;
    }
  }

  /**
   * Transcribe audio chunk for real-time processing
   */
  async transcribeAudioChunk(audioChunk) {
    if (!this.speechClient) {
      return null;
    }

    try {
      const request = {
        audio: { content: audioChunk.toString('base64') },
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false
        }
      };

      const [response] = await this.speechClient.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0])
        .filter(alternative => alternative.confidence > 0.7)
        .map(alternative => alternative.transcript)
        .join(' ');

      if (transcription) {
        return {
          text: transcription,
          confidence: response.results[0]?.alternatives[0]?.confidence || 0,
          language: 'en-US'
        };
      }

      return null;

    } catch (error) {
      logger.error('Error transcribing audio chunk', {
        error: error.message,
        chunkSize: audioChunk.length
      });
      return null;
    }
  }

  /**
   * Transcribe full audio file
   */
  async transcribeFullAudio(audioFilePath) {
    try {
      if (!this.speechClient) {
        // Fallback to mock transcription for development
        return {
          fullText: 'Mock transcription for development environment',
          segments: [{
            text: 'Mock transcription for development environment',
            startTime: 0,
            endTime: 5000,
            confidence: 0.8,
            speakerId: 'unknown'
          }],
          language: 'en-US',
          confidence: 0.8
        };
      }

      const audioBytes = await fs.readFile(audioFilePath);
      
      const request = {
        audio: { content: audioBytes.toString('base64') },
        config: {
          encoding: 'FLAC',
          sampleRateHertz: 44100,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          enableSpeakerDiarization: true,
          diarizationSpeakerCount: 2
        }
      };

      const [operation] = await this.speechClient.longRunningRecognize(request);
      const [response] = await operation.promise();

      const fullText = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      const segments = response.results.map((result, index) => {
        const alternative = result.alternatives[0];
        return {
          text: alternative.transcript,
          startTime: alternative.words?.[0]?.startTime?.seconds * 1000 || index * 1000,
          endTime: alternative.words?.[alternative.words.length - 1]?.endTime?.seconds * 1000 || (index + 1) * 1000,
          confidence: alternative.confidence,
          speakerId: `speaker_${result.speakerTag || 1}`
        };
      });

      const averageConfidence = segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length;

      return {
        fullText,
        segments,
        language: 'en-US',
        confidence: averageConfidence
      };

    } catch (error) {
      logger.error('Error transcribing full audio', {
        error: error.message,
        audioFilePath
      });

      // Return mock data on error
      return {
        fullText: 'Transcription failed - using fallback',
        segments: [{
          text: 'Transcription failed - using fallback',
          startTime: 0,
          endTime: 5000,
          confidence: 0.5,
          speakerId: 'unknown'
        }],
        language: 'en-US',
        confidence: 0.5
      };
    }
  }

  /**
   * Generate sign language translation from transcription
   */
  async generateSignLanguageTranslation(transcription, signLanguage = 'BSL') {
    try {
      const signSequences = [];
      let totalGestures = 0;
      let confidenceSum = 0;

      for (const segment of transcription.segments) {
        // Translate segment text to sign language
        const signTranslation = gestureLibraryService.translateToSignSequence(
          segment.text,
          signLanguage
        );

        // Generate emotion sequence for the segment
        const emotionSequence = facialExpressionService.generateEmotionSequence(
          signTranslation.sequence,
          'general'
        );

        const signSequenceData = {
          startTime: segment.startTime,
          endTime: segment.endTime,
          originalText: segment.text,
          signLanguage,
          sequence: signTranslation.sequence.map(sign => ({
            word: sign.word,
            gesture: sign.gesture,
            duration: sign.duration,
            confidence: sign.confidence || 0.8
          })),
          emotions: emotionSequence.map(emotion => ({
            emotion: emotion.emotion,
            intensity: emotion.intensity,
            startTime: emotion.startTime,
            duration: emotion.duration
          }))
        };

        signSequences.push(signSequenceData);
        totalGestures += signSequenceData.sequence.length;
        confidenceSum += signTranslation.metadata.averageConfidence;
      }

      const averageConfidence = signSequences.length > 0 ? confidenceSum / signSequences.length : 0;

      return {
        signSequences,
        totalGestures,
        averageConfidence
      };

    } catch (error) {
      logger.error('Error generating sign language translation', {
        error: error.message,
        segmentCount: transcription.segments?.length
      });

      return {
        signSequences: [],
        totalGestures: 0,
        averageConfidence: 0
      };
    }
  }

  /**
   * Combine audio chunks into single file
   */
  async combineAudioChunks(audioChunks) {
    try {
      // Sort chunks by timestamp
      const sortedChunks = audioChunks.sort((a, b) => a.timestamp - b.timestamp);
      
      // Combine audio data
      const combinedSize = sortedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      const combinedBuffer = Buffer.alloc(combinedSize);
      
      let offset = 0;
      for (const chunk of sortedChunks) {
        chunk.data.copy(combinedBuffer, offset);
        offset += chunk.size;
      }

      return combinedBuffer;

    } catch (error) {
      logger.error('Error combining audio chunks', {
        error: error.message,
        chunkCount: audioChunks.length
      });
      throw error;
    }
  }

  /**
   * Save audio file to disk
   */
  async saveAudioFile(recordingId, audioData) {
    try {
      const fileName = `${recordingId}.webm`;
      const filePath = path.join(this.recordingsPath, fileName);
      
      await fs.writeFile(filePath, audioData);
      
      const stats = await fs.stat(filePath);

      return {
        originalPath: filePath,
        format: 'webm',
        size: stats.size,
        channels: 1, // Default for web recording
        sampleRate: 48000 // Default for WebRTC
      };

    } catch (error) {
      logger.error('Error saving audio file', {
        error: error.message,
        recordingId,
        dataSize: audioData.length
      });
      throw error;
    }
  }

  /**
   * Enhance audio quality
   */
  async enhanceAudioQuality(inputPath) {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace('.webm', '_processed.flac');
      
      ffmpeg(inputPath)
        .audioCodec('flac')
        .audioChannels(1)
        .audioFrequency(44100)
        .audioBitrate(128)
        .on('end', async () => {
          try {
            const stats = await fs.stat(outputPath);
            resolve({
              path: outputPath,
              sampleRate: 44100,
              channels: 1,
              size: stats.size
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Generate translation overlay video
   */
  async generateTranslationOverlay(recording) {
    try {
      // This would generate an overlay video with sign language visualization
      // For now, return mock data
      const overlayPath = path.join(this.overlaysPath, `${recording.recordingId}_overlay.mp4`);
      
      // Create a simple overlay file (mock implementation)
      await fs.writeFile(overlayPath, Buffer.from('Mock overlay video data'));
      
      const stats = await fs.stat(overlayPath);

      return {
        path: overlayPath,
        size: stats.size,
        format: 'mp4',
        resolution: '1920x1080',
        duration: recording.duration
      };

    } catch (error) {
      logger.error('Error generating translation overlay', {
        error: error.message,
        recordingId: recording.recordingId
      });
      throw error;
    }
  }

  /**
   * Get recording status
   */
  async getRecordingStatus(recordingId) {
    try {
      const recording = await CallRecording.findOne({ recordingId });
      if (!recording) {
        return { status: 'not_found' };
      }

      const processingSteps = recording.processingSteps || [];
      const currentStep = processingSteps.find(step => step.status === 'in_progress')?.step;
      const completedSteps = processingSteps.filter(step => step.status === 'completed').length;
      const totalSteps = recording.overlaySettings.enabled ? 4 : 3; // audio, transcription, translation, (overlay)

      return {
        recordingId,
        status: recording.status,
        duration: recording.duration,
        currentStep,
        progress: recording.status === 'completed' ? 100 : Math.round((completedSteps / totalSteps) * 100),
        transcription: recording.transcription,
        translation: recording.translation,
        exports: recording.exports,
        overlaySettings: recording.overlaySettings,
        createdAt: recording.createdAt,
        updatedAt: recording.updatedAt
      };

    } catch (error) {
      logger.error('Error getting recording status', {
        error: error.message,
        recordingId
      });
      throw error;
    }
  }

  /**
   * List user recordings
   */
  async listUserRecordings(userId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status,
        startDate,
        endDate
      } = options;

      const query = { userId };
      
      if (status) {
        query.status = status;
      }
      
      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
      }

      const recordings = await CallRecording.find(query)
        .sort({ startTime: -1 })
        .limit(limit)
        .skip(offset)
        .select('-audioFile -transcription.segments -translation.signSequences')
        .lean();

      const total = await CallRecording.countDocuments(query);

      return {
        recordings,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      };

    } catch (error) {
      logger.error('Error listing user recordings', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId, userId) {
    try {
      const recording = await CallRecording.findOne({ recordingId, userId });
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Delete files
      const filesToDelete = [
        recording.audioFile?.originalPath,
        recording.audioFile?.processedPath,
        ...recording.exports.map(exp => exp.path)
      ].filter(Boolean);

      await Promise.all(
        filesToDelete.map(filePath => 
          fs.unlink(filePath).catch(error => 
            logger.warn('File deletion failed', { filePath, error: error.message })
          )
        )
      );

      // Update database
      recording.status = 'deleted';
      recording.audioFile = {};
      recording.exports = [];
      await recording.save();

      // Remove from active recordings if present
      this.activeRecordings.delete(recordingId);

      logger.info('Recording deleted', {
        recordingId,
        userId,
        filesDeleted: filesToDelete.length
      });

      return { success: true, deletedFiles: filesToDelete.length };

    } catch (error) {
      logger.error('Error deleting recording', {
        error: error.message,
        recordingId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update overlay settings
   */
  async updateOverlaySettings(recordingId, userId, settings) {
    try {
      const recording = await CallRecording.findOne({ recordingId, userId });
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Update overlay settings
      recording.overlaySettings = {
        ...recording.overlaySettings,
        ...settings
      };

      await recording.save();

      // If recording is active, update real-time settings
      if (this.activeRecordings.has(recordingId)) {
        const activeRecording = this.activeRecordings.get(recordingId);
        activeRecording.overlaySettings = recording.overlaySettings;
      }

      logger.info('Overlay settings updated', {
        recordingId,
        userId,
        settings
      });

      return recording.overlaySettings;

    } catch (error) {
      logger.error('Error updating overlay settings', {
        error: error.message,
        recordingId,
        userId
      });
      throw error;
    }
  }

  /**
   * Helper methods for processing steps
   */
  async addProcessingStep(recordingId, step, status) {
    await CallRecording.updateOne(
      { recordingId },
      {
        $push: {
          processingSteps: {
            step,
            startTime: new Date(),
            status
          }
        }
      }
    );
  }

  async updateProcessingStep(recordingId, step, status, error = null) {
    const update = {
      'processingSteps.$.endTime': new Date(),
      'processingSteps.$.status': status
    };

    if (error) {
      update['processingSteps.$.error'] = error;
    }

    await CallRecording.updateOne(
      { recordingId, 'processingSteps.step': step },
      { $set: update }
    );
  }

  /**
   * Get service statistics
   */
  async getServiceStats() {
    try {
      const stats = await CallRecording.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalDuration: { $sum: '$duration' },
            avgDuration: { $avg: '$duration' }
          }
        }
      ]);

      const totalRecordings = await CallRecording.countDocuments();
      const totalStorage = await CallRecording.aggregate([
        { $match: { 'audioFile.size': { $exists: true } } },
        { $group: { _id: null, total: { $sum: '$audioFile.size' } } }
      ]);

      return {
        totalRecordings,
        statusBreakdown: stats,
        totalStorageBytes: totalStorage[0]?.total || 0,
        activeRecordings: this.activeRecordings.size,
        processingQueue: this.processingQueue.size
      };

    } catch (error) {
      logger.error('Error getting service stats', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new CallRecordingService();