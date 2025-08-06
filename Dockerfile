# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    libjpeg-turbo-dev \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Development stage
FROM base AS development
ENV NODE_ENV=development

# Install all dependencies (including dev dependencies)
RUN npm ci
RUN cd backend && npm ci
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Expose ports
EXPOSE 3000 5000

# Start development servers
CMD ["npm", "run", "dev"]

# Build stage for frontend
FROM base AS frontend-builder
ENV NODE_ENV=production

# Install dependencies
RUN cd frontend && npm ci --only=production

# Copy frontend source
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Build stage for backend
FROM base AS backend-builder
ENV NODE_ENV=production

# Install dependencies
RUN cd backend && npm ci --only=production

# Copy backend source
COPY backend ./backend

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S signlang -u 1001

# Set working directory
WORKDIR /app

# Copy built backend
COPY --from=backend-builder --chown=signlang:nodejs /app/backend ./backend

# Copy built frontend
COPY --from=frontend-builder --chown=signlang:nodejs /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder --chown=signlang:nodejs /app/frontend/public ./frontend/public
COPY --from=frontend-builder --chown=signlang:nodejs /app/frontend/package.json ./frontend/

# Copy production configuration files
COPY --chown=signlang:nodejs docker-compose.prod.yml ./
COPY --chown=signlang:nodejs .env.production ./
COPY --chown=signlang:nodejs nginx.conf ./

# Create necessary directories
RUN mkdir -p ./backend/logs ./backend/uploads ./backend/exports ./backend/temp ./backend/ssl \
    && chown -R signlang:nodejs ./backend/logs ./backend/uploads ./backend/exports ./backend/temp ./backend/ssl

# Switch to non-root user
USER signlang

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD node ./backend/scripts/healthcheck.js

# Start application
CMD ["node", "./backend/server.js"]