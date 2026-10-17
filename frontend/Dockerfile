# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build


# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Install serve
RUN npm install -g serve \
    && npm cache clean --force

# Copy only production build
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Run as non-root
USER nodejs

ENV NODE_ENV=production

EXPOSE 5173

HEALTHCHECK --interval=15s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5173', (r) => { if (r.statusCode !== 200) process.exit(1) })"

CMD ["serve", "-s", "dist", "-l", "5173"]