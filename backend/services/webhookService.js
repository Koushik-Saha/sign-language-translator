const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('./logger');
const { EventEmitter } = require('events');

// Webhook Schema
const WebhookSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    url: { type: String, required: true },
    events: [{ type: String, required: true }],
    secret: { type: String },
    active: { type: Boolean, default: true },
    retryPolicy: {
        maxRetries: { type: Number, default: 3 },
        backoffMultiplier: { type: Number, default: 2 },
        initialDelay: { type: Number, default: 1000 }
    },
    headers: { type: Map, of: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastTriggered: { type: Date },
    stats: {
        totalTriggers: { type: Number, default: 0 },
        successfulDeliveries: { type: Number, default: 0 },
        failedDeliveries: { type: Number, default: 0 },
        averageResponseTime: { type: Number, default: 0 }
    }
});

const Webhook = mongoose.model('Webhook', WebhookSchema);

// Webhook Event Log Schema
const WebhookEventLogSchema = new mongoose.Schema({
    webhookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Webhook', required: true },
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    attempts: [{
        timestamp: { type: Date, default: Date.now },
        statusCode: { type: Number },
        responseTime: { type: Number },
        error: { type: String },
        success: { type: Boolean }
    }],
    finalStatus: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const WebhookEventLog = mongoose.model('WebhookEventLog', WebhookEventLogSchema);

class WebhookService extends EventEmitter {
    constructor() {
        super();
        this.deliveryQueue = [];
        this.isProcessing = false;
        this.supportedEvents = [
            'translation.completed',
            'translation.failed',
            'user.registered',
            'user.login',
            'session.started',
            'session.ended',
            'error.occurred',
            'performance.threshold.exceeded',
            'speech.transcribed',
            'learning.progress.updated',
            'communication.message.received',
            'room.joined',
            'room.left'
        ];
        
        // Start processing queue
        this.startQueueProcessor();
    }

    async registerWebhook(userId, webhookData) {
        try {
            const { url, events, secret, headers, retryPolicy, metadata } = webhookData;
            
            // Validate URL
            if (!this.isValidURL(url)) {
                throw new Error('Invalid webhook URL');
            }
            
            // Validate events
            const invalidEvents = events.filter(event => !this.supportedEvents.includes(event));
            if (invalidEvents.length > 0) {
                throw new Error(`Unsupported events: ${invalidEvents.join(', ')}`);
            }
            
            // Generate secret if not provided
            const webhookSecret = secret || this.generateSecret();
            
            // Create webhook
            const webhook = new Webhook({
                userId,
                url,
                events,
                secret: webhookSecret,
                headers: new Map(Object.entries(headers || {})),
                retryPolicy: {
                    ...{
                        maxRetries: 3,
                        backoffMultiplier: 2,
                        initialDelay: 1000
                    },
                    ...retryPolicy
                },
                metadata
            });
            
            await webhook.save();
            
            logger.info('Webhook registered', {
                userId,
                webhookId: webhook._id,
                url,
                events
            });
            
            // Test webhook with ping event
            await this.triggerEvent('webhook.registered', {
                webhookId: webhook._id,
                message: 'Webhook successfully registered',
                timestamp: new Date().toISOString()
            }, userId);
            
            return {
                webhookId: webhook._id,
                url,
                events,
                secret: webhookSecret,
                active: true
            };
            
        } catch (error) {
            logger.error('Failed to register webhook', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async updateWebhook(webhookId, userId, updateData) {
        try {
            const webhook = await Webhook.findOne({ _id: webhookId, userId });
            
            if (!webhook) {
                throw new Error('Webhook not found');
            }
            
            const { url, events, active, headers, retryPolicy, metadata } = updateData;
            
            if (url && !this.isValidURL(url)) {
                throw new Error('Invalid webhook URL');
            }
            
            if (events) {
                const invalidEvents = events.filter(event => !this.supportedEvents.includes(event));
                if (invalidEvents.length > 0) {
                    throw new Error(`Unsupported events: ${invalidEvents.join(', ')}`);
                }
            }
            
            const updateFields = {};
            if (url) updateFields.url = url;
            if (events) updateFields.events = events;
            if (typeof active === 'boolean') updateFields.active = active;
            if (headers) updateFields.headers = new Map(Object.entries(headers));
            if (retryPolicy) updateFields.retryPolicy = { ...webhook.retryPolicy, ...retryPolicy };
            if (metadata) updateFields.metadata = metadata;
            updateFields.updatedAt = new Date();
            
            const updatedWebhook = await Webhook.findByIdAndUpdate(
                webhookId,
                updateFields,
                { new: true }
            );
            
            logger.info('Webhook updated', {
                userId,
                webhookId,
                updateFields: Object.keys(updateFields)
            });
            
            return updatedWebhook;
            
        } catch (error) {
            logger.error('Failed to update webhook', {
                webhookId,
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async deleteWebhook(webhookId, userId) {
        try {
            const webhook = await Webhook.findOneAndDelete({ _id: webhookId, userId });
            
            if (!webhook) {
                throw new Error('Webhook not found');
            }
            
            // Delete associated event logs
            await WebhookEventLog.deleteMany({ webhookId });
            
            logger.info('Webhook deleted', {
                userId,
                webhookId
            });
            
            return { success: true };
            
        } catch (error) {
            logger.error('Failed to delete webhook', {
                webhookId,
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async getUserWebhooks(userId) {
        try {
            const webhooks = await Webhook.find({ userId }).sort({ createdAt: -1 });
            return webhooks;
        } catch (error) {
            logger.error('Failed to get user webhooks', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async triggerEvent(eventType, payload, userId = null) {
        try {
            let query = { 
                active: true, 
                events: eventType 
            };
            
            if (userId) {
                query.userId = userId;
            }
            
            const webhooks = await Webhook.find(query);
            
            if (webhooks.length === 0) {
                logger.debug('No webhooks registered for event', { eventType, userId });
                return;
            }
            
            logger.info('Triggering webhook event', {
                eventType,
                webhookCount: webhooks.length,
                userId
            });
            
            // Add to delivery queue
            for (const webhook of webhooks) {
                const eventLog = new WebhookEventLog({
                    webhookId: webhook._id,
                    eventType,
                    payload
                });
                
                await eventLog.save();
                
                this.deliveryQueue.push({
                    webhook,
                    eventLog: eventLog._id,
                    eventType,
                    payload,
                    attempt: 0
                });
            }
            
            this.processQueue();
            
        } catch (error) {
            logger.error('Failed to trigger webhook event', {
                eventType,
                error: error.message
            });
        }
    }

    async deliverWebhook(deliveryData) {
        const { webhook, eventLog: eventLogId, eventType, payload, attempt } = deliveryData;
        const startTime = Date.now();
        
        try {
            const eventLog = await WebhookEventLog.findById(eventLogId);
            
            // Prepare payload
            const webhookPayload = {
                event: eventType,
                data: payload,
                timestamp: new Date().toISOString(),
                webhook: {
                    id: webhook._id,
                    attempt: attempt + 1
                }
            };
            
            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'SignLanguageTranslator-Webhooks/1.0',
                'X-Webhook-Event': eventType,
                'X-Webhook-ID': webhook._id.toString(),
                'X-Webhook-Attempt': (attempt + 1).toString(),
                ...Object.fromEntries(webhook.headers || new Map())
            };
            
            // Add signature if secret is provided
            if (webhook.secret) {
                const signature = this.generateSignature(JSON.stringify(webhookPayload), webhook.secret);
                headers['X-Webhook-Signature'] = signature;
            }
            
            // Make HTTP request
            const response = await axios({
                method: 'POST',
                url: webhook.url,
                data: webhookPayload,
                headers,
                timeout: 30000, // 30 seconds
                validateStatus: (status) => status >= 200 && status < 300
            });
            
            const responseTime = Date.now() - startTime;
            
            // Log successful attempt
            eventLog.attempts.push({
                timestamp: new Date(),
                statusCode: response.status,
                responseTime,
                success: true
            });
            eventLog.finalStatus = 'success';
            await eventLog.save();
            
            // Update webhook stats
            await Webhook.findByIdAndUpdate(webhook._id, {
                $inc: {
                    'stats.totalTriggers': 1,
                    'stats.successfulDeliveries': 1
                },
                $set: {
                    lastTriggered: new Date(),
                    'stats.averageResponseTime': this.updateAverageResponseTime(
                        webhook.stats.averageResponseTime,
                        webhook.stats.successfulDeliveries,
                        responseTime
                    )
                }
            });
            
            logger.info('Webhook delivered successfully', {
                webhookId: webhook._id,
                eventType,
                statusCode: response.status,
                responseTime
            });
            
            return { success: true, statusCode: response.status, responseTime };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            const statusCode = error.response?.status || 0;
            
            // Log failed attempt
            const eventLog = await WebhookEventLog.findById(eventLogId);
            eventLog.attempts.push({
                timestamp: new Date(),
                statusCode,
                responseTime,
                error: error.message,
                success: false
            });
            
            const shouldRetry = attempt < webhook.retryPolicy.maxRetries;
            eventLog.finalStatus = shouldRetry ? 'pending' : 'failed';
            await eventLog.save();
            
            // Update webhook stats
            await Webhook.findByIdAndUpdate(webhook._id, {
                $inc: {
                    'stats.totalTriggers': 1,
                    'stats.failedDeliveries': shouldRetry ? 0 : 1
                },
                $set: { lastTriggered: new Date() }
            });
            
            if (shouldRetry) {
                // Schedule retry
                const delay = webhook.retryPolicy.initialDelay * 
                    Math.pow(webhook.retryPolicy.backoffMultiplier, attempt);
                
                setTimeout(() => {
                    this.deliveryQueue.push({
                        ...deliveryData,
                        attempt: attempt + 1
                    });
                    this.processQueue();
                }, delay);
                
                logger.warn('Webhook delivery failed, will retry', {
                    webhookId: webhook._id,
                    eventType,
                    attempt: attempt + 1,
                    maxRetries: webhook.retryPolicy.maxRetries,
                    retryDelay: delay,
                    error: error.message
                });
            } else {
                logger.error('Webhook delivery failed permanently', {
                    webhookId: webhook._id,
                    eventType,
                    attempts: attempt + 1,
                    error: error.message
                });
            }
            
            return { success: false, error: error.message, statusCode };
        }
    }

    startQueueProcessor() {
        setInterval(() => {
            this.processQueue();
        }, 1000); // Process queue every second
    }

    async processQueue() {
        if (this.isProcessing || this.deliveryQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // Process up to 10 webhooks at a time
            const batch = this.deliveryQueue.splice(0, 10);
            
            await Promise.allSettled(
                batch.map(deliveryData => this.deliverWebhook(deliveryData))
            );
        } catch (error) {
            logger.error('Error processing webhook queue', { error: error.message });
        } finally {
            this.isProcessing = false;
        }
    }

    generateSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    generateSignature(payload, secret) {
        return 'sha256=' + crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }

    verifySignature(payload, signature, secret) {
        const expectedSignature = this.generateSignature(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    isValidURL(url) {
        try {
            const urlObject = new URL(url);
            return ['http:', 'https:'].includes(urlObject.protocol);
        } catch (error) {
            return false;
        }
    }

    updateAverageResponseTime(currentAverage, count, newValue) {
        return ((currentAverage * count) + newValue) / (count + 1);
    }

    async getWebhookLogs(webhookId, userId, options = {}) {
        try {
            const webhook = await Webhook.findOne({ _id: webhookId, userId });
            if (!webhook) {
                throw new Error('Webhook not found');
            }
            
            const { limit = 50, skip = 0, eventType, status } = options;
            
            let query = { webhookId };
            if (eventType) query.eventType = eventType;
            if (status) query.finalStatus = status;
            
            const logs = await WebhookEventLog.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .lean();
            
            return logs;
            
        } catch (error) {
            logger.error('Failed to get webhook logs', {
                webhookId,
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async getWebhookStats(userId) {
        try {
            const webhooks = await Webhook.find({ userId });
            
            const totalWebhooks = webhooks.length;
            const activeWebhooks = webhooks.filter(w => w.active).length;
            const totalTriggers = webhooks.reduce((sum, w) => sum + w.stats.totalTriggers, 0);
            const totalDeliveries = webhooks.reduce((sum, w) => sum + w.stats.successfulDeliveries, 0);
            const totalFailures = webhooks.reduce((sum, w) => sum + w.stats.failedDeliveries, 0);
            const averageResponseTime = webhooks.reduce((sum, w) => sum + w.stats.averageResponseTime, 0) / webhooks.length || 0;
            
            return {
                totalWebhooks,
                activeWebhooks,
                totalTriggers,
                totalDeliveries,
                totalFailures,
                averageResponseTime,
                successRate: totalTriggers > 0 ? (totalDeliveries / totalTriggers) * 100 : 0
            };
            
        } catch (error) {
            logger.error('Failed to get webhook stats', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    getSupportedEvents() {
        return this.supportedEvents;
    }
}

module.exports = {
    WebhookService: new WebhookService(),
    Webhook,
    WebhookEventLog
};