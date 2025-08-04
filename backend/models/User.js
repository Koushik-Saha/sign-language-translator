const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatar: { type: String },
    dateOfBirth: { type: Date },
    preferredLanguage: { type: String, default: 'en' },
    learningGoals: [String],
    skillLevel: { 
      type: String, 
      enum: ['beginner', 'intermediate', 'advanced'], 
      default: 'beginner' 
    }
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    highContrast: { type: Boolean, default: false },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true }
    },
    camera: {
      mirrorMode: { type: Boolean, default: true },
      resolution: { type: String, default: '720p' },
      frameRate: { type: Number, default: 30 }
    }
  },
  learningHistory: [{
    sessionId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    gesturesAttempted: { type: Number, default: 0 },
    gesturesCorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    lesson: { type: String },
    difficulty: { type: String },
    improvements: [String]
  }],
  personalVocabulary: [{
    gesture: { type: String, required: true },
    meaning: { type: String, required: true },
    category: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    videoUrl: { type: String },
    notes: { type: String },
    dateAdded: { type: Date, default: Date.now },
    practiceCount: { type: Number, default: 0 },
    masteryLevel: { type: Number, default: 0, min: 0, max: 100 }
  }],
  achievements: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    iconUrl: { type: String },
    dateEarned: { type: Date, default: Date.now },
    category: { type: String },
    points: { type: Number, default: 0 }
  }],
  statistics: {
    totalSessionTime: { type: Number, default: 0 },
    totalGesturesLearned: { type: Number, default: 0 },
    averageAccuracy: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    totalPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
  },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      return ret;
    }
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateLearningHistory = function(sessionData) {
  this.learningHistory.push(sessionData);
  
  const totalSessions = this.learningHistory.length;
  const totalCorrect = this.learningHistory.reduce((sum, session) => sum + session.gesturesCorrect, 0);
  const totalAttempted = this.learningHistory.reduce((sum, session) => sum + session.gesturesAttempted, 0);
  
  this.statistics.averageAccuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
  this.statistics.totalSessionTime += sessionData.duration || 0;
  this.statistics.lastActiveDate = new Date();
  
  this.updateStreak();
};

userSchema.methods.updateStreak = function() {
  const today = new Date();
  const lastActive = this.statistics.lastActiveDate;
  
  if (lastActive) {
    const daysDifference = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
    
    if (daysDifference === 1) {
      this.statistics.streakDays += 1;
      if (this.statistics.streakDays > this.statistics.longestStreak) {
        this.statistics.longestStreak = this.statistics.streakDays;
      }
    } else if (daysDifference > 1) {
      this.statistics.streakDays = 1;
    }
  } else {
    this.statistics.streakDays = 1;
  }
};

userSchema.methods.addAchievement = function(achievement) {
  const existingAchievement = this.achievements.find(a => a.id === achievement.id);
  if (!existingAchievement) {
    this.achievements.push(achievement);
    this.statistics.totalPoints += achievement.points || 0;
    
    const pointsForNextLevel = this.statistics.level * 1000;
    if (this.statistics.totalPoints >= pointsForNextLevel) {
      this.statistics.level += 1;
    }
  }
};

module.exports = mongoose.model('User', userSchema);