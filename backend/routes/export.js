const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const exportService = require('../services/exportService');
const gestureLibraryService = require('../services/gestureLibraryService');
const logger = require('../services/logger');

const router = express.Router();

// All export routes require authentication
router.use(auth);

// Get export capabilities and settings
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = {
      video: {
        formats: ['mp4', 'avi', 'webm'],
        qualities: ['low', 'medium', 'high'],
        resolutions: ['480p', '720p', '1080p'],
        maxDuration: 300, // seconds
        features: ['subtitles', 'instructions', 'timestamps', 'progress_indicator']
      },
      pdf: {
        formats: ['pdf'],
        themes: ['professional', 'minimal', 'colorful'],
        features: ['images', 'step_by_step', 'glossary', 'practice_section', 'table_of_contents'],
        maxPages: 50
      },
      package: {
        formats: ['zip', 'tar'],
        maxSize: '100MB',
        features: ['video', 'pdf', 'images', 'json', 'quiz', 'audio']
      },
      limits: {
        maxGestures: 100,
        maxExportsPerDay: 50,
        maxConcurrentExports: 3
      }
    };

    res.json({
      success: true,
      data: capabilities
    });

  } catch (error) {
    logger.error('Error fetching export capabilities', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching export capabilities'
    });
  }
});

// Export translation as enhanced video
router.post('/video', [
  body('text').notEmpty().withMessage('Text is required for translation'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('format').optional().isIn(['mp4', 'avi', 'webm']),
  body('quality').optional().isIn(['low', 'medium', 'high']),
  body('includeSubtitles').optional().isBoolean(),
  body('includeInstructions').optional().isBoolean(),
  body('showTimestamps').optional().isBoolean(),
  body('backgroundColor').optional().isString(),
  body('avatarStyle').optional().isIn(['simple', 'realistic', 'cartoon']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      text,
      targetLibrary = 'BSL',
      format = 'mp4',
      quality = 'medium',
      includeSubtitles = true,
      includeInstructions = false,
      showTimestamps = false,
      backgroundColor = '#ffffff',
      avatarStyle = 'realistic'
    } = req.body;

    logger.info('Starting video export request', {
      userId: req.user._id,
      textLength: text.length,
      targetLibrary,
      format,
      quality
    });

    // Translate text to sign language sequence
    const translationData = gestureLibraryService.translateToSignSequence(text, targetLibrary);

    // Export video with enhanced features
    const videoExport = await exportService.exportEnhancedVideo(translationData, {
      userId: req.user._id,
      format,
      quality,
      includeSubtitles,
      includeInstructions,
      showTimestamps,
      backgroundColor,
      avatarStyle
    });

    res.json({
      success: true,
      data: videoExport,
      message: 'Video export completed successfully'
    });

  } catch (error) {
    logger.error('Video export failed', {
      error: error.message,
      userId: req.user._id,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Video export failed'
    });
  }
});

// Export translation as comprehensive PDF
router.post('/pdf', [
  body('text').notEmpty().withMessage('Text is required for translation'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('includeImages').optional().isBoolean(),
  body('includeStepByStep').optional().isBoolean(),
  body('includeMetadata').optional().isBoolean(),
  body('includeGlossary').optional().isBoolean(),
  body('includePracticeSection').optional().isBoolean(),
  body('theme').optional().isIn(['professional', 'minimal', 'colorful']),
  body('language').optional().isString(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      text,
      targetLibrary = 'BSL',
      includeImages = true,
      includeStepByStep = true,
      includeMetadata = true,
      includeGlossary = true,
      includePracticeSection = true,
      theme = 'professional',
      language = 'en'
    } = req.body;

    logger.info('Starting PDF export request', {
      userId: req.user._id,
      textLength: text.length,
      targetLibrary,
      theme
    });

    // Translate text to sign language sequence
    const translationData = gestureLibraryService.translateToSignSequence(text, targetLibrary);

    // Export comprehensive PDF
    const pdfExport = await exportService.exportComprehensivePDF(translationData, {
      userId: req.user._id,
      includeImages,
      includeStepByStep,
      includeMetadata,
      includeGlossary,
      includePracticeSection,
      theme,
      language
    });

    res.json({
      success: true,
      data: pdfExport,
      message: 'PDF export completed successfully'
    });

  } catch (error) {
    logger.error('PDF export failed', {
      error: error.message,
      userId: req.user._id,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'PDF export failed'
    });
  }
});

// Export complete learning package
router.post('/package', [
  body('text').notEmpty().withMessage('Text is required for translation'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('includeVideo').optional().isBoolean(),
  body('includePDF').optional().isBoolean(),
  body('includeImages').optional().isBoolean(),
  body('includeAudio').optional().isBoolean(),
  body('includeJSON').optional().isBoolean(),
  body('includeQuiz').optional().isBoolean(),
  body('packageFormat').optional().isIn(['zip', 'tar']),
  body('quality').optional().isIn(['low', 'medium', 'high']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      text,
      targetLibrary = 'BSL',
      includeVideo = true,
      includePDF = true,
      includeImages = true,
      includeAudio = false,
      includeJSON = true,
      includeQuiz = false,
      packageFormat = 'zip',
      quality = 'medium'
    } = req.body;

    logger.info('Starting package export request', {
      userId: req.user._id,
      textLength: text.length,
      targetLibrary,
      includeVideo,
      includePDF,
      packageFormat
    });

    // Translate text to sign language sequence
    const translationData = gestureLibraryService.translateToSignSequence(text, targetLibrary);

    // Export learning package
    const packageExport = await exportService.exportLearningPackage(translationData, {
      userId: req.user._id,
      includeVideo,
      includePDF,
      includeImages,
      includeAudio,
      includeJSON,
      includeQuiz,
      packageFormat,
      quality
    });

    res.json({
      success: true,
      data: packageExport,
      message: 'Learning package export completed successfully'
    });

  } catch (error) {
    logger.error('Package export failed', {
      error: error.message,
      userId: req.user._id,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Package export failed'
    });
  }
});

// Export using existing translation data
router.post('/from-translation', [
  body('translationId').notEmpty().withMessage('Translation ID is required'),
  body('exportType').isIn(['video', 'pdf', 'package']).withMessage('Invalid export type'),
  body('options').optional().isObject(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      translationId,
      exportType,
      options = {}
    } = req.body;

    // In a real implementation, you would fetch the translation from database
    // For now, we'll return an error since we don't have persistent translation storage
    res.status(400).json({
      success: false,
      message: 'Translation storage not implemented. Use text-based export endpoints instead.',
      supportedEndpoints: [
        'POST /export/video',
        'POST /export/pdf',
        'POST /export/package'
      ]
    });

  } catch (error) {
    logger.error('Translation-based export failed', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Export failed'
    });
  }
});

// Get export status
router.get('/status/:exportId', async (req, res) => {
  try {
    const { exportId } = req.params;

    // Check export status
    const status = await exportService.getExportStatus(exportId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error checking export status', {
      error: error.message,
      exportId: req.params.exportId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking export status'
    });
  }
});

// List user's exports
router.get('/history', [
  query('type').optional().isIn(['video', 'pdf', 'package']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      type,
      limit = 20,
      offset = 0
    } = req.query;

    const exports = await exportService.listUserExports(req.user._id, {
      type,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: exports
    });

  } catch (error) {
    logger.error('Error fetching export history', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching export history'
    });
  }
});

// Download export file
router.get('/download/:exportId', async (req, res) => {
  try {
    const { exportId } = req.params;

    // Get export status and file path
    const status = await exportService.getExportStatus(exportId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    if (status.status === 'error') {
      return res.status(500).json({
        success: false,
        message: 'Export failed',
        error: status.error
      });
    }

    // Set appropriate headers for file download
    const filename = status.filename;
    const contentType = this.getContentType(status.type, filename);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', status.fileSize);

    // Stream the file
    const fileStream = require('fs').createReadStream(status.filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error('File streaming error', {
        error: error.message,
        exportId,
        filePath: status.filePath
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    });

  } catch (error) {
    logger.error('Download error', {
      error: error.message,
      exportId: req.params.exportId,
      userId: req.user._id
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error downloading file'
      });
    }
  }
});

// Delete export
router.delete('/:exportId', async (req, res) => {
  try {
    const { exportId } = req.params;

    const result = await exportService.deleteExport(exportId, req.user._id);

    res.json({
      success: true,
      message: 'Export deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting export', {
      error: error.message,
      exportId: req.params.exportId,
      userId: req.user._id
    });
    
    const statusCode = error.message === 'Export not found' ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error deleting export'
    });
  }
});

// Batch export multiple texts
router.post('/batch', [
  body('texts').isArray({ min: 1, max: 10 }).withMessage('Texts array required (max 10)'),
  body('texts.*').notEmpty().withMessage('Each text must not be empty'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('exportType').isIn(['video', 'pdf', 'package']).withMessage('Invalid export type'),
  body('options').optional().isObject(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      texts,
      targetLibrary = 'BSL',
      exportType,
      options = {}
    } = req.body;

    logger.info('Starting batch export', {
      userId: req.user._id,
      batchSize: texts.length,
      exportType,
      targetLibrary
    });

    const batchResults = [];
    const errors = [];

    // Process each text
    for (const [index, text] of texts.entries()) {
      try {
        // Translate text
        const translationData = gestureLibraryService.translateToSignSequence(text, targetLibrary);

        // Export based on type
        let exportResult;
        switch (exportType) {
          case 'video':
            exportResult = await exportService.exportEnhancedVideo(translationData, {
              userId: req.user._id,
              ...options
            });
            break;
          case 'pdf':
            exportResult = await exportService.exportComprehensivePDF(translationData, {
              userId: req.user._id,
              ...options
            });
            break;
          case 'package':
            exportResult = await exportService.exportLearningPackage(translationData, {
              userId: req.user._id,
              ...options
            });
            break;
        }

        batchResults.push({
          index,
          text,
          success: true,
          export: exportResult
        });

      } catch (error) {
        errors.push({
          index,
          text,
          error: error.message
        });
      }
    }

    const summary = {
      total: texts.length,
      successful: batchResults.length,
      failed: errors.length
    };

    logger.info('Batch export completed', {
      userId: req.user._id,
      ...summary
    });

    res.json({
      success: true,
      data: {
        results: batchResults,
        errors,
        summary
      },
      message: `Batch export completed: ${summary.successful}/${summary.total} successful`
    });

  } catch (error) {
    logger.error('Batch export failed', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Batch export failed'
    });
  }
});

// Helper method to determine content type
const getContentType = (exportType, filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  const contentTypes = {
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg'
  };
  
  return contentTypes[extension] || 'application/octet-stream';
};

// Add getContentType as a method to the router
router.getContentType = getContentType;

module.exports = router;