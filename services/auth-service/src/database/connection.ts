import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ott_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,  // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.warn('Database pool error, connection will be retried:', err);
  // Don't exit - let the application continue
});

pool.on('connect', () => {
  logger.debug('New client connected to pool');
});

pool.on('remove', () => {
  logger.debug('Client removed from pool');
});

export async function connectDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', error);
    throw error;
  }
}

export default pool;
