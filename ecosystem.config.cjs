/**
 * PM2 Ecosystem Config — TCGMaster 24/7 Scraper Supervision
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs        # Start all workers
 *   pm2 save                               # Persist on reboot
 *   pm2 startup                            # Auto-start after system restart
 *   pm2 logs                               # Live logs from all workers
 *   pm2 status                             # Health overview
 *   pm2 stop all                           # Graceful stop
 *
 * Safe mode (slower, extra ban-safe):
 *   SAFE_MODE=1 pm2 start ecosystem.config.cjs
 *
 * Workers:
 *   scraper-en-op  — TCGCSV for English One Piece (fast, JSON API, no Puppeteer)
 *   scraper-jp-op  — Yuyutei primary + SnkrDunk fallback for Japanese One Piece
 *   scraper-dbfw   — CardRush for Dragon Ball Fusion World
 *   artist-gemini  — Gemini Vision artist extractor for EN OP cards
 */

const SAFE_MODE = process.env.SAFE_MODE === '1';

module.exports = {
  apps: [
    // ─────────────────────────────────────────────
    // English One Piece — TCGCSV (no Puppeteer, fast JSON API)
    // ─────────────────────────────────────────────
    {
      name: 'scraper-en-op',
      script: 'bun',
      args: 'run scripts/price-engine/queue-english-op.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      restart_delay: 5000,   // Wait 5s before restarting on crash
      max_restarts: 50,       // If crashes > 50 times, stop (circuit breaker)
      min_uptime: '10s',      // Must stay alive 10s to count as healthy start
      log_file: './logs/scraper-en-op.log',
      error_file: './logs/scraper-en-op-error.log',
      time: true,             // Prefix logs with timestamps
    },

    // ─────────────────────────────────────────────
    // Japanese One Piece — Yuyutei + SnkrDunk fallback
    // ─────────────────────────────────────────────
    {
      name: 'scraper-jp-op',
      script: 'bun',
      args: 'run scripts/price-engine/queue-jp-op.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/scraper-jp-op.log',
      error_file: './logs/scraper-jp-op-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // Dragon Ball Fusion World — CardRush
    // ─────────────────────────────────────────────
    {
      name: 'scraper-dbfw',
      script: 'bun',
      args: 'run scripts/price-engine/queue-dbfw.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/scraper-dbfw.log',
      error_file: './logs/scraper-dbfw-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // Gemini Artist Extractor — EN One Piece first
    // Runs as idle-loop: waits 5min when backlog is empty
    // Expand to JA OP + DBFW in Phase 2
    // ─────────────────────────────────────────────
    {
      name: 'artist-gemini',
      script: 'bun',
      args: 'run scripts/extract-artists-gemini.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
        GEMINI_MODEL: 'gemini-3.1-flash-lite',
      },
      watch: false,
      autorestart: true,
      restart_delay: 10000,  // Longer delay — Gemini errors can be transient
      max_restarts: 30,
      min_uptime: '10s',
      log_file: './logs/artist-gemini.log',
      error_file: './logs/artist-gemini-error.log',
      time: true,
    },
  ],
};
