import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import os from 'os';

// Use /tmp for uploads in Docker
const uploadDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'ott-uploads');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for standard legacy uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter - only accept video files (or any file for now)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  cb(null, true);
};

// Configure standard monolithic upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max file size
  }
});

// Configure chunk storage for resumable multipart uploads
export const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadId = (req.query.uploadId as string) || (req.headers['x-upload-id'] as string) || req.body?.uploadId || 'default';
      const chunksDir = path.join(uploadDir, uploadId, 'chunks');
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
      }
      cb(null, chunksDir);
    },
    filename: (req, file, cb) => {
      const chunkIndexRaw = req.query.chunkIndex !== undefined ? req.query.chunkIndex : (req.headers['x-chunk-index'] !== undefined ? req.headers['x-chunk-index'] : req.body?.chunkIndex);
      const chunkIndex = Number(chunkIndexRaw !== undefined ? chunkIndexRaw : 0);
      cb(null, `chunk_${String(chunkIndex).padStart(5, '0')}.part`);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max per chunk
  }
});

export default upload;
