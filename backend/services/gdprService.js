const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { User } = require('../models/User');

// GDPR Consent Schema
const ConsentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    consentType: { 
        type: String, 
        enum: ['necessary', 'functional', 'analytics', 'marketing'], 
        required: true 
    },
    granted: { type: Boolean, required: true },
    timestamp: { type: Date, default: Date.now },
    version: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    withdrawnAt: { type: Date },
    withdrawnReason: { type: String }
});

// Data Processing Activity Schema
const DataProcessingActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    activity: { type: String, required: true },
    purpose: { type: String, required: true },
    legalBasis: { 
        type: String, 
        enum: ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'],
        required: true 
    },
    dataCategories: [{ type: String }],
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed }
});

// Data Retention Policy Schema
const DataRetentionPolicySchema = new mongoose.Schema({
    dataType: { type: String, required: true, unique: true },
    retentionPeriodDays: { type: Number, required: true },
    description: { type: String, required: true },
    legalBasis: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Data Export Request Schema
const DataExportRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestId: { type: String, unique: true, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'failed'], 
        default: 'pending' 
    },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    downloadUrl: { type: String },
    expiresAt: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String }
});

// Data Deletion Request Schema
const DataDeletionRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestId: { type: String, unique: true, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'failed', 'partial'], 
        default: 'pending' 
    },
    deletionScope: {
        type: String,
        enum: ['full_account', 'specific_data', 'anonymization'],
        required: true
    },
    specificDataTypes: [{ type: String }],
    retainedData: [{ type: String }],
    retentionReason: { type: String },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String }
});

const Consent = mongoose.model('Consent', ConsentSchema);
const DataProcessingActivity = mongoose.model('DataProcessingActivity', DataProcessingActivitySchema);
const DataRetentionPolicy = mongoose.model('DataRetentionPolicy', DataRetentionPolicySchema);
const DataExportRequest = mongoose.model('DataExportRequest', DataExportRequestSchema);
const DataDeletionRequest = mongoose.model('DataDeletionRequest', DataDeletionRequestSchema);

class GDPRService {
    constructor() {
        this.consentVersions = {
            current: '2.1',
            versions: {
                '1.0': { deprecated: true, validUntil: new Date('2024-01-01') },
                '2.0': { deprecated: false, validUntil: new Date('2025-01-01') },
                '2.1': { deprecated: false, validUntil: null }
            }
        };

        this.initializeDefaultPolicies();
    }

    async initializeDefaultPolicies() {
        try {
            const defaultPolicies = [
                {
                    dataType: 'user_account',
                    retentionPeriodDays: 2555, // 7 years
                    description: 'User account information including profile data',
                    legalBasis: 'contract'
                },
                {
                    dataType: 'translation_history',
                    retentionPeriodDays: 1095, // 3 years
                    description: 'User translation history and preferences',
                    legalBasis: 'legitimate_interests'
                },
                {
                    dataType: 'analytics_data',
                    retentionPeriodDays: 365, // 1 year
                    description: 'Usage analytics and performance metrics',
                    legalBasis: 'consent'
                },
                {
                    dataType: 'session_logs',
                    retentionPeriodDays: 90, // 3 months
                    description: 'Session logs and activity tracking',
                    legalBasis: 'legitimate_interests'
                },
                {
                    dataType: 'error_logs',
                    retentionPeriodDays: 180, // 6 months
                    description: 'Error logs and debugging information',
                    legalBasis: 'legitimate_interests'
                },
                {
                    dataType: 'communication_logs',
                    retentionPeriodDays: 1095, // 3 years
                    description: 'Communication history and support interactions',
                    legalBasis: 'contract'
                }
            ];

            for (const policy of defaultPolicies) {
                await DataRetentionPolicy.findOneAndUpdate(
                    { dataType: policy.dataType },
                    { ...policy, updatedAt: new Date() },
                    { upsert: true, new: true }
                );
            }

            logger.info('GDPR default policies initialized');
        } catch (error) {
            logger.error('Failed to initialize GDPR policies', { error: error.message });
        }
    }

    // Consent Management
    async recordConsent(userId, consentData, metadata = {}) {
        try {
            const {
                consentType,
                granted,
                ipAddress,
                userAgent
            } = consentData;

            // Withdraw previous consent of the same type
            await Consent.updateMany(
                { userId, consentType, withdrawnAt: null },
                { withdrawnAt: new Date(), withdrawnReason: 'Updated consent' }
            );

            // Record new consent
            const consent = new Consent({
                userId,
                consentType,
                granted,
                version: this.consentVersions.current,
                ipAddress,
                userAgent,
                timestamp: new Date()
            });

            await consent.save();

            // Log the activity
            await this.logDataProcessingActivity(userId, 'consent_recorded', 'consent', {
                consentType,
                granted,
                version: this.consentVersions.current
            });

            logger.info('Consent recorded', {
                userId,
                consentType,
                granted,
                version: this.consentVersions.current
            });

            return consent;

        } catch (error) {
            logger.error('Failed to record consent', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async getValidConsents(userId) {
        try {
            const consents = await Consent.find({
                userId,
                withdrawnAt: null
            }).sort({ timestamp: -1 });

            // Group by type and get the latest consent for each type
            const validConsents = {};
            for (const consent of consents) {
                if (!validConsents[consent.consentType]) {
                    validConsents[consent.consentType] = consent;
                }
            }

            return validConsents;
        } catch (error) {
            logger.error('Failed to get valid consents', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async withdrawConsent(userId, consentType, reason = 'User requested') {
        try {
            const result = await Consent.updateMany(
                { userId, consentType, withdrawnAt: null },
                { 
                    withdrawnAt: new Date(),
                    withdrawnReason: reason
                }
            );

            await this.logDataProcessingActivity(userId, 'consent_withdrawn', 'consent', {
                consentType,
                reason
            });

            logger.info('Consent withdrawn', {
                userId,
                consentType,
                reason,
                updatedCount: result.modifiedCount
            });

            return result;

        } catch (error) {
            logger.error('Failed to withdraw consent', {
                userId,
                consentType,
                error: error.message
            });
            throw error;
        }
    }

    // Data Processing Activity Logging
    async logDataProcessingActivity(userId, activity, legalBasis, metadata = {}) {
        try {
            const processingActivity = new DataProcessingActivity({
                userId,
                activity,
                purpose: this.getPurposeForActivity(activity),
                legalBasis,
                dataCategories: this.getDataCategoriesForActivity(activity),
                metadata
            });

            await processingActivity.save();

            return processingActivity;

        } catch (error) {
            logger.error('Failed to log data processing activity', {
                userId,
                activity,
                error: error.message
            });
            // Don't throw - logging failures shouldn't break the main flow
        }
    }

    // Data Export (Right to Data Portability)
    async requestDataExport(userId, requestMetadata = {}) {
        try {
            const requestId = crypto.randomUUID();

            const exportRequest = new DataExportRequest({
                userId,
                requestId,
                status: 'pending',
                ipAddress: requestMetadata.ipAddress,
                userAgent: requestMetadata.userAgent
            });

            await exportRequest.save();

            // Process export asynchronously
            this.processDataExport(requestId).catch(error => {
                logger.error('Data export processing failed', {
                    requestId,
                    error: error.message
                });
            });

            await this.logDataProcessingActivity(userId, 'data_export_requested', 'consent', {
                requestId
            });

            logger.info('Data export requested', {
                userId,
                requestId
            });

            return {
                requestId,
                status: 'pending',
                estimatedCompletionTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            };

        } catch (error) {
            logger.error('Failed to request data export', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async processDataExport(requestId) {
        try {
            const exportRequest = await DataExportRequest.findOne({ requestId });
            if (!exportRequest) {
                throw new Error('Export request not found');
            }

            exportRequest.status = 'processing';
            await exportRequest.save();

            const userId = exportRequest.userId;
            const userData = await this.collectUserData(userId);
            
            // Create export file
            const exportPath = await this.createExportFile(requestId, userData);
            
            // Generate secure download URL (valid for 7 days)
            const downloadUrl = await this.generateSecureDownloadUrl(exportPath);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            exportRequest.status = 'completed';
            exportRequest.completedAt = new Date();
            exportRequest.downloadUrl = downloadUrl;
            exportRequest.expiresAt = expiresAt;
            await exportRequest.save();

            // Schedule file cleanup
            this.scheduleFileCleanup(exportPath, expiresAt);

            await this.logDataProcessingActivity(userId, 'data_export_completed', 'consent', {
                requestId,
                expiresAt
            });

        } catch (error) {
            const exportRequest = await DataExportRequest.findOne({ requestId });
            if (exportRequest) {
                exportRequest.status = 'failed';
                await exportRequest.save();
            }

            logger.error('Data export processing failed', {
                requestId,
                error: error.message
            });
            throw error;
        }
    }

    async collectUserData(userId) {
        try {
            const userData = {};

            // Collect user account data
            const user = await User.findById(userId).lean();
            if (user) {
                userData.account = {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                    preferences: user.preferences
                };
            }

            // Collect consents
            userData.consents = await Consent.find({ userId }).lean();

            // Collect data processing activities
            userData.processingActivities = await DataProcessingActivity.find({ userId })
                .limit(1000)
                .sort({ timestamp: -1 })
                .lean();

            // Collect translation history (if consent given)
            const validConsents = await this.getValidConsents(userId);
            if (validConsents.functional?.granted) {
                // Add translation history collection here
                userData.translations = await this.getTranslationHistory(userId);
            }

            // Collect analytics data (if consent given)
            if (validConsents.analytics?.granted) {
                userData.analytics = await this.getAnalyticsData(userId);
            }

            return userData;

        } catch (error) {
            logger.error('Failed to collect user data', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    // Data Deletion (Right to be Forgotten)
    async requestDataDeletion(userId, deletionScope = 'full_account', specificDataTypes = [], requestMetadata = {}) {
        try {
            const requestId = crypto.randomUUID();

            const deletionRequest = new DataDeletionRequest({
                userId,
                requestId,
                status: 'pending',
                deletionScope,
                specificDataTypes,
                ipAddress: requestMetadata.ipAddress,
                userAgent: requestMetadata.userAgent
            });

            await deletionRequest.save();

            // Process deletion asynchronously
            this.processDataDeletion(requestId).catch(error => {
                logger.error('Data deletion processing failed', {
                    requestId,
                    error: error.message
                });
            });

            await this.logDataProcessingActivity(userId, 'data_deletion_requested', 'consent', {
                requestId,
                deletionScope,
                specificDataTypes
            });

            logger.info('Data deletion requested', {
                userId,
                requestId,
                deletionScope
            });

            return {
                requestId,
                status: 'pending',
                estimatedCompletionTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            };

        } catch (error) {
            logger.error('Failed to request data deletion', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async processDataDeletion(requestId) {
        try {
            const deletionRequest = await DataDeletionRequest.findOne({ requestId });
            if (!deletionRequest) {
                throw new Error('Deletion request not found');
            }

            deletionRequest.status = 'processing';
            await deletionRequest.save();

            const userId = deletionRequest.userId;
            const retainedData = [];
            const deletedData = [];

            if (deletionRequest.deletionScope === 'full_account') {
                // Full account deletion
                await this.performFullAccountDeletion(userId);
                deletedData.push('full_account');
            } else if (deletionRequest.deletionScope === 'specific_data') {
                // Delete specific data types
                for (const dataType of deletionRequest.specificDataTypes) {
                    const canDelete = await this.checkDeletionLegality(userId, dataType);
                    if (canDelete) {
                        await this.deleteSpecificDataType(userId, dataType);
                        deletedData.push(dataType);
                    } else {
                        retainedData.push(dataType);
                    }
                }
            } else if (deletionRequest.deletionScope === 'anonymization') {
                // Anonymize instead of delete
                await this.anonymizeUserData(userId);
                deletedData.push('anonymized_data');
            }

            deletionRequest.status = retainedData.length > 0 ? 'partial' : 'completed';
            deletionRequest.completedAt = new Date();
            deletionRequest.retainedData = retainedData;
            deletionRequest.retentionReason = retainedData.length > 0 ? 'Legal retention requirements' : null;
            await deletionRequest.save();

            await this.logDataProcessingActivity(userId, 'data_deletion_completed', 'consent', {
                requestId,
                deletedData,
                retainedData
            });

        } catch (error) {
            const deletionRequest = await DataDeletionRequest.findOne({ requestId });
            if (deletionRequest) {
                deletionRequest.status = 'failed';
                await deletionRequest.save();
            }

            logger.error('Data deletion processing failed', {
                requestId,
                error: error.message
            });
            throw error;
        }
    }

    // Data Retention Management
    async runDataRetentionCleanup() {
        try {
            logger.info('Starting data retention cleanup');

            const policies = await DataRetentionPolicy.find({});
            let totalDeleted = 0;

            for (const policy of policies) {
                const cutoffDate = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);
                const deleted = await this.cleanupDataByType(policy.dataType, cutoffDate);
                totalDeleted += deleted;

                logger.info('Data retention cleanup for type', {
                    dataType: policy.dataType,
                    cutoffDate,
                    deleted
                });
            }

            logger.info('Data retention cleanup completed', { totalDeleted });
            return { totalDeleted };

        } catch (error) {
            logger.error('Data retention cleanup failed', {
                error: error.message
            });
            throw error;
        }
    }

    async cleanupDataByType(dataType, cutoffDate) {
        let deleted = 0;

        switch (dataType) {
            case 'session_logs':
                // Delete old session logs
                const sessionResult = await mongoose.connection.db
                    .collection('sessions')
                    .deleteMany({ createdAt: { $lt: cutoffDate } });
                deleted = sessionResult.deletedCount;
                break;

            case 'error_logs':
                // Clean up old error logs
                const errorResult = await mongoose.connection.db
                    .collection('error_logs')
                    .deleteMany({ timestamp: { $lt: cutoffDate } });
                deleted = errorResult.deletedCount;
                break;

            case 'analytics_data':
                // Clean up old analytics data
                const analyticsResult = await mongoose.connection.db
                    .collection('analytics')
                    .deleteMany({ timestamp: { $lt: cutoffDate } });
                deleted = analyticsResult.deletedCount;
                break;

            case 'translation_history':
                // Clean up old translation history (only if user hasn't objected)
                const translationResult = await mongoose.connection.db
                    .collection('translations')
                    .deleteMany({ 
                        createdAt: { $lt: cutoffDate },
                        'metadata.retentionOptOut': { $ne: true }
                    });
                deleted = translationResult.deletedCount;
                break;

            default:
                logger.warn('Unknown data type for retention cleanup', { dataType });
        }

        return deleted;
    }

    // Privacy Settings Management
    async updatePrivacySettings(userId, settings) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            user.privacySettings = {
                ...user.privacySettings,
                ...settings,
                updatedAt: new Date()
            };

            await user.save();

            await this.logDataProcessingActivity(userId, 'privacy_settings_updated', 'consent', {
                settings
            });

            logger.info('Privacy settings updated', {
                userId,
                settings
            });

            return user.privacySettings;

        } catch (error) {
            logger.error('Failed to update privacy settings', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    // Utility Methods
    getPurposeForActivity(activity) {
        const purposes = {
            'user_registration': 'Account creation and management',
            'translation_request': 'Providing translation services',
            'data_export_requested': 'Compliance with data portability rights',
            'data_deletion_requested': 'Compliance with right to be forgotten',
            'consent_recorded': 'Consent management and compliance',
            'consent_withdrawn': 'Consent management and compliance',
            'privacy_settings_updated': 'Privacy preference management'
        };
        return purposes[activity] || 'Service provision';
    }

    getDataCategoriesForActivity(activity) {
        const categories = {
            'user_registration': ['identity', 'contact'],
            'translation_request': ['usage', 'content'],
            'data_export_requested': ['identity', 'usage', 'content'],
            'data_deletion_requested': ['identity'],
            'consent_recorded': ['consent'],
            'consent_withdrawn': ['consent'],
            'privacy_settings_updated': ['preferences']
        };
        return categories[activity] || ['usage'];
    }

    async generateSecureDownloadUrl(filePath) {
        // In production, this would generate a signed URL
        const token = crypto.randomBytes(32).toString('hex');
        return `/api/gdpr/download/${token}`;
    }

    async createExportFile(requestId, userData) {
        const exportsDir = path.join(__dirname, '../exports/gdpr');
        await fs.mkdir(exportsDir, { recursive: true });
        
        const filePath = path.join(exportsDir, `export_${requestId}.json`);
        await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
        
        return filePath;
    }

    scheduleFileCleanup(filePath, expiresAt) {
        const delay = expiresAt.getTime() - Date.now();
        setTimeout(async () => {
            try {
                await fs.unlink(filePath);
                logger.info('GDPR export file cleaned up', { filePath });
            } catch (error) {
                logger.warn('Failed to cleanup GDPR export file', {
                    filePath,
                    error: error.message
                });
            }
        }, delay);
    }

    async checkDeletionLegality(userId, dataType) {
        // Check if data can be legally deleted
        const policy = await DataRetentionPolicy.findOne({ dataType });
        if (!policy) return true;

        // Check if retention period is still active
        const retentionEnd = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);
        const userData = await this.getDataCreationDate(userId, dataType);
        
        return userData < retentionEnd;
    }

    async getDataCreationDate(userId, dataType) {
        // Get the creation date of specific data type
        // This would need to be implemented based on your data models
        return new Date(); // Placeholder
    }

    async getTranslationHistory(userId) {
        // Implement translation history collection
        return [];
    }

    async getAnalyticsData(userId) {
        // Implement analytics data collection
        return {};
    }

    async performFullAccountDeletion(userId) {
        // Implement full account deletion
        await User.findByIdAndDelete(userId);
        await Consent.deleteMany({ userId });
        await DataProcessingActivity.deleteMany({ userId });
        // Add other collections as needed
    }

    async deleteSpecificDataType(userId, dataType) {
        // Implement specific data type deletion
        logger.info('Deleting specific data type', { userId, dataType });
    }

    async anonymizeUserData(userId) {
        // Implement data anonymization
        await User.findByIdAndUpdate(userId, {
            username: `anonymous_${crypto.randomBytes(8).toString('hex')}`,
            email: `anonymous_${crypto.randomBytes(8).toString('hex')}@example.com`,
            anonymized: true,
            anonymizedAt: new Date()
        });
    }
}

module.exports = {
    GDPRService: new GDPRService(),
    Consent,
    DataProcessingActivity,
    DataRetentionPolicy,
    DataExportRequest,
    DataDeletionRequest
};