import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Radio,
  Users,
  Send,
  Sparkles,
  Share2,
  Tv,
  Video,
  ShieldCheck,
  Play,
  Flame,
  Heart
} from 'lucide-react';
import HLS from 'hls.js';
import api from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

interface LiveChannel {
  channelId: string;
  streamKey: string;
  title: string;
  description?: string;
  category: string;
  creatorName: string;
  creatorAvatar?: string;
  thumbnail?: string;
  isLive: boolean;
  resolution?: string;
  liveViewers?: number;
  hlsPath?: string;
  startedAt?: string;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  userRole?: string;
}

export default function LivePage() {
  const { channelId } = useParams<{ channelId?: string }>();
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<LiveChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeReactions, setActiveReactions] = useState<{ id: string; emoji: string }[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = (() => {
    try {
      const stored = localStorage.getItem('user_data');
      return stored ? JSON.parse(stored) : { name: 'You (Guest)', role: 'viewer' };
    } catch {
      return { name: 'Guest Viewer', role: 'viewer' };
    }
  })();

  // 1. Fetch live channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoading(true);
        const res = await api.getLiveChannels();
        const list: LiveChannel[] = res.data?.data || [];
        setChannels(list);

        if (channelId) {
          const found = list.find(c => c.channelId === channelId || c.streamKey === channelId);
          setActiveChannel(found || list[0] || null);
        } else if (list.length > 0) {
          const liveOne = list.find(c => c.isLive) || list[0];
          setActiveChannel(liveOne);
        }
      } catch (err) {
        console.error('Error fetching live channels:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
    const interval = setInterval(fetchChannels, 10000);
    return () => clearInterval(interval);
  }, [channelId]);

  // 2. Initialize Video Player
  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isStandardPort = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443');
    const apiBase = isStandardPort ? '' : `http://${window.location.hostname}:3000`;
    const hlsUrl = `${apiBase}/api/live/${activeChannel.streamKey}/index.m3u8`;

    if (HLS.isSupported()) {
      const hls = new HLS({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
        maxBufferLength: 4,
        maxMaxBufferLength: 8,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 2,
        nudgeMaxRetry: 5
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;

      hls.on(HLS.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          console.log('Live stream standby mode:', data.type);
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = hlsUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannel]);

  // 3. Real-Time Chat Polling & Sync
  useEffect(() => {
    if (!activeChannel) return;

    const syncChat = async () => {
      try {
        const res = await api.getLiveChat(activeChannel.channelId);
        if (res.data?.data) {
          setMessages(res.data.data);
        }
      } catch (err) {
        console.error('Chat sync error:', err);
      }
    };

    syncChat();
    const chatInterval = setInterval(syncChat, 2000);
    return () => clearInterval(chatInterval);
  }, [activeChannel?.channelId]);

  // Scroll chat to bottom inside container ONLY (does not hijack page window scroll)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChannel) return;

    const messageText = inputMessage.trim();
    setInputMessage('');

    // Optimistic UI update
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      username: currentUser.name || 'You',
      message: messageText,
      userRole: currentUser.role || 'viewer',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      await api.sendLiveChat(activeChannel.channelId, {
        message: messageText,
        username: currentUser.name,
        userId: currentUser.id || 'user_demo',
        userRole: currentUser.role || 'viewer'
      });
    } catch (err) {
      console.error('Failed to send live chat message:', err);
    }
  };

  const handleSendReaction = (emoji: string) => {
    const reactionId = String(Date.now());
    setActiveReactions(prev => [...prev, { id: reactionId, emoji }]);
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 2000);
  };

  if (loading && channels.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-400">Connecting to Live Ingest Network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-red-950/40 via-dark-900/80 to-dark-950/80 border border-red-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="ambient-glow top-0 right-1/4 w-80 h-40 bg-red-500/20" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-pulse shadow-lg">
            <Radio size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> Live Broadcasting
              </span>
              <span className="text-xs text-slate-400 font-bold">Ultra-Low Latency RTMP / LL-HLS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
              OTT Live Arena & Creator Studio
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Link
            to="/admin/live"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg hover:shadow-red-500/25"
          >
            <Video size={16} />
            <span>Go Live / Creator Studio</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Live Player + Live Chat Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Live Video Player & Stream Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden glass-panel border border-white/20 shadow-2xl group">
            {/* Live Floating Indicators */}
            <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-red-600/90 backdrop-blur-md text-white text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg border border-red-400/40">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" /> LIVE
              </span>
              <span className="px-3 py-1 rounded-xl bg-dark-950/80 backdrop-blur-md text-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/10">
                <Users size={14} className="text-red-400" /> {viewerCount} Viewers
              </span>
              <span className="px-3 py-1 rounded-xl bg-dark-950/80 backdrop-blur-md text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-lg border border-emerald-500/20">
                <ShieldCheck size={14} /> 60 FPS 4K
              </span>
            </div>

            {/* Video Element */}
            <video
              ref={videoRef}
              controls
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              poster={activeChannel?.thumbnail}
            >
              Your browser does not support the video tag.
            </video>

            {/* Floating Reactions Overlay */}
            <div className="absolute bottom-6 right-6 pointer-events-none z-30 flex flex-col gap-2">
              {activeReactions.map((r) => (
                <span
                  key={r.id}
                  className="text-3xl animate-in slide-in-from-bottom fade-in duration-300 drop-shadow-2xl"
                >
                  {r.emoji}
                </span>
              ))}
            </div>
          </div>

          {/* Active Stream Metadata Card */}
          {activeChannel && (
            <div className="p-6 rounded-3xl glass-panel border border-white/10 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={activeChannel.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={activeChannel.creatorName}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-red-500 shadow-md"
                  />
                  <div>
                    <h2 className="text-xl font-extrabold text-white">{activeChannel.title}</h2>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="font-bold text-slate-200">{activeChannel.creatorName}</span>
                      <span>•</span>
                      <span className="text-red-400 font-bold">{activeChannel.category}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(window.location.href)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Share2 size={14} /> Share
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeChannel.description || 'High-fidelity real-time broadcast with ultra-low latency HLS ingestion and interactive community live chat.'}
              </p>
            </div>
          )}
        </div>

        {/* Right 1 Col: Synchronized Real-Time Live Chat */}
        <div className="h-[600px] rounded-3xl glass-panel border border-white/15 shadow-2xl flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 bg-dark-900/60 backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="font-extrabold text-white text-sm">Live Broadcast Chat</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{viewerCount} online</span>
          </div>

          {/* Messages Scroll View */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                <Sparkles size={24} className="text-red-400/60 animate-bounce" />
                <p className="font-bold text-slate-300">Welcome to Live Chat!</p>
                <p className="text-[11px] text-slate-500">Say hello and react to the live broadcast.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="space-y-0.5 animate-in fade-in duration-150">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-[11px] font-black ${
                      m.userRole === 'admin' ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {m.username}:
                    </span>
                    <span className="text-slate-100 font-medium break-words leading-relaxed">
                      {m.message}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Emoji Reaction Bar */}
          <div className="px-4 py-2 border-t border-white/5 bg-dark-950/40 flex items-center justify-around">
            {['❤️', '🔥', '👏', '🎬', '🚀'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendReaction(emoji)}
                className="p-1.5 hover:scale-125 transition-transform text-base"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-dark-900/80 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Send a live message..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-dark-950/80 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              maxLength={250}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-all shadow-md"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* Available Live & Scheduled Channels Shelf */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv size={20} className="text-red-400" />
            <h3 className="text-lg font-black text-white">Live Broadcast Channels</h3>
          </div>
          <span className="text-xs text-slate-400 font-bold">{channels.length} Available Channels</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel) => (
            <div
              key={channel.channelId}
              onClick={() => setActiveChannel(channel)}
              className={`rounded-3xl glass-panel border overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                activeChannel?.channelId === channel.channelId
                  ? 'border-red-500 ring-2 ring-red-500/30'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <div className="relative aspect-video bg-dark-950 overflow-hidden">
                <img
                  src={channel.thumbnail || 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop&q=80'}
                  alt={channel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    channel.isLive ? 'bg-red-600 text-white animate-pulse' : 'bg-dark-900/80 text-slate-400'
                  }`}>
                    {channel.isLive ? '🔴 LIVE' : 'STANDBY'}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <h4 className="font-extrabold text-white text-sm line-clamp-1">{channel.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-1">{channel.creatorName} • {channel.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
