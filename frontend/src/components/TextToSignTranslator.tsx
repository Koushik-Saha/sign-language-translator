'use client'

import React, { useState, useCallback } from 'react'
import SignAvatar from './SignAvatar'
import { TextToSignParser, ParsedText } from '../services/textToSignParser'
import { FingerspellingService } from '../services/fingerspellingService'
// Remove unused imports

interface TextToSignTranslatorProps {
  className?: string
  showAnalysis?: boolean
  userLevel?: 'beginner' | 'intermediate' | 'advanced'
}

export default function TextToSignTranslator({ 
  className = '', 
  showAnalysis = true,
  userLevel = 'intermediate'
}: TextToSignTranslatorProps) {
  const [inputText, setInputText] = useState('')
  const [parsedText, setParsedText] = useState<ParsedText | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationSpeed, setAnimationSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
  const [currentWord, setCurrentWord] = useState('')
  const [, setAnimationProgress] = useState(0)

  const parser = new TextToSignParser()
  const fingerspellingService = new FingerspellingService()
  // Get optimal fingerspelling speed for user level
  fingerspellingService.getOptimalFingerspellingSpeed(userLevel)

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value)
  }

  const handleTranslate = useCallback(() => {
    if (!inputText.trim()) return

    const parsed = parser.parseText(inputText)
    setParsedText(parsed)
    setCurrentWord('')
    setAnimationProgress(0)
  }, [inputText, parser])

  const handleStartAnimation = useCallback(() => {
    if (!parsedText || isAnimating) return
    
    setIsAnimating(true)
    setAnimationProgress(0)
    
    // Track current word during animation
    let wordIndex = 0
    const words = parsedText.words
    
    if (words.length > 0) {
      setCurrentWord(words[0])
      
      // Simple word tracking (in a real implementation, you'd sync with animation pipeline)
      const wordInterval = setInterval(() => {
        wordIndex++
        if (wordIndex < words.length) {
          setCurrentWord(words[wordIndex])
        } else {
          clearInterval(wordInterval)
        }
      }, 2000) // Approximate time per word
    }
  }, [parsedText, isAnimating])

  const handleStopAnimation = useCallback(() => {
    setIsAnimating(false)
    setCurrentWord('')
    setAnimationProgress(0)
  }, [])

  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false)
    setCurrentWord('')
    setAnimationProgress(100)
  }, [])

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const complexity = inputText ? parser.analyzeTextComplexity(inputText) : null
  const fatigue = inputText ? fingerspellingService.estimateFatigueLevel(inputText) : null

  return (
    <div className={`max-w-4xl mx-auto p-6 space-y-6 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Text-to-Sign Translator</h2>
        
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label htmlFor="input-text" className="block text-sm font-medium text-gray-700 mb-2">
              Enter text to translate to sign language:
            </label>
            <textarea
              id="input-text"
              value={inputText}
              onChange={handleTextChange}
              placeholder="Type your message here..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
            />
          </div>
          
          <div className="flex gap-4 items-center">
            <button
              onClick={handleTranslate}
              disabled={!inputText.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Translate
            </button>
            
            {parsedText && (
              <>
                <button
                  onClick={isAnimating ? handleStopAnimation : handleStartAnimation}
                  className={`px-6 py-2 rounded-md ${
                    isAnimating 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isAnimating ? 'Stop' : 'Start Animation'}
                </button>
                
                <select
                  value={animationSpeed}
                  onChange={(e) => setAnimationSpeed(e.target.value as 'slow' | 'normal' | 'fast')}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isAnimating}
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Section */}
      {parsedText && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">3D Sign Language Avatar</h3>
          
          <SignAvatar
            sequences={parsedText.sequences}
            isAnimating={isAnimating}
            animationSpeed={animationSpeed}
            onAnimationComplete={handleAnimationComplete}
            currentWord={currentWord}
            showControls={true}
          />
          
          {currentWord && (
            <div className="mt-4 text-center">
              <span className="text-lg font-medium text-blue-600">
                Currently signing: &quot;{currentWord}&quot;
              </span>
            </div>
          )}
        </div>
      )}

      {/* Analysis Section */}
      {showAnalysis && parsedText && complexity && fatigue && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Translation Analysis</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Translation Stats */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Translation Statistics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Words:</span>
                  <span className="font-medium">{complexity.totalWords}</span>
                </div>
                <div className="flex justify-between">
                  <span>Known Signs:</span>
                  <span className="font-medium text-green-600">{complexity.knownSigns}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fingerspelled:</span>
                  <span className="font-medium text-orange-600">{complexity.fingerspelledWords}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Duration:</span>
                  <span className="font-medium">{formatDuration(parsedText.totalDuration)}</span>
                </div>
              </div>
            </div>

            {/* Complexity Analysis */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Complexity Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Complexity Score:</span>
                  <span className={`font-medium ${
                    complexity.complexityScore < 0.3 ? 'text-green-600' :
                    complexity.complexityScore < 0.7 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {Math.round(complexity.complexityScore * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Fatigue Level:</span>
                  <span className={`font-medium ${
                    fatigue.score < 30 ? 'text-green-600' :
                    fatigue.score < 60 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {fatigue.description}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fingerspelled Words */}
          {parsedText.requiresFingerspelling.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">Words requiring fingerspelling:</h4>
              <div className="flex flex-wrap gap-2">
                {parsedText.requiresFingerspelling.map((word, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-sm"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {fatigue.recommendations.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">Recommendations:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {fatigue.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}