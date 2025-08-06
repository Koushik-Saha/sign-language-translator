const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');
const crypto = require('crypto');
const logger = require('../services/logger');

// Install additional security packages first
const additionalPackages = [
    'express-mongo-sanitize',
    'xss',
    'validator',
    'csurf'
];

class SecurityMiddleware {
    constructor() {
        this.csrfTokens = new Map();
        this.setupHelmet();
    }

    setupHelmet() {
        this.helmetConfig = helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    scriptSrc: ["'self'", "'unsafe-eval'"], // Needed for development
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "https:"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"]
                }
            },
            crossOriginEmbedderPolicy: false, // Disable for compatibility
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            noSniff: true,
            frameguard: { action: 'deny' },
            xssFilter: true,
            referrerPolicy: { policy: "same-origin" }
        });
    }

    // Apply all security middleware
    applySecurityMiddleware(app) {
        // Basic security headers
        app.use(this.helmetConfig);

        // Rate limiting
        app.use(this.createRateLimit());

        // Input sanitization
        app.use(this.sanitizeInput);

        // XSS protection
        app.use(this.xssProtection);

        // CSRF protection
        app.use(this.csrfProtection.bind(this));

        // Security logging
        app.use(this.securityLogging);

        logger.info('Security middleware applied');
    }

    // Rate limiting configuration
    createRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests from this IP',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            // Custom key generator for authenticated users
            keyGenerator: (req) => {
                return req.user?.id || req.ip;
            },
            // Skip rate limiting for specific routes
            skip: (req) => {
                const skipPaths = ['/api/health', '/api/metrics'];
                return skipPaths.some(path => req.path.startsWith(path));
            },
            onLimitReached: (req) => {
                logger.security('Rate limit exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path,
                    userId: req.user?.id
                });
            }
        });
    }

    // Input sanitization middleware
    sanitizeInput(req, res, next) {
        try {
            // Sanitize against NoSQL injection
            if (req.body) {
                req.body = mongoSanitize.sanitize(req.body);
            }
            if (req.query) {
                req.query = mongoSanitize.sanitize(req.query);
            }
            if (req.params) {
                req.params = mongoSanitize.sanitize(req.params);
            }

            // Additional sanitization for specific fields
            if (req.body) {
                for (const [key, value] of Object.entries(req.body)) {
                    if (typeof value === 'string') {
                        // Remove potential script tags and dangerous content
                        req.body[key] = SecurityMiddleware.sanitizeString(value);
                    }
                }
            }

            next();
        } catch (error) {
            logger.error('Input sanitization failed', {
                error: error.message,
                path: req.path
            });
            next(error);
        }
    }

    // XSS protection middleware
    xssProtection(req, res, next) {
        try {
            if (req.body && typeof req.body === 'object') {
                req.body = SecurityMiddleware.deepXSSClean(req.body);
            }

            if (req.query && typeof req.query === 'object') {
                req.query = SecurityMiddleware.deepXSSClean(req.query);
            }

            next();
        } catch (error) {
            logger.error('XSS protection failed', {
                error: error.message,
                path: req.path
            });
            next(error);
        }
    }

    // CSRF protection middleware
    async csrfProtection(req, res, next) {
        try {
            // Skip CSRF for API endpoints with API key authentication
            if (req.headers['x-api-key']) {
                return next();
            }

            // Skip for GET, HEAD, OPTIONS
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }

            const sessionId = req.sessionID || req.headers['x-session-id'];
            if (!sessionId) {
                return res.status(400).json({
                    error: 'Session required for CSRF protection'
                });
            }

            const submittedToken = req.headers['x-csrf-token'] || req.body._csrf;
            const storedToken = this.csrfTokens.get(sessionId);

            if (!submittedToken || !storedToken || !crypto.timingSafeEqual(
                Buffer.from(submittedToken),
                Buffer.from(storedToken)
            )) {
                logger.security('CSRF token validation failed', {
                    sessionId,
                    ip: req.ip,
                    path: req.path,
                    hasToken: !!submittedToken
                });

                return res.status(403).json({
                    error: 'Invalid CSRF token'
                });
            }

            next();
        } catch (error) {
            logger.error('CSRF protection error', {
                error: error.message,
                path: req.path
            });
            return res.status(500).json({
                error: 'CSRF protection error'
            });
        }
    }

    // Generate CSRF token
    generateCSRFToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        this.csrfTokens.set(sessionId, token);
        
        // Set expiration for token (1 hour)
        setTimeout(() => {
            this.csrfTokens.delete(sessionId);
        }, 60 * 60 * 1000);

        return token;
    }

    // Security logging middleware
    securityLogging(req, res, next) {
        // Log suspicious patterns
        const suspiciousPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /eval\s*\(/gi,
            /expression\s*\(/gi,
            /vbscript:/gi,
            /data:text\/html/gi
        ];

        const userInput = JSON.stringify({
            body: req.body,
            query: req.query,
            params: req.params
        });

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(userInput)) {
                logger.security('Suspicious input pattern detected', {
                    pattern: pattern.toString(),
                    path: req.path,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    input: userInput.substring(0, 500) // Limit log size
                });
                break;
            }
        }

        next();
    }

    // File upload security
    createSecureUploadMiddleware(options = {}) {
        const {
            allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'],
            maxFileSize = 5 * 1024 * 1024, // 5MB
            maxFiles = 5
        } = options;

        return (req, res, next) => {
            if (!req.files || req.files.length === 0) {
                return next();
            }

            for (const file of req.files) {
                // Check file size
                if (file.size > maxFileSize) {
                    return res.status(413).json({
                        error: 'File too large',
                        maxSize: maxFileSize
                    });
                }

                // Check mime type
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    logger.security('Invalid file type uploaded', {
                        fileName: file.originalname,
                        mimeType: file.mimetype,
                        ip: req.ip
                    });

                    return res.status(400).json({
                        error: 'Invalid file type',
                        allowedTypes: allowedMimeTypes
                    });
                }

                // Check file extension
                const allowedExtensions = allowedMimeTypes.map(type => {
                    const ext = type.split('/')[1];
                    return ext === 'jpeg' ? 'jpg' : ext;
                });

                const fileExt = file.originalname.split('.').pop().toLowerCase();
                if (!allowedExtensions.includes(fileExt)) {
                    return res.status(400).json({
                        error: 'Invalid file extension',
                        allowedExtensions
                    });
                }

                // Rename file to prevent path traversal
                file.filename = `${crypto.randomUUID()}.${fileExt}`;
            }

            next();
        };
    }

    // SQL injection protection for query parameters
    static validateSQLParams(params) {
        const sqlPatterns = [
            /(\s*(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+)/gi,
            /(\s*(and|or)\s+\d+\s*=\s*\d+)/gi,
            /(\s*;\s*(drop|delete|update|insert))/gi
        ];

        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                for (const pattern of sqlPatterns) {
                    if (pattern.test(value)) {
                        throw new Error(`SQL injection attempt detected in parameter: ${key}`);
                    }
                }
            }
        }
    }

    // Deep XSS cleaning
    static deepXSSClean(obj) {
        if (typeof obj === 'string') {
            return xss(obj, {
                whiteList: {}, // No HTML tags allowed
                stripIgnoreTag: true,
                stripIgnoreTagBody: ['script']
            });
        }

        if (Array.isArray(obj)) {
            return obj.map(item => SecurityMiddleware.deepXSSClean(item));
        }

        if (obj && typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                cleaned[key] = SecurityMiddleware.deepXSSClean(value);
            }
            return cleaned;
        }

        return obj;
    }

    // String sanitization
    static sanitizeString(str) {
        if (typeof str !== 'string') return str;

        return str
            .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .replace(/eval\s*\(/gi, '') // Remove eval calls
            .replace(/expression\s*\(/gi, '') // Remove CSS expressions
            .trim();
    }

    // Validate email addresses
    static validateEmail(email) {
        return validator.isEmail(email) && !validator.contains(email, '<') && !validator.contains(email, '>');
    }

    // Validate URLs
    static validateURL(url) {
        if (!validator.isURL(url, {
            protocols: ['http', 'https'],
            require_protocol: true
        })) {
            return false;
        }

        // Additional checks for suspicious patterns
        const suspiciousPatterns = [
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /file:/i,
            /ftp:/i
        ];

        return !suspiciousPatterns.some(pattern => pattern.test(url));
    }

    // Password strength validation
    static validatePasswordStrength(password) {
        const minLength = 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const score = [
            password.length >= minLength,
            hasUppercase,
            hasLowercase,
            hasNumbers,
            hasSpecialChars
        ].reduce((acc, curr) => acc + (curr ? 1 : 0), 0);

        return {
            isValid: score >= 4,
            score,
            requirements: {
                minLength: password.length >= minLength,
                hasUppercase,
                hasLowercase,
                hasNumbers,
                hasSpecialChars
            }
        };
    }

    // API key validation
    static validateApiKey(apiKey) {
        if (typeof apiKey !== 'string') return false;
        if (apiKey.length < 32) return false;
        return /^[a-zA-Z0-9\-_]+$/.test(apiKey);
    }

    // Request signature validation
    static validateRequestSignature(payload, signature, secret) {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }
}

module.exports = SecurityMiddleware;