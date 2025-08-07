const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, optionalAuth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const wordRecognitionService = require('../services/wordRecognitionService');
const logger = require('../services/logger');

const router = express.Router();

// Get word recognition model information
router.get('/info', optionalAuth, async (req, res) => {
  try {
    const modelInfo = wordRecognitionService.getModelInfo();
    
    res.json({
      success: true,
      data: {
        modelInfo,
        capabilities: {
          maxTextLength: 1000,
          supportedLanguages: ['en'],
          features: [
            'contextual_analysis',
            'confidence_scoring',
            'multiple_suggestions',
            'gesture_library_integration'
          ]
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching word recognition info', {
      error: error.message,
      userId: req.user?._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching model information'
    });
  }
});

// Recognize words using LSTM model
router.post('/recognize', [
  optionalAuth,
  body('text').notEmpty().isLength({ min: 1, max: 1000 }).withMessage('Text is required (1-1000 characters)'),
  body('confidence_threshold').optional().isFloat({ min: 0.1, max: 1.0 }).withMessage('Confidence threshold must be between 0.1 and 1.0'),
  body('max_suggestions').optional().isInt({ min: 1, max: 20 }).withMessage('Max suggestions must be between 1 and 20'),
  body('use_context').optional().isBoolean(),
  body('target_library').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      text,
      confidence_threshold = 0.7,
      max_suggestions = 5,
      use_context = true,
      target_library = 'BSL'
    } = req.body;

    const startTime = Date.now();

    logger.info('Word recognition request', {
      userId: req.user?._id,
      textLength: text.length,
      confidence_threshold,
      max_suggestions,
      target_library
    });

    const recognition = await wordRecognitionService.recognizeWords(text, {
      confidence_threshold,
      max_suggestions,
      use_context,
      target_library
    });

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        ...recognition,
        processingTime
      }
    });

  } catch (error) {
    logger.error('Word recognition failed', {
      error: error.message,
      userId: req.user?._id,
      text: req.body.text?.substring(0, 100)
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Word recognition failed'
    });
  }
});

// Batch word recognition for multiple texts
router.post('/batch-recognize', [
  auth,
  body('texts').isArray({ min: 1, max: 10 }).withMessage('Texts array required (max 10 items)'),
  body('texts.*').notEmpty().isLength({ max: 500 }).withMessage('Each text must be non-empty and under 500 characters'),
  body('confidence_threshold').optional().isFloat({ min: 0.1, max: 1.0 }),
  body('max_suggestions').optional().isInt({ min: 1, max: 10 }),
  body('use_context').optional().isBoolean(),
  body('target_library').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      texts,
      confidence_threshold = 0.7,
      max_suggestions = 5,
      use_context = true,
      target_library = 'BSL'
    } = req.body;

    const startTime = Date.now();

    logger.info('Batch word recognition request', {
      userId: req.user._id,
      batchSize: texts.length,
      target_library
    });

    const results = [];
    const errors = [];

    // Process each text
    for (const [index, text] of texts.entries()) {
      try {
        const recognition = await wordRecognitionService.recognizeWords(text, {
          confidence_threshold,
          max_suggestions,
          use_context,
          target_library
        });

        results.push({
          index,
          text,
          success: true,
          recognition
        });

      } catch (error) {
        errors.push({
          index,
          text,
          error: error.message
        });
      }
    }

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: texts.length,
          successful: results.length,
          failed: errors.length
        },
        processingTime,
        averageTimePerText: processingTime / texts.length
      }
    });

  } catch (error) {
    logger.error('Batch word recognition failed', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Batch word recognition failed'
    });
  }
});

// Train model with user-provided data (admin only)
router.post('/train', [
  auth,
  body('trainingData').isArray({ min: 1 }).withMessage('Training data array required'),
  body('trainingData.*.text').notEmpty().withMessage('Each training item must have text'),
  body('trainingData.*.expectedWord').notEmpty().withMessage('Each training item must have expectedWord'),
  body('epochs').optional().isInt({ min: 1, max: 100 }).withMessage('Epochs must be between 1 and 100'),
  body('batchSize').optional().isInt({ min: 1, max: 128 }).withMessage('Batch size must be between 1 and 128'),
  body('learningRate').optional().isFloat({ min: 0.0001, max: 0.1 }).withMessage('Learning rate must be between 0.0001 and 0.1'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required for model training'
      });
    }

    const {
      trainingData,
      epochs = 10,
      batchSize = 32,
      learningRate = 0.001,
      validationSplit = 0.2
    } = req.body;

    logger.info('Starting model training', {
      userId: req.user._id,
      dataSize: trainingData.length,
      epochs,
      batchSize,
      learningRate
    });

    const trainingResult = await wordRecognitionService.trainModel(trainingData, {
      epochs,
      batchSize,
      learningRate,
      validationSplit
    });

    res.json({
      success: true,
      data: trainingResult,
      message: 'Model training completed successfully'
    });

  } catch (error) {
    logger.error('Model training failed', {
      error: error.message,
      userId: req.user._id,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Model training failed'
    });
  }
});

// Evaluate model performance (admin only)
router.post('/evaluate', [
  auth,
  body('testData').isArray({ min: 1 }).withMessage('Test data array required'),
  body('testData.*.text').notEmpty().withMessage('Each test item must have text'),
  body('testData.*.expectedWord').notEmpty().withMessage('Each test item must have expectedWord'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required for model evaluation'
      });
    }

    const { testData } = req.body;

    logger.info('Starting model evaluation', {
      userId: req.user._id,
      testDataSize: testData.length
    });

    const evaluation = await wordRecognitionService.evaluateModel(testData);

    res.json({
      success: true,
      data: evaluation,
      message: 'Model evaluation completed successfully'
    });

  } catch (error) {
    logger.error('Model evaluation failed', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Model evaluation failed'
    });
  }
});

// Add new words to vocabulary (admin only)
router.post('/vocabulary/add', [
  auth,
  body('words').isArray({ min: 1 }).withMessage('Words array required'),
  body('words.*').isString().notEmpty().withMessage('Each word must be a non-empty string'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required for vocabulary management'
      });
    }

    const { words } = req.body;

    logger.info('Adding words to vocabulary', {
      userId: req.user._id,
      wordCount: words.length
    });

    const result = await wordRecognitionService.addToVocabulary(words);

    res.json({
      success: true,
      data: result,
      message: `Added ${result.addedCount} new words to vocabulary`
    });

  } catch (error) {
    logger.error('Failed to add words to vocabulary', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add words to vocabulary'
    });
  }
});

// Get vocabulary statistics
router.get('/vocabulary/stats', [auth], async (req, res) => {
  try {
    const modelInfo = wordRecognitionService.getModelInfo();
    
    const stats = {
      vocabularySize: modelInfo.vocabularySize,
      maxSequenceLength: modelInfo.maxSequenceLength,
      modelParameters: modelInfo.totalParameters,
      architecture: modelInfo.architecture,
      lastUpdated: new Date().toISOString() // In production, track actual update time
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching vocabulary stats', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching vocabulary statistics'
    });
  }
});

// Compare recognition with standard translation
router.post('/compare', [
  optionalAuth,
  body('text').notEmpty().isLength({ min: 1, max: 1000 }).withMessage('Text is required'),
  body('target_library').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { text, target_library = 'BSL' } = req.body;

    const startTime = Date.now();

    // Get LSTM model recognition
    const lstmRecognition = await wordRecognitionService.recognizeWords(text, {
      target_library,
      use_context: true,
      max_suggestions: 3
    });

    // Get standard gesture library translation for comparison
    const gestureLibraryService = require('../services/gestureLibraryService');
    const standardTranslation = gestureLibraryService.translateToSignSequence(text, target_library);

    const processingTime = Date.now() - startTime;

    const comparison = {
      originalText: text,
      targetLibrary: target_library,
      lstmRecognition: {
        predictions: lstmRecognition.predictions,
        confidence: lstmRecognition.modelConfidence,
        method: 'LSTM Neural Network'
      },
      standardTranslation: {
        sequence: standardTranslation.sequence,
        metadata: standardTranslation.metadata,
        method: 'Rule-based Library Lookup'
      },
      analysis: {
        lstmTopWord: lstmRecognition.predictions[0]?.word,
        lstmConfidence: lstmRecognition.predictions[0]?.confidence,
        standardWordsCount: standardTranslation.sequence?.length || 0,
        agreementScore: this.calculateAgreementScore(lstmRecognition, standardTranslation)
      },
      processingTime
    };

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    logger.error('Recognition comparison failed', {
      error: error.message,
      userId: req.user?._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Recognition comparison failed'
    });
  }
});

// Helper function to calculate agreement between methods
const calculateAgreementScore = (lstmResult, standardResult) => {
  if (!lstmResult.predictions || !standardResult.sequence) {
    return 0;
  }

  const lstmWords = lstmResult.predictions.map(p => p.word);
  const standardWords = standardResult.sequence.map(s => s.word);

  let matches = 0;
  const totalWords = Math.max(lstmWords.length, standardWords.length);

  for (const word of lstmWords) {
    if (standardWords.includes(word)) {
      matches++;
    }
  }

  return totalWords > 0 ? matches / totalWords : 0;
};

// Add the helper function as a method
router.calculateAgreementScore = calculateAgreementScore;

module.exports = router;