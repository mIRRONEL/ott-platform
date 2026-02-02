"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isServiceHealthy = exports.getServiceUrl = exports.getServiceStatus = exports.initializeServiceRegistry = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const services = new Map();
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
const initializeServiceRegistry = () => {
    Object.entries(SERVICE_URLS).forEach(([name, url]) => {
        services.set(name, {
            name,
            url,
            healthy: true,
            lastChecked: new Date()
        });
    });
    logger_1.logger.info('Service registry initialized with', Object.keys(SERVICE_URLS).length, 'services');
    // Start health checking
    startHealthChecks();
};
exports.initializeServiceRegistry = initializeServiceRegistry;
// Health check function
const checkServiceHealth = async (service) => {
    try {
        const response = await axios_1.default.get(`${service.url}/health`, {
            timeout: 5000
        });
        return response.status === 200;
    }
    catch (error) {
        logger_1.logger.warn(`Health check failed for ${service.name}`, error);
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
                logger_1.logger.info(`Service ${name} status changed to ${status}`);
            }
            service.lastChecked = new Date();
        }
    }, 30000); // Check every 30 seconds
};
// Get service status
const getServiceStatus = () => {
    const status = {
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
exports.getServiceStatus = getServiceStatus;
// Get service URL
const getServiceUrl = (serviceName) => {
    const service = services.get(serviceName);
    return service ? service.url : null;
};
exports.getServiceUrl = getServiceUrl;
// Check if service is healthy
const isServiceHealthy = (serviceName) => {
    const service = services.get(serviceName);
    return service ? service.healthy : false;
};
exports.isServiceHealthy = isServiceHealthy;
exports.default = {
    initializeServiceRegistry: exports.initializeServiceRegistry,
    getServiceStatus: exports.getServiceStatus,
    getServiceUrl: exports.getServiceUrl,
    isServiceHealthy: exports.isServiceHealthy
};
//# sourceMappingURL=service-discovery.js.map