const mongoose = require('mongoose');

const trainingDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  gestureLabel: {
    type: String,
    required: true,
    uppercase: true
  },
  gestureType: {
    type: String,
    enum: ['letter', 'word', 'phrase', 'number'],
    required: true
  },
  videoData: {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    duration: { type: Number, required: true },
    frameRate: { type: Number, required: true },
    resolution: {
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    format: { type: String, required: true },
    thumbnailPath: { type: String }
  },
  keyframes: [{
    timestamp: { type: Number, required: true },
    landmarks: {
      hands: [{
        handedness: { type: String, enum: ['Left', 'Right'] },
        landmarks: [[Number]], // Array of [x, y, z] coordinates for 21 hand landmarks
        confidence: { type: Number, min: 0, max: 1 }
      }],
      pose: [[Number]], // Array of [x, y, z] coordinates for pose landmarks
      face: [[Number]] // Array of [x, y, z] coordinates for face landmarks
    },
    boundingBox: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    }
  }],
  metadata: {
    userDemographics: {
      age: { type: String, enum: ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'] },
      handedness: { type: String, enum: ['left', 'right', 'ambidextrous'] },
      signingExperience: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'native'] },
      region: { type: String }
    },
    captureConditions: {
      lightingCondition: { type: String, enum: ['bright', 'normal', 'dim', 'mixed'] },
      backgroundType: { type: String, enum: ['plain', 'complex', 'dynamic'] },
      cameraAngle: { type: String, enum: ['front', 'side', 'angled'] },
      distance: { type: String, enum: ['close', 'normal', 'far'] }
    },
    deviceInfo: {
      userAgent: { type: String },
      cameraResolution: { type: String },
      platform: { type: String, enum: ['desktop', 'mobile', 'tablet'] }
    }
  },
  quality: {
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    clarity: { type: Number, min: 0, max: 100, default: 0 },
    visibility: { type: Number, min: 0, max: 100, default: 0 },
    consistency: { type: Number, min: 0, max: 100, default: 0 },
    completeness: { type: Number, min: 0, max: 100, default: 0 },
    issues: [String]
  },
  validation: {
    isValidated: { type: Boolean, default: false },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    validatedAt: { type: Date },
    validationScore: { type: Number, min: 0, max: 100 },
    validationNotes: { type: String },
    isCorrectLabel: { type: Boolean },
    suggestedLabel: { type: String }
  },
  usage: {
    isUsedForTraining: { type: Boolean, default: false },
    usedInModels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MLModel' }],
    splitType: { type: String, enum: ['train', 'validation', 'test'] },
    augmentationApplied: [String],
    contributionScore: { type: Number, min: 0, max: 100, default: 0 }
  },
  consent: {
    hasConsent: { type: Boolean, required: true, default: false },
    consentType: { type: String, enum: ['research', 'commercial', 'both'], default: 'research' },
    consentDate: { type: Date, default: Date.now },
    canWithdraw: { type: Boolean, default: true },
    withdrawalDate: { type: Date },
    isWithdrawn: { type: Boolean, default: false }
  },
  privacy: {
    anonymized: { type: Boolean, default: true },
    hasPersonalInfo: { type: Boolean, default: false },
    dataRetentionPeriod: { type: Number, default: 365 }, // days
    encryptionLevel: { type: String, enum: ['basic', 'standard', 'high'], default: 'standard' }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
trainingDataSchema.index({ userId: 1, gestureLabel: 1 });
trainingDataSchema.index({ gestureType: 1, 'validation.isValidated': 1 });
trainingDataSchema.index({ 'usage.isUsedForTraining': 1, 'usage.splitType': 1 });
trainingDataSchema.index({ 'consent.hasConsent': 1, 'consent.isWithdrawn': 1 });
trainingDataSchema.index({ createdAt: 1 });

// Virtual for file URL
trainingDataSchema.virtual('videoUrl').get(function() {
  return `${process.env.CDN_BASE_URL || '/api/training-data'}/video/${this._id}`;
});

// Methods
trainingDataSchema.methods.calculateQualityScore = function() {
  const scores = [];
  
  // Check video duration (optimal: 2-5 seconds)
  const durationScore = this.videoData.duration >= 2 && this.videoData.duration <= 5 ? 100 : 
                       Math.max(0, 100 - Math.abs(this.videoData.duration - 3.5) * 20);
  scores.push(durationScore);
  
  // Check frame rate (optimal: 30fps)
  const frameRateScore = this.videoData.frameRate >= 24 ? 100 : this.videoData.frameRate * 4;
  scores.push(frameRateScore);
  
  // Check if hands are detected in most frames
  const handsDetectedFrames = this.keyframes.filter(frame => 
    frame.landmarks.hands && frame.landmarks.hands.length > 0
  ).length;
  const handsScore = this.keyframes.length > 0 ? (handsDetectedFrames / this.keyframes.length) * 100 : 0;
  scores.push(handsScore);
  
  // Check landmark consistency
  let consistencyScore = 100;
  if (this.keyframes.length > 1) {
    // Simple consistency check - could be more sophisticated
    const confidenceScores = this.keyframes
      .filter(frame => frame.landmarks.hands && frame.landmarks.hands.length > 0)
      .map(frame => frame.landmarks.hands[0].confidence || 0);
    
    if (confidenceScores.length > 0) {
      const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
      consistencyScore = avgConfidence * 100;
    }
  }
  scores.push(consistencyScore);
  
  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  this.quality = {
    overallScore: Math.round(overallScore),
    clarity: Math.round(durationScore),
    visibility: Math.round(handsScore),
    consistency: Math.round(consistencyScore),
    completeness: Math.round(frameRateScore),
    issues: []
  };
  
  // Add issues based on scores
  if (durationScore < 70) this.quality.issues.push('Video duration not optimal');
  if (frameRateScore < 70) this.quality.issues.push('Low frame rate');
  if (handsScore < 70) this.quality.issues.push('Hands not consistently visible');
  if (consistencyScore < 70) this.quality.issues.push('Inconsistent gesture execution');
  
  return this.save();
};

trainingDataSchema.methods.validate = function(validatorId, isCorrect, score, notes, suggestedLabel) {
  this.validation = {
    isValidated: true,
    validatedBy: validatorId,
    validatedAt: new Date(),
    validationScore: score,
    validationNotes: notes,
    isCorrectLabel: isCorrect,
    suggestedLabel: suggestedLabel
  };
  return this.save();
};

trainingDataSchema.methods.markForTraining = function(splitType, models) {
  this.usage = {
    ...this.usage,
    isUsedForTraining: true,
    splitType: splitType,
    usedInModels: models || []
  };
  return this.save();
};

trainingDataSchema.methods.withdrawConsent = function() {
  this.consent.isWithdrawn = true;
  this.consent.withdrawalDate = new Date();
  this.usage.isUsedForTraining = false;
  return this.save();
};

// Static methods
trainingDataSchema.statics.getTrainingSet = function(gestureType, splitType = 'train') {
  return this.find({
    gestureType,
    'usage.splitType': splitType,
    'usage.isUsedForTraining': true,
    'consent.hasConsent': true,
    'consent.isWithdrawn': false,
    'validation.isValidated': true,
    'validation.isCorrectLabel': true
  }).populate('userId', 'username profile.skillLevel');
};

trainingDataSchema.statics.getQualityDataset = function(minQualityScore = 70) {
  return this.find({
    'quality.overallScore': { $gte: minQualityScore },
    'consent.hasConsent': true,
    'consent.isWithdrawn': false
  });
};

module.exports = mongoose.model('TrainingData', trainingDataSchema);