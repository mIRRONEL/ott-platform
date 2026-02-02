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

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chmod 777 /app/logs

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3004

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
