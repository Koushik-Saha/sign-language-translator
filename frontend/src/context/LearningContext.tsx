'use client';

import React, { createContext, useContext, useState } from 'react';
import { api } from './AuthContext';

interface LearningModule {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completed: boolean;
  totalLessons: number;
  completedLessons: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  letters?: string[];
  words?: string[];
  bestScore: number;
  attempts: number;
  completed: boolean;
  stars: number;
}

interface LearningSession {
  sessionId: string;
  lesson: {
    id: string;
    title: string;
    module: string;
    difficulty: string;
  };
  practiceItems: string[];
  totalItems: number;
  currentItemIndex: number;
  results: LearningResult[];
  startTime: Date;
  isActive: boolean;
}

interface LearningResult {
  item: string;
  correct: boolean;
  timeSpent: number;
  attempts: number;
}

interface PracticeSession {
  sessionId: string;
  type: 'alphabet' | 'words' | 'mixed';
  difficulty: string;
  items: string[];
  totalItems: number;
  currentItemIndex: number;
  results: LearningResult[];
  startTime: Date;
  isActive: boolean;
}

interface Recommendation {
  type: string;
  title: string;
  description: string;
  action: string;
  moduleId?: string;
  priority: 'high' | 'medium' | 'low';
}

interface LearningContextType {
  modules: LearningModule[];
  currentSession: LearningSession | null;
  currentPractice: PracticeSession | null;
  recommendations: Recommendation[];
  isLoading: boolean;
  
  // Module management
  loadModules: () => Promise<void>;
  getModule: (moduleId: string) => Promise<LearningModule | null>;
  
  // Lesson management
  startLesson: (lessonId: string) => Promise<LearningSession | null>;
  submitAnswer: (item: string, correct: boolean, timeSpent: number) => void;
  completeLesson: (improvements?: string[]) => Promise<any>;
  
  // Practice mode
  startPractice: (type: 'alphabet' | 'words' | 'mixed', difficulty?: string, count?: number) => Promise<PracticeSession | null>;
  completePractice: () => Promise<any>;
  
  // Recommendations
  loadRecommendations: () => Promise<void>;
  
  // Session management
  resetSession: () => void;
}

const LearningContext = createContext<LearningContextType | undefined>(undefined);

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [currentSession, setCurrentSession] = useState<LearningSession | null>(null);
  const [currentPractice, setCurrentPractice] = useState<PracticeSession | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadModules = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/learning/modules');
      if (response.data.success) {
        setModules(response.data.data.modules);
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModule = async (moduleId: string): Promise<LearningModule | null> => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/learning/modules/${moduleId}`);
      if (response.data.success) {
        return response.data.data.module;
      }
    } catch (error) {
      console.error('Failed to get module:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const startLesson = async (lessonId: string): Promise<LearningSession | null> => {
    try {
      setIsLoading(true);
      const response = await api.post(`/api/learning/lessons/${lessonId}/start`);
      
      if (response.data.success) {
        const sessionData = response.data.data;
        const session: LearningSession = {
          ...sessionData,
          currentItemIndex: 0,
          results: [],
          startTime: new Date(),
          isActive: true
        };
        
        setCurrentSession(session);
        return session;
      }
    } catch (error) {
      console.error('Failed to start lesson:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const submitAnswer = (item: string, correct: boolean, timeSpent: number) => {
    if (!currentSession) return;

    const result: LearningResult = {
      item,
      correct,
      timeSpent,
      attempts: 1
    };

    const updatedSession = {
      ...currentSession,
      results: [...currentSession.results, result],
      currentItemIndex: currentSession.currentItemIndex + 1
    };

    setCurrentSession(updatedSession);
  };

  const completeLesson = async (improvements: string[] = []) => {
    if (!currentSession) return null;

    try {
      setIsLoading(true);
      const endTime = new Date();
      
      const response = await api.post(`/api/learning/lessons/${currentSession.lesson.id}/complete`, {
        sessionId: currentSession.sessionId,
        results: currentSession.results,
        startTime: currentSession.startTime.toISOString(),
        endTime: endTime.toISOString(),
        improvements
      });

      if (response.data.success) {
        setCurrentSession(null);
        await loadModules(); // Refresh modules to update progress
        return response.data.data;
      }
    } catch (error) {
      console.error('Failed to complete lesson:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const startPractice = async (
    type: 'alphabet' | 'words' | 'mixed', 
    difficulty: string = 'beginner', 
    count: number = 10
  ): Promise<PracticeSession | null> => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/learning/practice/${type}`, {
        params: { difficulty, count }
      });
      
      if (response.data.success) {
        const sessionData = response.data.data;
        const session: PracticeSession = {
          ...sessionData,
          currentItemIndex: 0,
          results: [],
          startTime: new Date(),
          isActive: true
        };
        
        setCurrentPractice(session);
        return session;
      }
    } catch (error) {
      console.error('Failed to start practice:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const completePractice = async () => {
    if (!currentPractice) return null;

    const endTime = new Date();
    const correctAnswers = currentPractice.results.filter(r => r.correct).length;
    const accuracy = currentPractice.results.length > 0 
      ? (correctAnswers / currentPractice.results.length) * 100 
      : 0;

    setCurrentPractice(null);
    
    return {
      accuracy,
      correctAnswers,
      totalAnswers: currentPractice.results.length,
      duration: endTime.getTime() - currentPractice.startTime.getTime()
    };
  };

  const loadRecommendations = async () => {
    try {
      const response = await api.get('/api/learning/recommendations');
      if (response.data.success) {
        setRecommendations(response.data.data.recommendations);
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const resetSession = () => {
    setCurrentSession(null);
    setCurrentPractice(null);
  };

  const value: LearningContextType = {
    modules,
    currentSession,
    currentPractice,
    recommendations,
    isLoading,
    loadModules,
    getModule,
    startLesson,
    submitAnswer,
    completeLesson,
    startPractice,
    completePractice,
    loadRecommendations,
    resetSession,
  };

  return (
    <LearningContext.Provider value={value}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (context === undefined) {
    throw new Error('useLearning must be used within a LearningProvider');
  }
  return context;
}