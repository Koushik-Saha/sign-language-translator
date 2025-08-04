'use client';

import React, { useEffect, useState } from 'react';
import { useCommunication } from '../../context/CommunicationContext';
import { useAuth } from '../../context/AuthContext';

interface RoomBrowserProps {
  onJoinRoom: (roomId: string) => void;
}

export default function RoomBrowser({ onJoinRoom }: RoomBrowserProps) {
  const { publicRooms, loadPublicRooms, searchRooms, createRoom } = useCommunication();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roomType, setRoomType] = useState<string>('all');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    description: '',
    type: 'public' as 'public' | 'private' | 'practice' | 'classroom',
    maxParticipants: 10,
    requireApproval: false,
    autoTranslation: true,
    gestureRecognition: true,
    tags: [] as string[]
  });
  const [newRoomTag, setNewRoomTag] = useState('');

  useEffect(() => {
    loadPublicRooms();
  }, [loadPublicRooms]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await searchRooms(searchQuery);
    } else {
      await loadPublicRooms();
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRoomData.name.trim()) return;

    try {
      const roomId = await createRoom(newRoomData);
      if (roomId) {
        setShowCreateRoom(false);
        setNewRoomData({
          name: '',
          description: '',
          type: 'public',
          maxParticipants: 10,
          requireApproval: false,
          autoTranslation: true,
          gestureRecognition: true,
          tags: []
        });
        onJoinRoom(roomId);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newRoomTag.trim()) {
      e.preventDefault();
      if (!newRoomData.tags.includes(newRoomTag.trim())) {
        setNewRoomData(prev => ({
          ...prev,
          tags: [...prev.tags, newRoomTag.trim()]
        }));
      }
      setNewRoomTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewRoomData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const getRoomTypeIcon = (type: string) => {
    switch (type) {
      case 'practice':
        return '🎯';
      case 'classroom':
        return '🎓';
      case 'meeting':
        return '💼';
      case 'private':
        return '🔒';
      default:
        return '🌐';
    }
  };

  const getRoomTypeColor = (type: string) => {
    switch (type) {
      case 'practice':
        return 'bg-green-100 text-green-800';
      case 'classroom':
        return 'bg-blue-100 text-blue-800';
      case 'meeting':
        return 'bg-purple-100 text-purple-800';
      case 'private':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRooms = publicRooms.filter(room => {
    if (roomType === 'all') return true;
    return room.type === roomType;
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Room Browser</h1>
          <p className="text-gray-600 mt-2">Join or create sign language communication rooms</p>
        </div>
        
        <button
          onClick={() => setShowCreateRoom(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          <span>Create Room</span>
        </button>
      </div>

      {/* Search and filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms by name, description, or tags..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRoomType('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              roomType === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Rooms
          </button>
          {['public', 'practice', 'classroom'].map(type => (
            <button
              key={type}
              onClick={() => setRoomType(type)}
              className={`px-4 py-2 rounded-lg transition-colors capitalize ${
                roomType === type 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {getRoomTypeIcon(type)} {type}
            </button>
          ))}
        </div>
      </div>

      {/* Room grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => (
          <div key={room.roomId} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold text-gray-900 truncate">
                  {room.name}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoomTypeColor(room.type)}`}>
                  {getRoomTypeIcon(room.type)} {room.type}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {room.description || 'No description available'}
              </p>

              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                  </svg>
                  {room.currentParticipants || 0}/{room.settings?.maxParticipants || 10}
                </span>
                
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                  </svg>
                  {new Date(room.createdAt).toLocaleDateString()}
                </span>
              </div>

              {room.tags && room.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {room.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                  {room.tags.length > 3 && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                      +{room.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  {room.settings?.autoTranslation && (
                    <span className="flex items-center">
                      <span className="text-green-500 mr-1">✓</span>
                      Translation
                    </span>
                  )}
                  {room.settings?.gestureRecognition && (
                    <span className="flex items-center">
                      <span className="text-green-500 mr-1">✓</span>
                      Gestures
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onJoinRoom(room.roomId)}
                  disabled={room.currentParticipants >= room.settings?.maxParticipants}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {room.currentParticipants >= room.settings?.maxParticipants ? 'Full' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none"  viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">No rooms found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or create a new room</p>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Room
          </button>
        </div>
      )}

      {/* Create room modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Room</h2>
              <button
                onClick={() => setShowCreateRoom(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none"  viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Name *
                </label>
                <input
                  type="text"
                  value={newRoomData.name}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, name: e.target.value }))}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter room name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newRoomData.description}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, description: e.target.value }))}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe your room"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Type
                </label>
                <select
                  value={newRoomData.type}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, type: e.target.value as 'public' | 'private' | 'practice' | 'classroom' }))}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="public">🌐 Public - Anyone can join</option>
                  <option value="practice">🎯 Practice - For learning and practice</option>
                  <option value="classroom">🎓 Classroom - Educational setting</option>
                  <option value="private">🔒 Private - Invitation only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={newRoomData.maxParticipants}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) }))}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={newRoomTag}
                  onChange={(e) => setNewRoomTag(e.target.value)}
                  onKeyDown={addTag}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Press Enter to add tags"
                />
                {newRoomData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newRoomData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded flex items-center"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newRoomData.requireApproval}
                    onChange={(e) => setNewRoomData(prev => ({ ...prev, requireApproval: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require approval to join</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newRoomData.autoTranslation}
                    onChange={(e) => setNewRoomData(prev => ({ ...prev, autoTranslation: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable auto-translation</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newRoomData.gestureRecognition}
                    onChange={(e) => setNewRoomData(prev => ({ ...prev, gestureRecognition: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable gesture recognition</span>
                </label>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
