# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs \
  && mkdir -p /videos/raw /videos/encoded \
  && chown -R nodejs:nodejs /app /videos

USER nodejs

ENV NODE_ENV=production

EXPOSE 3008

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3008/health', (r) => { if (r.statusCode !== 200) process.exit(1) })"

CMD ["node", "dist/index.js"]
