import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { kafkaProducer } from '../kafka/producer';

// Master profile ladder definition
export interface ProfileDefinition {
  quality: string;
  height: number;
  width: number;
  bitrate: string;
  resolution: string;
}

const ALL_ENCODING_PROFILES: ProfileDefinition[] = [
  { quality: '1080p', height: 1080, width: 1920, bitrate: '5000k', resolution: '1920x1080' },
  { quality: '720p',  height: 720,  width: 1280, bitrate: '2500k', resolution: '1280x720' },
  { quality: '480p',  height: 480,  width: 854,  bitrate: '1500k', resolution: '854x480' },
  { quality: '360p',  height: 360,  width: 640,  bitrate: '800k',  resolution: '640x360' },
];

export interface VideoUploadEvent {
  videoId: string;
  title: string;
  originalFilePath?: string;
  filePath?: string;
  fileName?: string;
  duration?: number;
  profiles?: string[];
  preset?: string;
  deleteRawAfterEncode?: boolean;
}

export interface VideoStreamMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  bitrate?: number;
}

const parseTimemark = (timemark: string): number => {
  if (!timemark) return 0;
  const parts = timemark.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
};

/**
 * Smart Ladder: Select profiles <= source resolution (Apple HLS Authoring Spec)
 */
const selectEncodingProfiles = (sourceHeight: number, requestedProfiles?: string[]): ProfileDefinition[] => {
  let available = ALL_ENCODING_PROFILES;
  if (requestedProfiles && requestedProfiles.length > 0) {
    available = ALL_ENCODING_PROFILES.filter(p => requestedProfiles.includes(p.quality));
  }
  if (!sourceHeight || sourceHeight >= 950) {
    return available.length > 0 ? available : ALL_ENCODING_PROFILES;
  }
  const filtered = available.filter((p) => p.height <= Math.round(sourceHeight * 1.1));
  return filtered.length > 0 ? filtered : [available[available.length - 1] || ALL_ENCODING_PROFILES[ALL_ENCODING_PROFILES.length - 1]];
};

export const encodeVideo = async (event: VideoUploadEvent) => {
  const { videoId, title, requestedProfiles, preset, deleteRawAfterEncode } = event as any;

  try {
    logger.info(`⚡ Starting optimized parallel encoding pipeline for video: ${videoId}`);

    const encodedDir = path.join('/videos/encoded', videoId);
    const inputPath = resolveInputPath(event);
    if (!inputPath) {
      throw new Error(`No readable input video found for ${videoId}`);
    }

    // 1. Probe input metadata (Resolution, FPS, Codecs, Duration)
    let meta: VideoStreamMetadata = {
      duration: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      audioChannels: 2,
    };

    try {
      meta = await extractVideoMetadata(inputPath);
      logger.info(
        `✓ Video ${videoId} probed: ${meta.width}x${meta.height} @ ${meta.fps}fps, Duration: ${meta.duration}s, Audio: ${meta.audioCodec} (${meta.audioChannels}ch)`
      );
    } catch (probeErr) {
      logger.warn(`Could not probe video ${videoId} metadata, falling back to defaults:`, probeErr);
    }

    // 2. Smart Ladder: Determine active profiles (No upscaling)
    const activeProfiles = selectEncodingProfiles(meta.height, event.profiles || requestedProfiles);
    logger.info(
      `✓ Selected ${activeProfiles.length} profiles for ${videoId}: [${activeProfiles.map((p) => p.quality).join(', ')}]`
    );

    // Create output directory
    if (!fs.existsSync(encodedDir)) {
      fs.mkdirSync(encodedDir, { recursive: true });
    }

    const progressTracker: Record<string, number> = {};
    activeProfiles.forEach((p) => {
      progressTracker[p.quality] = 0;
    });

    let lastReportedProgress = -1;

    // Aggregated progress reporter across all parallel profiles
    const reportProgress = async (forcedProgress?: number) => {
      let overallProgress: number;
      if (forcedProgress !== undefined) {
        overallProgress = forcedProgress;
      } else {
        let totalProgress = 0;
        for (const profile of activeProfiles) {
          totalProgress += progressTracker[profile.quality] || 0;
        }
        overallProgress = Math.round(totalProgress / activeProfiles.length);
      }

      overallProgress = Math.min(100, Math.max(1, overallProgress));

      if (overallProgress > lastReportedProgress) {
        lastReportedProgress = overallProgress;
        try {
          await kafkaProducer.send({
            topic: 'video.encoding.progress',
            messages: [
              {
                key: videoId,
                value: JSON.stringify({
                  videoId,
                  status: 'encoding',
                  progress: overallProgress,
                  timestamp: new Date().toISOString(),
                }),
              },
            ],
          });
          logger.info(`Published progress for ${videoId}: ${overallProgress}%`);
        } catch (err) {
          logger.warn(`Failed to publish progress for ${videoId}`, err);
        }
      }
    };

    // Report initial progress
    await reportProgress(5);

    // 3. Parallel Profiles Execution (Utilizes all Xeon CPU cores concurrently)
    logger.info(`🚀 Launching parallel transcoding across ${activeProfiles.length} profiles...`);
    const encodingPromises = activeProfiles.map((profile) =>
      encodeToQuality(
        videoId,
        inputPath,
        encodedDir,
        profile,
        meta,
        (percent) => {
          progressTracker[profile.quality] = percent;
          reportProgress();
        }
      )
    );

    const settledResults = await Promise.allSettled(encodingPromises);
    const results: any[] = [];

    settledResults.forEach((res, index) => {
      const profile = activeProfiles[index];
      if (res.status === 'fulfilled') {
        results.push(res.value);
        progressTracker[profile.quality] = 100;
        logger.info(`✓ Successfully completed ${profile.quality} for ${videoId}`);
      } else {
        logger.error(`✗ Failed to encode ${profile.quality} for ${videoId}:`, res.reason);
        progressTracker[profile.quality] = 100;
      }
    });

    if (results.length === 0) {
      throw new Error(`All encoding profiles failed for ${videoId}`);
    }

    // 4. Generate Master Multivariant HLS Playlist (m3u8)
    const playlistPath = path.join(encodedDir, 'playlist.m3u8');
    generateMasterPlaylist(playlistPath, results);

    // 5. Extract default thumbnail frame from video (Fail-safe)
    const thumbnailPath = path.join(encodedDir, 'thumbnail.jpg');
    try {
      const bestCompleted = results[0]?.quality || '720p';
      const segment0 = path.join(encodedDir, bestCompleted, 'playlist0.ts');
      const thumbSource = fs.existsSync(inputPath) ? inputPath : (fs.existsSync(segment0) ? segment0 : null);

      if (thumbSource) {
        await new Promise<void>((resolve) => {
          ffmpeg(thumbSource)
            .screenshots({
              timestamps: [meta.duration > 3 ? 1.5 : 0.5],
              filename: 'thumbnail.jpg',
              folder: encodedDir,
              size: '1280x720',
            })
            .on('end', () => {
              logger.info(`✓ Generated high-res fallback thumbnail for ${videoId}`);
              resolve();
            })
            .on('error', (err) => {
              logger.warn(`Could not generate thumbnail screenshot for ${videoId}:`, err);
              resolve();
            });
        });
      }
    } catch (thumbErr) {
      logger.warn(`Thumbnail extraction error for ${videoId}:`, thumbErr);
    }

    // Final 100% progress
    await reportProgress(100);

    // 6. Publish encoding completed event
    const shouldDeleteRaw = deleteRawAfterEncode !== undefined
      ? Boolean(deleteRawAfterEncode)
      : (process.env.AUTO_DELETE_RAW_AFTER_ENCODE !== 'false');

    await kafkaProducer.send({
      topic: 'video.encoding.completed',
      messages: [
        {
          key: videoId,
          value: JSON.stringify({
            videoId,
            title,
            status: 'ready',
            progress: 100,
            hlsUrl: `http://localhost:3000/encoded/${videoId}/playlist.m3u8`,
            thumbnail: `/api/stream/${videoId}/thumbnail`,
            posterImage: `/api/stream/${videoId}/thumbnail`,
            profiles: results,
            deletedRawMaster: shouldDeleteRaw,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    logger.info(`✓ Encoding pipeline fully complete for ${videoId}, event published to Kafka`);

    // Auto-purge raw master file if requested
    if (shouldDeleteRaw && inputPath && fs.existsSync(inputPath)) {
      try {
        const stats = fs.statSync(inputPath);
        const reclaimedMB = (stats.size / 1024 / 1024).toFixed(2);
        fs.unlinkSync(inputPath);
        logger.info(`✓ Auto-purged raw master file for ${videoId} (${inputPath}) - Reclaimed ${reclaimedMB} MB disk space`);
      } catch (delErr) {
        logger.warn(`Could not auto-purge raw file for ${videoId}:`, delErr);
      }
    }
  } catch (error) {
    logger.error(`Encoding pipeline failed for ${videoId}:`, error);

    // Publish failure event
    await kafkaProducer.send({
      topic: 'video.encoding.failed',
      messages: [
        {
          key: videoId,
          value: JSON.stringify({
            videoId,
            title,
            status: 'failed',
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    throw error;
  }
};

const resolveInputPath = (event: VideoUploadEvent): string | null => {
  const rawDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
  const uploadDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
  const fileNameFromPath = event.filePath ? path.basename(event.filePath) : undefined;

  const candidates = [
    event.originalFilePath,
    event.filePath,
    event.fileName ? path.join(rawDir, event.fileName) : undefined,
    fileNameFromPath ? path.join(rawDir, fileNameFromPath) : undefined,
    event.fileName ? path.join(uploadDir, event.fileName) : undefined,
    fileNameFromPath ? path.join(uploadDir, fileNameFromPath) : undefined,
    path.join(rawDir, `${event.videoId}.mp4`),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  logger.error(`No valid input file for ${event.videoId}. Tried: ${candidates.join(', ')}`);
  return null;
};

/**
 * Optimized Single Quality Transcoder:
 * - Fixed 2-second Keyframe GOP Alignment for seamless HLS switching
 * - Smart Audio Copying (-c:a copy if AAC stereo)
 * - veryfast preset with film tuning
 */
const encodeToQuality = (
  videoId: string,
  inputPath: string,
  outputDir: string,
  profile: ProfileDefinition,
  meta: VideoStreamMetadata,
  onProgress?: (percent: number) => void
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const qualityDir = path.join(outputDir, profile.quality);

    if (!fs.existsSync(qualityDir)) {
      fs.mkdirSync(qualityDir, { recursive: true });
    }

    const playlistPath = path.join(qualityDir, 'playlist.m3u8');
    const gopSize = Math.max(30, Math.min(120, Math.round((meta.fps || 30) * 2)));

    // Fast Audio Strategy: If input audio is already AAC stereo, copy stream with 0 CPU overhead
    const isAacStereo = meta.audioCodec === 'aac' && (meta.audioChannels || 2) <= 2;
    const audioOptions = isAacStereo
      ? ['-c:a', 'copy']
      : ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'];

    const bitrateInt = parseInt(profile.bitrate, 10);
    const maxRate = `${Math.round(bitrateInt * 1.2)}k`;
    const bufSize = `${Math.round(bitrateInt * 2)}k`;

    logger.info(
      `[Profile ${profile.quality}] Starting encode (${profile.resolution} @ ${profile.bitrate}, GOP: ${gopSize}, Audio: ${isAacStereo ? 'Direct Stream Copy' : 'AAC Re-encode'})`
    );

    const threadsPerProfile = process.env.FFMPEG_THREADS_PER_PROFILE || '2';

    ffmpeg(inputPath)
      .inputOptions([
        '-err_detect', 'ignore_err',
        '-fflags', '+genpts+discardcorrupt',
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-tune', 'film',
        '-threads', threadsPerProfile,
        '-g', `${gopSize}`,
        '-keyint_min', `${gopSize}`,
        '-sc_threshold', '0',
        '-b:v', profile.bitrate,
        '-maxrate', maxRate,
        '-bufsize', bufSize,
        '-s', profile.resolution,
        ...audioOptions,
        '-max_muxing_queue_size', '2048',
        '-avoid_negative_ts', 'make_zero',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_list_size', '0',
      ])
      .output(playlistPath)
      .on('start', (cmd) => {
        logger.info(`FFmpeg started for ${profile.quality}: ${cmd}`);
      })
      .on('progress', (progress) => {
        let percent = 0;
        if (progress.percent && !isNaN(progress.percent)) {
          percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
        } else if (meta.duration > 0 && progress.timemark) {
          const currentSeconds = parseTimemark(progress.timemark);
          percent = Math.min(100, Math.max(0, Math.round((currentSeconds / meta.duration) * 100)));
        }
        if (percent > 0 && onProgress) {
          onProgress(percent);
        }
      })
      .on('end', () => {
        if (onProgress) onProgress(100);
        logger.info(`✓ FFmpeg completed for ${profile.quality}`);
        resolve({
          quality: profile.quality,
          bitrate: profile.bitrate,
          resolution: profile.resolution,
          playlistPath: `http://localhost:3000/encoded/${videoId}/${profile.quality}/playlist.m3u8`,
          localPath: qualityDir,
        });
      })
      .on('error', (err) => {
        logger.error(`✗ FFmpeg error for ${profile.quality}:`, err);
        reject(err);
      })
      .run();
  });
};

const generateMasterPlaylist = (playlistPath: string, encodingResults: any[]) => {
  let content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-INDEPENDENT-SEGMENTS
`;

  // Sort descending by resolution/bitrate for optimal player startup
  const sorted = [...encodingResults].sort((a, b) => parseInt(b.bitrate, 10) - parseInt(a.bitrate, 10));

  sorted.forEach((result) => {
    const bandwidth = parseInt(result.bitrate, 10) * 1000;
    const [width, height] = result.resolution.split('x');

    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${result.quality}"\n${result.quality}/playlist.m3u8\n`;
  });

  fs.writeFileSync(playlistPath, content);
};

// Comprehensive ffprobe metadata inspection
export const extractVideoMetadata = (filePath: string): Promise<VideoStreamMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata?.streams?.find((s) => s.codec_type === 'video');
        const audioStream = metadata?.streams?.find((s) => s.codec_type === 'audio');

        let fps = 30;
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/');
          if (num && den && parseInt(den, 10) > 0) {
            fps = Math.round(parseInt(num, 10) / parseInt(den, 10)) || 30;
          }
        }

        const rawDuration = metadata?.format?.duration ?? videoStream?.duration ?? 0;
        const duration = typeof rawDuration === 'number' ? rawDuration : parseFloat(String(rawDuration)) || 0;

        resolve({
          duration,
          width: videoStream?.width || 1920,
          height: videoStream?.height || 1080,
          fps,
          videoCodec: videoStream?.codec_name || 'h264',
          audioCodec: audioStream?.codec_name || 'aac',
          audioChannels: audioStream?.channels || 2,
          bitrate: metadata?.format?.bit_rate ? Math.round(Number(metadata.format.bit_rate) / 1000) : 5000,
        });
      }
    });
  });
};
