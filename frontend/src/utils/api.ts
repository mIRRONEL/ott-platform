import { useAuthStore } from '../stores/auth';

// Use environment variable if set (build-time), otherwise use current host
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL as string;
  if (envUrl) return envUrl;
  
  // Dynamically use the current host with port 3000
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE_URL = getApiUrl();

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - clear auth and redirect
        useAuthStore.getState().logout();
        window.location.href = '/auth/login';
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

export async function apiCallRaw(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok && response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/auth/login';
  }

  return response;
}
