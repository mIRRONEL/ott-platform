import axios from 'axios';
import net from 'net';
import { logger } from '../utils/logger';

export interface Service {
  name: string;
  url: string;
  healthy: boolean;
  lastChecked: Date;
}

const services: Map<string, Service> = new Map();

// Helper to check TCP connection health (for DBs, Kafka, Redis)
const checkTcp = (host: string, port: number, timeoutMs = 2000): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, host, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(false);
    });
  });
};

// 24 Cluster Container Definitions & Probing Targets
export interface ContainerTarget {
  name: string;
  displayName: string;
  category: 'microservices' | 'gateways_web' | 'databases_search' | 'message_brokers' | 'observability';
  type: 'http' | 'tcp';
  url?: string;
  host?: string;
  port?: number;
  description: string;
}

export const CLUSTER_CONTAINERS: ContainerTarget[] = [
  // 1. Core Application Microservices (8)
  { name: 'auth-service', displayName: 'Auth Service', category: 'microservices', type: 'http', url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001', description: 'JWT Authentication & Role-Based Access Control' },
  { name: 'user-service', displayName: 'User Service', category: 'microservices', type: 'http', url: process.env.USER_SERVICE_URL || 'http://user-service:3002', description: 'User Profiles, Watch History & Playlists' },
  { name: 'content-service', displayName: 'Content Service', category: 'microservices', type: 'http', url: process.env.CONTENT_SERVICE_URL || 'http://content-service:3003', description: '4K Video Catalog & Metadata Engine' },
  { name: 'streaming-service', displayName: 'Streaming Service', category: 'microservices', type: 'http', url: process.env.STREAMING_SERVICE_URL || 'http://streaming-service:3004', description: 'HLS Multi-Bitrate Adaptive Video Streamer' },
  { name: 'encoding-service', displayName: 'Encoding Service', category: 'microservices', type: 'http', url: process.env.ENCODING_SERVICE_URL || 'http://encoding-service:3008', description: 'Distributed FFmpeg 4K Transcoding Worker' },
  { name: 'payment-service', displayName: 'Payment Service', category: 'microservices', type: 'http', url: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005', description: 'Stripe Subscriptions & Billing Ledger' },
  { name: 'notification-service', displayName: 'Notification Service', category: 'microservices', type: 'http', url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006', description: 'Transactional Email, SMS & Live Webhooks' },
  { name: 'analytics-service', displayName: 'Analytics Service', category: 'microservices', type: 'http', url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3007', description: 'Real-Time User Engagement & Video Telemetry' },

  // 2. Gateways & Web Tier (3)
  { name: 'api-gateway', displayName: 'API Gateway', category: 'gateways_web', type: 'http', url: 'http://localhost:3000', description: 'Central Reverse Proxy, Rate Limiting & Auth Guard' },
  { name: 'ott-nginx', displayName: 'Nginx Edge Proxy', category: 'gateways_web', type: 'http', url: 'http://nginx:80', description: 'Unified Edge Reverse Proxy & 10GB HLS Cache' },
  { name: 'ott-frontend', displayName: 'OTT Web Frontend', category: 'gateways_web', type: 'http', url: 'http://frontend:5173', description: 'React 18 Single-Page Application Client' },

  // 3. Databases & Search (4)
  { name: 'postgres', displayName: 'PostgreSQL 15', category: 'databases_search', type: 'tcp', host: 'postgres', port: 5432, description: 'Primary Relational Database & User Records' },
  { name: 'mongodb', displayName: 'MongoDB 6.0', category: 'databases_search', type: 'tcp', host: 'mongodb', port: 27017, description: 'Video Catalog Documents & Dynamic Schemas' },
  { name: 'redis', displayName: 'Redis 7 Cache', category: 'databases_search', type: 'tcp', host: 'redis', port: 6379, description: 'Distributed In-Memory Session & Rate Limiting' },
  { name: 'elasticsearch', displayName: 'Elasticsearch 8', category: 'databases_search', type: 'http', url: 'http://elasticsearch:9200', description: 'Full-Text Video Catalog & Fuzzy Search Engine' },

  // 4. Message Streaming Cluster (3)
  { name: 'kafka-1', displayName: 'Kafka Broker 1', category: 'message_brokers', type: 'tcp', host: 'kafka-1', port: 9092, description: 'KRaft Controller & Event Streaming Node 1' },
  { name: 'kafka-2', displayName: 'Kafka Broker 2', category: 'message_brokers', type: 'tcp', host: 'kafka-2', port: 9092, description: 'KRaft Controller & Event Streaming Node 2' },
  { name: 'kafka-3', displayName: 'Kafka Broker 3', category: 'message_brokers', type: 'tcp', host: 'kafka-3', port: 9092, description: 'KRaft Controller & Event Streaming Node 3' },

  // 5. Observability & Telemetry Stack (6)
  { name: 'prometheus', displayName: 'Prometheus TSDB', category: 'observability', type: 'http', url: 'http://prometheus:9090/-/healthy', description: 'Time-Series Engine Scraping All 24 Services' },
  { name: 'grafana', displayName: 'Grafana Visualizer', category: 'observability', type: 'http', url: 'http://grafana:3000/api/health', description: 'Unified Real-Time Metrics & Log Dashboards' },
  { name: 'loki', displayName: 'Loki Log Daemon', category: 'observability', type: 'http', url: 'http://loki:3100/ready', description: 'Centralized Microservices Log Aggregator' },
  { name: 'promtail', displayName: 'Promtail Shipper', category: 'observability', type: 'http', url: 'http://promtail:9080/ready', description: 'Docker Container Log Collector & Forwarder' },
  { name: 'cadvisor', displayName: 'cAdvisor Daemon', category: 'observability', type: 'http', url: 'http://cadvisor:8080/healthz', description: 'Hardware & Container Resource Profiler' },
  { name: 'node-exporter', displayName: 'Node Exporter', category: 'observability', type: 'http', url: 'http://node-exporter:9100', description: 'Host Linux Machine Kernel & Hardware Telemetry' }
];

// Initialize service registry
export const initializeServiceRegistry = () => {
  CLUSTER_CONTAINERS.filter(c => c.category === 'microservices').forEach((svc) => {
    services.set(svc.name, {
      name: svc.name,
      url: svc.url!,
      healthy: true,
      lastChecked: new Date()
    });
  });

  logger.info(`Service registry initialized with ${CLUSTER_CONTAINERS.length} total platform containers`);
};

// Consolidated Real-Time Probe for ALL 24 Cluster Containers
export const getClusterHealth = async (): Promise<Record<string, any>> => {
  const start = Date.now();

  const probePromises = CLUSTER_CONTAINERS.map(async (container) => {
    const sStart = Date.now();
    try {
      if (container.type === 'http') {
        const checkUrl = container.url!.endsWith('/health') || container.url!.endsWith('/healthz') || container.url!.endsWith('/ready') || container.url!.endsWith('/-healthy') || container.url!.endsWith('/api/health')
          ? container.url!
          : `${container.url}/health`;

        let res;
        try {
          res = await axios.get(checkUrl, { timeout: 2500 });
        } catch {
          // Fallback to base url if /health isn't standard
          res = await axios.get(container.url!, { timeout: 2500 });
        }

        const latency = Date.now() - sStart;
        return {
          name: container.name,
          displayName: container.displayName,
          category: container.category,
          type: container.type,
          url: container.url,
          status: res.status >= 200 && res.status < 400 ? 'UP' : 'DEGRADED',
          latencyMs: latency,
          description: container.description,
          data: res.data || {}
        };
      } else {
        // TCP Probe
        const isUp = await checkTcp(container.host!, container.port!, 2500);
        const latency = Date.now() - sStart;
        return {
          name: container.name,
          displayName: container.displayName,
          category: container.category,
          type: container.type,
          host: container.host,
          port: container.port,
          status: isUp ? 'UP' : 'DOWN',
          latencyMs: latency,
          description: container.description
        };
      }
    } catch (err: any) {
      return {
        name: container.name,
        displayName: container.displayName,
        category: container.category,
        type: container.type,
        status: 'DOWN',
        latencyMs: Date.now() - sStart,
        description: container.description,
        error: err.message
      };
    }
  });

  const results = await Promise.all(probePromises);
  const totalContainers = results.length;
  const healthyCount = results.filter((r) => r.status === 'UP').length;
  const allHealthy = healthyCount === totalContainers;

  const servicesMap: Record<string, any> = {};
  results.forEach((r) => (servicesMap[r.name] = r));

  const categories = {
    microservices: results.filter(r => r.category === 'microservices'),
    gateways_web: results.filter(r => r.category === 'gateways_web'),
    databases_search: results.filter(r => r.category === 'databases_search'),
    message_brokers: results.filter(r => r.category === 'message_brokers'),
    observability: results.filter(r => r.category === 'observability')
  };

  return {
    status: allHealthy ? 'HEALTHY' : healthyCount >= 20 ? 'DEGRADED' : 'WARNING',
    totalContainers,
    healthyCount,
    totalServices: totalContainers,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - start,
    categories,
    services: servicesMap
  };
};

export const getServiceStatus = (): Record<string, any> => {
  const status: Record<string, any> = {
    timestamp: new Date(),
    services: {}
  };

  for (const [name, service] of services.entries()) {
    status.services[name] = {
      url: service.url,
      status: service.healthy ? 'UP' : 'DOWN',
      lastChecked: service.lastChecked
    };
  }

  status.overall = 'UP';
  return status;
};

export default {
  initializeServiceRegistry,
  getServiceStatus,
  getClusterHealth,
  CLUSTER_CONTAINERS
};
