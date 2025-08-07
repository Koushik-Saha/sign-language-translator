const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');

const { auth, optionalAuth } = require('../middleware/auth');
const MLModel = require('../models/MLModel');
const TrainingData = require('../models/TrainingData');
const User = require('../models/User');
const modelVersioningService = require('../services/modelVersioningService');
const consentService = require('../services/consentService');
const transferLearningService = require('../services/transferLearningService');
const abTestingService = require('../services/abTestingService');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/training-data');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, and QuickTime videos are allowed.'));
    }
  }
});

// Get all ML models (with filtering)
router.get('/models', optionalAuth, async (req, res) => {
  try {
    const { type, active, version, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (type) filter.type = type;
    if (active !== undefined) filter['deployment.isActive'] = active === 'true';
    if (version) filter.version = version;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { 'performance.accuracy': -1, createdAt: -1 },
      populate: {
        path: 'successorModel',
        select: 'name version performance.accuracy'
      }
    };
    
    const models = await MLModel.find(filter)
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit)
      .populate(options.populate);
    
    const total = await MLModel.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        models,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          pages: Math.ceil(total / options.limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ML models'
    });
  }
});

// Get active model for specific type
router.get('/models/active/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const model = await MLModel.getActiveModel(type);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        message: `No active model found for type: ${type}`
      });
    }
    
    res.json({
      success: true,
      data: { model }
    });
    
  } catch (error) {
    console.error('Get active model error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active model'
    });
  }
});

// Create new ML model (admin only)
router.post('/models', auth, [
  body('name').notEmpty().withMessage('Model name is required'),
  body('version').notEmpty().withMessage('Version is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('type').isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling']),
  body('architecture').isIn(['cnn', 'lstm', 'transformer', 'mediapipe', 'custom']),
  body('modelPath').notEmpty().withMessage('Model path is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    // Check if user is admin (you might want to implement proper role checking)
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const modelData = {
      ...req.body,
      metadata: {
        ...req.body.metadata,
        author: user.username
      }
    };
    
    const model = new MLModel(modelData);
    await model.save();
    
    res.status(201).json({
      success: true,
      message: 'ML model created successfully',
      data: { model }
    });
    
  } catch (error) {
    console.error('Create model error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Model with this name and version already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating ML model'
    });
  }
});

// Update model performance
router.put('/models/:id/performance', auth, [
  body('accuracy').optional().isFloat({ min: 0, max: 1 }),
  body('precision').optional().isFloat({ min: 0, max: 1 }),
  body('recall').optional().isFloat({ min: 0, max: 1 }),
  body('f1Score').optional().isFloat({ min: 0, max: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const model = await MLModel.findById(req.params.id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }
    
    await model.updatePerformance(req.body);
    
    res.json({
      success: true,
      message: 'Model performance updated',
      data: { model }
    });
    
  } catch (error) {
    console.error('Update performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating model performance'
    });
  }
});

// Activate/deactivate model
router.put('/models/:id/deployment', auth, [
  body('action').isIn(['activate', 'deactivate']).withMessage('Action must be activate or deactivate')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const { action } = req.body;
    const model = await MLModel.findById(req.params.id);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }
    
    if (action === 'activate') {
      // Deactivate other models of the same type first
      await MLModel.updateMany(
        { type: model.type, _id: { $ne: model._id } },
        { $set: { 'deployment.isActive': false } }
      );
      await model.activate();
    } else {
      await model.deactivate();
    }
    
    res.json({
      success: true,
      message: `Model ${action}d successfully`,
      data: { model }
    });
    
  } catch (error) {
    console.error('Model deployment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating model deployment'
    });
  }
});

// Start A/B test
router.post('/models/:id/ab-test', auth, [
  body('testGroup').isIn(['A', 'B']).withMessage('Test group must be A or B'),
  body('trafficPercentage').isInt({ min: 1, max: 100 }).withMessage('Traffic percentage must be 1-100'),
  body('testEndDate').isISO8601().withMessage('Valid end date required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const model = await MLModel.findById(req.params.id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }
    
    await model.startABTest({
      testGroup: req.body.testGroup,
      trafficPercentage: req.body.trafficPercentage,
      testEndDate: new Date(req.body.testEndDate)
    });
    
    res.json({
      success: true,
      message: 'A/B test started successfully',
      data: { model }
    });
    
  } catch (error) {
    console.error('Start A/B test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting A/B test'
    });
  }
});

// Submit training data
router.post('/training-data', auth, upload.single('video'), [
  body('gestureLabel').notEmpty().withMessage('Gesture label is required'),
  body('gestureType').isIn(['letter', 'word', 'phrase', 'number']).withMessage('Invalid gesture type'),
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('keyframes').isJSON().withMessage('Keyframes must be valid JSON'),
  body('consent').isBoolean().withMessage('Consent must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required'
      });
    }
    
    if (!req.body.consent || req.body.consent !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'User consent is required for data collection'
      });
    }

    // Validate consent for data collection
    const hasValidConsent = await consentService.validateConsentForDataCollection(
      req.user._id,
      'video_data',
      'model_training'
    );

    if (!hasValidConsent) {
      return res.status(403).json({
        success: false,
        message: 'Valid consent required for this type of data collection. Please update your consent preferences.',
        requiresConsentUpdate: true
      });
    }
    
    const keyframes = JSON.parse(req.body.keyframes);
    
    // Create thumbnail
    let thumbnailPath = null;
    try {
      const thumbnailName = `thumb-${path.parse(req.file.filename).name}.jpg`;
      thumbnailPath = path.join(path.dirname(req.file.path), thumbnailName);
      
      // For now, we'll skip thumbnail generation since it requires video processing
      // In production, you'd use ffmpeg or similar
    } catch (thumbError) {
      console.warn('Thumbnail generation failed:', thumbError);
    }
    
    const trainingData = new TrainingData({
      userId: req.user._id,
      sessionId: req.body.sessionId,
      gestureLabel: req.body.gestureLabel.toUpperCase(),
      gestureType: req.body.gestureType,
      videoData: {
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        duration: parseFloat(req.body.duration) || 0,
        frameRate: parseInt(req.body.frameRate) || 30,
        resolution: {
          width: parseInt(req.body.width) || 640,
          height: parseInt(req.body.height) || 480
        },
        format: req.file.mimetype,
        thumbnailPath
      },
      keyframes,
      metadata: {
        userDemographics: {
          handedness: req.body.handedness || 'right',
          signingExperience: req.user.profile?.skillLevel || 'beginner'
        },
        captureConditions: {
          lightingCondition: req.body.lightingCondition || 'normal',
          backgroundType: req.body.backgroundType || 'plain',
          cameraAngle: req.body.cameraAngle || 'front',
          distance: req.body.distance || 'normal'
        },
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          platform: req.body.platform || 'desktop'
        }
      },
      consent: {
        hasConsent: true,
        consentType: req.body.consentType || 'research'
      }
    });
    
    await trainingData.save();
    
    // Calculate quality score
    await trainingData.calculateQualityScore();
    
    res.status(201).json({
      success: true,
      message: 'Training data submitted successfully',
      data: { 
        trainingData: {
          id: trainingData._id,
          qualityScore: trainingData.quality.overallScore,
          issues: trainingData.quality.issues
        }
      }
    });
    
  } catch (error) {
    console.error('Submit training data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting training data'
    });
  }
});

// Get user's training data contributions
router.get('/training-data/my-contributions', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, gestureType } = req.query;
    
    const filter = { userId: req.user._id };
    if (gestureType) filter.gestureType = gestureType;
    
    const contributions = await TrainingData.find(filter)
      .select('gestureLabel gestureType quality validation usage createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await TrainingData.countDocuments(filter);
    
    const stats = await TrainingData.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalContributions: { $sum: 1 },
          averageQuality: { $avg: '$quality.overallScore' },
          validatedCount: {
            $sum: { $cond: ['$validation.isValidated', 1, 0] }
          },
          usedForTraining: {
            $sum: { $cond: ['$usage.isUsedForTraining', 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        contributions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: stats[0] || {
          totalContributions: 0,
          averageQuality: 0,
          validatedCount: 0,
          usedForTraining: 0
        }
      }
    });
    
  } catch (error) {
    console.error('Get contributions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching training data contributions'
    });
  }
});

// Withdraw consent for training data
router.delete('/training-data/:id/consent', auth, async (req, res) => {
  try {
    const trainingData = await TrainingData.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!trainingData) {
      return res.status(404).json({
        success: false,
        message: 'Training data not found'
      });
    }
    
    if (!trainingData.consent.canWithdraw) {
      return res.status(400).json({
        success: false,
        message: 'Consent cannot be withdrawn for this data'
      });
    }
    
    await trainingData.withdrawConsent();
    
    res.json({
      success: true,
      message: 'Consent withdrawn successfully'
    });
    
  } catch (error) {
    console.error('Withdraw consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error withdrawing consent'
    });
  }
});

// Get model performance comparison
router.get('/models/compare', async (req, res) => {
  try {
    const { type, metrics = 'accuracy,precision,recall' } = req.query;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Model type is required'
      });
    }
    
    const models = await MLModel.find({ type })
      .select('name version performance deployment.isActive createdAt')
      .sort({ 'performance.accuracy': -1 });
    
    const comparison = models.map(model => {
      const result = {
        id: model._id,
        name: model.name,
        version: model.version,
        isActive: model.deployment.isActive,
        createdAt: model.createdAt
      };
      
      metrics.split(',').forEach(metric => {
        if (model.performance[metric] !== undefined) {
          result[metric] = model.performance[metric];
        }
      });
      
      return result;
    });
    
    res.json({
      success: true,
      data: { comparison }
    });
    
  } catch (error) {
    console.error('Model comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing models'
    });
  }
});

// Model versioning endpoints

// Create new model version
router.post('/models/versions', auth, upload.fields([
  { name: 'model', maxCount: 1 },
  { name: 'weights', maxCount: 1 },
  { name: 'config', maxCount: 1 }
]), [
  body('name').notEmpty().withMessage('Model name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('type').isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling']),
  body('architecture').isIn(['cnn', 'lstm', 'transformer', 'mediapipe', 'custom']),
  body('changeType').isIn(['major', 'minor', 'patch']).withMessage('Change type must be major, minor, or patch'),
  body('changes').isArray().withMessage('Changes must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (!req.files.model) {
      return res.status(400).json({
        success: false,
        message: 'Model file is required'
      });
    }

    const files = {};
    if (req.files.model) files.model = req.files.model[0].buffer;
    if (req.files.weights) files.weights = req.files.weights[0].buffer;
    if (req.files.config) files.config = req.files.config[0].buffer;

    const modelData = {
      ...req.body,
      metadata: {
        ...req.body.metadata,
        author: user.username
      }
    };

    const model = await modelVersioningService.createModelVersion(
      modelData,
      files,
      req.body.changeType
    );

    res.status(201).json({
      success: true,
      message: 'Model version created successfully',
      data: { model }
    });

  } catch (error) {
    console.error('Create model version error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating model version'
    });
  }
});

// Get version history for a model
router.get('/models/:name/:type/versions', async (req, res) => {
  try {
    const { name, type } = req.params;
    const history = await modelVersioningService.getVersionHistory(name, type);

    res.json({
      success: true,
      data: { history }
    });

  } catch (error) {
    console.error('Get version history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching version history'
    });
  }
});

// Compare two model versions
router.get('/models/compare/:id1/:id2', async (req, res) => {
  try {
    const { id1, id2 } = req.params;
    const comparison = await modelVersioningService.compareVersions(id1, id2);

    res.json({
      success: true,
      data: { comparison }
    });

  } catch (error) {
    console.error('Compare versions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing model versions'
    });
  }
});

// Rollback to previous version
router.post('/models/:name/:type/rollback', auth, [
  body('targetVersion').optional().isString()
], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { name, type } = req.params;
    const { targetVersion } = req.body;

    const result = await modelVersioningService.rollbackToPreviousVersion(
      name,
      type,
      targetVersion
    );

    res.json({
      success: true,
      message: 'Model rollback completed successfully',
      data: result
    });

  } catch (error) {
    console.error('Model rollback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during model rollback'
    });
  }
});

// Clean up old model versions
router.delete('/models/:name/:type/cleanup', auth, [
  body('keepVersions').optional().isInt({ min: 1, max: 20 }).withMessage('Keep versions must be 1-20')
], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { name, type } = req.params;
    const { keepVersions = 5 } = req.body;

    const result = await modelVersioningService.cleanupOldVersions(
      name,
      type,
      keepVersions
    );

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: result
    });

  } catch (error) {
    console.error('Model cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during model cleanup'
    });
  }
});

// Get model storage statistics
router.get('/models/storage/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await modelVersioningService.getStorageStats();

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Get storage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching storage statistics'
    });
  }
});

// Get training dataset statistics
router.get('/training-data/stats', async (req, res) => {
  try {
    const stats = await TrainingData.aggregate([
      {
        $group: {
          _id: '$gestureLabel',
          count: { $sum: 1 },
          averageQuality: { $avg: '$quality.overallScore' },
          validatedCount: {
            $sum: { $cond: ['$validation.isValidated', 1, 0] }
          },
          usedForTraining: {
            $sum: { $cond: ['$usage.isUsedForTraining', 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const overallStats = await TrainingData.aggregate([
      {
        $group: {
          _id: null,
          totalSamples: { $sum: 1 },
          uniqueGestures: { $addToSet: '$gestureLabel' },
          averageQuality: { $avg: '$quality.overallScore' },
          totalValidated: {
            $sum: { $cond: ['$validation.isValidated', 1, 0] }
          },
          totalUsedForTraining: {
            $sum: { $cond: ['$usage.isUsedForTraining', 1, 0] }
          }
        }
      }
    ]);
    
    const overall = overallStats[0] || {};
    overall.uniqueGesturesCount = overall.uniqueGestures ? overall.uniqueGestures.length : 0;
    delete overall.uniqueGestures;
    
    res.json({
      success: true,
      data: {
        byGesture: stats,
        overall
      }
    });
    
  } catch (error) {
    console.error('Training data stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching training data statistics'
    });
  }
});

// Consent management endpoints

// Record user consent
router.post('/consent', auth, [
  body('consentType').isIn(['research', 'model_training', 'performance_analytics', 'feature_improvement']),
  body('hasConsented').isBoolean(),
  body('dataTypes').optional().isArray(),
  body('purposes').optional().isArray(),
  body('retentionPeriod').optional().isIn(['1_year', '2_years', '5_years', 'indefinite']),
  body('dataSharing').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const consent = await consentService.recordConsent(
      req.user._id,
      req.body,
      metadata
    );

    res.status(201).json({
      success: true,
      message: 'Consent recorded successfully',
      data: { consent }
    });

  } catch (error) {
    console.error('Record consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording consent'
    });
  }
});

// Get user consents
router.get('/consent', auth, async (req, res) => {
  try {
    const consents = await consentService.getUserConsents(req.user._id);
    const updateRequirements = await consentService.requiresConsentUpdate(req.user._id);

    res.json({
      success: true,
      data: {
        consents,
        updateRequirements
      }
    });

  } catch (error) {
    console.error('Get consents error:', error);
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
    const { reason } = req.body;

    const result = await consentService.withdrawConsent(
      req.user._id,
      consentType,
      reason
    );

    res.json({
      success: true,
      message: 'Consent withdrawn successfully',
      data: { consent: result }
    });

  } catch (error) {
    console.error('Withdraw consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error withdrawing consent'
    });
  }
});

// Get consent statistics (admin only)
router.get('/consent/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await consentService.getConsentStatistics();

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Get consent stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consent statistics'
    });
  }
});

// Check consent validity for specific data collection
router.post('/consent/validate', auth, [
  body('dataType').isIn(['video_data', 'gesture_keyframes', 'performance_metrics', 'usage_analytics', 'demographic_info']),
  body('purpose').isIn(['model_training', 'research', 'product_improvement', 'bug_fixing', 'performance_optimization'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { dataType, purpose } = req.body;
    
    const isValid = await consentService.validateConsentForDataCollection(
      req.user._id,
      dataType,
      purpose
    );

    res.json({
      success: true,
      data: {
        isValid,
        dataType,
        purpose
      }
    });

  } catch (error) {
    console.error('Validate consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating consent'
    });
  }
});

// Transfer learning endpoints

// Start transfer learning training
router.post('/transfer-learning/train', auth, [
  body('name').notEmpty().withMessage('Model name is required'),
  body('type').isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling']),
  body('gestureLabels').isArray({ min: 2 }).withMessage('At least 2 gesture labels required'),
  body('trainingConfig').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { name, type, gestureLabels, trainingConfig = {} } = req.body;

    // Start transfer learning (this is async, so we'll return a job ID in real implementation)
    const trainingResult = await transferLearningService.trainWithTransferLearning(
      type,
      gestureLabels,
      {
        ...trainingConfig,
        startTime: Date.now()
      }
    );

    // Save the trained model
    const modelData = {
      name,
      type,
      gestureLabels,
      author: user.username
    };

    const savedModel = await transferLearningService.saveTransferLearnedModel(
      modelData,
      trainingResult
    );

    res.status(201).json({
      success: true,
      message: 'Transfer learning completed successfully',
      data: {
        model: savedModel,
        metrics: trainingResult.metrics,
        trainingHistory: trainingResult.history
      }
    });

  } catch (error) {
    console.error('Transfer learning error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during transfer learning training'
    });
  }
});

// Fine-tune an existing model
router.post('/transfer-learning/fine-tune/:modelId', auth, [
  body('additionalDataLabels').isArray({ min: 1 }).withMessage('Additional data labels required'),
  body('fineTuningConfig').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { modelId } = req.params;
    const { additionalDataLabels, fineTuningConfig = {} } = req.body;

    // Load additional training data
    const additionalData = await TrainingData.find({
      gestureLabel: { $in: additionalDataLabels },
      'validation.isValidated': true,
      'quality.overallScore': { $gte: 0.7 },
      'consent.hasConsent': true
    }).limit(500);

    if (additionalData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid additional training data found'
      });
    }

    // Fine-tune the model
    const fineTuningResult = await transferLearningService.fineTuneModel(
      modelId,
      additionalData,
      fineTuningConfig
    );

    // Save fine-tuned model as new version
    const originalModel = await MLModel.findById(modelId);
    const fineTunedModelData = {
      name: `${originalModel.name}-finetuned`,
      type: originalModel.type,
      gestureLabels: [...originalModel.features.outputClasses, ...additionalDataLabels],
      author: user.username
    };

    const savedModel = await transferLearningService.saveTransferLearnedModel(
      fineTunedModelData,
      {
        model: fineTuningResult.model,
        metrics: { accuracy: fineTuningResult.fineTunedAccuracy },
        history: fineTuningResult.history,
        trainingConfig: fineTuningConfig,
        startTime: Date.now()
      }
    );

    res.json({
      success: true,
      message: 'Model fine-tuning completed successfully',
      data: {
        originalModelId: modelId,
        fineTunedModel: savedModel,
        improvementAccuracy: fineTuningResult.fineTunedAccuracy - (originalModel.performance?.accuracy || 0)
      }
    });

  } catch (error) {
    console.error('Fine-tuning error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during model fine-tuning'
    });
  }
});

// Get available training data summary for transfer learning
router.get('/transfer-learning/data-summary', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const summary = await TrainingData.aggregate([
      {
        $match: {
          'validation.isValidated': true,
          'quality.overallScore': { $gte: 0.7 },
          'consent.hasConsent': true
        }
      },
      {
        $group: {
          _id: '$gestureLabel',
          count: { $sum: 1 },
          averageQuality: { $avg: '$quality.overallScore' },
          gestureType: { $first: '$gestureType' }
        }
      },
      {
        $match: {
          count: { $gte: 10 } // Minimum samples for training
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const byType = summary.reduce((acc, item) => {
      if (!acc[item.gestureType]) {
        acc[item.gestureType] = [];
      }
      acc[item.gestureType].push({
        label: item._id,
        count: item.count,
        averageQuality: item.averageQuality
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        summary,
        byType,
        totalGestures: summary.length,
        totalSamples: summary.reduce((sum, item) => sum + item.count, 0)
      }
    });

  } catch (error) {
    console.error('Get data summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching training data summary'
    });
  }
});

// A/B Testing endpoints

// Start A/B test
router.post('/ab-test/start', auth, [
  body('modelType').isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling']),
  body('candidateModelId').isMongoId(),
  body('trafficPercentage').isInt({ min: 1, max: 99 }),
  body('testDuration').optional().isInt({ min: 1, max: 30 }),
  body('testName').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const testResult = await abTestingService.startABTest(req.body);

    res.status(201).json({
      success: true,
      message: 'A/B test started successfully',
      data: testResult
    });

  } catch (error) {
    console.error('Start A/B test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting A/B test'
    });
  }
});

// End A/B test
router.post('/ab-test/end', auth, [
  body('modelType').isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling']),
  body('winnerGroup').optional().isIn(['A', 'B'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { modelType, winnerGroup } = req.body;
    const result = await abTestingService.endABTest(modelType, winnerGroup);

    res.json({
      success: true,
      message: 'A/B test ended successfully',
      data: result
    });

  } catch (error) {
    console.error('End A/B test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error ending A/B test'
    });
  }
});

// Get A/B test statistics
router.get('/ab-test/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { modelType } = req.query;
    const stats = await abTestingService.getABTestStatistics(modelType);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get A/B test stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching A/B test statistics'
    });
  }
});

// Record A/B test feedback
router.post('/ab-test/feedback', auth, [
  body('modelType').isIn(['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling']),
  body('userRating').optional().isInt({ min: 1, max: 5 }),
  body('taskCompleted').isBoolean(),
  body('completionTime').optional().isInt({ min: 0 }),
  body('errorType').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { modelType, ...feedbackData } = req.body;

    await abTestingService.recordFeedback(
      req.user._id,
      modelType,
      feedbackData
    );

    res.json({
      success: true,
      message: 'Feedback recorded successfully'
    });

  } catch (error) {
    console.error('Record A/B test feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording feedback'
    });
  }
});

// Get model for user (considering A/B test)
router.get('/ab-test/user-model/:modelType', auth, async (req, res) => {
  try {
    const { modelType } = req.params;
    
    if (!['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling'].includes(modelType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model type'
      });
    }

    const modelData = await abTestingService.getModelForUser(req.user._id, modelType);

    if (!modelData) {
      return res.status(404).json({
        success: false,
        message: 'No model found for user'
      });
    }

    res.json({
      success: true,
      data: {
        model: {
          id: modelData.model._id,
          name: modelData.model.name,
          version: modelData.model.version,
          modelPath: modelData.model.modelPath,
          weightsPath: modelData.model.weightsPath,
          configPath: modelData.model.configPath,
          outputClasses: modelData.model.features?.outputClasses
        },
        testGroup: modelData.testGroup,
        isTestParticipant: modelData.isTestParticipant
      }
    });

  } catch (error) {
    console.error('Get user model error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting model for user'
    });
  }
});

// Get user's A/B test assignments
router.get('/ab-test/user-assignments', auth, async (req, res) => {
  try {
    const assignments = await abTestingService.getUserTestAssignments(req.user._id);

    res.json({
      success: true,
      data: { assignments }
    });

  } catch (error) {
    console.error('Get user assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user test assignments'
    });
  }
});

module.exports = router;