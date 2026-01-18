// Auth Context Provider for Steam Workshop Downloader
// Uses redirect-based OAuth flow

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AuthenticatedUser } from '../api/types';
import { apiClient } from '../api/client';
import {
  getToken,
  setStoredUser,
  getStoredUser,
  clearAuth,
  handleAuthCallback,
} from './storage';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthenticatedUser | null>(getStoredUser);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback and validate token on mount
  useEffect(() => {
    const initialize = async () => {
      // First, check if this is an OAuth callback
      const callbackResult = handleAuthCallback();
      
      if (callbackResult.success) {
        // Successfully processed callback, get fresh user data
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
        setIsLoading(false);
        return;
      }
      
      if (callbackResult.error) {
        setError(callbackResult.error);
        setIsLoading(false);
        return;
      }

      // Not a callback - check if we have an existing valid token
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Validate the token by fetching user info
      try {
        const userData = await apiClient.getMe();
        setUser(userData);
        setStoredUser(userData);
      } catch {
        // Token is invalid, clear it
        clearAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Login using redirect flow
  const login = useCallback(() => {
    setError(null);
    
    // Build callback URL - use current origin
    const callbackUrl = window.location.origin + window.location.pathname;
    
    // Redirect to backend OAuth endpoint
    const authUrl = apiClient.getGoogleAuthUrl(callbackUrl);
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
