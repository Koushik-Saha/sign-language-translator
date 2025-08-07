const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const MLModel = require('../models/MLModel');
const logger = require('./logger');

class ModelVersioningService {
  constructor() {
    this.modelsStoragePath = path.join(__dirname, '../storage/models');
    this.versionsStoragePath = path.join(__dirname, '../storage/versions');
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.modelsStoragePath, { recursive: true });
      await fs.mkdir(this.versionsStoragePath, { recursive: true });
      logger.info('Model storage directories initialized');
    } catch (error) {
      logger.error('Failed to initialize storage directories:', error);
    }
  }

  /**
   * Generate semantic version based on changes
   */
  generateVersion(currentVersion, changeType = 'patch') {
    if (!currentVersion) return '1.0.0';
    
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Store model files and create version entry
   */
  async createModelVersion(modelData, files, changeType = 'patch') {
    try {
      const modelId = uuidv4();
      const versionId = uuidv4();
      
      // Find latest version of the same model type
      const latestModel = await MLModel.findOne({ 
        name: modelData.name,
        type: modelData.type 
      }).sort({ createdAt: -1 });
      
      const newVersion = this.generateVersion(
        latestModel?.version, 
        changeType
      );
      
      // Create version-specific storage directory
      const versionPath = path.join(this.versionsStoragePath, versionId);
      await fs.mkdir(versionPath, { recursive: true });
      
      // Store model files
      const storedFiles = {};
      for (const [fileType, fileBuffer] of Object.entries(files)) {
        const fileName = `${fileType}_${newVersion}.bin`;
        const filePath = path.join(versionPath, fileName);
        await fs.writeFile(filePath, fileBuffer);
        storedFiles[fileType] = filePath;
      }
      
      // Create model metadata
      const modelMetadata = {
        ...modelData,
        version: newVersion,
        versionId,
        modelPath: storedFiles.model || '',
        weightsPath: storedFiles.weights || '',
        configPath: storedFiles.config || '',
        metadata: {
          ...modelData.metadata,
          versionHistory: latestModel ? latestModel.metadata?.versionHistory || [] : [],
          changeType,
          parentVersion: latestModel?.version || null,
          storagePath: versionPath
        }
      };
      
      // Add current version to history
      if (latestModel) {
        modelMetadata.metadata.versionHistory.push({
          version: latestModel.version,
          id: latestModel._id,
          createdAt: latestModel.createdAt,
          changeType: changeType,
          changes: modelData.changes || []
        });
      }
      
      const model = new MLModel(modelMetadata);
      await model.save();
      
      logger.info(`Created model version ${newVersion} for ${modelData.name}`);
      return model;
      
    } catch (error) {
      logger.error('Error creating model version:', error);
      throw error;
    }
  }

  /**
   * Get version history for a model
   */
  async getVersionHistory(modelName, modelType) {
    try {
      const models = await MLModel.find({ 
        name: modelName, 
        type: modelType 
      })
      .sort({ createdAt: -1 })
      .select('version performance.accuracy deployment.isActive createdAt metadata.changeType metadata.changes');
      
      return models.map(model => ({
        version: model.version,
        id: model._id,
        accuracy: model.performance?.accuracy || 0,
        isActive: model.deployment?.isActive || false,
        changeType: model.metadata?.changeType || 'unknown',
        changes: model.metadata?.changes || [],
        createdAt: model.createdAt
      }));
      
    } catch (error) {
      logger.error('Error fetching version history:', error);
      throw error;
    }
  }

  /**
   * Compare two model versions
   */
  async compareVersions(modelId1, modelId2) {
    try {
      const [model1, model2] = await Promise.all([
        MLModel.findById(modelId1),
        MLModel.findById(modelId2)
      ]);
      
      if (!model1 || !model2) {
        throw new Error('One or both models not found');
      }
      
      const comparison = {
        models: {
          version1: {
            id: model1._id,
            name: model1.name,
            version: model1.version,
            createdAt: model1.createdAt
          },
          version2: {
            id: model2._id,
            name: model2.name,
            version: model2.version,
            createdAt: model2.createdAt
          }
        },
        performance: {
          accuracy: {
            v1: model1.performance?.accuracy || 0,
            v2: model2.performance?.accuracy || 0,
            improvement: (model2.performance?.accuracy || 0) - (model1.performance?.accuracy || 0)
          },
          precision: {
            v1: model1.performance?.precision || 0,
            v2: model2.performance?.precision || 0,
            improvement: (model2.performance?.precision || 0) - (model1.performance?.precision || 0)
          },
          recall: {
            v1: model1.performance?.recall || 0,
            v2: model2.performance?.recall || 0,
            improvement: (model2.performance?.recall || 0) - (model1.performance?.recall || 0)
          },
          f1Score: {
            v1: model1.performance?.f1Score || 0,
            v2: model2.performance?.f1Score || 0,
            improvement: (model2.performance?.f1Score || 0) - (model1.performance?.f1Score || 0)
          }
        },
        changes: model2.metadata?.changes || [],
        recommendation: this.generateRecommendation(model1, model2)
      };
      
      return comparison;
      
    } catch (error) {
      logger.error('Error comparing versions:', error);
      throw error;
    }
  }

  /**
   * Generate deployment recommendation based on comparison
   */
  generateRecommendation(model1, model2) {
    const acc1 = model1.performance?.accuracy || 0;
    const acc2 = model2.performance?.accuracy || 0;
    const improvement = acc2 - acc1;
    
    if (improvement > 0.05) {
      return {
        action: 'deploy',
        confidence: 'high',
        reason: `Significant accuracy improvement of ${(improvement * 100).toFixed(2)}%`
      };
    } else if (improvement > 0.01) {
      return {
        action: 'ab_test',
        confidence: 'medium',
        reason: `Modest improvement of ${(improvement * 100).toFixed(2)}%, recommend A/B testing`
      };
    } else if (improvement >= 0) {
      return {
        action: 'monitor',
        confidence: 'low',
        reason: `Minimal improvement of ${(improvement * 100).toFixed(2)}%, continue monitoring`
      };
    } else {
      return {
        action: 'reject',
        confidence: 'high',
        reason: `Performance decreased by ${(Math.abs(improvement) * 100).toFixed(2)}%`
      };
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackToPreviousVersion(modelName, modelType, targetVersion = null) {
    try {
      // Get current active model
      const currentModel = await MLModel.getActiveModel(modelType);
      if (!currentModel || currentModel.name !== modelName) {
        throw new Error('No active model found to rollback from');
      }
      
      let targetModel;
      if (targetVersion) {
        targetModel = await MLModel.findOne({ 
          name: modelName, 
          type: modelType, 
          version: targetVersion 
        });
      } else {
        // Find previous version
        const models = await MLModel.find({ 
          name: modelName, 
          type: modelType,
          _id: { $ne: currentModel._id }
        }).sort({ createdAt: -1 }).limit(1);
        
        targetModel = models[0];
      }
      
      if (!targetModel) {
        throw new Error('No target version found for rollback');
      }
      
      // Deactivate current model
      await currentModel.deactivate();
      
      // Activate target model
      await targetModel.activate();
      
      // Log rollback
      logger.warn(`Rolled back ${modelName} from ${currentModel.version} to ${targetModel.version}`);
      
      return {
        from: currentModel.version,
        to: targetModel.version,
        model: targetModel
      };
      
    } catch (error) {
      logger.error('Error during rollback:', error);
      throw error;
    }
  }

  /**
   * Clean up old model versions (keep last N versions)
   */
  async cleanupOldVersions(modelName, modelType, keepVersions = 5) {
    try {
      const models = await MLModel.find({ 
        name: modelName, 
        type: modelType 
      }).sort({ createdAt: -1 });
      
      if (models.length <= keepVersions) {
        return { message: 'No cleanup needed' };
      }
      
      const modelsToDelete = models.slice(keepVersions);
      const deletedVersions = [];
      
      for (const model of modelsToDelete) {
        // Don't delete if it's currently active
        if (model.deployment?.isActive) {
          continue;
        }
        
        // Clean up storage files
        const storagePath = model.metadata?.storagePath;
        if (storagePath) {
          try {
            await fs.rmdir(storagePath, { recursive: true });
          } catch (error) {
            logger.warn(`Failed to delete storage for version ${model.version}:`, error);
          }
        }
        
        // Delete model record
        await MLModel.deleteOne({ _id: model._id });
        deletedVersions.push(model.version);
      }
      
      logger.info(`Cleaned up ${deletedVersions.length} old versions for ${modelName}`);
      return { deletedVersions };
      
    } catch (error) {
      logger.error('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Get model storage statistics
   */
  async getStorageStats() {
    try {
      const stats = await MLModel.aggregate([
        {
          $group: {
            _id: '$type',
            totalModels: { $sum: 1 },
            activeModels: { 
              $sum: { $cond: ['$deployment.isActive', 1, 0] } 
            },
            averageAccuracy: { $avg: '$performance.accuracy' },
            latestVersion: { $max: '$createdAt' }
          }
        }
      ]);
      
      // Get file system storage info
      const modelsDirStats = await fs.stat(this.modelsStoragePath).catch(() => null);
      const versionsDirStats = await fs.stat(this.versionsStoragePath).catch(() => null);
      
      return {
        byType: stats,
        storage: {
          modelsPath: this.modelsStoragePath,
          versionsPath: this.versionsStoragePath,
          modelsSize: modelsDirStats ? this.formatBytes(modelsDirStats.size) : 'Unknown',
          versionsSize: versionsDirStats ? this.formatBytes(versionsDirStats.size) : 'Unknown'
        }
      };
      
    } catch (error) {
      logger.error('Error getting storage stats:', error);
      throw error;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new ModelVersioningService();