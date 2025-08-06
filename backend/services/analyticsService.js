const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    sessionId: { type: String, required: true, unique: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    duration: { type: Number },
    actions: [{
        type: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: mongoose.Schema.Types.Mixed }
    }],
    device: {
        userAgent: String,
        platform: String,
        language: String,
        screen: {
            width: Number,
            height: Number
        }
    },
    location: {
        country: String,
        city: String,
        timezone: String
    }
});

const FeatureUsageSchema = new mongoose.Schema({
    feature: { type: String, required: true },
    userId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    sessionId: { type: String, required: true },
    duration: { type: Number },
    success: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed }
});

const TranslationAnalyticsSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    sessionId: { type: String, required: true },
    type: { type: String, enum: ['text-to-sign', 'sign-to-text', 'sign-to-sign'], required: true },
    sourceLanguage: { type: String, default: 'en' },
    targetLanguage: { type: String, default: 'asl' },
    inputLength: { type: Number },
    outputLength: { type: Number },
    confidence: { type: Number, min: 0, max: 1 },
    latency: { type: Number },
    timestamp: { type: Date, default: Date.now },
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comments: String
    }
});

const UserSession = mongoose.model('UserSession', UserSessionSchema);
const FeatureUsage = mongoose.model('FeatureUsage', FeatureUsageSchema);
const TranslationAnalytics = mongoose.model('TranslationAnalytics', TranslationAnalyticsSchema);

class AnalyticsService {
    constructor() {
        this.activeSessions = new Map();
        this.userActions = new Map();
    }

    async startSession(userId, sessionId, deviceInfo, locationInfo) {
        const session = new UserSession({
            userId,
            sessionId,
            device: deviceInfo,
            location: locationInfo
        });
        
        await session.save();
        this.activeSessions.set(sessionId, {
            userId,
            startTime: new Date(),
            actions: []
        });
        
        return session;
    }

    async endSession(sessionId) {
        const sessionData = this.activeSessions.get(sessionId);
        if (sessionData) {
            const endTime = new Date();
            const duration = endTime - sessionData.startTime;
            
            await UserSession.findOneAndUpdate(
                { sessionId },
                {
                    endTime,
                    duration,
                    actions: sessionData.actions
                }
            );
            
            this.activeSessions.delete(sessionId);
        }
    }

    trackUserAction(sessionId, actionType, details = {}) {
        const sessionData = this.activeSessions.get(sessionId);
        if (sessionData) {
            const action = {
                type: actionType,
                timestamp: new Date(),
                details
            };
            
            sessionData.actions.push(action);
        }
    }

    async trackFeatureUsage(feature, userId, sessionId, duration, success = true, metadata = {}) {
        const usage = new FeatureUsage({
            feature,
            userId,
            sessionId,
            duration,
            success,
            metadata
        });
        
        await usage.save();
    }

    async trackTranslation(data) {
        const analytics = new TranslationAnalytics(data);
        await analytics.save();
    }

    async getUserAnalytics(userId, startDate, endDate) {
        const sessions = await UserSession.find({
            userId,
            startTime: { $gte: startDate, $lte: endDate }
        });

        const featureUsage = await FeatureUsage.find({
            userId,
            timestamp: { $gte: startDate, $lte: endDate }
        });

        const translations = await TranslationAnalytics.find({
            userId,
            timestamp: { $gte: startDate, $lte: endDate }
        });

        return {
            sessions,
            featureUsage,
            translations,
            summary: {
                totalSessions: sessions.length,
                totalDuration: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
                mostUsedFeatures: this.getMostUsedFeatures(featureUsage),
                translationStats: this.getTranslationStats(translations)
            }
        };
    }

    async getSystemAnalytics(startDate, endDate) {
        const totalSessions = await UserSession.countDocuments({
            startTime: { $gte: startDate, $lte: endDate }
        });

        const uniqueUsers = await UserSession.distinct('userId', {
            startTime: { $gte: startDate, $lte: endDate }
        });

        const featureStats = await FeatureUsage.aggregate([
            { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: '$feature',
                    count: { $sum: 1 },
                    avgDuration: { $avg: '$duration' },
                    successRate: { $avg: { $cond: ['$success', 1, 0] } }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const translationStats = await TranslationAnalytics.aggregate([
            { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    avgLatency: { $avg: '$latency' },
                    avgConfidence: { $avg: '$confidence' }
                }
            }
        ]);

        return {
            totalSessions,
            uniqueUsers: uniqueUsers.length,
            featureStats,
            translationStats
        };
    }

    getMostUsedFeatures(featureUsage) {
        const featureCounts = {};
        featureUsage.forEach(usage => {
            featureCounts[usage.feature] = (featureCounts[usage.feature] || 0) + 1;
        });
        
        return Object.entries(featureCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
    }

    getTranslationStats(translations) {
        return {
            total: translations.length,
            avgLatency: translations.reduce((sum, t) => sum + t.latency, 0) / translations.length,
            avgConfidence: translations.reduce((sum, t) => sum + t.confidence, 0) / translations.length,
            byType: translations.reduce((acc, t) => {
                acc[t.type] = (acc[t.type] || 0) + 1;
                return acc;
            }, {})
        };
    }

    getActiveUserCount() {
        return this.activeSessions.size;
    }
}

module.exports = {
    AnalyticsService: new AnalyticsService(),
    UserSession,
    FeatureUsage,
    TranslationAnalytics
};