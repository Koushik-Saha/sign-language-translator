const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, optionalAuth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const facialExpressionService = require('../services/facialExpressionService');
const logger = require('../services/logger');

const router = express.Router();

// Get available emotions and their categories
router.get('/emotions', optionalAuth, async (req, res) => {
  try {
    const emotions = facialExpressionService.getAvailableEmotions();
    
    // Group by category
    const categorized = emotions.reduce((acc, emotion) => {
      if (!acc[emotion.category]) {
        acc[emotion.category] = [];
      }
      acc[emotion.category].push(emotion);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        emotions,
        categorized,
        total: emotions.length,
        categories: Object.keys(categorized)
      }
    });

  } catch (error) {
    logger.error('Error fetching emotions', {
      error: error.message,
      userId: req.user?._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching emotion data'
    });
  }
});

// Get emotions by specific category
router.get('/emotions/category/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const emotions = facialExpressionService.getEmotionsByCategory(category);

    if (emotions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No emotions found for category: ${category}`,
        availableCategories: ['positive', 'negative', 'reactive', 'cognitive', 'baseline']
      });
    }

    res.json({
      success: true,
      data: {
        category,
        emotions,
        count: emotions.length
      }
    });

  } catch (error) {
    logger.error('Error fetching emotions by category', {
      error: error.message,
      category: req.params.category,
      userId: req.user?._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching emotions by category'
    });
  }
});

// Analyze text for emotional content
router.post('/analyze', [
  optionalAuth,
  body('text').notEmpty().isLength({ min: 1, max: 2000 }).withMessage('Text is required (1-2000 characters)'),
  body('context').optional().isIn(['general', 'greetings', 'questions', 'commands', 'expressions', 'negations', 'emergency', 'learning', 'social']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { text, context = 'general' } = req.body;

    logger.info('Text emotion analysis request', {
      userId: req.user?._id,
      textLength: text.length,
      context
    });

    const analysis = facialExpressionService.analyzeTextEmotion(text, context);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Text emotion analysis failed', {
      error: error.message,
      userId: req.user?._id,
      text: req.body.text?.substring(0, 100)
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Text emotion analysis failed'
    });
  }
});

// Get facial expression parameters for specific emotion
router.get('/parameters/:emotion', [
  optionalAuth,
  query('intensity').optional().isIn(['low', 'medium', 'high']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { emotion } = req.params;
    const { intensity = 'medium' } = req.query;

    // Validate emotion
    const validation = facialExpressionService.validateEmotion(emotion, intensity);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Invalid emotion or intensity`,
        validation,
        suggestions: validation.suggestions
      });
    }

    const parameters = facialExpressionService.getExpressionParameters(emotion, intensity);

    res.json({
      success: true,
      data: parameters
    });

  } catch (error) {
    logger.error('Error fetching expression parameters', {
      error: error.message,
      emotion: req.params.emotion,
      intensity: req.query.intensity,
      userId: req.user?._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching expression parameters'
    });
  }
});

// Blend two emotions for complex expressions
router.post('/blend', [
  optionalAuth,
  body('primaryEmotion').notEmpty().withMessage('Primary emotion is required'),
  body('secondaryEmotion').notEmpty().withMessage('Secondary emotion is required'),
  body('blendRatio').optional().isFloat({ min: 0.1, max: 0.9 }).withMessage('Blend ratio must be between 0.1 and 0.9'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { primaryEmotion, secondaryEmotion, blendRatio = 0.7 } = req.body;

    // Validate both emotions
    const primaryValidation = facialExpressionService.validateEmotion(primaryEmotion);
    const secondaryValidation = facialExpressionService.validateEmotion(secondaryEmotion);

    if (!primaryValidation.valid || !secondaryValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emotions for blending',
        primaryValidation,
        secondaryValidation
      });
    }

    logger.info('Emotion blend request', {
      userId: req.user?._id,
      primaryEmotion,
      secondaryEmotion,
      blendRatio
    });

    const blendedEmotion = facialExpressionService.blendEmotions(
      primaryEmotion, 
      secondaryEmotion, 
      blendRatio
    );

    res.json({
      success: true,
      data: blendedEmotion
    });

  } catch (error) {
    logger.error('Emotion blending failed', {
      error: error.message,
      userId: req.user?._id,
      primaryEmotion: req.body.primaryEmotion,
      secondaryEmotion: req.body.secondaryEmotion
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Emotion blending failed'
    });
  }
});

// Generate emotion sequence for sign language translation
router.post('/sequence', [
  optionalAuth,
  body('signSequence').isArray({ min: 1, max: 50 }).withMessage('Sign sequence array required (max 50 signs)'),
  body('signSequence.*.word').optional().isString(),
  body('signSequence.*.text').optional().isString(),
  body('signSequence.*.duration').optional().isInt({ min: 500, max: 10000 }),
  body('context').optional().isIn(['general', 'greetings', 'questions', 'commands', 'expressions', 'negations', 'emergency', 'learning', 'social']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { signSequence, context = 'general' } = req.body;

    logger.info('Emotion sequence generation request', {
      userId: req.user?._id,
      sequenceLength: signSequence.length,
      context
    });

    const emotionSequence = facialExpressionService.generateEmotionSequence(signSequence, context);

    const summary = {
      totalDuration: emotionSequence.reduce((sum, item) => sum + item.duration, 0),
      emotionCount: [...new Set(emotionSequence.map(item => item.emotion))].length,
      transitionCount: emotionSequence.filter(item => item.isTransition).length,
      dominantEmotion: this.findDominantEmotion(emotionSequence)
    };

    res.json({
      success: true,
      data: {
        emotionSequence,
        summary,
        metadata: {
          signCount: signSequence.length,
          context,
          generatedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('Emotion sequence generation failed', {
      error: error.message,
      userId: req.user?._id,
      sequenceLength: req.body.signSequence?.length
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Emotion sequence generation failed'
    });
  }
});

// Validate emotion and get suggestions
router.post('/validate', [
  optionalAuth,
  body('emotion').notEmpty().withMessage('Emotion is required'),
  body('intensity').optional().isIn(['low', 'medium', 'high']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { emotion, intensity = 'medium' } = req.body;

    const validation = facialExpressionService.validateEmotion(emotion, intensity);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Emotion validation failed', {
      error: error.message,
      userId: req.user?._id,
      emotion: req.body.emotion
    });
    
    res.status(500).json({
      success: false,
      message: 'Emotion validation failed'
    });
  }
});

// Get comprehensive emotion data for avatar system
router.get('/avatar-config', optionalAuth, async (req, res) => {
  try {
    const emotions = facialExpressionService.getAvailableEmotions();
    
    const avatarConfig = {
      emotions: emotions.reduce((acc, emotion) => {
        acc[emotion.name] = {
          displayName: emotion.displayName,
          category: emotion.category,
          intensityLevels: emotion.intensityLevels,
          parameters: facialExpressionService.getExpressionParameters(emotion.name, 'medium')
        };
        return acc;
      }, {}),
      defaultEmotion: 'NEUTRAL',
      supportedIntensities: ['low', 'medium', 'high'],
      blendingSupported: true,
      sequenceSupported: true,
      contextOptions: [
        'general', 'greetings', 'questions', 'commands', 
        'expressions', 'negations', 'emergency', 'learning', 'social'
      ]
    };

    res.json({
      success: true,
      data: avatarConfig
    });

  } catch (error) {
    logger.error('Error fetching avatar configuration', {
      error: error.message,
      userId: req.user?._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching avatar configuration'
    });
  }
});

// Real-time emotion updates for avatar (for authenticated users)
router.post('/realtime-update', [
  auth, // Require authentication for real-time updates
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('emotion').notEmpty().withMessage('Emotion is required'),
  body('intensity').optional().isIn(['low', 'medium', 'high']),
  body('duration').optional().isInt({ min: 100, max: 30000 }),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { sessionId, emotion, intensity = 'medium', duration = 2000 } = req.body;

    // Validate emotion
    const validation = facialExpressionService.validateEmotion(emotion, intensity);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emotion parameters',
        validation
      });
    }

    // Get expression parameters
    const expressionData = facialExpressionService.getExpressionParameters(emotion, intensity);

    // In a real implementation, you would broadcast this to WebSocket clients
    // For now, we'll just return the expression data
    const updateData = {
      sessionId,
      emotion: validation.emotion,
      intensity,
      duration,
      expressionData,
      timestamp: Date.now()
    };

    logger.info('Real-time emotion update', {
      userId: req.user._id,
      sessionId,
      emotion: validation.emotion,
      intensity
    });

    res.json({
      success: true,
      data: updateData,
      message: 'Emotion update processed successfully'
    });

  } catch (error) {
    logger.error('Real-time emotion update failed', {
      error: error.message,
      userId: req.user._id,
      sessionId: req.body.sessionId
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Real-time emotion update failed'
    });
  }
});

// Helper function to find dominant emotion in sequence
const findDominantEmotion = (emotionSequence) => {
  const emotionDurations = {};
  
  for (const item of emotionSequence) {
    if (!item.isTransition) {
      emotionDurations[item.emotion] = (emotionDurations[item.emotion] || 0) + item.duration;
    }
  }
  
  return Object.entries(emotionDurations).reduce((a, b) => 
    emotionDurations[a[0]] > emotionDurations[b[0]] ? a : b
  )[0];
};

// Add helper as method to router
router.findDominantEmotion = findDominantEmotion;

module.exports = router;