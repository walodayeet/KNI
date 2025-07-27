"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { User, AuthState } from '@/types';
import { AUTH_CONFIG, ERROR_MESSAGES } from '@/utils/constants';
import { safeJsonParse } from '@/utils/helpers';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
        
        if (storedToken) {
          // Validate token with server
          const response = await fetch('/api/user', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            // Invalid token, clear storage
            localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
            localStorage.removeItem('testas_user');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setError(ERROR_MESSAGES.SESSION_EXPIRED);
        // Clear potentially corrupted data
        localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        localStorage.removeItem('testas_user');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (newToken: string, newUser: User): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Validate user data
      if (!newUser.id || !newUser.email) {
        throw new Error('Invalid user data');
      }
      
      // Store token and user data first
      localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, newToken);
      localStorage.setItem('testas_user', JSON.stringify(newUser));
      
      // Verify token with server before setting user state
      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // If verification fails, clear storage and throw error
        localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        localStorage.removeItem('testas_user');
        throw new Error('Token verification failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.VALIDATION_ERROR;
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
      
      if (token) {
        // Call logout API to invalidate session
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      setUser(null);
      setError(null);
      localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
      localStorage.removeItem('testas_user');
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force clear even if there's an error
      setUser(null);
      setError(null);
      localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
      localStorage.removeItem('testas_user');
      router.push('/login');
    }
  };

  const clearError = () => {
    setError(null);
  };

  const isAuthenticated = !!user;

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;