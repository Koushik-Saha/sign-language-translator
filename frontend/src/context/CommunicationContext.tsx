'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { useAuth } from './AuthContext';

interface Participant {
  userId: string;
  username: string;
  profile?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  role: 'host' | 'moderator' | 'participant' | 'observer';
  mediaState: {
    video: boolean;
    audio: boolean;
    screenShare: boolean;
  };
  peerId?: string;
}

interface Room {
  roomId: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'practice' | 'classroom' | 'meeting';
  hostId: string;
  participants: Participant[];
  settings: {
    maxParticipants: number;
    requireApproval: boolean;
    autoTranslation: boolean;
    chatEnabled: boolean;
    gestureRecognition: boolean;
  };
  statistics: {
    totalParticipants: number;
    totalMessages: number;
    totalGestures: number;
  };
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'sign_to_text' | 'gesture' | 'system';
  content: {
    text?: string;
    originalGesture?: string;
    translatedText?: string;
    confidence?: number;
    gestureData?: {
      videoUrl?: string;
      duration?: number;
    };
  };
  timestamp: Date;
  replyTo?: string;
  reactions?: Array<{
    userId: string;
    emoji: string;
  }>;
}

interface PeerConnection {
  userId: string;
  peer: SimplePeer.Instance;
  stream?: MediaStream;
}

interface CommunicationContextType {
  // Socket connection
  socket: Socket | null;
  isConnected: boolean;
  
  // Room management
  currentRoom: Room | null;
  participants: Participant[];
  joinRoom: (roomId: string, peerId?: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  createRoom: (roomData: Partial<Room>) => Promise<string | null>;
  
  // Chat
  messages: Message[];
  sendMessage: (type: Message['type'], content: any, replyTo?: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  typingUsers: string[];
  
  // WebRTC
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  peerConnections: Map<string, PeerConnection>;
  startVideo: () => Promise<boolean>;
  stopVideo: () => void;
  startAudio: () => Promise<boolean>;
  stopAudio: () => void;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => void;
  mediaState: {
    video: boolean;
    audio: boolean;
    screenShare: boolean;
  };
  
  // Gesture recognition
  sendGestureForRecognition: (gestureData: any, targetGesture?: string) => void;
  gestureRecognitionResult: any;
  
  // Room discovery
  publicRooms: Room[];
  loadPublicRooms: (filters?: any) => Promise<void>;
  searchRooms: (query: string) => Promise<void>;
}

const CommunicationContext = createContext<CommunicationContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function CommunicationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Room state
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  
  // Chat state
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerConnections, setPeerConnections] = useState<Map<string, PeerConnection>>(new Map());
  const [mediaState, setMediaState] = useState({
    video: false,
    audio: false,
    screenShare: false
  });
  
  // Gesture recognition
  const [gestureRecognitionResult, setGestureRecognitionResult] = useState<any>(null);

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      const newSocket = io(API_BASE_URL, {
        auth: {
          token: localStorage.getItem('accessToken')
        },
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      // Room events
      setupRoomEventListeners(newSocket);
      
      // Chat events
      setupChatEventListeners(newSocket);
      
      // WebRTC events
      setupWebRTCEventListeners(newSocket);
      
      // Gesture events
      setupGestureEventListeners(newSocket);

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, user]);

  const setupRoomEventListeners = (socket: Socket) => {
    socket.on('room:joined', (data) => {
      console.log('Joined room:', data);
      setCurrentRoom(data.room);
      setParticipants(data.participants);
      setMessages(data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })));
    });

    socket.on('room:user-joined', (data) => {
      console.log('User joined:', data);
      setParticipants(prev => [...prev, data]);
    });

    socket.on('room:user-left', (data) => {
      console.log('User left:', data);
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      
      // Remove peer connection
      setPeerConnections(prev => {
        const newConnections = new Map(prev);
        const connection = newConnections.get(data.userId);
        if (connection) {
          connection.peer.destroy();
          newConnections.delete(data.userId);
        }
        return newConnections;
      });
      
      // Remove remote stream
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(data.userId);
        return newStreams;
      });
    });

    socket.on('room:user-media-changed', (data) => {
      setParticipants(prev => 
        prev.map(p => 
          p.userId === data.userId 
            ? { ...p, mediaState: { ...p.mediaState, ...data.mediaState } }
            : p
        )
      );
    });

    socket.on('room:host-changed', (data) => {
      console.log('Host changed:', data);
      if (currentRoom) {
        setCurrentRoom(prev => prev ? { ...prev, hostId: data.newHostId } : null);
      }
    });

    socket.on('room:error', (data) => {
      console.error('Room error:', data);
      // Handle room errors (show notification, etc.)
    });
  };

  const setupChatEventListeners = (socket: Socket) => {
    socket.on('chat:message', (message) => {
      setMessages(prev => [...prev, {
        ...message,
        timestamp: new Date(message.timestamp)
      }]);
    });

    socket.on('chat:user-typing', (data) => {
      setTypingUsers(prev => [...prev.filter(u => u !== data.username), data.username]);
    });

    socket.on('chat:user-stopped-typing', (data) => {
      setTypingUsers(prev => prev.filter(u => u !== data.username));
    });

    socket.on('chat:message-reaction', (data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? {
                ...msg,
                reactions: [
                  ...(msg.reactions || []).filter(r => r.userId !== data.userId),
                  { userId: data.userId, emoji: data.emoji }
                ]
              }
            : msg
        )
      );
    });

    socket.on('chat:error', (data) => {
      console.error('Chat error:', data);
    });
  };

  const setupWebRTCEventListeners = (socket: Socket) => {
    socket.on('webrtc:offer', async (data) => {
      console.log('Received offer from:', data.from);
      await handleOffer(data.from, data.offer);
    });

    socket.on('webrtc:answer', async (data) => {
      console.log('Received answer from:', data.from);
      await handleAnswer(data.from, data.answer);
    });

    socket.on('webrtc:ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.from);
      await handleIceCandidate(data.from, data.candidate);
    });

    socket.on('screen:user-started-sharing', (data) => {
      console.log('User started screen sharing:', data);
    });

    socket.on('screen:user-stopped-sharing', (data) => {
      console.log('User stopped screen sharing:', data);
    });
  };

  const setupGestureEventListeners = (socket: Socket) => {
    socket.on('gesture:recognition-result', (result) => {
      console.log('Gesture recognition result:', result);
      setGestureRecognitionResult(result);
    });

    socket.on('gesture:user-gesture', (data) => {
      console.log('User gesture:', data);
      // Handle other users' gestures
    });

    socket.on('gesture:practice-started', (data) => {
      console.log('Practice started:', data);
    });

    socket.on('gesture:practice-completed', (data) => {
      console.log('Practice completed:', data);
    });

    socket.on('gesture:error', (data) => {
      console.error('Gesture error:', data);
    });
  };

  // Room management functions
  const joinRoom = async (roomId: string, peerId?: string): Promise<boolean> => {
    if (!socket || !isConnected) return false;

    try {
      socket.emit('room:join', { roomId, peerId });
      return true;
    } catch (error) {
      console.error('Failed to join room:', error);
      return false;
    }
  };

  const leaveRoom = async (): Promise<void> => {
    if (!socket || !currentRoom) return;

    try {
      socket.emit('room:leave', { roomId: currentRoom.roomId });
      
      // Clean up local state
      setCurrentRoom(null);
      setParticipants([]);
      setMessages([]);
      
      // Clean up WebRTC connections
      peerConnections.forEach(connection => {
        connection.peer.destroy();
      });
      setPeerConnections(new Map());
      setRemoteStreams(new Map());
      
      // Stop local streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      setMediaState({ video: false, audio: false, screenShare: false });
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  };

  const createRoom = async (roomData: Partial<Room>): Promise<string | null> => {
    if (!isAuthenticated) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/communication/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          ...roomData,
          socketId: socket?.id
        })
      });

      const data = await response.json();
      if (data.success) {
        return data.data.room.roomId;
      }
      return null;
    } catch (error) {
      console.error('Failed to create room:', error);
      return null;
    }
  };

  // Chat functions
  const sendMessage = (type: Message['type'], content: any, replyTo?: string) => {
    if (!socket || !currentRoom) return;

    socket.emit('chat:message', {
      roomId: currentRoom.roomId,
      type,
      content,
      replyTo,
      deviceType: 'web'
    });
  };

  const setIsTypingWrapper = (typing: boolean) => {
    if (!socket || !currentRoom) return;

    setIsTyping(typing);

    if (typing) {
      socket.emit('chat:typing-start', { roomId: currentRoom.roomId });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingWrapper(false);
      }, 3000);
    } else {
      socket.emit('chat:typing-stop', { roomId: currentRoom.roomId });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // WebRTC functions
  const startVideo = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: mediaState.audio 
      });
      
      setLocalStream(stream);
      setMediaState(prev => ({ ...prev, video: true }));
      
      if (socket && currentRoom) {
        socket.emit('room:media-state', {
          roomId: currentRoom.roomId,
          mediaState: { ...mediaState, video: true }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to start video:', error);
      return false;
    }
  };

  const stopVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.stop());
    }
    
    setMediaState(prev => ({ ...prev, video: false }));
    
    if (socket && currentRoom) {
      socket.emit('room:media-state', {
        roomId: currentRoom.roomId,
        mediaState: { ...mediaState, video: false }
      });
    }
  };

  const startAudio = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: mediaState.video, 
        audio: true 
      });
      
      setLocalStream(stream);
      setMediaState(prev => ({ ...prev, audio: true }));
      
      if (socket && currentRoom) {
        socket.emit('room:media-state', {
          roomId: currentRoom.roomId,
          mediaState: { ...mediaState, audio: true }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to start audio:', error);
      return false;
    }
  };

  const stopAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.stop());
    }
    
    setMediaState(prev => ({ ...prev, audio: false }));
    
    if (socket && currentRoom) {
      socket.emit('room:media-state', {
        roomId: currentRoom.roomId,
        mediaState: { ...mediaState, audio: false }
      });
    }
  };

  const startScreenShare = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      
      setMediaState(prev => ({ ...prev, screenShare: true }));
      
      if (socket && currentRoom) {
        socket.emit('screen:start-sharing', { roomId: currentRoom.roomId });
        socket.emit('room:media-state', {
          roomId: currentRoom.roomId,
          mediaState: { ...mediaState, screenShare: true }
        });
      }
      
      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      return true;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      return false;
    }
  };

  const stopScreenShare = () => {
    setMediaState(prev => ({ ...prev, screenShare: false }));
    
    if (socket && currentRoom) {
      socket.emit('screen:stop-sharing', { roomId: currentRoom.roomId });
      socket.emit('room:media-state', {
        roomId: currentRoom.roomId,
        mediaState: { ...mediaState, screenShare: false }
      });
    }
  };

  // WebRTC signaling handlers
  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    // Implementation for handling WebRTC offers
    // This is a simplified version - in production you'd handle this more robustly
  };

  const handleAnswer = async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    // Implementation for handling WebRTC answers
  };

  const handleIceCandidate = async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    // Implementation for handling ICE candidates
  };

  // Room discovery functions
  const loadPublicRooms = async (filters?: any): Promise<void> => {
    try {
      const params = new URLSearchParams(filters || {});
      const response = await fetch(`${API_BASE_URL}/api/communication/rooms/public?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPublicRooms(data.data.rooms);
      }
    } catch (error) {
      console.error('Failed to load public rooms:', error);
    }
  };

  const searchRooms = async (query: string): Promise<void> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/communication/rooms/public?search=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      if (data.success) {
        setPublicRooms(data.data.rooms);
      }
    } catch (error) {
      console.error('Failed to search rooms:', error);
    }
  };

  // Gesture recognition
  const sendGestureForRecognition = (gestureData: any, targetGesture?: string) => {
    if (!socket) return;

    socket.emit('gesture:recognize', {
      roomId: currentRoom?.roomId,
      gestureData,
      targetGesture
    });
  };

  const value: CommunicationContextType = {
    socket,
    isConnected,
    currentRoom,
    participants,
    joinRoom,
    leaveRoom,
    createRoom,
    messages,
    sendMessage,
    isTyping,
    setIsTyping: setIsTypingWrapper,
    typingUsers,
    localStream,
    remoteStreams,
    peerConnections,
    startVideo,
    stopVideo,
    startAudio,
    stopAudio,
    startScreenShare,
    stopScreenShare,
    mediaState,
    sendGestureForRecognition,
    gestureRecognitionResult,
    publicRooms,
    loadPublicRooms,
    searchRooms
  };

  return (
    <CommunicationContext.Provider value={value}>
      {children}
    </CommunicationContext.Provider>
  );
}

export function useCommunication() {
  const context = useContext(CommunicationContext);
  if (context === undefined) {
    throw new Error('useCommunication must be used within a CommunicationProvider');
  }
  return context;
}