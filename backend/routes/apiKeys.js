const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const apiKeyService = require('../services/apiKeyService');
const logger = require('../services/logger');

const router = express.Router();

// All API key management routes require authentication
router.use(auth);

// Get user's API keys
router.get('/', async (req, res) => {
  try {
    const apiKeys = await apiKeyService.getUserApiKeys(req.user._id);
    
    res.json({
      success: true,
      data: {
        apiKeys,
        totalKeys: apiKeys.length
      }
    });

  } catch (error) {
    logger.error('Error fetching API keys', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching API keys'
    });
  }
});

// Create new API key
router.post('/', [
  body('name').notEmpty().isLength({ min: 1, max: 100 }).withMessage('Name is required (1-100 characters)'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array'),
  body('permissions.*').optional().isIn([
    'translate:read', 'translate:write', 'gestures:read',
    'models:read', 'models:predict', 'voice:process', 'stats:read'
  ]).withMessage('Invalid permission'),
  body('environment').optional().isIn(['development', 'staging', 'production']).withMessage('Invalid environment'),
  body('expiresIn').optional().isString().withMessage('ExpiresIn must be a string'),
  body('quotas').optional().isObject().withMessage('Quotas must be an object'),
  body('quotas.dailyRequests').optional().isInt({ min: 1, max: 100000 }).withMessage('Daily requests must be 1-100000'),
  body('quotas.monthlyRequests').optional().isInt({ min: 1, max: 5000000 }).withMessage('Monthly requests must be 1-5000000'),
  body('ipWhitelist').optional().isArray().withMessage('IP whitelist must be an array'),
  body('domainWhitelist').optional().isArray().withMessage('Domain whitelist must be an array'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      name,
      description,
      permissions = ['translate:read', 'gestures:read'],
      environment = 'development',
      expiresIn,
      quotas = {},
      rateLimits = {},
      ipWhitelist = [],
      domainWhitelist = [],
      tags = []
    } = req.body;

    // Validate permissions based on user role/plan (basic validation)
    const maxPermissions = req.user.plan === 'premium' ? 10 : 5;
    if (permissions.length > maxPermissions) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxPermissions} permissions allowed for your plan`
      });
    }

    // Check if user has reached API key limit
    const existingKeys = await apiKeyService.getUserApiKeys(req.user._id);
    const maxKeys = req.user.plan === 'premium' ? 20 : 5;
    
    if (existingKeys.length >= maxKeys) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxKeys} API keys allowed for your plan`
      });
    }

    const options = {
      name,
      description,
      permissions,
      environment,
      expiresIn,
      quotas: {
        dailyRequests: quotas.dailyRequests || 1000,
        monthlyRequests: quotas.monthlyRequests || 30000,
        concurrentRequests: quotas.concurrentRequests || 10
      },
      rateLimits: {
        requestsPerMinute: rateLimits.requestsPerMinute || 60,
        requestsPerHour: rateLimits.requestsPerHour || 1000,
        burstRequests: rateLimits.burstRequests || 20
      },
      ipWhitelist,
      domainWhitelist,
      tags
    };

    const apiKey = await apiKeyService.generateApiKey(req.user._id, options);

    res.status(201).json({
      success: true,
      data: {
        ...apiKey,
        warning: 'This is the only time the full API key will be displayed. Please store it securely.'
      }
    });

  } catch (error) {
    logger.error('Error creating API key', {
      error: error.message,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating API key'
    });
  }
});

// Get specific API key details
router.get('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const apiKeys = await apiKeyService.getUserApiKeys(req.user._id);
    const apiKey = apiKeys.find(key => key.keyId === keyId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      data: { apiKey }
    });

  } catch (error) {
    logger.error('Error fetching API key details', {
      error: error.message,
      keyId: req.params.keyId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching API key details'
    });
  }
});

// Update API key
router.put('/:keyId', [
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array'),
  body('permissions.*').optional().isIn([
    'translate:read', 'translate:write', 'gestures:read',
    'models:read', 'models:predict', 'voice:process', 'stats:read'
  ]).withMessage('Invalid permission'),
  body('quotas').optional().isObject().withMessage('Quotas must be an object'),
  body('ipWhitelist').optional().isArray().withMessage('IP whitelist must be an array'),
  body('domainWhitelist').optional().isArray().withMessage('Domain whitelist must be an array'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { keyId } = req.params;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.hashedKey;
    delete updates.keyId;
    delete updates.prefix;
    delete updates.usage;

    const result = await apiKeyService.updateApiKey(keyId, req.user._id, updates);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key updated successfully'
    });

  } catch (error) {
    logger.error('Error updating API key', {
      error: error.message,
      keyId: req.params.keyId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating API key'
    });
  }
});

// Rotate API key (generate new secret)
router.post('/:keyId/rotate', async (req, res) => {
  try {
    const { keyId } = req.params;

    const result = await apiKeyService.rotateApiKey(keyId, req.user._id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...result,
        warning: 'This is the only time the new API key will be displayed. Please update your applications immediately.'
      }
    });

  } catch (error) {
    logger.error('Error rotating API key', {
      error: error.message,
      keyId: req.params.keyId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error rotating API key'
    });
  }
});

// Revoke API key
router.delete('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;

    const result = await apiKeyService.revokeApiKey(keyId, req.user._id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    logger.error('Error revoking API key', {
      error: error.message,
      keyId: req.params.keyId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error revoking API key'
    });
  }
});

// Get API key usage statistics
router.get('/:keyId/usage', [
  query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe')
], async (req, res) => {
  try {
    const { keyId } = req.params;
    const { timeframe = '24h' } = req.query;

    // Verify user owns this API key
    const apiKeys = await apiKeyService.getUserApiKeys(req.user._id);
    const apiKey = apiKeys.find(key => key.keyId === keyId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    const stats = await apiKeyService.getUsageStats(keyId, timeframe);

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Error fetching API key usage', {
      error: error.message,
      keyId: req.params.keyId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error fetching usage statistics'
    });
  }
});

// Test API key (verify it works)
router.post('/:keyId/test', async (req, res) => {
  try {
    const { keyId } = req.params;

    // Get the API key
    const apiKeys = await apiKeyService.getUserApiKeys(req.user._id);
    const apiKey = apiKeys.find(key => key.keyId === keyId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Perform a test validation
    const testResult = {
      keyId,
      name: apiKey.name,
      isActive: !apiKey.isExpired,
      permissions: apiKey.permissions,
      quotaStatus: {
        dailyUsed: apiKey.usage.dailyRequests,
        dailyLimit: apiKey.quotas.dailyRequests,
        monthlyUsed: apiKey.usage.monthlyRequests,
        monthlyLimit: apiKey.quotas.monthlyRequests
      },
      lastUsed: apiKey.lastUsed,
      expiresAt: apiKey.expiresAt
    };

    res.json({
      success: true,
      data: testResult,
      message: 'API key is valid and ready to use'
    });

  } catch (error) {
    logger.error('Error testing API key', {
      error: error.message,
      keyId: req.params.keyId,
      userId: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error testing API key'
    });
  }
});

// Get available permissions (for UI dropdowns)
router.get('/meta/permissions', (req, res) => {
  const permissions = [
    {
      key: 'translate:read',
      name: 'Translation - Read',
      description: 'Access text-to-sign translation endpoints'
    },
    {
      key: 'translate:write',
      name: 'Translation - Write',
      description: 'Access batch translation and advanced translation features'
    },
    {
      key: 'gestures:read',
      name: 'Gestures - Read',
      description: 'Access gesture library and search endpoints'
    },
    {
      key: 'models:read',
      name: 'Models - Read',
      description: 'Access ML model information endpoints'
    },
    {
      key: 'models:predict',
      name: 'Models - Predict',
      description: 'Access ML model prediction endpoints'
    },
    {
      key: 'voice:process',
      name: 'Voice - Process',
      description: 'Access voice input processing endpoints'
    },
    {
      key: 'stats:read',
      name: 'Statistics - Read',
      description: 'Access usage statistics and analytics endpoints'
    }
  ];

  res.json({
    success: true,
    data: { permissions }
  });
});

// Get quota presets (for different use cases)
router.get('/meta/quota-presets', (req, res) => {
  const presets = {
    development: {
      name: 'Development',
      description: 'For testing and development',
      quotas: {
        dailyRequests: 1000,
        monthlyRequests: 10000,
        concurrentRequests: 5
      },
      rateLimits: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        burstRequests: 10
      }
    },
    production_low: {
      name: 'Production - Low Volume',
      description: 'For small applications',
      quotas: {
        dailyRequests: 5000,
        monthlyRequests: 100000,
        concurrentRequests: 10
      },
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        burstRequests: 20
      }
    },
    production_high: {
      name: 'Production - High Volume',
      description: 'For large applications',
      quotas: {
        dailyRequests: 20000,
        monthlyRequests: 500000,
        concurrentRequests: 25
      },
      rateLimits: {
        requestsPerMinute: 120,
        requestsPerHour: 5000,
        burstRequests: 50
      }
    }
  };

  res.json({
    success: true,
    data: { presets }
  });
});

module.exports = router;