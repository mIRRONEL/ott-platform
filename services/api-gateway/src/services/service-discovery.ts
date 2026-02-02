import axios from 'axios';
import { logger } from '../utils/logger';

export interface Service {
  name: string;
  url: string;
  healthy: boolean;
  lastChecked: Date;
}

const services: Map<string, Service> = new Map();

const SERVICE_URLS = {
  'auth-service': process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  'user-service': process.env.USER_SERVICE_URL || 'http://localhost:3002',
  'content-service': process.env.CONTENT_SERVICE_URL || 'http://localhost:3003',
  'streaming-service': process.env.STREAMING_SERVICE_URL || 'http://localhost:3004',
  'payment-service': process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
  'notification-service': process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
  'analytics-service': process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007'
};

// Initialize service registry
export const initializeServiceRegistry = () => {
  Object.entries(SERVICE_URLS).forEach(([name, url]) => {
    services.set(name, {
      name,
      url,
      healthy: true,
      lastChecked: new Date()
    });
  });

  logger.info('Service registry initialized with', Object.keys(SERVICE_URLS).length, 'services');

  // Start health checking
  startHealthChecks();
};

// Health check function
const checkServiceHealth = async (service: Service): Promise<boolean> => {
  try {
    const response = await axios.get(`${service.url}/health`, {
      timeout: 5000
    });

    return response.status === 200;
  } catch (error) {
    logger.warn(`Health check failed for ${service.name}`, error);
    return false;
  }
};

// Start periodic health checks
const startHealthChecks = () => {
  setInterval(async () => {
    for (const [name, service] of services.entries()) {
      const healthy = await checkServiceHealth(service);

      if (healthy !== service.healthy) {
        service.healthy = healthy;
        const status = healthy ? 'UP' : 'DOWN';
        logger.info(`Service ${name} status changed to ${status}`);
      }

      service.lastChecked = new Date();
    }
  }, 30000); // Check every 30 seconds
};

// Get service status
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

  const allHealthy = Array.from(services.values()).every(s => s.healthy);
  status.overall = allHealthy ? 'UP' : 'DEGRADED';

  return status;
};

// Get service URL
export const getServiceUrl = (serviceName: string): string | null => {
  const service = services.get(serviceName);
  return service ? service.url : null;
};

// Check if service is healthy
export const isServiceHealthy = (serviceName: string): boolean => {
  const service = services.get(serviceName);
  return service ? service.healthy : false;
};

export default {
  initializeServiceRegistry,
  getServiceStatus,
  getServiceUrl,
  isServiceHealthy
};
