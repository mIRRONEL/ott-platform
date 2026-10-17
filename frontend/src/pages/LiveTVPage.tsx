import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Radio, 
  Tv, 
  Play, 
  Pause,
  Square,
  Volume2, 
  VolumeX, 
  Volume1,
  Maximize, 
  Minimize,
  Users, 
  Clock, 
  Send, 
  Flame, 
  Heart, 
  Sparkles, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  Star, 
  Activity, 
  Info,
  Layers,
  Film,
  Zap,
  Check,
  AlertCircle,
  Settings,
  RotateCw,
  Sliders,
  HelpCircle,
  PictureInPicture,
  Gauge,
  Bell,
  BellRing,
  Share2,
  X
} from 'lucide-react';
import HLS from 'hls.js';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

interface Program {
  id: string;
  title: string;
  synopsis: string;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "10:30"
  startHour: number; // e.g. 8.0
  endHour: number;   // e.g. 10.5
  duration: string;
  category: string;
  rating: string;
  cast?: string;
  isLive?: boolean;
}

interface Channel {
  id: string;
  number: number;
  name: string;
  category: string;
  badge: string;
  viewers: string;
  quality: string;
  logo: string;
  currentProgram: {
    title: string;
    synopsis: string;
    startTime: string;
    endTime: string;
    progressPercent: number;
    rating: string;
    category: string;
  };
  schedule: Program[];
}

interface ChatMessage {
  id: string;
  user: string;
  avatar: string;
  message: string;
  time: string;
  isVip?: boolean;
}

interface ReactionParticle {
  id: number;
  emoji: string;
  left: number;
}

interface QualityLevel {
  level: number;
  height: number;
  bitrate: number;
  name: string;
}

const CHANNELS_DATA: Channel[] = [
  {
    id: 'ch-1',
    number: 101,
    name: 'SoNALU Cinema 4K',
    category: 'Cinema',
    badge: '4K ULTRA HD',
    viewers: '4,842',
    quality: '4K • 60 FPS • Dolby Atmos',
    logo: '🎬',
    currentProgram: {
      title: 'Cyberpunk 2099: Neon Horizon',
      synopsis: 'In a dystopian metropolis driven by synthetic consciousness, an operative uncovers a conspiracy that threatens human memory.',
      startTime: '10:00 AM',
      endTime: '12:30 PM',
      progressPercent: 58,
      rating: '9.8',
      category: 'Sci-Fi'
    },
    schedule: [
      { id: 'p-101-1', title: 'The Matrix Genesis', category: 'Sci-Fi', startTime: '08:00 AM', endTime: '10:00 AM', startHour: 8.0, endHour: 10.0, duration: '2h 00m', rating: '9.4', synopsis: 'A classic tale of simulated reality and technological transcendence.' },
      { id: 'p-101-2', title: 'Cyberpunk 2099: Neon Horizon', category: 'Sci-Fi', startTime: '10:00 AM', endTime: '12:30 PM', startHour: 10.0, endHour: 12.5, duration: '2h 30m', rating: '9.8', synopsis: 'In a dystopian metropolis driven by synthetic consciousness, an operative uncovers a conspiracy that threatens human memory.', isLive: true },
      { id: 'p-101-3', title: 'Interstellar Voyage: Deep Space', category: 'Adventure', startTime: '12:30 PM', endTime: '03:15 PM', startHour: 12.5, endHour: 15.25, duration: '2h 45m', rating: '9.7', synopsis: 'A team of courageous explorers travel through a wormhole in search of humanity\'s future.' },
      { id: 'p-101-4', title: 'Shadows of the Dynasty 4K', category: 'Action', startTime: '03:15 PM', endTime: '05:30 PM', startHour: 15.25, endHour: 17.5, duration: '2h 15m', rating: '9.3', synopsis: 'Epic martial arts saga spanning generations of legendary warriors.' },
      { id: 'p-101-5', title: 'The Silent Abyss UHD', category: 'Thriller', startTime: '05:30 PM', endTime: '07:45 PM', startHour: 17.5, endHour: 19.75, duration: '2h 15m', rating: '9.5', synopsis: 'Deep sea research sub uncovers alien ruins in the Mariana Trench.' },
      { id: 'p-101-6', title: 'Quantum Protocol', category: 'Action', startTime: '07:45 PM', endTime: '10:00 PM', startHour: 19.75, endHour: 22.0, duration: '2h 15m', rating: '9.6', synopsis: 'Elite cyber-security operatives race against a rogue quantum mainframe.' }
    ]
  },
  {
    id: 'ch-2',
    number: 102,
    name: 'Cloud & Tech Academy Live',
    category: 'Education',
    badge: 'LIVE WORKSHOP',
    viewers: '2,910',
    quality: '1080p60 • Spatial Audio',
    logo: '💻',
    currentProgram: {
      title: 'Linux Academy 01: Deep Dive Masterclass',
      synopsis: 'Complete hands-on Linux system administration, storage clusters, and high-availability container deployment.',
      startTime: '10:30 AM',
      endTime: '12:00 PM',
      progressPercent: 46,
      rating: '9.5',
      category: 'DevOps'
    },
    schedule: [
      { id: 'p-102-1', title: 'Docker Container Fundamentals', category: 'DevOps', startTime: '08:00 AM', endTime: '09:30 AM', startHour: 8.0, endHour: 9.5, duration: '1h 30m', rating: '9.2', synopsis: 'Learn multi-stage builds, rootless containers and layer optimization.' },
      { id: 'p-102-2', title: 'Kubernetes Cluster Provisioning', category: 'Cloud', startTime: '09:30 AM', endTime: '10:30 AM', startHour: 9.5, endHour: 10.5, duration: '1h 00m', rating: '9.4', synopsis: 'Deploying high availability control planes and ingress controllers.' },
      { id: 'p-102-3', title: 'Linux Academy 01: Deep Dive', category: 'DevOps', startTime: '10:30 AM', endTime: '12:00 PM', startHour: 10.5, endHour: 12.0, duration: '1h 30m', rating: '9.5', synopsis: 'Complete hands-on Linux system administration, storage clusters, and high-availability container deployment.', isLive: true },
      { id: 'p-102-4', title: 'Kafka KRaft Cluster Architecture', category: 'Data', startTime: '12:00 PM', endTime: '01:45 PM', startHour: 12.0, endHour: 13.75, duration: '1h 45m', rating: '9.6', synopsis: 'Zookeeper-free event streaming topologies and message replication.' },
      { id: 'p-102-5', title: 'Elasticsearch Dual-Engine Indexing', category: 'Search', startTime: '01:45 PM', endTime: '03:30 PM', startHour: 13.75, endHour: 15.5, duration: '1h 45m', rating: '9.3', synopsis: 'Real-time fuzzy search, inverted indexing, and cluster sharding.' },
      { id: 'p-102-6', title: 'Fullstack React 18 & Node Microservices', category: 'Web', startTime: '03:30 PM', endTime: '06:00 PM', startHour: 15.5, endHour: 18.0, duration: '2h 30m', rating: '9.7', synopsis: 'Building responsive high-throughput streaming interfaces.' }
    ]
  },
  {
    id: 'ch-3',
    number: 103,
    name: 'Pulse Action & Esports 24/7',
    category: 'Sports',
    badge: 'TOURNAMENT LIVE',
    viewers: '6,520',
    quality: '4K • 120 FPS HDR',
    logo: '⚡',
    currentProgram: {
      title: 'Apex Legends Pro League Global Finals',
      synopsis: 'Top international teams battle in high-intensity battle royale skirmishes for the grand champion trophy.',
      startTime: '09:00 AM',
      endTime: '01:00 PM',
      progressPercent: 72,
      rating: '9.6',
      category: 'Esports'
    },
    schedule: [
      { id: 'p-103-1', title: 'Valorant Masters Semifinals', category: 'Esports', startTime: '08:00 AM', endTime: '09:00 AM', startHour: 8.0, endHour: 9.0, duration: '1h 00m', rating: '9.2', synopsis: 'Highlights and clutch moments from the international qualifiers.' },
      { id: 'p-103-2', title: 'Apex Legends Pro League Global Finals', category: 'Esports', startTime: '09:00 AM', endTime: '01:00 PM', startHour: 9.0, endHour: 13.0, duration: '4h 00m', rating: '9.6', synopsis: 'Top international teams battle in high-intensity battle royale skirmishes for the grand champion trophy.', isLive: true },
      { id: 'p-103-3', title: 'Extreme Downhill MTB Championship', category: 'Sports', startTime: '01:00 PM', endTime: '03:00 PM', startHour: 13.0, endHour: 15.0, duration: '2h 00m', rating: '9.5', synopsis: 'World-class downhill mountain riders navigate steep Alpine terrain.' },
      { id: 'p-103-4', title: 'Red Bull Air Race World Tour', category: 'Sports', startTime: '03:00 PM', endTime: '05:30 PM', startHour: 15.0, endHour: 17.5, duration: '2h 30m', rating: '9.4', synopsis: 'High-speed precision aerobatics through pylons at 400 km/h.' },
      { id: 'p-103-5', title: 'Counter-Strike 2 World Major', category: 'Esports', startTime: '05:30 PM', endTime: '09:00 PM', startHour: 17.5, endHour: 21.0, duration: '3h 30m', rating: '9.8', synopsis: 'The grand final match of the summer season.' }
    ]
  },
  {
    id: 'ch-4',
    number: 104,
    name: 'Planet Earth & IMAX Nature',
    category: 'Documentary',
    badge: 'IMAX NATURE',
    viewers: '2,830',
    quality: '4K HDR • Wildlife Audio',
    logo: '🌿',
    currentProgram: {
      title: 'Deep Mariana: The Uncharted Biosphere',
      synopsis: 'Spectacular 4K exploration into the deepest abyssal trenches of the Pacific Ocean.',
      startTime: '10:15 AM',
      endTime: '12:30 PM',
      progressPercent: 42,
      rating: '9.7',
      category: 'Documentary'
    },
    schedule: [
      { id: 'p-104-1', title: 'Serengeti: The Great Migration', category: 'Nature', startTime: '08:00 AM', endTime: '10:15 AM', startHour: 8.0, endHour: 10.25, duration: '2h 15m', rating: '9.5', synopsis: 'Witness millions of wildebeest and zebras traverse the African savannah.' },
      { id: 'p-104-2', title: 'Deep Mariana: The Uncharted Biosphere', category: 'Nature', startTime: '10:15 AM', endTime: '12:30 PM', startHour: 10.25, endHour: 12.5, duration: '2h 15m', rating: '9.7', synopsis: 'Spectacular 4K exploration into the deepest abyssal trenches of the Pacific Ocean.', isLive: true },
      { id: 'p-104-3', title: 'Aurora Borealis: Arctic Night', category: 'Nature', startTime: '12:30 PM', endTime: '02:30 PM', startHour: 12.5, endHour: 14.5, duration: '2h 00m', rating: '9.6', synopsis: 'Mesmerizing time-lapses of solar geomagnetic storms in the Arctic.' },
      { id: 'p-104-4', title: 'Amazon Rainforest Canopy', category: 'Wildlife', startTime: '02:30 PM', endTime: '05:00 PM', startHour: 14.5, endHour: 17.0, duration: '2h 30m', rating: '9.4', synopsis: 'Biodiversity discovery 150 feet above the forest floor.' },
      { id: 'p-104-5', title: 'Himalayan Peaks: Roof of the World', category: 'Nature', startTime: '05:00 PM', endTime: '08:00 PM', startHour: 17.0, endHour: 20.0, duration: '3h 00m', rating: '9.8', synopsis: 'Mountaineers and wildlife adapting to extreme altitudes.' }
    ]
  },
  {
    id: 'ch-5',
    number: 105,
    name: 'Anime Universe 24/7',
    category: 'Anime',
    badge: 'SIMULCAST',
    viewers: '4,110',
    quality: '1080p HD • Japanese Audio',
    logo: '⚡',
    currentProgram: {
      title: 'Neon Odyssey: Tokyo 2120',
      synopsis: 'A cybernetic detective and a rogue AI team up to solve serial hackings in neo-Shinjuku.',
      startTime: '10:45 AM',
      endTime: '12:15 PM',
      progressPercent: 65,
      rating: '9.3',
      category: 'Anime'
    },
    schedule: [
      { id: 'p-105-1', title: 'Blade of Celestial Dragon', category: 'Anime', startTime: '08:00 AM', endTime: '09:30 AM', startHour: 8.0, endHour: 9.5, duration: '1h 30m', rating: '9.1', synopsis: 'Swordsmen battling mythical demons in feudal Japan.' },
      { id: 'p-105-2', title: 'Mecha Horizon: Rebellion', category: 'Anime', startTime: '09:30 AM', endTime: '10:45 AM', startHour: 9.5, endHour: 10.75, duration: '1h 15m', rating: '9.2', synopsis: 'Pilots fighting for freedom across interplanetary orbital colonies.' },
      { id: 'p-105-3', title: 'Neon Odyssey: Tokyo 2120', category: 'Anime', startTime: '10:45 AM', endTime: '12:15 PM', startHour: 10.75, endHour: 12.25, duration: '1h 30m', rating: '9.3', synopsis: 'A cybernetic detective and a rogue AI team up to solve serial hackings in neo-Shinjuku.', isLive: true },
      { id: 'p-105-4', title: 'Chrono Spell: Magic Academy', category: 'Anime', startTime: '12:15 PM', endTime: '02:30 PM', startHour: 12.25, endHour: 14.5, duration: '2h 15m', rating: '9.0', synopsis: 'Students harness time-manipulation spells to prevent historical collapse.' },
      { id: 'p-105-5', title: 'Ghost Samurai: Midnight Shift', category: 'Anime', startTime: '02:30 PM', endTime: '05:00 PM', startHour: 14.5, endHour: 17.0, duration: '2h 30m', rating: '9.5', synopsis: 'Modern urban vigilante policing supernatural underworlds.' }
    ]
  },
  {
    id: 'ch-6',
    number: 106,
    name: 'Global News 24/7 Live',
    category: 'News',
    badge: 'LIVE GLOBAL FEED',
    viewers: '3,450',
    quality: '1080p60 • Multi-Language',
    logo: '🌐',
    currentProgram: {
      title: 'World Economic & Technology Summit',
      synopsis: 'Live international coverage on AI regulations, green energy grids, and global supply chains.',
      startTime: '10:00 AM',
      endTime: '12:00 PM',
      progressPercent: 50,
      rating: '9.1',
      category: 'News'
    },
    schedule: [
      { id: 'p-106-1', title: 'Morning Global Briefing', category: 'News', startTime: '08:00 AM', endTime: '10:00 AM', startHour: 8.0, endHour: 10.0, duration: '2h 00m', rating: '8.9', synopsis: 'Overnight market updates, currency movements and headlines.' },
      { id: 'p-106-2', title: 'World Economic & Tech Summit', category: 'News', startTime: '10:00 AM', endTime: '12:00 PM', startHour: 10.0, endHour: 12.0, duration: '2h 00m', rating: '9.1', synopsis: 'Live international coverage on AI regulations, green energy grids, and global supply chains.', isLive: true },
      { id: 'p-106-3', title: 'Global Tech Insider', category: 'Tech', startTime: '12:00 PM', endTime: '02:00 PM', startHour: 12.0, endHour: 14.0, duration: '2h 00m', rating: '9.2', synopsis: 'Breakthroughs in semiconductor design, quantum computing, and space exploration.' },
      { id: 'p-106-4', title: 'Evening International News Hour', category: 'News', startTime: '02:00 PM', endTime: '05:00 PM', startHour: 14.0, endHour: 17.0, duration: '3h 00m', rating: '9.3', synopsis: 'Comprehensive analysis from foreign correspondents worldwide.' }
    ]
  },
  {
    id: 'ch-7',
    number: 107,
    name: 'Ultra Sound & Concerts 4K',
    category: 'Music',
    badge: 'DOLBY ATMOS',
    viewers: '2,210',
    quality: '4K • Spatial Audio Master',
    logo: '🎵',
    currentProgram: {
      title: 'Electronic Horizon Festival: Live from Ibiza',
      synopsis: 'Massive outdoor festival featuring world-leading electronic producers and holographic light shows.',
      startTime: '10:30 AM',
      endTime: '01:30 PM',
      progressPercent: 38,
      rating: '9.6',
      category: 'Music'
    },
    schedule: [
      { id: 'p-107-1', title: 'Acoustic Sessions 4K', category: 'Music', startTime: '08:00 AM', endTime: '10:30 AM', startHour: 8.0, endHour: 10.5, duration: '2h 30m', rating: '9.4', synopsis: 'Intimate studio unplugged performances from Grammy-winning vocalists.' },
      { id: 'p-107-2', title: 'Electronic Horizon Festival: Ibiza', category: 'Music', startTime: '10:30 AM', endTime: '01:30 PM', startHour: 10.5, endHour: 13.5, duration: '3h 00m', rating: '9.6', synopsis: 'Massive outdoor festival featuring world-leading electronic producers and holographic light shows.', isLive: true },
      { id: 'p-107-3', title: 'Royal Philharmonic Orchestra Live', category: 'Classical', startTime: '01:30 PM', endTime: '04:30 PM', startHour: 13.5, endHour: 16.5, duration: '3h 00m', rating: '9.8', synopsis: 'Beethoven 9th Symphony and film scores in immersive surround sound.' },
      { id: 'p-107-4', title: 'Synthwave Night Drive', category: 'Electronic', startTime: '04:30 PM', endTime: '08:00 PM', startHour: 16.5, endHour: 20.0, duration: '3h 30m', rating: '9.5', synopsis: 'Retro-futuristic beats paired with neon city vistas.' }
    ]
  },
  {
    id: 'ch-8',
    number: 108,
    name: 'Motor Trend & Speed Live',
    category: 'Sports',
    badge: 'SUPERCAR 4K',
    viewers: '3,340',
    quality: '4K • 60 FPS HDR',
    logo: '🏎️',
    currentProgram: {
      title: 'Nürburgring 24-Hour Endurance Qualifying',
      synopsis: 'GT3 supercars pushing limits on the legendary Green Hell in challenging mixed weather conditions.',
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      progressPercent: 55,
      rating: '9.7',
      category: 'Motorsport'
    },
    schedule: [
      { id: 'p-108-1', title: 'Supercar Garage: Track Tests', category: 'Automotive', startTime: '08:00 AM', endTime: '10:00 AM', startHour: 8.0, endHour: 10.0, duration: '2h 00m', rating: '9.3', synopsis: 'Ferrari, Porsche and Koenigsegg hypercars tested on Silverstone.' },
      { id: 'p-108-2', title: 'Nürburgring 24-Hour Qualifying', category: 'Motorsport', startTime: '10:00 AM', endTime: '01:00 PM', startHour: 10.0, endHour: 13.0, duration: '3h 00m', rating: '9.7', synopsis: 'GT3 supercars pushing limits on the legendary Green Hell in challenging mixed weather conditions.', isLive: true },
      { id: 'p-108-3', title: 'Formula Grand Prix Telemetry Breakdown', category: 'Motorsport', startTime: '01:00 PM', endTime: '03:30 PM', startHour: 13.0, endHour: 15.5, duration: '2h 30m', rating: '9.5', synopsis: 'Deep dive into aero packages, tyre degradation curves and telemetry.' },
      { id: 'p-108-4', title: 'Rally Horizon: Scandinavia', category: 'Motorsport', startTime: '03:30 PM', endTime: '07:00 PM', startHour: 15.5, endHour: 19.0, duration: '3h 30m', rating: '9.6', synopsis: 'Snow and ice stages at 180 km/h between pine trees.' }
    ]
  }
];

const TIME_SLOTS = [
  { label: '08:00 AM', hour: 8.0 },
  { label: '09:00 AM', hour: 9.0 },
  { label: '10:00 AM', hour: 10.0 },
  { label: '11:00 AM', hour: 11.0 },
  { label: '12:00 PM', hour: 12.0 },
  { label: '01:00 PM', hour: 13.0 },
  { label: '02:00 PM', hour: 14.0 },
  { label: '03:00 PM', hour: 15.0 },
  { label: '04:00 PM', hour: 16.0 },
  { label: '05:00 PM', hour: 17.0 },
  { label: '06:00 PM', hour: 18.0 },
  { label: '07:00 PM', hour: 19.0 },
  { label: '08:00 PM', hour: 20.0 }
];

export default function LiveTVPage() {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>(CHANNELS_DATA);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('ch-1');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'channels' | 'epg' | 'chat'>('epg');
  
  // Live player interactive control states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [showStatsHud, setShowStatsHud] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  
  // Diagnostics Stats
  const [streamStats, setStreamStats] = useState({
    resolution: '3840x2160',
    bitrateMbps: '14.2',
    bufferSeconds: '12.4',
    fps: 60,
    droppedFrames: 0,
    latencySec: '0.8'
  });

  // Selected Program Modal
  const [selectedProgram, setSelectedProgram] = useState<{ program: Program; channel: Channel } | null>(null);
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  // Live Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [reactions, setReactions] = useState<ReactionParticle[]>([]);
  const [realVideos, setRealVideos] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const epgTimelineRef = useRef<HTMLDivElement>(null);

  const categories = ['All', 'Cinema', 'Education', 'Sports', 'Documentary', 'Anime', 'News', 'Music'];

  // Initial chat stream
  const initialChat: ChatMessage[] = [
    { id: '1', user: 'Alex_Viper', avatar: 'AV', message: 'The 4K bitrate on this stream is unbelievable! 🔥', time: '11:02 AM', isVip: true },
    { id: '2', user: 'Sarah_Cloud', avatar: 'SC', message: 'Loving the audio clarity on spatial surround.', time: '11:03 AM', isVip: false },
    { id: '3', user: 'Neon_Rider', avatar: 'NR', message: 'Best streaming platform by far! 🚀', time: '11:04 AM', isVip: true },
    { id: '4', user: 'DevOps_Pro', avatar: 'DP', message: 'Linux Academy stream is super helpful.', time: '11:05 AM', isVip: false },
    { id: '5', user: 'Quantum_Coder', avatar: 'QC', message: 'EPG timeline guide is super smooth 👏', time: '11:06 AM', isVip: true }
  ];

  useEffect(() => {
    setChatMessages(initialChat);
    loadCatalogVideos();
  }, []);

  const loadCatalogVideos = async () => {
    try {
      const res = await api.getContent();
      const list = Array.isArray(res.data) ? res.data : res.data?.data?.videos || res.data?.videos || res.data?.data || [];
      const ready = list.filter((v: any) => v.status === 'ready' || v.status === 'processed');
      setRealVideos(ready);
    } catch (e) {
      console.warn('Live catalog load error:', e);
    }
  };

  const currentChannel = useMemo(() => {
    return channels.find(c => c.id === selectedChannelId) || channels[0] || CHANNELS_DATA[0];
  }, [channels, selectedChannelId]);

  const filteredChannels = useMemo(() => {
    if (selectedCategory === 'All') return channels;
    return channels.filter(c => c.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [channels, selectedCategory]);

  // Set up video playback on channel change
  useEffect(() => {
    if (!currentChannel || isStopped) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setQualityLevels([]);
    setCurrentQuality(-1);
    setShowQualityMenu(false);

    const setupLivePlayer = () => {
      if (!videoRef.current) {
        setTimeout(setupLivePlayer, 50);
        return;
      }

      const isStandardPort = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443');
      const apiBase = isStandardPort ? '/api' : `http://${window.location.hostname}:3000/api`;
      const targetVideo = realVideos.length > 0 ? realVideos[0] : null;
      const hlsUrl = targetVideo ? `${apiBase}/stream/${targetVideo.id}/manifest` : '';
      const mp4Url = targetVideo?.fileName ? `${apiBase}/content/uploads/${targetVideo.fileName}` : '';
      const token = localStorage.getItem('auth_token');

      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = playbackSpeed;

      if (hlsUrl && HLS.isSupported()) {
        const hls = new HLS({
          debug: false,
          enableWorker: true,
          autoStartLoad: true,
          liveSyncDurationCount: 3,
          xhrSetup: (xhr: any, url: string) => {
            // Only attach token to manifest
            if (token && url.includes('manifest')) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          }
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);
        hls.on(HLS.Events.MANIFEST_PARSED, (_: any, data: any) => {
          const levels: QualityLevel[] = data.levels.map((lvl: any, index: number) => ({
            level: index,
            height: lvl.height,
            bitrate: lvl.bitrate,
            name: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
          }));
          setQualityLevels(levels);
          videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });

        hls.on(HLS.Events.LEVEL_SWITCHED, (_: any, data: any) => {
          setCurrentQuality(data.level);
          const lvl = data.levels?.[data.level];
          if (lvl) {
            setStreamStats(prev => ({
              ...prev,
              resolution: lvl.height ? `${Math.round(lvl.height * 1.77)}x${lvl.height}` : prev.resolution,
              bitrateMbps: (lvl.bitrate / 1000000).toFixed(1)
            }));
          }
        });

        hlsRef.current = hls;
      } else if (mp4Url && videoRef.current) {
        videoRef.current.src = mp4Url;
        videoRef.current.loop = true;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    };

    setupLivePlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedChannelId, realVideos, isStopped]);

  // Periodic stream stats update
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        const v = videoRef.current;
        let buf = 0;
        if (v.buffered.length > 0) {
          buf = Math.max(0, v.buffered.end(v.buffered.length - 1) - v.currentTime);
        }
        setStreamStats(prev => ({
          ...prev,
          bufferSeconds: buf.toFixed(1),
          latencySec: (0.4 + Math.random() * 0.4).toFixed(1)
        }));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Video play/pause toggle
  const handleTogglePlay = () => {
    if (isStopped) {
      setIsStopped(false);
      setIsPlaying(true);
      return;
    }

    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Stop stream completely
  const handleStopStream = () => {
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    setIsStopped(true);
    setIsPlaying(false);
  };

  // Reconnect / Resume live stream
  const handleResumeStream = () => {
    setIsStopped(false);
    setIsPlaying(true);
  };

  // Volume slider handler
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  // Mute toggle handler
  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Playback speed change handler
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  // Picture in Picture toggle
  const handleTogglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  // Keyboard cinema shortcuts for Live TV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          handleTogglePlay();
          break;
        case 's':
          e.preventDefault();
          handleStopStream();
          break;
        case 'm':
          e.preventDefault();
          handleToggleMute();
          break;
        case 'f':
          e.preventDefault();
          if (!document.fullscreenElement) {
            videoRef.current?.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
          break;
        case 'p':
          e.preventDefault();
          handleTogglePiP();
          break;
        case 'd':
          e.preventDefault();
          setShowStatsHud(prev => !prev);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case '?':
          e.preventDefault();
          setShowShortcutsModal(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isStopped, isMuted, volume]);

  // Send Chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const displayName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email ? user.email.split('@')[0] : 'Guest User');
    const avatar = displayName.substring(0, 2).toUpperCase();

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      user: displayName,
      avatar: avatar,
      message: inputMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVip: user?.role === 'admin'
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputMessage('');

    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 50);
  };

  // Trigger floating reaction emoji
  const handleTriggerReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 60) + 20; // 20% - 80% width
    setReactions((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  };

  // Toggle Reminder for program
  const handleToggleReminder = (progId: string) => {
    setReminders(prev => {
      const next = { ...prev, [progId]: !prev[progId] };
      return next;
    });
  };

  // Current playhead offset calculation (for 08:00 AM to 08:00 PM timeline: 12 hours)
  // Let's position the red playhead line at 11:15 AM (hour 11.25)
  const currentTimelineHour = 11.25; // 11:15 AM
  const totalTimelineHours = 12;      // 08:00 to 20:00 (8 AM to 8 PM)
  const playheadPercent = Math.max(0, Math.min(100, ((currentTimelineHour - 8.0) / totalTimelineHours) * 100));

  return (
    <div className="min-h-screen bg-dark-950 pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      
      {/* Header & Quick Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
              <Radio size={28} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Live TV & Interactive 24-Hour EPG
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                  8 Live 4K Channels
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Ultra-low latency HLS adaptive live broadcasting with dynamic electronic program guide (EPG)
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 relative z-10 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('epg')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'epg'
                ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/25'
                : 'bg-dark-900/80 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Calendar size={14} />
            <span>Interactive EPG Timeline</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'channels'
                ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/25'
                : 'bg-dark-900/80 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Tv size={14} />
            <span>Channel Lineup</span>
          </button>

          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
            title="Keyboard Cinema Shortcuts (?)"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* Main Broadcast Stage: 16:9 Cinema Player + Audience Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Cols: Video Player & Airing Program Info */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative aspect-video rounded-3xl overflow-hidden glass-panel border border-white/15 bg-black shadow-2xl group">
            
            {/* Live HTML5 / HLS Video Element */}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              crossOrigin="anonymous"
              onClick={handleTogglePlay}
            />

            {/* Offline / Stopped Stream Placeholder */}
            {isStopped && (
              <div className="absolute inset-0 bg-dark-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
                <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <Square size={36} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">Broadcast Standby</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    The live stream for {currentChannel.name} is currently in standby mode. Click below to reconnect to the live edge.
                  </p>
                </div>
                <button
                  onClick={handleResumeStream}
                  className="btn-primary py-2.5 px-6 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-brand-500/25"
                >
                  <Play size={14} className="fill-white" />
                  <span>Resume Live Broadcast</span>
                </button>
              </div>
            )}

            {/* Real-Time Diagnostics HUD Overlay (Stats for Nerds) */}
            {showStatsHud && (
              <div className="absolute top-16 left-4 z-40 bg-dark-950/90 backdrop-blur-md p-4 rounded-2xl border border-brand-500/30 text-xs font-mono text-slate-300 space-y-1.5 shadow-2xl max-w-xs animate-in fade-in">
                <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-2">
                  <span className="font-bold text-brand-neon flex items-center gap-1.5">
                    <Activity size={13} />
                    <span>Diagnostics HUD</span>
                  </span>
                  <button onClick={() => setShowStatsHud(false)} className="text-slate-400 hover:text-white">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Resolution:</span>
                  <span className="font-bold text-white">{streamStats.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Live Bitrate:</span>
                  <span className="font-bold text-emerald-400">{streamStats.bitrateMbps} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buffer Health:</span>
                  <span className="font-bold text-cyan-400">{streamStats.bufferSeconds}s forward</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Edge Latency:</span>
                  <span className="font-bold text-amber-400">{streamStats.latencySec}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Codec / Format:</span>
                  <span className="font-bold text-white">H.264 / AAC 5.1</span>
                </div>
              </div>
            )}

            {/* Floating Live Reaction Particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              {reactions.map((r) => (
                <div
                  key={r.id}
                  className="absolute bottom-16 text-3xl sm:text-4xl animate-float-reaction select-none drop-shadow-2xl"
                  style={{ left: `${r.left}%` }}
                >
                  {r.emoji}
                </div>
              ))}
            </div>

            {/* Top Live Bar Overlay */}
            <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2.5 pointer-events-auto">
                <span className={`px-3 py-1 rounded-xl backdrop-blur-md text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg ${
                  !isStopped ? 'bg-rose-600/90 shadow-rose-600/30' : 'bg-slate-700/90'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${!isStopped ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                  {!isStopped ? 'LIVE 4K' : 'OFFLINE'}
                </span>
                <span className="px-3 py-1 rounded-xl bg-dark-950/80 backdrop-blur-md border border-white/15 text-white text-xs font-bold flex items-center gap-1.5">
                  <span>{currentChannel.logo}</span>
                  <span>CH {currentChannel.number} • {currentChannel.name}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <span className="px-3 py-1 rounded-xl bg-dark-950/80 backdrop-blur-md border border-white/15 text-amber-300 text-xs font-black">
                  {currentChannel.badge}
                </span>
                <span className="px-3 py-1 rounded-xl bg-dark-950/80 backdrop-blur-md border border-white/15 text-slate-300 text-xs font-bold flex items-center gap-1.5">
                  <Users size={12} className="text-emerald-400" />
                  <span>{currentChannel.viewers}</span>
                </span>
              </div>
            </div>

            {/* Bottom Interactive Cinema Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-dark-950 via-dark-950/80 to-transparent z-30 flex items-center justify-between gap-4 transition-opacity duration-300">
              {/* Left Controls: Play/Pause, Stop, Live Sync, Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePlay}
                  className="p-2.5 rounded-xl bg-dark-900/90 hover:bg-white/15 border border-white/15 text-white transition-all hover:scale-105"
                  title={isPlaying ? 'Pause Broadcast (Space)' : 'Play Broadcast (Space)'}
                >
                  {isPlaying ? <Pause size={17} className="fill-white" /> : <Play size={17} className="fill-white ml-0.5" />}
                </button>

                <button
                  onClick={handleStopStream}
                  className="p-2.5 rounded-xl bg-dark-900/90 hover:bg-rose-500/20 border border-white/15 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 transition-all"
                  title="Stop Broadcast (S)"
                >
                  <Square size={16} />
                </button>

                <button
                  onClick={handleResumeStream}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-black uppercase tracking-wider hover:bg-rose-500/30 transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Live Edge</span>
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2 pl-2">
                  <button
                    onClick={handleToggleMute}
                    className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors"
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={17} /> : volume < 0.5 ? <Volume1 size={17} /> : <Volume2 size={17} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-20 accent-brand-500 h-1 bg-white/20 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Right Controls: Stats, Speed, Quality, Reactions, PiP, Fullscreen */}
              <div className="flex items-center gap-2">
                {/* Diagnostics HUD Toggle */}
                <button
                  onClick={() => setShowStatsHud(!showStatsHud)}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                    showStatsHud ? 'bg-brand-500/20 border-brand-500/40 text-brand-neon' : 'bg-dark-900/90 border-white/15 text-slate-300 hover:text-white'
                  }`}
                  title="Diagnostics HUD (D)"
                >
                  <Gauge size={15} />
                </button>

                {/* Playback Speed Switcher */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2.5 py-1.5 rounded-xl bg-dark-900/90 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <span>{playbackSpeed}x</span>
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-dark-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/15 min-w-[120px] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s)}
                          className={`w-full text-left px-3.5 py-1.5 text-xs font-bold flex items-center justify-between ${
                            playbackSpeed === s ? 'text-brand-400 bg-brand-500/10' : 'text-slate-300 hover:bg-white/[0.05]'
                          }`}
                        >
                          <span>{s === 1.0 ? '1.0x (Normal)' : `${s}x`}</span>
                          {playbackSpeed === s && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quality ABR Selector */}
                {qualityLevels.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="px-3 py-1.5 rounded-xl bg-dark-900/90 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Settings size={13} className="text-brand-400" />
                      <span>{currentQuality === -1 ? 'Auto (ABR)' : qualityLevels[currentQuality]?.name}</span>
                    </button>

                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-dark-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/15 min-w-[170px] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <p className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Bitrate & Resolution
                        </p>
                        <button
                          onClick={() => {
                            if (hlsRef.current) hlsRef.current.currentLevel = -1;
                            setCurrentQuality(-1);
                            setShowQualityMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between ${
                            currentQuality === -1 ? 'text-brand-400 bg-brand-500/10' : 'text-slate-300 hover:bg-white/[0.05]'
                          }`}
                        >
                          <span>Auto (Adaptive)</span>
                          {currentQuality === -1 && <Check size={14} />}
                        </button>
                        {qualityLevels.map((lvl) => (
                          <button
                            key={lvl.level}
                            onClick={() => {
                              if (hlsRef.current) hlsRef.current.currentLevel = lvl.level;
                              setCurrentQuality(lvl.level);
                              setShowQualityMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between ${
                              currentQuality === lvl.level ? 'text-brand-400 bg-brand-500/10' : 'text-slate-300 hover:bg-white/[0.05]'
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

                {/* PiP Button */}
                <button
                  onClick={handleTogglePiP}
                  className="p-2.5 rounded-xl bg-dark-900/90 hover:bg-white/15 border border-white/15 text-white transition-all hidden sm:block"
                  title="Picture in Picture (P)"
                >
                  <PictureInPicture size={16} />
                </button>

                {/* Floating Reaction Emojis */}
                <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-dark-900/80 border border-white/10">
                  {['🔥', '❤️', '👏', '🍿'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleTriggerReaction(emoji)}
                      className="p-1 rounded-lg hover:bg-white/15 text-sm transition-transform hover:scale-125 active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Fullscreen Button */}
                <button
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      videoRef.current?.requestFullscreen?.().catch(() => {});
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                    }
                  }}
                  className="p-2.5 rounded-xl bg-dark-900/90 hover:bg-white/15 border border-white/15 text-white transition-all"
                  title="Fullscreen (F)"
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Currently Airing Program Info Card */}
          <div className="glass-card p-6 flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[10px] font-extrabold uppercase tracking-wider">
                  {currentChannel.category}
                </span>
                <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                  <Star size={12} className="fill-amber-400" /> {currentChannel.currentProgram.rating}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {currentChannel.currentProgram.startTime} - {currentChannel.currentProgram.endTime}
                </span>
              </div>

              <h2 className="text-2xl font-black text-white">
                {currentChannel.currentProgram.title}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                {currentChannel.currentProgram.synopsis}
              </p>

              {/* Progress Bar of Current Program */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>Program Airing Progress</span>
                  <span className="text-brand-400">{currentChannel.currentProgram.progressPercent}% elapsed</span>
                </div>
                <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-brand-neon h-full rounded-full transition-all duration-300"
                    style={{ width: `${currentChannel.currentProgram.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Live Chat & Audience Stream */}
        <div className="lg:col-span-4 flex flex-col h-[560px] glass-panel rounded-3xl border border-white/15 overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-dark-900/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="font-black text-white text-sm">Live Audience Chat</h3>
            </div>
            <span className="text-[10px] font-extrabold text-brand-400 uppercase tracking-wider">
              {currentChannel.viewers} Connected
            </span>
          </div>

          {/* Chat Messages Log */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-none text-xs">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5 p-2 rounded-xl bg-dark-900/40 border border-white/[0.03]">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[10px] shrink-0 text-white ${
                  msg.isVip ? 'bg-gradient-to-tr from-brand-600 to-brand-neon' : 'bg-dark-800 border border-white/10'
                }`}>
                  {msg.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={`font-extrabold truncate ${msg.isVip ? 'text-brand-300' : 'text-slate-300'}`}>
                      {msg.user} {msg.isVip && '★'}
                    </span>
                    <span className="text-[9px] text-slate-500">{msg.time}</span>
                  </div>
                  <p className="text-slate-200 text-[11px] leading-relaxed break-words">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Message Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.08] bg-dark-900/80 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Join the discussion..."
              className="flex-1 px-3.5 py-2 bg-dark-950/90 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white transition-all"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* Interactive EPG Timeline Guide (24-Hour Multi-Channel Matrix) */}
      {activeTab === 'epg' && (
        <div className="space-y-6 pt-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Calendar size={22} className="text-brand-400" />
                <span>Interactive Electronic Program Guide (EPG Timeline)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Click any program to inspect synopsis, set airtime calendar reminders, or tune in immediately
              </p>
            </div>

            {/* Category Filter for EPG */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
                    selectedCategory === cat
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                      : 'bg-dark-900 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal EPG Schedule Matrix */}
          <div className="glass-panel rounded-3xl border border-white/15 overflow-hidden shadow-2xl">
            
            {/* Scrollable Timeline View */}
            <div className="overflow-x-auto scrollbar-thin" ref={epgTimelineRef}>
              <div className="min-w-[1200px] relative">
                
                {/* Time Ruler Header Row */}
                <div className="flex items-center border-b border-white/10 bg-dark-900/90 py-3 sticky top-0 z-20">
                  <div className="w-56 shrink-0 px-6 font-black text-xs text-slate-400 uppercase tracking-wider">
                    Channels ({filteredChannels.length})
                  </div>
                  <div className="flex-1 grid grid-cols-12 text-xs font-mono font-bold text-slate-400 text-center">
                    {TIME_SLOTS.map((slot, idx) => (
                      <div key={idx} className="border-l border-white/10 px-2 py-1 truncate">
                        {slot.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vertical Glowing Real-Time Playhead Line */}
                <div
                  className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
                  style={{ left: `calc(14rem + (100% - 14rem) * ${playheadPercent / 100})` }}
                >
                  <div className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow-lg shadow-rose-600/50">
                    NOW (11:15 AM)
                  </div>
                  <div className="w-0.5 h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                </div>

                {/* Channel Rows */}
                <div className="divide-y divide-white/[0.06]">
                  {filteredChannels.map((channel) => {
                    const isSelected = channel.id === selectedChannelId;
                    return (
                      <div
                        key={channel.id}
                        className={`flex items-stretch transition-colors ${
                          isSelected ? 'bg-brand-500/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Channel Header (Left fixed column) */}
                        <div
                          onClick={() => {
                            setSelectedChannelId(channel.id);
                            setIsStopped(false);
                          }}
                          className="w-56 shrink-0 p-4 border-r border-white/10 flex items-center justify-between cursor-pointer group bg-dark-950/60 hover:bg-dark-900 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-dark-900 border border-white/15 flex items-center justify-center font-mono font-black text-xs text-brand-400">
                              {channel.number}
                            </span>
                            <div>
                              <h4 className="text-xs font-black text-white group-hover:text-brand-300 transition-colors truncate max-w-[110px]">
                                {channel.name}
                              </h4>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{channel.category}</span>
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          ) : (
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                          )}
                        </div>

                        {/* Program Schedule Blocks (12 Hours relative width grid) */}
                        <div className="flex-1 relative flex items-center py-2 px-1">
                          {channel.schedule.map((prog) => {
                            // Calculate width and offset percent based on startHour and endHour (from 8.0 to 20.0)
                            const leftPercent = Math.max(0, ((prog.startHour - 8.0) / totalTimelineHours) * 100);
                            const widthPercent = Math.max(5, ((prog.endHour - prog.startHour) / totalTimelineHours) * 100);
                            const hasReminder = reminders[prog.id];

                            return (
                              <div
                                key={prog.id}
                                onClick={() => setSelectedProgram({ program: prog, channel })}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent - 0.4}%`,
                                  position: 'absolute'
                                }}
                                className={`h-16 rounded-2xl p-3 flex flex-col justify-between border cursor-pointer transition-all duration-200 group hover:scale-[1.02] hover:z-20 shadow-md ${
                                  prog.isLive
                                    ? 'bg-gradient-to-r from-rose-500/20 to-brand-500/20 border-rose-500/40 text-white hover:border-rose-400'
                                    : 'bg-dark-900/80 border-white/10 hover:border-white/30 text-slate-300 hover:text-white'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-mono text-slate-400 truncate">
                                      {prog.startTime} - {prog.endTime}
                                    </span>
                                    {prog.isLive && (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-black text-[9px] uppercase">
                                        LIVE
                                      </span>
                                    )}
                                    {hasReminder && (
                                      <Bell size={10} className="text-amber-400 fill-amber-400" />
                                    )}
                                  </div>
                                  <h5 className="font-black text-xs truncate mt-0.5 group-hover:text-brand-300 transition-colors">
                                    {prog.title}
                                  </h5>
                                </div>

                                <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold">
                                  <span>{prog.category}</span>
                                  <span>{prog.duration}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Cards Grid View */}
      {activeTab === 'channels' && (
        <div className="space-y-6 pt-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Tv size={22} className="text-brand-400" />
                <span>Live Channel Lineup & Quality Stream Guide</span>
              </h2>
              <p className="text-xs text-slate-400">Select any channel to tune in immediately</p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
                    selectedCategory === cat
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                      : 'bg-dark-900 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredChannels.map((channel) => {
              const isSelected = channel.id === selectedChannelId;
              return (
                <div
                  key={channel.id}
                  onClick={() => {
                    setSelectedChannelId(channel.id);
                    setIsStopped(false);
                  }}
                  className={`glass-card p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer group ${
                    isSelected
                      ? 'border-rose-500/60 shadow-xl shadow-rose-500/10 bg-rose-500/[0.03]'
                      : 'hover:border-brand-500/40'
                  }`}
                >
                  <div>
                    {/* Channel Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-dark-900 border border-white/15 flex items-center justify-center font-mono font-black text-xs text-brand-400">
                          {channel.number}
                        </span>
                        <div>
                          <h3 className="font-extrabold text-white text-sm group-hover:text-brand-300 transition-colors">
                            {channel.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{channel.category}</span>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-black uppercase">
                          Watching
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-400 text-[10px] font-bold">
                          Tune In
                        </span>
                      )}
                    </div>

                    {/* Airing Program */}
                    <div className="p-3 rounded-2xl bg-dark-900/60 border border-white/[0.04] mb-3">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span className="text-rose-400 font-extrabold">● NOW AIRING</span>
                        <span>{channel.currentProgram.startTime}</span>
                      </div>
                      <p className="font-extrabold text-white text-xs line-clamp-1">{channel.currentProgram.title}</p>
                    </div>

                    {/* Upcoming Schedule Preview */}
                    <div className="space-y-1.5 text-xs">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Upcoming Programs</p>
                      {channel.schedule.slice(1, 3).map((item, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="truncate pr-2">{item.title}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">{item.startTime}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400">{channel.quality}</span>
                    <span className="font-bold text-brand-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      {isSelected ? 'Currently Live' : 'Switch Channel ▶'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Program Details Modal / Drawer */}
      {selectedProgram && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 max-w-lg w-full shadow-2xl relative space-y-6">
            
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-neon font-black text-[10px] uppercase border border-brand-500/30">
                    {selectedProgram.program.category}
                  </span>
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                    <Star size={12} className="fill-amber-400" /> {selectedProgram.program.rating}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {selectedProgram.program.startTime} - {selectedProgram.program.endTime}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">
                  {selectedProgram.program.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedProgram.channel.name} (CH {selectedProgram.channel.number})
                </p>
              </div>

              <button
                onClick={() => setSelectedProgram(null)}
                className="p-2 rounded-xl bg-dark-900/80 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Synopsis
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {selectedProgram.program.synopsis}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-dark-900/60 border border-white/10">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Duration</span>
                  <span className="text-white font-bold">{selectedProgram.program.duration}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Broadcast Tier</span>
                  <span className="text-amber-300 font-bold">{selectedProgram.channel.badge}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedChannelId(selectedProgram.channel.id);
                  setSelectedProgram(null);
                  setIsStopped(false);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-brand-neon hover:from-brand-500 hover:to-brand-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25"
              >
                <Play size={14} className="fill-white" />
                <span>Tune In Channel Now</span>
              </button>

              <button
                onClick={() => handleToggleReminder(selectedProgram.program.id)}
                className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                  reminders[selectedProgram.program.id]
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-dark-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {reminders[selectedProgram.program.id] ? <BellRing size={14} /> : <Bell size={14} />}
                <span>{reminders[selectedProgram.program.id] ? 'Reminder Set' : 'Remind Me'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white">Live TV Cinema Shortcuts</h3>
              <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Play / Pause Broadcast</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">Space / K</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Stop Broadcast</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">S</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Diagnostics HUD (Stats for Nerds)</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">D</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Picture-in-Picture (PiP)</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">P</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Mute / Unmute</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Fullscreen</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">F</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/60 border border-white/[0.04]">
                <span>Volume Up / Down</span>
                <kbd className="px-2 py-1 rounded bg-dark-950 border border-white/10 text-[10px] font-mono text-white">↑ / ↓</kbd>
              </div>
            </div>
            
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="btn-primary w-full mt-6 py-2.5 text-xs font-bold"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
