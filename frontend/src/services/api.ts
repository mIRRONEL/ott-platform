import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

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

  async uploadVideo(formData: FormData) {
    return this.client.post('/content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000 // 5 minutes for large uploads
    });
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
    return this.client.get(`/users/${userId}/watchlist`);
  }

  async addToWatchlist(videoId: string) {
    const userId = this.getUserIdFromToken();
    return this.client.post(`/users/${userId}/watchlist`, { videoId });
  }

  async removeFromWatchlist(videoId: string) {
    const userId = this.getUserIdFromToken();
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
}

export default new ApiClient();
