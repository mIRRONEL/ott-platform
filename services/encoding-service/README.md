# Video Encoding Pipeline - Quick Start Guide

## **What You Just Built**

A complete **asynchronous video encoding pipeline** that:
1. Listens for video uploads (Kafka event: `video.uploaded`)
2. Encodes video to 4 quality levels (1080p, 720p, 480p, 360p)
3. Generates HLS playlists for adaptive playback
4. Stores encoded videos locally in `/videos/encoded`
5. Publishes completion event (Kafka: `video.encoding.completed`)

**No CDN required!** The pipeline stores videos locally and serves them via HTTP.

---

## **Architecture Flow**

```
User uploads video (Content Service)
    ↓
Kafka: video.uploaded event published
    ↓
Encoding Service consumer picks it up
    ↓
FFmpeg encodes to 4 qualities in parallel
    ↓
HLS playlists generated
    ↓
Files stored: /videos/encoded/{videoId}/{quality}/
    ↓
Kafka: video.encoding.completed event
    ↓
Notification/Frontend updated
```

---

## **Setup Instructions**

### **1. Build and Start the Encoding Service**

```bash
cd /media/ronel/projecct-Another/ott-platform

# Build the encoding-service Docker image
docker compose build encoding-service

# Start the service (all services)
docker compose up -d encoding-service

# Verify it's running
docker compose ps encoding-service
docker compose logs encoding-service --tail=50
```

### **2. Test the Pipeline**

#### **Option A: Upload a Video via Frontend**
```
1. Go to http://localhost:5173
2. Login
3. Go to Upload section
4. Upload an MP4 file

Watch the logs:
docker compose logs encoding-service -f
```

#### **Option B: Manual Trigger (for testing)**
```bash
# Check if you have a test video
ls /videos/raw/

# Or upload one to the uploads directory
# Then manually trigger encoding via API:
curl -X POST http://localhost:3000/api/encoding/encode \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "test-video-123",
    "filePath": "/videos/raw/test.mp4"
  }'
```

### **3. Monitor Encoding Progress**

```bash
# Watch logs in real-time
docker compose logs encoding-service -f

# Check encoded videos
docker compose exec encoding-service ls -lh /videos/encoded/

# Check specific video encoding status
docker compose exec encoding-service ls -lh /videos/encoded/{videoId}/

# List all quality versions
docker compose exec encoding-service find /videos/encoded -type d -name "1080p" -o -name "720p"
```

---

## **How to Serve Encoded Videos**

### **Update Streaming Service to Serve from Local Storage**

Edit [services/streaming-service/src/controllers/streaming.controller.ts](../services/streaming-service/src/controllers/streaming.controller.ts):

**Change this:**
```typescript
// Old code - returns CDN URL (mock)
const segmentUrl = `${process.env.CDN_URL || 'https://cdn.example.com'}/videos/${videoId}/${quality}/${segmentId}.ts`;
res.status(302).redirect(segmentUrl);
```

**To this:**
```typescript
// New code - serve from local storage
const segmentPath = path.join('/videos/encoded', videoId, quality, `${segmentId}.ts`);

// Check if file exists
if (!fs.existsSync(segmentPath)) {
  throw new NotFoundError(`Segment not found: ${segmentPath}`);
}

// Serve the segment file
res.setHeader('Content-Type', 'video/MP2T');
res.setHeader('Cache-Control', 'public, max-age=3600');
res.sendFile(segmentPath);
```

### **Update Manifest Endpoint to Point to Local Files**

```typescript
// In getStreamManifest():
const manifest = generateHLSManifest(videoId, video, {
  localStoragePath: `/videos/encoded/${videoId}` // Add this
});

// Update HLS playlist generation:
// #EXT-X-STREAM-INF:BANDWIDTH=5000000
// http://localhost:3000/api/streams/video/{videoId}/1080p/playlist.m3u8
```

---

## **Kafka Topics Used**

| Topic | Published by | Consumed by | Purpose |
|-------|--------------|-------------|---------|
| `video.uploaded` | Content Service | Encoding Service | Trigger encoding |
| `video.encoding.completed` | Encoding Service | Frontend, Notification, Analytics | Notify video is ready |
| `video.encoding.failed` | Encoding Service | Notification, Analytics | Handle encoding errors |

---

## **Environment Variables (Already Set)**

```env
# In docker-compose.yaml (encoding-service section)
PORT=3008                           # Service port
KAFKA_BROKERS=kafka-1:9092,...      # Kafka cluster
VIDEOS_DIR=/videos                  # Storage location
ENCODED_VIDEOS_DIR=/videos/encoded  # Encoded output
FFMPEG_PRESET=medium                # Encoding speed (fast, medium, slow)
```

**Customize encoding profiles in** [services/encoding-service/src/services/encoding.service.ts](services/encoding-service/src/services/encoding.service.ts):

```typescript
const ENCODING_PROFILES = [
  { quality: '1080p', bitrate: '5000k', resolution: '1920x1080' },
  { quality: '720p', bitrate: '2500k', resolution: '1280x720' },
  { quality: '480p', bitrate: '1500k', resolution: '854x480' },
  { quality: '360p', bitrate: '800k', resolution: '640x360' },
];
```

---

## **Troubleshooting**

### **"FFmpeg not found"**
```bash
# Check if FFmpeg is installed in container
docker compose exec encoding-service which ffmpeg

# If missing, rebuild the image
docker compose build --no-cache encoding-service
```

### **"Kafka consumer failed to connect"**
```bash
# Check Kafka status
docker compose ps kafka-1 kafka-2 kafka-3

# View Kafka logs
docker compose logs kafka-1 --tail=30
```

### **"No disk space"**
```bash
# Check available space
docker exec encoding-service df -h /videos

# Clean old encoded videos (WARNING: deletes data!)
docker exec encoding-service rm -rf /videos/encoded/*
```

### **Encoding is slow**
Adjust `FFMPEG_PRESET` in docker-compose.yml:
- `ultrafast` - Fastest, lowest quality
- `fast` - Good balance
- `medium` - Default, slower
- `slow` - Best quality, slowest

---

## **Production Considerations**

### **1. Add Database Tracking**
```typescript
// Track encoding status in MongoDB
await db.collection('encoding_jobs').insertOne({
  videoId,
  status: 'in-progress',
  startTime: new Date(),
  estimatedDuration: 3600
});
```

### **2. Add Storage Scaling**
- Use S3 instead of local `/videos` directory
- Sync encoded videos to CDN
- Implement cleanup policy (delete after 30 days if not watched)

### **3. Add Worker Scaling**
- Run multiple encoding-service instances
- Use queue (SQS/Redis) for job distribution
- Add priority queue (new uploads = high priority)

### **4. Add Monitoring**
```typescript
// Publish metrics to Kafka
await kafkaProducer.send({
  topic: 'encoding.metrics',
  messages: [{
    value: JSON.stringify({
      videoId,
      encodingTime: 325,
      cpuUsage: 85,
      memoryUsage: 512,
      diskUsage: 1024
    })
  }]
});
```

---

## **Complete Workflow Example**

```bash
# 1. Start all services
docker compose up -d

# 2. Check encoding-service is healthy
curl http://localhost:3008/health

# 3. Upload video (via frontend or API)
# → Kafka: video.uploaded event

# 4. Watch encoding progress
docker compose logs encoding-service -f

# 5. Once complete, Kafka publishes: video.encoding.completed

# 6. Frontend updates to show video is ready

# 7. User can now watch with adaptive quality:
GET /api/streams/{videoId}/playlist.m3u8
GET /api/streams/{videoId}/1080p/playlist.m3u8
GET /api/streams/{videoId}/720p/segment_1.ts
# ... etc
```

---

## **Files Created**

```
services/encoding-service/
├── src/
│   ├── index.ts                    # Main app
│   ├── kafka/
│   │   ├── producer.ts             # Publish events
│   │   └── consumer.ts             # Listen for uploads
│   ├── services/
│   │   └── encoding.service.ts     # FFmpeg logic
│   ├── routes/
│   │   └── encoding.routes.ts      # API endpoints
│   └── utils/
│       └── logger.ts               # Winston logger
├── package.json
├── tsconfig.json
├── Dockerfile                       # Includes FFmpeg
└── .env                             # Configuration
```

---

## **Next Steps**

1. ✅ Start encoding-service
2. ✅ Upload a test video
3. ✅ Monitor encoding in logs
4. ⚠️ Update streaming-service to serve local files 
5. ⚠️ Add playback UI to select quality
6. ⚠️ Implement progress tracking in MongoDB
7. ⚠️ Scale to S3/CDN when ready

Good luck! 🎥
