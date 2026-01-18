// Auth token and user storage utilities

import { AuthenticatedUser } from '../api/types';

const TOKEN_KEY = 'steamdl_token';
const USER_KEY = 'steamdl_user';
const EXPIRES_KEY = 'steamdl_expires';

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = localStorage.getItem(EXPIRES_KEY);
  
  // Check if token is expired
  if (expires && Date.now() > parseInt(expires, 10)) {
    clearAuth();
    return null;
  }
  
  return token;
}

export function setToken(token: string, expiresIn?: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  
  if (expiresIn) {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
  }
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function getStoredUser(): AuthenticatedUser | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  
  try {
    return JSON.parse(data) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthenticatedUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  removeToken();
  removeStoredUser();
}

export function isTokenValid(): boolean {
  return getToken() !== null;
}

// Handle OAuth callback from URL parameters
export function handleAuthCallback(): { success: boolean; error?: string } {
  const params = new URLSearchParams(window.location.search);
  
  const token = params.get('token');
  const userId = params.get('user_id');
  const email = params.get('email');
  const name = params.get('name');
  const provider = params.get('provider');
  const expiresIn = params.get('expires_in');
  const error = params.get('error');
  
  // Check for error
  if (error) {
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
    return { success: false, error: error };
  }
  
  // Check if this is a callback with token
  if (token && email) {
    // Store token
    setToken(token, expiresIn ? parseInt(expiresIn, 10) : undefined);
    
    // Store user info
    const user: AuthenticatedUser = {
      id: userId || '',
      email: email,
      name: name || undefined,
      provider: provider || 'google',
    };
    setStoredUser(user);
    
    // Clean up URL (remove query params)
    window.history.replaceState({}, '', window.location.pathname);
    
    return { success: true };
  }
  
  return { success: false };
}
