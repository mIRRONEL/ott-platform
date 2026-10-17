/**
 * Database Connection Pooling Configuration
 * 
 * Use these configurations in your Node.js services
 * for optimal connection pooling across scaled instances
 */

// PostgreSQL Connection Pool (pg package)
const postgreConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres_secure_password_123',
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ott_platform',
  
  // Connection Pool Configuration
  max: parseInt(process.env.DB_POOL_MAX || '20'),           // max connections
  idleTimeoutMillis: 30000,                                  // close idle clients after 30s
  connectionTimeoutMillis: 2000,                             // return an error after 2s if connection could not be acquired
  statement_timeout: 30000,                                  // 30s query timeout
  
  // For applications with many queries
  query_timeout: 60000,
  
  // Connection validation
  keepalives: true,
  keepalives_idle: 30,
  keepalives_interval: 10,
  keepalives_count: 5,
};

// MongoDB Connection Pool
const mongoDbConfig = {
  url: process.env.MONGODB_URI || 'mongodb://mongodb:27017/ott_platform',
  
  // Connection Pool Options
  maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE || '100'),    // max connections
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL || '10'),      // min connections
  maxIdleTimeMS: 45000,                                           // close idle after 45s
  waitQueueTimeoutMS: 10000,                                      // fail if no connection available in 10s
  socketTimeoutMS: 45000,                                         // socket timeout
  
  // Connection validation
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 30000,
};

// Redis Connection Pool (redis package)
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  
  // Connection Pool Configuration
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Retry Strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Connection timeouts
  connectionTimeout: 10000,
  commandTimeout: 5000,
};

// Elasticsearch Connection Pool
const elasticsearchConfig = {
  node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
  
  // Connection Pool Configuration
  maxRetries: 5,
  requestTimeout: 30000,
  sniffInterval: 10000,
  sniffOnConnectionFault: true,
  
  // Node pool options
  nodeFilter: (node) => {
    return node.roles.data === true && node.roles.master === false;
  },
  
  // Implement your own connection pool with custom client
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 30000,
  keepAliveTimeout: 30000,
};

// HTTP Request Pool (axios/node-fetch)
const httpPoolConfig = {
  // For axios-powered services
  httpAgent: {
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 30000,
    freeSocketTimeout: 30000,
  },
  
  httpsAgent: {
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 30000,
    freeSocketTimeout: 30000,
  },
};

module.exports = {
  postgreConfig,
  mongoDbConfig,
  redisConfig,
  elasticsearchConfig,
  httpPoolConfig,
};
