"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.connectDatabase = connectDatabase;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
exports.pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ott_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('error', (err) => {
    logger_1.logger.warn('Database pool error, connection will be retried:', err);
    // Don't exit - let the application continue
});
exports.pool.on('connect', () => {
    logger_1.logger.debug('New client connected to pool');
});
exports.pool.on('remove', () => {
    logger_1.logger.debug('Client removed from pool');
});
async function connectDatabase() {
    try {
        const client = await exports.pool.connect();
        await client.query('SELECT 1');
        client.release();
        logger_1.logger.info('Database connected successfully');
    }
    catch (error) {
        logger_1.logger.error('Database connection failed', error);
        throw error;
    }
}
exports.default = exports.pool;
//# sourceMappingURL=connection.js.map