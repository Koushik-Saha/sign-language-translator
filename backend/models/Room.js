const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'sign_to_text', 'gesture', 'system'],
    required: true
  },
  content: {
    text: { type: String },
    originalGesture: { type: String },
    translatedText: { type: String },
    confidence: { type: Number, min: 0, max: 1 },
    gestureData: {
      videoUrl: { type: String },
      keyframes: [{
        timestamp: { type: Number },
        landmarks: {
          hands: [{
            handedness: { type: String },
            landmarks: [[Number]],
            confidence: { type: Number }
          }]
        }
      }],
      duration: { type: Number }
    }
  },
  timestamp: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },
  editedAt: { type: Date },
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  replyTo: { type: String }, // Message ID being replied to
  metadata: {
    deviceType: { type: String },
    translationModel: { type: String },
    processingTime: { type: Number }
  }
});

const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  role: {
    type: String,
    enum: ['host', 'moderator', 'participant', 'observer'],
    default: 'participant'
  },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  isOnline: { type: Boolean, default: true },
  permissions: {
    canSpeak: { type: Boolean, default: true },
    canChat: { type: Boolean, default: true },
    canShareScreen: { type: Boolean, default: false },
    canModerate: { type: Boolean, default: false }
  },
  mediaState: {
    video: { type: Boolean, default: false },
    audio: { type: Boolean, default: false },
    screenShare: { type: Boolean, default: false }
  },
  connectionInfo: {
    peerId: { type: String },
    socketId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String }
  }
});

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['public', 'private', 'practice', 'classroom', 'meeting'],
    default: 'public'
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [participantSchema],
  messages: [messageSchema],
  settings: {
    maxParticipants: { type: Number, default: 10, max: 100 },
    requireApproval: { type: Boolean, default: false },
    allowAnonymous: { type: Boolean, default: false },
    recordSession: { type: Boolean, default: false },
    autoTranslation: { type: Boolean, default: true },
    translationLanguages: [{ type: String, default: ['en'] }],
    chatEnabled: { type: Boolean, default: true },
    gestureRecognition: { type: Boolean, default: true },
    qualitySettings: {
      videoResolution: { type: String, enum: ['480p', '720p', '1080p'], default: '720p' },
      frameRate: { type: Number, enum: [15, 24, 30], default: 30 },
      audioBitrate: { type: Number, default: 128 }
    }
  },
  schedule: {
    startTime: { type: Date },
    endTime: { type: Date },
    timezone: { type: String, default: 'UTC' },
    recurring: {
      enabled: { type: Boolean, default: false },
      pattern: { type: String, enum: ['daily', 'weekly', 'monthly'] },
      interval: { type: Number, default: 1 },
      endDate: { type: Date }
    }
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended', 'scheduled'],
    default: 'waiting'
  },
  statistics: {
    totalParticipants: { type: Number, default: 0 },
    maxConcurrentUsers: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    totalGestures: { type: Number, default: 0 },
    averageSessionDuration: { type: Number, default: 0 },
    translationAccuracy: { type: Number, default: 0 }
  },
  recordings: [{
    fileName: { type: String },
    filePath: { type: String },
    duration: { type: Number },
    size: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
    participants: [String]
  }],
  isActive: { type: Boolean, default: true },
  tags: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
roomSchema.index({ roomId: 1 }, { unique: true });
roomSchema.index({ hostId: 1 });
roomSchema.index({ status: 1, isActive: 1 });
roomSchema.index({ type: 1, isActive: 1 });
roomSchema.index({ 'participants.userId': 1 });
roomSchema.index({ createdAt: -1 });

// Virtual for active participants
roomSchema.virtual('activeParticipants').get(function() {
  return this.participants.filter(p => p.isOnline && !p.leftAt);
});

// Virtual for current participant count
roomSchema.virtual('currentParticipantCount').get(function() {
  return this.activeParticipants.length;
});

// Methods
roomSchema.methods.addParticipant = function(user, connectionInfo = {}) {
  const existingParticipant = this.participants.find(p => 
    p.userId.toString() === user._id.toString()
  );
  
  if (existingParticipant) {
    // User rejoining
    existingParticipant.isOnline = true;
    existingParticipant.leftAt = undefined;
    existingParticipant.connectionInfo = { ...existingParticipant.connectionInfo, ...connectionInfo };
  } else {
    // New participant
    const role = this.participants.length === 0 ? 'host' : 'participant';
    this.participants.push({
      userId: user._id,
      username: user.username,
      role,
      connectionInfo,
      permissions: {
        canSpeak: true,
        canChat: true,
        canShareScreen: role === 'host',
        canModerate: role === 'host'
      }
    });
    
    this.statistics.totalParticipants += 1;
  }
  
  // Update max concurrent users
  const currentCount = this.activeParticipants.length;
  if (currentCount > this.statistics.maxConcurrentUsers) {
    this.statistics.maxConcurrentUsers = currentCount;
  }
  
  return this.save();
};

roomSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (participant) {
    participant.isOnline = false;
    participant.leftAt = new Date();
  }
  
  return this.save();
};

roomSchema.methods.addMessage = function(messageData) {
  this.messages.push(messageData);
  this.statistics.totalMessages += 1;
  
  if (messageData.type === 'sign_to_text' || messageData.type === 'gesture') {
    this.statistics.totalGestures += 1;
  }
  
  // Keep only last 1000 messages in memory
  if (this.messages.length > 1000) {
    this.messages = this.messages.slice(-1000);
  }
  
  return this.save();
};

roomSchema.methods.updateParticipantMedia = function(userId, mediaState) {
  const participant = this.participants.find(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (participant) {
    participant.mediaState = { ...participant.mediaState, ...mediaState };
  }
  
  return this.save();
};

roomSchema.methods.updateParticipantRole = function(userId, newRole) {
  const participant = this.participants.find(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (participant) {
    participant.role = newRole;
    
    // Update permissions based on role
    switch (newRole) {
      case 'host':
        participant.permissions = {
          canSpeak: true,
          canChat: true,
          canShareScreen: true,
          canModerate: true
        };
        break;
      case 'moderator':
        participant.permissions = {
          canSpeak: true,
          canChat: true,
          canShareScreen: true,
          canModerate: true
        };
        break;
      case 'observer':
        participant.permissions = {
          canSpeak: false,
          canChat: false,
          canShareScreen: false,
          canModerate: false
        };
        break;
      default:
        participant.permissions = {
          canSpeak: true,
          canChat: true,
          canShareScreen: false,
          canModerate: false
        };
    }
  }
  
  return this.save();
};

roomSchema.methods.endSession = function() {
  this.status = 'ended';
  this.participants.forEach(p => {
    if (p.isOnline) {
      p.isOnline = false;
      p.leftAt = new Date();
    }
  });
  
  return this.save();
};

// Static methods
roomSchema.statics.generateRoomId = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

roomSchema.statics.findActiveRooms = function(page = 1, limit = 20) {
  return this.find({ 
    status: { $in: ['waiting', 'active'] }, 
    isActive: true,
    type: { $in: ['public', 'practice'] }
  })
  .populate('hostId', 'username profile.firstName profile.lastName')
  .select('roomId name description type currentParticipantCount settings.maxParticipants tags createdAt')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip((page - 1) * limit);
};

roomSchema.statics.findUserRooms = function(userId, includeEnded = false) {
  const statusFilter = includeEnded 
    ? { $in: ['waiting', 'active', 'ended'] }
    : { $in: ['waiting', 'active'] };
    
  return this.find({
    'participants.userId': userId,
    status: statusFilter,
    isActive: true
  })
  .populate('hostId', 'username profile.firstName profile.lastName')
  .sort({ updatedAt: -1 });
};

module.exports = mongoose.model('Room', roomSchema);