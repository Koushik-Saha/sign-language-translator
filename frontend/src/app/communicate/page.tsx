'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCommunication } from '../../context/CommunicationContext';
import AuthModal from '../../components/auth/AuthModal';
import RoomBrowser from '../../components/communication/RoomBrowser';
import VideoCall from '../../components/communication/VideoCall';

export default function CommunicatePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { joinRoom, currentRoom, isConnected } = useCommunication();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleJoinRoom = async (roomId: string) => {
    setIsJoining(true);
    setJoinError('');

    try {
      const success = await joinRoom(roomId);
      if (!success) {
        setJoinError('Failed to join room. Please try again.');
      }
    } catch (error) {
      console.error('Join room error:', error);
      setJoinError('An error occurred while joining the room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveRoom = () => {
    // Room leave is handled by the VideoCall component
    // This is just a callback for additional cleanup if needed
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none"  viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-2-4h4m-4 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join the Conversation</h1>
            <p className="text-gray-600">
              Connect with others in real-time video calls with live sign language translation and gesture recognition.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-sm text-gray-700">Real-time video calls with translation overlay</span>
            </div>
            <div className="flex items-center text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-sm text-gray-700">Live gesture recognition and feedback</span>
            </div>
            <div className="flex items-center text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-sm text-gray-700">Multi-user rooms with chat integration</span>
            </div>
            <div className="flex items-center text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-sm text-gray-700">Screen sharing with maintained translation</span>
            </div>
          </div>

          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors mb-4"
          >
            Get Started - Join Now!
          </button>

          <p className="text-xs text-gray-500">
            Already have an account?{' '}
            <button 
              onClick={() => setShowAuthModal(true)}
              className="text-purple-600 hover:text-purple-800"
            >
              Sign in
            </button>
          </p>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="register"
        />
      </div>
    );
  }

  // Show connection status if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse w-16 h-16 bg-blue-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting to Server</h2>
          <p className="text-gray-600">Please wait while we establish the connection...</p>
        </div>
      </div>
    );
  }

  // Show video call if user is in a room
  if (currentRoom) {
    return <VideoCall roomId={currentRoom.roomId} onLeave={handleLeaveRoom} />;
  }

  // Show room browser
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Error message */}
      {joinError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mx-6 mt-6 rounded">
          {joinError}
          <button
            onClick={() => setJoinError('')}
            className="float-right text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {isJoining && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700">Joining room...</p>
          </div>
        </div>
      )}

      <RoomBrowser onJoinRoom={handleJoinRoom} />
    </div>
  );
}
