const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');

class SocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.connectedUsers = new Map(); // socketId -> user info
    this.userSockets = new Map(); // userId -> Set of socketIds
    this.roomSockets = new Map(); // roomId -> Set of socketIds

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user || !user.isActive) {
          return next(new Error('Invalid token or user not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.username} connected:`, socket.id);
      
      // Store user connection
      this.connectedUsers.set(socket.id, {
        userId: socket.userId,
        username: socket.user.username,
        socketId: socket.id,
        connectedAt: new Date()
      });

      // Add to user sockets map
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // Handle room events
      this.handleRoomEvents(socket);
      
      // Handle WebRTC signaling
      this.handleWebRTCEvents(socket);
      
      // Handle chat events
      this.handleChatEvents(socket);
      
      // Handle gesture recognition events
      this.handleGestureEvents(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  handleRoomEvents(socket) {
    // Join room
    socket.on('room:join', async (data) => {
      try {
        const { roomId, peerId } = data;
        
        const room = await Room.findOne({ 
          roomId: roomId.toUpperCase(),
          isActive: true 
        }).populate('participants.userId', 'username profile.firstName profile.lastName');

        if (!room) {
          socket.emit('room:error', { message: 'Room not found' });
          return;
        }

        // Check room capacity
        if (room.activeParticipants.length >= room.settings.maxParticipants) {
          socket.emit('room:error', { message: 'Room is full' });
          return;
        }

        // Join socket room
        socket.join(roomId.toUpperCase());
        
        // Add to room sockets map
        if (!this.roomSockets.has(roomId.toUpperCase())) {
          this.roomSockets.set(roomId.toUpperCase(), new Set());
        }
        this.roomSockets.get(roomId.toUpperCase()).add(socket.id);

        // Update room in database
        await room.addParticipant(socket.user, {
          socketId: socket.id,
          peerId: peerId,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent']
        });

        // Notify other participants
        socket.to(roomId.toUpperCase()).emit('room:user-joined', {
          userId: socket.userId,
          username: socket.user.username,
          peerId: peerId,
          profile: socket.user.profile
        });

        // Send room state to new user
        const updatedRoom = await Room.findOne({ roomId: roomId.toUpperCase() })
          .populate('participants.userId', 'username profile.firstName profile.lastName profile.avatar');
        
        socket.emit('room:joined', {
          room: updatedRoom,
          participants: updatedRoom.activeParticipants,
          messages: updatedRoom.messages.slice(-50) // Last 50 messages
        });

        console.log(`User ${socket.user.username} joined room ${roomId}`);
      } catch (error) {
        console.error('Room join error:', error);
        socket.emit('room:error', { message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('room:leave', async (data) => {
      try {
        const { roomId } = data;
        await this.leaveRoom(socket, roomId);
      } catch (error) {
        console.error('Room leave error:', error);
        socket.emit('room:error', { message: 'Failed to leave room' });
      }
    });

    // Update media state
    socket.on('room:media-state', async (data) => {
      try {
        const { roomId, mediaState } = data;
        
        const room = await Room.findOne({ roomId: roomId.toUpperCase() });
        if (room) {
          await room.updateParticipantMedia(socket.userId, mediaState);
          
          // Broadcast media state change to other participants
          socket.to(roomId.toUpperCase()).emit('room:user-media-changed', {
            userId: socket.userId,
            mediaState
          });
        }
      } catch (error) {
        console.error('Media state update error:', error);
      }
    });
  }

  handleWebRTCEvents(socket) {
    // WebRTC signaling events
    socket.on('webrtc:offer', (data) => {
      const { to, offer, roomId } = data;
      const targetSockets = this.userSockets.get(to);
      
      if (targetSockets) {
        targetSockets.forEach(targetSocketId => {
          this.io.to(targetSocketId).emit('webrtc:offer', {
            from: socket.userId,
            offer,
            roomId
          });
        });
      }
    });

    socket.on('webrtc:answer', (data) => {
      const { to, answer, roomId } = data;
      const targetSockets = this.userSockets.get(to);
      
      if (targetSockets) {
        targetSockets.forEach(targetSocketId => {
          this.io.to(targetSocketId).emit('webrtc:answer', {
            from: socket.userId,
            answer,
            roomId
          });
        });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const { to, candidate, roomId } = data;
      const targetSockets = this.userSockets.get(to);
      
      if (targetSockets) {
        targetSockets.forEach(targetSocketId => {
          this.io.to(targetSocketId).emit('webrtc:ice-candidate', {
            from: socket.userId,
            candidate,
            roomId
          });
        });
      }
    });

    // Screen sharing events
    socket.on('screen:start-sharing', (data) => {
      const { roomId } = data;
      socket.to(roomId.toUpperCase()).emit('screen:user-started-sharing', {
        userId: socket.userId,
        username: socket.user.username
      });
    });

    socket.on('screen:stop-sharing', (data) => {
      const { roomId } = data;
      socket.to(roomId.toUpperCase()).emit('screen:user-stopped-sharing', {
        userId: socket.userId
      });
    });
  }

  handleChatEvents(socket) {
    // Send message
    socket.on('chat:message', async (data) => {
      try {
        const { roomId, type, content, replyTo } = data;
        
        const room = await Room.findOne({ roomId: roomId.toUpperCase() });
        if (!room) return;

        // Check permissions
        const participant = room.participants.find(p => 
          p.userId.toString() === socket.userId && p.isOnline
        );
        
        if (!participant || !participant.permissions.canChat) {
          socket.emit('chat:error', { message: 'No permission to send messages' });
          return;
        }

        const messageData = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          senderId: socket.userId,
          senderName: socket.user.username,
          type,
          content,
          replyTo,
          timestamp: new Date(),
          metadata: {
            deviceType: data.deviceType || 'unknown',
            translationModel: data.translationModel,
            processingTime: data.processingTime
          }
        };

        await room.addMessage(messageData);

        // Broadcast message to all room participants
        this.io.to(roomId.toUpperCase()).emit('chat:message', messageData);

        console.log(`Message sent in room ${roomId} by ${socket.user.username}`);
      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('chat:typing-start', (data) => {
      const { roomId } = data;
      socket.to(roomId.toUpperCase()).emit('chat:user-typing', {
        userId: socket.userId,
        username: socket.user.username
      });
    });

    socket.on('chat:typing-stop', (data) => {
      const { roomId } = data;
      socket.to(roomId.toUpperCase()).emit('chat:user-stopped-typing', {
        userId: socket.userId
      });
    });

    // Message reactions
    socket.on('chat:reaction', async (data) => {
      try {
        const { roomId, messageId, emoji } = data;
        
        // Broadcast reaction to room
        socket.to(roomId.toUpperCase()).emit('chat:message-reaction', {
          messageId,
          userId: socket.userId,
          username: socket.user.username,
          emoji
        });
      } catch (error) {
        console.error('Message reaction error:', error);
      }
    });
  }

  handleGestureEvents(socket) {
    // Real-time gesture recognition
    socket.on('gesture:recognize', async (data) => {
      try {
        const { roomId, gestureData, targetGesture } = data;
        
        // Process gesture recognition (integrate with ML pipeline)
        const recognition = await this.processGestureRecognition(gestureData, targetGesture);
        
        // Send recognition result back to user
        socket.emit('gesture:recognition-result', {
          ...recognition,
          timestamp: new Date()
        });

        // If in a room and settings allow, broadcast to other participants
        if (roomId) {
          const room = await Room.findOne({ roomId: roomId.toUpperCase() });
          if (room && room.settings.gestureRecognition) {
            socket.to(roomId.toUpperCase()).emit('gesture:user-gesture', {
              userId: socket.userId,
              username: socket.user.username,
              gesture: recognition.predictedGesture,
              confidence: recognition.confidence
            });
          }
        }
      } catch (error) {
        console.error('Gesture recognition error:', error);
        socket.emit('gesture:error', { message: 'Failed to process gesture' });
      }
    });

    // Gesture practice session
    socket.on('gesture:practice-start', (data) => {
      const { roomId, gestureList } = data;
      if (roomId) {
        socket.to(roomId.toUpperCase()).emit('gesture:practice-started', {
          userId: socket.userId,
          username: socket.user.username,
          gestureList
        });
      }
    });

    socket.on('gesture:practice-result', (data) => {
      const { roomId, results } = data;
      if (roomId) {
        socket.to(roomId.toUpperCase()).emit('gesture:practice-completed', {
          userId: socket.userId,
          username: socket.user.username,
          results
        });
      }
    });
  }

  async processGestureRecognition(gestureData, targetGesture) {
    // Placeholder for ML model integration
    // In production, this would interface with your trained models
    
    const mockPredictions = ['A', 'B', 'C', 'HELLO', 'THANK', 'PLEASE'];
    const predictedGesture = mockPredictions[Math.floor(Math.random() * mockPredictions.length)];
    const confidence = Math.random() * 0.4 + 0.6; // 0.6 to 1.0
    
    const isCorrect = targetGesture ? 
      predictedGesture.toUpperCase() === targetGesture.toUpperCase() : 
      true;
    
    return {
      predictedGesture,
      confidence,
      isCorrect,
      targetGesture,
      processingTime: Math.random() * 200 + 100, // 100-300ms
      alternatives: mockPredictions.slice(0, 3).filter(g => g !== predictedGesture)
    };
  }

  async leaveRoom(socket, roomId) {
    const roomIdUpper = roomId.toUpperCase();
    
    // Leave socket room
    socket.leave(roomIdUpper);
    
    // Remove from room sockets map
    if (this.roomSockets.has(roomIdUpper)) {
      this.roomSockets.get(roomIdUpper).delete(socket.id);
      if (this.roomSockets.get(roomIdUpper).size === 0) {
        this.roomSockets.delete(roomIdUpper);
      }
    }

    // Update room in database
    const room = await Room.findOne({ roomId: roomIdUpper });
    if (room) {
      await room.removeParticipant(socket.userId);
      
      // Notify other participants
      socket.to(roomIdUpper).emit('room:user-left', {
        userId: socket.userId,
        username: socket.user.username
      });

      // Handle host leaving
      if (room.hostId.toString() === socket.userId) {
        const remainingParticipants = room.activeParticipants;
        if (remainingParticipants.length > 0) {
          const newHost = remainingParticipants[0];
          room.hostId = newHost.userId;
          await room.updateParticipantRole(newHost.userId, 'host');
          await room.save();
          
          // Notify new host
          const newHostSockets = this.userSockets.get(newHost.userId.toString());
          if (newHostSockets) {
            newHostSockets.forEach(socketId => {
              this.io.to(socketId).emit('room:host-changed', {
                newHostId: newHost.userId,
                newHostName: newHost.username
              });
            });
          }
        } else {
          // No participants left, end the room
          await room.endSession();
        }
      }
    }

    console.log(`User ${socket.user.username} left room ${roomId}`);
  }

  handleDisconnect(socket) {
    console.log(`User ${socket.user.username} disconnected:`, socket.id);
    
    // Remove from connected users
    this.connectedUsers.delete(socket.id);
    
    // Remove from user sockets map
    if (this.userSockets.has(socket.userId)) {
      this.userSockets.get(socket.userId).delete(socket.id);
      if (this.userSockets.get(socket.userId).size === 0) {
        this.userSockets.delete(socket.userId);
      }
    }

    // Leave all rooms and update room states
    socket.rooms.forEach(async (roomId) => {
      if (roomId !== socket.id) { // Skip the default room (socket's own ID)
        try {
          await this.leaveRoom(socket, roomId);
        } catch (error) {
          console.error(`Error leaving room ${roomId} on disconnect:`, error);
        }
      }
    });
  }

  // Utility methods
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }

  getRoomParticipants(roomId) {
    const roomSockets = this.roomSockets.get(roomId.toUpperCase()) || new Set();
    return Array.from(roomSockets).map(socketId => this.connectedUsers.get(socketId)).filter(Boolean);
  }

  broadcastToRoom(roomId, event, data) {
    this.io.to(roomId.toUpperCase()).emit(event, data);
  }

  sendToUser(userId, event, data) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }
}

module.exports = SocketManager;