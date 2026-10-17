import fs from 'fs';
import path from 'path';

/**
 * Automatically populates process.env from in-memory /run/secrets/ at boot
 */
export function loadSecrets(): void {
  const secretsDir = '/run/secrets';
  if (!fs.existsSync(secretsDir)) return;

  try {
    const files = fs.readdirSync(secretsDir);
    for (const file of files) {
      const fullPath = path.join(secretsDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const val = fs.readFileSync(fullPath, 'utf8').trim();
          const upperName = file.toUpperCase().replace(/-/g, '_');
          if (!process.env[upperName]) {
            process.env[upperName] = val;
          }
          if (file === 'postgres_password') {
            process.env.DB_PASSWORD = val;
            process.env.POSTGRES_PASSWORD = val;
          }
          if (file === 'postgres_app_password') {
            process.env.DB_APP_PASSWORD = val;
          }
          if (file === 'mongo_root_password') {
            process.env.MONGO_ROOT_PASSWORD = val;
          }
          if (file === 'mongo_app_password') {
            process.env.MONGO_APP_PASSWORD = val;
          }
          if (file === 'redis_password') {
            process.env.REDIS_PASSWORD = val;
          }
          if (file === 'jwt_secret') {
            process.env.JWT_SECRET = val;
          }
          if (file === 'jwt_refresh_secret') {
            process.env.JWT_REFRESH_SECRET = val;
          }
          if (file === 'stripe_api_key') {
            process.env.STRIPE_API_KEY = val;
            process.env.STRIPE_SECRET_KEY = val;
          }
          if (file === 'internal_service_secret') {
            process.env.INTERNAL_SERVICE_SECRET = val;
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Dynamic reconstruction of compound connection strings
    if (process.env.REDIS_PASSWORD) {
      const host = process.env.REDIS_HOST || 'redis';
      const port = process.env.REDIS_PORT || '6379';
      process.env.REDIS_URL = `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD)}@${host}:${port}`;
    }
    if (process.env.MONGO_APP_PASSWORD) {
      const user = process.env.MONGO_APP_USER || 'ott_user';
      const db = process.env.MONGO_INITDB_DATABASE || process.env.DB_NAME || 'ott_platform';
      const host = process.env.MONGO_HOST || 'mongodb';
      const port = process.env.MONGO_PORT || '27017';
      const url = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(process.env.MONGO_APP_PASSWORD)}@${host}:${port}/${db}?authSource=${db}`;
      process.env.MONGODB_URL = url;
      process.env.MONGODB_URI = url;
    }
  } catch {
    // Skip if secrets directory not accessible
  }
}

/**
 * Helper to fetch a specific secret by name with optional fallback
 */
export function getSecret(name: string, fallbackEnv?: string): string {
  const secretPath = `/run/secrets/${name}`;
  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch {
      // Fallback to environment
    }
  }
  return process.env[fallbackEnv || name] || '';
}

// Auto-execute immediately upon module import
loadSecrets();
