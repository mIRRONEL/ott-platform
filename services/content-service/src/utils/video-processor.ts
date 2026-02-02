import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from './logger';
import { mongoClient } from '../database/mongodb.connection';

const execAsync = promisify(exec);

interface QualityLevel {
  name: string;
  width: number;
  height: number;
  bitrate: string;
  outputDir: string;
}

const QUALITY_LEVELS: QualityLevel[] = [
  { name: '360p', width: 640, height: 360, bitrate: '480k', outputDir: '360p' },
  { name: '480p', width: 854, height: 480, bitrate: '800k', outputDir: '480p' },
  { name: '720p', width: 1280, height: 720, bitrate: '2500k', outputDir: '720p' },
  { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', outputDir: '1080p' }
];

const HLS_SEGMENT_DURATION = 10; // seconds
const FFMPEG_TIMEOUT = parseInt(process.env.FFMPEG_TIMEOUT || '3600000'); // 1 hour default for large files

async function updateVideoProgress(videoId: string, progress: number, stage: string): Promise<void> {
  try {
    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');
    await videosCollection.updateOne(
      { id: videoId },
      {
        $set: {
          hlsProgress: progress,
          processingStage: stage,
          updatedAt: new Date()
        }
      }
    );
    console.log(`[VIDEO-PROCESSOR] Updated progress for ${videoId}: ${progress}% - ${stage}`);
  } catch (error) {
    logger.error(`Failed to update progress for video ${videoId}:`, error);
  }
}

async function getVideoDurationSeconds(inputFilePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputFilePath}"`
    );
    const duration = parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch (error) {
    logger.warn('Failed to read video duration with ffprobe:', error);
    return 0;
  }
}

export async function processVideoToHLS(
  videoId: string,
  inputFilePath: string,
  outputBaseDir: string
): Promise<boolean> {
  try {
    logger.info(`Starting HLS processing for video ${videoId}`);
    await updateVideoProgress(videoId, 0, 'initializing');

    const durationSeconds = await getVideoDurationSeconds(inputFilePath);

    // Create output directory structure
    const videoOutputDir = path.join(outputBaseDir, videoId);
    
    if (!fs.existsSync(videoOutputDir)) {
      fs.mkdirSync(videoOutputDir, { recursive: true });
    }

    // Process each quality level
    const qualityCount = QUALITY_LEVELS.length;
    for (let i = 0; i < qualityCount; i++) {
      const quality = QUALITY_LEVELS[i];
      const progressStart = (i / qualityCount) * 90; // 0-90% for processing
      const progressEnd = ((i + 1) / qualityCount) * 90;
      
      await processQuality(
        videoId,
        inputFilePath,
        videoOutputDir,
        quality,
        progressStart,
        progressEnd,
        durationSeconds
      );
    }

    await updateVideoProgress(videoId, 95, 'generating master manifest');
    
    // Generate master manifest
    await generateMasterManifest(videoOutputDir);

    await updateVideoProgress(videoId, 100, 'completed');
    
    logger.info(`Successfully processed video ${videoId} to HLS`);
    return true;
  } catch (error) {
    logger.error(`Failed to process video ${videoId}:`, error);
    await updateVideoProgress(videoId, 0, 'failed');
    return false;
  }
}

async function processQuality(
  videoId: string,
  inputFile: string,
  outputDir: string,
  quality: QualityLevel,
  progressStart: number,
  progressEnd: number,
  durationSeconds: number
): Promise<void> {
  const qualityDir = path.join(outputDir, quality.outputDir);
  
  if (!fs.existsSync(qualityDir)) {
    fs.mkdirSync(qualityDir, { recursive: true });
  }

  const outputPattern = path.join(qualityDir, 'segment_%03d.ts');
  const manifestFile = path.join(qualityDir, 'playlist.m3u8');

  console.log(`[VIDEO-PROCESSOR] Processing ${quality.name}:`, { inputFile, outputDir, qualityDir, outputPattern, manifestFile });

  const ffmpegCommand = `ffmpeg -i "${inputFile}" \
    -vf scale=${quality.width}:${quality.height} \
    -c:v libx264 -preset fast -b:v ${quality.bitrate} \
    -c:a aac -b:a 128k \
    -f hls -hls_time ${HLS_SEGMENT_DURATION} \
    -hls_list_size 0 \
    -hls_segment_filename "${outputPattern}" \
    "${manifestFile}"`;

  logger.info(`Processing ${quality.name} for video...`);
  console.log(`[VIDEO-PROCESSOR] FFmpeg command: ${ffmpegCommand}`);
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFile,
      '-vf', `scale=${quality.width}:${quality.height}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-b:v', quality.bitrate,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', String(HLS_SEGMENT_DURATION),
      '-hls_list_size', '0',
      '-hls_segment_filename', outputPattern,
      '-progress', 'pipe:1',
      '-nostats',
      manifestFile
    ], { 
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let segmentCount = 0;
    const timeoutHandle = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      reject(new Error(`FFmpeg timeout after ${FFMPEG_TIMEOUT}ms for ${quality.name}`));
    }, FFMPEG_TIMEOUT);

    ffmpeg.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n');

      for (const line of lines) {
        if (line.startsWith('out_time_ms=')) {
          const outTimeMs = parseInt(line.replace('out_time_ms=', '').trim(), 10);
          if (Number.isFinite(outTimeMs) && durationSeconds > 0) {
            const progressRatio = Math.min(outTimeMs / (durationSeconds * 1000000), 0.999);
            const progress = progressStart + ((progressEnd - progressStart) * progressRatio);
            updateVideoProgress(videoId, progress, `Processing ${quality.name}`).catch(err => {
              logger.error('Failed to update progress:', err);
            });
          }
        }
      }
    });

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();

      // Track segment creation as a fallback when duration isn't available
      if (output.includes('segment_') && durationSeconds === 0) {
        segmentCount++;
        const progress = progressStart + ((progressEnd - progressStart) * (segmentCount / 20));
        updateVideoProgress(videoId, Math.min(progress, progressEnd - 1), `Processing ${quality.name}`).catch(err => {
          logger.error('Failed to update progress:', err);
        });
      }

      // Log FFmpeg output for debugging
      if (output.includes('error') || output.includes('Error')) {
        console.error(`[VIDEO-PROCESSOR] FFmpeg error for ${quality.name}:`, output);
      }
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (code === 0) {
        console.log(`[VIDEO-PROCESSOR] FFmpeg completed for ${quality.name}`);
        logger.info(`Successfully processed ${quality.name}`);
        updateVideoProgress(videoId, progressEnd, `Completed ${quality.name}`).catch(err => {
          logger.error('Failed to update progress:', err);
        });
        resolve();
      } else {
        const error = new Error(`FFmpeg exited with code ${code} for ${quality.name}`);
        console.error(`[VIDEO-PROCESSOR] ${error.message}`);
        logger.error(error.message);
        reject(error);
      }
    });

    ffmpeg.on('error', (error) => {
      clearTimeout(timeoutHandle);
      console.error(`[VIDEO-PROCESSOR] FFmpeg error for ${quality.name}:`, error);
      logger.error(`Failed to process ${quality.name}:`, error);
      reject(error);
    });
  });
}

async function generateMasterManifest(videoDir: string): Promise<void> {
  const masterManifestPath = path.join(videoDir, 'master.m3u8');
  
  let manifestContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

  // Add variants in order of bitrate (from lowest to highest)
  const variants = [
    { bitrate: 480000, resolution: '640x360', dir: '360p' },
    { bitrate: 800000, resolution: '854x480', dir: '480p' },
    { bitrate: 2500000, resolution: '1280x720', dir: '720p' },
    { bitrate: 5000000, resolution: '1920x1080', dir: '1080p' }
  ];

  for (const variant of variants) {
    manifestContent += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate},RESOLUTION=${variant.resolution}\n`;
    manifestContent += `${variant.dir}/playlist.m3u8\n`;
  }

  fs.writeFileSync(masterManifestPath, manifestContent);
  logger.info('Master manifest created');
}

export function getVideoManifestPath(videoId: string, baseDir: string): string {
  return path.join(baseDir, videoId, 'master.m3u8');
}

export function getVideoSegmentsDir(videoId: string, baseDir: string): string {
  return path.join(baseDir, videoId);
}
