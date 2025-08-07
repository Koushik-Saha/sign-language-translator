const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');
const logger = require('../services/logger');

class InputValidationService {
  constructor() {
    this.sanitizationConfig = {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    };
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(input) {
    if (!input || typeof input !== 'string') return input;
    return DOMPurify.sanitize(input, this.sanitizationConfig);
  }

  /**
   * Sanitize text input (remove potentially harmful characters)
   */
  sanitizeText(input) {
    if (!input || typeof input !== 'string') return input;
    
    // Remove null bytes and control characters except newlines and tabs
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize unicode
    sanitized = sanitized.normalize('NFKC');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  /**
   * Validate and sanitize file path
   */
  sanitizeFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    
    // Remove path traversal attempts
    let sanitized = filePath.replace(/\.\./g, '');
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');
    
    // Remove leading slashes to prevent absolute path access
    sanitized = sanitized.replace(/^\/+/, '');
    
    return sanitized;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    return validator.isEmail(email);
  }

  /**
   * Validate MongoDB ObjectId
   */
  isValidObjectId(id) {
    return validator.isMongoId(id);
  }

  /**
   * Validate URL
   */
  isValidUrl(url) {
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true
    });
  }

  /**
   * Validate phone number
   */
  isValidPhoneNumber(phone) {
    return validator.isMobilePhone(phone, 'any', { strictMode: false });
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeText(key);
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeText(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Check for SQL injection patterns
   */
  hasSqlInjection(input) {
    if (!input || typeof input !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(UNION\s+(ALL\s+)?SELECT)/i,
      /((\'|\"|`)((\%27)|(\')|(;))|(\%3B))/i,
      /((\%27)|(\'))\s*((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
      /(;|(<|>|\$|\`|\||\^))/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  hasXssPatterns(input) {
    if (!input || typeof input !== 'string') return false;
    
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for command injection patterns
   */
  hasCommandInjection(input) {
    if (!input || typeof input !== 'string') return false;
    
    const commandPatterns = [
      /[;&|`$\(\){}[\]]/,
      /(rm|del|format|fdisk|mkfs)/i,
      /(cat|type|more|less)/i,
      /(wget|curl|nc|netcat)/i
    ];
    
    return commandPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file, allowedTypes = [], maxSize = 50 * 1024 * 1024) {
    const errors = [];
    
    if (!file) {
      errors.push('No file provided');
      return errors;
    }
    
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
    }
    
    // Check MIME type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    // Check filename
    const filename = file.originalname || file.filename;
    if (filename) {
      // Check for path traversal in filename
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        errors.push('Invalid filename - path traversal detected');
      }
      
      // Check for potentially dangerous extensions
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.jar', '.app'];
      const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      if (dangerousExtensions.includes(extension)) {
        errors.push(`Dangerous file extension: ${extension}`);
      }
    }
    
    return errors;
  }

  /**
   * Middleware to validate request body
   */
  validateRequest() {
    return (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors:', { 
          errors: errors.array(), 
          ip: req.ip, 
          userAgent: req.headers['user-agent'] 
        });
        
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }
      next();
    };
  }

  /**
   * Middleware to sanitize request data
   */
  sanitizeRequest() {
    return (req, res, next) => {
      try {
        // Sanitize body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }
        
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }
        
        // Sanitize params
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params);
        }
        
        next();
      } catch (error) {
        logger.error('Error sanitizing request:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error during request processing'
        });
      }
    };
  }

  /**
   * Middleware to detect and block malicious requests
   */
  detectMaliciousInput() {
    return (req, res, next) => {
      const suspicious = [];
      
      // Check all string values in request
      const checkValue = (value, source) => {
        if (typeof value === 'string') {
          if (this.hasSqlInjection(value)) {
            suspicious.push({ type: 'SQL Injection', source, value: value.substring(0, 100) });
          }
          if (this.hasXssPatterns(value)) {
            suspicious.push({ type: 'XSS', source, value: value.substring(0, 100) });
          }
          if (this.hasCommandInjection(value)) {
            suspicious.push({ type: 'Command Injection', source, value: value.substring(0, 100) });
          }
        }
      };
      
      // Check body
      if (req.body) {
        this.traverseObject(req.body, (value) => checkValue(value, 'body'));
      }
      
      // Check query
      if (req.query) {
        this.traverseObject(req.query, (value) => checkValue(value, 'query'));
      }
      
      // Check headers
      Object.entries(req.headers).forEach(([key, value]) => {
        checkValue(value, `header:${key}`);
      });
      
      if (suspicious.length > 0) {
        logger.error('Malicious input detected:', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          path: req.path,
          method: req.method,
          suspicious
        });
        
        return res.status(400).json({
          success: false,
          message: 'Malicious input detected'
        });
      }
      
      next();
    };
  }

  /**
   * Traverse object recursively
   */
  traverseObject(obj, callback) {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (typeof item === 'object') {
          this.traverseObject(item, callback);
        } else {
          callback(item);
        }
      });
    } else {
      Object.values(obj).forEach(value => {
        if (typeof value === 'object') {
          this.traverseObject(value, callback);
        } else {
          callback(value);
        }
      });
    }
  }

  /**
   * Common validation chains
   */
  getCommonValidations() {
    return {
      email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
      
      password: body('password')
        .isLength({ min: 8, max: 128 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be 8-128 characters with uppercase, lowercase, number, and special character'),
      
      username: body('username')
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-30 characters, alphanumeric with _ or -'),
      
      objectId: param('id')
        .isMongoId()
        .withMessage('Invalid ID format'),
      
      text: body('text')
        .isLength({ min: 1, max: 5000 })
        .trim()
        .escape()
        .withMessage('Text must be 1-5000 characters'),
      
      url: body('url')
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Invalid URL format'),
      
      phoneNumber: body('phoneNumber')
        .optional()
        .isMobilePhone('any')
        .withMessage('Invalid phone number format'),
      
      sortBy: query('sortBy')
        .optional()
        .isIn(['createdAt', 'updatedAt', 'name', 'email', 'username'])
        .withMessage('Invalid sort field'),
      
      sortOrder: query('sortOrder')
        .optional()
        .isIn(['asc', 'desc', '1', '-1'])
        .withMessage('Invalid sort order'),
      
      page: query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be a number between 1 and 1000'),
      
      limit: query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be a number between 1 and 100'),
      
      gestureLabel: body('gestureLabel')
        .isLength({ min: 1, max: 50 })
        .matches(/^[A-Z0-9_\s-]+$/)
        .withMessage('Gesture label must be 1-50 uppercase characters, numbers, spaces, underscores, or hyphens'),
      
      gestureType: body('gestureType')
        .isIn(['letter', 'word', 'phrase', 'number'])
        .withMessage('Invalid gesture type'),
      
      modelType: body('type')
        .isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling'])
        .withMessage('Invalid model type'),
      
      consentType: body('consentType')
        .isIn(['research', 'model_training', 'performance_analytics', 'feature_improvement'])
        .withMessage('Invalid consent type')
    };
  }
}

module.exports = new InputValidationService();