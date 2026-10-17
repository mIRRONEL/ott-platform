# =========================
# Build stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Install exact dependencies
RUN npm ci --legacy-peer-deps

COPY src ./src
COPY tsconfig.json ./

RUN npm run build


# =========================
# Production stage
# =========================
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Copy compiled application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create log directory and assign ownership
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

ENV NODE_ENV=production

# Run as non-root
USER nodejs

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3005/health', (r) => { if (r.statusCode !== 200) process.exit(1) })"

# Proper signal handling
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]