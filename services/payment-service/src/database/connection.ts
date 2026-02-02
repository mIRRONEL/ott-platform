import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ott_platform'
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('PostgreSQL connection error:', err);
  } else {
    logger.info('PostgreSQL connected successfully');
  }
});

export const closeConnection = async () => {
  await pool.end();
  logger.info('PostgreSQL connection closed');
};
