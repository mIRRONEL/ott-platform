import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Use temp directory for uploads
const uploadDir = path.join(os.tmpdir(), 'ott-gateway-uploads');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let fileCount = 0;

// Configure storage - use disk storage instead of memory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const uniqueName = `upload-${timestamp}-${++fileCount}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configure multer
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max file size
  }
});

export default upload;

