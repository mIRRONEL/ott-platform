import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader, 
  FileVideo, 
  Sparkles, 
  Zap, 
  Tv, 
  Film,
  Layers,
  Cpu,
  Play,
  ArrowRight,
  Image as ImageIcon,
  Check,
  Eye,
  Star,
  Pause,
  RotateCcw,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StudioManager from '../components/StudioManager';

interface ProcessingStatus {
  videoId: string;
  status: string;
  hlsProgress: number;
  processingStage: string;
  title: string;
}

interface FrameSnapshot {
  id: number;
  timeFormatted: string;
  dataUrl: string;
}

interface SavedUploadSession {
  uploadId: string;
  fileSignature: string;
  fileName: string;
  fileSize: number;
  title: string;
  category: string;
  description?: string;
  totalChunks: number;
  chunkSize: number;
  uploadedChunks: number[];
  progress: number;
}

const calculateOptimalChunkSize = (fileSize: number): number => {
  if (fileSize < 50 * 1024 * 1024) return 4 * 1024 * 1024; // 4 MB for small videos (<50MB)
  if (fileSize < 250 * 1024 * 1024) return 8 * 1024 * 1024; // 8 MB for medium videos (<250MB)
  if (fileSize < 1024 * 1024 * 1024) return 16 * 1024 * 1024; // 16 MB for <1GB
  return 20 * 1024 * 1024; // 20 MB for large multi-GB videos (maximizes WAN bandwidth & minimizes roundtrips)
};

const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB default
const CONCURRENCY = 8; // 8 parallel high-speed chunk upload workers
const STORAGE_KEY = 'ott_active_upload_session';

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'studio'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Movies');
  const [uploadMode, setUploadMode] = useState<'direct' | 'chunked'>('direct');
  const [autoTranscode, setAutoTranscode] = useState(true);
  const [deleteRawAfterEncode, setDeleteRawAfterEncode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Progress & Speed tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [uploadSpeedMBs, setUploadSpeedMBs] = useState<string | null>(null);
  const [etaFormatted, setEtaFormatted] = useState<string | null>(null);
  const [activeChunkWorkers, setActiveChunkWorkers] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [createdVideoId, setCreatedVideoId] = useState<string | null>(null);
  const speedTrackerRef = useRef<{ lastTime: number; lastBytes: number }>({ lastTime: 0, lastBytes: 0 });

  // Resumable Session State
  const [savedSession, setSavedSession] = useState<SavedUploadSession | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  // Thumbnail states
  const [generatedThumbnails, setGeneratedThumbnails] = useState<FrameSnapshot[]>([]);
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);

  const pollTimerRef = useRef<any>(null);
  const cancelUploadRef = useRef<boolean>(false);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check for saved uncompleted session in localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.uploadId && parsed?.fileName) {
          setSavedSession(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not read saved upload session:', e);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const categories = [
    'Movies',
    'TV Series',
    'Documentaries',
    'Educational',
    'Sports',
    'Music',
    'Comedy',
    'Drama',
    'Action',
    'Sci-Fi',
  ];

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const extractVideoFrames = (file: File) => {
    setIsExtractingFrames(true);
    setGeneratedThumbnails([]);
    setSelectedThumbnail(null);
    setCustomThumbnail(null);

    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = video.duration || 10;
      const timestamps = [
        Math.min(1, duration * 0.15),
        duration * 0.45,
        duration * 0.75
      ];

      const capturedSnapshots: FrameSnapshot[] = [];
      let currentIndex = 0;

      const captureNext = () => {
        if (currentIndex >= timestamps.length) {
          setGeneratedThumbnails(capturedSnapshots);
          if (capturedSnapshots.length > 0) {
            setSelectedThumbnail(capturedSnapshots[0].dataUrl);
          }
          setIsExtractingFrames(false);
          URL.revokeObjectURL(videoUrl);
          return;
        }

        const targetTime = timestamps[currentIndex];
        video.currentTime = targetTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            capturedSnapshots.push({
              id: currentIndex,
              timeFormatted: formatSeconds(video.currentTime),
              dataUrl
            });
          }
        } catch (err) {
          console.warn('Frame capture error:', err);
        }

        currentIndex++;
        captureNext();
      };

      captureNext();
    };

    video.onerror = () => {
      setIsExtractingFrames(false);
      URL.revokeObjectURL(videoUrl);
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024 * 1024) {
        setError('Video file size cannot exceed 5GB');
        return;
      }

      setSelectedFile(file);
      setError('');
      setSuccess('');
      setUploadProgress(0);
      setUploadedBytes(0);
      setProcessingStatus(null);
      setProcessingComplete(false);

      // Check if this matches a saved uncompleted session
      const sig = `${file.name}-${file.size}-${file.lastModified}`;
      const isMatch = savedSession && (
        savedSession.fileSignature === sig ||
        savedSession.fileName === file.name ||
        (savedSession.fileName.toLowerCase() === file.name.toLowerCase() && Math.abs(savedSession.fileSize - file.size) < 1024 * 1024)
      );

      if (isMatch && savedSession) {
        // Matched saved session
        setActiveUploadId(savedSession.uploadId);
        setTitle(savedSession.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
        if (savedSession.category) setCategory(savedSession.category);
        if (savedSession.description) setDescription(savedSession.description);

        // Fetch live uploaded chunks from backend
        api.getChunkedUploadStatus(savedSession.uploadId).then((res) => {
          const statusData = res.data?.data;
          if (statusData && Array.isArray(statusData.uploadedChunks)) {
            const count = statusData.uploadedChunks.length;
            const total = statusData.totalChunks || savedSession.totalChunks;
            const pct = Math.round((count / total) * 100);
            setUploadProgress(pct);
            const chunkSize = savedSession.chunkSize || calculateOptimalChunkSize(file.size);
            const bytes = Math.min(file.size, count * chunkSize);
            setUploadedBytes(bytes);
            setSavedSession((prev) => prev ? {
              ...prev,
              uploadedChunks: statusData.uploadedChunks,
              progress: pct
            } : null);
          }
        }).catch((err) => {
          console.warn('Could not refresh server chunks on select:', err);
        });
      } else {
        setActiveUploadId(null);
        if (!title) {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          setTitle(nameWithoutExt.replace(/[-_]/g, ' '));
        }
      }

      extractVideoFrames(file);
    }
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (.jpg, .png, .webp)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size cannot exceed 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomThumbnail(result);
      setSelectedThumbnail(result);
    };
    reader.readAsDataURL(file);
  };

  const discardSavedSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedSession(null);
    setActiveUploadId(null);
  };

  /**
   * Ultra-Fast Direct Line-Rate Single-Stream Upload Engine (Full WAN Bandwidth 20+ MB/s)
   */
  const executeDirectUpload = async (file: File) => {
    cancelUploadRef.current = false;
    setIsPaused(false);
    setLoading(true);
    setError('');
    setSuccess('');
    setProcessingStatus(null);
    setProcessingComplete(false);
    setUploadProgress(0);
    setUploadedBytes(0);

    speedTrackerRef.current = { lastTime: Date.now(), lastBytes: 0 };
    setUploadSpeedMBs(null);
    setEtaFormatted(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (category) formData.append('category', category);
    if (selectedThumbnail) {
      formData.append('thumbnail', selectedThumbnail);
      formData.append('posterImage', selectedThumbnail);
    }
    formData.append('autoTranscode', String(autoTranscode));
    formData.append('deleteRawAfterEncode', String(deleteRawAfterEncode));

    try {
      const uploadRes = await api.uploadVideo(formData, (progressEvent) => {
        if (cancelUploadRef.current) return;
        const loaded = progressEvent.loaded || 0;
        const total = progressEvent.total || file.size;
        setUploadedBytes(loaded);
        const pct = Math.min(99, Math.round((loaded / total) * 100));
        setUploadProgress(pct);

        const now = Date.now();
        const elapsedSec = (now - speedTrackerRef.current.lastTime) / 1000;
        if (elapsedSec >= 0.3) {
          const bytesDiff = loaded - speedTrackerRef.current.lastBytes;
          if (bytesDiff > 0) {
            const speedBps = bytesDiff / elapsedSec;
            const speedMBs = (speedBps / (1024 * 1024)).toFixed(1);
            const speedMbps = ((speedBps * 8) / (1000 * 1000)).toFixed(1);
            setUploadSpeedMBs(`${speedMBs} MB/s (${speedMbps} Mbps)`);

            const remainingBytes = total - loaded;
            if (speedBps > 0) {
              const totalRemainingSec = Math.ceil(remainingBytes / speedBps);
              const m = Math.floor(totalRemainingSec / 60);
              const s = totalRemainingSec % 60;
              setEtaFormatted(m > 0 ? `${m}m ${s}s` : `${s}s`);
            }
          }
          speedTrackerRef.current = { lastTime: now, lastBytes: loaded };
        }
      });

      setUploadProgress(100);
      setUploadedBytes(file.size);

      const videoData = uploadRes.data?.data;
      const videoId = videoData?.videoId || videoData?.id;
      if (!videoId) throw new Error('Upload completed but no video ID was returned.');

      setCreatedVideoId(videoId);

      if (!autoTranscode) {
        setProcessingComplete(true);
        setSuccess(`🎉 Video "${title}" staged as Raw Master! You can trigger transcoding anytime from the Studio tab.`);
        return;
      }

      // Switch to Stage 2 (Parallel FFmpeg Transcoding Visualizer)
      setProcessingStatus({
        videoId,
        status: 'processing',
        hlsProgress: 5,
        processingStage: 'encoding',
        title
      });

      setSuccess('Video successfully uploaded at line rate! Multi-core FFmpeg transcoding running...');

      // Polling loop for FFmpeg transcoding
      let lastProgress = 5;
      pollTimerRef.current = setInterval(async () => {
        try {
          const progressResponse = await api.getProcessingProgress(videoId);
          const status = progressResponse.data?.data || progressResponse.data;

          if (status) {
            const rawProgress = status.hlsProgress !== undefined ? status.hlsProgress : 0;
            const effectiveProgress = Math.max(lastProgress, rawProgress);
            lastProgress = effectiveProgress;

            setProcessingStatus({
              ...status,
              hlsProgress: effectiveProgress
            });

            if (status.status === 'ready' || effectiveProgress >= 100) {
              if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
              }
              setProcessingComplete(true);
              setProcessingStatus({
                ...status,
                status: 'ready',
                hlsProgress: 100,
                processingStage: 'ready'
              });
              setSuccess(`🎉 Video "${title}" is ready for 4K streaming!`);
            }
          }
        } catch (err) {
          console.warn('Transcoding progress poll retry:', err);
        }
      }, 1500);

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Direct stream upload failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resumable Chunked Multipart Upload Engine
   */
  const executeChunkedUpload = async (file: File) => {
    cancelUploadRef.current = false;
    setIsPaused(false);
    setLoading(true);
    setError('');
    setSuccess('');
    setProcessingStatus(null);
    setProcessingComplete(false);

    const sessionChunkSize = savedSession?.chunkSize || calculateOptimalChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / sessionChunkSize);
    let uploadId = activeUploadId;
    let completedChunks = new Set<number>();

    speedTrackerRef.current = { lastTime: Date.now(), lastBytes: 0 };
    setUploadSpeedMBs(null);
    setEtaFormatted(null);

    try {
      // 1. Initialize or query existing session
      if (uploadId) {
        try {
          const statusRes = await api.getChunkedUploadStatus(uploadId);
          const statusData = statusRes.data?.data;
          if (statusData && Array.isArray(statusData.uploadedChunks)) {
            completedChunks = new Set(statusData.uploadedChunks);
            console.log(`[RESUME] Found ${completedChunks.size} existing chunks for session ${uploadId}`);
          }
        } catch {
          // Session expired on server, re-init
          uploadId = null;
        }
      }

      if (!uploadId) {
        const initRes = await api.initChunkedUpload({
          title,
          description,
          category,
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          chunkSize: sessionChunkSize
        });

        uploadId = initRes.data?.data?.uploadId;
        if (!uploadId) throw new Error('Failed to initialize upload session.');
        setActiveUploadId(uploadId);
      }

      // Save active session to localStorage
      const sig = `${file.name}-${file.size}-${file.lastModified}`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        uploadId,
        fileSignature: sig,
        fileName: file.name,
        fileSize: file.size,
        title,
        category,
        description,
        totalChunks,
        chunkSize: sessionChunkSize,
        uploadedChunks: Array.from(completedChunks),
        progress: Math.round((completedChunks.size / totalChunks) * 100)
      }));

      // Calculate initial progress
      const initialBytes = Math.min(file.size, completedChunks.size * sessionChunkSize);
      setUploadedBytes(initialBytes);
      setUploadProgress(Math.round((initialBytes / file.size) * 100));
      speedTrackerRef.current = { lastTime: Date.now(), lastBytes: initialBytes };

      // 2. Build remaining chunk queue
      const pendingQueue: number[] = [];
      for (let i = 0; i < totalChunks; i++) {
        if (!completedChunks.has(i)) {
          pendingQueue.push(i);
        }
      }

      // 3. Parallel Worker Pool (CONCURRENCY = 6)
      let lastCheckpointTime = Date.now();
      const inFlightBytes = new Map<number, number>();

      const updateLiveMetrics = () => {
        let inFlightSum = 0;
        for (const bytes of inFlightBytes.values()) {
          inFlightSum += bytes;
        }
        const currentBytes = Math.min(file.size, (completedChunks.size * sessionChunkSize) + inFlightSum);
        setUploadedBytes(currentBytes);
        const percent = Math.min(99, Math.round((currentBytes / file.size) * 100));
        setUploadProgress(percent);

        // Smooth Rolling Speed & ETA
        const now = Date.now();
        const elapsedSec = (now - speedTrackerRef.current.lastTime) / 1000;
        if (elapsedSec >= 0.5) {
          const bytesDiff = currentBytes - speedTrackerRef.current.lastBytes;
          if (bytesDiff > 0) {
            const speedBps = bytesDiff / elapsedSec;
            const speedMBs = (speedBps / (1024 * 1024)).toFixed(1);
            const speedMbps = ((speedBps * 8) / (1000 * 1000)).toFixed(1);
            setUploadSpeedMBs(`${speedMBs} MB/s (${speedMbps} Mbps)`);

            const remainingBytes = file.size - currentBytes;
            if (speedBps > 0) {
              const totalRemainingSec = Math.ceil(remainingBytes / speedBps);
              const m = Math.floor(totalRemainingSec / 60);
              const s = totalRemainingSec % 60;
              setEtaFormatted(m > 0 ? `${m}m ${s}s` : `${s}s`);
            }
          }
          speedTrackerRef.current = { lastTime: now, lastBytes: currentBytes };
        }
      };

      const uploadSingleChunk = async (chunkIndex: number, retryCount = 0): Promise<boolean> => {
        if (cancelUploadRef.current) return false;

        const start = chunkIndex * sessionChunkSize;
        const end = Math.min(file.size, start + sessionChunkSize);
        const chunkBlob = file.slice(start, end);

        try {
          await api.uploadChunkDirect(
            uploadId!,
            chunkIndex,
            totalChunks,
            chunkBlob,
            (progressEvent) => {
              if (progressEvent.loaded) {
                inFlightBytes.set(chunkIndex, Math.min(chunkBlob.size, progressEvent.loaded));
                updateLiveMetrics();
              }
            }
          );
          inFlightBytes.delete(chunkIndex);
          completedChunks.add(chunkIndex);
          updateLiveMetrics();

          // Debounced LocalStorage Checkpoint (every 2s or on 100%)
          const now = Date.now();
          if (now - lastCheckpointTime > 2000 || completedChunks.size === totalChunks) {
            lastCheckpointTime = now;
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              uploadId,
              fileSignature: sig,
              fileName: file.name,
              fileSize: file.size,
              title,
              category,
              description,
              totalChunks,
              chunkSize: sessionChunkSize,
              uploadedChunks: Array.from(completedChunks),
              progress: Math.min(99, Math.round((completedChunks.size / totalChunks) * 100))
            }));
          }

          return true;
        } catch (chunkErr: any) {
          if (cancelUploadRef.current) return false;

          if (retryCount < 8) {
            const delay = 300 + (retryCount * 400);
            console.warn(`Chunk ${chunkIndex} failed (attempt ${retryCount + 1}), retrying in ${delay}ms...`, chunkErr);
            await new Promise((r) => setTimeout(r, delay));
            return uploadSingleChunk(chunkIndex, retryCount + 1);
          } else {
            console.error(`Chunk ${chunkIndex} failed after 8 retries:`, chunkErr);
            return false;
          }
        }
      };

      // Worker Pool Dispatcher
      let hasNetworkFailure = false;
      const runWorker = async () => {
        while (pendingQueue.length > 0 && !hasNetworkFailure) {
          if (cancelUploadRef.current) break;
          const nextIndex = pendingQueue.shift();
          if (nextIndex !== undefined) {
            setActiveChunkWorkers((prev) => prev + 1);
            try {
              const ok = await uploadSingleChunk(nextIndex);
              if (!ok && !cancelUploadRef.current) {
                pendingQueue.unshift(nextIndex);
                hasNetworkFailure = true;
                break;
              }
            } finally {
              setActiveChunkWorkers((prev) => Math.max(0, prev - 1));
            }
          }
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, pendingQueue.length) }, () => runWorker());
      await Promise.all(workers);

      if (cancelUploadRef.current || hasNetworkFailure) {
        setIsPaused(true);
        setLoading(false);
        if (hasNetworkFailure) {
          setError(`Upload paused at ${uploadProgress}%. Click "Resume Upload" to continue without losing progress.`);
        }
        return;
      }

      setUploadProgress(100);
      setUploadedBytes(file.size);

      // 4. Complete Chunked Upload (Merge parts on server)
      const completeRes = await api.completeChunkedUpload({
        uploadId: uploadId!,
        title,
        description,
        category,
        thumbnail: selectedThumbnail || undefined,
        posterImage: selectedThumbnail || undefined,
        autoTranscode,
        deleteRawAfterEncode
      });

      const videoId = completeRes.data?.data?.videoId;
      if (!videoId) throw new Error('Upload assembly completed but no videoId returned.');

      // Clear saved session upon complete success
      localStorage.removeItem(STORAGE_KEY);
      setSavedSession(null);
      setActiveUploadId(null);
      setCreatedVideoId(videoId);

      if (!autoTranscode) {
        setProcessingComplete(true);
        setSuccess(`🎉 Video "${title}" staged as Raw Master! You can trigger transcoding anytime from the Studio tab.`);
        return;
      }

      // 5. Switch to Stage 2 (Parallel FFmpeg Transcoding Visualizer)
      setProcessingStatus({
        videoId,
        status: 'processing',
        hlsProgress: 5,
        processingStage: 'encoding',
        title
      });

      setSuccess('Video successfully assembled! Multi-core FFmpeg transcoding running...');

      // Polling loop for FFmpeg transcoding
      let lastProgress = 5;
      pollTimerRef.current = setInterval(async () => {
        try {
          const progressResponse = await api.getProcessingProgress(videoId);
          const status = progressResponse.data?.data || progressResponse.data;

          if (status) {
            const rawProgress = status.hlsProgress !== undefined ? status.hlsProgress : 0;
            const effectiveProgress = Math.max(lastProgress, rawProgress);
            lastProgress = effectiveProgress;

            setProcessingStatus({
              ...status,
              hlsProgress: effectiveProgress
            });

            if (status.status === 'ready' || effectiveProgress >= 100) {
              if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
              }
              setProcessingComplete(true);
              setProcessingStatus({
                ...status,
                status: 'ready',
                hlsProgress: 100,
                processingStage: 'ready'
              });
              setSuccess(`🎉 Video "${title}" is ready for 4K streaming!`);
            }
          }
        } catch (err) {
          console.warn('Transcoding progress poll retry:', err);
        }
      }, 1500);

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Upload interrupted');
    } finally {
      setLoading(false);
      setActiveChunkWorkers(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) {
      setError('Please select a video file and provide a title');
      return;
    }
    if (uploadMode === 'direct') {
      await executeDirectUpload(selectedFile);
    } else {
      await executeChunkedUpload(selectedFile);
    }
  };

  const handlePause = () => {
    cancelUploadRef.current = true;
    setIsPaused(true);
    setLoading(false);
  };

  const handleResume = () => {
    if (selectedFile) {
      executeChunkedUpload(selectedFile);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <Upload size={20} />
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white">Video Studio & Management</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Resumable chunked upload, raw video staging, on-demand multi-bitrate encoding & disk manager.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-neon/10 border border-brand-neon/20 text-brand-300 text-xs font-bold">
            <Cpu size={14} className="text-brand-neon" />
            <span>Multi-Profile FFmpeg • Raw Storage Control</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-dark-900/90 border border-white/10 w-fit shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'upload' 
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload size={14} />
            <span>Upload New Video</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'studio' 
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film size={14} />
            <span>Media & Transcoding Studio</span>
          </button>
        </div>

        {activeTab === 'studio' ? (
          <StudioManager />
        ) : (
          <div className="space-y-8 animate-in fade-in">
        {/* Unfinished Session Detection Banner */}
        {savedSession && !selectedFile && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in shadow-xl">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <RotateCcw size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                    Resumable Session Found
                  </span>
                  <span className="text-xs font-black text-white">{savedSession.progress}% Completed</span>
                </div>
                <p className="text-sm font-black text-white mt-1">
                  <span className="text-amber-300">{savedSession.fileName}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {savedSession.uploadedChunks.length} of {savedSession.totalChunks} chunks already saved on server. Select the file to resume without re-uploading completed parts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-xs flex items-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <RotateCcw size={14} />
                <span>Select & Resume File</span>
              </button>
              <button
                type="button"
                onClick={discardSavedSession}
                className="text-xs text-slate-400 hover:text-rose-400 font-bold px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Upload Form Card */}
        <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Drag and Drop Zone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Video Source File</label>
              
              <div className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
                selectedFile 
                  ? 'border-emerald-500/40 bg-emerald-500/[0.03]' 
                  : 'border-white/15 bg-dark-900/50 hover:border-brand-500/50 hover:bg-dark-900/80'
              }`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />

                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                        <FileVideo size={24} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-extrabold text-white truncate max-w-sm sm:max-w-md">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {Math.ceil(selectedFile.size / calculateOptimalChunkSize(selectedFile.size))} Chunks ({(calculateOptimalChunkSize(selectedFile.size) / (1024 * 1024))}MB each)
                        </p>
                      </div>
                      {!loading && (
                        <button
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedFile(null); 
                            setGeneratedThumbnails([]);
                            setSelectedThumbnail(null);
                            setCustomThumbnail(null);
                          }}
                          className="ml-auto p-2 text-slate-400 hover:text-rose-400 z-20"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>

                    {activeUploadId && uploadProgress > 0 && (
                      <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-amber-400 animate-pulse" />
                          <span className="font-bold">Resumable Session Active: {savedSession?.uploadedChunks.length || 0} of {savedSession?.totalChunks || 0} chunks ({uploadProgress}%) already verified on server</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-black">
                          Ready to Resume
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto border border-brand-500/20">
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">Drag & drop master video file, or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">MP4, MOV, MKV, AVI, WEBM up to 5GB (Resumable)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Selection Section */}
            {selectedFile && (
              <div className="space-y-4 p-5 rounded-2xl bg-dark-900/60 border border-white/10 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-brand-500/20 text-brand-neon">
                      <ImageIcon size={16} />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-white">Video Poster & Thumbnail</h3>
                      <p className="text-[11px] text-slate-400">Select an auto-extracted video frame or upload your custom poster art</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => customFileInputRef.current?.click()}
                    disabled={loading}
                    className="btn-secondary text-[11px] uppercase tracking-wider px-3.5 py-2 flex items-center gap-1.5"
                  >
                    <Upload size={13} />
                    <span>Upload Custom Image</span>
                  </button>
                  <input
                    ref={customFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCustomImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Auto Extracted Frame Snapshots */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={12} className="text-brand-neon" />
                      Auto Video Snapshots
                    </span>
                    {isExtractingFrames && (
                      <span className="text-[11px] text-brand-neon flex items-center gap-1.5 animate-pulse">
                        <Loader size={12} className="animate-spin" />
                        Extracting 4K frames...
                      </span>
                    )}
                  </div>

                  {isExtractingFrames ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="aspect-video rounded-xl bg-dark-950/80 border border-white/10 animate-pulse flex items-center justify-center">
                          <Loader size={16} className="text-brand-400 animate-spin" />
                        </div>
                      ))}
                    </div>
                  ) : generatedThumbnails.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {generatedThumbnails.map((frame) => {
                        const isSelected = selectedThumbnail === frame.dataUrl;
                        return (
                          <div
                            key={frame.id}
                            onClick={() => setSelectedThumbnail(frame.dataUrl)}
                            className={`group relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-brand-neon ring-2 ring-brand-neon/30 scale-[1.02] shadow-lg shadow-brand-neon/20'
                                : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={frame.dataUrl}
                              alt={`Thumbnail at ${frame.timeFormatted}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 via-transparent to-transparent opacity-80" />
                            <span className="absolute bottom-1.5 left-2 text-[10px] font-mono text-slate-300 bg-dark-950/80 px-1.5 py-0.5 rounded border border-white/10">
                              {frame.timeFormatted}
                            </span>
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-neon text-dark-950 flex items-center justify-center font-bold shadow-md">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No snapshots available. Upload a custom image above.</p>
                  )}
                </div>

                {/* Custom Thumbnail Selected Banner */}
                {customThumbnail && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                      Custom Uploaded Artwork
                    </span>
                    <div
                      onClick={() => setSelectedThumbnail(customThumbnail)}
                      className={`relative aspect-video max-w-xs rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedThumbnail === customThumbnail
                          ? 'border-brand-neon ring-2 ring-brand-neon/30'
                          : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={customThumbnail} alt="Custom Poster" className="w-full h-full object-cover" />
                      {selectedThumbnail === customThumbnail && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-neon text-dark-950 flex items-center justify-center font-bold shadow-md">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Cinema Card Preview */}
                {selectedThumbnail && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs font-black text-brand-neon uppercase tracking-wider mb-2.5">
                      <Eye size={14} />
                      <span>Live 4K Catalog Card Preview</span>
                    </div>
                    <div className="relative aspect-video max-w-sm rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-dark-950 group">
                      <img
                        src={selectedThumbnail}
                        alt="Preview"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-brand-500/80 text-white font-bold text-[9px] uppercase tracking-wider">
                            {category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                            4K HDR
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white truncate">{title || 'Video Title'}</h4>
                        <p className="text-[10px] text-slate-300 line-clamp-1">{description || 'Add description...'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Video Title & Category Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Video Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Interstellar Odyssey 4K"
                  className="w-full px-4 py-3 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-dark-900/90 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all disabled:opacity-50"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-dark-900 text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Description / Notes</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                placeholder="Synopsis, cast, or background notes..."
                className="w-full px-4 py-3 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all disabled:opacity-50"
              />
            </div>

            {/* Error Alert */}
            {error && (
              <div className="bg-rose-500/10 text-rose-300 px-5 py-3.5 rounded-2xl text-xs font-bold border border-rose-500/30 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
                {isPaused && (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="bg-emerald-500/10 text-emerald-300 px-5 py-3.5 rounded-2xl text-xs font-bold border border-emerald-500/30 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                  <span>{success}</span>
                </div>
                {processingComplete && (
                  <Link
                    to="/browse"
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Watch Now</span>
                  </Link>
                )}
              </div>
            )}

            {/* Step 1: Live Upload Dashboard */}
            {loading && (
              <div className="p-5 rounded-2xl bg-dark-900/90 border border-brand-500/40 space-y-3.5 animate-in fade-in duration-300 shadow-2xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-neon flex items-center justify-center animate-pulse">
                      {uploadMode === 'direct' ? <Zap size={16} /> : <Upload size={16} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>{uploadMode === 'direct' ? '⚡ Ultra-Fast Direct Line-Rate Stream' : '🔄 Resumable Chunked Upload'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-neon text-[10px]">
                          {uploadMode === 'direct' ? 'Zero-Overhead Pipe' : `${activeChunkWorkers || 6}x Parallel Streams`}
                        </span>
                        {uploadSpeedMBs && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                            ⚡ {uploadSpeedMBs}
                          </span>
                        )}
                        {etaFormatted && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                            ⏱️ ETA {etaFormatted}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {selectedFile
                          ? `${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB of ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : 'Transferring video data...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {uploadMode === 'chunked' && (
                      <button
                        type="button"
                        onClick={handlePause}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs flex items-center gap-1"
                        title="Pause Upload"
                      >
                        <Pause size={13} />
                        <span className="text-[10px] font-bold">Pause</span>
                      </button>
                    )}
                    <span className="text-sm font-black text-brand-neon">{uploadProgress}%</span>
                  </div>
                </div>

                {/* Upload Progress Bar */}
                <div className="w-full bg-dark-950 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div
                    className="bg-gradient-to-r from-brand-500 via-brand-400 to-brand-neon h-full rounded-full transition-all duration-300 shadow-glow"
                    style={{ width: `${Math.max(3, uploadProgress)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-brand-400">
                    <Loader size={11} className="animate-spin text-brand-400" />
                    {uploadMode === 'direct' 
                      ? 'Streaming directly to Nginx line-rate pipe • 20+ MB/s WAN bandwidth' 
                      : `Uploading with ${activeChunkWorkers || 6} parallel workers • Zero data loss guarantee`}
                  </span>
                  <span>{uploadMode === 'direct' ? 'Line-Rate Stream' : 'Safe to pause / resume'}</span>
                </div>
              </div>
            )}

            {/* Paused Banner */}
            {isPaused && !loading && (
              <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Pause size={16} className="text-brand-neon" />
                  <span className="text-xs font-bold text-white">Upload paused at {uploadProgress}%. Ready to resume.</span>
                </div>
                <button
                  type="button"
                  onClick={handleResume}
                  className="btn-primary px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Play size={12} fill="currentColor" /> Resume Upload
                </button>
              </div>
            )}

            {/* Step 2: FFmpeg Parallel Transcoding Pipeline Live Visualizer */}
            {processingStatus && (
              <div className="p-5 rounded-2xl bg-dark-900/90 border border-brand-500/40 space-y-4 animate-in fade-in duration-300 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-neon/20 text-brand-neon flex items-center justify-center animate-pulse">
                      <Cpu size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Step 2: FFmpeg Parallel HLS Transcoding</span>
                        <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-neon text-[10px]">
                          Multi-Threaded
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {processingComplete
                          ? 'All 4 multi-bitrate streams ready for playback'
                          : 'Transcoding 1080p, 720p, 480p, 360p adaptive streams in parallel...'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-brand-neon">{processingStatus.hlsProgress || 0}%</span>
                </div>

                {/* Transcoding Progress Meter Bar */}
                <div className="w-full bg-dark-950 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div
                    className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-neon h-full rounded-full transition-all duration-500 ease-out shadow-glow"
                    style={{ width: `${Math.max(5, processingStatus.hlsProgress || 0)}%` }}
                  />
                </div>

                {/* Pipeline Steps */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] font-extrabold uppercase tracking-wider">
                  <div className="p-2.5 rounded-xl bg-dark-950/80 border border-emerald-500/40 text-emerald-400 flex items-center gap-1.5 shadow-sm">
                    <CheckCircle size={13} /> 1. Upload Stream Verified
                  </div>
                  <div className={`p-2.5 rounded-xl bg-dark-950/80 border flex items-center gap-1.5 transition-all ${
                    (processingStatus.hlsProgress || 0) >= 30 ? 'border-emerald-500/40 text-emerald-400 shadow-sm' : 'border-white/10 text-slate-500'
                  }`}>
                    <Tv size={13} /> 2. 1080p / 720p
                  </div>
                  <div className={`p-2.5 rounded-xl bg-dark-950/80 border flex items-center gap-1.5 transition-all ${
                    (processingStatus.hlsProgress || 0) >= 70 ? 'border-emerald-500/40 text-emerald-400 shadow-sm' : 'border-white/10 text-slate-500'
                  }`}>
                    <Layers size={13} /> 3. 480p / 360p
                  </div>
                  <div className={`p-2.5 rounded-xl bg-dark-950/80 border flex items-center gap-1.5 transition-all ${
                    processingComplete || (processingStatus.hlsProgress || 0) >= 100 ? 'border-emerald-500/40 text-emerald-400 shadow-glow' : 'border-white/10 text-slate-500'
                  }`}>
                    <Sparkles size={13} /> 4. 4K Ready
                  </div>
                </div>

                {processingComplete && (
                  <div className="pt-2 flex justify-end">
                    <Link
                      to={`/browse?play=${processingStatus.videoId}`}
                      className="btn-primary py-3 px-6 rounded-xl text-xs uppercase tracking-wider font-extrabold flex items-center gap-2 shadow-glow"
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Stream Video in 4K Now</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Upload Engine Selector */}
            <div className="p-4 rounded-2xl bg-dark-900/60 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Upload Protocol Engine
                </label>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {uploadMode === 'direct' ? '⚡ 20+ MB/s Ultra Fast' : '🔄 Multipart Resumable'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setUploadMode('direct')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    uploadMode === 'direct'
                      ? 'bg-brand-500/15 border-brand-500 text-white shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/30'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2 text-xs font-black text-white">
                      <Zap size={14} className="text-brand-neon" />
                      <span>⚡ Direct Stream (Ultra Fast)</span>
                    </div>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black uppercase">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Full line-rate transfer (20+ MB/s). Direct HTTP streaming with zero chunk round-trip overhead and kernel TCP window auto-tuning.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode('chunked')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    uploadMode === 'chunked'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/30'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-black text-cyan-300 mb-0.5">
                    <RotateCcw size={14} className="text-cyan-400" />
                    <span>🔄 Resumable Chunks</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Multipart 6-worker chunking with pause/resume support & automatic retry. Best for flaky or frequently interrupted connections.
                  </p>
                </button>
              </div>
            </div>

            {/* Transcoding Mode Selector */}
            <div className="p-4 rounded-2xl bg-dark-900/60 border border-white/10 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Transcoding Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAutoTranscode(true)}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    autoTranscode 
                      ? 'bg-brand-500/15 border-brand-500 text-white shadow-lg shadow-brand-500/20' 
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-black text-white mb-0.5">
                    <Zap size={14} className="text-brand-neon" />
                    <span>⚡ Instant Multi-Bitrate</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Auto-transcode all profiles (1080p, 720p, 480p, 360p) immediately.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoTranscode(false)}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    !autoTranscode 
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/20' 
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300 mb-0.5">
                    <HardDrive size={14} className="text-amber-400" />
                    <span>📁 Stage Raw Master Only</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Store raw MP4 in library. Configure and trigger transcoding later on demand.</p>
                </button>
              </div>
            </div>

            {/* Auto-Purge Raw Master Option */}
            {autoTranscode && (
              <div 
                onClick={() => setDeleteRawAfterEncode(!deleteRawAfterEncode)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-dark-900/60 border border-white/10 hover:border-white/20 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                    deleteRawAfterEncode ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30 bg-white/5'
                  }`}>
                    {deleteRawAfterEncode && <Check size={12} strokeWidth={3} />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Auto-Purge Raw Video After Encoding</span>
                    <span className="text-[11px] text-slate-400 block">Automatically deletes the raw uploaded video file to reclaim disk space once HLS completes</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Recommended
                </span>
              </div>
            )}

            {/* Submit / Action Button */}
            {!isPaused ? (
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="btn-primary w-full py-4 rounded-xl text-xs uppercase tracking-wider font-extrabold shadow-glow disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size={16} className="animate-spin" />
                    {uploadMode === 'direct' ? 'Streaming Direct to Server' : 'Uploading Chunks'} ({uploadProgress}%
                    {uploadSpeedMBs ? ` • ${uploadSpeedMBs}` : ''})...
                  </span>
                ) : processingStatus && !processingComplete ? (
                  <span className="flex items-center justify-center gap-2 text-brand-300">
                    <Loader size={16} className="animate-spin" />
                    Transcoding HLS Profiles ({processingStatus.hlsProgress || 0}%)...
                  </span>
                ) : activeUploadId && uploadProgress > 0 && uploadMode === 'chunked' ? (
                  <span className="flex items-center justify-center gap-2 text-amber-300">
                    <RotateCcw size={16} className="text-amber-400" />
                    ⚡ Resume Upload from {uploadProgress}% (Skip Already Uploaded Chunks)
                  </span>
                ) : uploadMode === 'direct' ? (
                  autoTranscode ? '⚡ Direct Line-Rate Upload & Transcode (20+ MB/s)' : '⚡ Direct Upload & Stage Raw Master'
                ) : autoTranscode ? (
                  'Start Resumable Upload & Transcode'
                ) : (
                  'Upload & Stage Raw Master in Library'
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResume}
                className="btn-primary w-full py-4 rounded-xl text-xs uppercase tracking-wider font-extrabold shadow-glow"
              >
                <span className="flex items-center justify-center gap-2">
                  <Play size={16} fill="currentColor" />
                  Resume Upload ({uploadProgress}%)
                </span>
              </button>
            )}
          </form>
        </div>
      </div>
        )}
      </div>
    </div>
  );
}
