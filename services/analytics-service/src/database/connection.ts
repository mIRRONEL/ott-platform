import { Pool } from 'pg';
import { logger } from '../utils/logger';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ott_platform';

export const pgPool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pgPool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

pgPool.on('connect', () => {
  logger.info('PostgreSQL client connected');
});

export const healthCheckPgConnection = async (): Promise<boolean> => {
  try {
    const result = await pgPool.query('SELECT NOW()');
    logger.info('PostgreSQL health check passed');
    return true;
  } catch (error) {
    logger.error('PostgreSQL health check failed:', error);
    return false;
  }
};

export const closePgConnection = async () => {
  try {
    await pgPool.end();
    logger.info('PostgreSQL connection closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL connection:', error);
  }
};
