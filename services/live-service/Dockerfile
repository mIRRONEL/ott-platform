# Multi-stage build for Live Ingest & Creator Broadcasting Service
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Production runtime stage with FFmpeg
FROM node:20-alpine

WORKDIR /app

# Install FFmpeg and dumb-init for live transcode / remux
RUN apk add --no-cache dumb-init ffmpeg

COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create media root directories for live HLS streams
RUN mkdir -p /videos/live /app/logs && chmod -R 777 /videos /app/logs

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3009 1935 8000

ENV NODE_ENV=production
ENV PORT=3009
ENV RTMP_PORT=1935

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3009/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
