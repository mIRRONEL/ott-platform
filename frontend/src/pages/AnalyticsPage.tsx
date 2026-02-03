import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Play } from 'lucide-react';
import api from '../services/api';

interface AnalyticsStats {
  totalWatched: number;
  totalDuration: number;
  averageRating: number;
  favoriteGenre: string;
}

interface ViewHistory {
  id: string;
  videoTitle: string;
  watchedAt: string;
  duration: number;
  completed: boolean;
}

interface Recommendation {
  id: string;
  title: string;
  genre: string;
  rating: number;
  reason: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [history, setHistory] = useState<ViewHistory[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch stats
      const statsResponse = await api.getAnalyticsStats();
      setStats(statsResponse?.data?.data || null);

      // Fetch watch history
      const historyResponse = await api.getAnalyticsHistory();
      setHistory(historyResponse?.data?.data || []);

      // Fetch recommendations
      const recsResponse = await api.getAnalyticsRecommendations();
      setRecommendations(recsResponse?.data?.data || []);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={32} className="text-purple-500" />
            <h1 className="text-4xl font-bold">Your Analytics</h1>
          </div>
          <p className="text-slate-400">Track your viewing habits and get personalized insights</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading analytics...</div>
        ) : (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Total Videos Watched</span>
                    <Play size={20} className="text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold">{stats.totalWatched}</p>
                </div>

                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Total Watch Time</span>
                    <Clock size={20} className="text-green-500" />
                  </div>
                  <p className="text-3xl font-bold">{formatDuration(stats.totalDuration)}</p>
                </div>

                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Average Rating</span>
                    <TrendingUp size={20} className="text-yellow-500" />
                  </div>
                  <p className="text-3xl font-bold">{stats.averageRating.toFixed(1)}/5</p>
                </div>

                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Favorite Genre</span>
                    <BarChart3 size={20} className="text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold truncate">{stats.favoriteGenre || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Watch History */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Recent Watch History</h2>
              <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="px-6 py-3 text-left text-sm font-semibold">Video Title</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Watched</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Duration</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length > 0 ? (
                      history.slice(0, 10).map((item) => (
                        <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                          <td className="px-6 py-3 text-sm">{item.videoTitle}</td>
                          <td className="px-6 py-3 text-sm">
                            {new Date(item.watchedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-sm">{formatDuration(item.duration)}</td>
                          <td className="px-6 py-3 text-sm">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                item.completed
                                  ? 'bg-green-900/30 text-green-300'
                                  : 'bg-yellow-900/30 text-yellow-300'
                              }`}
                            >
                              {item.completed ? 'Completed' : 'In Progress'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                          No watch history
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Personalized Recommendations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.length > 0 ? (
                  recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-purple-500 transition-all"
                    >
                      <h3 className="font-bold text-lg mb-2">{rec.title}</h3>
                      <p className="text-sm text-slate-400 mb-4">{rec.genre}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-400 font-semibold">⭐ {rec.rating}/5</span>
                        <span className="text-xs text-slate-500 italic">{rec.reason}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">Watch more videos to get recommendations</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
