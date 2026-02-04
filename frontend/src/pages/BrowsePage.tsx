import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Plus, Heart, X, Trash2, Settings } from 'lucide-react';
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
}

interface QualityLevel {
  level: number;
  height: number;
  bitrate: number;
  name: string;
}

export default function BrowsePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  // Handle video playback when selectedVideo changes
  useEffect(() => {
    if (selectedVideo && videoRef.current) {
      // Destroy previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      setQualityLevels([]);
      setCurrentQuality(-1);
      setShowQualityMenu(false);

      const hlsUrl = `http://localhost:3000/api/content/videos/${selectedVideo.id}/hls`;
      const mp4Url = `http://localhost:3003/uploads/${selectedVideo.fileName}`;
      
      console.log('[VIDEO] Playing video:', selectedVideo.title, 'Status:', selectedVideo.status);
      
      if (selectedVideo.status === 'ready' && HLS.isSupported()) {
        console.log('[VIDEO] Attempting HLS playback from:', hlsUrl);
        
        // Fetch manifest to check if it's real HLS or MP4 fallback
        fetch(hlsUrl)
          .then(res => res.text())
          .then(manifest => {
            // Check if it's a real HLS playlist (has multiple quality playlists)
            const isRealHLS = manifest.includes('360p/playlist') ||
                             manifest.includes('480p/playlist') ||
                             manifest.includes('720p/playlist') ||
                             manifest.includes('1080p/playlist') ||
                             manifest.includes('.m3u8');
            
            if (isRealHLS) {
              console.log('[VIDEO] Real HLS detected, using HLS.js');
              
              // Use HLS.js for real HLS playlists
              const hls = new HLS({
                debug: false,
                enableWorker: true,
                autoStartLoad: true,
              });
              hlsRef.current = hls;
              
              hls.on(HLS.Events.MANIFEST_PARSED, (event, data) => {
                console.log('[VIDEO] HLS manifest parsed, levels:', data.levels.length);
                
                // Build quality levels array
                const levels: QualityLevel[] = data.levels.map((level: any, index: number) => ({
                  level: index,
                  height: level.height,
                  bitrate: level.bitrate,
                  name: level.height ? `${level.height}p` : `Level ${index}`,
                }));
                
                setQualityLevels(levels);
                setCurrentQuality(hls.currentLevel);
                console.log('[VIDEO] Available quality levels:', levels);
                
                videoRef.current?.play().catch(err => {
                  console.error('[VIDEO] Playback error:', err);
                });
              });

              hls.on(HLS.Events.LEVEL_SWITCHED, (event, data) => {
                setCurrentQuality(data.level);
                console.log('[VIDEO] Quality switched to level:', data.level);
              });

              hls.on(HLS.Events.ERROR, (event, data) => {
                console.error('[VIDEO] HLS error:', data);
                if (data.fatal) {
                  console.warn('[VIDEO] Fatal HLS error, falling back to MP4');
                  hls.destroy();
                  hlsRef.current = null;
                  
                  if (videoRef.current) {
                    console.log('[VIDEO] Loading MP4 fallback:', mp4Url);
                    videoRef.current!.src = mp4Url;
                    videoRef.current!.play().catch(err => {
                      console.error('[VIDEO] MP4 playback error:', err);
                    });
                  }
                }
              });

              hls.loadSource(hlsUrl);
              hls.attachMedia(videoRef.current!);
            } else {
              // Fallback manifest is actually MP4, use native player
              console.log('[VIDEO] MP4 fallback detected, using native player');
              videoRef.current!.src = mp4Url;
              videoRef.current!.play().catch(err => {
                console.error('[VIDEO] Playback error:', err);
              });
            }
          })
          .catch(err => {
            console.error('[VIDEO] Failed to fetch manifest:', err);
            // Fallback to native MP4
            videoRef.current!.src = mp4Url;
            videoRef.current!.play().catch(playErr => {
              console.error('[VIDEO] Playback error:', playErr);
            });
          });
      } else {
        // Non-ready videos or no HLS support: use MP4
        console.log('[VIDEO] Using native MP4 player:', mp4Url);
        videoRef.current!.src = mp4Url;
        videoRef.current!.play().catch(err => {
          console.error('[VIDEO] Playback error:', err);
        });
      }
    }

    // Cleanup on unmount
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedVideo]);

  const loadContent = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Loading content...');
      const response = await api.getContent();
      console.log('API Response:', response);
      console.log('Videos data:', response.data.data.videos);
      setVideos(response.data.data.videos || []);
      console.log('Videos set to state:', response.data.data.videos?.length || 0);
    } catch (err: any) {
      setError('Failed to load content');
      console.error('Load content error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadContent();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.searchContent(searchQuery);
      setVideos(response.data.data.videos || []);
    } catch (err: any) {
      setError('Search failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async (videoId: string) => {
    try {
      await api.addToWatchlist(videoId);
      alert('Added to watchlist!');
    } catch (err) {
      alert('Failed to add to watchlist');
    }
  };

  const handleDeleteVideo = async (videoId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await api.deleteVideo(videoId);
      setVideos(videos.filter(v => v.id !== videoId));
      if (selectedVideo?.id === videoId) {
        setSelectedVideo(null);
      }
      alert('Video deleted successfully!');
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(err.response?.data?.message || 'Failed to delete video');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Search */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies and shows..."
              className="w-full px-6 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-primary focus:outline-none transition pl-12"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          </div>
        </form>

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading content...</p>
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No content found</p>
          </div>
        )}

        {!loading && videos.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-6">{searchQuery ? 'Search Results' : 'All Content'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {videos.filter(v => v.id).map((video) => (
                <div key={video.id} className="group">
                  <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video mb-4 hover:scale-105 transition">
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                      <Play className="text-slate-600" size={48} />
                    </div>
                    
                    {/* Processing Status Overlay */}
                    {video.status === 'processing' && (
                      <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
                        <div className="animate-spin mb-2">
                          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full" />
                        </div>
                        <p className="text-sm text-slate-300">Processing...</p>
                        {video.hlsProgress !== undefined && (
                          <p className="text-xs text-slate-400 mt-2">{video.hlsProgress}% {video.processingStage}</p>
                        )}
                      </div>
                    )}
                    
                    {video.status === 'ready' && (
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button 
                          onClick={() => setSelectedVideo(video)}
                          className="bg-primary hover:bg-indigo-600 text-white p-3 rounded-full transition"
                        >
                          <Play size={24} />
                        </button>
                        <button
                          onClick={() => handleAddToWatchlist(video.id)}
                          className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full transition"
                        >
                          <Plus size={24} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (video.id) handleDeleteVideo(video.id, video.title);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition"
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg line-clamp-1">{video.title}</h3>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-2">{video.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`${video.status === 'processing' ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {video.status === 'processing' ? '⏳ Processing' : video.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={16} className="text-secondary" />
                      {video.imdbRating || 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Video Player Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-lg max-w-4xl w-full">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 className="text-xl font-bold">{selectedVideo.title}</h2>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="aspect-video bg-black relative group">
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  crossOrigin="anonymous"
                  className="w-full h-full"
                  onError={(e) => {
                    console.error('Video error:', e);
                    const video = e.target as HTMLVideoElement;
                    console.error('Video error details:', {
                      error: video.error,
                      src: video.src,
                      networkState: video.networkState,
                      readyState: video.readyState
                    });
                  }}
                >
                  Your browser does not support the video tag.
                </video>

                {/* Quality Selector Button */}
                {qualityLevels.length > 0 && (
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="bg-black bg-opacity-75 hover:bg-opacity-90 text-white px-3 py-1 rounded flex items-center gap-2 text-sm"
                      >
                        <Settings size={16} />
                        {qualityLevels[currentQuality]?.name || 'Auto'}
                      </button>

                      {/* Quality Menu */}
                      {showQualityMenu && (
                        <div className="absolute top-full right-0 mt-2 bg-black bg-opacity-95 rounded border border-slate-700 z-50 min-w-max">
                          <button
                            onClick={() => {
                              if (hlsRef.current) {
                                hlsRef.current.currentLevel = -1;
                                setCurrentQuality(-1);
                              }
                              setShowQualityMenu(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition ${
                              currentQuality === -1 ? 'bg-slate-700 text-blue-400' : 'text-slate-300'
                            }`}
                          >
                            Auto (Adaptive)
                          </button>
                          
                          {qualityLevels.map((quality) => (
                            <button
                              key={quality.level}
                              onClick={() => {
                                if (hlsRef.current) {
                                  hlsRef.current.currentLevel = quality.level;
                                  setCurrentQuality(quality.level);
                                }
                                setShowQualityMenu(false);
                              }}
                              className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition ${
                                currentQuality === quality.level
                                  ? 'bg-slate-700 text-blue-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {quality.name} ({(quality.bitrate / 1000).toFixed(0)} kbps)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2">{selectedVideo.title}</h3>
                <p className="text-slate-300 mb-2">{selectedVideo.description}</p>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Category: {selectedVideo.category}</span>
                  <span>Size: {selectedVideo.fileSize ? (selectedVideo.fileSize / (1024 * 1024)).toFixed(2) : 'N/A'} MB</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
