const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const logger = require('./logger');

// API Key Schema
const apiKeySchema = new mongoose.Schema({
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  hashedKey: {
    type: String,
    required: true
  },
  prefix: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  permissions: [{
    type: String,
    enum: [
      'translate:read',
      'translate:write',
      'gestures:read',
      'models:read',
      'models:predict',
      'voice:process',
      'stats:read',
      'admin:read',
      'admin:write'
    ]
  }],
  quotas: {
    dailyRequests: {
      type: Number,
      default: 1000,
      min: 0
    },
    monthlyRequests: {
      type: Number,
      default: 30000,
      min: 0
    },
    concurrentRequests: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    }
  },
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    dailyRequests: {
      type: Number,
      default: 0
    },
    monthlyRequests: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date
    }
  },
  rateLimits: {
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    burstRequests: {
      type: Number,
      default: 20
    }
  },
  ipWhitelist: [{
    type: String,
    validate: {
      validator: function(v) {
        // Basic IP validation (supports CIDR notation)
        return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v) || v === '*';
      },
      message: 'Invalid IP address format'
    }
  }],
  domainWhitelist: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9.-]+$/.test(v) || v === '*';
      },
      message: 'Invalid domain format'
    }
  }],
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'development'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  lastRotated: {
    type: Date
  },
  metadata: {
    userAgent: String,
    createdBy: String,
    tags: [String]
  }
}, {
  timestamps: true
});

// Indexes for performance
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ prefix: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
apiKeySchema.index({ 'usage.lastUsed': 1 });

// Virtual for checking if key is expired
apiKeySchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

class ApiKeyService {
  constructor() {
    this.activeKeys = new Map(); // In-memory cache for active keys
    this.usageTracker = new Map(); // Track usage for rate limiting
    
    // Clean up expired cache entries every hour
    setInterval(() => {
      this.cleanupCache();
    }, 60 * 60 * 1000);
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(userId, options = {}) {
    try {
      const {
        name,
        description,
        permissions = ['translate:read', 'gestures:read'],
        quotas = {},
        rateLimits = {},
        ipWhitelist = [],
        domainWhitelist = [],
        environment = 'development',
        expiresIn = null // null means no expiration
      } = options;

      if (!name) {
        throw new Error('API key name is required');
      }

      // Generate key components
      const keyId = crypto.randomUUID();
      const keySecret = crypto.randomBytes(32).toString('base64url');
      const prefix = `slt_${environment.charAt(0)}${crypto.randomBytes(4).toString('hex')}`;
      const fullKey = `${prefix}.${keySecret}`;

      // Hash the key for storage
      const hashedKey = await bcrypt.hash(keySecret, 12);

      // Calculate expiration date
      let expiresAt = null;
      if (expiresIn) {
        expiresAt = new Date();
        if (typeof expiresIn === 'number') {
          expiresAt.setTime(expiresAt.getTime() + expiresIn);
        } else if (typeof expiresIn === 'string') {
          // Parse duration strings like '30d', '1y', '6m'
          const match = expiresIn.match(/^(\d+)([dmy])$/);
          if (match) {
            const [, value, unit] = match;
            const multipliers = { d: 86400000, m: 2592000000, y: 31536000000 };
            expiresAt.setTime(expiresAt.getTime() + (parseInt(value) * multipliers[unit]));
          }
        }
      }

      // Create API key document
      const apiKey = new ApiKey({
        keyId,
        name,
        description,
        hashedKey,
        prefix,
        userId,
        permissions,
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
        environment,
        expiresAt,
        metadata: {
          createdBy: userId,
          tags: options.tags || []
        }
      });

      await apiKey.save();

      logger.info('API key generated', {
        userId,
        keyId,
        name,
        environment,
        permissions: permissions.length
      });

      return {
        keyId,
        key: fullKey, // Only returned once during creation
        name,
        permissions,
        quotas: apiKey.quotas,
        rateLimits: apiKey.rateLimits,
        environment,
        expiresAt,
        createdAt: apiKey.createdAt
      };

    } catch (error) {
      logger.error('Error generating API key', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Validate and authenticate an API key
   */
  async validateApiKey(keyString, options = {}) {
    try {
      const { checkPermissions = [], ipAddress, userAgent, domain } = options;

      if (!keyString || !keyString.includes('.')) {
        throw new Error('Invalid API key format');
      }

      const [prefix, keySecret] = keyString.split('.');

      // Check cache first
      const cacheKey = `${prefix}_${crypto.createHash('sha256').update(keySecret).digest('hex')}`;
      if (this.activeKeys.has(cacheKey)) {
        const cachedKey = this.activeKeys.get(cacheKey);
        if (cachedKey.expiresAt && cachedKey.expiresAt < new Date()) {
          this.activeKeys.delete(cacheKey);
        } else {
          return this.processKeyValidation(cachedKey, options);
        }
      }

      // Find key by prefix
      const apiKey = await ApiKey.findOne({
        prefix,
        isActive: true,
        $or: [
          { expiresAt: { $gte: new Date() } },
          { expiresAt: null }
        ]
      }).populate('userId', 'email name organizationId');

      if (!apiKey) {
        throw new Error('API key not found or expired');
      }

      // Verify key secret
      const isValid = await bcrypt.compare(keySecret, apiKey.hashedKey);
      if (!isValid) {
        throw new Error('Invalid API key');
      }

      // Cache the key
      this.activeKeys.set(cacheKey, apiKey.toObject());

      return this.processKeyValidation(apiKey, options);

    } catch (error) {
      logger.warn('API key validation failed', {
        error: error.message,
        ipAddress,
        userAgent
      });
      throw error;
    }
  }

  /**
   * Process key validation with checks and tracking
   */
  async processKeyValidation(apiKey, options = {}) {
    const { checkPermissions = [], ipAddress, userAgent, domain } = options;

    // Check IP whitelist
    if (apiKey.ipWhitelist.length > 0 && !apiKey.ipWhitelist.includes('*')) {
      const isIpAllowed = apiKey.ipWhitelist.some(allowedIp => {
        if (allowedIp === ipAddress) return true;
        // Support CIDR notation (basic implementation)
        if (allowedIp.includes('/')) {
          // This would need a proper CIDR library for production
          return false;
        }
        return false;
      });

      if (!isIpAllowed) {
        throw new Error('IP address not whitelisted');
      }
    }

    // Check domain whitelist
    if (apiKey.domainWhitelist.length > 0 && !apiKey.domainWhitelist.includes('*') && domain) {
      if (!apiKey.domainWhitelist.includes(domain)) {
        throw new Error('Domain not whitelisted');
      }
    }

    // Check permissions
    if (checkPermissions.length > 0) {
      const hasRequiredPermissions = checkPermissions.every(permission =>
        apiKey.permissions.includes(permission)
      );

      if (!hasRequiredPermissions) {
        throw new Error('Insufficient permissions');
      }
    }

    // Check quotas
    await this.checkQuotas(apiKey.keyId);

    // Update usage tracking
    await this.trackUsage(apiKey.keyId, {
      ipAddress,
      userAgent,
      endpoint: options.endpoint
    });

    return {
      keyId: apiKey.keyId,
      name: apiKey.name,
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
      permissions: apiKey.permissions,
      environment: apiKey.environment
    };
  }

  /**
   * Check if API key has exceeded quotas
   */
  async checkQuotas(keyId) {
    const apiKey = await ApiKey.findOne({ keyId });
    if (!apiKey) throw new Error('API key not found');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Reset daily counters if needed
    if (apiKey.usage.lastResetDate < today) {
      apiKey.usage.dailyRequests = 0;
      apiKey.usage.lastResetDate = today;
    }

    // Check daily quota
    if (apiKey.usage.dailyRequests >= apiKey.quotas.dailyRequests) {
      throw new Error('Daily quota exceeded');
    }

    // Check monthly quota
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (apiKey.usage.lastResetDate < monthStart) {
      apiKey.usage.monthlyRequests = 0;
    }

    if (apiKey.usage.monthlyRequests >= apiKey.quotas.monthlyRequests) {
      throw new Error('Monthly quota exceeded');
    }

    await apiKey.save();
  }

  /**
   * Track API usage
   */
  async trackUsage(keyId, metadata = {}) {
    try {
      await ApiKey.updateOne(
        { keyId },
        {
          $inc: {
            'usage.totalRequests': 1,
            'usage.dailyRequests': 1,
            'usage.monthlyRequests': 1
          },
          $set: {
            'usage.lastUsed': new Date()
          }
        }
      );

      // Log usage for analytics
      logger.info('API key usage tracked', {
        keyId,
        ...metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error tracking API usage', {
        error: error.message,
        keyId
      });
    }
  }

  /**
   * Get user's API keys
   */
  async getUserApiKeys(userId) {
    try {
      const apiKeys = await ApiKey.find({
        userId,
        isActive: true
      }, {
        hashedKey: 0 // Don't return the hashed key
      }).sort({ createdAt: -1 });

      return apiKeys.map(key => ({
        keyId: key.keyId,
        name: key.name,
        description: key.description,
        prefix: key.prefix,
        permissions: key.permissions,
        quotas: key.quotas,
        usage: key.usage,
        rateLimits: key.rateLimits,
        environment: key.environment,
        isExpired: key.isExpired,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        lastUsed: key.usage.lastUsed
      }));

    } catch (error) {
      logger.error('Error fetching user API keys', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId, userId) {
    try {
      const result = await ApiKey.updateOne(
        { keyId, userId },
        {
          $set: {
            isActive: false,
            revokedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('API key not found');
      }

      // Remove from cache
      this.activeKeys.forEach((value, key) => {
        if (value.keyId === keyId) {
          this.activeKeys.delete(key);
        }
      });

      logger.info('API key revoked', { keyId, userId });
      return true;

    } catch (error) {
      logger.error('Error revoking API key', {
        error: error.message,
        keyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update API key permissions and settings
   */
  async updateApiKey(keyId, userId, updates) {
    try {
      const allowedUpdates = [
        'name', 'description', 'permissions', 'quotas',
        'rateLimits', 'ipWhitelist', 'domainWhitelist', 'expiresAt'
      ];

      const sanitizedUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          sanitizedUpdates[key] = updates[key];
        }
      });

      const result = await ApiKey.updateOne(
        { keyId, userId },
        { $set: sanitizedUpdates }
      );

      if (result.matchedCount === 0) {
        throw new Error('API key not found');
      }

      // Clear cache for this key
      this.activeKeys.forEach((value, key) => {
        if (value.keyId === keyId) {
          this.activeKeys.delete(key);
        }
      });

      logger.info('API key updated', { keyId, userId, updates: Object.keys(sanitizedUpdates) });
      return true;

    } catch (error) {
      logger.error('Error updating API key', {
        error: error.message,
        keyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(keyId, timeframe = '24h') {
    try {
      const apiKey = await ApiKey.findOne({ keyId });
      if (!apiKey) throw new Error('API key not found');

      // This would typically query a time-series database for detailed metrics
      // For now, returning basic stats from the API key document
      return {
        keyId,
        keyName: apiKey.name,
        timeframe,
        totalRequests: apiKey.usage.totalRequests,
        dailyRequests: apiKey.usage.dailyRequests,
        monthlyRequests: apiKey.usage.monthlyRequests,
        quotas: apiKey.quotas,
        lastUsed: apiKey.usage.lastUsed,
        rateLimits: apiKey.rateLimits
      };

    } catch (error) {
      logger.error('Error fetching usage stats', {
        error: error.message,
        keyId
      });
      throw error;
    }
  }

  /**
   * Rotate API key (generate new secret)
   */
  async rotateApiKey(keyId, userId) {
    try {
      const apiKey = await ApiKey.findOne({ keyId, userId });
      if (!apiKey) throw new Error('API key not found');

      // Generate new key secret
      const newKeySecret = crypto.randomBytes(32).toString('base64url');
      const newHashedKey = await bcrypt.hash(newKeySecret, 12);
      const newFullKey = `${apiKey.prefix}.${newKeySecret}`;

      // Update key
      apiKey.hashedKey = newHashedKey;
      apiKey.lastRotated = new Date();
      await apiKey.save();

      // Clear from cache
      this.activeKeys.forEach((value, key) => {
        if (value.keyId === keyId) {
          this.activeKeys.delete(key);
        }
      });

      logger.info('API key rotated', { keyId, userId });

      return {
        keyId,
        key: newFullKey, // Only returned once
        rotatedAt: apiKey.lastRotated
      };

    } catch (error) {
      logger.error('Error rotating API key', {
        error: error.message,
        keyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = new Date();
    let cleanedCount = 0;

    this.activeKeys.forEach((value, key) => {
      if (value.expiresAt && value.expiresAt < now) {
        this.activeKeys.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired API keys from cache', { cleanedCount });
    }
  }

  /**
   * Admin function to get all API keys
   */
  async getAllApiKeys(filters = {}) {
    try {
      const query = { ...filters };
      const apiKeys = await ApiKey.find(query, {
        hashedKey: 0
      }).populate('userId', 'email name').sort({ createdAt: -1 });

      return apiKeys;

    } catch (error) {
      logger.error('Error fetching all API keys', {
        error: error.message,
        filters
      });
      throw error;
    }
  }
}

module.exports = new ApiKeyService();