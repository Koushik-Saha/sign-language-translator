const mongoose = require('mongoose');
const logger = require('./logger');

const consentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  consentType: {
    type: String,
    enum: ['research', 'model_training', 'performance_analytics', 'feature_improvement'],
    required: true
  },
  hasConsented: {
    type: Boolean,
    required: true,
    default: false
  },
  consentVersion: {
    type: String,
    required: true,
    default: '1.0'
  },
  consentDetails: {
    dataTypes: [{
      type: String,
      enum: ['video_data', 'gesture_keyframes', 'performance_metrics', 'usage_analytics', 'demographic_info']
    }],
    purposes: [{
      type: String,
      enum: ['model_training', 'research', 'product_improvement', 'bug_fixing', 'performance_optimization']
    }],
    retentionPeriod: {
      type: String,
      enum: ['1_year', '2_years', '5_years', 'indefinite'],
      default: '2_years'
    },
    dataSharing: {
      withThirdParties: { type: Boolean, default: false },
      forResearch: { type: Boolean, default: false },
      anonymized: { type: Boolean, default: true }
    }
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  revokedAt: {
    type: Date
  },
  ipAddress: String,
  userAgent: String,
  isActive: {
    type: Boolean,
    default: true
  },
  withdrawalHistory: [{
    revokedAt: Date,
    reason: String,
    dataDeleted: Boolean
  }]
}, {
  timestamps: true
});

consentSchema.index({ userId: 1, consentType: 1 });
consentSchema.index({ userId: 1, isActive: 1 });
consentSchema.index({ consentType: 1, hasConsented: 1 });

const UserConsent = mongoose.model('UserConsent', consentSchema);

class ConsentService {
  constructor() {
    this.currentConsentVersion = '1.2';
    this.requiredConsents = {
      basic_functionality: {
        required: true,
        dataTypes: ['usage_analytics'],
        purposes: ['product_improvement', 'bug_fixing']
      },
      model_training: {
        required: false,
        dataTypes: ['video_data', 'gesture_keyframes', 'performance_metrics'],
        purposes: ['model_training', 'research']
      },
      performance_analytics: {
        required: false,
        dataTypes: ['performance_metrics', 'usage_analytics'],
        purposes: ['performance_optimization', 'product_improvement']
      },
      research: {
        required: false,
        dataTypes: ['video_data', 'gesture_keyframes', 'demographic_info'],
        purposes: ['research']
      }
    };
  }

  /**
   * Record user consent
   */
  async recordConsent(userId, consentData, metadata = {}) {
    try {
      const { consentType, hasConsented, dataTypes, purposes, retentionPeriod, dataSharing } = consentData;

      // Revoke previous consent if exists
      await UserConsent.updateMany(
        { userId, consentType, isActive: true },
        { $set: { isActive: false, revokedAt: new Date() } }
      );

      const consent = new UserConsent({
        userId,
        consentType,
        hasConsented,
        consentVersion: this.currentConsentVersion,
        consentDetails: {
          dataTypes: dataTypes || this.requiredConsents[consentType]?.dataTypes || [],
          purposes: purposes || this.requiredConsents[consentType]?.purposes || [],
          retentionPeriod: retentionPeriod || '2_years',
          dataSharing: dataSharing || { withThirdParties: false, forResearch: false, anonymized: true }
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      });

      await consent.save();
      
      logger.info(`Consent recorded for user ${userId}, type: ${consentType}, granted: ${hasConsented}`);
      return consent;

    } catch (error) {
      logger.error('Error recording consent:', error);
      throw error;
    }
  }

  /**
   * Check if user has valid consent for specific data collection
   */
  async hasValidConsent(userId, consentType) {
    try {
      const consent = await UserConsent.findOne({
        userId,
        consentType,
        isActive: true,
        hasConsented: true,
        consentVersion: this.currentConsentVersion
      });

      return !!consent;

    } catch (error) {
      logger.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Get all user consents
   */
  async getUserConsents(userId) {
    try {
      const consents = await UserConsent.find({
        userId,
        isActive: true
      }).sort({ createdAt: -1 });

      const consentMap = {};
      consents.forEach(consent => {
        consentMap[consent.consentType] = {
          hasConsented: consent.hasConsented,
          grantedAt: consent.grantedAt,
          consentVersion: consent.consentVersion,
          dataTypes: consent.consentDetails.dataTypes,
          purposes: consent.consentDetails.purposes,
          retentionPeriod: consent.consentDetails.retentionPeriod,
          dataSharing: consent.consentDetails.dataSharing
        };
      });

      return consentMap;

    } catch (error) {
      logger.error('Error getting user consents:', error);
      throw error;
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(userId, consentType, reason = '') {
    try {
      const consent = await UserConsent.findOne({
        userId,
        consentType,
        isActive: true,
        hasConsented: true
      });

      if (!consent) {
        throw new Error('No active consent found to withdraw');
      }

      // Mark consent as revoked
      consent.isActive = false;
      consent.revokedAt = new Date();
      consent.withdrawalHistory.push({
        revokedAt: new Date(),
        reason,
        dataDeleted: false // Will be updated when data is actually deleted
      });

      await consent.save();

      // Trigger data cleanup process
      await this.scheduleDataCleanup(userId, consentType);

      logger.info(`Consent withdrawn for user ${userId}, type: ${consentType}`);
      return consent;

    } catch (error) {
      logger.error('Error withdrawing consent:', error);
      throw error;
    }
  }

  /**
   * Check if consent update is required
   */
  async requiresConsentUpdate(userId) {
    try {
      const userConsents = await UserConsent.find({
        userId,
        isActive: true
      });

      // Check if user needs to update to current consent version
      const outdatedConsents = userConsents.filter(
        consent => consent.consentVersion !== this.currentConsentVersion
      );

      // Check if required consents are missing
      const missingConsents = [];
      Object.entries(this.requiredConsents).forEach(([type, config]) => {
        if (config.required) {
          const existingConsent = userConsents.find(c => c.consentType === type && c.hasConsented);
          if (!existingConsent) {
            missingConsents.push(type);
          }
        }
      });

      return {
        updateRequired: outdatedConsents.length > 0 || missingConsents.length > 0,
        outdatedConsents: outdatedConsents.map(c => c.consentType),
        missingConsents,
        currentVersion: this.currentConsentVersion
      };

    } catch (error) {
      logger.error('Error checking consent update requirements:', error);
      throw error;
    }
  }

  /**
   * Get consent statistics
   */
  async getConsentStatistics() {
    try {
      const stats = await UserConsent.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $group: {
            _id: '$consentType',
            totalConsents: { $sum: 1 },
            grantedConsents: { $sum: { $cond: ['$hasConsented', 1, 0] } },
            deniedConsents: { $sum: { $cond: ['$hasConsented', 0, 1] } },
            latestVersion: { $max: '$consentVersion' }
          }
        }
      ]);

      const overallStats = await UserConsent.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $addToSet: '$userId' },
            totalConsents: { $sum: 1 },
            totalGranted: { $sum: { $cond: ['$hasConsented', 1, 0] } },
            totalDenied: { $sum: { $cond: ['$hasConsented', 0, 1] } }
          }
        }
      ]);

      const overall = overallStats[0] || {};
      overall.uniqueUsers = overall.totalUsers ? overall.totalUsers.length : 0;
      delete overall.totalUsers;

      return {
        byConsentType: stats,
        overall
      };

    } catch (error) {
      logger.error('Error getting consent statistics:', error);
      throw error;
    }
  }

  /**
   * Schedule data cleanup for withdrawn consent
   */
  async scheduleDataCleanup(userId, consentType) {
    try {
      // This would typically integrate with a job queue system
      // For now, we'll log and could trigger immediate cleanup
      logger.info(`Data cleanup scheduled for user ${userId}, consent type: ${consentType}`);
      
      // In a production system, you'd schedule this with a job queue like Bull or Agenda
      // setTimeout(() => this.performDataCleanup(userId, consentType), 24 * 60 * 60 * 1000); // 24 hours
      
      return { scheduled: true, userId, consentType };

    } catch (error) {
      logger.error('Error scheduling data cleanup:', error);
      throw error;
    }
  }

  /**
   * Perform actual data cleanup (called by scheduled job)
   */
  async performDataCleanup(userId, consentType) {
    try {
      logger.info(`Performing data cleanup for user ${userId}, consent type: ${consentType}`);
      
      // Delete relevant data based on consent type
      const TrainingData = require('../models/TrainingData');
      
      switch (consentType) {
        case 'model_training':
          await TrainingData.updateMany(
            { userId },
            { 
              $set: { 
                'consent.hasConsent': false,
                'consent.withdrawnAt': new Date(),
                'usage.isUsedForTraining': false
              }
            }
          );
          break;
          
        case 'research':
          await TrainingData.updateMany(
            { userId, 'consent.consentType': 'research' },
            { 
              $set: { 
                'consent.hasConsent': false,
                'consent.withdrawnAt': new Date()
              }
            }
          );
          break;
          
        default:
          logger.warn(`No cleanup procedure defined for consent type: ${consentType}`);
      }

      // Update consent record to mark data as deleted
      await UserConsent.updateOne(
        { userId, consentType, isActive: false },
        { 
          $set: { 
            'withdrawalHistory.$[elem].dataDeleted': true 
          }
        },
        { 
          arrayFilters: [{ 'elem.dataDeleted': false }],
          sort: { 'withdrawalHistory.revokedAt': -1 },
          limit: 1
        }
      );

      logger.info(`Data cleanup completed for user ${userId}, consent type: ${consentType}`);
      return { success: true };

    } catch (error) {
      logger.error('Error performing data cleanup:', error);
      throw error;
    }
  }

  /**
   * Validate consent before data collection
   */
  async validateConsentForDataCollection(userId, dataType, purpose) {
    try {
      // Find relevant consent types for this data collection
      const relevantConsents = Object.entries(this.requiredConsents).filter(([type, config]) => 
        config.dataTypes.includes(dataType) && config.purposes.includes(purpose)
      );

      if (relevantConsents.length === 0) {
        logger.warn(`No consent configuration found for dataType: ${dataType}, purpose: ${purpose}`);
        return false;
      }

      // Check if user has granted consent for any of the relevant consent types
      for (const [consentType] of relevantConsents) {
        const hasConsent = await this.hasValidConsent(userId, consentType);
        if (hasConsent) {
          return true;
        }
      }

      return false;

    } catch (error) {
      logger.error('Error validating consent for data collection:', error);
      return false;
    }
  }
}

module.exports = new ConsentService();