'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface AccessibilitySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccessibilitySettings({ isOpen, onClose }: AccessibilitySettingsProps) {
  const { user, updatePreferences } = useAuth();
  const [settings, setSettings] = useState({
    theme: 'auto' as 'light' | 'dark' | 'auto',
    fontSize: 'medium' as 'small' | 'medium' | 'large',
    highContrast: false,
    reduceMotion: false,
    focusIndicators: true,
    screenReaderOptimized: false,
    keyboardNavigation: true,
    notifications: {
      email: true,
      push: true,
      achievements: true,
      reminders: true
    },
    camera: {
      mirrorMode: true,
      resolution: '720p' as '480p' | '720p' | '1080p',
      frameRate: 30
    }
  });

  useEffect(() => {
    if (user?.preferences) {
      setSettings(prev => ({
        ...prev,
        theme: user.preferences.theme,
        fontSize: user.preferences.fontSize,
        highContrast: user.preferences.highContrast,
        notifications: user.preferences.notifications,
        camera: user.preferences.camera
      }));
    }

    // Detect system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    setSettings(prev => ({
      ...prev,
      reduceMotion: prefersReducedMotion,
      highContrast: prev.highContrast || prefersHighContrast
    }));
  }, [user]);

  const handleSettingChange = async (key: string, value: unknown, nested?: string) => {
    const newSettings = { ...settings };
    
    if (nested) {
      (newSettings as Record<string, unknown>)[nested] = {
        ...(newSettings as Record<string, unknown>)[nested] as Record<string, unknown>,
        [key]: value
      };
    } else {
      (newSettings as Record<string, unknown>)[key] = value;
    }
    
    setSettings(newSettings);
    
    // Apply settings immediately
    applySettings(newSettings);
    
    // Save to backend if user is authenticated
    if (user) {
      const updateData = nested 
        ? { [nested]: (newSettings as Record<string, unknown>)[nested] }
        : { [key]: value };
      
      await updatePreferences(updateData);
    }
  };

  const applySettings = (currentSettings: typeof settings) => {
    const root = document.documentElement;
    
    // Apply theme
    if (currentSettings.theme === 'dark') {
      root.classList.add('dark');
    } else if (currentSettings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    
    // Apply font size
    root.classList.remove('text-sm', 'text-base', 'text-lg');
    switch (currentSettings.fontSize) {
      case 'small':
        root.classList.add('text-sm');
        break;
      case 'large':
        root.classList.add('text-lg');
        break;
      default:
        root.classList.add('text-base');
    }
    
    // Apply high contrast
    if (currentSettings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Apply reduced motion
    if (currentSettings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    // Apply focus indicators
    if (currentSettings.focusIndicators) {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }
  };

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <span role="img" aria-label="Accessibility" className="mr-2">♿</span>
            Accessibility Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close settings"
          >
            <svg className="w-6 h-6" fill="none" strokeCurrentColor viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Visual Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span role="img" aria-label="Visual" className="mr-2">👁️</span>
              Visual Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme Preference
                </label>
                <div className="flex space-x-4">
                  {['light', 'dark', 'auto'].map((theme) => (
                    <button
                      key={theme}
                      onClick={() => handleSettingChange('theme', theme)}
                      className={`px-4 py-2 rounded-lg border-2 capitalize ${
                        settings.theme === theme
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font Size
                </label>
                <div className="flex space-x-4">
                  {[
                    { value: 'small', label: 'Small (A)', size: 'text-sm' },
                    { value: 'medium', label: 'Medium (A)', size: 'text-base' },
                    { value: 'large', label: 'Large (A)', size: 'text-lg' }
                  ].map((size) => (
                    <button
                      key={size.value}
                      onClick={() => handleSettingChange('fontSize', size.value)}
                      className={`px-4 py-2 rounded-lg border-2 ${size.size} ${
                        settings.fontSize === size.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">High Contrast Mode</label>
                  <p className="text-xs text-gray-500">Increases contrast for better visibility</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.highContrast}
                    onChange={(e) => handleSettingChange('highContrast', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Motion & Animation Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span role="img" aria-label="Motion" className="mr-2">🎭</span>
              Motion & Animation
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Reduce Motion</label>
                  <p className="text-xs text-gray-500">Minimizes animations and transitions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.reduceMotion}
                    onChange={(e) => handleSettingChange('reduceMotion', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Navigation Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span role="img" aria-label="Navigation" className="mr-2">⌨️</span>
              Navigation & Interaction
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enhanced Focus Indicators</label>
                  <p className="text-xs text-gray-500">Makes focus outlines more visible</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.focusIndicators}
                    onChange={(e) => handleSettingChange('focusIndicators', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Screen Reader Optimized</label>
                  <p className="text-xs text-gray-500">Optimizes interface for screen readers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.screenReaderOptimized}
                    onChange={(e) => handleSettingChange('screenReaderOptimized', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Camera Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span role="img" aria-label="Camera" className="mr-2">📹</span>
              Camera Settings
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Mirror Mode</label>
                  <p className="text-xs text-gray-500">Shows your image mirrored like a mirror</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.camera.mirrorMode}
                    onChange={(e) => handleSettingChange('mirrorMode', e.target.checked, 'camera')}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Camera Resolution
                </label>
                <div className="flex space-x-4">
                  {['480p', '720p', '1080p'].map((resolution) => (
                    <button
                      key={resolution}
                      onClick={() => handleSettingChange('resolution', resolution, 'camera')}
                      className={`px-4 py-2 rounded-lg border-2 ${
                        settings.camera.resolution === resolution
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {resolution}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Notification Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span role="img" aria-label="Notifications" className="mr-2">🔔</span>
              Notifications
            </h3>
            
            <div className="space-y-4">
              {Object.entries(settings.notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()} Notifications
                    </label>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={value}
                      onChange={(e) => handleSettingChange(key, e.target.checked, 'notifications')}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end space-x-4 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add styles for accessibility features */}
      <style jsx global>{`
        .high-contrast {
          filter: contrast(150%);
        }
        
        .high-contrast .bg-white {
          background-color: #ffffff !important;
        }
        
        .high-contrast .text-gray-900 {
          color: #000000 !important;
        }
        
        .high-contrast .border-gray-200 {
          border-color: #000000 !important;
        }
        
        .reduce-motion * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
        
        .enhanced-focus *:focus {
          outline: 4px solid #3B82F6 !important;
          outline-offset: 2px !important;
        }
        
        .dark {
          color-scheme: dark;
        }
        
        .dark .bg-white {
          background-color: #1f2937 !important;
          color: #f9fafb !important;
        }
        
        .dark .text-gray-900 {
          color: #f9fafb !important;
        }
        
        .dark .border-gray-200 {
          border-color: #374151 !important;
        }
        
        .dark .bg-gray-50 {
          background-color: #111827 !important;
        }
      `}</style>
    </div>
  );
}