'use client'

import React from 'react'
import TextToSignTranslator from '../../components/TextToSignTranslator'

export default function TextToSignPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Text-to-Sign Language Translator
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Convert text into American Sign Language (ASL) using our 3D avatar system. 
            Type your message and watch as our avatar demonstrates the signs with proper hand shapes and movements.
          </p>
        </div>

        <TextToSignTranslator 
          showAnalysis={true}
          userLevel="intermediate"
          className="max-w-6xl mx-auto"
        />

        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">How it Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Input Text</h3>
                <p className="text-gray-600">
                  Type your message in the text area. Our system supports common words and phrases in ASL.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600">2</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Translation</h3>
                <p className="text-gray-600">
                  Words are translated to ASL signs or fingerspelled letter-by-letter for unknown words.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">3D Animation</h3>
                <p className="text-gray-600">
                  Watch our 3D avatar demonstrate the signs with smooth, natural movements and proper hand positions.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Features</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium">3D Avatar System</h4>
                  <p className="text-sm text-gray-600">Realistic 3D hands with accurate finger positioning</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium">Gesture Library</h4>
                  <p className="text-sm text-gray-600">Comprehensive library of ASL signs and alphabet</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium">Smooth Animations</h4>
                  <p className="text-sm text-gray-600">Natural transitions between gestures with adjustable speed</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium">Fingerspelling Fallback</h4>
                  <p className="text-sm text-gray-600">Automatic letter-by-letter spelling for unknown words</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium">Analysis Tools</h4>
                  <p className="text-sm text-gray-600">Complexity analysis and performance recommendations</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium">Interactive Controls</h4>
                  <p className="text-sm text-gray-600">Pause, replay, and adjust animation speed</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 mt-6">
            <h3 className="text-xl font-semibold text-blue-800 mb-4">Try These Examples</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Simple Greeting</h4>
                <p className="text-sm text-gray-600 mb-2">Perfect for beginners</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">Hello thank you</code>
              </div>

              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Common Phrases</h4>
                <p className="text-sm text-gray-600 mb-2">Everyday conversation</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">Good day help please</code>
              </div>

              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Mixed Content</h4>
                <p className="text-sm text-gray-600 mb-2">Signs and fingerspelling</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">Hello my name is John</code>
              </div>

              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Questions</h4>
                <p className="text-sm text-gray-600 mb-2">Simple questions</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">Help me please thank you</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}