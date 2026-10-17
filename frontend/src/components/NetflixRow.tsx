import React, { useRef, useState } from 'react';
import { 
  Play, 
  Plus, 
  Check, 
  ThumbsUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  VolumeX,
  Sparkles,
  Flame,
  Star
} from 'lucide-react';

export interface NetflixCardItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  image?: string;
  thumbnail?: string;
  posterImage?: string;
  imdbRating?: number;
  matchScore?: number;
  ageRating?: string;
  duration?: string;
  quality?: string;
  genres?: string[];
  badge?: string;
  isOriginal?: boolean;
  progressPercent?: number;
  currentTime?: number;
  totalDuration?: number;
}

interface NetflixRowProps {
  title: string;
  items: NetflixCardItem[];
  onPlay: (item: NetflixCardItem) => void;
  onOpenInfo: (item: NetflixCardItem) => void;
  watchlistIds: string[];
  onToggleWatchlist: (item: NetflixCardItem) => void;
}

export default function NetflixRow({
  title,
  items,
  onPlay,
  onOpenInfo,
  watchlistIds,
  onToggleWatchlist
}: NetflixRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollPageIndex, setScrollPageIndex] = useState(0);

  const checkScrollLimits = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
      const page = Math.round(scrollLeft / Math.max(1, clientWidth));
      setScrollPageIndex(page);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScrollLimits, 350);
    }
  };

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative group/row my-6 sm:my-8 px-4 sm:px-8 md:px-12">
      {/* Row Header & Indicators */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-white tracking-wide flex items-center gap-2.5">
          <span className="hover:text-yellow-400 transition-colors cursor-pointer">{title}</span>
          <span className="text-xs font-bold text-lime-400 opacity-0 group-hover/row:opacity-100 transition-all flex items-center gap-1 cursor-pointer">
            Explore All <ChevronRight size={14} />
          </span>
        </h2>

        {/* Carousel Pagination Dashes */}
        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-[2px] rounded-full transition-all duration-300 ${
                scrollPageIndex === idx 
                  ? 'w-4 bg-yellow-400 shadow-glow-sm' 
                  : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Row Container */}
      <div className="relative">
        {/* Left Scroll Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-0 bottom-0 z-40 w-10 sm:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center rounded-r-md backdrop-blur-md opacity-0 group-hover/row:opacity-100 transition-all duration-300 shadow-2xl hover:scale-105 active:scale-95"
            aria-label="Scroll left"
          >
            <ChevronLeft size={28} className="text-yellow-400 transition-transform group-hover:scale-125" />
          </button>
        )}

        {/* Horizontal Card Rail */}
        <div
          ref={rowRef}
          onScroll={checkScrollLimits}
          className="flex items-center gap-2.5 sm:gap-3.5 overflow-x-auto no-scrollbar py-4 px-1 scroll-smooth"
        >
          {items.map((item) => {
            const isWatchlisted = watchlistIds.includes(item.id);
            const isLiked = likedIds.has(item.id);
            const isHovered = hoveredCardId === item.id;
            const imgSrc = item.image || item.thumbnail || item.posterImage || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop';
            const matchScore = item.matchScore || Math.floor(Math.random() * 8) + 92;

            return (
              <div
                key={item.id}
                className="relative flex-none w-[220px] sm:w-[260px] md:w-[300px] lg:w-[320px] aspect-[16/9] rounded-md sm:rounded-lg overflow-visible cursor-pointer transition-all duration-300 group/card"
                onMouseEnter={() => setHoveredCardId(item.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                onClick={() => onOpenInfo(item)}
              >
                {/* Base 16:9 Landscape Card */}
                <div className="w-full h-full rounded-md sm:rounded-lg overflow-hidden bg-dark-900 border border-white/10 group-hover/card:border-yellow-400/50 transition-all shadow-md group-hover/card:shadow-card-hover relative">
                  <img
                    src={imgSrc}
                    alt={item.title}
                    className="w-full h-full object-cover transform group-hover/card:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                  />

                  {/* SoNALU Brand Badge (Top-Left) */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-gradient-to-br from-yellow-400 to-lime-500 text-black font-black text-[9px] flex items-center justify-center shadow-md">
                      S
                    </span>
                    {item.isOriginal && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-yellow-300 drop-shadow-md">
                        ORIGINAL
                      </span>
                    )}
                  </div>

                  {/* Custom Badges (TOP 10 / NEW EPISODE) */}
                  {item.badge && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#e50914] text-white shadow-md">
                        {item.badge}
                      </span>
                    </div>
                  )}

                  {/* Bottom Title Gradient Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between">
                    <span className="text-xs sm:text-sm font-bold text-white line-clamp-1 drop-shadow-md">
                      {item.title}
                    </span>
                    {item.imdbRating && (
                      <span className="text-[10px] font-extrabold text-yellow-400 flex items-center gap-0.5 bg-black/60 px-1.5 py-0.5 rounded border border-yellow-500/30">
                        ★ {item.imdbRating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar (If watching) */}
                  {item.progressPercent !== undefined && item.progressPercent > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-lime-400 shadow-glow-sm"
                        style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* SoNALU Expanded Floating Preview Modal (Hover State) */}
                {isHovered && (
                  <div 
                    className="absolute -top-10 -left-6 -right-6 z-50 rounded-xl overflow-hidden bg-dark-900 border border-yellow-400/40 shadow-2xl shadow-black/90 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInfo(item);
                    }}
                  >
                    {/* Preview Image Banner */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-dark-950">
                      <img
                        src={imgSrc}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-black/30" />
                      
                      {/* Brand Logo in Preview */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-gradient-to-br from-yellow-400 to-lime-500 text-black font-black text-[10px] flex items-center justify-center shadow-lg">
                          S
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300 drop-shadow">
                          SoNALU
                        </span>
                      </div>

                      {/* Play Action Overlay Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlay(item);
                        }}
                        className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-yellow-400/90 hover:bg-yellow-300 text-black flex items-center justify-center shadow-glow transition-transform hover:scale-110 active:scale-95"
                        title="Play Now"
                      >
                        <Play size={20} className="fill-black ml-0.5" />
                      </button>
                    </div>

                    {/* Quick Interactive Control Bar */}
                    <div className="p-3.5 space-y-2.5 bg-dark-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Play Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlay(item);
                            }}
                            className="w-8 h-8 rounded-full bg-white hover:bg-yellow-400 text-black flex items-center justify-center transition-all shadow-md active:scale-90"
                            title="Play Video"
                          >
                            <Play size={14} className="fill-black ml-0.5" />
                          </button>

                          {/* Watchlist Toggle Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleWatchlist(item);
                            }}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                              isWatchlisted
                                ? 'bg-lime-500/20 border-lime-400 text-lime-400'
                                : 'bg-white/10 border-white/30 text-white hover:border-white'
                            } active:scale-90`}
                            title={isWatchlisted ? 'Remove from My List' : 'Add to My List'}
                          >
                            {isWatchlisted ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                          </button>

                          {/* Like Button */}
                          <button
                            onClick={(e) => toggleLike(e, item.id)}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                              isLiked
                                ? 'bg-yellow-500/20 border-yellow-400 text-yellow-400'
                                : 'bg-white/10 border-white/30 text-white hover:border-white'
                            } active:scale-90`}
                            title="I like this"
                          >
                            <ThumbsUp size={13} className={isLiked ? 'fill-yellow-400' : ''} />
                          </button>
                        </div>

                        {/* More Info Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInfo(item);
                          }}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all hover:border-yellow-400"
                          title="More Info"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      {/* Video Match & Quality Line */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-extrabold text-lime-400 text-glow-neon">
                          {matchScore}% Match
                        </span>
                        <span className="px-1.5 py-0.2 rounded border border-white/30 text-[10px] font-bold text-slate-300">
                          {item.ageRating || '16+'}
                        </span>
                        <span className="text-slate-300 text-[11px] font-medium">
                          {item.duration || '2h 15m'}
                        </span>
                        <span className="px-1 py-0.2 rounded bg-yellow-400/20 text-yellow-300 text-[9px] font-black border border-yellow-400/40">
                          {item.quality || '4K HDR'}
                        </span>
                      </div>

                      {/* Genres tags */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                        {(item.genres || [item.category, 'Action', 'Drama']).slice(0, 3).map((g, i) => (
                          <React.Fragment key={g}>
                            {i > 0 && <span className="text-yellow-400 text-xs">•</span>}
                            <span>{g}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Scroll Arrow */}
        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-0 bottom-0 z-40 w-10 sm:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center rounded-l-md backdrop-blur-md opacity-0 group-hover/row:opacity-100 transition-all duration-300 shadow-2xl hover:scale-105 active:scale-95"
            aria-label="Scroll right"
          >
            <ChevronRight size={28} className="text-yellow-400 transition-transform group-hover:scale-125" />
          </button>
        )}
      </div>
    </div>
  );
}
