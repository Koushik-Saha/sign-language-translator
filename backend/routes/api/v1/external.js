const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const { asyncHandler, ValidationError, AuthenticationError } = require('../../../middleware/errorHandler');
const multiLanguageService = require('../../../services/multiLanguageService');
const speechToTextService = require('../../../services/speechToTextService');
const { AnalyticsService } = require('../../../services/analyticsService');
const logger = require('../../../services/logger');

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
        throw new AuthenticationError('API key is required');
    }
    
    // In production, verify against database
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || ['demo-api-key'];
    
    if (!validApiKeys.includes(apiKey)) {
        throw new AuthenticationError('Invalid API key');
    }
    
    // Attach API key info to request
    req.apiKey = {
        key: apiKey,
        permissions: ['translate', 'speech', 'analytics'], // In production, load from database
        rateLimit: 1000 // requests per hour
    };
    
    logger.audit('API_ACCESS', apiKey, {
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
    });
    
    next();
};

// Rate limiting for external API
const apiRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req) => req.apiKey?.rateLimit || 100,
    message: {
        error: 'Rate limit exceeded',
        limit: 'Please upgrade your plan for higher rate limits',
        retryAfter: '1 hour'
    },
    keyGenerator: (req) => req.apiKey?.key || req.ip,
    standardHeaders: true,
    legacyHeaders: false
});

// Apply middleware to all routes
router.use(authenticateApiKey);
router.use(apiRateLimit);

// Input validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new ValidationError('Invalid input parameters', errors.array());
    }
    next();
};

/**
 * @api {get} /api/v1/external/info Get API Information
 * @apiName GetAPIInfo
 * @apiGroup External
 * @apiHeader {String} x-api-key Your API key
 * 
 * @apiSuccess {Object} info API information
 * @apiSuccess {String} info.version API version
 * @apiSuccess {Array} info.endpoints Available endpoints
 * @apiSuccess {Array} info.supportedLanguages Supported sign languages
 */
router.get('/info', asyncHandler(async (req, res) => {
    const supportedLanguages = multiLanguageService.getSupportedLanguages();
    const speechLanguages = speechToTextService.getSupportedLanguages();
    
    res.json({
        success: true,
        data: {
            version: '1.0.0',
            endpoints: [
                'GET /info - API information',
                'POST /translate/text-to-sign - Convert text to sign language',
                'POST /translate/sign-to-text - Convert sign language to text',
                'POST /speech/transcribe - Convert speech to text',
                'POST /speech/commands - Process voice commands',
                'GET /languages - Get supported languages',
                'GET /analytics/usage - Get usage analytics'
            ],
            supportedSignLanguages: supportedLanguages,
            supportedSpeechLanguages: speechLanguages,
            rateLimit: {
                current: req.apiKey.rateLimit,
                window: '1 hour'
            }
        }
    });
}));

/**
 * @api {post} /api/v1/external/translate/text-to-sign Convert Text to Sign Language
 * @apiName TranslateTextToSign
 * @apiGroup Translation
 * @apiHeader {String} x-api-key Your API key
 * 
 * @apiParam {String} text Text to translate
 * @apiParam {String} [sourceLanguage=en] Source language code
 * @apiParam {String} [targetLanguage=asl] Target sign language code
 * @apiParam {Boolean} [includeAnimation=true] Include animation data
 * 
 * @apiSuccess {Boolean} success Request success status
 * @apiSuccess {Object} data Translation result
 */
router.post('/translate/text-to-sign', [
    body('text')
        .notEmpty()
        .withMessage('Text is required')
        .isLength({ max: 500 })
        .withMessage('Text must be less than 500 characters'),
    body('sourceLanguage')
        .optional()
        .isLength({ min: 2, max: 5 })
        .withMessage('Invalid source language code'),
    body('targetLanguage')
        .optional()
        .isIn(['asl', 'bsl', 'lsf', 'dgs', 'jsl'])
        .withMessage('Unsupported target language'),
    body('includeAnimation')
        .optional()
        .isBoolean()
        .withMessage('includeAnimation must be a boolean')
], validateRequest, asyncHandler(async (req, res) => {
    const { text, sourceLanguage = 'en', targetLanguage = 'asl', includeAnimation = true } = req.body;
    
    const startTime = Date.now();
    const translation = await multiLanguageService.translateTextToSign(text, sourceLanguage, targetLanguage);
    const duration = Date.now() - startTime;
    
    // Track API usage
    await AnalyticsService.trackFeatureUsage(
        'external_api_text_to_sign',
        req.apiKey.key,
        req.sessionID || 'external',
        duration,
        true,
        { sourceLanguage, targetLanguage, textLength: text.length }
    );
    
    // Remove animation data if not requested
    if (!includeAnimation && translation.translation) {
        delete translation.translation.animations;
    }
    
    res.json({
        success: true,
        data: translation,
        metadata: {
            processingTime: duration,
            apiVersion: '1.0.0',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/v1/external/translate/sign-to-text Convert Sign Language to Text
 * @apiName TranslateSignToText
 * @apiGroup Translation
 */
router.post('/translate/sign-to-text', [
    body('gestures')
        .isArray({ min: 1 })
        .withMessage('Gestures array is required'),
    body('gestures.*.handshapes')
        .optional()
        .isArray()
        .withMessage('Handshapes must be an array'),
    body('sourceLanguage')
        .optional()
        .isIn(['asl', 'bsl', 'lsf', 'dgs', 'jsl'])
        .withMessage('Unsupported source language'),
    body('targetLanguage')
        .optional()
        .isLength({ min: 2, max: 5 })
        .withMessage('Invalid target language code')
], validateRequest, asyncHandler(async (req, res) => {
    const { gestures, sourceLanguage = 'asl', targetLanguage = 'en' } = req.body;
    
    const startTime = Date.now();
    const translation = await multiLanguageService.translateSignToText(gestures, sourceLanguage, targetLanguage);
    const duration = Date.now() - startTime;
    
    await AnalyticsService.trackFeatureUsage(
        'external_api_sign_to_text',
        req.apiKey.key,
        req.sessionID || 'external',
        duration,
        true,
        { sourceLanguage, targetLanguage, gestureCount: gestures.length }
    );
    
    res.json({
        success: true,
        data: translation,
        metadata: {
            processingTime: duration,
            apiVersion: '1.0.0',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/v1/external/speech/transcribe Transcribe Speech to Text
 * @apiName TranscribeSpeech
 * @apiGroup Speech
 */
router.post('/speech/transcribe', [
    body('audioData')
        .notEmpty()
        .withMessage('Audio data is required'),
    body('language')
        .optional()
        .matches(/^[a-z]{2}-[A-Z]{2}$/)
        .withMessage('Invalid language format (use en-US format)'),
    body('provider')
        .optional()
        .isIn(['google', 'azure', 'auto'])
        .withMessage('Invalid speech provider')
], validateRequest, asyncHandler(async (req, res) => {
    const { audioData, language = 'en-US', provider = 'auto' } = req.body;
    
    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    const startTime = Date.now();
    const transcription = await speechToTextService.transcribeAudioBuffer(audioBuffer, {
        language,
        provider
    });
    const duration = Date.now() - startTime;
    
    await AnalyticsService.trackFeatureUsage(
        'external_api_speech_transcribe',
        req.apiKey.key,
        req.sessionID || 'external',
        duration,
        true,
        { language, provider, audioSize: audioBuffer.length }
    );
    
    res.json({
        success: true,
        data: transcription,
        metadata: {
            processingTime: duration,
            apiVersion: '1.0.0',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/v1/external/speech/commands Process Voice Commands
 * @apiName ProcessVoiceCommands
 * @apiGroup Speech
 */
router.post('/speech/commands', [
    body('audioData')
        .notEmpty()
        .withMessage('Audio data is required'),
    body('context')
        .optional()
        .isObject()
        .withMessage('Context must be an object')
], validateRequest, asyncHandler(async (req, res) => {
    const { audioData, context = {} } = req.body;
    
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    const startTime = Date.now();
    const result = await speechToTextService.processVoiceCommand(audioBuffer, context);
    const duration = Date.now() - startTime;
    
    await AnalyticsService.trackFeatureUsage(
        'external_api_voice_commands',
        req.apiKey.key,
        req.sessionID || 'external',
        duration,
        true,
        { commandCategory: result.command?.category }
    );
    
    res.json({
        success: true,
        data: result,
        metadata: {
            processingTime: duration,
            apiVersion: '1.0.0',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {get} /api/v1/external/languages Get Supported Languages
 * @apiName GetSupportedLanguages
 * @apiGroup Languages
 */
router.get('/languages', asyncHandler(async (req, res) => {
    const signLanguages = await multiLanguageService.getLanguageStatistics();
    const speechLanguages = speechToTextService.getSupportedLanguages();
    
    res.json({
        success: true,
        data: {
            signLanguages,
            speechLanguages,
            total: {
                signLanguages: Object.keys(signLanguages).length,
                speechLanguages: speechLanguages.google?.length || 0
            }
        }
    });
}));

/**
 * @api {get} /api/v1/external/analytics/usage Get Usage Analytics
 * @apiName GetUsageAnalytics
 * @apiGroup Analytics
 */
router.get('/analytics/usage', [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
], validateRequest, asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Get analytics for this API key
    const analytics = await AnalyticsService.getUserAnalytics(req.apiKey.key, start, end);
    
    // Filter to only external API usage
    const externalAnalytics = {
        ...analytics,
        featureUsage: analytics.featureUsage.filter(usage => 
            usage.feature.startsWith('external_api_')
        )
    };
    
    res.json({
        success: true,
        data: externalAnalytics,
        metadata: {
            period: {
                start: start.toISOString(),
                end: end.toISOString()
            },
            apiKey: req.apiKey.key,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/v1/external/batch Batch Processing
 * @apiName BatchProcess
 * @apiGroup Batch
 */
router.post('/batch', [
    body('operations')
        .isArray({ min: 1, max: 10 })
        .withMessage('Operations array required (max 10 operations)'),
    body('operations.*.type')
        .isIn(['text-to-sign', 'sign-to-text', 'speech-transcribe'])
        .withMessage('Invalid operation type'),
    body('operations.*.data')
        .isObject()
        .withMessage('Operation data is required')
], validateRequest, asyncHandler(async (req, res) => {
    const { operations } = req.body;
    const results = [];
    
    const startTime = Date.now();
    
    for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
            let result;
            
            switch (operation.type) {
                case 'text-to-sign':
                    result = await multiLanguageService.translateTextToSign(
                        operation.data.text,
                        operation.data.sourceLanguage,
                        operation.data.targetLanguage
                    );
                    break;
                
                case 'sign-to-text':
                    result = await multiLanguageService.translateSignToText(
                        operation.data.gestures,
                        operation.data.sourceLanguage,
                        operation.data.targetLanguage
                    );
                    break;
                
                case 'speech-transcribe':
                    const audioBuffer = Buffer.from(operation.data.audioData, 'base64');
                    result = await speechToTextService.transcribeAudioBuffer(audioBuffer, {
                        language: operation.data.language,
                        provider: operation.data.provider
                    });
                    break;
            }
            
            results.push({
                operationIndex: i,
                success: true,
                data: result
            });
            
        } catch (error) {
            results.push({
                operationIndex: i,
                success: false,
                error: {
                    message: error.message,
                    type: error.constructor.name
                }
            });
        }
    }
    
    const duration = Date.now() - startTime;
    
    await AnalyticsService.trackFeatureUsage(
        'external_api_batch_process',
        req.apiKey.key,
        req.sessionID || 'external',
        duration,
        true,
        { operationCount: operations.length }
    );
    
    res.json({
        success: true,
        data: {
            results,
            summary: {
                total: operations.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        },
        metadata: {
            processingTime: duration,
            apiVersion: '1.0.0',
            timestamp: new Date().toISOString()
        }
    });
}));

// Error handling middleware specific to external API
router.use((error, req, res, next) => {
    logger.error('External API error', {
        apiKey: req.apiKey?.key,
        endpoint: req.originalUrl,
        error: error.message,
        stack: error.stack
    });
    
    const statusCode = error.statusCode || 500;
    
    res.status(statusCode).json({
        success: false,
        error: {
            message: error.message,
            code: error.code || 'EXTERNAL_API_ERROR',
            timestamp: new Date().toISOString()
        }
    });
});

module.exports = router;