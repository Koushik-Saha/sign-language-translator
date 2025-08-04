const mongoose = require('mongoose');

const mlModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  version: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling'],
    required: true
  },
  architecture: {
    type: String,
    enum: ['cnn', 'lstm', 'transformer', 'mediapipe', 'custom'],
    required: true
  },
  modelPath: {
    type: String,
    required: true
  },
  weightsPath: {
    type: String
  },
  configPath: {
    type: String
  },
  performance: {
    accuracy: { type: Number, min: 0, max: 1 },
    precision: { type: Number, min: 0, max: 1 },
    recall: { type: Number, min: 0, max: 1 },
    f1Score: { type: Number, min: 0, max: 1 },
    testSetSize: { type: Number, default: 0 },
    validationAccuracy: { type: Number, min: 0, max: 1 },
    crossValidationScore: { type: Number, min: 0, max: 1 }
  },
  trainingData: {
    datasetSize: { type: Number, default: 0 },
    trainingDuration: { type: Number },
    epochs: { type: Number },
    batchSize: { type: Number },
    learningRate: { type: Number },
    optimizer: { type: String },
    lossFunction: { type: String }
  },
  features: {
    inputShape: [Number],
    outputClasses: [String],
    preprocessingSteps: [String],
    augmentationTechniques: [String]
  },
  deployment: {
    isActive: { type: Boolean, default: false },
    deployedAt: { type: Date },
    environment: { type: String, enum: ['development', 'staging', 'production'], default: 'development' },
    serverLoad: { type: Number, min: 0, max: 100, default: 0 },
    responseTime: { type: Number, default: 0 },
    requestCount: { type: Number, default: 0 }
  },
  abTesting: {
    isInTest: { type: Boolean, default: false },
    testGroup: { type: String, enum: ['A', 'B', 'control'], default: 'control' },
    trafficPercentage: { type: Number, min: 0, max: 100, default: 0 },
    testStartDate: { type: Date },
    testEndDate: { type: Date },
    testResults: {
      userFeedbackScore: { type: Number, min: 0, max: 5 },
      errorRate: { type: Number, min: 0, max: 1 },
      userEngagement: { type: Number, min: 0, max: 100 },
      completionRate: { type: Number, min: 0, max: 100 }
    }
  },
  metadata: {
    author: { type: String },
    tags: [String],
    framework: { type: String },
    dependencies: [String],
    license: { type: String, default: 'MIT' },
    documentation: { type: String },
    changelog: [String]
  },
  isDeprecated: { type: Boolean, default: false },
  deprecationReason: { type: String },
  successorModel: { type: mongoose.Schema.Types.ObjectId, ref: 'MLModel' }
}, {
  timestamps: true
});

mlModelSchema.index({ name: 1, version: 1 }, { unique: true });
mlModelSchema.index({ type: 1, 'deployment.isActive': 1 });
mlModelSchema.index({ 'performance.accuracy': -1 });

mlModelSchema.methods.activate = function() {
  this.deployment.isActive = true;
  this.deployment.deployedAt = new Date();
  return this.save();
};

mlModelSchema.methods.deactivate = function() {
  this.deployment.isActive = false;
  return this.save();
};

mlModelSchema.methods.updatePerformance = function(metrics) {
  Object.assign(this.performance, metrics);
  return this.save();
};

mlModelSchema.methods.startABTest = function(testConfig) {
  this.abTesting = {
    ...this.abTesting,
    ...testConfig,
    isInTest: true,
    testStartDate: new Date()
  };
  return this.save();
};

mlModelSchema.methods.endABTest = function(results) {
  this.abTesting.isInTest = false;
  this.abTesting.testEndDate = new Date();
  this.abTesting.testResults = { ...this.abTesting.testResults, ...results };
  return this.save();
};

mlModelSchema.statics.getActiveModel = function(type) {
  return this.findOne({ 
    type, 
    'deployment.isActive': true,
    isDeprecated: false 
  }).sort({ 'performance.accuracy': -1 });
};

mlModelSchema.statics.getModelsForABTest = function(type) {
  return this.find({ 
    type, 
    'abTesting.isInTest': true,
    isDeprecated: false 
  });
};

module.exports = mongoose.model('MLModel', mlModelSchema);