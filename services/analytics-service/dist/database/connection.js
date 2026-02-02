"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePgConnection = exports.healthCheckPgConnection = exports.pgPool = void 0;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ott_platform';
exports.pgPool = new pg_1.Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});
exports.pgPool.on('error', (err) => {
    logger_1.logger.error('Unexpected error on idle client', err);
});
exports.pgPool.on('connect', () => {
    logger_1.logger.info('PostgreSQL client connected');
});
const healthCheckPgConnection = async () => {
    try {
        const result = await exports.pgPool.query('SELECT NOW()');
        logger_1.logger.info('PostgreSQL health check passed');
        return true;
    }
    catch (error) {
        logger_1.logger.error('PostgreSQL health check failed:', error);
        return false;
    }
};
exports.healthCheckPgConnection = healthCheckPgConnection;
const closePgConnection = async () => {
    try {
        await exports.pgPool.end();
        logger_1.logger.info('PostgreSQL connection closed');
    }
    catch (error) {
        logger_1.logger.error('Error closing PostgreSQL connection:', error);
    }
};
exports.closePgConnection = closePgConnection;
//# sourceMappingURL=connection.js.map