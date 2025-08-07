const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const logger = require('../services/logger');
const { ValidationError } = require('./errorHandler');

class AdvancedRateLimiter {
    constructor() {
        this.redisClient = null;
        this.initializeRedis();
        
        // Track suspicious IPs
        this.suspiciousIPs = new Map();
        this.blockedIPs = new Set();
        
        // DoS attack patterns
        this.dosPatterns = {
            rapidRequests: { threshold: 50, window: 60000 }, // 50 requests in 1 minute
            largePayloads: { threshold: 10 * 1024 * 1024 }, // 10MB
            suspiciousUserAgents: [
                'curl', 'wget', 'python', 'bot', 'crawler',
                'scanner', 'scraper', 'spider'
            ]
        };
    }

    async initializeRedis() {
        try {
            if (process.env.REDIS_URL) {
                this.redisClient = redis.createClient({
                    url: process.env.REDIS_URL
                });
                
                await this.redisClient.connect();
                logger.info('Redis connected for rate limiting');
            }
        } catch (error) {
            logger.warn('Redis not available, using memory store for rate limiting', {
                error: error.message
            });
        }
    }

    // General API rate limiting
    createGeneralRateLimit() {
        const store = this.redisClient ? 
            new RedisStore({
                sendCommand: (...args) => this.redisClient.sendCommand(args),
            }) : undefined;

        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: (req) => {
                // Different limits based on user type
                if (req.user?.isPremium) return 1000;
                if (req.user) return 300;
                return 100; // Anonymous users
            },
            store,
            message: {
                error: 'Too many requests',
                retryAfter: '15 minutes',
                upgradeMessage: 'Upgrade to premium for higher limits'
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: this.generateRateLimitKey.bind(this),
            skip: this.shouldSkipRateLimit.bind(this),
        });
    }

    // Strict rate limiting for sensitive endpoints
    createStrictRateLimit() {
        const store = this.redisClient ? 
            new RedisStore({
                sendCommand: (...args) => this.redisClient.sendCommand(args),
            }) : undefined;

        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: (req) => {
                // Very strict limits for sensitive operations
                if (req.user?.isAdmin) return 100;
                if (req.user) return 10;
                return 3; // Anonymous users
            },
            store,
            message: {
                error: 'Rate limit exceeded for sensitive operation',
                retryAfter: '1 hour'
            },
            keyGenerator: this.generateRateLimitKey.bind(this),
            // onLimitReached: (req) => {
            //     logger.security('Strict rate limit exceeded', {
            //         ip: req.ip,
            //         path: req.path,
            //         userId: req.user?.id,
            //         userAgent: req.get('User-Agent')
            //     });
            // }
        });
    }

    // Slow down middleware for gradual response delay
    createSlowDown() {
        return slowDown({
            windowMs: 15 * 60 * 1000, // 15 minutes
            delayAfter: 50, // Start slowing down after 50 requests
            delayMs: () => 500,
            maxDelayMs: 10000, // Maximum delay of 10 seconds
            keyGenerator: this.generateRateLimitKey.bind(this),
            // onLimitReached: (req) => {
            //     logger.warn('Request slowdown activated', {
            //         ip: req.ip,
            //         path: req.path,
            //         userId: req.user?.id
            //     });
            // }
        });
    }

    // DoS protection middleware
    dosProtection() {
        return async (req, res, next) => {
            try {
                const clientIP = this.getClientIP(req);
                
                // Check if IP is blocked
                if (this.blockedIPs.has(clientIP)) {
                    logger.security('Blocked IP attempted access', {
                        ip: clientIP,
                        path: req.path,
                        userAgent: req.get('User-Agent')
                    });
                    return res.status(429).json({
                        error: 'Access denied',
                        reason: 'IP blocked due to suspicious activity'
                    });
                }

                // Check for various DoS patterns
                await this.checkRapidRequests(req, clientIP);
                this.checkLargePayloads(req, clientIP);
                this.checkSuspiciousUserAgent(req, clientIP);
                this.checkSuspiciousPatterns(req, clientIP);

                next();
            } catch (error) {
                if (error.message.includes('DoS')) {
                    return res.status(429).json({
                        error: 'Request blocked',
                        reason: 'Potential DoS attack detected'
                    });
                }
                next(error);
            }
        };
    }

    // Connection limiting middleware
    createConnectionLimit() {
        const activeConnections = new Map();

        return (req, res, next) => {
            const clientIP = this.getClientIP(req);
            const currentConnections = activeConnections.get(clientIP) || 0;
            
            // Limit concurrent connections per IP
            const maxConnections = req.user ? 20 : 10;
            
            if (currentConnections >= maxConnections) {
                logger.security('Connection limit exceeded', {
                    ip: clientIP,
                    currentConnections,
                    maxConnections,
                    userId: req.user?.id
                });
                
                return res.status(429).json({
                    error: 'Too many concurrent connections'
                });
            }

            // Track connection
            activeConnections.set(clientIP, currentConnections + 1);

            // Clean up on response finish
            res.on('finish', () => {
                const connections = activeConnections.get(clientIP) || 0;
                if (connections <= 1) {
                    activeConnections.delete(clientIP);
                } else {
                    activeConnections.set(clientIP, connections - 1);
                }
            });

            next();
        };
    }

    // Bandwidth throttling for large responses
    createBandwidthLimit() {
        return (req, res, next) => {
            const originalSend = res.send;
            const startTime = Date.now();
            
            res.send = function(data) {
                const responseSize = Buffer.byteLength(data);
                const elapsed = Date.now() - startTime;
                
                // Calculate bandwidth (bytes per second)
                const bandwidth = responseSize / (elapsed / 1000);
                const maxBandwidth = 10 * 1024 * 1024; // 10MB/s per connection
                
                if (bandwidth > maxBandwidth && responseSize > 1024 * 1024) {
                    // Introduce artificial delay for large responses
                    const delay = (responseSize / maxBandwidth * 1000) - elapsed;
                    if (delay > 0) {
                        setTimeout(() => originalSend.call(this, data), delay);
                        return;
                    }
                }
                
                originalSend.call(this, data);
            };
            
            next();
        };
    }

    async checkRapidRequests(req, clientIP) {
        const key = `rapid_${clientIP}`;
        let requestCount = 1;
        
        if (this.redisClient) {
            try {
                const current = await this.redisClient.get(key);
                requestCount = current ? parseInt(current) + 1 : 1;
                
                await this.redisClient.setEx(key, 60, requestCount.toString());
            } catch (error) {
                // Fallback to memory tracking
                this.trackInMemory(clientIP, 'rapidRequests');
            }
        } else {
            this.trackInMemory(clientIP, 'rapidRequests');
            requestCount = this.getMemoryCount(clientIP, 'rapidRequests');
        }
        
        if (requestCount > this.dosPatterns.rapidRequests.threshold) {
            this.markSuspicious(clientIP, 'rapid_requests');
            throw new Error('DoS: Rapid requests detected');
        }
    }

    checkLargePayloads(req, clientIP) {
        const contentLength = parseInt(req.get('Content-Length') || '0');
        
        if (contentLength > this.dosPatterns.largePayloads.threshold) {
            logger.security('Large payload detected', {
                ip: clientIP,
                contentLength,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            
            this.markSuspicious(clientIP, 'large_payload');
            throw new Error('DoS: Large payload detected');
        }
    }

    checkSuspiciousUserAgent(req, clientIP) {
        const userAgent = req.get('User-Agent') || '';
        
        for (const suspiciousAgent of this.dosPatterns.suspiciousUserAgents) {
            if (userAgent.toLowerCase().includes(suspiciousAgent)) {
                logger.security('Suspicious User-Agent detected', {
                    ip: clientIP,
                    userAgent,
                    path: req.path
                });
                
                this.markSuspicious(clientIP, 'suspicious_user_agent');
                break;
            }
        }
    }

    checkSuspiciousPatterns(req, clientIP) {
        const suspiciousPatterns = [
            // SQL injection patterns
            /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDROP\b|\bDELETE\b)/gi,
            // XSS patterns
            /<script[^>]*>.*?<\/script>/gi,
            // Path traversal
            /\.\.\//g,
            // Command injection
            /;\s*(rm|ls|cat|wget|curl)/gi
        ];

        const queryString = JSON.stringify({
            query: req.query,
            body: req.body,
            params: req.params
        });

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(queryString)) {
                logger.security('Suspicious pattern detected', {
                    ip: clientIP,
                    pattern: pattern.toString(),
                    path: req.path,
                    input: queryString.substring(0, 200)
                });
                
                this.markSuspicious(clientIP, 'suspicious_pattern');
                throw new Error('DoS: Suspicious pattern detected');
            }
        }
    }

    markSuspicious(clientIP, reason) {
        const suspiciousData = this.suspiciousIPs.get(clientIP) || {
            score: 0,
            incidents: [],
            firstSeen: Date.now()
        };
        
        suspiciousData.score += this.getSeverityScore(reason);
        suspiciousData.incidents.push({
            reason,
            timestamp: Date.now()
        });
        
        this.suspiciousIPs.set(clientIP, suspiciousData);
        
        // Block IP if score is too high
        if (suspiciousData.score >= 100) {
            this.blockIP(clientIP, 'High suspicion score');
        }
    }

    blockIP(clientIP, reason) {
        this.blockedIPs.add(clientIP);
        
        logger.security('IP blocked', {
            ip: clientIP,
            reason,
            score: this.suspiciousIPs.get(clientIP)?.score
        });
        
        // Automatically unblock after 24 hours
        setTimeout(() => {
            this.unblockIP(clientIP);
        }, 24 * 60 * 60 * 1000);
    }

    unblockIP(clientIP) {
        this.blockedIPs.delete(clientIP);
        this.suspiciousIPs.delete(clientIP);
        
        logger.info('IP unblocked', { ip: clientIP });
    }

    getSeverityScore(reason) {
        const scores = {
            'rapid_requests': 30,
            'large_payload': 25,
            'suspicious_user_agent': 15,
            'suspicious_pattern': 50
        };
        return scores[reason] || 10;
    }

    trackInMemory(clientIP, type) {
        // Simple in-memory tracking as Redis fallback
        const key = `${type}_${clientIP}`;
        const now = Date.now();
        
        if (!this.memoryStore) {
            this.memoryStore = new Map();
        }
        
        const existing = this.memoryStore.get(key) || [];
        const windowStart = now - this.dosPatterns.rapidRequests.window;
        
        // Remove old entries
        const recent = existing.filter(timestamp => timestamp > windowStart);
        recent.push(now);
        
        this.memoryStore.set(key, recent);
        
        return recent.length;
    }

    getMemoryCount(clientIP, type) {
        const key = `${type}_${clientIP}`;
        return this.memoryStore?.get(key)?.length || 0;
    }

    generateRateLimitKey(req) {
        const clientIP = this.getClientIP(req);
        
        // Use user ID if available for more accurate rate limiting
        if (req.user) {
            return `user_${req.user.id}`;
        }
        
        // Use IP with additional fingerprinting
        const userAgent = req.get('User-Agent') || '';
        const fingerprint = require('crypto')
            .createHash('md5')
            .update(clientIP + userAgent)
            .digest('hex')
            .substring(0, 8);
            
        return `ip_${clientIP}_${fingerprint}`;
    }

    getClientIP(req) {
        return req.ip || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               'unknown';
    }

    shouldSkipRateLimit(req) {
        // Skip rate limiting for health checks and metrics
        const skipPaths = [
            '/api/health',
            '/api/metrics',
            '/api/ping'
        ];
        
        // Skip for admin users in development
        if (process.env.NODE_ENV === 'development' && req.user?.isAdmin) {
            return true;
        }
        
        return skipPaths.some(path => req.path.startsWith(path));
    }

    onRateLimitReached(req) {
        const clientIP = this.getClientIP(req);
        
        logger.security('Rate limit exceeded', {
            ip: clientIP,
            path: req.path,
            method: req.method,
            userId: req.user?.id,
            userAgent: req.get('User-Agent')
        });
        
        // Increase suspicion score for repeated rate limit violations
        this.markSuspicious(clientIP, 'rate_limit_exceeded');
    }

    // Get current status of rate limiting
    getStatus() {
        return {
            redisConnected: !!this.redisClient,
            suspiciousIPs: this.suspiciousIPs.size,
            blockedIPs: this.blockedIPs.size,
            memoryStoreSize: this.memoryStore?.size || 0
        };
    }

    // Admin function to manually block/unblock IPs
    adminBlockIP(ip, reason = 'Manual block') {
        this.blockIP(ip, reason);
        return { success: true, message: `IP ${ip} blocked` };
    }

    adminUnblockIP(ip) {
        this.unblockIP(ip);
        return { success: true, message: `IP ${ip} unblocked` };
    }

    // Get list of suspicious IPs for admin dashboard
    getSuspiciousIPs() {
        const result = [];
        for (const [ip, data] of this.suspiciousIPs.entries()) {
            result.push({
                ip,
                score: data.score,
                incidentCount: data.incidents.length,
                firstSeen: new Date(data.firstSeen),
                recentIncidents: data.incidents.slice(-5)
            });
        }
        return result.sort((a, b) => b.score - a.score);
    }

    // Create custom rate limiter with specific options
    createCustomLimiter(options = {}) {
        const store = this.redisClient ? 
            new RedisStore({
                sendCommand: (...args) => this.redisClient.sendCommand(args),
            }) : undefined;

        const defaultOptions = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100,
            store,
            keyGenerator: this.generateRateLimitKey.bind(this),
            skip: this.shouldSkipRateLimit.bind(this),
            standardHeaders: true,
            legacyHeaders: false,
        };

        return rateLimit({
            ...defaultOptions,
            ...options
        });
    }
}

const rateLimiter = new AdvancedRateLimiter();

// Export different rate limiting strategies
module.exports = rateLimiter.createGeneralRateLimit();
module.exports.strict = rateLimiter.createStrictRateLimit();
module.exports.slowDown = rateLimiter.createSlowDown();
module.exports.dosProtection = rateLimiter.dosProtection();
module.exports.connectionLimit = rateLimiter.createConnectionLimit();
module.exports.bandwidthLimit = rateLimiter.createBandwidthLimit();
module.exports.createCustomLimiter = rateLimiter.createCustomLimiter.bind(rateLimiter);
module.exports.rateLimiter = rateLimiter;
