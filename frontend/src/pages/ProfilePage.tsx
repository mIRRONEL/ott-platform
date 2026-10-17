import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  LogOut, 
  Heart, 
  Clock, 
  Mail, 
  Shield, 
  ChevronRight, 
  Settings, 
  Crown, 
  Film,
  KeyRound,
  CheckCircle2,
  Play,
  Trash2,
  X,
  Radio,
  Star,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  Check,
  Laptop,
  Smartphone,
  Monitor,
  Tv,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HLS from 'hls.js';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

interface QualityLevel {
  level: number;
  height: number;
  bitrate: number;
  name: string;
}

const resolveThumbnailUrl = (thumb?: string, videoId?: string) => {
  if (thumb && (thumb.startsWith('data:') || thumb.startsWith('http://') || thumb.startsWith('https://'))) {
    return thumb;
  }
  const base = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443')
    ? ''
    : `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000`;
  if (thumb && thumb.startsWith('/')) {
    return `${base}${thumb}`;
  }
  if (videoId) {
    return `${base}/api/stream/${videoId}/thumbnail`;
  }
  return '';
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'watchlist' | 'devices'>('profile');
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Active Sessions & Devices State
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // HLS Player State
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profileResponse = await api.getUserProfile();
      setProfile(profileResponse.data);
      // Pre-load watchlist
      const watchlistResponse = await api.getWatchlist();
      const items = Array.isArray(watchlistResponse.data) 
        ? watchlistResponse.data 
        : watchlistResponse.data?.data || [];
      setWatchlist(items);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    api.logout();
    navigate('/');
  };

  const handleLoadWatchlist = async () => {
    setActiveTab('watchlist');
    setLoading(true);
    try {
      const response = await api.getWatchlist();
      const items = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      setWatchlist(items);
    } catch (err) {
      console.error('Failed to load watchlist', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWatchlist = async (videoId: string, title?: string) => {
    try {
      await api.removeFromWatchlist(videoId);
      setWatchlist(prev => prev.filter(item => (item.videoId || item.id) !== videoId));
      if (selectedVideo && (selectedVideo.videoId || selectedVideo.id) === videoId) {
        setSelectedVideo(null);
      }
      setToastMessage({ text: `Removed "${title || 'Video'}" from your watchlist`, type: 'success' });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to remove from watchlist', err);
      setToastMessage({ text: err.message || 'Failed to remove video', type: 'warn' });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await api.getUserSessions();
      setSessions(res.data?.data?.sessions || []);
    } catch (err) {
      console.error('Failed to load active sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string, deviceName?: string) => {
    setRevokingId(sessionId);
    try {
      await api.revokeUserSession(sessionId);
      setSessions((prev: any[]) => prev.filter((s: any) => s.sessionId !== sessionId && s.id !== sessionId));
      setToastMessage({ text: `Revoked access for ${deviceName || 'device'}`, type: 'success' });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to revoke session', type: 'warn' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    setSessionsLoading(true);
    try {
      const res = await api.revokeAllOtherSessions();
      await loadSessions();
      setToastMessage({ text: res.data?.message || 'Logged out of all other devices', type: 'success' });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to revoke other sessions', type: 'warn' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handlePlayVideo = (item: any) => {
    setSelectedVideo(item);
  };

  // Video setup effect
  useEffect(() => {
    if (!selectedVideo) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setQualityLevels([]);
    setCurrentQuality(-1);
    setShowQualityMenu(false);

    const videoId = selectedVideo.videoId || selectedVideo.id;
    const isStandardPort = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443');
    const apiBase = isStandardPort ? '/api' : `http://${window.location.hostname}:3000/api`;
    const hlsUrl = `${apiBase}/stream/${videoId}/manifest`;
    const mp4Url = `${apiBase}/content/uploads/${selectedVideo.fileName}`;
    const token = localStorage.getItem('auth_token');

    const setupPlayer = () => {
      if (!videoRef.current) {
        setTimeout(setupPlayer, 50);
        return;
      }

      if (HLS.isSupported()) {
        fetch(hlsUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then(res => res.text())
          .then(manifest => {
            const isRealHLS = manifest.includes('playlist/360p') ||
                             manifest.includes('playlist/480p') ||
                             manifest.includes('playlist/720p') ||
                             manifest.includes('playlist/1080p') ||
                             manifest.includes('#EXT-X-STREAM-INF');

            if (isRealHLS && videoRef.current) {
              const hls = new HLS({
                debug: false,
                enableWorker: true,
                autoStartLoad: true,
                maxBufferHole: 2.5,
                nudgeOffset: 0.2,
                nudgeMaxRetry: 10,
                maxBufferLength: 60,
                maxMaxBufferLength: 600,
                abrEwmaDefaultEstimate: 5000000,
                xhrSetup: (xhr: any, url: string) => {
                  if (token && !url.includes('.ts') && !url.includes('/segment/')) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                  }
                },
              });

              hls.loadSource(hlsUrl);
              hls.attachMedia(videoRef.current);
              hlsRef.current = hls;

              hls.on(HLS.Events.MANIFEST_PARSED, (_: any, data: any) => {
                const levels: QualityLevel[] = data.levels.map((lvl: any, index: number) => ({
                  level: index,
                  height: lvl.height,
                  bitrate: lvl.bitrate,
                  name: lvl.height >= 1080 ? '1080p Full HD' :
                        lvl.height >= 720 ? '720p HD' :
                        lvl.height >= 480 ? '480p SD' :
                        lvl.height >= 360 ? '360p Low' : `${lvl.height}p`
                }));
                setQualityLevels(levels);
                setCurrentQuality(-1);

                const videoEl = videoRef.current;
                if (videoEl) {
                  const playPromise = videoEl.play();
                  if (playPromise !== undefined) {
                    playPromise.catch((e) => {
                      console.log('Autoplay deferred, trying muted:', e);
                      videoEl.muted = true;
                      videoEl.play().catch(err => console.log('Muted play deferred:', err));
                    });
                  }
                }
              });

              hls.on(HLS.Events.BUFFER_APPENDED, () => {
                const videoEl = videoRef.current;
                if (videoEl && videoEl.currentTime < 0.1 && videoEl.buffered.length > 0) {
                  const firstBuffered = videoEl.buffered.start(0);
                  if (firstBuffered > 0.1) {
                    videoEl.currentTime = firstBuffered;
                  }
                }
              });

              hls.on(HLS.Events.LEVEL_SWITCHED, (_: any, data: any) => {
                console.log('[HLS] Quality level switched to:', data.level);
              });

              hlsRef.current = hls;
            } else if (videoRef.current && selectedVideo.fileName) {
              videoRef.current.src = mp4Url;
              videoRef.current.play().catch(e => console.log(e));
            }
          })
          .catch(err => {
            console.error('Failed to inspect HLS manifest:', err);
            if (videoRef.current && selectedVideo.fileName) {
              videoRef.current.src = mp4Url;
              videoRef.current.play().catch(e => console.log(e));
            }
          });
      } else if (videoRef.current && selectedVideo.fileName) {
        videoRef.current.src = mp4Url;
        videoRef.current.play().catch(e => console.log(e));
      }
    };

    setupPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedVideo]);

  const changeQuality = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentQuality(levelIndex);
    setShowQualityMenu(false);
  };

  return (
    <div className="min-h-screen bg-[#050a06] text-slate-100 p-4 sm:p-6 lg:p-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-24 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-300 ${
          toastMessage.type === 'warn' ? 'bg-amber-500 text-dark-950 font-bold' : 'bg-lime-500 text-black font-bold'
        }`}>
          {toastMessage.type === 'warn' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span className="text-sm">{toastMessage.text}</span>
        </div>
      )}

      {/* Embedded 4K HLS Modal Player */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-dark-950 border border-white/15 rounded-3xl overflow-hidden max-w-5xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-dark-900/80 flex items-center justify-between border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-500 to-lime-400 p-0.5 shadow-md">
                  <div className="w-full h-full bg-[#050a06] rounded-[10px] flex items-center justify-center text-yellow-400">
                    <Film size={18} />
                  </div>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">{selectedVideo.title || 'Watchlist Video'}</h2>
                  <p className="text-xs text-lime-300 font-semibold flex items-center gap-1.5 mt-0.5">
                    <Radio size={12} className="animate-pulse text-lime-400" />
                    <span>Adaptive Bitrate Multi-Quality Stream • SoNALU</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/browse?play=${selectedVideo.videoId || selectedVideo.id}`)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Open in Cinema Catalog"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Cinema Mode</span>
                </button>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-all"
                  title="Close Player"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Video Player Box */}
            <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                controls
                className="w-full h-full object-contain"
                playsInline
              />

              {/* Quality Selector Float */}
              <div className="absolute top-4 right-4 z-20">
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="flex items-center gap-1.5 bg-dark-950/80 hover:bg-dark-900 border border-white/20 px-3 py-1.5 rounded-xl text-xs font-extrabold text-white backdrop-blur-md transition-all shadow-lg"
                  >
                    <Layers size={14} className="text-lime-400" />
                    <span>
                      {currentQuality === -1 
                        ? 'Auto (Adaptive)' 
                        : qualityLevels[currentQuality]?.name || 'Quality'}
                    </span>
                  </button>

                  {showQualityMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-dark-900 border border-white/15 rounded-2xl p-1.5 shadow-2xl z-30 space-y-1">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/[0.06]">
                        Stream Quality
                      </div>
                      <button
                        onClick={() => changeQuality(-1)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                          currentQuality === -1 
                            ? 'bg-yellow-400/20 text-yellow-300' 
                            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span>Auto (Adaptive)</span>
                        {currentQuality === -1 && <Check size={14} />}
                      </button>
                      {qualityLevels.map((lvl) => (
                        <button
                          key={lvl.level}
                          onClick={() => changeQuality(lvl.level)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                            currentQuality === lvl.level 
                              ? 'bg-yellow-400/20 text-yellow-300' 
                              : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                          }`}
                        >
                          <span>{lvl.name}</span>
                          {currentQuality === lvl.level && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Info */}
            <div className="p-4 sm:p-6 bg-dark-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/[0.08]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 font-bold text-xs uppercase tracking-wider">
                    {selectedVideo.category || 'Movies'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-white font-bold text-xs">
                    4K HLS Master
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {selectedVideo.description || 'Full-bitrate streaming with dynamic resolution switching and live audio sync.'}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => handleRemoveFromWatchlist(selectedVideo.videoId || selectedVideo.id, selectedVideo.title)}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all flex-1 sm:flex-initial"
                >
                  <Trash2 size={14} />
                  <span>Remove From List</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Profile Header Card */}
        <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-yellow-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
          <div className="ambient-glow -top-10 -left-10 w-48 h-48 bg-yellow-500/15 pointer-events-none" />

          <div className="flex items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-lime-400 p-0.5 shadow-lg shadow-yellow-500/30">
              <div className="w-full h-full bg-[#050a06] rounded-[14px] flex items-center justify-center text-yellow-400">
                <User size={32} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  {profile?.first_name || user?.username || 'SoNALU'} {profile?.last_name || 'Member'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-lime-400/20 border border-lime-400/30 text-lime-300 text-[10px] font-black uppercase">
                  SoNALU VIP 4K
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{profile?.email || user?.email || 'member@sonalu.tv'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn-danger text-xs uppercase tracking-wider flex items-center gap-2 relative z-10"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'profile'
                ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-lime-400 text-black font-extrabold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Account Details
          </button>
          <button
            onClick={handleLoadWatchlist}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'watchlist'
                ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-lime-400 text-black font-extrabold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Heart size={14} className={watchlist.length > 0 ? 'fill-rose-500 text-rose-500' : ''} />
            <span>My Watchlist ({watchlist.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab('devices'); loadSessions(); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'devices'
                ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-lime-400 text-black font-extrabold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Laptop size={14} />
            <span>Active Devices ({sessions.length || '•'})</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Shield size={18} className="text-brand-400" />
                <span>Security & Credentials</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Email Address</span>
                  <p className="font-extrabold text-white mt-0.5">{profile?.email || 'admin@example.com'}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Role Status</span>
                  <p className="font-extrabold text-brand-neon mt-0.5 uppercase">Administrator (Superuser)</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Crown size={18} className="text-amber-400" />
                <span>Active Subscription</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Tier</span>
                  <p className="font-extrabold text-white mt-0.5">VIP 4K Ultra HD Plan ($19.99/mo)</p>
                </div>
                <div className="p-3.5 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Next Billing Cycle</span>
                  <p className="font-extrabold text-emerald-400 mt-0.5">Auto-renews on Sep 1, 2026</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Saved Watchlist</h2>
                <p className="text-xs text-slate-400">Click any title to stream directly in the 4K HLS player</p>
              </div>
              <button
                onClick={() => navigate('/browse')}
                className="btn-secondary text-xs uppercase tracking-wider flex items-center gap-2"
              >
                <Film size={14} />
                <span>Browse Catalog</span>
              </button>
            </div>

            {watchlist.length === 0 ? (
              <div className="text-center py-20 glass-card p-8 rounded-3xl">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
                  <Heart size={32} />
                </div>
                <p className="text-base font-extrabold text-white">Your watchlist is currently empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Explore thousands of 4K films, anime, and series in our catalog and save your favorites here.
                </p>
                <button
                  onClick={() => navigate('/browse')}
                  className="btn-primary text-xs uppercase tracking-wider mt-6 px-6 py-3"
                >
                  Explore 4K Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((item, idx) => {
                  const vidId = item.videoId || item.id;
                  return (
                    <div 
                      key={idx} 
                      className="group glass-card p-4 flex flex-col justify-between hover:border-brand-500/40 transition-all duration-300 shadow-xl"
                    >
                      {/* Video Poster Banner */}
                      <div 
                        onClick={() => handlePlayVideo(item)}
                        className="relative aspect-video rounded-2xl bg-dark-900 border border-white/[0.08] overflow-hidden cursor-pointer flex items-center justify-center mb-4 group-hover:scale-[1.02] transition-transform"
                      >
                        {resolveThumbnailUrl(item.thumbnail || item.posterImage, item.id || item.videoId) ? (
                          <img 
                            src={resolveThumbnailUrl(item.thumbnail || item.posterImage, item.id || item.videoId)} 
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand-950/80 via-dark-950/50 to-brand-900/30" />
                        
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 group-hover:bg-brand-500 backdrop-blur-md flex items-center justify-center text-white transition-all shadow-lg">
                            <Play size={20} fill="currentColor" />
                          </div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300 group-hover:text-white">
                            Watch in 4K
                          </span>
                        </div>

                        {/* Top Category Badge */}
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="px-2.5 py-0.5 rounded-md bg-dark-950/80 border border-white/15 text-[10px] font-black uppercase text-brand-300">
                            {item.category || 'Movies'}
                          </span>
                        </div>

                        {/* Added Date */}
                        <div className="absolute bottom-2.5 right-2.5 z-10 text-[10px] font-bold text-slate-400 bg-dark-950/80 px-2 py-0.5 rounded-md border border-white/10">
                          HLS Stream
                        </div>
                      </div>

                      {/* Video Details & Actions */}
                      <div className="space-y-3">
                        <div>
                          <h3 
                            onClick={() => handlePlayVideo(item)}
                            className="font-extrabold text-sm text-white group-hover:text-brand-300 transition-colors line-clamp-1 cursor-pointer"
                          >
                            {item.title || 'Movie Title'}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {item.category || 'Movies'} • Adaptive 4K HLS Stream
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                          <button
                            onClick={() => handlePlayVideo(item)}
                            className="flex-1 bg-white hover:bg-slate-200 text-black py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                          >
                            <Play size={14} fill="currentColor" />
                            <span>Play</span>
                          </button>
                          <button
                            onClick={() => handleRemoveFromWatchlist(vidId, item.title)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
                            title="Remove from Watchlist"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active Devices & Sessions Tab Content */}
        {activeTab === 'devices' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Revoke All */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10 shadow-xl">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Shield size={20} className="text-brand-neon" />
                  <span>Multi-Device Management & Session Guard</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage all active browsers and devices logged into your account. Remotely revoke access to any unrecognized device.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadSessions}
                  disabled={sessionsLoading}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
                  title="Refresh Sessions"
                >
                  <RefreshCw size={16} className={sessionsLoading ? 'animate-spin' : ''} />
                </button>
                {sessions.length > 1 && (
                  <button
                    onClick={handleRevokeAllOthers}
                    disabled={sessionsLoading}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold transition-all shadow-md flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    <span>Log Out Other Devices</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sessions List */}
            {sessionsLoading && sessions.length === 0 ? (
              <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-2 border-brand-neon border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="glass-card p-12 text-center rounded-3xl border border-white/10">
                <Shield size={40} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-white">No Other Active Sessions</h3>
                <p className="text-xs text-slate-400 mt-1">You are only logged in from your current device.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map((session: any) => {
                  const isMobile = session.deviceType === 'mobile' || /ios|android/i.test(session.os);
                  const isSmartTv = session.deviceType === 'smart_tv';
                  return (
                    <div
                      key={session.id || session.sessionId}
                      className={`glass-panel p-5 rounded-2xl border transition-all relative overflow-hidden ${
                        session.isCurrentDevice
                          ? 'border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-950/20'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className={`p-3 rounded-xl border ${
                            session.isCurrentDevice
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-white/5 text-slate-300 border-white/10'
                          }`}>
                            {isMobile ? <Smartphone size={22} /> : isSmartTv ? <Tv size={22} /> : <Laptop size={22} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-sm text-white">{session.deviceName || 'Device'}</h4>
                              {session.isCurrentDevice && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase">
                                  Current Device
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              IP: <span className="text-slate-300 font-mono">{session.ipAddress}</span> • {session.location || 'Local'}
                            </p>
                          </div>
                        </div>

                        {!session.isCurrentDevice && (
                          <button
                            onClick={() => handleRevokeSession(session.sessionId || session.id, session.deviceName)}
                            disabled={revokingId === (session.sessionId || session.id)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                            title="Revoke session"
                          >
                            <Trash2 size={13} />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                        <span>Signed in: {new Date(session.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-brand-cyan" />
                          <span>Active {new Date(session.lastActiveAt).toLocaleTimeString()}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
