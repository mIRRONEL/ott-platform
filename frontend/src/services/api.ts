import axios, { AxiosInstance } from 'axios';

// Use environment variable if set (build-time), otherwise use current host
const getApiUrl = () => {
  // Check for env variable (Vite uses import.meta.env)
  const envUrl = (import.meta.env.VITE_API_URL as string) || (process.env.REACT_APP_API_URL as string);
  if (envUrl) return envUrl;
  
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '' || port === '80' || port === '443') {
      return '/api';
    }
  }

  // Dynamically use the current host with port 3000 (direct gateway port)
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE_URL = getApiUrl();

class ApiClient {
  public client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.warn('[API] 401 Unauthorized received. Clearing stale auth token.');
          localStorage.removeItem('auth_token');
        }

        // Automatic 429 Rate Limit Backoff & Retry
        if (error.response?.status === 429 && !error.config._retry) {
          error.config._retry = true;
          const retryAfterSec = parseInt(
            error.response.headers?.['retry-after'] ||
            error.response.data?.retryAfterSeconds ||
            '2',
            10
          );
          console.warn(`[API] Rate limit reached. Backing off for ${retryAfterSec}s and retrying...`);
          await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterSec * 1000, 5000)));
          return this.client(error.config);
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    if (response.data.data?.access_token) {
      localStorage.setItem('auth_token', response.data.data.access_token);
    }
    return response.data.data;
  }

  async signup(email: string, password: string, firstName: string, lastName: string) {
    const response = await this.client.post('/auth/register', {
      email,
      password,
      confirm_password: password,
      first_name: firstName,
      last_name: lastName
    });
    if (response.data.data?.access_token) {
      localStorage.setItem('auth_token', response.data.data.access_token);
    }
    return response.data.data;
  }

  logout() {
    localStorage.removeItem('auth_token');
  }

  // Content
  async getContent(page = 1, limit = 20) {
    return this.client.get('/content/videos', { params: { page, limit } });
  }

  async searchContent(query: string) {
    return this.client.get('/content/search', { params: { q: query } });
  }

  async getVideoById(videoId: string) {
    return this.client.get(`/content/videos/${videoId}`);
  }

  async getCategories() {
    return this.client.get('/content/categories');
  }

  async getTrending() {
    return this.client.get('/content/trending');
  }

  async uploadVideo(formData: FormData, onUploadProgress?: (progressEvent: any) => void) {
    return this.client.post('/content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 0, // 0 = no timeout to prevent aborting on large 600MB+ uploads
      onUploadProgress
    });
  }

  // Resumable Chunked Multipart Upload API
  async initChunkedUpload(data: {
    title: string;
    description?: string;
    category?: string;
    subCategory?: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    chunkSize: number;
  }) {
    return this.client.post('/content/upload/init', data);
  }

  async getChunkedUploadStatus(uploadId: string) {
    return this.client.get(`/content/upload/status/${uploadId}`);
  }

  async uploadChunk(formData: FormData, onUploadProgress?: (progressEvent: any) => void) {
    return this.client.post('/content/upload/chunk', formData, {
      timeout: 120000,
      onUploadProgress
    });
  }

  async uploadChunkDirect(
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    blob: Blob,
    onUploadProgress?: (progressEvent: any) => void
  ) {
    const url = `/content/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`;
    return this.client.post(url, blob, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      timeout: 180000,
      onUploadProgress
    });
  }

  async completeChunkedUpload(data: {
    uploadId: string;
    title?: string;
    description?: string;
    category?: string;
    subCategory?: string;
    thumbnail?: string;
    posterImage?: string;
    autoTranscode?: boolean;
    deleteRawAfterEncode?: boolean;
  }) {
    return this.client.post('/content/upload/complete', data, {
      timeout: 300000
    });
  }

  async getStudioSummary() {
    return this.client.get('/content/studio/summary');
  }

  async triggerVideoTranscoding(videoId: string, options?: {
    profiles?: string[];
    preset?: string;
    deleteRawAfterEncode?: boolean;
  }) {
    return this.client.post(`/content/videos/${videoId}/encode`, options || {});
  }

  async deleteRawMasterVideo(videoId: string) {
    return this.client.delete(`/content/videos/${videoId}/raw`);
  }

  async getProcessingProgress(videoId: string) {
    return this.client.get(`/content/videos/${videoId}/progress`);
  }

  async deleteVideo(videoId: string) {
    return this.client.delete(`/content/videos/${videoId}`);
  }

  // User
  async getUserProfile() {
    return this.client.get('/users/profile');
  }

  async updateUserProfile(profile: any) {
    return this.client.put('/users/profile', profile);
  }

  private getUserIdFromToken(): string {
    const token = localStorage.getItem('auth_token');
    if (!token) return '';
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return decoded.user_id || decoded.userId || decoded.sub || '';
    } catch {
      return '';
    }
  }

  async getWatchlist() {
    const userId = this.getUserIdFromToken();
    if (!userId) return { data: { data: [] } };
    return this.client.get(`/users/${userId}/watchlist`);
  }

  async addToWatchlist(videoId: string) {
    const userId = this.getUserIdFromToken();
    if (!userId) {
      throw new Error('Please sign in to add videos to your watchlist');
    }
    return this.client.post(`/users/${userId}/watchlist`, { videoId });
  }

  async removeFromWatchlist(videoId: string) {
    const userId = this.getUserIdFromToken();
    if (!userId) {
      throw new Error('Please sign in to modify your watchlist');
    }
    return this.client.delete(`/users/${userId}/watchlist/${videoId}`);
  }

  // Streaming
  async getStreamUrl(videoId: string) {
    return this.client.get(`/streaming/videos/${videoId}/stream`);
  }

  async logWatchProgress(videoId: string, progress: number) {
    return this.client.post('/streaming/watch-progress', { videoId, progress });
  }

  // Payment
  async getSubscriptions() {
    return this.client.get('/payments/subscriptions');
  }

  async createPaymentIntent(planId: string) {
    return this.client.post('/payments/intent', { planId });
  }

  async getCurrentSubscription() {
    return this.client.get('/payments/subscription');
  }

  async getPaymentHistory() {
    return this.client.get('/payments/history');
  }

  async subscribe(subscriptionId: string) {
    return this.client.post('/payments/subscribe', { subscriptionId });
  }

  // Notifications
  async getNotifications(read?: boolean) {
    return this.client.get('/notifications', {
      params: read === undefined ? {} : { read: String(read) }
    });
  }

  async markNotificationAsRead(notificationId: string) {
    return this.client.put(`/notifications/${notificationId}/read`);
  }

  async deleteNotification(notificationId: string) {
    return this.client.delete(`/notifications/${notificationId}`);
  }

  // DRM & Tokenized Streaming
  async getStreamToken(videoId: string) {
    return this.client.get(`/stream/${videoId}/token`);
  }

  // Continue Watching & Playback Progress
  async getContinueWatching() {
    return this.client.get('/stream/continue-watching');
  }

  async saveWatchProgress(videoId: string, currentTime: number, duration: number, progress?: number) {
    return this.client.post('/stream/watch-progress', {
      videoId,
      currentTime,
      duration,
      progress
    });
  }

  async removeContinueWatching(videoId: string) {
    return this.client.delete(`/stream/${videoId}/progress`);
  }

  // Analytics
  async getAnalyticsStats() {
    return this.client.get('/analytics/stats');
  }

  async getAnalyticsHistory() {
    return this.client.get('/analytics/history');
  }

  async getAnalyticsRecommendations() {
    return this.client.get('/analytics/recommendations');
  }

  // Live Streaming & Creator Studio
  async getLiveChannels() {
    return this.client.get('/live/channels');
  }

  async getLiveChannel(channelId: string) {
    return this.client.get(`/live/channels/${channelId}`);
  }

  async getStreamCredentials() {
    return this.client.get('/live/credentials');
  }

  async updateLiveChannel(channelId: string, data: any) {
    return this.client.put(`/live/channels/${channelId}`, data);
  }

  async getLiveChat(channelId: string) {
    return this.client.get(`/live/chat/${channelId}`);
  }

  async sendLiveChat(channelId: string, data: { message: string; username?: string; userId?: string; userRole?: string }) {
    return this.client.post(`/live/chat/${channelId}`, data);
  }

  async startWebcamStream(streamKey: string) {
    return this.client.post(`/live/ingest/start/${streamKey}`);
  }

  async sendWebcamChunk(streamKey: string, chunk: any) {
    return this.client.post(`/live/ingest/chunk/${streamKey}`, chunk);
  }

  async stopWebcamStream(streamKey: string) {
    return this.client.post(`/live/ingest/stop/${streamKey}`);
  }

  // Device & Multi-Session Management
  async getUserSessions() {
    return this.client.get('/auth/sessions');
  }

  async revokeUserSession(sessionId: string) {
    return this.client.delete(`/auth/sessions/${sessionId}`);
  }

  async revokeAllOtherSessions() {
    return this.client.delete('/auth/sessions');
  }

  // Security Audit Logs & Forensics
  async getAuditLogs(params?: { limit?: number; offset?: number; action?: string; riskLevel?: string; status?: string; search?: string }) {
    return this.client.get('/auth/admin/audit-logs', { params });
  }

  async getAuditStats() {
    return this.client.get('/auth/admin/audit-logs/stats');
  }

  async exportAuditLogs() {
    return this.client.get('/auth/admin/audit-logs/export', { responseType: 'blob' });
  }

  // Playback Concurrency
  async getActiveStreams() {
    return this.client.get('/stream/sessions/active');
  }

  async heartbeatStream(sessionId: string) {
    return this.client.post(`/stream/sessions/${sessionId}/heartbeat`);
  }

  async stopStream(sessionId: string) {
    return this.client.post(`/stream/sessions/${sessionId}/stop`);
  }
}

export default new ApiClient();
