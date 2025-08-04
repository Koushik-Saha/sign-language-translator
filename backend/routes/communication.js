const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

// Get public rooms
router.get('/rooms/public', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, search } = req.query;
    
    let filter = { 
      status: { $in: ['waiting', 'active'] }, 
      isActive: true,
      type: { $in: ['public', 'practice'] }
    };
    
    if (type && ['public', 'practice', 'classroom'].includes(type)) {
      filter.type = type;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    const rooms = await Room.find(filter)
      .populate('hostId', 'username profile.firstName profile.lastName')
      .select('roomId name description type participants settings.maxParticipants tags createdAt statistics.totalParticipants')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Room.countDocuments(filter);
    
    // Add current participant count to each room
    const roomsWithCounts = rooms.map(room => ({
      ...room.toJSON(),
      currentParticipants: room.activeParticipants.length
    }));
    
    res.json({
      success: true,
      data: {
        rooms: roomsWithCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('Get public rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching public rooms'
    });
  }
});

// Create new room
router.post('/rooms', auth, [
  body('name').notEmpty().withMessage('Room name is required').trim(),
  body('description').optional().trim(),
  body('type').isIn(['public', 'private', 'practice', 'classroom', 'meeting']).withMessage('Invalid room type'),
  body('maxParticipants').optional().isInt({ min: 2, max: 100 }).withMessage('Max participants must be 2-100'),
  body('requireApproval').optional().isBoolean(),
  body('autoTranslation').optional().isBoolean(),
  body('tags').optional().isArray()
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
    
    const roomId = Room.generateRoomId();
    
    const roomData = {
      roomId,
      name: req.body.name,
      description: req.body.description || '',
      type: req.body.type || 'public',
      hostId: req.user._id,
      createdBy: req.user._id,
      settings: {
        maxParticipants: req.body.maxParticipants || 10,
        requireApproval: req.body.requireApproval || false,
        autoTranslation: req.body.autoTranslation !== false,
        chatEnabled: req.body.chatEnabled !== false,
        gestureRecognition: req.body.gestureRecognition !== false
      },
      tags: req.body.tags || []
    };
    
    const room = new Room(roomData);
    await room.save();
    
    // Add creator as host participant
    await room.addParticipant(req.user, {
      socketId: req.body.socketId
    });
    
    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: { room }
    });
    
  } catch (error) {
    console.error('Create room error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Room ID already exists, please try again'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating room'
    });
  }
});

// Get room details
router.get('/rooms/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    })
    .populate('hostId', 'username profile.firstName profile.lastName')
    .populate('participants.userId', 'username profile.firstName profile.lastName profile.avatar');
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user has permission to access private room
    if (room.type === 'private') {
      const isParticipant = room.participants.some(p => 
        p.userId._id.toString() === req.user._id.toString()
      );
      const isHost = room.hostId._id.toString() === req.user._id.toString();
      
      if (!isParticipant && !isHost) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to private room'
        });
      }
    }
    
    res.json({
      success: true,
      data: { room }
    });
    
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching room details'
    });
  }
});

// Join room
router.post('/rooms/:roomId/join', auth, [
  body('socketId').optional().isString(),
  body('peerId').optional().isString()
], async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check room capacity
    if (room.activeParticipants.length >= room.settings.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Room is full'
      });
    }
    
    // Check if room requires approval and user is not approved
    if (room.settings.requireApproval && room.type === 'private') {
      const existingParticipant = room.participants.find(p => 
        p.userId.toString() === req.user._id.toString()
      );
      
      if (!existingParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Room requires approval to join'
        });
      }
    }
    
    const connectionInfo = {
      socketId: req.body.socketId,
      peerId: req.body.peerId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    await room.addParticipant(req.user, connectionInfo);
    
    // Update room status to active if it was waiting
    if (room.status === 'waiting') {
      room.status = 'active';
      await room.save();
    }
    
    res.json({
      success: true,
      message: 'Joined room successfully',
      data: { 
        room: {
          roomId: room.roomId,
          name: room.name,
          participants: room.activeParticipants,
          settings: room.settings
        }
      }
    });
    
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining room'
    });
  }
});

// Leave room
router.post('/rooms/:roomId/leave', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    await room.removeParticipant(req.user._id);
    
    // If host leaves and there are other participants, transfer host role
    if (room.hostId.toString() === req.user._id.toString()) {
      const remainingParticipants = room.activeParticipants;
      if (remainingParticipants.length > 0) {
        const newHost = remainingParticipants[0];
        room.hostId = newHost.userId;
        await room.updateParticipantRole(newHost.userId, 'host');
      } else {
        // No participants left, end the room
        await room.endSession();
      }
      await room.save();
    }
    
    res.json({
      success: true,
      message: 'Left room successfully'
    });
    
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving room'
    });
  }
});

// Send message to room
router.post('/rooms/:roomId/messages', auth, [
  body('type').isIn(['text', 'sign_to_text', 'gesture', 'system']).withMessage('Invalid message type'),
  body('content').notEmpty().withMessage('Message content is required'),
  body('replyTo').optional().isString()
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
    
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user is a participant
    const participant = room.participants.find(p => 
      p.userId.toString() === req.user._id.toString() && p.isOnline
    );
    
    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this room'
      });
    }
    
    // Check if user has chat permissions
    if (!participant.permissions.canChat) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to send messages'
      });
    }
    
    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: req.user._id,
      senderName: req.user.username,
      type: req.body.type,
      content: req.body.content,
      replyTo: req.body.replyTo,
      metadata: {
        deviceType: req.body.deviceType || 'unknown',
        translationModel: req.body.translationModel,
        processingTime: req.body.processingTime
      }
    };
    
    await room.addMessage(messageData);
    
    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { messageId: messageData.id }
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message'
    });
  }
});

// Get room messages
router.get('/rooms/:roomId/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, before } = req.query;
    
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user is a participant
    const isParticipant = room.participants.some(p => 
      p.userId.toString() === req.user._id.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this room'
      });
    }
    
    let messages = room.messages;
    
    // Filter messages before a certain timestamp if provided
    if (before) {
      const beforeDate = new Date(before);
      messages = messages.filter(msg => msg.timestamp < beforeDate);
    }
    
    // Sort by timestamp (newest first) and paginate
    messages.sort((a, b) => b.timestamp - a.timestamp);
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedMessages = messages.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        messages: paginatedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: messages.length,
          hasMore: startIndex + parseInt(limit) < messages.length
        }
      }
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages'
    });
  }
});

// Update participant media state
router.put('/rooms/:roomId/participants/media', auth, [
  body('video').optional().isBoolean(),
  body('audio').optional().isBoolean(),
  body('screenShare').optional().isBoolean()
], async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    const mediaState = {};
    if (req.body.video !== undefined) mediaState.video = req.body.video;
    if (req.body.audio !== undefined) mediaState.audio = req.body.audio;
    if (req.body.screenShare !== undefined) mediaState.screenShare = req.body.screenShare;
    
    await room.updateParticipantMedia(req.user._id, mediaState);
    
    res.json({
      success: true,
      message: 'Media state updated successfully'
    });
    
  } catch (error) {
    console.error('Update media state error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating media state'
    });
  }
});

// Get user's rooms
router.get('/my-rooms', auth, async (req, res) => {
  try {
    const { includeEnded = false } = req.query;
    
    const rooms = await Room.findUserRooms(req.user._id, includeEnded === 'true');
    
    res.json({
      success: true,
      data: { rooms }
    });
    
  } catch (error) {
    console.error('Get user rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user rooms'
    });
  }
});

// Update room settings (host only)
router.put('/rooms/:roomId/settings', auth, [
  body('name').optional().trim(),
  body('description').optional().trim(),
  body('maxParticipants').optional().isInt({ min: 2, max: 100 }),
  body('requireApproval').optional().isBoolean(),
  body('autoTranslation').optional().isBoolean(),
  body('chatEnabled').optional().isBoolean(),
  body('gestureRecognition').optional().isBoolean()
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
    
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user is host
    if (room.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only room host can update settings'
      });
    }
    
    // Update basic room info
    if (req.body.name) room.name = req.body.name;
    if (req.body.description !== undefined) room.description = req.body.description;
    
    // Update settings
    const settingsUpdate = {};
    if (req.body.maxParticipants) settingsUpdate.maxParticipants = req.body.maxParticipants;
    if (req.body.requireApproval !== undefined) settingsUpdate.requireApproval = req.body.requireApproval;
    if (req.body.autoTranslation !== undefined) settingsUpdate.autoTranslation = req.body.autoTranslation;
    if (req.body.chatEnabled !== undefined) settingsUpdate.chatEnabled = req.body.chatEnabled;
    if (req.body.gestureRecognition !== undefined) settingsUpdate.gestureRecognition = req.body.gestureRecognition;
    
    Object.assign(room.settings, settingsUpdate);
    
    await room.save();
    
    res.json({
      success: true,
      message: 'Room settings updated successfully',
      data: { room }
    });
    
  } catch (error) {
    console.error('Update room settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating room settings'
    });
  }
});

// End room (host only)
router.post('/rooms/:roomId/end', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user is host
    if (room.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only room host can end the session'
      });
    }
    
    await room.endSession();
    
    res.json({
      success: true,
      message: 'Room session ended successfully'
    });
    
  } catch (error) {
    console.error('End room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending room session'
    });
  }
});

// Get room statistics
router.get('/rooms/:roomId/statistics', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomId: req.params.roomId.toUpperCase(),
      isActive: true 
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Check if user is host or moderator
    const participant = room.participants.find(p => 
      p.userId.toString() === req.user._id.toString()
    );
    
    if (!participant || !['host', 'moderator'].includes(participant.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const stats = {
      ...room.statistics,
      currentParticipants: room.activeParticipants.length,
      messagesByType: {},
      participantsByRole: {},
      sessionDuration: room.createdAt ? Date.now() - room.createdAt.getTime() : 0
    };
    
    // Calculate message statistics
    room.messages.forEach(msg => {
      stats.messagesByType[msg.type] = (stats.messagesByType[msg.type] || 0) + 1;
    });
    
    // Calculate participant statistics
    room.participants.forEach(p => {
      stats.participantsByRole[p.role] = (stats.participantsByRole[p.role] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: { statistics: stats }
    });
    
  } catch (error) {
    console.error('Get room statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching room statistics'
    });
  }
});

module.exports = router;