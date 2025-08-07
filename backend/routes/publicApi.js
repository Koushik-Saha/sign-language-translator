const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, optionalAuth, apiKeyAuth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const advancedRateLimiting = require('../middleware/advancedRateLimiting');
const gestureLibraryService = require('../services/gestureLibraryService');
const modelVersioningService = require('../services/modelVersioningService');
const transferLearningService = require('../services/transferLearningService');
const abTestingService = require('../services/abTestingService');
const logger = require('../services/logger');

const router = express.Router();

// API versioning middleware
const apiVersion = (version) => {
  return (req, res, next) => {
    req.apiVersion = version;
    next();
  };
};

// Public API rate limiting (more restrictive than internal API)
const publicApiLimiting = advancedRateLimiting.createCustomLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many API requests from this IP, please try again later.',
    retryAfter: 900000
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply public API rate limiting
router.use(publicApiLimiting);

// API documentation endpoint
router.get('/docs', (req, res) => {
  const apiDocs = {
    name: 'Sign Language Translator Public API',
    version: '1.0.0',
    description: 'Comprehensive API for sign language translation and gesture recognition',
    baseUrl: `${req.protocol}://${req.get('host')}/api/public/v1`,
    authentication: {
      methods: ['API Key', 'JWT Token'],
      apiKey: {
        header: 'X-API-Key',
        description: 'Include your API key in the X-API-Key header'
      },
      jwt: {
        header: 'Authorization',
        format: 'Bearer <token>',
        description: 'Include JWT token with Bearer prefix'
      }
    },
    rateLimit: {
      requests: 100,
      window: '15 minutes',
      headers: ['X-RateLimit-Remaining', 'X-RateLimit-Reset']
    },
    endpoints: {
      translation: {
        'POST /translate/text-to-sign': {
          description: 'Translate text to sign language sequence',
          parameters: {
            text: { type: 'string', required: true },
            targetLibrary: { type: 'string', enum: ['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN'], default: 'BSL' },
            includeMetadata: { type: 'boolean', default: true }
          }
        },
        'POST /translate/batch': {
          description: 'Translate multiple texts in batch',
          parameters: {
            texts: { type: 'array', items: 'string', required: true },
            targetLibrary: { type: 'string', enum: ['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN'], default: 'BSL' }
          }
        }
      },
      gestures: {
        'GET /gestures/libraries': {
          description: 'Get available sign language libraries'
        },
        'GET /gestures/search': {
          description: 'Search for gestures',
          parameters: {
            word: { type: 'string', required: true },
            libraries: { type: 'string', description: 'Comma-separated library codes' }
          }
        },
        'POST /gestures/advanced-search': {
          description: 'Advanced gesture search with filters',
          parameters: {
            query: { type: 'string' },
            libraries: { type: 'array' },
            categories: { type: 'array' },
            handshapes: { type: 'array' },
            complexity: { type: 'object' }
          }
        }
      },
      models: {
        'GET /models/available': {
          description: 'Get available ML models'
        },
        'POST /models/predict': {
          description: 'Get predictions from ML models',
          parameters: {
            modelId: { type: 'string', required: true },
            input: { type: 'object', required: true }
          }
        }
      },
      voice: {
        'POST /voice/process': {
          description: 'Process voice input and convert to text',
          parameters: {
            audioData: { type: 'string', format: 'base64', required: true },
            language: { type: 'string', default: 'en-US' }
          }
        }
      }
    },
    errorCodes: {
      400: 'Bad Request - Invalid parameters',
      401: 'Unauthorized - Invalid or missing API key/token',
      403: 'Forbidden - Access denied',
      404: 'Not Found - Resource not found',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Server error'
    },
    examples: {
      textToSign: {
        request: {
          text: 'Hello, how are you?',
          targetLibrary: 'BSL',
          includeMetadata: true
        },
        response: {
          success: true,
          data: {
            originalText: 'Hello, how are you?',
            targetLibrary: 'BSL',
            sequence: [/* gesture sequence */],
            metadata: {/* translation metadata */}
          }
        }
      }
    }
  };

  res.json(apiDocs);
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      gestureLibrary: !!gestureLibraryService,
      modelVersioning: !!modelVersioningService,
      transferLearning: !!transferLearningService,
      abTesting: !!abTestingService
    }
  });
});

// API v1 routes
router.use('/v1', apiVersion('1.0'));

// === TRANSLATION ENDPOINTS ===

// Text to sign translation
router.post('/v1/translate/text-to-sign', [
  apiKeyAuth,
  body('text').notEmpty().isLength({ max: 1000 }).withMessage('Text is required and must be under 1000 characters'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('includeMetadata').optional().isBoolean(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { text, targetLibrary = 'BSL', includeMetadata = true } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Log API usage
    logger.info('Public API: Text to sign translation', {
      userId,
      textLength: text.length,
      targetLibrary,
      apiKey: req.apiKey?.name
    });

    const translation = gestureLibraryService.translateToSignSequence(text, targetLibrary);

    const response = {
      success: true,
      data: {
        ...translation,
        apiVersion: req.apiVersion
      }
    };

    if (includeMetadata) {
      response.data.requestMetadata = {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - req.startTime,
        apiKey: req.apiKey?.name,
        rateLimitRemaining: res.getHeader('X-RateLimit-Remaining')
      };
    }

    res.json(response);

  } catch (error) {
    logger.error('Public API: Text to sign translation error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Translation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch translation
router.post('/v1/translate/batch', [
  apiKeyAuth,
  body('texts').isArray({ min: 1, max: 10 }).withMessage('Texts array required (max 10 items)'),
  body('texts.*').isLength({ max: 500 }).withMessage('Each text must be under 500 characters'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { texts, targetLibrary = 'BSL' } = req.body;
    const userId = req.user?.id || 'anonymous';

    logger.info('Public API: Batch translation', {
      userId,
      batchSize: texts.length,
      targetLibrary,
      apiKey: req.apiKey?.name
    });

    const translations = texts.map((text, index) => {
      try {
        return {
          index,
          text,
          success: true,
          translation: gestureLibraryService.translateToSignSequence(text, targetLibrary)
        };
      } catch (error) {
        return {
          index,
          text,
          success: false,
          error: error.message
        };
      }
    });

    const successCount = translations.filter(t => t.success).length;
    const failureCount = translations.length - successCount;

    res.json({
      success: true,
      data: {
        translations,
        summary: {
          total: texts.length,
          successful: successCount,
          failed: failureCount
        },
        targetLibrary,
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Public API: Batch translation error', {
      error: error.message,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Batch translation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === GESTURE LIBRARY ENDPOINTS ===

// Get available libraries
router.get('/v1/gestures/libraries', [optionalAuth], async (req, res) => {
  try {
    const libraries = gestureLibraryService.getAvailableLibraries();
    const libraryDetails = libraries.map(code => {
      const library = gestureLibraryService.getLibrary(code);
      return {
        code,
        name: library.name,
        region: library.region,
        alphabetSize: Object.keys(library.alphabet || {}).length,
        wordCount: Object.keys(library.commonWords || {}).length,
        phraseCount: Object.keys(library.phrases || {}).length
      };
    });

    res.json({
      success: true,
      data: {
        libraries: libraryDetails,
        totalLibraries: libraries.length,
        apiVersion: req.apiVersion
      }
    });

  } catch (error) {
    logger.error('Public API: Get libraries error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch libraries',
      timestamp: new Date().toISOString()
    });
  }
});

// Search gestures
router.get('/v1/gestures/search', [
  apiKeyAuth,
  query('word').notEmpty().withMessage('Search word is required'),
  query('libraries').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { word, libraries, limit = 20 } = req.query;
    const searchLibraries = libraries ? libraries.split(',') : ['ASL', 'BSL', 'LSF'];

    const results = gestureLibraryService.searchGesture(word, searchLibraries);
    const limitedResults = results.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        searchTerm: word,
        searchedLibraries: searchLibraries,
        results: limitedResults,
        totalResults: results.length,
        returnedResults: limitedResults.length,
        apiVersion: req.apiVersion
      }
    });

  } catch (error) {
    logger.error('Public API: Gesture search error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Advanced gesture search
router.post('/v1/gestures/advanced-search', [
  apiKeyAuth,
  body('query').optional().isString(),
  body('libraries').optional().isArray(),
  body('categories').optional().isArray(),
  body('handshapes').optional().isArray(),
  body('movements').optional().isArray(),
  body('complexity').optional().isObject(),
  body('limit').optional().isInt({ min: 1, max: 100 }),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      query = '',
      libraries = ['ASL', 'BSL', 'LSF'],
      categories = [],
      handshapes = [],
      movements = [],
      complexity = {},
      limit = 50
    } = req.body;

    let results = [];

    // Search across specified libraries
    for (const libCode of libraries) {
      const library = gestureLibraryService.getLibrary(libCode);
      if (!library || !library.commonWords) continue;

      for (const [word, gesture] of Object.entries(library.commonWords)) {
        // Apply filters
        if (query && !word.toLowerCase().includes(query.toLowerCase())) continue;
        if (categories.length > 0 && !categories.includes(gesture.category)) continue;
        if (handshapes.length > 0 && !handshapes.includes(gesture.handshape)) continue;
        if (movements.length > 0 && !movements.includes(gesture.movement)) continue;

        const gestureComplexity = gestureLibraryService.getGestureComplexity(gesture);
        if (complexity.min && gestureComplexity < complexity.min) continue;
        if (complexity.max && gestureComplexity > complexity.max) continue;

        results.push({
          library: libCode,
          word,
          gesture,
          complexity: gestureComplexity
        });
      }
    }

    // Sort and limit results
    results.sort((a, b) => {
      if (query) {
        const aExact = a.word.toLowerCase() === query.toLowerCase();
        const bExact = b.word.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      return a.complexity - b.complexity;
    });

    const limitedResults = results.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        searchCriteria: req.body,
        results: limitedResults,
        totalResults: results.length,
        returnedResults: limitedResults.length,
        apiVersion: req.apiVersion
      }
    });

  } catch (error) {
    logger.error('Public API: Advanced search error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Advanced search failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === MODEL ENDPOINTS ===

// Get available models
router.get('/v1/models/available', [apiKeyAuth], async (req, res) => {
  try {
    const models = await modelVersioningService.getAvailableModels();
    const activeModels = models.filter(model => model.status === 'active');

    res.json({
      success: true,
      data: {
        models: activeModels.map(model => ({
          id: model.id,
          name: model.name,
          version: model.version,
          description: model.description,
          modelType: model.modelType,
          accuracy: model.metrics?.accuracy,
          createdAt: model.createdAt
        })),
        totalModels: activeModels.length,
        apiVersion: req.apiVersion
      }
    });

  } catch (error) {
    logger.error('Public API: Get models error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
      timestamp: new Date().toISOString()
    });
  }
});

// Model prediction
router.post('/v1/models/predict', [
  apiKeyAuth,
  body('modelId').notEmpty().withMessage('Model ID is required'),
  body('input').isObject().withMessage('Input data is required'),
  body('options').optional().isObject(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { modelId, input, options = {} } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Get model and validate
    const model = await modelVersioningService.getModelById(modelId);
    if (!model || model.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Model not found or inactive',
        timestamp: new Date().toISOString()
      });
    }

    // A/B testing assignment
    const assignedModel = await abTestingService.assignUserToTest(userId, model.modelType);
    const actualModelId = assignedModel?.modelId || modelId;

    logger.info('Public API: Model prediction', {
      userId,
      requestedModelId: modelId,
      assignedModelId: actualModelId,
      modelType: model.modelType
    });

    // Make prediction (this would integrate with actual ML pipeline)
    const prediction = {
      modelId: actualModelId,
      modelVersion: assignedModel?.modelVersion || model.version,
      predictions: [
        {
          confidence: 0.85,
          result: 'sample_prediction',
          alternatives: []
        }
      ],
      processingTime: Math.random() * 100 + 50 // Mock processing time
    };

    // Track A/B test result if applicable
    if (assignedModel?.testId) {
      await abTestingService.trackResult(
        assignedModel.testId,
        userId,
        prediction.predictions[0].confidence > 0.8
      );
    }

    res.json({
      success: true,
      data: {
        ...prediction,
        abTest: assignedModel ? {
          testId: assignedModel.testId,
          variant: assignedModel.variant
        } : null,
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Public API: Model prediction error', {
      error: error.message,
      modelId: req.body.modelId
    });
    
    res.status(500).json({
      success: false,
      error: 'Prediction failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === VOICE PROCESSING ENDPOINTS ===

// Process voice input
router.post('/v1/voice/process', [
  apiKeyAuth,
  body('audioData').notEmpty().withMessage('Audio data is required'),
  body('language').optional().isString(),
  body('format').optional().isIn(['wav', 'mp3', 'webm']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { audioData, language = 'en-US', format = 'webm' } = req.body;

    // This would integrate with speech recognition service
    // For now, returning a mock response
    const transcription = {
      text: 'Sample transcribed text',
      confidence: 0.92,
      language: language,
      alternatives: [
        { text: 'Alternative transcription', confidence: 0.88 }
      ],
      processingTime: Math.random() * 200 + 100
    };

    logger.info('Public API: Voice processing', {
      language,
      format,
      audioDataLength: audioData.length,
      apiKey: req.apiKey?.name
    });

    res.json({
      success: true,
      data: {
        ...transcription,
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Public API: Voice processing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Voice processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === UTILITY ENDPOINTS ===

// API usage statistics (for API key holders)
router.get('/v1/usage/stats', [apiKeyAuth], async (req, res) => {
  try {
    const apiKey = req.apiKey;
    const { timeframe = '24h' } = req.query;

    // Mock usage statistics
    const stats = {
      apiKey: apiKey.name,
      timeframe,
      requests: {
        total: 1247,
        successful: 1189,
        failed: 58,
        rateLimited: 12
      },
      endpoints: {
        '/translate/text-to-sign': 856,
        '/gestures/search': 234,
        '/models/predict': 157
      },
      quotas: {
        dailyLimit: 10000,
        dailyUsed: 1247,
        remainingQuota: 8753
      }
    };

    res.json({
      success: true,
      data: {
        ...stats,
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Public API: Usage stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// API status endpoint
router.get('/v1/status', (req, res) => {
  const status = {
    api: 'operational',
    services: {
      translation: 'operational',
      gestureLibrary: 'operational',
      models: 'operational',
      voice: 'operational'
    },
    maintenance: {
      scheduled: false,
      nextWindow: null
    },
    performance: {
      averageResponseTime: '145ms',
      uptime: '99.9%'
    }
  };

  res.json({
    success: true,
    data: {
      ...status,
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString()
    }
  });
});

// Error handler middleware for public API
router.use((error, req, res, next) => {
  logger.error('Public API Error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    apiKey: req.apiKey?.name,
    userId: req.user?.id
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details,
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
      timestamp: new Date().toISOString()
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;