import React, { useEffect } from 'react';
import { 
  X, 
  Play, 
  Plus, 
  Check, 
  ThumbsUp, 
  Volume2, 
  VolumeX, 
  Star, 
  Film, 
  ShieldCheck, 
  Share2, 
  Sparkles,
  Clock,
  Tv
} from 'lucide-react';
import { NetflixCardItem } from './NetflixRow';

interface NetflixModalProps {
  item: NetflixCardItem | null;
  onClose: () => void;
  onPlay: (item: NetflixCardItem) => void;
  watchlistIds: string[];
  onToggleWatchlist: (item: NetflixCardItem) => void;
  similarItems?: NetflixCardItem[];
}

export default function NetflixModal({
  item,
  onClose,
  onPlay,
  watchlistIds,
  onToggleWatchlist,
  similarItems = []
}: NetflixModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const isWatchlisted = watchlistIds.includes(item.id);
  const imgSrc = item.image || item.thumbnail || item.posterImage || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&auto=format&fit=crop';
  const matchScore = item.matchScore || 98;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden bg-dark-900 border border-yellow-500/30 shadow-2xl shadow-black/95 text-white my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>

        {/* Hero Video Banner */}
        <div className="relative aspect-[16/9] w-full bg-dark-950 overflow-hidden">
          <img
            src={imgSrc}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/30 to-black/40" />

          {/* Banner Overlaid Content */}
          <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10 space-y-3 sm:space-y-4">
            {/* Sonalu Brand Tag */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-gradient-to-br from-yellow-400 to-lime-500 text-black font-black text-xs flex items-center justify-center shadow-lg">
                N
              </span>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300 drop-shadow">
                STREAMIX FILM
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg line-clamp-2">
              {item.title}
            </h1>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => {
                  onClose();
                  onPlay(item);
                }}
                className="px-6 sm:px-8 py-3 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-sm sm:text-base flex items-center gap-2.5 shadow-glow transition-all hover:scale-105 active:scale-95"
              >
                <Play size={20} className="fill-black" />
                <span>Play Now</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(item)}
                className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all ${
                  isWatchlisted
                    ? 'bg-lime-500/25 border-lime-400 text-lime-400'
                    : 'bg-black/60 border-white/40 text-white hover:border-white'
                } hover:scale-105 active:scale-95`}
                title={isWatchlisted ? 'Remove from My List' : 'Add to My List'}
              >
                {isWatchlisted ? <Check size={18} strokeWidth={3} /> : <Plus size={20} />}
              </button>

              <button
                className="w-11 h-11 rounded-full bg-black/60 border border-white/40 text-white hover:border-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                title="Rate this title"
              >
                <ThumbsUp size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 sm:p-10 space-y-8 bg-dark-900">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left 2 Cols: Details & Synopsis */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
                <span className="font-extrabold text-lime-400 text-glow-neon text-sm sm:text-base">
                  {matchScore}% Match
                </span>
                <span className="text-slate-400 font-bold">2026</span>
                <span className="px-2 py-0.5 rounded border border-white/30 text-xs font-bold text-slate-300">
                  {item.ageRating || '18+'}
                </span>
                <span className="text-slate-300 font-medium">
                  {item.duration || '2h 18m'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300 text-xs font-black border border-yellow-400/40">
                  {item.quality || '4K ULTRA HD'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-xs font-bold border border-white/20">
                  HDR10+
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-xs font-bold border border-white/20">
                  Spatial Audio 5.1
                </span>
              </div>

              {/* Synopsis */}
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                {item.description || 
                  'In a world where choices shape destiny, an extraordinary journey begins. Packed with groundbreaking visual fidelity, edge-of-your-seat suspense, and acclaimed performances that redefine modern cinema.'}
              </p>
            </div>

            {/* Right 1 Col: Metadata info */}
            <div className="space-y-3 text-xs sm:text-sm text-slate-400 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Category:</span>
                <span className="text-slate-200 font-semibold">{item.category || 'Movies'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Genres:</span>
                <span className="text-slate-200 font-semibold">
                  {(item.genres || [item.category, 'Action', 'Suspense', 'Drama']).join(', ')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Audio & Subtitles:</span>
                <span className="text-slate-200 font-semibold">English [Original], Spanish, Hindi, French (Dolby Atmos)</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Maturity Rating:</span>
                <span className="text-slate-200 font-semibold">Recommended for ages 16 and up. Intense sequences.</span>
              </div>
            </div>
          </div>

          {/* "More Like This" Section */}
          {similarItems.length > 0 && (
            <div className="pt-6 border-t border-white/10 space-y-4">
              <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-400" />
                <span>More Like This</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {similarItems.slice(0, 6).map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => {
                      onClose();
                      onPlay(sim);
                    }}
                    className="group rounded-xl overflow-hidden bg-dark-850 border border-white/10 hover:border-yellow-400/50 transition-all cursor-pointer shadow-lg hover:shadow-card-hover"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img
                        src={sim.image || sim.thumbnail || sim.posterImage || imgSrc}
                        alt={sim.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-white line-clamp-1">{sim.title}</span>
                        <span className="text-[10px] font-bold text-lime-400">97%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
