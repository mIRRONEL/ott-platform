# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

COPY src ./src
COPY tsconfig.json ./

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init ffmpeg

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --chown=nodejs:nodejs package.json package-lock.json ./

RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs && chmod 750 /app/logs && \
    mkdir -p /tmp/ott-uploads && chown nodejs:nodejs /tmp/ott-uploads && chmod 750 /tmp/ott-uploads && \
    mkdir -p /tmp/ott-hls && chown nodejs:nodejs /tmp/ott-hls && chmod 750 /tmp/ott-hls

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

USER nodejs

EXPOSE 3003

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
