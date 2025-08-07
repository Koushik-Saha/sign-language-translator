const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const MLModel = require('../models/MLModel');
const TrainingData = require('../models/TrainingData');

class TransferLearningService {
  constructor() {
    this.baseModelsPath = path.join(__dirname, '../storage/base-models');
    this.trainingDataPath = path.join(__dirname, '../storage/training-data');
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.baseModelsPath, { recursive: true });
      await fs.mkdir(this.trainingDataPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to initialize transfer learning storage:', error);
    }
  }

  /**
   * Load pre-trained base model for transfer learning
   */
  async loadBaseModel(modelType) {
    try {
      const baseModelPath = path.join(this.baseModelsPath, `${modelType}-base`);
      
      // Check if base model exists locally
      try {
        const model = await tf.loadLayersModel(`file://${baseModelPath}/model.json`);
        logger.info(`Loaded local base model for ${modelType}`);
        return model;
      } catch (localError) {
        logger.warn(`Local base model not found for ${modelType}, creating new one`);
      }

      // Create base model based on type
      let baseModel;
      switch (modelType) {
        case 'gesture_recognition':
          baseModel = this.createGestureRecognitionBaseModel();
          break;
        case 'alphabet_classification':
          baseModel = this.createAlphabetClassificationBaseModel();
          break;
        case 'word_detection':
          baseModel = this.createWordDetectionBaseModel();
          break;
        case 'fingerspelling':
          baseModel = this.createFingerspellingBaseModel();
          break;
        default:
          throw new Error(`Unsupported model type: ${modelType}`);
      }

      // Save base model for future use
      await baseModel.save(`file://${baseModelPath}`);
      logger.info(`Created and saved base model for ${modelType}`);
      
      return baseModel;

    } catch (error) {
      logger.error(`Error loading base model for ${modelType}:`, error);
      throw error;
    }
  }

  /**
   * Create base model for gesture recognition
   */
  createGestureRecognitionBaseModel() {
    const model = tf.sequential({
      layers: [
        // Feature extraction layers
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.batchNormalization(),
        
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.batchNormalization(),
        
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.batchNormalization(),
        
        // Global average pooling
        tf.layers.globalAveragePooling2d(),
        
        // Feature vector layer (freeze this during transfer learning)
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          name: 'feature_vector'
        }),
        tf.layers.dropout({ rate: 0.5 }),
        
        // Classification head (replace this for new tasks)
        tf.layers.dense({
          units: 100, // Base number of gesture classes
          activation: 'softmax',
          name: 'predictions'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create base model for alphabet classification
   */
  createAlphabetClassificationBaseModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [64, 64, 3],
          filters: 16,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.flatten(),
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          name: 'feature_vector'
        }),
        tf.layers.dropout({ rate: 0.5 }),
        
        tf.layers.dense({
          units: 26, // A-Z letters
          activation: 'softmax',
          name: 'predictions'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create base model for word detection (LSTM-based)
   */
  createWordDetectionBaseModel() {
    const model = tf.sequential({
      layers: [
        // Temporal sequence processing
        tf.layers.lstm({
          inputShape: [30, 21 * 3], // 30 frames, 21 keypoints with x,y,z
          units: 128,
          returnSequences: true,
          name: 'lstm_1'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.lstm({
          units: 64,
          returnSequences: false,
          name: 'lstm_2'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        // Feature processing
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          name: 'feature_vector'
        }),
        tf.layers.dropout({ rate: 0.5 }),
        
        // Word classification
        tf.layers.dense({
          units: 1000, // Base vocabulary size
          activation: 'softmax',
          name: 'predictions'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create base model for fingerspelling
   */
  createFingerspellingBaseModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [20, 21 * 3], // 20 frames for fingerspelling
          units: 64,
          returnSequences: true
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.lstm({
          units: 32,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          name: 'feature_vector'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 26, // A-Z letters
          activation: 'softmax',
          name: 'predictions'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Prepare model for transfer learning
   */
  async prepareModelForTransferLearning(baseModel, newOutputClasses, freezeLayers = true) {
    try {
      // Remove the final classification layer
      const featureExtractor = tf.model({
        inputs: baseModel.input,
        outputs: baseModel.getLayer('feature_vector').output
      });

      // Freeze feature extraction layers if requested
      if (freezeLayers) {
        featureExtractor.layers.forEach(layer => {
          layer.trainable = false;
        });
      }

      // Create new classification head
      const newModel = tf.sequential({
        layers: [
          featureExtractor,
          tf.layers.dense({
            units: newOutputClasses.length,
            activation: 'softmax',
            name: 'transfer_predictions'
          })
        ]
      });

      // Compile with lower learning rate for transfer learning
      newModel.compile({
        optimizer: tf.train.adam(0.0001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      return newModel;

    } catch (error) {
      logger.error('Error preparing model for transfer learning:', error);
      throw error;
    }
  }

  /**
   * Load and preprocess training data
   */
  async loadTrainingData(gestureLabels, maxSamples = 1000) {
    try {
      const trainingData = await TrainingData.find({
        gestureLabel: { $in: gestureLabels },
        'validation.isValidated': true,
        'quality.overallScore': { $gte: 0.7 },
        'consent.hasConsent': true
      })
      .limit(maxSamples)
      .sort({ 'quality.overallScore': -1 });

      if (trainingData.length === 0) {
        throw new Error('No valid training data found for specified labels');
      }

      logger.info(`Loaded ${trainingData.length} training samples for ${gestureLabels.length} gesture classes`);

      // Process data based on type
      const processedData = await this.preprocessTrainingData(trainingData, gestureLabels);
      
      return processedData;

    } catch (error) {
      logger.error('Error loading training data:', error);
      throw error;
    }
  }

  /**
   * Preprocess training data for TensorFlow.js
   */
  async preprocessTrainingData(trainingData, gestureLabels) {
    try {
      const labelMap = {};
      gestureLabels.forEach((label, index) => {
        labelMap[label] = index;
      });

      const features = [];
      const labels = [];

      for (const data of trainingData) {
        // Extract keyframes data
        const keyframes = data.keyframes;
        if (!keyframes || keyframes.length === 0) continue;

        // Convert keyframes to feature vector
        const featureVector = this.extractFeatures(keyframes);
        if (featureVector) {
          features.push(featureVector);
          
          // Create one-hot encoded label
          const labelIndex = labelMap[data.gestureLabel];
          const oneHotLabel = new Array(gestureLabels.length).fill(0);
          oneHotLabel[labelIndex] = 1;
          labels.push(oneHotLabel);
        }
      }

      if (features.length === 0) {
        throw new Error('No valid features extracted from training data');
      }

      // Convert to tensors
      const xs = tf.tensor(features);
      const ys = tf.tensor(labels);

      logger.info(`Preprocessed ${features.length} samples into tensors`);

      return { xs, ys, labelMap };

    } catch (error) {
      logger.error('Error preprocessing training data:', error);
      throw error;
    }
  }

  /**
   * Extract features from keyframes
   */
  extractFeatures(keyframes) {
    try {
      // For gesture recognition, extract hand landmark sequences
      const features = [];
      
      for (const frame of keyframes) {
        if (frame.landmarks && frame.landmarks.length > 0) {
          const handLandmarks = frame.landmarks[0]; // First hand
          
          // Flatten x, y, z coordinates
          const frameFeatures = [];
          for (const landmark of handLandmarks) {
            frameFeatures.push(landmark.x, landmark.y, landmark.z || 0);
          }
          
          features.push(frameFeatures);
        }
      }

      // Pad or truncate to fixed sequence length
      const sequenceLength = 30;
      const featureSize = 21 * 3; // 21 landmarks * 3 coordinates

      if (features.length === 0) return null;

      // Pad sequences to fixed length
      while (features.length < sequenceLength) {
        features.push(new Array(featureSize).fill(0));
      }

      // Truncate if too long
      if (features.length > sequenceLength) {
        features.splice(sequenceLength);
      }

      return features;

    } catch (error) {
      logger.error('Error extracting features:', error);
      return null;
    }
  }

  /**
   * Train model using transfer learning
   */
  async trainWithTransferLearning(modelType, gestureLabels, trainingConfig = {}) {
    try {
      const {
        epochs = 10,
        batchSize = 32,
        validationSplit = 0.2,
        freezeLayers = true,
        maxSamples = 1000
      } = trainingConfig;

      logger.info(`Starting transfer learning for ${modelType} with ${gestureLabels.length} classes`);

      // Load base model
      const baseModel = await this.loadBaseModel(modelType);

      // Prepare for transfer learning
      const transferModel = await this.prepareModelForTransferLearning(
        baseModel,
        gestureLabels,
        freezeLayers
      );

      // Load and preprocess training data
      const { xs, ys, labelMap } = await this.loadTrainingData(gestureLabels, maxSamples);

      // Train the model
      const history = await transferModel.fit(xs, ys, {
        epochs,
        batchSize,
        validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            logger.info(`Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)}, accuracy: ${logs.acc.toFixed(4)}`);
          }
        }
      });

      // Calculate final metrics
      const evaluation = await transferModel.evaluate(xs, ys);
      const finalAccuracy = evaluation[1].dataSync()[0];
      const finalLoss = evaluation[0].dataSync()[0];

      logger.info(`Transfer learning completed - Final accuracy: ${finalAccuracy.toFixed(4)}`);

      // Clean up tensors
      xs.dispose();
      ys.dispose();
      evaluation[0].dispose();
      evaluation[1].dispose();

      return {
        model: transferModel,
        history: history.history,
        metrics: {
          accuracy: finalAccuracy,
          loss: finalLoss
        },
        labelMap,
        trainingConfig
      };

    } catch (error) {
      logger.error('Error in transfer learning:', error);
      throw error;
    }
  }

  /**
   * Save trained model to database and filesystem
   */
  async saveTransferLearnedModel(modelData, trainingResult) {
    try {
      const { model, metrics, labelMap, trainingConfig } = trainingResult;
      
      // Generate model version
      const version = `tl-${Date.now()}`;
      const modelPath = path.join(this.baseModelsPath, `${modelData.name}-${version}`);
      
      // Save model to filesystem
      await model.save(`file://${modelPath}`);
      
      // Create model record in database
      const mlModel = new MLModel({
        name: modelData.name,
        version,
        description: `Transfer learned model for ${modelData.gestureLabels.join(', ')}`,
        type: modelData.type,
        architecture: 'transfer_learning',
        modelPath: `${modelPath}/model.json`,
        weightsPath: `${modelPath}/weights.bin`,
        performance: {
          accuracy: metrics.accuracy,
          testSetSize: trainingConfig.maxSamples || 1000
        },
        trainingData: {
          epochs: trainingConfig.epochs || 10,
          batchSize: trainingConfig.batchSize || 32,
          trainingDuration: Date.now() - trainingResult.startTime
        },
        features: {
          outputClasses: modelData.gestureLabels,
          inputShape: model.inputs[0].shape.slice(1) // Remove batch dimension
        },
        metadata: {
          transferLearning: true,
          baseModelType: modelData.type,
          freezeLayers: trainingConfig.freezeLayers !== false,
          labelMap,
          author: modelData.author || 'transfer-learning-service'
        }
      });

      await mlModel.save();
      
      logger.info(`Transfer learned model saved: ${modelData.name} v${version}`);
      return mlModel;

    } catch (error) {
      logger.error('Error saving transfer learned model:', error);
      throw error;
    }
  }

  /**
   * Fine-tune a pre-trained model
   */
  async fineTuneModel(modelId, additionalData, fineTuningConfig = {}) {
    try {
      const {
        epochs = 5,
        learningRate = 0.00001,
        unfreezeTopLayers = 2
      } = fineTuningConfig;

      // Load existing model
      const modelRecord = await MLModel.findById(modelId);
      if (!modelRecord) {
        throw new Error('Model not found');
      }

      const model = await tf.loadLayersModel(`file://${modelRecord.modelPath}`);

      // Unfreeze top layers for fine-tuning
      const totalLayers = model.layers.length;
      for (let i = Math.max(0, totalLayers - unfreezeTopLayers); i < totalLayers; i++) {
        model.layers[i].trainable = true;
      }

      // Recompile with very low learning rate
      model.compile({
        optimizer: tf.train.adam(learningRate),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // Load additional training data
      const { xs, ys } = await this.preprocessTrainingData(
        additionalData, 
        modelRecord.features.outputClasses
      );

      // Fine-tune the model
      const history = await model.fit(xs, ys, {
        epochs,
        batchSize: 16,
        validationSplit: 0.1,
        shuffle: true
      });

      // Evaluate performance
      const evaluation = await model.evaluate(xs, ys);
      const finalAccuracy = evaluation[1].dataSync()[0];

      // Clean up
      xs.dispose();
      ys.dispose();
      evaluation[0].dispose();
      evaluation[1].dispose();

      return {
        model,
        originalModelId: modelId,
        fineTunedAccuracy: finalAccuracy,
        history: history.history
      };

    } catch (error) {
      logger.error('Error fine-tuning model:', error);
      throw error;
    }
  }
}

module.exports = new TransferLearningService();