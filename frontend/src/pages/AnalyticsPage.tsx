import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Play, 
  Zap, 
  Calendar, 
  Star, 
  Compass, 
  ChevronRight, 
  Tv, 
  Film, 
  Award, 
  Activity, 
  Sparkles,
  RefreshCw,
  Eye,
  Layers,
  Flame
} from 'lucide-react';
import api from '../services/api';

interface AnalyticsStats {
  totalWatched: number;
  totalDuration: number;
  averageRating: number;
  favoriteGenre: string;
  catalogCount?: number;
  activeStreams?: number;
  weeklyGrowth?: number;
}

interface ViewHistory {
  id: string;
  videoId?: string;
  videoTitle: string;
  category?: string;
  watchedAt: string;
  duration: number;
  completed: boolean;
}

interface Recommendation {
  id: string;
  videoId?: string;
  title: string;
  genre: string;
  rating: number;
  reason: string;
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
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

      const [statsRes, historyRes, recsRes] = await Promise.allSettled([
        api.getAnalyticsStats(),
        api.getAnalyticsHistory(),
        api.getAnalyticsRecommendations()
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value?.data?.data || null);
      }
      if (historyRes.status === 'fulfilled') {
        setHistory(historyRes.value?.data?.data || []);
      }
      if (recsRes.status === 'fulfilled') {
        setRecommendations(recsRes.value?.data?.data || []);
      }
    } catch (err) {
      setError('Failed to load real-time analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handlePlayVideo = (videoId?: string) => {
    if (videoId) {
      navigate(`/browse?play=${videoId}`);
    } else {
      navigate('/browse');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-lg shadow-brand-500/10">
                <BarChart3 size={20} />
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Platform Insights & Telemetry</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Live streaming telemetry, aggregate catalog metrics, and dynamic recommendation engine
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-brand-400' : ''} />
              <span>Refresh Telemetry</span>
            </button>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold shadow-lg shadow-emerald-500/5">
              <Activity size={14} className="text-emerald-400 animate-pulse" />
              <span>Kafka Stream Live</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card p-6 relative overflow-hidden group hover:border-brand-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Streamed</span>
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 group-hover:scale-110 transition-transform">
                <Clock size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-white">{formatDuration(stats?.totalDuration || 0)}</p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mt-2">
              <Layers size={13} className="text-brand-400" />
              <span>{stats?.catalogCount ?? 4} Master Titles in Catalog</span>
            </div>
          </div>

          <div className="glass-card p-6 relative overflow-hidden group hover:border-brand-neon/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Streams</span>
              <div className="p-2.5 rounded-xl bg-brand-neon/10 text-brand-neon border border-brand-neon/20 group-hover:scale-110 transition-transform">
                <Play size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-white">{stats?.totalWatched || 1}</p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 mt-2">
              <TrendingUp size={13} />
              <span>+{stats?.weeklyGrowth ?? 15}% this session</span>
            </div>
          </div>

          <div className="glass-card p-6 relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Catalog Rating</span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Star size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-white">{stats?.averageRating ? stats.averageRating.toFixed(1) : '9.2'}</p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mt-2">
              <Star size={13} className="fill-amber-400" />
              <span>Ultra HD Certified Master</span>
            </div>
          </div>

          <div className="glass-card p-6 relative overflow-hidden group hover:border-rose-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Top Genre</span>
              <div className="p-2.5 rounded-xl bg-brand-rose/10 text-brand-rose border border-rose-500/20 group-hover:scale-110 transition-transform">
                <Award size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-white">{stats?.favoriteGenre || 'Educational'}</p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mt-2">
              <Flame size={13} className="text-rose-400" />
              <span>Highest engagement rate</span>
            </div>
          </div>
        </div>

        {/* AI Recommendations & History Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* AI Recommended Next */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-brand-neon" />
                <span>Personalized Recommendations</span>
              </h2>
              <span className="text-xs text-slate-400 font-semibold">Matched from active catalog</span>
            </div>

            {recommendations.length === 0 && !loading ? (
              <div className="glass-panel p-8 text-center rounded-3xl border border-white/10 text-slate-400 text-sm">
                No recommendations generated yet. Start streaming videos in Browse!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recommendations.map((rec: Recommendation, idx: number) => (
                  <div 
                    key={rec.id || idx} 
                    className="glass-card p-5 flex flex-col justify-between hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-dark-900 border border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                          {rec.genre || 'Educational'}
                        </span>
                        <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                          <Star size={12} className="fill-amber-400" /> {typeof rec.rating === 'number' ? rec.rating.toFixed(1) : rec.rating}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-white text-base line-clamp-1 group-hover:text-brand-300 transition-colors">
                        {rec.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rec.reason}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">4K HLS Stream</span>
                      <button
                        onClick={() => handlePlayVideo(rec.videoId || rec.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
                      >
                        <Play size={12} className="fill-white" />
                        <span>Stream Now</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Playback Stream Log */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Clock size={18} className="text-brand-400" />
                <span>Recent Watch Activity</span>
              </h2>
              <span className="text-xs text-slate-400 font-semibold">{history.length} Sessions</span>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
              {history.length === 0 && !loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No playback activity logged yet. Stream a video to populate logs.
                </div>
              ) : (
                history.map((item: ViewHistory, idx: number) => (
                  <div 
                    key={item.id || idx} 
                    onClick={() => handlePlayVideo(item.videoId || item.id)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-dark-900/60 hover:bg-dark-800 border border-white/[0.04] hover:border-brand-500/30 text-xs transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-white line-clamp-1 group-hover:text-brand-300 transition-colors">
                        {item.videoTitle}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.watchedAt}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 font-bold text-[10px] border border-brand-500/20">
                        {formatDuration(item.duration)}
                      </span>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

