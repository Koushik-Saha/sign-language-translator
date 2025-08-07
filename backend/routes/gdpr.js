const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const rateLimiting = require('../middleware/advancedRateLimiting');
const inputValidation = require('../middleware/inputValidation');
const { GDPRService } = require('../services/gdprService');
const User = require('../models/User');
const logger = require('../services/logger');

const router = express.Router();

// Apply strict rate limiting to all GDPR endpoints
router.use(rateLimiting.strict);

// Record user consent
router.post('/consent', auth, [
  body('consentType').isIn(['necessary', 'functional', 'analytics', 'marketing']),
  body('granted').isBoolean(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { consentType, granted } = req.body;
    
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const consent = await GDPRService.recordConsent(
      req.user._id,
      { consentType, granted, ...metadata },
      metadata
    );

    res.status(201).json({
      success: true,
      message: 'Consent recorded successfully',
      data: { consent }
    });

  } catch (error) {
    logger.error('GDPR consent recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording consent'
    });
  }
});

// Get user's current consents
router.get('/consent', auth, async (req, res) => {
  try {
    const consents = await GDPRService.getValidConsents(req.user._id);

    res.json({
      success: true,
      data: { consents }
    });

  } catch (error) {
    logger.error('GDPR get consents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consent information'
    });
  }
});

// Withdraw consent
router.delete('/consent/:consentType', auth, [
  body('reason').optional().isString().isLength({ max: 500 })
], async (req, res) => {
  try {
    const { consentType } = req.params;
    const { reason = 'User requested withdrawal' } = req.body;

    if (!['necessary', 'functional', 'analytics', 'marketing'].includes(consentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid consent type'
      });
    }

    await GDPRService.withdrawConsent(req.user._id, consentType, reason);

    res.json({
      success: true,
      message: 'Consent withdrawn successfully'
    });

  } catch (error) {
    logger.error('GDPR withdraw consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error withdrawing consent'
    });
  }
});

// Request data export (Right to Data Portability)
router.post('/export-request', auth, async (req, res) => {
  try {
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const exportRequest = await GDPRService.requestDataExport(req.user._id, metadata);

    res.status(201).json({
      success: true,
      message: 'Data export request submitted successfully',
      data: exportRequest
    });

  } catch (error) {
    logger.error('GDPR export request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting data export request'
    });
  }
});

// Get export request status
router.get('/export-request/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { DataExportRequest } = require('../services/gdprService');
    
    const exportRequest = await DataExportRequest.findOne({
      requestId,
      userId: req.user._id
    });

    if (!exportRequest) {
      return res.status(404).json({
        success: false,
        message: 'Export request not found'
      });
    }

    res.json({
      success: true,
      data: {
        requestId: exportRequest.requestId,
        status: exportRequest.status,
        requestedAt: exportRequest.requestedAt,
        completedAt: exportRequest.completedAt,
        downloadUrl: exportRequest.downloadUrl,
        expiresAt: exportRequest.expiresAt
      }
    });

  } catch (error) {
    logger.error('GDPR export status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching export request status'
    });
  }
});

// Request data deletion (Right to be Forgotten)
router.post('/deletion-request', auth, [
  body('deletionScope').isIn(['full_account', 'specific_data', 'anonymization']),
  body('specificDataTypes').optional().isArray(),
  body('confirmation').equals('I understand this action cannot be undone')
    .withMessage('Deletion confirmation required'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { deletionScope, specificDataTypes = [] } = req.body;

    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const deletionRequest = await GDPRService.requestDataDeletion(
      req.user._id,
      deletionScope,
      specificDataTypes,
      metadata
    );

    res.status(201).json({
      success: true,
      message: 'Data deletion request submitted successfully',
      data: deletionRequest
    });

  } catch (error) {
    logger.error('GDPR deletion request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting data deletion request'
    });
  }
});

// Get deletion request status
router.get('/deletion-request/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { DataDeletionRequest } = require('../services/gdprService');
    
    const deletionRequest = await DataDeletionRequest.findOne({
      requestId,
      userId: req.user._id
    });

    if (!deletionRequest) {
      return res.status(404).json({
        success: false,
        message: 'Deletion request not found'
      });
    }

    res.json({
      success: true,
      data: {
        requestId: deletionRequest.requestId,
        status: deletionRequest.status,
        deletionScope: deletionRequest.deletionScope,
        specificDataTypes: deletionRequest.specificDataTypes,
        retainedData: deletionRequest.retainedData,
        retentionReason: deletionRequest.retentionReason,
        requestedAt: deletionRequest.requestedAt,
        completedAt: deletionRequest.completedAt
      }
    });

  } catch (error) {
    logger.error('GDPR deletion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deletion request status'
    });
  }
});

// Update privacy settings
router.put('/privacy-settings', auth, [
  body('dataProcessingOptOut').optional().isBoolean(),
  body('marketingOptOut').optional().isBoolean(),
  body('analyticsOptOut').optional().isBoolean(),
  body('dataRetentionOptOut').optional().isBoolean(),
  body('profileVisibility').optional().isIn(['public', 'private', 'limited']),
  body('dataPortabilityFormat').optional().isIn(['json', 'csv', 'xml']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const allowedSettings = [
      'dataProcessingOptOut',
      'marketingOptOut', 
      'analyticsOptOut',
      'dataRetentionOptOut',
      'profileVisibility',
      'dataPortabilityFormat'
    ];

    const settings = {};
    for (const key of allowedSettings) {
      if (req.body.hasOwnProperty(key)) {
        settings[key] = req.body[key];
      }
    }

    const updatedSettings = await GDPRService.updatePrivacySettings(
      req.user._id,
      settings
    );

    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: { privacySettings: updatedSettings }
    });

  } catch (error) {
    logger.error('GDPR privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating privacy settings'
    });
  }
});

// Get privacy settings
router.get('/privacy-settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('privacySettings');
    
    res.json({
      success: true,
      data: { privacySettings: user.privacySettings || {} }
    });

  } catch (error) {
    logger.error('GDPR get privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching privacy settings'
    });
  }
});

// Get data processing activities (audit trail)
router.get('/processing-activities', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { DataProcessingActivity } = require('../services/gdprService');

    const activities = await DataProcessingActivity.find({
      userId: req.user._id
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

    const totalCount = await DataProcessingActivity.countDocuments({
      userId: req.user._id
    });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('GDPR processing activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching processing activities'
    });
  }
});

// Get data retention policies
router.get('/retention-policies', async (req, res) => {
  try {
    const { DataRetentionPolicy } = require('../services/gdprService');
    
    const policies = await DataRetentionPolicy.find({}).lean();

    res.json({
      success: true,
      data: { policies }
    });

  } catch (error) {
    logger.error('GDPR retention policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching retention policies'
    });
  }
});

// Download exported data (secure endpoint)
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { DataExportRequest } = require('../services/gdprService');
    
    // Verify download token and get export request
    const exportRequest = await DataExportRequest.findOne({
      downloadUrl: `/api/gdpr/download/${token}`,
      status: 'completed',
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (!exportRequest) {
      return res.status(404).json({
        success: false,
        message: 'Download link expired or invalid'
      });
    }

    // Construct file path
    const filePath = path.join(__dirname, '../exports/gdpr', `export_${exportRequest.requestId}.json`);
    
    // Check if file exists
    const fs = require('fs').promises;
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Export file not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gdpr_export_${exportRequest.requestId}.json"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Stream the file
    const readStream = require('fs').createReadStream(filePath);
    readStream.pipe(res);

    // Log the download
    await GDPRService.logDataProcessingActivity(
      exportRequest.userId._id,
      'data_export_downloaded',
      'consent',
      { requestId: exportRequest.requestId }
    );

  } catch (error) {
    logger.error('GDPR download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading export file'
    });
  }
});

// Admin endpoints (require admin authentication)
router.get('/admin/stats', auth, async (req, res) => {
  try {
    // Check admin permissions
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { DataExportRequest, DataDeletionRequest, Consent, DataProcessingActivity } = require('../services/gdprService');
    
    // Get GDPR statistics
    const stats = await Promise.all([
      // Export requests stats
      DataExportRequest.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Deletion requests stats
      DataDeletionRequest.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Consent stats
      Consent.aggregate([
        {
          $match: { withdrawnAt: null }
        },
        {
          $group: {
            _id: { consentType: '$consentType', granted: '$granted' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Processing activities by type
      DataProcessingActivity.aggregate([
        {
          $group: {
            _id: '$activity',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        exportRequests: stats[0],
        deletionRequests: stats[1],
        consents: stats[2],
        topActivities: stats[3]
      }
    });

  } catch (error) {
    logger.error('GDPR admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching GDPR statistics'
    });
  }
});

// Run data retention cleanup (admin only)
router.post('/admin/retention-cleanup', auth, async (req, res) => {
  try {
    // Check admin permissions
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await GDPRService.runDataRetentionCleanup();

    res.json({
      success: true,
      message: 'Data retention cleanup completed',
      data: result
    });

  } catch (error) {
    logger.error('GDPR retention cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error running data retention cleanup'
    });
  }
});

module.exports = router;