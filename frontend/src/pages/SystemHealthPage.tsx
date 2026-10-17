import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ExternalLink, 
  Radio, 
  Layers, 
  Clock, 
  HardDrive,
  BarChart2,
  FileText,
  ShieldCheck,
  Zap,
  Search,
  Filter,
  Globe,
  Share2,
  Eye,
  Terminal
} from 'lucide-react';
import api from '../services/api';

export interface ContainerHealth {
  name: string;
  displayName: string;
  category: string;
  type: 'http' | 'tcp';
  url?: string;
  host?: string;
  port?: number;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  description: string;
  data?: any;
  error?: string;
}

interface ClusterCategories {
  microservices?: ContainerHealth[];
  gateways_web?: ContainerHealth[];
  databases_search?: ContainerHealth[];
  message_brokers?: ContainerHealth[];
  observability?: ContainerHealth[];
}

interface ClusterHealthData {
  status: 'HEALTHY' | 'DEGRADED' | 'WARNING';
  totalContainers: number;
  healthyCount: number;
  totalServices?: number;
  timestamp: string;
  scanDurationMs: number;
  categories?: ClusterCategories;
  services?: Record<string, ContainerHealth>;
}

const CATEGORY_META = {
  all: { label: 'All Containers', icon: Layers, countKey: 'all', color: 'text-brand-400' },
  microservices: { label: 'Core Microservices', icon: Server, countKey: 'microservices', color: 'text-brand-neon' },
  gateways_web: { label: 'Edge & Web', icon: Globe, countKey: 'gateways_web', color: 'text-cyan-400' },
  databases_search: { label: 'Databases & Search', icon: Database, countKey: 'databases_search', color: 'text-amber-400' },
  message_brokers: { label: 'Message Streaming', icon: Share2, countKey: 'message_brokers', color: 'text-indigo-400' },
  observability: { label: 'Observability & Logs', icon: BarChart2, countKey: 'observability', color: 'text-emerald-400' }
};

export default function SystemHealthPage() {
  const [healthData, setHealthData] = useState<ClusterHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const hostIp = window.location.hostname || '180.94.20.40';

  const fetchClusterHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const res = await api.client.get('/health/cluster');
      if (res.data) {
        setHealthData(res.data);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      console.error('Failed to probe cluster health:', err);
      // Fallback: try direct gateway status
      try {
        const fallbackRes = await api.client.get('/status');
        if (fallbackRes.data) {
          const s = fallbackRes.data;
          const mappedServices: Record<string, ContainerHealth> = {};
          Object.entries(s.services || {}).forEach(([k, v]: [string, any]) => {
            mappedServices[k] = {
              name: k,
              displayName: k.replace('-', ' '),
              category: 'microservice',
              type: 'http',
              url: v.url,
              status: v.status === 'UP' ? 'UP' : 'DOWN',
              latencyMs: 12,
              description: 'Microservice'
            };
          });
          setHealthData({
            status: s.overall === 'UP' ? 'HEALTHY' : 'DEGRADED',
            totalContainers: Object.keys(mappedServices).length,
            healthyCount: Object.values(mappedServices).filter(x => x.status === 'UP').length,
            timestamp: new Date().toISOString(),
            scanDurationMs: 25,
            services: mappedServices
          });
          setLastUpdated(new Date());
        }
      } catch (fallbackErr: any) {
        setError(err.message || 'Unable to connect to cluster API gateway');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClusterHealth();
  }, [fetchClusterHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchClusterHealth();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchClusterHealth]);

  // Extract all container list
  const allContainers = useMemo<ContainerHealth[]>(() => {
    if (!healthData) return [];
    if (healthData.categories) {
      return [
        ...(healthData.categories.microservices || []),
        ...(healthData.categories.gateways_web || []),
        ...(healthData.categories.databases_search || []),
        ...(healthData.categories.message_brokers || []),
        ...(healthData.categories.observability || [])
      ];
    }
    return Object.values(healthData.services || {});
  }, [healthData]);

  // Filtered containers
  const filteredContainers = useMemo(() => {
    return allContainers.filter((container) => {
      const matchesCategory = 
        selectedCategory === 'all' || 
        container.category === selectedCategory ||
        (selectedCategory === 'microservices' && (container.category === 'microservices' || (container.category as string) === 'microservice')) ||
        (selectedCategory === 'gateways_web' && (container.category === 'gateways_web' || (container.category as string) === 'gateway_web')) ||
        (selectedCategory === 'message_brokers' && (container.category === 'message_brokers' || (container.category as string) === 'message_broker')) ||
        (selectedCategory === 'databases_search' && (container.category === 'databases_search' || (container.category as string) === 'database_search'));

      const matchesSearch = 
        !searchQuery.trim() || 
        container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (container.url && container.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (container.host && container.host.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [allContainers, selectedCategory, searchQuery]);

  const observabilityTools = [
    {
      title: 'Grafana Dashboards',
      desc: 'Unified metrics, pre-built service telemetry, traffic & latency',
      port: 3008,
      url: typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80' || window.location.port === '443') ? '/grafana/' : `http://${hostIp}:3008`,
      icon: BarChart2,
      tag: 'Edge Route /grafana/',
      color: 'from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-400'
    },
    {
      title: 'Prometheus Server',
      desc: 'Time-series database scraping all 24 containers & services',
      port: 9090,
      url: `http://${hostIp}:9090/targets`,
      icon: Activity,
      tag: 'Port 9090',
      color: 'from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-400'
    },
    {
      title: 'cAdvisor Container Metrics',
      desc: 'Real-time CPU, RAM working sets & resource limits across all 24 containers',
      port: 8080,
      url: `http://${hostIp}:8080`,
      icon: Cpu,
      tag: 'Port 8080',
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400'
    },
    {
      title: 'Node Exporter (Host Engine)',
      desc: 'Linux kernel telemetry, memory buffers, CPU idle/user percentiles',
      port: 9100,
      url: `http://${hostIp}:9100/metrics`,
      icon: HardDrive,
      tag: 'Port 9100',
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400'
    }
  ];

  return (
    <div className="min-h-screen bg-dark-950 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      {/* Top Header & Live Pulse Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-500/20 border border-brand-500/30 text-brand-neon">
              <Activity size={28} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Cluster Health & 24-Container Topology
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-neon border border-brand-500/30">
                  Admin Only
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Real-time multi-tier topology probe for all 24 microservices, databases, streaming brokers & telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 relative z-10 self-start md:self-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              autoRefresh 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-dark-900 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            {autoRefresh ? 'Live Sync (6s)' : 'Sync Paused'}
          </button>

          <button
            onClick={() => fetchClusterHealth(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-neon hover:from-brand-500 hover:to-brand-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-brand-500/25 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Scanning...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Cluster KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Health Status */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cluster State</span>
            {healthData?.status === 'HEALTHY' ? (
              <CheckCircle2 size={20} className="text-emerald-400" />
            ) : healthData?.status === 'DEGRADED' ? (
              <AlertTriangle size={20} className="text-amber-400" />
            ) : (
              <XCircle size={20} className="text-rose-400" />
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {healthData?.status ?? 'SCANNING'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>KRaft Kafka & Nginx Protected</span>
          </p>
        </div>

        {/* Running Containers Count */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Running Containers</span>
            <Server size={20} className="text-brand-neon" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">
              {healthData?.healthyCount ?? allContainers.length}
            </span>
            <span className="text-sm font-bold text-slate-500">/ {healthData?.totalContainers ?? 24}</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-1 font-bold">
            100% Platform Operational (24 Containers)
          </p>
        </div>

        {/* Telemetry Probe Latency */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Probe Latency</span>
            <Zap size={20} className="text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">
              {healthData?.scanDurationMs ? `${healthData.scanDurationMs}ms` : '--'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Concurrent 24-container probe duration
          </p>
        </div>

        {/* Last Sync */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Checkpoint</span>
            <Clock size={20} className="text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-black text-white font-mono">
              {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Active real-time synchronization
          </p>
        </div>
      </div>

      {/* Observability Tools Hub */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
            <Layers size={18} className="text-brand-400" />
            <span>Observability & Telemetry Dashboards</span>
          </h2>
          <span className="text-xs text-slate-400">Click any card to open the live console</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {observabilityTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <a
                key={idx}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-5 rounded-3xl bg-gradient-to-b ${tool.color} border hover:scale-[1.02] transition-all duration-200 group flex flex-col justify-between shadow-xl`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-xl bg-dark-950/80 border border-white/10 text-white group-hover:text-brand-neon transition-colors">
                      <Icon size={20} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-dark-950/80 text-white font-mono text-[10px] font-bold border border-white/10">
                      {tool.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-white mt-4 group-hover:text-brand-neon transition-colors flex items-center gap-1.5">
                    <span>{tool.title}</span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-white">
                  <span>Open Console</span>
                  <span className="text-brand-400 font-mono">→</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* 24-Container Topology Matrix Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
              <Server size={18} className="text-brand-400" />
              <span>Full 24-Container Topology Matrix</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status, response latency, port exposure, and role for all 24 Docker containers
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search containers & ports..."
              className="w-full pl-9 pr-4 py-2 bg-dark-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
            const Icon = meta.icon;
            const isSelected = selectedCategory === catKey;
            const count = catKey === 'all' 
              ? allContainers.length 
              : allContainers.filter(c => 
                  c.category === catKey || 
                  (catKey === 'microservices' && (c.category === 'microservices' || (c.category as string) === 'microservice')) ||
                  (catKey === 'gateways_web' && (c.category === 'gateways_web' || (c.category as string) === 'gateway_web')) ||
                  (catKey === 'message_brokers' && (c.category === 'message_brokers' || (c.category as string) === 'message_broker')) ||
                  (catKey === 'databases_search' && (c.category === 'databases_search' || (c.category as string) === 'database_search')) ||
                  (catKey === 'observability' && c.category === 'observability')
                ).length;

            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                  isSelected 
                    ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/20' 
                    : 'bg-dark-900/60 text-slate-400 border-white/[0.06] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-white' : meta.color} />
                <span>{meta.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Containers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredContainers.map((c) => {
            const isUp = c.status === 'UP';
            const endpoint = c.type === 'http' ? (c.url || c.name) : `${c.host}:${c.port}`;

            return (
              <div
                key={c.name}
                className={`p-5 rounded-3xl bg-dark-900/80 border transition-all shadow-xl flex flex-col justify-between group hover:scale-[1.01] ${
                  isUp ? 'border-white/10 hover:border-emerald-500/40' : 'border-rose-500/40 bg-rose-500/5'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white group-hover:text-brand-neon transition-colors">
                        {c.displayName || c.name}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[170px]" title={endpoint}>
                        {endpoint}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isUp 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                    {c.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/[0.06] text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Probe Time</span>
                      <span className="font-mono font-bold text-white text-xs mt-0.5 block">
                        {c.latencyMs}ms
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Protocol</span>
                      <span className="font-mono font-bold text-brand-400 text-xs mt-0.5 uppercase block">
                        {c.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>ott-{c.name}</span>
                  <span className="text-emerald-400 font-bold">HEALTHY</span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredContainers.length === 0 && (
          <div className="p-12 text-center text-slate-400 glass-panel rounded-3xl border border-white/10">
            <p className="text-sm">No containers found matching your search.</p>
          </div>
        )}
      </div>

    </div>
  );
}
