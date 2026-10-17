import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LogIn, 
  Home, 
  Compass, 
  User, 
  Upload, 
  Shield, 
  CreditCard, 
  Bell, 
  BarChart3, 
  Film, 
  Search, 
  Menu, 
  X, 
  Sparkles, 
  LogOut, 
  Radio, 
  Activity,
  Play,
  Loader2,
  Inbox
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Elasticsearch Live Search State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isActive = (path: string) => location.pathname === path;

  // Notification Dropdown State & Real-Time Sync
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [quickNotifs, setQuickNotifs] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const syncNotifications = async () => {
    try {
      const STORAGE_KEY_READ = 'ott_read_notifications';
      const STORAGE_KEY_DELETED = 'ott_deleted_notifications';
      
      let readSet = new Set<string>();
      let deletedSet = new Set<string>();
      try {
        const rawRead = localStorage.getItem(STORAGE_KEY_READ);
        if (rawRead) readSet = new Set(JSON.parse(rawRead));
        const rawDel = localStorage.getItem(STORAGE_KEY_DELETED);
        if (rawDel) deletedSet = new Set(JSON.parse(rawDel));
      } catch {}

      let items: any[] = [];
      try {
        const res = await api.getNotifications();
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        if (Array.isArray(data)) items = data;
      } catch {}

      const active = items
        .filter(item => {
          const id = String(item.id || item._id || '');
          return id && !deletedSet.has(id);
        })
        .map(item => {
          const id = String(item.id || item._id || '');
          const isRead = Boolean(item.read || readSet.has(id));
          return {
            ...item,
            id,
            read: isRead,
            time: item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'
          };
        });

      setQuickNotifs(active);
      setUnreadCount(active.filter(n => !n.read).length);
    } catch (err) {
      console.warn('Navbar notification sync error:', err);
    }
  };

  useEffect(() => {
    syncNotifications();
    const handleUpdate = () => syncNotifications();
    window.addEventListener('ott_notifications_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('ott_notifications_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [location.pathname]);

  const handleMarkAllRead = () => {
    const STORAGE_KEY_READ = 'ott_read_notifications';
    let readSet = new Set<string>();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_READ);
      if (raw) readSet = new Set(JSON.parse(raw));
    } catch {}

    quickNotifs.forEach(n => {
      if (n.id) readSet.add(n.id);
      if (n._id) readSet.add(n._id);
    });

    try {
      localStorage.setItem(STORAGE_KEY_READ, JSON.stringify(Array.from(readSet)));
    } catch {}

    setQuickNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    window.dispatchEvent(new Event('ott_notifications_updated'));
    api.client.put('/notifications/read-all').catch(() => {});
  };

  // Elasticsearch Live Search Sync
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchContent(trimmed);
        const list = Array.isArray(res.data) 
          ? res.data 
          : res.data?.data?.videos || res.data?.videos || res.data?.data || [];
        setSearchResults(list);
      } catch (err) {
        console.warn('Navbar search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for search and notif dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSelectVideo = (videoObj: any) => {
    setSearchOpen(false);
    setSearchQuery('');
    const targetId = typeof videoObj === 'string' 
      ? videoObj 
      : videoObj?.id || videoObj?.videoId || videoObj?._id;
    if (targetId) {
      navigate(`/browse?play=${encodeURIComponent(targetId)}`);
      window.dispatchEvent(new CustomEvent('ott_play_video', { 
        detail: { 
          videoId: targetId, 
          video: typeof videoObj === 'object' ? videoObj : null 
        } 
      }));
    }
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-dark-950/90 backdrop-blur-2xl border-b border-yellow-500/15 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-18 sm:h-20">
          {/* Brand Logo & SoNALU Nav Items */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="text-2xl sm:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-lime-400 font-display drop-shadow-[0_0_20px_rgba(234,179,8,0.55)]">
                SoNALU
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-lime-300 bg-lime-400/10 px-1.5 py-0.5 rounded border border-lime-400/30 hidden sm:inline-block">
                CINEMA 4K
              </span>
            </Link>

            {/* Primary SoNALU Navigation */}
            <div className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-semibold">
              <Link
                to="/"
                className={`transition-colors duration-200 ${
                  isActive('/') 
                    ? 'text-white font-extrabold text-glow-brand' 
                    : 'text-slate-300 hover:text-yellow-300'
                }`}
              >
                Home
              </Link>
              <Link
                to="/browse?category=TV%20Series"
                className={`transition-colors duration-200 ${
                  location.search.includes('TV')
                    ? 'text-white font-extrabold text-glow-brand' 
                    : 'text-slate-300 hover:text-yellow-300'
                }`}
              >
                TV Shows
              </Link>
              <Link
                to="/browse?category=Movies"
                className={`transition-colors duration-200 ${
                  location.search.includes('Movies')
                    ? 'text-white font-extrabold text-glow-brand' 
                    : 'text-slate-300 hover:text-yellow-300'
                }`}
              >
                Movies
              </Link>
              <Link
                to="/browse?filter=recent"
                className={`transition-colors duration-200 ${
                  location.search.includes('recent')
                    ? 'text-white font-extrabold text-glow-brand' 
                    : 'text-slate-300 hover:text-yellow-300'
                }`}
              >
                Recently Added
              </Link>
              <Link
                to="/browse?filter=watchlist"
                className={`transition-colors duration-200 ${
                  location.search.includes('watchlist')
                    ? 'text-white font-extrabold text-glow-brand' 
                    : 'text-slate-300 hover:text-yellow-300'
                }`}
              >
                My List
              </Link>
              <Link
                to="/live"
                className={`transition-colors duration-200 flex items-center gap-1.5 ${
                  isActive('/live')
                    ? 'text-lime-400 font-extrabold text-glow-neon' 
                    : 'text-slate-300 hover:text-lime-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Live TV</span>
              </Link>
              <Link
                to="/upload"
                className={`transition-colors duration-200 ${
                  isActive('/upload')
                    ? 'text-yellow-400 font-extrabold text-glow-brand' 
                    : 'text-slate-300 hover:text-yellow-300'
                }`}
              >
                Studio
              </Link>
            </div>
          </div>

          {/* Right-Side Utility Controls */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Elasticsearch Instant Search Box */}
                <div ref={searchRef} className="relative">
                  <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
                      {searching ? <Loader2 size={16} className="animate-spin text-yellow-400" /> : <Search size={16} className="hover:text-yellow-400 transition-colors" />}
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      placeholder="Titles, people, genres..."
                      className="w-36 md:w-48 lg:w-56 pl-9 pr-7 py-1.5 bg-black/60 border border-white/20 hover:border-yellow-400/50 rounded-md text-xs text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 focus:w-64 transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </form>

                  {/* Dropdown Suggestions */}
                  {searchOpen && searchQuery.trim() && (
                    <div className="absolute top-full mt-2 w-80 right-0 bg-dark-950/95 backdrop-blur-2xl border border-yellow-500/30 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
                        <span>Instant Search Results</span>
                        {searching && <span className="text-lime-400">Searching...</span>}
                      </div>

                      {searchResults.length > 0 ? (
                        <div className="divide-y divide-white/[0.04] mt-1 max-h-72 overflow-y-auto">
                          {searchResults.map((video: any, index: number) => (
                            <button
                              key={video.id || video.videoId || video._id || index}
                              onClick={() => handleSelectVideo(video)}
                              className="w-full text-left p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center gap-3 transition-colors group"
                            >
                              <div className="w-10 h-10 rounded-lg bg-dark-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                                {video.thumbnail ? (
                                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Film size={16} className="text-slate-500 group-hover:text-yellow-400" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Play size={12} className="text-white fill-white" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate group-hover:text-yellow-300 transition-colors">
                                  {video.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-slate-300">
                                    {video.category || 'Video'}
                                  </span>
                                  {video.status === 'ready' && (
                                    <span className="text-[9px] text-lime-400 font-bold">4K HLS</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : !searching ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No videos found matching "<span className="text-white">{searchQuery}</span>"
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* KIDS Mode Button (from screenshot) */}
                <Link
                  to="/browse?category=Educational"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-300 hover:text-yellow-400 transition-colors hidden xl:inline-block"
                >
                  KIDS
                </Link>

                {/* DVD / 4K Ultra HD Badge */}
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer hidden xl:inline-block">
                  DVD
                </span>

                {/* VIP Subscription Gift Icon */}
                <Link
                  to="/payment"
                  className="text-slate-300 hover:text-yellow-400 transition-colors p-1.5"
                  title="VIP Benefits & Gift Subscription"
                >
                  <Sparkles size={18} className="text-yellow-400" />
                </Link>

                {/* Notifications Dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className={`p-2 rounded-md transition-all relative ${
                      notifOpen ? 'text-yellow-400' : 'text-slate-300 hover:text-white'
                    }`}
                    title="Notifications"
                  >
                    <Bell size={19} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#e50914] ring-2 ring-dark-950 animate-pulse" />
                    )}
                  </button>

                  {/* Notification Dropdown Drawer */}
                  {notifOpen && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl glass-panel bg-dark-950/95 backdrop-blur-2xl border border-yellow-500/20 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between bg-dark-900/80">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-white text-sm">Notifications</h4>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 text-[10px] font-mono font-bold border border-yellow-400/30">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-yellow-400 hover:text-yellow-300 font-bold transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04] scrollbar-none">
                        {quickNotifs.length === 0 ? (
                          <div className="p-8 text-center space-y-2">
                            <Inbox size={28} className="mx-auto text-slate-600" />
                            <p className="text-xs font-bold text-slate-300">All caught up!</p>
                            <p className="text-[11px] text-slate-500">No new notifications</p>
                          </div>
                        ) : (
                          quickNotifs.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                setNotifOpen(false);
                                navigate('/notifications');
                              }}
                              className={`p-3 hover:bg-white/[0.04] cursor-pointer transition-colors flex items-start gap-3 ${
                                !n.read ? 'bg-yellow-500/[0.05]' : 'opacity-75'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                !n.read ? 'bg-yellow-400' : 'bg-slate-700'
                              }`} />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-xs font-bold text-white truncate">{n.title}</p>
                                <p className="text-[11px] text-slate-400 line-clamp-2">{n.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Classic Netflix Blue Smiley Profile Avatar (From User Screenshot) */}
                <div className="relative group/profile pl-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-md bg-[#0071eb] flex items-center justify-center text-white shadow-md border border-white/20 transition-transform group-hover/profile:scale-105">
                      {/* Classic Netflix Smiley Face Icon */}
                      <svg viewBox="0 0 32 32" className="w-6 h-6 fill-white">
                        <circle cx="10" cy="11" r="2.5" />
                        <circle cx="22" cy="11" r="2.5" />
                        <path d="M 8 20 C 12 25, 20 25, 24 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      </svg>
                    </div>
                    <span className="text-slate-400 group-hover/profile:text-white transition-colors text-[10px]">▼</span>
                  </Link>

                  {/* Profile Dropdown */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-dark-900/95 backdrop-blur-2xl border border-yellow-500/20 rounded-xl shadow-2xl p-2 hidden group-hover/profile:block z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 border-b border-white/10 mb-1">
                      <p className="text-xs font-bold text-white truncate">{user?.username || (user as any)?.firstName || user?.email?.split('@')[0] || 'SoNALU VIP'}</p>
                      <p className="text-[10px] text-yellow-400 font-bold uppercase">SoNALU VIP Ultra HD</p>
                    </div>

                    <Link to="/profile" className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10">
                      Account & Settings
                    </Link>
                    <Link to="/upload" className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10">
                      Studio Media Manager
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" className="block px-3 py-2 rounded-lg text-xs font-semibold text-lime-400 hover:bg-white/10">
                        Admin Console
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border-t border-white/10 mt-1"
                    >
                      Sign Out of SoNALU
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/auth/login"
                  className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.05] border border-white/10 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth/signup"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-500 to-brand-neon hover:from-brand-500 hover:to-brand-600 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                >
                  <Sparkles size={14} />
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex lg:hidden items-center gap-2">
            {isAuthenticated && (
              <Link
                to="/upload"
                className="p-2 rounded-xl bg-brand-600 text-white"
                title="Upload"
              >
                <Upload size={16} />
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-dark-900 border border-white/10 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-dark-950/95 backdrop-blur-2xl border-b border-white/10 px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
              isActive('/') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            <Home size={18} />
            Home
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/live"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/live') ? 'bg-rose-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Radio size={18} className="text-rose-400 animate-pulse" />
                  <span>Live TV Channels</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase">
                  24/7 Live
                </span>
              </Link>
              <Link
                to="/browse"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/browse') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <Compass size={18} />
                Browse 4K
              </Link>
              <Link
                to="/upload"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/upload') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <Upload size={18} />
                Upload Studio
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/profile') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <User size={18} />
                User Profile
              </Link>
              <Link
                to="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/notifications') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <Bell size={18} />
                Notifications
              </Link>
              <Link
                to="/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/analytics') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <BarChart3 size={18} />
                Analytics
              </Link>
              <Link
                to="/payment"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                  isActive('/payment') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <CreditCard size={18} />
                Subscription VIP
              </Link>
              {isAdmin && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                      isActive('/admin') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Shield size={18} />
                    Admin Console
                  </Link>
                  <Link
                    to="/system"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                      isActive('/system') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Activity size={18} className="text-brand-neon" />
                    System Health & Monitoring
                  </Link>
                </>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-400 hover:bg-rose-500/10"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-xl bg-dark-900 border border-white/10 text-sm font-bold text-white"
              >
                Sign In
              </Link>
              <Link
                to="/auth/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-neon text-sm font-bold text-white"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
