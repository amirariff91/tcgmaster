# syntax=docker/dockerfile:1
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL deps (NODE_ENV=development ensures optional native binaries are included)
# Then explicitly install linux-specific binaries that the macOS lockfile skips
RUN NODE_ENV=development npm install && \
    npm install --no-save @tailwindcss/oxide-linux-x64-gnu lightningcss-linux-x64-gnu lightningcss-linux-x64-musl 2>/dev/null || true

# Copy source
COPY . .

# Build Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
