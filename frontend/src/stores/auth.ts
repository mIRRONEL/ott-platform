import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  initialize: () => void;
}

function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setToken: (token) => {
    if (token) {
      localStorage.setItem('auth_token', token);
      const decoded = parseJwt(token);
      const user: User | null = decoded ? {
        id: decoded.user_id || decoded.userId || decoded.sub,
        email: decoded.email,
        role: decoded.role || 'user'
      } : null;
      set({ token, user, isAuthenticated: true });
    } else {
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, isAuthenticated: false });
    }
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  
  initialize: () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const decoded = parseJwt(token);
      const user: User | null = decoded ? {
        id: decoded.user_id || decoded.userId || decoded.sub,
        email: decoded.email,
        role: decoded.role || 'user'
      } : null;
      set({ token, user, isAuthenticated: true });
    } else {
      set({ token: null, user: null, isAuthenticated: false });
    }
  }
}));
