FROM node:20-bookworm-slim

# System libraries required by the backend's native modules:
# canvas (cairo/pango/jpeg/gif/rsvg/fontconfig), Chromium for PDF export, ffmpeg.
# Debian's chromium is used because html-pdf-node's bundled puppeteer
# has no arm64 Chromium download.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 \
    librsvg2-2 libfontconfig1 libfreetype6 libexpat1 libfribidi0 \
    libgdk-pixbuf-2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 ffmpeg ca-certificates chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 5000
CMD ["node", "server.js"]
