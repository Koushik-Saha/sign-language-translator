'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCommunication } from '../../context/CommunicationContext';
import { useAuth } from '../../context/AuthContext';

interface VideoCallProps {
  roomId?: string;
  onLeave?: () => void;
}

export default function VideoCall({ onLeave }: VideoCallProps) {
  const { user } = useAuth();
  const {
    currentRoom,
    participants,
    localStream,
    remoteStreams,
    mediaState,
    startVideo,
    stopVideo,
    startAudio,
    stopAudio,
    startScreenShare,
    stopScreenShare,
    leaveRoom,
    messages,
    sendMessage,
    isTyping,
    setIsTyping,
    typingUsers,
    sendGestureForRecognition,
    gestureRecognitionResult
  } = useCommunication();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteVideoRefs, setRemoteVideoRefs] = useState<Map<string, HTMLVideoElement>>(new Map());
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isRecognizingGesture, setIsRecognizingGesture] = useState(false);
  const [gestureTarget, setGestureTarget] = useState('');

  // Set up local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote video streams
  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      const videoElement = remoteVideoRefs.get(userId);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams, remoteVideoRefs]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessage('text', { text: chatMessage.trim() });
      setChatMessage('');
      setIsTyping(false);
    }
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatMessage(e.target.value);
    
    if (e.target.value.length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (e.target.value.length === 0 && isTyping) {
      setIsTyping(false);
    }
  };

  const handleLeave = async () => {
    await leaveRoom();
    onLeave?.();
  };

  const toggleVideo = async () => {
    if (mediaState.video) {
      stopVideo();
    } else {
      await startVideo();
    }
  };

  const toggleAudio = async () => {
    if (mediaState.audio) {
      stopAudio();
    } else {
      await startAudio();
    }
  };

  const toggleScreenShare = async () => {
    if (mediaState.screenShare) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const startGestureRecognition = () => {
    if (!localStream) return;

    setIsRecognizingGesture(true);
    
    // Capture frame from video for gesture recognition
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (localVideoRef.current && ctx) {
      canvas.width = localVideoRef.current.videoWidth;
      canvas.height = localVideoRef.current.videoHeight;
      ctx.drawImage(localVideoRef.current, 0, 0);
      
      // Convert to gesture data (simplified - in production you'd extract landmarks)
      const gestureData = {
        image: canvas.toDataURL(),
        timestamp: Date.now(),
        resolution: {
          width: canvas.width,
          height: canvas.height
        }
      };

      sendGestureForRecognition(gestureData, gestureTarget || undefined);
    }

    setTimeout(() => setIsRecognizingGesture(false), 2000);
  };

  const renderParticipantVideo = (participant: any) => {
    const isCurrentUser = participant.userId === user?._id;
    const stream = isCurrentUser ? localStream : remoteStreams.get(participant.userId);
    
    return (
      <div 
        key={participant.userId}
        className={`relative bg-gray-900 rounded-lg overflow-hidden ${
          participants.length === 1 ? 'col-span-2' : 
          participants.length <= 2 ? 'aspect-video' : 
          'aspect-square'
        }`}
      >
        <video
          ref={(el) => {
            if (el) {
              if (isCurrentUser) {
                localVideoRef.current = el;
              } else {
                setRemoteVideoRefs(prev => new Map(prev.set(participant.userId, el)));
              }
              
              if (stream) {
                el.srcObject = stream;
              }
            }
          }}
          autoPlay
          playsInline
          muted={isCurrentUser}
          className="w-full h-full object-cover"
        />
        
        {/* Participant info overlay */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
          {isCurrentUser ? 'You' : participant.username}
          {participant.role === 'host' && (
            <span className="ml-1 text-yellow-400">👑</span>
          )}
        </div>

        {/* Media state indicators */}
        <div className="absolute top-2 right-2 flex space-x-1">
          {!participant.mediaState.video && (
            <div className="bg-red-500 p-1 rounded">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0017 14V6a2 2 0 00-2-2h-5.586l-.707-.707A1 1 0 008 3H4a2 2 0 00-2 2v6c0 .553.225 1.053.586 1.414L3.707 2.293zM4 9V5h2.586L9 7.414V9H4z"/>
              </svg>
            </div>
          )}
          {!participant.mediaState.audio && (
            <div className="bg-red-500 p-1 rounded">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </div>
          )}
          {participant.mediaState.screenShare && (
            <div className="bg-blue-500 p-1 rounded">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm12 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
            </div>
          )}
        </div>

        {/* Translation overlay */}
        {gestureRecognitionResult && isCurrentUser && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg">
            <div className="text-center">
              <div className="font-bold">{gestureRecognitionResult.predictedGesture}</div>
              <div className="text-sm opacity-75">
                {Math.round(gestureRecognitionResult.confidence * 100)}% confident
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!currentRoom) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main video area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{currentRoom.name}</h1>
            <p className="text-sm text-gray-300">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Room controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className="relative bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
              </svg>
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {messages.length > 9 ? '9+' : messages.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 p-4">
          <div className={`grid gap-4 h-full ${
            participants.length === 1 ? 'grid-cols-1' :
            participants.length === 2 ? 'grid-cols-2' :
            participants.length <= 4 ? 'grid-cols-2 grid-rows-2' :
            'grid-cols-3 grid-rows-2'
          }`}>
            {participants.map(renderParticipantVideo)}
          </div>
        </div>

        {/* Control bar */}
        <div className="bg-gray-800 p-4 flex items-center justify-center space-x-4">
          {/* Audio toggle */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${
              mediaState.audio 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } text-white`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              {mediaState.audio ? (
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
              ) : (
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              )}
            </svg>
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${
              mediaState.video 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } text-white`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              {mediaState.video ? (
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
              ) : (
                <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0017 14V6a2 2 0 00-2-2h-5.586l-.707-.707A1 1 0 008 3H4a2 2 0 00-2 2v6c0 .553.225 1.053.586 1.414L3.707 2.293zM4 9V5h2.586L9 7.414V9H4z"/>
              )}
            </svg>
          </button>

          {/* Screen share toggle */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full ${
              mediaState.screenShare 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm12 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
          </button>

          {/* Gesture recognition */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Target gesture (optional)"
              value={gestureTarget}
              onChange={(e) => setGestureTarget(e.target.value)}
              className="px-3 py-1 rounded bg-gray-700 text-white text-sm"
            />
            <button
              onClick={startGestureRecognition}
              disabled={isRecognizingGesture || !mediaState.video}
              className={`p-3 rounded-full ${
                isRecognizingGesture 
                  ? 'bg-yellow-600' 
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white disabled:opacity-50`}
            >
              {isRecognizingGesture ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
              ) : (
                <span className="text-lg">🤟</span>
              )}
            </button>
          </div>

          {/* Leave button */}
          <button
            onClick={handleLeave}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white ml-8"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Chat sidebar */}
      {showChat && (
        <div className="w-80 bg-white border-l border-gray-300 flex flex-col">
          {/* Chat header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span className="font-medium">{message.senderName}</span>
                  <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1">
                  {message.type === 'text' && (
                    <p className="text-sm">{message.content.text}</p>
                  )}
                  {message.type === 'sign_to_text' && (
                    <div className="bg-blue-50 p-2 rounded text-sm">
                      <div className="font-medium text-blue-800">
                        Gesture: {message.content.originalGesture}
                      </div>
                      <div className="text-blue-600">
                        Translation: {message.content.translatedText}
                      </div>
                      {message.content.confidence && (
                        <div className="text-xs text-blue-500">
                          Confidence: {Math.round(message.content.confidence * 100)}%
                        </div>
                      )}
                    </div>
                  )}
                  {message.type === 'system' && (
                    <p className="text-xs text-gray-500 italic">{message.content.text}</p>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing indicators */}
            {typingUsers.length > 0 && (
              <div className="text-xs text-gray-500 italic">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={handleChatInputChange}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!chatMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}