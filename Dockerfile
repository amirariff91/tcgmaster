# syntax=docker/dockerfile:1
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# puppeteer is only used by the scrapers (lib/price-engine/*, scripts/*), never by the
# Next.js app. Its postinstall Chrome download needs `unzip`, which node:*-slim lacks —
# skipping it keeps the web image buildable and smaller. See Dockerfile.scraper.
ENV PUPPETEER_SKIP_DOWNLOAD=1

# Install ALL deps (NODE_ENV=development ensures optional native binaries are included).
# Must fail loudly: a masked failure here surfaces later as a confusing "next: not found".
RUN NODE_ENV=development npm ci

# Linux-specific binaries the macOS lockfile skips. Genuinely optional, so this one
# step may fail without failing the build.
RUN npm install --no-save \
      @tailwindcss/oxide-linux-x64-gnu \
      lightningcss-linux-x64-gnu \
      lightningcss-linux-x64-musl \
    || echo "optional native binaries unavailable; continuing"

# Copy source
COPY . .

# Build Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM node:22-slim AS runner
WORKDIR /app

# Coolify's healthcheck shells into the container and probes with curl (falling back
# to wget); node:22-slim ships neither, so without this the container is reported
# unhealthy and the deploy rolls back even though the app is serving fine.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
