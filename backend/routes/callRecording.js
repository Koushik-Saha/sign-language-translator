const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const callRecordingService = require('../services/callRecordingService');
const logger = require('../services/logger');

const router = express.Router();

// All call recording routes require authentication
router.use(auth);

// Start a new call recording session
router.post('/start', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('overlaySettings').optional().isObject(),
  body('overlaySettings.enabled').optional().isBoolean(),
  body('overlaySettings.position').optional().isIn(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']),
  body('overlaySettings.size').optional().isIn(['small', 'medium', 'large']),
  body('overlaySettings.transparency').optional().isFloat({ min: 0.1, max: 1.0 }),
  body('overlaySettings.signLanguage').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('overlaySettings.theme').optional().isIn(['light', 'dark', 'auto']),
  body('deviceInfo').optional().isObject(),
  body('networkQuality').optional().isIn(['excellent', 'good', 'fair', 'poor', 'unknown']),
  body('tags').optional().isArray(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      sessionId,
      overlaySettings = {},
      deviceInfo = {},
      networkQuality = 'unknown',
      tags = []
    } = req.body;

    logger.info('Starting call recording', {
      userId: req.user._id,
      sessionId,
      overlayEnabled: overlaySettings.enabled
    });

    const recording = await callRecordingService.startRecording(req.user._id, sessionId, {
      overlaySettings,
      deviceInfo,
      networkQuality,
      tags
    });

    res.json({
      success: true,
      data: recording,
      message: 'Call recording started successfully'
    });

  } catch (error) {
    logger.error('Error starting call recording', {
      error: error.message,
      userId: req.user._id,
      sessionId: req.body.sessionId
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start call recording'
    });
  }
});

// Process audio chunk during recording
router.post('/process-audio', [
  body('recordingId').notEmpty().withMessage('Recording ID is required'),
  body('audioChunk').notEmpty().withMessage('Audio chunk is required'),
  body('timestamp').isNumeric().withMessage('Valid timestamp is required'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { recordingId, audioChunk, timestamp } = req.body;

    // Convert base64 audio chunk to buffer
    const audioBuffer = Buffer.from(audioChunk, 'base64');

    const result = await callRecordingService.processAudioChunk(
      recordingId,
      audioBuffer,
      parseInt(timestamp)
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error processing audio chunk', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.body.recordingId
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process audio chunk'
    });
  }
});

// Stop recording and begin processing
router.post('/stop', [
  body('recordingId').notEmpty().withMessage('Recording ID is required'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { recordingId } = req.body;

    logger.info('Stopping call recording', {
      userId: req.user._id,
      recordingId
    });

    const result = await callRecordingService.stopRecording(recordingId);

    res.json({
      success: true,
      data: result,
      message: 'Call recording stopped and processing started'
    });

  } catch (error) {
    logger.error('Error stopping call recording', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.body.recordingId
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to stop call recording'
    });
  }
});

// Get recording status and progress
router.get('/status/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;

    const status = await callRecordingService.getRecordingStatus(recordingId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Recording not found'
      });
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error getting recording status', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.params.recordingId
    });

    res.status(500).json({
      success: false,
      message: 'Error retrieving recording status'
    });
  }
});

// List user's call recordings
router.get('/list', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('status').optional().isIn(['recording', 'processing', 'completed', 'failed', 'deleted']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const recordings = await callRecordingService.listUserRecordings(req.user._id, options);

    res.json({
      success: true,
      data: recordings
    });

  } catch (error) {
    logger.error('Error listing call recordings', {
      error: error.message,
      userId: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error retrieving call recordings'
    });
  }
});

// Update overlay settings for a recording
router.put('/overlay-settings/:recordingId', [
  body('enabled').optional().isBoolean(),
  body('position').optional().isIn(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']),
  body('size').optional().isIn(['small', 'medium', 'large']),
  body('transparency').optional().isFloat({ min: 0.1, max: 1.0 }),
  body('showEmotions').optional().isBoolean(),
  body('showConfidence').optional().isBoolean(),
  body('signLanguage').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('theme').optional().isIn(['light', 'dark', 'auto']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { recordingId } = req.params;
    const settings = req.body;

    logger.info('Updating overlay settings', {
      userId: req.user._id,
      recordingId,
      settings
    });

    const updatedSettings = await callRecordingService.updateOverlaySettings(
      recordingId,
      req.user._id,
      settings
    );

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Overlay settings updated successfully'
    });

  } catch (error) {
    logger.error('Error updating overlay settings', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.params.recordingId
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update overlay settings'
    });
  }
});

// Get detailed recording information including transcription and translation
router.get('/details/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;

    const status = await callRecordingService.getRecordingStatus(recordingId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Recording not found'
      });
    }

    // Return full details including transcription and translation
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error getting recording details', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.params.recordingId
    });

    res.status(500).json({
      success: false,
      message: 'Error retrieving recording details'
    });
  }
});

// Download recording export (audio, overlay video, subtitles, etc.)
router.get('/download/:recordingId/:exportType', async (req, res) => {
  try {
    const { recordingId, exportType } = req.params;

    const status = await callRecordingService.getRecordingStatus(recordingId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Recording not found'
      });
    }

    // Find the requested export
    const exportData = status.exports?.find(exp => exp.format === exportType);
    if (!exportData) {
      return res.status(404).json({
        success: false,
        message: `Export format '${exportType}' not available`,
        availableFormats: status.exports?.map(exp => exp.format) || []
      });
    }

    // Set appropriate headers
    const fileName = `recording_${recordingId}.${exportType}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', getContentType(exportType));
    res.setHeader('Content-Length', exportData.size);

    // Stream the file
    const fs = require('fs');
    const fileStream = fs.createReadStream(exportData.path);
    
    fileStream.on('error', (error) => {
      logger.error('File streaming error', {
        error: error.message,
        recordingId,
        exportType,
        filePath: exportData.path
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    });

    fileStream.pipe(res);

    // Update download count
    // In a real implementation, you would update the database
    logger.info('Recording export downloaded', {
      userId: req.user._id,
      recordingId,
      exportType,
      fileSize: exportData.size
    });

  } catch (error) {
    logger.error('Error downloading recording export', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.params.recordingId,
      exportType: req.params.exportType
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error downloading file'
      });
    }
  }
});

// Delete a recording
router.delete('/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;

    logger.info('Deleting call recording', {
      userId: req.user._id,
      recordingId
    });

    const result = await callRecordingService.deleteRecording(recordingId, req.user._id);

    res.json({
      success: true,
      data: result,
      message: 'Recording deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting call recording', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.params.recordingId
    });

    const statusCode = error.message === 'Recording not found' ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete recording'
    });
  }
});

// Get recording statistics (for admins or analytics)
router.get('/stats/overview', async (req, res) => {
  try {
    // Check if user has admin privileges (simplified check)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const stats = await callRecordingService.getServiceStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting recording statistics', {
      error: error.message,
      userId: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics'
    });
  }
});

// Real-time endpoint for getting processing updates
router.get('/realtime/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial status
    const status = await callRecordingService.getRecordingStatus(recordingId);
    res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`);

    // Set up interval to check for updates
    const interval = setInterval(async () => {
      try {
        const updatedStatus = await callRecordingService.getRecordingStatus(recordingId);
        res.write(`data: ${JSON.stringify({ type: 'status', data: updatedStatus })}\n\n`);

        // Close connection when processing is complete or failed
        if (['completed', 'failed'].includes(updatedStatus.status)) {
          clearInterval(interval);
          res.write(`data: ${JSON.stringify({ type: 'complete', data: updatedStatus })}\n\n`);
          res.end();
        }
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    }, 2000); // Check every 2 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });

  } catch (error) {
    logger.error('Error setting up real-time updates', {
      error: error.message,
      userId: req.user._id,
      recordingId: req.params.recordingId
    });

    res.status(500).json({
      success: false,
      message: 'Error setting up real-time updates'
    });
  }
});

// Batch operations for multiple recordings
router.post('/batch/delete', [
  body('recordingIds').isArray({ min: 1, max: 10 }).withMessage('Recording IDs array required (max 10)'),
  body('recordingIds.*').notEmpty().withMessage('Each recording ID must not be empty'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { recordingIds } = req.body;

    logger.info('Batch deleting call recordings', {
      userId: req.user._id,
      count: recordingIds.length
    });

    const results = [];
    const errors = [];

    for (const recordingId of recordingIds) {
      try {
        const result = await callRecordingService.deleteRecording(recordingId, req.user._id);
        results.push({ recordingId, success: true, result });
      } catch (error) {
        errors.push({ recordingId, error: error.message });
      }
    }

    const summary = {
      total: recordingIds.length,
      successful: results.length,
      failed: errors.length
    };

    res.json({
      success: true,
      data: {
        results,
        errors,
        summary
      },
      message: `Batch deletion completed: ${summary.successful}/${summary.total} successful`
    });

  } catch (error) {
    logger.error('Error in batch delete operation', {
      error: error.message,
      userId: req.user._id
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Batch delete operation failed'
    });
  }
});

// Helper function to determine content type
const getContentType = (exportType) => {
  const contentTypes = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'flac': 'audio/flac',
    'wav': 'audio/wav',
    'srt': 'application/x-subrip',
    'vtt': 'text/vtt',
    'json': 'application/json',
    'pdf': 'application/pdf'
  };

  return contentTypes[exportType] || 'application/octet-stream';
};

module.exports = router;