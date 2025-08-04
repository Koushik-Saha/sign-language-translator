'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';

interface User {
  _id: string;
  username: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
    learningGoals: string[];
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    highContrast: boolean;
    notifications: {
      email: boolean;
      push: boolean;
      achievements: boolean;
      reminders: boolean;
    };
    camera: {
      mirrorMode: boolean;
      resolution: string;
      frameRate: number;
    };
  };
  statistics: {
    totalSessionTime: number;
    totalGesturesLearned: number;
    averageAccuracy: number;
    streakDays: number;
    longestStreak: number;
    totalPoints: number;
    level: number;
  };
  isEmailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (data: Partial<User['profile']>) => Promise<{ success: boolean; message?: string }>;
  updatePreferences: (data: Partial<User['preferences']>) => Promise<{ success: boolean; message?: string }>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const isAuthenticated = !!user && !!accessToken;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      setAccessToken(token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      getCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosError['config'] & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshed = await refreshToken();
          if (refreshed && originalRequest) {
            return api(originalRequest);
          } else {
            await logout();
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [accessToken]);

  const getCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      if (response.data.success) {
        setUser(response.data.data.user);
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
      localStorage.removeItem('accessToken');
      setAccessToken(null);
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/auth/login', { email, password });
      
      if (response.data.success) {
        const { user, accessToken } = response.data.data;
        setUser(user);
        setAccessToken(accessToken);
        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      return { 
        success: false, 
        message: axiosError.response?.data?.message || 'Login failed' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/auth/register', data);
      
      if (response.data.success) {
        const { user, accessToken } = response.data.data;
        setUser(user);
        setAccessToken(accessToken);
        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      return { 
        success: false, 
        message: axiosError.response?.data?.message || 'Registration failed' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await api.post('/api/auth/refresh');
      
      if (response.data.success) {
        const { accessToken } = response.data.data;
        setAccessToken(accessToken);
        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        return true;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }
    
    return false;
  };

  const updateProfile = async (data: Partial<User['profile']>) => {
    try {
      const response = await api.put('/api/profile', { profile: data });
      
      if (response.data.success) {
        setUser(response.data.data.user);
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Update profile error:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      return { 
        success: false, 
        message: axiosError.response?.data?.message || 'Failed to update profile' 
      };
    }
  };

  const updatePreferences = async (data: Partial<User['preferences']>) => {
    try {
      const response = await api.put('/api/profile/preferences', data);
      
      if (response.data.success) {
        if (user) {
          setUser({
            ...user,
            preferences: { ...user.preferences, ...response.data.data.preferences }
          });
        }
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Update preferences error:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      return { 
        success: false, 
        message: axiosError.response?.data?.message || 'Failed to update preferences' 
      };
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    updatePreferences,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { api };