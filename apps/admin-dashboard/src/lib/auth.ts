import { jwtDecode } from 'jwt-decode';

interface AuthToken {
  userId: string;
  role: string;
  organizationId?: string;
  iat: number;
  exp: number;
}

const TOKEN_KEY = 'syntropi_admin_token';
const USER_KEY = 'syntropi_admin_user';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'superadmin' | 'admin' | 'user';
  organizationId?: string;
}

export const setAuth = (token: string, user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Failed to parse user JSON:', error);
      }
    }
  }
  return null;
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;

  try {
    const decoded = jwtDecode<AuthToken>(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

export const isAdmin = (): boolean => {
  const user = getUser();
  return !!user && (user.role === 'admin' || user.role === 'superadmin');
};

export const isSuperAdmin = (): boolean => {
  const user = getUser();
  return !!user && user.role === 'superadmin';
};