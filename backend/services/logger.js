const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.prettyPrint()
    ),
    defaultMeta: { service: 'sign-language-translator' },
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'exceptions.log'),
            maxsize: 5242880,
            maxFiles: 5,
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'rejections.log'),
            maxsize: 5242880,
            maxFiles: 5,
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

class AlertingSystem {
    constructor() {
        this.errorCounts = new Map();
        this.alertThresholds = {
            error: 10,      // 10 errors in 5 minutes
            warning: 50,    // 50 warnings in 5 minutes
            critical: 5     // 5 critical errors in 5 minutes
        };
        this.timeWindow = 5 * 60 * 1000; // 5 minutes
        
        setInterval(() => {
            this.checkAlerts();
        }, 60000); // Check every minute
    }

    recordError(level, message, meta = {}) {
        const now = Date.now();
        const key = `${level}-${Math.floor(now / this.timeWindow)}`;
        
        if (!this.errorCounts.has(key)) {
            this.errorCounts.set(key, []);
        }
        
        this.errorCounts.get(key).push({ timestamp: now, message, meta });
        
        logger.log(level, message, meta);
    }

    checkAlerts() {
        const now = Date.now();
        const currentWindow = Math.floor(now / this.timeWindow);
        
        for (const [level, threshold] of Object.entries(this.alertThresholds)) {
            const key = `${level}-${currentWindow}`;
            const errors = this.errorCounts.get(key) || [];
            
            if (errors.length >= threshold) {
                this.sendAlert(level, errors.length, errors);
            }
        }
        
        this.cleanupOldErrors();
    }

    cleanupOldErrors() {
        const now = Date.now();
        const cutoff = now - (2 * this.timeWindow); // Keep last 2 windows
        
        for (const [key, errors] of this.errorCounts.entries()) {
            const filteredErrors = errors.filter(error => error.timestamp > cutoff);
            if (filteredErrors.length === 0) {
                this.errorCounts.delete(key);
            } else {
                this.errorCounts.set(key, filteredErrors);
            }
        }
    }

    async sendAlert(level, count, errors) {
        const alert = {
            level,
            count,
            timestamp: new Date().toISOString(),
            errors: errors.slice(0, 5), // Include first 5 errors
            summary: this.generateErrorSummary(errors)
        };

        logger.error('ALERT_TRIGGERED', alert);
        
        // In production, send to monitoring service (PagerDuty, Slack, etc.)
        if (process.env.NODE_ENV === 'production') {
            await this.sendToMonitoringService(alert);
        }
    }

    generateErrorSummary(errors) {
        const errorTypes = {};
        const routes = {};
        
        errors.forEach(error => {
            const errorType = error.meta.type || 'unknown';
            const route = error.meta.route || 'unknown';
            
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            routes[route] = (routes[route] || 0) + 1;
        });
        
        return { errorTypes, routes };
    }

    async sendToMonitoringService(alert) {
        // Implement integration with monitoring services
        // Example: Slack webhook, PagerDuty, email notifications
        try {
            // Slack webhook example
            if (process.env.SLACK_WEBHOOK_URL) {
                await fetch(process.env.SLACK_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `🚨 Alert: ${alert.level} - ${alert.count} errors in 5 minutes`,
                        attachments: [{
                            color: alert.level === 'critical' ? 'danger' : 'warning',
                            fields: [
                                {
                                    title: 'Error Summary',
                                    value: JSON.stringify(alert.summary, null, 2),
                                    short: false
                                }
                            ]
                        }]
                    })
                });
            }
        } catch (error) {
            logger.error('Failed to send alert to monitoring service', error);
        }
    }
}

const alertingSystem = new AlertingSystem();

const enhancedLogger = {
    info: (message, meta = {}) => {
        logger.info(message, meta);
    },
    
    warn: (message, meta = {}) => {
        alertingSystem.recordError('warning', message, meta);
    },
    
    error: (message, meta = {}) => {
        alertingSystem.recordError('error', message, meta);
    },
    
    critical: (message, meta = {}) => {
        alertingSystem.recordError('critical', message, meta);
    },
    
    security: (message, meta = {}) => {
        const securityMeta = { ...meta, security: true };
        alertingSystem.recordError('warning', message, securityMeta);
    },
    
    performance: (message, meta = {}) => {
        logger.info(message, { ...meta, performance: true });
    },
    
    audit: (action, userId, meta = {}) => {
        logger.info(`AUDIT: ${action}`, {
            ...meta,
            userId,
            audit: true,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = enhancedLogger;