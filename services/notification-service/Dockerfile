# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install exact dependencies
RUN npm ci --legacy-peer-deps

# Copy TypeScript configuration and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build


# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create writable log directory
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Run as non-root
USER nodejs

ENV NODE_ENV=production

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3006/health', (r) => { if (r.statusCode !== 200) process.exit(1) })"

# Proper signal handling
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]