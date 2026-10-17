import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Film, 
  Play, 
  Trash2, 
  Cpu, 
  HardDrive, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Flame, 
  Layers, 
  Clock, 
  Sliders, 
  Sparkles,
  Database,
  ArrowUpRight,
  Eye,
  X
} from 'lucide-react';
import api from '../services/api';

interface VideoStudioItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  thumbnail?: string;
  status: string;
  processingStage?: string;
  hlsProgress?: number;
  fileSize: number;
  hasRawMaster: boolean;
  rawSize: number;
  encodedSize: number;
  availableQualities: string[];
  createdAt: string;
}

interface StudioSummaryData {
  counts: {
    total: number;
    staged: number;
    processing: number;
    ready: number;
    failed: number;
  };
  storage: {
    totalRawBytes: number;
    totalRawGB: string;
    totalEncodedBytes: number;
    totalEncodedGB: string;
    totalCombinedGB: string;
  };
  videos: VideoStudioItem[];
}

export default function StudioManager() {
  const [data, setData] = useState<StudioSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'staged' | 'processing' | 'ready' | 'failed'>('all');
  const [selectedVideoForEncode, setSelectedVideoForEncode] = useState<VideoStudioItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Encode modal state
  const [targetProfiles, setTargetProfiles] = useState<string[]>(['1080p', '720p', '480p', '360p']);
  const [encodingPreset, setEncodingPreset] = useState<'superfast' | 'veryfast' | 'medium'>('superfast');
  const [deleteRawAfterEncode, setDeleteRawAfterEncode] = useState(true);

  // Preview state
  const [previewVideo, setPreviewVideo] = useState<VideoStudioItem | null>(null);

  const isMountedRef = useRef(true);
  const dataRef = useRef<StudioSummaryData | null>(null);
  dataRef.current = data;

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      if (isMountedRef.current) {
        setNotification(null);
      }
    }, 5000);
  }, []);

  const fetchSummary = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.getStudioSummary();
      if (res.data?.success && isMountedRef.current) {
        setData(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load studio summary:', err);
      if (isInitial && isMountedRef.current) {
        showNotification('error', 'Failed to fetch studio media inventory.');
      }
    } finally {
      if (isInitial && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [showNotification]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchSummary(true);

    // Polling interval that only runs when processing videos exist
    const interval = setInterval(() => {
      if (dataRef.current?.counts?.processing && dataRef.current.counts.processing > 0) {
        fetchSummary(false);
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchSummary]);

  const handleStartTranscode = async (videoId: string) => {
    try {
      setActionLoading(videoId);
      const res = await api.triggerVideoTranscoding(videoId, {
        profiles: targetProfiles,
        preset: encodingPreset,
        deleteRawAfterEncode
      });
      if (res.data?.success) {
        showNotification('success', `🚀 Transcoding started for video! Multi-core FFmpeg is generating ${targetProfiles.join(', ')}.`);
        setSelectedVideoForEncode(null);
        await fetchSummary();
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to start transcoding');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeRaw = async (video: VideoStudioItem) => {
    if (!window.confirm(`Are you sure you want to purge the raw master file for "${video.title}"?\n\nThis will free ${(video.rawSize / (1024 * 1024 * 1024)).toFixed(2)} GB on disk. The HLS stream will remain 100% playable for all users.`)) {
      return;
    }

    try {
      setActionLoading(`raw-${video.id}`);
      const res = await api.deleteRawMasterVideo(video.id);
      if (res.data?.success) {
        showNotification('success', `✓ Purged raw file! Reclaimed ${res.data.data?.reclaimedMB || 'several'} MB of disk space.`);
        await fetchSummary();
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to purge raw file');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteVideo = async (video: VideoStudioItem) => {
    if (!window.confirm(`Permanently delete "${video.title}"?\n\nThis will delete the raw file, all HLS video segments, and remove it from the catalog.`)) {
      return;
    }

    try {
      setActionLoading(`del-${video.id}`);
      await api.deleteVideo(video.id);
      showNotification('success', `✓ Deleted "${video.title}" from platform.`);
      await fetchSummary();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete video');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleProfile = (quality: string) => {
    setTargetProfiles(prev => 
      prev.includes(quality)
        ? prev.filter(q => q !== quality)
        : [...prev, quality]
    );
  };

  const filteredVideos = (data?.videos || []).filter(v => {
    if (filter === 'staged') return v.status === 'staged' || v.processingStage === 'staged_raw';
    if (filter === 'processing') return v.status === 'processing';
    if (filter === 'ready') return v.status === 'ready';
    if (filter === 'failed') return v.status === 'error' || v.status === 'failed';
    return true;
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-2xl transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs sm:text-sm font-semibold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Storage & Fleet Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Raw Masters (Staged)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <HardDrive size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{data?.storage?.totalRawGB || '0.00'}</span>
            <span className="text-xs font-bold text-slate-400">GB</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Source MP4 files waiting on disk</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Encoded Streams (HLS)</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Film size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{data?.storage?.totalEncodedGB || '0.00'}</span>
            <span className="text-xs font-bold text-slate-400">GB</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-bitrate playlists & TS segments</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Combined Storage</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Database size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{data?.storage?.totalCombinedGB || '0.00'}</span>
            <span className="text-xs font-bold text-slate-400">GB</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total disk footprint in volume</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transcoding Queue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{data?.counts?.ready || 0}</span>
            <span className="text-xs font-bold text-emerald-400">Ready</span>
            <span className="text-xs font-bold text-slate-500 ml-1">/ {data?.counts?.staged || 0} Staged</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active streamable video catalog</p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-dark-900/80 border border-white/10">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Videos ({data?.counts?.total || 0})
          </button>
          <button
            onClick={() => setFilter('staged')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'staged' ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25' : 'text-slate-400 hover:text-white'
            }`}
          >
            🟡 Staged Raw ({data?.counts?.staged || 0})
          </button>
          <button
            onClick={() => setFilter('processing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'processing' ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/25' : 'text-slate-400 hover:text-white'
            }`}
          >
            🔵 Processing ({data?.counts?.processing || 0})
          </button>
          <button
            onClick={() => setFilter('ready')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'ready' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'text-slate-400 hover:text-white'
            }`}
          >
            🟢 Ready to Stream ({data?.counts?.ready || 0})
          </button>
        </div>

        <button
          onClick={() => fetchSummary(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all ml-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Video Inventory Table / Grid */}
      {loading && !data ? (
        <div className="py-20 text-center">
          <Loader2 size={36} className="animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading media library and storage matrix...</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-dark-900/50 border border-white/10">
          <Film size={40} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No videos found in this category</h3>
          <p className="text-xs text-slate-400">Upload a video or change your filter selection above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVideos.map((video) => {
            const isStaged = video.status === 'staged' || video.processingStage === 'staged_raw';
            const isProcessing = video.status === 'processing';
            const isReady = video.status === 'ready';
            const isFailed = video.status === 'error' || video.status === 'failed';

            return (
              <div 
                key={video.id}
                className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 group"
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-28 sm:w-36 aspect-video rounded-2xl bg-dark-950 overflow-hidden border border-white/10 relative shrink-0">
                    {video.thumbnail ? (
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e: any) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Film size={24} />
                      </div>
                    )}
                    
                    {/* Status Pill on Thumbnail */}
                    <div className="absolute top-1.5 left-1.5">
                      {isStaged && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                          RAW DRAFT
                        </span>
                      )}
                      {isProcessing && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/90 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          ENCODING
                        </span>
                      )}
                      {isReady && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-wider">
                          HLS LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300">
                        {video.category}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ID: {video.id.slice(0, 8)}...
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-white truncate">
                      {video.title}
                    </h3>

                    {/* Progress Bar for Active Encoding */}
                    {isProcessing && (
                      <div className="space-y-1 pt-1 max-w-md">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-cyan-300">Multi-Bitrate Transcoding: {video.hlsProgress || 10}%</span>
                          <span className="text-slate-400">Generating Profiles...</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-brand-500 transition-all duration-500"
                            style={{ width: `${Math.max(10, video.hlsProgress || 10)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Quality Badges */}
                    {isReady && video.availableQualities?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {video.availableQualities.map(q => (
                          <span key={q} className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-[10px] font-bold text-brand-300 uppercase">
                            {q}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Disk Storage Breakdown */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400">
                      {video.hasRawMaster ? (
                        <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          <HardDrive size={12} />
                          Raw Master: <strong>{formatBytes(video.rawSize || video.fileSize)}</strong>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">
                          Raw Purged (Disk Saved)
                        </span>
                      )}

                      {video.encodedSize > 0 && (
                        <span className="inline-flex items-center gap-1 text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
                          <Film size={12} />
                          HLS Stream: <strong>{formatBytes(video.encodedSize)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:shrink-0 justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-white/10">
                  {/* Staged -> Trigger Transcoding */}
                  {isStaged && (
                    <button
                      onClick={() => setSelectedVideoForEncode(video)}
                      disabled={actionLoading === video.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-black shadow-lg shadow-brand-500/25 transition-all"
                    >
                      <Cpu size={14} />
                      <span>Start Transcoding</span>
                    </button>
                  )}

                  {/* Ready -> Purge Raw Master File */}
                  {isReady && video.hasRawMaster && (
                    <button
                      onClick={() => handlePurgeRaw(video)}
                      disabled={actionLoading === `raw-${video.id}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
                      title="Purge raw master video file to free disk space"
                    >
                      {actionLoading === `raw-${video.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      <span>Purge Raw ({formatBytes(video.rawSize || video.fileSize)})</span>
                    </button>
                  )}

                  {/* Ready or Failed -> Re-Transcode if raw exists */}
                  {(isReady || isFailed) && video.hasRawMaster && (
                    <button
                      onClick={() => setSelectedVideoForEncode(video)}
                      disabled={actionLoading === video.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
                      title="Re-run transcoding with different quality profiles"
                    >
                      <RefreshCw size={13} />
                      <span>Re-Encode</span>
                    </button>
                  )}

                  {/* Full Delete */}
                  <button
                    onClick={() => handleDeleteVideo(video)}
                    disabled={actionLoading === `del-${video.id}`}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-all"
                    title="Delete video completely"
                  >
                    {actionLoading === `del-${video.id}` ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transcoding Configuration Modal */}
      {selectedVideoForEncode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-white/15 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Transcoding Studio</h3>
                  <p className="text-xs text-slate-400">{selectedVideoForEncode.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVideoForEncode(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quality Profiles Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target HLS Resolutions</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { q: '1080p', label: '1080p FHD', bit: '5.0 Mbps' },
                  { q: '720p', label: '720p HD', bit: '2.5 Mbps' },
                  { q: '480p', label: '480p SD', bit: '1.5 Mbps' },
                  { q: '360p', label: '360p Mobile', bit: '800 Kbps' },
                ].map(item => {
                  const active = targetProfiles.includes(item.q);
                  return (
                    <button
                      key={item.q}
                      type="button"
                      onClick={() => toggleProfile(item.q)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        active 
                          ? 'bg-brand-500/20 border-brand-500 text-white shadow-lg shadow-brand-500/20' 
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-black">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.bit}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Encoding Preset */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">FFmpeg Speed Preset</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { p: 'superfast', label: '⚡ Superfast', desc: 'Fastest transcode' },
                  { p: 'veryfast', label: '⚖️ Veryfast', desc: 'Balanced' },
                  { p: 'medium', label: '🎯 Medium', desc: 'Best compression' },
                ].map(item => (
                  <button
                    key={item.p}
                    type="button"
                    onClick={() => setEncodingPreset(item.p as any)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      encodingPreset === item.p 
                        ? 'bg-brand-500/20 border-brand-500 text-white' 
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-black">{item.label}</div>
                    <div className="text-[10px] text-slate-400">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Purge Raw Option */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteRawAfterEncode}
                onChange={(e) => setDeleteRawAfterEncode(e.target.checked)}
                className="mt-0.5 rounded border-white/20 text-brand-500 focus:ring-brand-500 bg-dark-900"
              />
              <div className="text-xs">
                <span className="font-bold text-amber-200 block">Auto-Purge Raw Master File After Completion</span>
                <span className="text-slate-400 text-[11px]">
                  Automatically deletes the {formatBytes(selectedVideoForEncode.rawSize || selectedVideoForEncode.fileSize)} raw MP4 to save disk space once HLS tracks are generated.
                </span>
              </div>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedVideoForEncode(null)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={targetProfiles.length === 0 || actionLoading === selectedVideoForEncode.id}
                onClick={() => handleStartTranscode(selectedVideoForEncode.id)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-black shadow-xl shadow-brand-500/25 disabled:opacity-50"
              >
                {actionLoading === selectedVideoForEncode.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Cpu size={16} />
                )}
                <span>Launch Transcoding</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
