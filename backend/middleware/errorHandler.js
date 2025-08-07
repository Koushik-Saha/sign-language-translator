const logger = require('../services/logger');
const metricsCollector = require('../services/metricsCollector');

class ApplicationError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends ApplicationError {
    constructor(message, field = null) {
        super(message, 400);
        this.field = field;
        this.type = 'validation';
    }
}

class AuthenticationError extends ApplicationError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.type = 'authentication';
    }
}

class AuthorizationError extends ApplicationError {
    constructor(message = 'Access denied') {
        super(message, 403);
        this.type = 'authorization';
    }
}

class NotFoundError extends ApplicationError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
        this.type = 'not_found';
    }
}

class RateLimitError extends ApplicationError {
    constructor(message = 'Too many requests') {
        super(message, 429);
        this.type = 'rate_limit';
    }
}

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    
    // Log the error
    const errorMeta = {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        stack: err.stack,
        type: error.type || 'unknown',
        route: req.route?.path || req.path
    };

    // Determine log level based on error type and status
    if (err.statusCode >= 500) {
        logger.error(err.message, errorMeta);
    } else if (err.statusCode >= 400) {
        logger.warn(err.message, errorMeta);
    } else {
        logger.error(err.message, errorMeta);
    }

    // Record metrics
    metricsCollector.recordError(
        error.type || 'unknown',
        req.route?.path || req.path,
        err.statusCode || 500
    );

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new NotFoundError(message);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new ValidationError(message);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new ValidationError(message);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new AuthenticationError(message);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new AuthenticationError(message);
    }

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'File too large';
        error = new ValidationError(message);
    }

    // Security-related errors
    if (error.type === 'authentication' || error.type === 'authorization') {
        logger.security(`Security event: ${error.type}`, {
            ...errorMeta,
            severity: 'high'
        });
    }

    // Rate limiting errors
    if (error.type === 'rate_limit') {
        logger.security('Rate limit exceeded', {
            ...errorMeta,
            severity: 'medium'
        });
    }

    // Send error response
    const response = {
        success: false,
        error: {
            message: error.message || 'Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    };

    // Add error ID for tracking
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    response.error.id = errorId;
    
    logger.error('Error response sent', {
        errorId,
        statusCode: error.statusCode || 500,
        ...errorMeta
    });

    res.status(error.statusCode || 500).json(response);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Global unhandled promise rejection handler
process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection', {
        error: err.message,
        stack: err.stack,
        promise: promise.toString()
    });
    
    // Close server gracefully
    process.exit(1);
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
        error: err.message,
        stack: err.stack
    });
    
    // Close server gracefully
    process.exit(1);
});

module.exports = {
    errorHandler,
    asyncHandler,
    ApplicationError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    RateLimitError
};
