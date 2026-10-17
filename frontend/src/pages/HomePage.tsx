import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Play, 
  Plus, 
  Check, 
  Info, 
  Sparkles, 
  LayoutList, 
  LayoutGrid, 
  SlidersHorizontal,
  ChevronRight,
  Flame,
  Star,
  Award,
  Tv,
  Film,
  Zap,
  Volume2,
  VolumeX
} from 'lucide-react';
import NetflixRow, { NetflixCardItem } from '../components/NetflixRow';
import NetflixModal from '../components/NetflixModal';
import api from '../services/api';

const PROGRESS_STORAGE_KEY = 'ott_watch_progress';
const WATCHLIST_STORAGE_KEY = 'ott_user_watchlist';

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

// Curated Mock Data matching user screenshot with rich high-res backdrops
const MOCK_TRENDING: NetflixCardItem[] = [
  {
    id: 'trending-1',
    title: 'Peaky Blinders',
    category: 'TV Series',
    description: 'A notorious gang in 1919 Birmingham, England, is led by the fierce Tommy Shelby, a crime boss set on moving up in the world no matter the cost.',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop',
    imdbRating: 8.8,
    matchScore: 99,
    ageRating: '18+',
    duration: '6 Seasons',
    quality: '4K ULTRA HD',
    badge: 'TOP 10',
    genres: ['Gritty', 'Crime', 'Period Piece', 'Drama'],
    isOriginal: true
  },
  {
    id: 'trending-2',
    title: 'Breaking Bad',
    category: 'TV Series',
    description: 'A high school chemistry teacher dying of cancer teams with a former student to secure his family\'s future by manufacturing and selling crystal meth.',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
    imdbRating: 9.5,
    matchScore: 99,
    ageRating: '18+',
    duration: '5 Seasons',
    quality: '4K ULTRA HD',
    badge: 'TOP 10',
    genres: ['Crime', 'Suspense', 'Drama', 'Dark']
  },
  {
    id: 'trending-3',
    title: 'Trailer Park Boys',
    category: 'Comedy',
    description: 'Follow the misadventures of sunnyvale trailer park\'s most colorful residents as they hatch petty get-rich-quick schemes.',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
    imdbRating: 8.6,
    matchScore: 94,
    ageRating: '18+',
    duration: '12 Seasons',
    quality: 'HD',
    badge: 'NEW EPISODES',
    genres: ['Mockumentary', 'Absurd', 'Comedy']
  },
  {
    id: 'trending-4',
    title: 'Orange Is the New Black',
    category: 'TV Series',
    description: 'A privileged New Yorker ends up in a women\'s federal prison when a past crime catches up with her in this Emmy-winning series.',
    image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop',
    imdbRating: 8.1,
    matchScore: 95,
    ageRating: '18+',
    duration: '7 Seasons',
    quality: '4K HDR',
    badge: 'TOP 10',
    genres: ['Drama', 'Dark Comedy', 'Emotional'],
    isOriginal: true
  },
  {
    id: 'trending-5',
    title: 'Money Heist (La Casa de Papel)',
    category: 'TV Series',
    description: 'Eight thieves take hostages and lock themselves in the Royal Mint of Spain as a criminal mastermind manipulates the police.',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop',
    imdbRating: 8.2,
    matchScore: 98,
    ageRating: '16+',
    duration: '5 Parts',
    quality: '4K ULTRA HD',
    badge: 'TOP 10',
    genres: ['Suspenseful', 'Exciting', 'Thriller'],
    isOriginal: true
  },
  {
    id: 'trending-6',
    title: 'Stranger Things',
    category: 'TV Series',
    description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
    imdbRating: 8.7,
    matchScore: 98,
    ageRating: '16+',
    duration: '4 Seasons',
    quality: '4K HDR10+',
    badge: 'POPULAR',
    genres: ['Nostalgic', 'Sci-Fi', 'Supernatural'],
    isOriginal: true
  }
];

const MOCK_CRITICALLY_ACCLAIMED: NetflixCardItem[] = [
  {
    id: 'critic-1',
    title: 'Black Mirror: Bandersnatch',
    category: 'Movies',
    description: 'In 1984, a young programmer begins to question reality as he adapts a dark fantasy novel into a video game.',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop',
    imdbRating: 8.9,
    matchScore: 97,
    ageRating: '18+',
    duration: '1h 30m',
    quality: '4K ULTRA HD',
    badge: 'INTERACTIVE',
    genres: ['Mind-Bending', 'Sci-Fi', 'Psychological'],
    isOriginal: true
  },
  {
    id: 'critic-2',
    title: 'Grey\'s Anatomy',
    category: 'TV Series',
    description: 'Intern Meredith Grey and her peers face life-or-death decisions, heartbreak, and high-pressure hospital drama.',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
    imdbRating: 8.0,
    matchScore: 93,
    ageRating: '16+',
    duration: '20 Seasons',
    quality: 'HD',
    badge: 'TRENDING',
    genres: ['Medical', 'Emotional', 'Romantic Drama']
  },
  {
    id: 'critic-3',
    title: 'The Walking Dead',
    category: 'TV Series',
    description: 'In the wake of a zombie apocalypse, survivors cling to hope for humanity by banding together under Sheriff Rick Grimes.',
    image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop',
    imdbRating: 8.3,
    matchScore: 96,
    ageRating: '18+',
    duration: '11 Seasons',
    quality: '4K ULTRA HD',
    badge: 'POPULAR',
    genres: ['Horror', 'Gory', 'Suspense']
  },
  {
    id: 'critic-4',
    title: 'Russian Doll',
    category: 'TV Series',
    description: 'Nadia keeps dying and reliving her 36th birthday party in an ongoing surreal time loop in New York City.',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
    imdbRating: 8.4,
    matchScore: 96,
    ageRating: '18+',
    duration: '2 Seasons',
    quality: '4K HDR',
    genres: ['Offbeat', 'Time-Loop', 'Dark Comedy'],
    isOriginal: true
  },
  {
    id: 'critic-5',
    title: 'Sherlock',
    category: 'TV Series',
    description: 'In this contemporary take on Arthur Conan Doyle\'s detective stories, Dr. John Watson and Sherlock Holmes solve eccentric crimes in 21st-century London.',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop',
    imdbRating: 9.1,
    matchScore: 98,
    ageRating: '16+',
    duration: '4 Seasons',
    quality: '4K ULTRA HD',
    badge: 'CRITICS CHOICE',
    genres: ['Clever', 'Mystery', 'Detective']
  },
  {
    id: 'critic-6',
    title: 'The Crown',
    category: 'TV Series',
    description: 'This drama follows the political rivalries and romance of Queen Elizabeth II\'s reign and the events that shaped the second half of the 20th century.',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop',
    imdbRating: 8.6,
    matchScore: 97,
    ageRating: '16+',
    duration: '6 Seasons',
    quality: '4K Dolby Vision',
    badge: 'EMMY WINNER',
    genres: ['Lavish', 'Historical', 'Drama'],
    isOriginal: true
  }
];

const MOCK_TOP_PICKS: NetflixCardItem[] = [
  {
    id: 'top-1',
    title: 'Parks and Recreation',
    category: 'Comedy',
    description: 'In this mockumentary comedy, an enthusiastic mid-level bureaucrat in an Indiana parks department attempts to beautify her town.',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
    imdbRating: 8.6,
    matchScore: 96,
    ageRating: '14+',
    duration: '7 Seasons',
    quality: 'HD',
    genres: ['Heartfelt', 'Goofy', 'Workplace Comedy']
  },
  {
    id: 'top-2',
    title: 'The Good Place',
    category: 'Comedy',
    description: 'Due to an error, a deceased woman who wasn\'t exceptionally good is sent to a heavenly afterlife. To stay, she attempts to become ethical.',
    image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop',
    imdbRating: 8.2,
    matchScore: 98,
    ageRating: '14+',
    duration: '4 Seasons',
    quality: '4K HDR',
    badge: 'NEW EPISODE',
    genres: ['Philosophical', 'Charming', 'Comedy'],
    isOriginal: true
  },
  {
    id: 'top-3',
    title: 'American Horror Story',
    category: 'TV Series',
    description: 'An anthology horror series with each season telling a distinct spine-chilling tale of haunted houses, covens, asylums, and cults.',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
    imdbRating: 8.0,
    matchScore: 92,
    ageRating: '18+',
    duration: '12 Seasons',
    quality: '4K ULTRA HD',
    badge: 'CHILLING',
    genres: ['Sinister', 'Horror', 'Supernatural']
  },
  {
    id: 'top-4',
    title: 'Arrested Development',
    category: 'Comedy',
    description: 'Level-headed Michael Bluth takes over family affairs after his father is imprisoned. But the rest of his spoiled clan are completely eccentric.',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop',
    imdbRating: 8.7,
    matchScore: 95,
    ageRating: '16+',
    duration: '5 Seasons',
    quality: '4K HDR',
    genres: ['Clever', 'Satirical', 'Absurd Comedy'],
    isOriginal: true
  },
  {
    id: 'top-5',
    title: 'Patriot Act with Hasan Minhaj',
    category: 'Talk Show',
    description: 'Hasan Minhaj brings an incisive and nuanced perspective to global news, politics and culture with dynamic visualizations.',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop',
    imdbRating: 8.3,
    matchScore: 94,
    ageRating: '16+',
    duration: '6 Volumes',
    quality: '4K ULTRA HD',
    badge: 'WEEKLY',
    genres: ['Provocative', 'Investigative', 'Comedy'],
    isOriginal: true
  },
  {
    id: 'top-6',
    title: 'The Twilight Zone',
    category: 'Sci-Fi',
    description: 'An updated reimagining of the classic anthology series exploring tales of suspense, mystery, quantum phenomena and the human condition.',
    image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop',
    imdbRating: 7.8,
    matchScore: 91,
    ageRating: '16+',
    duration: '2 Seasons',
    quality: '4K ULTRA HD',
    genres: ['Mind-Bending', 'Sci-Fi', 'Suspense']
  }
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'rows' | 'grid'>('rows');
  const [selectedModalItem, setSelectedModalItem] = useState<NetflixCardItem | null>(null);
  const [dbVideos, setDbVideos] = useState<NetflixCardItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<NetflixCardItem[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [heroMuted, setHeroMuted] = useState(true);

  // Load Saved Watchlist
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (raw) setWatchlistIds(JSON.parse(raw));
    } catch {}
  }, []);

  // Fetch Live Database Catalog Videos
  useEffect(() => {
    api.getContent(1, 50).then((res) => {
      const list = Array.isArray(res.data) ? res.data : res.data?.data?.videos || res.data?.videos || [];
      if (Array.isArray(list) && list.length > 0) {
        const mapped: NetflixCardItem[] = list.map((v: any) => ({
          id: v.id || v._id,
          title: v.title,
          category: v.category || 'Movies',
          description: v.description,
          image: resolveThumbnailUrl(v.thumbnail || v.posterImage, v.id || v._id),
          thumbnail: resolveThumbnailUrl(v.thumbnail, v.id || v._id),
          posterImage: resolveThumbnailUrl(v.posterImage, v.id || v._id),
          imdbRating: v.imdbRating || 8.5,
          matchScore: 98,
          ageRating: '16+',
          duration: '2h 14m',
          quality: '4K HLS',
          badge: v.status === 'ready' ? '4K READY' : 'NEW',
          isOriginal: true,
          genres: [v.category || 'Cinema', 'Exclusive', 'Ultra HD']
        }));
        setDbVideos(mapped);

        // Sync Continue Watching against active catalog videos
        try {
          const rawProg = localStorage.getItem(PROGRESS_STORAGE_KEY);
          if (rawProg) {
            const parsed = JSON.parse(rawProg);
            const validIds = new Set(mapped.map((m) => m.id));
            const activeProgItems: NetflixCardItem[] = [];

            Object.keys(parsed).forEach((vidId) => {
              if (validIds.has(vidId)) {
                const prog = parsed[vidId];
                const matchingDb = mapped.find((m) => m.id === vidId);
                if (matchingDb && prog.percent > 0 && prog.percent < 98) {
                  activeProgItems.push({
                    ...matchingDb,
                    progressPercent: prog.percent,
                    currentTime: prog.currentTime,
                    totalDuration: prog.duration
                  });
                }
              }
            });
            setContinueWatching(activeProgItems);
          }
        } catch {}
      }
    }).catch((err) => {
      console.warn('Could not load live catalog:', err);
    });
  }, []);

  const handleToggleWatchlist = (item: NetflixCardItem) => {
    setWatchlistIds((prev) => {
      const next = prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id];
      try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handlePlayVideo = (item: NetflixCardItem) => {
    navigate(`/browse?play=${encodeURIComponent(item.id)}`);
  };

  // Featured Hero Item (Top Banner)
  const heroItem = dbVideos[0] || MOCK_TRENDING[0];

  return (
    <div className="min-h-screen pb-24 text-white font-sans selection:bg-yellow-400 selection:text-black">
      {/* Top Netflix Billboard / Hero Showcase */}
      <div className="relative w-full aspect-[16/8] sm:aspect-[21/9] max-h-[700px] overflow-hidden bg-dark-950">
        <img
          src={heroItem.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920&h=1080&fit=crop'}
          alt={heroItem.title}
          className="w-full h-full object-cover object-center filter brightness-90"
        />

        {/* Ambient Sonalu Golden Flower Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050a06] via-[#050a06]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050a06] via-[#050a06]/60 to-transparent w-full md:w-3/4" />
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />

        {/* Hero Details Overlay */}
        <div className="absolute bottom-10 sm:bottom-16 md:bottom-20 left-4 sm:left-8 md:left-12 max-w-2xl space-y-3 sm:space-y-4 z-20">
          {/* SoNALU Brand Tag */}
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-gradient-to-br from-yellow-400 to-lime-500 text-black font-black text-xs flex items-center justify-center shadow-lg">
              S
            </span>
            <span className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-yellow-300 drop-shadow">
              SoNALU ORIGINAL
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl">
            {heroItem.title}
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-slate-200 line-clamp-3 leading-relaxed drop-shadow-md">
            {heroItem.description ||
              'A world where ambition meets consequence. Streamed in breathtaking 4K Ultra HD with spatial audio and instant adaptive resolution playback.'}
          </p>

          {/* Hero Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handlePlayVideo(heroItem)}
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-md bg-white hover:bg-yellow-400 text-black font-extrabold text-sm sm:text-base flex items-center gap-2.5 shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <Play size={20} className="fill-black" />
              <span>Play</span>
            </button>

            <button
              onClick={() => setSelectedModalItem(heroItem)}
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-md bg-white/20 hover:bg-white/30 text-white font-extrabold text-sm sm:text-base flex items-center gap-2.5 backdrop-blur-md transition-all hover:scale-105 active:scale-95 border border-white/20"
            >
              <Info size={20} />
              <span>More Info</span>
            </button>
          </div>
        </div>

        {/* Hero Audio / Age Rating Right Bar */}
        <div className="absolute bottom-16 sm:bottom-20 right-0 z-20 flex items-center gap-3">
          <button
            onClick={() => setHeroMuted(!heroMuted)}
            className="w-10 h-10 rounded-full border border-white/40 bg-black/50 text-white flex items-center justify-center hover:border-white transition-all mr-3"
            title={heroMuted ? 'Unmute' : 'Mute'}
          >
            {heroMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <span className="bg-black/60 border-l-4 border-yellow-400 text-white font-bold text-xs sm:text-sm py-1 pl-3 pr-6">
            18+
          </span>
        </div>
      </div>

      {/* Main Netflix Content Rows Section */}
      <div className="-mt-8 sm:-mt-14 relative z-30 space-y-4">
        {/* Page Category Header & View Switcher (Exact from Screenshot) */}
        <div className="px-4 sm:px-8 md:px-12 flex items-center justify-between pt-4 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Award-Winning TV Shows</span>
              <span className="text-xs font-bold uppercase tracking-widest text-lime-400 bg-lime-400/10 px-2.5 py-0.5 rounded-full border border-lime-400/30">
                Sonalu 4K
              </span>
            </h1>
          </div>

          {/* View Mode Toggle: [ = ] List/Rows vs [ :: ] Grid */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/20">
            <button
              onClick={() => setViewMode('rows')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'rows' ? 'bg-white/20 text-yellow-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Rows View (Netflix Slider)"
            >
              <LayoutList size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'grid' ? 'bg-white/20 text-yellow-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Continue Watching Row (If any active items) */}
        {continueWatching.length > 0 && (
          <NetflixRow
            title="Continue Watching for You"
            items={continueWatching}
            onPlay={handlePlayVideo}
            onOpenInfo={setSelectedModalItem}
            watchlistIds={watchlistIds}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {/* Live Catalog Videos Row */}
        {dbVideos.length > 0 && (
          <NetflixRow
            title="Popular on Streamix 4K"
            items={dbVideos}
            onPlay={handlePlayVideo}
            onOpenInfo={setSelectedModalItem}
            watchlistIds={watchlistIds}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        {/* Row 1: Trending Now (From Screenshot) */}
        <NetflixRow
          title="Trending Now"
          items={MOCK_TRENDING}
          onPlay={handlePlayVideo}
          onOpenInfo={setSelectedModalItem}
          watchlistIds={watchlistIds}
          onToggleWatchlist={handleToggleWatchlist}
        />

        {/* Row 2: Critically Acclaimed TV Dramas (From Screenshot) */}
        <NetflixRow
          title="Critically Acclaimed TV Dramas"
          items={MOCK_CRITICALLY_ACCLAIMED}
          onPlay={handlePlayVideo}
          onOpenInfo={setSelectedModalItem}
          watchlistIds={watchlistIds}
          onToggleWatchlist={handleToggleWatchlist}
        />

        {/* Row 3: Top Picks for bm25 (From Screenshot) */}
        <NetflixRow
          title="Top Picks for You"
          items={MOCK_TOP_PICKS}
          onPlay={handlePlayVideo}
          onOpenInfo={setSelectedModalItem}
          watchlistIds={watchlistIds}
          onToggleWatchlist={handleToggleWatchlist}
        />

        {/* Row 4: Action & Thrillers */}
        <NetflixRow
          title="Action, Sci-Fi & Blockbusters"
          items={[...MOCK_TRENDING].reverse()}
          onPlay={handlePlayVideo}
          onOpenInfo={setSelectedModalItem}
          watchlistIds={watchlistIds}
          onToggleWatchlist={handleToggleWatchlist}
        />
      </div>

      {/* Netflix Detail Modal */}
      <NetflixModal
        item={selectedModalItem}
        onClose={() => setSelectedModalItem(null)}
        onPlay={handlePlayVideo}
        watchlistIds={watchlistIds}
        onToggleWatchlist={handleToggleWatchlist}
        similarItems={[...MOCK_TRENDING, ...MOCK_TOP_PICKS]}
      />
    </div>
  );
}
