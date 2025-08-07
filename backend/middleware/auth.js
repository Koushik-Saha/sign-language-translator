const jwt = require('jsonwebtoken');
const User = require('../models/User');
const apiKeyService = require('../services/apiKeyService');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token is required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or user not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication' 
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  return { accessToken, refreshToken };
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// API Key authentication middleware
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Include your API key in the X-API-Key header',
        timestamp: new Date().toISOString()
      });
    }

    // Get request metadata
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const domain = req.get('Host');
    const endpoint = req.path;

    // Validate API key
    const keyData = await apiKeyService.validateApiKey(apiKey, {
      ipAddress,
      userAgent,
      domain,
      endpoint,
      checkPermissions: getRequiredPermissions(req)
    });

    // Attach key data to request
    req.apiKey = keyData;
    req.startTime = Date.now();

    // Set rate limit headers
    const usageStats = await apiKeyService.getUsageStats(keyData.keyId);
    res.setHeader('X-API-Key-Name', keyData.name);
    res.setHeader('X-RateLimit-Limit', usageStats.rateLimits.requestsPerHour);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, usageStats.rateLimits.requestsPerHour - usageStats.dailyRequests));
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 3600000).toISOString());

    next();
  } catch (error) {
    let statusCode = 401;
    let errorType = 'unauthorized';

    if (error.message.includes('quota exceeded')) {
      statusCode = 429;
      errorType = 'quota_exceeded';
    } else if (error.message.includes('not whitelisted')) {
      statusCode = 403;
      errorType = 'forbidden';
    } else if (error.message.includes('permissions')) {
      statusCode = 403;
      errorType = 'insufficient_permissions';
    }

    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Helper function to determine required permissions based on request
const getRequiredPermissions = (req) => {
  const method = req.method.toLowerCase();
  const path = req.path;

  // Define permission mappings
  const permissionMap = {
    'GET /translate': ['translate:read'],
    'POST /translate': ['translate:write'],
    'GET /gestures': ['gestures:read'],
    'POST /gestures': ['gestures:read'],
    'GET /models': ['models:read'],
    'POST /models/predict': ['models:predict'],
    'POST /voice': ['voice:process'],
    'GET /usage': ['stats:read']
  };

  // Find matching permission
  for (const [route, permissions] of Object.entries(permissionMap)) {
    const [routeMethod, routePath] = route.split(' ');
    if (method === routeMethod.toLowerCase() && path.includes(routePath)) {
      return permissions;
    }
  }

  return []; // No specific permissions required
};

// Optional API key authentication (doesn't fail if no key provided)
const optionalApiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (apiKey) {
      // Use the main API key auth logic but don't fail if validation fails
      try {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        const domain = req.get('Host');

        const keyData = await apiKeyService.validateApiKey(apiKey, {
          ipAddress,
          userAgent,
          domain,
          endpoint: req.path
        });

        req.apiKey = keyData;
        req.startTime = Date.now();
      } catch (error) {
        // Log but don't fail the request
        console.warn('Optional API key validation failed:', error.message);
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail the request
    next();
  }
};

// Combined authentication (supports both JWT and API key)
const flexibleAuth = async (req, res, next) => {
  const hasJwtToken = req.header('Authorization')?.startsWith('Bearer ');
  const hasApiKey = req.header('X-API-Key');

  if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  } else if (hasJwtToken) {
    return auth(req, res, next);
  } else {
    return res.status(401).json({
      success: false,
      error: 'authentication_required',
      message: 'Authentication required. Provide either JWT token or API key.',
      acceptedMethods: {
        jwt: 'Authorization: Bearer <token>',
        apiKey: 'X-API-Key: <key>'
      },
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  auth,
  optionalAuth,
  apiKeyAuth,
  optionalApiKeyAuth,
  flexibleAuth,
  generateTokens,
  verifyRefreshToken
};