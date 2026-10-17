import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Play, 
  Pause,
  Plus, 
  Heart, 
  X, 
  Trash2, 
  Settings, 
  Info, 
  Star, 
  Tv, 
  Sparkles, 
  Radio, 
  Clock, 
  Layers, 
  Check, 
  AlertCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Film,
  RotateCcw,
  FastForward,
  Subtitles,
  Gauge,
  HelpCircle,
  TrendingUp,
  Shield,
  ShieldCheck,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  Bell,
  MoreVertical,
  MessageSquare,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Monitor,
  Flame,
  ArrowLeft,
  Tv2,
  SlidersHorizontal
} from 'lucide-react';
import HLS from 'hls.js';
import api from '../services/api';

interface Video {
  id: string;
  title: string;
  description: string;
  category: string;
  fileName?: string;
  fileSize?: number;
  status?: string;
  uploadedAt?: string;
  imdbRating?: number;
  hlsProgress?: number;
  processingStage?: string;
  thumbnail?: string;
  posterImage?: string;
  views?: number;
}

interface QualityLevel {
  level: number;
  height: number;
  bitrate: number;
  name: string;
}

interface PlaybackProgress {
  videoId: string;
  title: string;
  category: string;
  currentTime: number;
  duration: number;
  percent: number;
  lastUpdated: number;
  thumbnailUrl?: string;
}

interface CommentItem {
  id: string;
  author: string;
  avatarColor: string;
  timeAgo: string;
  text: string;
  likes: number;
  isLiked?: boolean;
}

const PROGRESS_STORAGE_KEY = 'ott_watch_progress';

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

const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: 'c-1',
    author: 'CinemaEnthusiast_4K',
    avatarColor: 'from-amber-400 to-orange-600',
    timeAgo: '2 hours ago',
    text: 'The dynamic multi-bitrate HLS streaming on this player is silky smooth! Zero buffering at 4K 60fps.',
    likes: 42,
    isLiked: false
  },
  {
    id: 'c-2',
    author: 'AudioPhile_Pro',
    avatarColor: 'from-emerald-400 to-teal-600',
    timeAgo: '5 hours ago',
    text: 'Spatial audio balance with AES-128 stream token authentication is top-notch. Love the YouTube style layout!',
    likes: 28,
    isLiked: false
  },
  {
    id: 'c-3',
    author: 'SoNALU_Fanatic',
    avatarColor: 'from-purple-400 to-indigo-600',
    timeAgo: '1 day ago',
    text: 'Best OTT experience so far. Clean theater mode and instant quality switching!',
    likes: 19,
    isLiked: false
  }
];

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoPlayVideoId = searchParams.get('play') || searchParams.get('videoId');
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // YouTube Watch Layout & Interaction States
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(24800);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'category' | 'recent'>('all');
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentItem[]>(INITIAL_COMMENTS);
  const [newCommentText, setNewCommentText] = useState('');
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // DRM & Token Security State
  const [drmStatus, setDrmStatus] = useState<{
    enabled: boolean;
    type: string;
    token: string;
    expiresAt: number;
    keyUri: string;
  } | null>(null);
  const [showDrmModal, setShowDrmModal] = useState(false);

  // Video player controls state
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('off');
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<string>('');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ time: number; formatted: string } | null>(null);
  
  // Watchlist & Progress state
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [watchlistToast, setWatchlistToast] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);
  const [continueWatchingList, setContinueWatchingList] = useState<PlaybackProgress[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);
  const progressIntervalRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  const categories = [
    'All',
    'Educational',
    'Movies',
    'TV Series',
    'Sci-Fi',
    'Action',
    'Drama',
    'Comedy',
    'Documentaries',
    'Anime',
  ];

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const subtitleOptions = [
    { code: 'off', label: 'Off' },
    { code: 'en', label: 'English (CC)' },
    { code: 'es', label: 'Spanish (ES)' },
    { code: 'fr', label: 'French (FR)' },
  ];

  // Sync URL search params
  useEffect(() => {
    const urlQuery = searchParams.get('search') || searchParams.get('q') || '';
    if (urlQuery) {
      setSearchQuery(urlQuery);
      setSelectedCategory('All');
    }
  }, [searchParams]);

  // Reactive Auto-Play & Video Selection from URL parameter (?play= or ?videoId=)
  useEffect(() => {
    const playId = searchParams.get('play') || searchParams.get('videoId');
    if (!playId) return;

    const targetId = playId.trim();
    if (!targetId) return;

    const found = videos.find((v: Video) => (
      v.id === targetId || 
      (v as any)._id === targetId || 
      (v as any).videoId === targetId
    ));

    if (found) {
      const normalized: Video = {
        ...found,
        id: found.id || (found as any).videoId || (found as any)._id
      };
      setSelectedVideo(normalized);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    api.getVideoById(targetId)
      .then((res: any) => {
        const v = res.data?.data || res.data;
        if (v && (v.id || v._id || v.videoId)) {
          const normalized: Video = {
            ...v,
            id: v.id || v.videoId || v._id
          };
          setSelectedVideo(normalized);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      })
      .catch((err) => {
        console.warn('Could not load auto-play video by ID:', err);
      });
  }, [searchParams, videos]);

  // Global event listener for instant play triggers from Navbar Search, Modals, etc.
  useEffect(() => {
    const handleGlobalPlay = (e: any) => {
      const targetId = e.detail?.videoId;
      const targetVideo = e.detail?.video;
      if (targetVideo && (targetVideo.id || targetVideo._id || targetVideo.videoId)) {
        handleSelectVideo({
          ...targetVideo,
          id: targetVideo.id || targetVideo.videoId || targetVideo._id
        });
      } else if (targetId) {
        const found = videos.find((v: Video) => (
          v.id === targetId || (v as any)._id === targetId || (v as any).videoId === targetId
        ));
        if (found) {
          handleSelectVideo({
            ...found,
            id: found.id || (found as any).videoId || (found as any)._id
          });
        } else {
          api.getVideoById(targetId).then((res: any) => {
            const v = res.data?.data || res.data;
            if (v) {
              handleSelectVideo({
                ...v,
                id: v.id || v.videoId || v._id
              });
            }
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('ott_play_video', handleGlobalPlay);
    return () => window.removeEventListener('ott_play_video', handleGlobalPlay);
  }, [videos]);

  useEffect(() => {
    loadContent();
    loadWatchlist();
    loadContinueWatching();

    const handleUpdate = () => {
      loadContinueWatching();
    };

    window.addEventListener('ott_continue_watching_updated', handleUpdate);
    return () => window.removeEventListener('ott_continue_watching_updated', handleUpdate);
  }, []);

  const loadWatchlist = async () => {
    try {
      const res = await api.getWatchlist();
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const ids = list.map((item: any) => item.videoId || item.video_id || item.id || item._id).filter(Boolean);
      setWatchlistIds(ids);
    } catch (e) {
      console.warn('Watchlist fetch skipped:', e);
    }
  };

  const DISMISSED_KEY = 'ott_dismissed_watch';

  const purgeOrphanedWatchProgress = (validList: Video[]) => {
    if (!validList) return;
    const validIdSet = new Set(validList.map(v => v.id || (v as any)._id).filter(Boolean));
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (raw) {
        const parsed: PlaybackProgress[] = JSON.parse(raw);
        const cleaned = parsed.filter(p => validIdSet.has(p.videoId));
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(cleaned));
      }
    } catch (_) {}
    setContinueWatchingList(prev => prev.filter(p => validIdSet.has(p.videoId)));
  };

  const loadContinueWatching = async () => {
    let dismissedIds = new Set<string>();
    try {
      const rawDismissed = localStorage.getItem(DISMISSED_KEY);
      if (rawDismissed) dismissedIds = new Set(JSON.parse(rawDismissed));
    } catch (_) {}

    try {
      const res = await api.getContinueWatching();
      const serverList = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const formatted: PlaybackProgress[] = serverList
        .filter((item: any) => !dismissedIds.has(item.videoId || item.id))
        .map((item: any) => ({
          videoId: item.videoId || item.id,
          title: item.title || 'Cinema Stream',
          category: item.category || 'Cinema',
          currentTime: item.currentTime || 0,
          duration: item.duration || 1800,
          percent: item.progress || Math.round(((item.currentTime || 0) / (item.duration || 1800)) * 100),
          lastUpdated: item.lastWatchedAt ? new Date(item.lastWatchedAt).getTime() : Date.now(),
          thumbnailUrl: item.thumbnailUrl
        }));

      let activeItems = formatted.filter(p => p.percent > 2 && p.percent < 95);
      if (videos.length > 0) {
        const validIdSet = new Set(videos.map(v => v.id || (v as any)._id));
        activeItems = activeItems.filter(p => validIdSet.has(p.videoId));
      }
      setContinueWatchingList(activeItems);
    } catch (e) {
      console.warn('Server continue watching fetch error:', e);
      try {
        const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
        if (raw) {
          const parsed: PlaybackProgress[] = JSON.parse(raw);
          const validIdSet = videos.length > 0 ? new Set(videos.map(v => v.id || (v as any)._id)) : null;
          const active = parsed.filter(p => 
            !dismissedIds.has(p.videoId) && 
            p.percent > 2 && 
            p.percent < 95 &&
            (!validIdSet || validIdSet.has(p.videoId))
          );
          setContinueWatchingList(active.sort((a, b) => b.lastUpdated - a.lastUpdated));
        }
      } catch (err) {
        console.warn('Error reading progress:', err);
      }
    }
  };

  const handleRemoveContinueWatching = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    try {
      setContinueWatchingList((prev: any[]) => prev.filter((item: any) => item.videoId !== videoId));
      
      let dismissed: string[] = [];
      try {
        const raw = localStorage.getItem(DISMISSED_KEY);
        if (raw) dismissed = JSON.parse(raw);
      } catch (_) {}
      if (!dismissed.includes(videoId)) {
        dismissed.push(videoId);
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
      }

      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (raw) {
        const list: PlaybackProgress[] = JSON.parse(raw);
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(list.filter(p => p.videoId !== videoId)));
      }

      await api.removeContinueWatching(videoId);
      window.dispatchEvent(new Event('ott_continue_watching_updated'));
    } catch (err) {
      console.warn('Error removing continue watching item:', err);
    }
  };

  const savePlaybackProgress = (videoId: string, currentTime: number, duration: number, title: string, category: string) => {
    if (!videoId || !duration || duration <= 0) return;
    const percent = Math.round((currentTime / duration) * 100);
    try {
      if (currentTime > 3) {
        try {
          const rawDismissed = localStorage.getItem(DISMISSED_KEY);
          if (rawDismissed) {
            const dismissed: string[] = JSON.parse(rawDismissed);
            localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed.filter(id => id !== videoId)));
          }
        } catch (_) {}
      }

      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      let list: PlaybackProgress[] = raw ? JSON.parse(raw) : [];
      list = list.filter(item => item.videoId !== videoId);
      
      if (percent < 95 && currentTime > 3) {
        list.unshift({
          videoId,
          title,
          category,
          currentTime: Math.floor(currentTime),
          duration: Math.floor(duration),
          percent,
          lastUpdated: Date.now()
        });
      }
      
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(list.slice(0, 15)));
      setContinueWatchingList(list.filter(p => p.percent > 2 && p.percent < 95));
      
      api.saveWatchProgress(videoId, Math.floor(currentTime), Math.floor(duration), percent).catch(() => {});
    } catch (e) {
      console.warn('Error saving progress:', e);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Keyboard cinema shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedVideo || !videoRef.current) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
          break;
        case 'f':
          e.preventDefault();
          if (!document.fullscreenElement) {
            videoRef.current.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
          break;
        case 't':
          e.preventDefault();
          setIsTheaterMode(prev => !prev);
          break;
        case 'm':
          e.preventDefault();
          videoRef.current.muted = !videoRef.current.muted;
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
          break;
        case 'arrowup':
          e.preventDefault();
          videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
        case 'c':
          e.preventDefault();
          setSelectedSubtitle(prev => prev === 'off' ? 'en' : 'off');
          break;
        case '?':
          e.preventDefault();
          setShowShortcutsHelp(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVideo]);

  // Handle switching video seamlessly
  const handleSelectVideo = (video: Video) => {
    setSelectedVideo(video);
    setNextCountdown(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    navigate(`/browse?play=${encodeURIComponent(video.id)}`, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close player and return to browse catalog
  const handleClosePlayer = () => {
    setSelectedVideo(null);
    setNextCountdown(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    navigate('/browse', { replace: true });
  };

  // Setup HLS video stream when selectedVideo changes
  useEffect(() => {
    if (!selectedVideo) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setQualityLevels([]);
    setCurrentQuality(-1);
    setShowQualityMenu(false);
    setShowSpeedMenu(false);
    setShowSubtitleMenu(false);
    setResumePrompt(null);
    setIsLiked(false);
    setIsDisliked(false);
    setNextCountdown(null);

    // Check for saved resume position
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      try {
        const list: PlaybackProgress[] = JSON.parse(raw);
        const saved = list.find(p => p.videoId === selectedVideo.id);
        if (saved && saved.currentTime > 5 && saved.currentTime < saved.duration - 10) {
          setResumePrompt({
            time: saved.currentTime,
            formatted: formatTime(saved.currentTime)
          });
        }
      } catch (_) {}
    }

    const setupVideo = async () => {
      if (!videoRef.current) {
        setTimeout(setupVideo, 50);
        return;
      }

      const isStandardPort = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443');
      const apiBase = isStandardPort ? '/api' : `http://${window.location.hostname}:3000/api`;
      const targetVidId = selectedVideo.id || (selectedVideo as any).videoId || (selectedVideo as any)._id;
      const authToken = localStorage.getItem('auth_token');

      videoRef.current.playbackRate = playbackSpeed;

      let hlsUrl = `${apiBase}/stream/${targetVidId}/manifest`;
      let streamToken = '';

      // Request Signed HMAC Playback Token & Dynamic DRM Key
      try {
        const tokenRes = await api.getStreamToken(targetVidId);
        if (tokenRes.data?.data?.token) {
          streamToken = tokenRes.data.data.token;
          hlsUrl = `${apiBase}/stream/${targetVidId}/manifest?token=${encodeURIComponent(streamToken)}`;
          setDrmStatus({
            enabled: true,
            type: 'AES-128 (CBC Dynamic)',
            token: streamToken,
            expiresAt: tokenRes.data.data.expiresAt,
            keyUri: tokenRes.data.data.drm?.keyUri || `/api/stream/${targetVidId}/drm/key`
          });
        }
      } catch (err) {
        console.warn('Failed to obtain signed stream token, falling back to direct stream:', err);
      }

      if (HLS.isSupported()) {
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
          capLevelToPlayerSize: false,
          xhrSetup: (xhr: any, url: string) => {
            if (streamToken) {
              xhr.setRequestHeader('X-Stream-Token', streamToken);
            }
            if (authToken && !url.includes('.ts') && !url.includes('/segment/')) {
              xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
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
            name: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
          }));
          setQualityLevels(levels);

          const videoEl = videoRef.current;
          if (videoEl) {
            const playPromise = videoEl.play();
            if (playPromise !== undefined) {
              playPromise.catch((e) => {
                console.log('Autoplay deferred, trying muted autoplay:', e);
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
          setCurrentQuality(data.level);
        });

        hls.on(HLS.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case HLS.ErrorTypes.NETWORK_ERROR:
                console.warn('HLS Network Error, attempting recovery...', data);
                hls.startLoad();
                break;
              case HLS.ErrorTypes.MEDIA_ERROR:
                console.warn('HLS Media Error, attempting recovery...', data);
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal HLS error, destroying...', data);
                hls.destroy();
                break;
            }
          }
        });
      } else if (videoRef.current && (videoRef.current as any).canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = hlsUrl;
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    };

    setupVideo();

    progressIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && selectedVideo) {
        savePlaybackProgress(
          selectedVideo.id,
          videoRef.current.currentTime,
          videoRef.current.duration,
          selectedVideo.title,
          selectedVideo.category
        );
      }
    }, 2500);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [selectedVideo]);

  // Video Ended Handler -> YouTube Autoplay Next Video Countdown
  const handleVideoEnded = () => {
    if (!autoPlayNext) return;
    const relatedList = videos.filter(v => v.id !== selectedVideo?.id);
    if (relatedList.length === 0) return;

    const nextVid = relatedList[0];
    let count = 5;
    setNextCountdown(count);

    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownTimerRef.current);
        setNextCountdown(null);
        handleSelectVideo(nextVid);
      } else {
        setNextCountdown(count);
      }
    }, 1000);
  };

  // Subtitle cue simulator based on playback time
  const handleTimeUpdate = () => {
    if (!videoRef.current || selectedSubtitle === 'off') {
      setSubtitleCues('');
      return;
    }

    const t = Math.floor(videoRef.current.currentTime);
    const title = selectedVideo?.title || 'Film';

    if (selectedSubtitle === 'en') {
      if (t % 12 < 4) {
        setSubtitleCues(`[Narrator] Welcome to the 4K Ultra HD presentation of "${title}".`);
      } else if (t % 12 < 8) {
        setSubtitleCues(`[Audio] Spatial surround audio channel active with high dynamic range.`);
      } else {
        setSubtitleCues(`[Broadcast] Streaming adaptive master profile from distributed cluster.`);
      }
    } else if (selectedSubtitle === 'es') {
      if (t % 12 < 4) {
        setSubtitleCues(`[Narrador] Bienvenido a la presentación 4K Ultra HD de "${title}".`);
      } else if (t % 12 < 8) {
        setSubtitleCues(`[Audio] Canal de audio espacial envolvente activo.`);
      } else {
        setSubtitleCues(`[Transmisión] Transmitiendo perfil maestro adaptativo.`);
      }
    } else if (selectedSubtitle === 'fr') {
      if (t % 12 < 4) {
        setSubtitleCues(`[Narrateur] Bienvenue dans la présentation 4K Ultra HD de "${title}".`);
      } else if (t % 12 < 8) {
        setSubtitleCues(`[Audio] Canal audio spatial immersif activé.`);
      } else {
        setSubtitleCues(`[Diffusion] Diffusion du profil maître adaptatif.`);
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const handleResumeClick = () => {
    if (resumePrompt && videoRef.current) {
      videoRef.current.currentTime = resumePrompt.time;
      videoRef.current.play().catch(() => {});
      setResumePrompt(null);
    }
  };

  // Like / Dislike / Share Actions
  const handleLikeClick = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
    } else {
      setIsLiked(true);
      if (isDisliked) setIsDisliked(false);
      setLikeCount(prev => prev + 1);
    }
  };

  const handleDislikeClick = () => {
    if (isDisliked) {
      setIsDisliked(false);
    } else {
      setIsDisliked(true);
      if (isLiked) {
        setIsLiked(false);
        setLikeCount(prev => prev - 1);
      }
    }
  };

  const handleShareClick = () => {
    const url = `${window.location.origin}/browse?play=${encodeURIComponent(selectedVideo?.id || '')}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // Add Comment
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: CommentItem = {
      id: `c-${Date.now()}`,
      author: 'You (Current User)',
      avatarColor: 'from-lime-400 to-emerald-600',
      timeAgo: 'Just now',
      text: newCommentText.trim(),
      likes: 0,
      isLiked: false
    };

    setComments(prev => [newComment, ...prev]);
    setNewCommentText('');
    setIsCommentFocused(false);
  };

  const handleToggleCommentLike = (commentId: string) => {
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const nextLiked = !c.isLiked;
        return {
          ...c,
          isLiked: nextLiked,
          likes: nextLiked ? c.likes + 1 : c.likes - 1
        };
      }
      return c;
    }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadContent(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadContent = async (search?: string) => {
    try {
      setLoading(true);
      setError('');
      let response: any;
      const query = (search !== undefined ? search : searchQuery).trim();
      if (query) {
        response = await api.searchContent(query);
      } else {
        response = await api.getContent();
      }
      const rawList = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data?.videos || response.data?.videos || response.data?.data || [];
      const list = rawList.map((v: any) => ({
        ...v,
        id: v.id || v._id || v.videoId
      }));
      setVideos(list);
      purgeOrphanedWatchProgress(list);

      if (autoPlayVideoId && !selectedVideo) {
        const found = list.find((v: Video) => (
          v.id === autoPlayVideoId || 
          (v as any)._id === autoPlayVideoId || 
          (v as any).videoId === autoPlayVideoId
        ));
        if (found) {
          setSelectedVideo(found);
        }
      }
    } catch (err: any) {
      console.warn('Search fallback:', err);
      try {
        const fallbackRes = await api.getContent();
        const fullList = Array.isArray(fallbackRes.data) 
          ? fallbackRes.data 
          : fallbackRes.data?.data?.videos || fallbackRes.data?.videos || fallbackRes.data?.data || [];
        const q = (search !== undefined ? search : searchQuery).toLowerCase().trim();
        if (q) {
          setVideos(fullList.filter((v: Video) => 
            v.title?.toLowerCase().includes(q) || 
            v.description?.toLowerCase().includes(q) ||
            v.category?.toLowerCase().includes(q)
          ));
        } else {
          setVideos(fullList);
        }
      } catch {
        setError('Unable to load video catalog.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh catalog if any video is processing (lightweight 10s interval when tab is active)
  useEffect(() => {
    const hasProcessing = videos.some(v => v.status === 'processing' || (v.hlsProgress !== undefined && v.hlsProgress < 100));
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadContent();
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [videos]);

  const handleToggleWatchlist = async (videoId: string, title?: string) => {
    const isSaved = watchlistIds.includes(videoId);
    try {
      if (isSaved) {
        await api.removeFromWatchlist(videoId);
        setWatchlistIds(prev => prev.filter(id => id !== videoId));
        setWatchlistToast({ message: `Removed "${title || 'Video'}" from your watchlist`, type: 'success' });
      } else {
        await api.addToWatchlist(videoId);
        setWatchlistIds(prev => [...prev, videoId]);
        setWatchlistToast({ message: `Added "${title || 'Video'}" to your watchlist!`, type: 'success' });
      }
      setTimeout(() => setWatchlistToast(null), 3000);
    } catch (err: any) {
      console.error('Watchlist action error:', err);
      setWatchlistToast({ message: err.message || 'Failed to update watchlist', type: 'warn' });
      setTimeout(() => setWatchlistToast(null), 3000);
    }
  };

  const handleDeleteVideo = async (videoId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will permanently remove the video and its transcoded HLS streams.`)) return;
    try {
      await api.deleteVideo(videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      if (selectedVideo?.id === videoId) setSelectedVideo(null);
      setWatchlistToast({ message: `Video "${title}" deleted successfully`, type: 'success' });
      setTimeout(() => setWatchlistToast(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete video:', err);
      setWatchlistToast({ message: err.message || 'Failed to delete video', type: 'warn' });
      setTimeout(() => setWatchlistToast(null), 3000);
    }
  };

  const filteredVideos = videos.filter(v => {
    if (searchQuery.trim() || selectedCategory === 'All') return true;
    return v.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Up Next / Related videos for the YouTube sidebar
  const relatedVideos = videos
    .filter(v => v.id !== selectedVideo?.id)
    .filter(v => {
      if (sidebarFilter === 'category' && selectedVideo) {
        return v.category?.toLowerCase() === selectedVideo.category?.toLowerCase();
      }
      return true;
    });

  return (
    <div className="min-h-screen bg-[#06080c] text-slate-100 font-sans selection:bg-yellow-400 selection:text-black">
      {/* Toast Notification */}
      {watchlistToast && (
        <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top duration-300 border border-white/20 ${
          watchlistToast.type === 'warn' ? 'bg-amber-500 text-dark-950 font-bold' : 'bg-emerald-600 text-white font-bold'
        }`}>
          {watchlistToast.type === 'warn' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span className="text-sm">{watchlistToast.message}</span>
        </div>
      )}

      {/* Copied Link Toast */}
      {copiedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full bg-dark-950/95 border border-white/20 shadow-2xl flex items-center gap-2 text-white text-xs font-bold animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>Link copied to clipboard!</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: BROWSE CATALOG (When no video is playing)                         */}
      {/* ========================================================================= */}
      {!selectedVideo ? (
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
          {/* Header & Instant Search Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-4 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-lime-500 text-black flex items-center justify-center font-black shadow-lg shadow-yellow-500/20">
                  <Film size={22} />
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">4K Video Catalog</h1>
                  <p className="text-xs text-slate-400">Stream in high-bitrate adaptive HLS with instant audio sync & AES-128 DRM</p>
                </div>
              </div>
            </div>

            {/* Modern Search Input */}
            <div className="w-full md:w-80 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={17} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, series, tags..."
                className="w-full pl-10 pr-10 py-2.5 bg-dark-900/90 border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); loadContent(''); }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Continue Watching Section */}
          {continueWatchingList.length > 0 && !searchQuery && selectedCategory === 'All' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Clock size={18} className="text-yellow-400" />
                  <span>Continue Watching</span>
                </h2>
                <span className="text-xs text-slate-400 font-semibold">{continueWatchingList.length} In Progress</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {continueWatchingList.map((prog: any) => {
                  const matchingVideo = videos.find(v => v.id === prog.videoId);
                  const thumb = prog.thumbnailUrl || matchingVideo?.posterImage || matchingVideo?.thumbnail;
                  return (
                    <div 
                      key={prog.videoId}
                      onClick={() => {
                        if (matchingVideo) {
                          handleSelectVideo(matchingVideo);
                        } else {
                          api.getVideoById(prog.videoId).then((res: any) => {
                            if (res.data?.data) handleSelectVideo(res.data.data);
                          }).catch(() => {});
                        }
                      }}
                      className="glass-card p-4 flex flex-col justify-between hover:border-yellow-400/50 hover:shadow-xl hover:shadow-yellow-400/10 transition-all cursor-pointer group relative rounded-2xl bg-dark-900/80 border border-white/10"
                    >
                      <button
                        type="button"
                        title="Remove from Continue Watching"
                        onClick={(e) => handleRemoveContinueWatching(e, prog.videoId)}
                        className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-dark-950/80 text-slate-400 hover:text-rose-400 hover:bg-dark-900 border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <X size={14} />
                      </button>

                      <div>
                        <div className="relative aspect-video rounded-xl bg-dark-950 overflow-hidden mb-3 flex items-center justify-center">
                          {thumb ? (
                            <img 
                              src={resolveThumbnailUrl(thumb, prog.videoId)} 
                              alt={prog.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-gradient-to-t from-dark-950/90 via-transparent to-transparent flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-yellow-400/90 text-black flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-110 shadow-lg shadow-yellow-400/30 transition-all font-bold">
                              <Play size={18} className="fill-black translate-x-0.5" />
                            </div>
                          </div>
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-dark-950/85 backdrop-blur-md text-[10px] font-bold text-slate-300 border border-white/10">
                            {formatTime(prog.currentTime)} / {formatTime(prog.duration)}
                          </span>
                        </div>

                        <span className="px-2 py-0.5 rounded bg-dark-900 border border-white/10 text-[10px] font-bold text-yellow-400 uppercase">
                          {prog.category || matchingVideo?.category || 'Cinema'}
                        </span>
                        <h3 className="font-extrabold text-white text-sm mt-1.5 line-clamp-1 group-hover:text-yellow-300 transition-colors">
                          {prog.title}
                        </h3>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                          <span>{prog.percent}% completed</span>
                          <span className="text-yellow-400 font-bold">Resume</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-yellow-400 to-lime-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, prog.percent))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20 scale-105'
                    : 'bg-dark-900/80 hover:bg-dark-800 text-slate-300 border border-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Video Catalog Grid */}
          {loading ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Loading high-fidelity catalog...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4 bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 max-w-lg mx-auto">
              <AlertCircle size={32} className="text-rose-400 mx-auto" />
              <p className="text-sm font-bold text-rose-300">{error}</p>
              <button onClick={() => loadContent()} className="btn-primary text-xs px-6 py-2.5">
                Retry Connection
              </button>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="py-24 text-center space-y-4 bg-dark-900/40 rounded-3xl border border-white/10 p-8 max-w-md mx-auto">
              <Film size={36} className="text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Videos Found</h3>
              <p className="text-xs text-slate-400">Try adjusting your search filters or upload a new movie.</p>
              <button onClick={() => navigate('/upload')} className="btn-primary text-xs px-6 py-2.5">
                Upload New Video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleSelectVideo(video)}
                  className="glass-card p-4 rounded-2xl bg-dark-900/70 border border-white/10 hover:border-yellow-400/50 hover:shadow-2xl hover:shadow-yellow-400/10 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
                >
                  <div className="relative aspect-video rounded-xl bg-dark-950 overflow-hidden mb-3.5">
                    <img
                      src={resolveThumbnailUrl(video.posterImage || video.thumbnail, video.id)}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-xl font-bold transform scale-75 group-hover:scale-100 transition-transform">
                        <Play size={20} className="fill-black translate-x-0.5" />
                      </div>
                    </div>

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-black text-yellow-300 border border-yellow-400/30">
                        4K UHD
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWatchlist(video.id, video.title);
                        }}
                        className={`p-1.5 rounded-lg backdrop-blur-md border ${
                          watchlistIds.includes(video.id)
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-black/60 text-slate-300 hover:text-white border-white/20'
                        }`}
                        title="Add to Watchlist"
                      >
                        <Heart size={14} className={watchlistIds.includes(video.id) ? 'fill-white' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVideo(video.id, video.title);
                        }}
                        className="p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-rose-400 border border-white/20"
                        title="Delete video"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {video.category || 'General'}
                        </span>
                        <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                          <Star size={11} className="fill-amber-400" /> {video.imdbRating || '8.5'}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-white text-base line-clamp-1 group-hover:text-yellow-300 transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {video.description || 'High-fidelity HLS video stream with AES-128 token security.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        {video.uploadedAt ? new Date(video.uploadedAt).toLocaleDateString() : 'Ready'}
                      </span>
                      <span className="text-xs font-black text-yellow-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Watch 4K <Play size={12} className="fill-yellow-400" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: YOUTUBE STYLE WATCH PAGE & INTERACTIVE THEATER LAYOUT              */
        /* ========================================================================= */
        <div className="p-3 sm:p-5 lg:p-8 max-w-[1780px] mx-auto space-y-6 animate-in fade-in duration-200">
          
          {/* Top Breadcrumb & Quick Controls */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.06] text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <button
                onClick={handleClosePlayer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-900/90 hover:bg-dark-800 text-white font-bold border border-white/10 hover:border-yellow-400/40 transition-all group"
              >
                <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform text-yellow-400" />
                <span>Back to Catalog</span>
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 font-bold uppercase tracking-wider">{selectedVideo.category || 'Movies'}</span>
              <span className="text-slate-600">/</span>
              <span className="text-white font-semibold line-clamp-1 max-w-xs">{selectedVideo.title}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTheaterMode(!isTheaterMode)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition-all shadow-md ${
                  isTheaterMode
                    ? 'bg-yellow-400 text-black border-yellow-300 shadow-yellow-400/20'
                    : 'bg-dark-900/90 border-white/15 text-slate-300 hover:text-white hover:bg-dark-800'
                }`}
                title="Toggle YouTube Theater Mode (T)"
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">{isTheaterMode ? 'Standard View' : 'Theater Mode'}</span>
              </button>
              <button
                onClick={handleClosePlayer}
                className="p-2 rounded-xl bg-dark-900/90 hover:bg-dark-800 text-slate-400 hover:text-white border border-white/10 transition-colors"
                title="Exit Player"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Theater Mode Full-Width Video Top Player (When Theater Mode is ON) */}
          {isTheaterMode && (
            <div className="w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/15 relative">
              <div className="relative aspect-video max-h-[75vh] mx-auto bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          )}

          {/* YouTube 2-Column Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Main Video Player, Channel Info, Description, Comments */}
            <div className={`space-y-6 ${isTheaterMode ? 'lg:col-span-8 xl:col-span-8 2xl:col-span-9' : 'lg:col-span-8 xl:col-span-8 2xl:col-span-9'}`}>
              
              {/* Standard Mode Video Container (When Theater Mode is OFF) */}
              {!isTheaterMode && (
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-white/15 shadow-2xl group">
                  {/* Subtle Ambient Backglow */}
                  <div className="absolute -inset-2 bg-gradient-to-tr from-yellow-500/20 via-transparent to-lime-500/20 blur-2xl opacity-60 pointer-events-none -z-10" />

                  <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                    <video
                      ref={videoRef}
                      controls
                      autoPlay
                      crossOrigin="anonymous"
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={handleVideoEnded}
                      className="w-full h-full object-contain"
                    >
                      Your browser does not support the video tag.
                    </video>

                    {/* Subtitles Overlay */}
                    {selectedSubtitle !== 'off' && subtitleCues && (
                      <div className="absolute bottom-16 inset-x-0 flex justify-center pointer-events-none z-20 px-6">
                        <span className="px-4 py-2 rounded-xl bg-dark-950/90 backdrop-blur-md text-yellow-300 text-sm sm:text-base font-extrabold text-center shadow-2xl border border-white/10 max-w-2xl animate-in fade-in duration-150">
                          {subtitleCues}
                        </span>
                      </div>
                    )}

                    {/* Autoplay Next Video Countdown Overlay */}
                    {nextCountdown !== null && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-yellow-400 mb-2">Up Next in {nextCountdown}s</p>
                        <h3 className="text-xl sm:text-2xl font-black text-white max-w-md line-clamp-1 mb-6">
                          {relatedVideos[0]?.title || 'Next Video'}
                        </h3>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                              setNextCountdown(null);
                              if (relatedVideos[0]) handleSelectVideo(relatedVideos[0]);
                            }}
                            className="px-6 py-2.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-yellow-400/20"
                          >
                            <Play size={16} className="fill-black" />
                            <span>Play Now</span>
                          </button>
                          <button
                            onClick={() => {
                              if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                              setNextCountdown(null);
                            }}
                            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Resume Playback Prompt */}
                    {resumePrompt && (
                      <div className="absolute top-4 left-4 z-30 flex items-center gap-3 p-3 rounded-2xl bg-dark-950/90 backdrop-blur-xl border border-yellow-400/40 shadow-2xl animate-in slide-in-from-left duration-300">
                        <RotateCcw size={16} className="text-yellow-400 animate-spin" />
                        <div className="text-xs">
                          <p className="font-extrabold text-white">Resume previous session?</p>
                          <p className="text-[10px] text-slate-400">Position: {resumePrompt.formatted}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleResumeClick}
                            className="px-3 py-1 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black transition-all"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => setResumePrompt(null)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Top Player Badges (DRM, Resolution, Subtitles, Speed) */}
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                      {/* AES-128 DRM Badge */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowDrmModal(!showDrmModal); setShowQualityMenu(false); setShowSpeedMenu(false); setShowSubtitleMenu(false); }}
                          className={`px-3 py-1.5 rounded-xl backdrop-blur-xl border flex items-center gap-1.5 text-xs font-extrabold transition-all shadow-lg ${
                            drmStatus?.enabled
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-dark-950/80 border-white/20 text-slate-300 hover:bg-white/10'
                          }`}
                          title="AES-128 Dynamic DRM Stream"
                        >
                          <Shield size={13} className={drmStatus?.enabled ? 'text-emerald-400 fill-emerald-400/20 animate-pulse' : 'text-slate-400'} />
                          <span>AES-128 DRM</span>
                        </button>

                        {showDrmModal && (
                          <div className="absolute top-full right-0 mt-2 bg-dark-950/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-emerald-500/30 w-72 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                              <ShieldCheck size={18} className="text-emerald-400" />
                              <div>
                                <h4 className="text-xs font-black text-white uppercase tracking-wider">Dynamic DRM Active</h4>
                                <p className="text-[10px] text-emerald-400 font-bold">AES-128 CBC Segment Protection</p>
                              </div>
                            </div>
                            <div className="space-y-2 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Stream Security:</span>
                                <span className="font-bold text-emerald-400">HMAC-SHA256 Token</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Encryption:</span>
                                <span className="font-bold text-slate-200">AES-128-CBC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Token Expiry:</span>
                                <span className="font-bold text-amber-300">4 Hours</span>
                              </div>
                              {drmStatus?.token && (
                                <div className="mt-2 pt-2 border-t border-white/10">
                                  <span className="text-[9px] text-slate-400 font-mono break-all line-clamp-2">
                                    Signature: {drmStatus.token.split('.')[1] || drmStatus.token}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Subtitles Menu */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowQualityMenu(false); setShowSpeedMenu(false); }}
                          className={`px-3 py-1.5 rounded-xl backdrop-blur-xl border flex items-center gap-1.5 text-xs font-bold transition-all shadow-lg ${
                            selectedSubtitle !== 'off'
                              ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300'
                              : 'bg-dark-950/80 border-white/20 text-white hover:bg-white/10'
                          }`}
                        >
                          <Subtitles size={13} className={selectedSubtitle !== 'off' ? 'text-yellow-400' : 'text-slate-400'} />
                          <span>{subtitleOptions.find(s => s.code === selectedSubtitle)?.label.split(' ')[0]}</span>
                        </button>

                        {showSubtitleMenu && (
                          <div className="absolute top-full right-0 mt-2 bg-dark-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/15 min-w-[160px] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                            <p className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Subtitles & Audio
                            </p>
                            {subtitleOptions.map((sub) => (
                              <button
                                key={sub.code}
                                onClick={() => {
                                  setSelectedSubtitle(sub.code);
                                  setShowSubtitleMenu(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between ${
                                  selectedSubtitle === sub.code ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-300 hover:bg-white/[0.05]'
                                }`}
                              >
                                <span>{sub.label}</span>
                                {selectedSubtitle === sub.code && <Check size={14} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Playback Speed Menu */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); setShowSubtitleMenu(false); }}
                          className="bg-dark-950/80 backdrop-blur-xl border border-white/20 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-white/10 transition-all shadow-lg"
                        >
                          <Gauge size={13} className="text-yellow-400" />
                          <span>{playbackSpeed}x</span>
                        </button>

                        {showSpeedMenu && (
                          <div className="absolute top-full right-0 mt-2 bg-dark-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/15 min-w-[140px] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                            <p className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Playback Speed
                            </p>
                            {speedOptions.map((speed) => (
                              <button
                                key={speed}
                                onClick={() => handleSpeedChange(speed)}
                                className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between ${
                                  playbackSpeed === speed ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-300 hover:bg-white/[0.05]'
                                }`}
                              >
                                <span>{speed === 1.0 ? '1.0x (Normal)' : `${speed}x`}</span>
                                {playbackSpeed === speed && <Check size={14} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quality Selector */}
                      {qualityLevels.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); setShowSubtitleMenu(false); }}
                            className="bg-dark-950/80 backdrop-blur-xl border border-white/20 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-white/10 transition-all shadow-lg"
                          >
                            <Settings size={13} className="text-yellow-400" />
                            <span>{currentQuality === -1 ? 'Auto (4K)' : qualityLevels[currentQuality]?.name}</span>
                          </button>

                          {showQualityMenu && (
                            <div className="absolute top-full right-0 mt-2 bg-dark-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/15 min-w-[180px] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                              <p className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Select Resolution
                              </p>
                              <button
                                onClick={() => {
                                  if (hlsRef.current) {
                                    hlsRef.current.currentLevel = -1;
                                    setCurrentQuality(-1);
                                  }
                                  setShowQualityMenu(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between ${
                                  currentQuality === -1 ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-300 hover:bg-white/[0.05]'
                                }`}
                              >
                                <span>Auto (Adaptive 4K)</span>
                                {currentQuality === -1 && <Check size={14} />}
                              </button>
                              {qualityLevels.map((lvl) => (
                                <button
                                  key={lvl.level}
                                  onClick={() => {
                                    if (hlsRef.current) {
                                      hlsRef.current.currentLevel = lvl.level;
                                      setCurrentQuality(lvl.level);
                                    }
                                    setShowQualityMenu(false);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between ${
                                    currentQuality === lvl.level ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-300 hover:bg-white/[0.05]'
                                  }`}
                                >
                                  <span>{lvl.name}</span>
                                  {currentQuality === lvl.level && <Check size={14} />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Shortcuts */}
                      <button
                        onClick={() => setShowShortcutsHelp(true)}
                        className="p-2 rounded-xl bg-dark-950/80 backdrop-blur-xl border border-white/20 text-white hover:text-yellow-400 transition-all shadow-lg text-xs"
                        title="Keyboard Shortcuts (?)"
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* YouTube Video Title */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-[11px] font-black uppercase tracking-wider">
                    {selectedVideo.category || 'Cinema'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-bold">
                    4K Ultra HD • HLS
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    {selectedVideo.imdbRating || '8.5'} IMDb
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
                  {selectedVideo.title}
                </h1>
              </div>

              {/* YouTube Channel Bar & Action Pills (Like, Dislike, Share, Save) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
                
                {/* Channel / Creator Avatar & Subscribe Button */}
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-lime-500 p-0.5 shadow-lg shadow-yellow-500/20">
                    <div className="w-full h-full rounded-full bg-dark-950 flex items-center justify-center text-yellow-300 font-black text-sm">
                      S
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-black text-white text-sm hover:text-yellow-300 transition-colors cursor-pointer">
                        SoNALU Studios
                      </h3>
                      <CheckCircle2 size={14} className="text-yellow-400 fill-yellow-400/20" />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">1.48M subscribers</p>
                  </div>

                  <button
                    onClick={() => setIsSubscribed(!isSubscribed)}
                    className={`ml-2 px-4 py-2 rounded-full font-black text-xs transition-all flex items-center gap-1.5 shadow-md ${
                      isSubscribed
                        ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                        : 'bg-white hover:bg-yellow-400 text-black hover:scale-105 active:scale-95'
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <Bell size={13} className="fill-white" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <span>Subscribe</span>
                    )}
                  </button>
                </div>

                {/* YouTube Action Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Like / Dislike Split Pill */}
                  <div className="flex items-center bg-dark-900/90 border border-white/10 rounded-full overflow-hidden shadow-md">
                    <button
                      onClick={handleLikeClick}
                      className={`px-3.5 py-2 flex items-center gap-2 text-xs font-extrabold hover:bg-white/10 transition-colors ${
                        isLiked ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-200'
                      }`}
                      title="I like this"
                    >
                      <ThumbsUp size={15} className={isLiked ? 'fill-yellow-400' : ''} />
                      <span>{likeCount > 1000 ? `${(likeCount / 1000).toFixed(1)}K` : likeCount}</span>
                    </button>
                    <div className="w-[1px] h-5 bg-white/15" />
                    <button
                      onClick={handleDislikeClick}
                      className={`px-3 py-2 text-xs font-bold hover:bg-white/10 transition-colors ${
                        isDisliked ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400'
                      }`}
                      title="I dislike this"
                    >
                      <ThumbsDown size={15} className={isDisliked ? 'fill-rose-400' : ''} />
                    </button>
                  </div>

                  {/* Share Pill */}
                  <button
                    onClick={handleShareClick}
                    className="px-4 py-2 rounded-full bg-dark-900/90 hover:bg-dark-800 border border-white/10 hover:border-white/20 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    title="Share Video Link"
                  >
                    <Share2 size={15} />
                    <span>Share</span>
                  </button>

                  {/* Save to Watchlist Pill */}
                  <button
                    onClick={() => handleToggleWatchlist(selectedVideo.id, selectedVideo.title)}
                    className={`px-4 py-2 rounded-full border text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                      watchlistIds.includes(selectedVideo.id)
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                        : 'bg-dark-900/90 border-white/10 hover:border-white/20 text-white hover:bg-dark-800'
                    }`}
                  >
                    <Heart size={15} className={watchlistIds.includes(selectedVideo.id) ? 'fill-rose-500 text-rose-500' : ''} />
                    <span>{watchlistIds.includes(selectedVideo.id) ? 'Saved' : 'Save'}</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteVideo(selectedVideo.id, selectedVideo.title)}
                    className="p-2 rounded-full bg-dark-900/90 hover:bg-rose-500/20 border border-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Delete video from catalog"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* YouTube Expandable Description Box */}
              <div 
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="bg-dark-900/90 hover:bg-dark-850 p-4 sm:p-5 rounded-2xl border border-white/[0.08] transition-all cursor-pointer space-y-2.5 group"
              >
                <div className="flex items-center gap-3 text-xs font-extrabold text-white">
                  <span>148,920 views</span>
                  <span className="text-slate-600">•</span>
                  <span>{selectedVideo.uploadedAt ? new Date(selectedVideo.uploadedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Premiered recently'}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-yellow-400">#4KUltraHD</span>
                  <span className="text-yellow-400">#SoNALU</span>
                  <span className="text-yellow-400">#Cinema</span>
                </div>

                <p className={`text-xs sm:text-sm text-slate-300 leading-relaxed font-normal ${!showFullDescription ? 'line-clamp-2' : ''}`}>
                  {selectedVideo.description || 'High-fidelity HLS video stream delivered directly from our distributed transcoding cluster with AES-128 token security and instant audio sync.'}
                </p>

                {showFullDescription && (
                  <div className="pt-3 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Encoding</span>
                      <span className="text-white font-bold">H.264 / Multi-bitrate HLS</span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Audio Sync</span>
                      <span className="text-emerald-400 font-bold">Spatial 5.1 Surround</span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">DRM Security</span>
                      <span className="text-yellow-400 font-bold">AES-128 CBC Token</span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                      <span className="text-white font-bold">Master Profile 4K</span>
                    </div>
                  </div>
                )}

                <button 
                  type="button" 
                  className="text-xs font-black text-white group-hover:text-yellow-300 transition-colors pt-1 block"
                >
                  {showFullDescription ? 'Show less' : '...more'}
                </button>
              </div>

              {/* YouTube Comments Section */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <MessageSquare size={20} className="text-yellow-400" />
                    <span>{comments.length} Comments</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">Top Comments</span>
                </div>

                {/* Add Comment Input Form */}
                <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center font-bold text-black text-xs shadow-md shrink-0">
                    U
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onFocus={() => setIsCommentFocused(true)}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full bg-transparent border-b border-white/20 focus:border-yellow-400 text-sm text-white placeholder-slate-500 py-1.5 focus:outline-none transition-colors"
                    />
                    {isCommentFocused && (
                      <div className="flex items-center justify-end gap-2 pt-1 animate-in fade-in duration-150">
                        <button
                          type="button"
                          onClick={() => { setIsCommentFocused(false); setNewCommentText(''); }}
                          className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!newCommentText.trim()}
                          className="px-4 py-1.5 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/10 disabled:text-slate-500 text-black font-extrabold text-xs transition-all shadow-md"
                        >
                          Comment
                        </button>
                      </div>
                    )}
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-5 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3.5 items-start group">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${comment.avatarColor} flex items-center justify-center font-black text-black text-xs shrink-0 shadow-md`}>
                        {comment.author.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white">{comment.author}</span>
                          <span className="text-[11px] text-slate-500 font-medium">{comment.timeAgo}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                          {comment.text}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-slate-400 text-xs">
                          <button
                            onClick={() => handleToggleCommentLike(comment.id)}
                            className={`flex items-center gap-1 hover:text-white transition-colors ${
                              comment.isLiked ? 'text-yellow-400 font-bold' : ''
                            }`}
                          >
                            <ThumbsUp size={13} className={comment.isLiked ? 'fill-yellow-400' : ''} />
                            <span>{comment.likes > 0 ? comment.likes : ''}</span>
                          </button>
                          <button className="hover:text-white transition-colors">
                            <ThumbsDown size={13} />
                          </button>
                          <button className="text-[11px] font-bold hover:text-white transition-colors ml-1">
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: YouTube "Up Next / Related Videos" Sidebar */}
            <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-4">
              
              {/* Sidebar Header & Autoplay Toggle */}
              <div className="flex items-center justify-between pb-1">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Film size={18} className="text-yellow-400" />
                  <span>Up Next</span>
                </h3>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Autoplay</span>
                  <button
                    onClick={() => setAutoPlayNext(!autoPlayNext)}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                      autoPlayNext ? 'bg-yellow-400' : 'bg-dark-800 border border-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-black transform transition-transform duration-200 ease-in-out ${
                        autoPlayNext ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Sidebar Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSidebarFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    sidebarFilter === 'all'
                      ? 'bg-white text-black'
                      : 'bg-dark-900 text-slate-300 hover:bg-dark-800 border border-white/10'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSidebarFilter('category')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    sidebarFilter === 'category'
                      ? 'bg-white text-black'
                      : 'bg-dark-900 text-slate-300 hover:bg-dark-800 border border-white/10'
                  }`}
                >
                  From this genre
                </button>
              </div>

              {/* Related Videos List (YouTube Card Layout) */}
              <div className="space-y-3">
                {relatedVideos.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-dark-900/60 rounded-2xl border border-white/5">
                    No more related videos found.
                  </div>
                ) : (
                  relatedVideos.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectVideo(item)}
                      className="flex gap-3 p-2 rounded-2xl bg-dark-900/40 hover:bg-dark-850 border border-white/[0.04] hover:border-yellow-400/40 transition-all cursor-pointer group"
                    >
                      {/* Video Thumbnail (Left) */}
                      <div className="relative w-36 sm:w-40 aspect-video rounded-xl bg-dark-950 overflow-hidden shrink-0">
                        <img
                          src={resolveThumbnailUrl(item.posterImage || item.thumbnail, item.id)}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
                        
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-lg font-bold">
                            <Play size={14} className="fill-black translate-x-0.5" />
                          </div>
                        </div>

                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] font-black text-white">
                          4K UHD
                        </span>
                      </div>

                      {/* Video Metadata (Right) */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <h4 className="font-extrabold text-white text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-yellow-300 transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1">
                            <span>SoNALU Studios</span>
                            <CheckCircle2 size={11} className="text-yellow-400" />
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold mt-1">
                          <span>{item.category || 'Cinema'}</span>
                          <span>•</span>
                          <span className="text-amber-400 flex items-center gap-0.5">
                            <Star size={10} className="fill-amber-400" /> {item.imdbRating || '8.5'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Cinema Shortcuts Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 max-w-md w-full shadow-2xl relative bg-dark-900">
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="p-2 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                <Gauge size={20} />
              </span>
              <h3 className="text-xl font-black text-white">Player Keyboard Shortcuts</h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Play / Pause</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">Space / K</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Toggle Theater Mode</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">T</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Toggle Fullscreen</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">F</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Mute / Unmute</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Seek Forward / Back (10s)</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">← / → (or J/L)</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Volume Up / Down</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">↑ / ↓</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-white/[0.04]">
                <span>Toggle Subtitles</span>
                <kbd className="px-2 py-1 rounded bg-dark-900 border border-white/10 text-[10px] font-mono text-white">C</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="w-full mt-6 py-2.5 text-xs font-black rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 transition-colors shadow-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
