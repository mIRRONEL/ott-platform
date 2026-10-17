import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour

/**
 * Clean up stale chunked upload sessions older than 24 hours
 */
export const runGarbageCollection = async (): Promise<void> => {
  try {
    if (!fs.existsSync(UPLOAD_BASE_DIR)) {
      return;
    }

    const now = Date.now();
    const entries = fs.readdirSync(UPLOAD_BASE_DIR, { withFileTypes: true });
    let cleanedCount = 0;
    let reclaimedBytes = 0;

    for (const entry of entries) {
      // Ignore special directories like thumbnails or default
      if (entry.name === 'thumbnails' || entry.name === 'default') {
        continue;
      }

      const itemPath = path.join(UPLOAD_BASE_DIR, entry.name);
      try {
        const stats = fs.statSync(itemPath);
        const ageMs = now - stats.mtimeMs;

        if (ageMs > MAX_SESSION_AGE_MS) {
          if (entry.isDirectory()) {
            // Calculate size of directory before removal
            const calculateDirSize = (dir: string): number => {
              let total = 0;
              try {
                const files = fs.readdirSync(dir, { withFileTypes: true });
                for (const f of files) {
                  const fp = path.join(dir, f.name);
                  if (f.isDirectory()) {
                    total += calculateDirSize(fp);
                  } else {
                    total += fs.statSync(fp).size;
                  }
                }
              } catch (_) {}
              return total;
            };

            const dirSize = calculateDirSize(itemPath);
            fs.rmSync(itemPath, { recursive: true, force: true });
            cleanedCount++;
            reclaimedBytes += dirSize;
            logger.info(`[Housekeeper] Cleaned up stale upload session: ${entry.name} (${(dirSize / 1024 / 1024).toFixed(2)} MB reclaimed)`);
          } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
            // Stale temp mp4 files
            reclaimedBytes += stats.size;
            fs.unlinkSync(itemPath);
            cleanedCount++;
            logger.info(`[Housekeeper] Cleaned up stale temp file: ${entry.name}`);
          }
        }
      } catch (itemErr) {
        logger.warn(`[Housekeeper] Failed to inspect ${itemPath}:`, itemErr);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`[Housekeeper] GC finished: Removed ${cleanedCount} items, reclaimed ${(reclaimedBytes / 1024 / 1024).toFixed(2)} MB`);
    }
  } catch (err) {
    logger.error('[Housekeeper] Error during garbage collection cycle:', err);
  }
};

/**
 * Start the background garbage collection scheduler
 */
export const startHousekeeper = (): NodeJS.Timeout => {
  logger.info('Starting automated Housekeeper & Garbage Collector (24h retention policy)...');
  // Initial run after 10 seconds of startup
  setTimeout(() => {
    runGarbageCollection().catch(() => {});
  }, 10000);

  // Periodic schedule
  return setInterval(() => {
    runGarbageCollection().catch(() => {});
  }, CLEANUP_INTERVAL_MS);
};
