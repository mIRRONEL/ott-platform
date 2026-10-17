import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Video,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Activity,
  Tv,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Shield,
  Layers,
  Camera,
  Mic,
  MicOff,
  VideoOff,
  Play,
  Square,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

export default function AdminLiveStudioPage() {
  const [credentials, setCredentials] = useState<{
    serverUrl: string;
    streamKey: string;
    channelId: string;
    playbackUrl: string;
  } | null>(null);

  const [channel, setChannel] = useState<{
    title: string;
    description: string;
    category: string;
    isLive: boolean;
  }>({
    title: 'OTT 4K Cinema Live Broadcast',
    description: 'High-fidelity real-time broadcast with ultra-low latency HLS and interactive live chat.',
    category: 'Cinema Showcase',
    isLive: false
  });

  const [activeTab, setActiveTab] = useState<'webcam' | 'obs'>('webcam');
  const [showKey, setShowKey] = useState(false);
  const [copiedServer, setCopiedServer] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // WebCam Live Streaming State
  const [cameraActive, setCameraActive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [broadcastTime, setBroadcastTime] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const res = await api.getStreamCredentials();
        if (res.data?.data) {
          setCredentials(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching stream credentials:', err);
      }
    };
    loadCredentials();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Format MM:SS for broadcast timer
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start Camera Preview
  const handleEnableCamera = async () => {
    try {
      setStreamError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true
      });

      mediaStreamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setStreamError('Could not access laptop camera or microphone. Please check browser permissions.');
    }
  };

  // Toggle Camera Mute
  const handleToggleCamera = () => {
    if (mediaStreamRef.current) {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOff(!videoTrack.enabled);
      }
    }
  };

  // Toggle Mic Mute
  const handleToggleMic = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Start In-Browser Live Broadcast
  const handleStartBroadcast = async () => {
    if (!cameraActive || !credentials?.streamKey) return;
    try {
      setIsBroadcasting(true);
      setBroadcastTime(0);
      timerRef.current = setInterval(() => {
        setBroadcastTime(prev => prev + 1);
      }, 1000);

      await api.startWebcamStream(credentials.streamKey);
    } catch (err) {
      console.error('Failed to start broadcast:', err);
    }
  };

  // Stop In-Browser Live Broadcast
  const handleStopBroadcast = async () => {
    if (!credentials?.streamKey) return;
    try {
      setIsBroadcasting(false);
      if (timerRef.current) clearInterval(timerRef.current);
      await api.stopWebcamStream(credentials.streamKey);
    } catch (err) {
      console.error('Failed to stop broadcast:', err);
    }
  };

  const handleCopy = async (text: string, type: 'server' | 'key') => {
    await copyToClipboard(text);
    if (type === 'server') {
      setCopiedServer(true);
      setTimeout(() => setCopiedServer(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials?.channelId) return;
    try {
      setSaving(true);
      await api.updateLiveChannel(credentials.channelId, channel);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error updating channel:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-dark-900 via-dark-950 to-red-950/30 border border-red-500/20 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <Video size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest">
                Creator Studio
              </span>
              <span className="text-xs text-slate-400 font-bold">Laptop Camera & OBS Live Ingest</span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">Live Broadcaster & Studio</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/live"
            className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/15 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Tv size={16} className="text-red-400" />
            <span>Open Public Live Arena</span>
          </Link>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-dark-900/60 border border-white/10 w-fit">
        <button
          onClick={() => setActiveTab('webcam')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'webcam'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera size={15} />
          <span>Go Live with Laptop Camera</span>
        </button>
        <button
          onClick={() => setActiveTab('obs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'obs'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Radio size={15} />
          <span>OBS Studio & External RTMP</span>
        </button>
      </div>

      {/* Mode 1: In-Browser Laptop Camera Broadcaster */}
      {activeTab === 'webcam' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Camera Viewfinder & Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative aspect-video bg-black rounded-3xl overflow-hidden glass-panel border border-white/15 shadow-2xl flex items-center justify-center">
              {/* Video Element */}
              <video
                ref={webcamVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${cameraOff ? 'hidden' : 'block'}`}
              />

              {/* Camera Off Placeholder */}
              {cameraOff && (
                <div className="text-center space-y-2 text-slate-400">
                  <VideoOff size={48} className="mx-auto text-slate-600" />
                  <p className="text-sm font-bold">Camera is paused</p>
                </div>
              )}

              {/* Initial Enable Camera Overlay */}
              {!cameraActive && (
                <div className="text-center space-y-4 p-6 z-20">
                  <div className="w-16 h-16 rounded-3xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto animate-pulse">
                    <Camera size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-white">Broadcast from Laptop Camera</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Go live instantly from your web browser with zero software downloads.
                    </p>
                  </div>
                  <button
                    onClick={handleEnableCamera}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 mx-auto shadow-xl hover:shadow-red-500/30 transition-all hover:scale-105"
                  >
                    <Play size={16} />
                    <span>Allow Camera & Mic Access</span>
                  </button>
                </div>
              )}

              {/* Floating Live Badge & Timer */}
              {isBroadcasting && (
                <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" /> ON AIR
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-dark-950/80 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/10">
                    {formatTime(broadcastTime)}
                  </span>
                </div>
              )}

              {/* Error Message */}
              {streamError && (
                <div className="absolute bottom-4 inset-x-4 p-3 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>{streamError}</span>
                </div>
              )}
            </div>

            {/* Viewfinder Controls Bar */}
            {cameraActive && (
              <div className="p-4 rounded-2xl glass-panel border border-white/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleMic}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      micMuted
                        ? 'bg-red-950/80 border-red-500 text-red-400'
                        : 'bg-dark-900 border-white/10 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    <span>{micMuted ? 'Muted' : 'Mic Active'}</span>
                  </button>

                  <button
                    onClick={handleToggleCamera}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      cameraOff
                        ? 'bg-red-950/80 border-red-500 text-red-400'
                        : 'bg-dark-900 border-white/10 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {cameraOff ? <VideoOff size={16} /> : <Video size={16} />}
                    <span>{cameraOff ? 'Camera Paused' : 'Camera Active'}</span>
                  </button>
                </div>

                <div>
                  {!isBroadcasting ? (
                    <button
                      onClick={handleStartBroadcast}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-xl shadow-red-500/25 hover:scale-105"
                    >
                      <Radio size={16} />
                      <span>Start Live Broadcast</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStopBroadcast}
                      className="px-6 py-3 rounded-xl bg-dark-800 hover:bg-dark-700 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg"
                    >
                      <Square size={16} />
                      <span>End Broadcast</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Broadcast Settings */}
          <div className="space-y-6">
            <form onSubmit={handleSaveChannel} className="p-6 rounded-3xl glass-panel border border-white/15 shadow-2xl space-y-4">
              <h3 className="font-extrabold text-white text-sm">Live Broadcast Settings</h3>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Broadcast Title</label>
                  <input
                    type="text"
                    value={channel.title}
                    onChange={(e) => setChannel({ ...channel, title: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-white/15 text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Category</label>
                  <select
                    value={channel.category}
                    onChange={(e) => setChannel({ ...channel, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-white/15 text-white"
                  >
                    <option>Cinema Showcase</option>
                    <option>Gaming & Tech</option>
                    <option>Live Concert / Music</option>
                    <option>Talk Show / Q&A</option>
                    <option>Sports & Events</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Description</label>
                  <textarea
                    value={channel.description}
                    onChange={(e) => setChannel({ ...channel, description: e.target.value })}
                    rows={3}
                    className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-white/15 text-white resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{saveSuccess ? 'Broadcast Details Saved!' : 'Save Broadcast Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mode 2: OBS Studio & RTMP Ingest */}
      {activeTab === 'obs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* RTMP Credentials */}
            <div className="p-6 rounded-3xl glass-panel border border-white/15 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-red-400" />
                  <h2 className="font-extrabold text-white text-base">RTMP Broadcast Ingest Credentials</h2>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">Port 1935 Active</span>
              </div>

              <div className="space-y-4">
                {/* RTMP Server URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Server URL (RTMP Ingest Endpoint)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials?.serverUrl || 'rtmp://180.94.20.40:1935/live'}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-dark-950/90 border border-white/15 font-mono text-xs text-slate-200 select-all"
                    />
                    <button
                      onClick={() => handleCopy(credentials?.serverUrl || 'rtmp://180.94.20.40:1935/live', 'server')}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      {copiedServer ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedServer ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Stream Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Secret Stream Key</label>
                    <span className="text-[10px] text-amber-400">Keep this secret</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? 'text' : 'password'}
                        readOnly
                        value={credentials?.streamKey || 'admin_live_key'}
                        className="w-full px-4 py-2.5 rounded-xl bg-dark-950/90 border border-white/15 font-mono text-xs text-amber-300 select-all tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleCopy(credentials?.streamKey || 'admin_live_key', 'key')}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* OBS Guide */}
            <div className="p-6 rounded-3xl glass-panel border border-white/10 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                <Layers size={18} className="text-brand-400" />
                <h3>How to Broadcast Laptop Camera & Screen via OBS Studio</h3>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
                <li>Download and open <strong>OBS Studio</strong> (Free from <a href="https://obsproject.com" target="_blank" rel="noreferrer" className="text-red-400 underline">obsproject.com</a>).</li>
                <li>Under <strong>Sources</strong>, click <code>+</code> and select <strong>Video Capture Device</strong> ➔ choose your <strong>Integrated Laptop Camera</strong>.</li>
                <li>Under <strong>Sources</strong>, click <code>+</code> and select <strong>Audio Input Capture</strong> ➔ choose your <strong>Microphone</strong>.</li>
                <li>Go to <strong>Settings ➔ Stream</strong>: Service = <strong>Custom...</strong>, Server = <code className="px-1.5 py-0.5 rounded bg-dark-950 text-red-400 font-mono text-[11px]">rtmp://180.94.20.40:1935/live</code>, Stream Key = <code className="px-1.5 py-0.5 rounded bg-dark-950 text-amber-300 font-mono text-[11px]">{credentials?.streamKey || 'admin_live_key'}</code>.</li>
                <li>Click <strong>Start Streaming</strong> in OBS! You are now live across the platform!</li>
              </ol>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-3xl glass-panel border border-white/15 shadow-2xl space-y-4">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Activity size={16} className="text-emerald-400" />
                <span>Signal Monitor</span>
              </h3>

              <div className="p-4 rounded-2xl bg-dark-950/60 border border-white/5 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">RTMP Port:</span>
                  <span className="font-mono text-emerald-400 font-bold">1935 (Ready)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latency:</span>
                  <span className="font-bold text-amber-300">1.2s Low-Latency</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
