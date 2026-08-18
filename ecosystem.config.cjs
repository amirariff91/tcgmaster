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
 *   scraper-jp-op  — Yuyutei + PriceCharting for Japanese One Piece
 *   scraper-dbfw   — CardRush for Dragon Ball Fusion World
 *   scraper-en-dbfw — TCGCSV for English Dragon Ball Fusion World
 *   artist-vision  — Ollama Cloud vision artist extractor for EN OP cards
 *   variant-mapper — Ollama Cloud variant mapping for English cards
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
      kill_timeout: 12000,
      restart_delay: 5000,   // Wait 5s before restarting on crash
      exp_backoff_restart_delay: 5000, // transient-dep (DB down) restart storms back off instead of burning max_restarts
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
      kill_timeout: 12000,
      restart_delay: 5000,
      exp_backoff_restart_delay: 5000, // transient-dep (DB down) restart storms back off instead of burning max_restarts
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
      kill_timeout: 12000,
      restart_delay: 5000,
      exp_backoff_restart_delay: 5000, // transient-dep (DB down) restart storms back off instead of burning max_restarts
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/scraper-dbfw.log',
      error_file: './logs/scraper-dbfw-error.log',
      time: true,
    },

    // English Dragon Ball Fusion World — TCGCSV
    // ─────────────────────────────────────────────
    {
      name: 'scraper-en-dbfw',
      script: 'bun',
      args: 'run scripts/price-engine/queue-english-dbfw.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 5000,
      exp_backoff_restart_delay: 5000, // transient-dep (DB down) restart storms back off instead of burning max_restarts
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/scraper-en-dbfw.log',
      error_file: './logs/scraper-en-dbfw-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // Persist source identities before the pricers fetch by anchor
    // ─────────────────────────────────────────────
    {
      name: 'scraper-resolver',
      script: 'bun',
      args: 'run scripts/price-engine/resolver.ts --source pricecharting --loop',
      env: {
        RESOLVER_SLEEP_MS: '20000',
      },
      watch: false,
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 5000,
      exp_backoff_restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/scraper-resolver.log',
      error_file: './logs/scraper-resolver-error.log',
      time: true,
    },
    // Vision Artist Extractor (Gemini) — EN One Piece first
    // Runs as idle-loop: waits 5min when backlog is empty
    // Expand to JA OP + DBFW in Phase 2
    // ─────────────────────────────────────────────
    {
      name: 'artist-vision',
      script: 'bun',
      args: 'run scripts/extract-artists.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      // The script exits(1) without GEMINI_API_KEY. Don't restart it forever in that
      // case — the price scrapers are independent and must not be drowned in its logs.
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 10000,  // Longer delay — vision API errors can be transient
      max_restarts: 30,
      min_uptime: '10s',
      log_file: './logs/artist-vision.log',
      error_file: './logs/artist-vision-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // Variant Mapper (Ollama Cloud) — English cards
    // ─────────────────────────────────────────────
    {
      name: 'variant-mapper',
      script: 'bun',
      args: 'run scripts/generate-variant-mapping.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 10000,
      max_restarts: 30,
      min_uptime: '10s',
      log_file: './logs/variant-mapper.log',
      error_file: './logs/variant-mapper-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // Image Downloader — Background Worker
    // ─────────────────────────────────────────────
    {
      name: 'image-downloader',
      script: 'bun',
      args: 'run scripts/image-downloader.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/image-downloader.log',
      error_file: './logs/image-downloader-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // Snkrdunk Historical Price Backfill Worker
    // ─────────────────────────────────────────────
    {
      name: 'historical-snkrdunk',
      script: 'bun',
      args: 'run scripts/historical-snkrdunk-worker.ts',
      env: {
        SAFE_MODE: SAFE_MODE ? '1' : '0',
      },
      watch: false,
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
      log_file: './logs/historical-snkrdunk.log',
      error_file: './logs/historical-snkrdunk-error.log',
      time: true,
    },

    // ─────────────────────────────────────────────
    // POPULATION SCRAPERS
    // ─────────────────────────────────────────────
    {
      name: 'pop-scraper-master',
      script: 'bun',
      args: 'run scripts/scrapers/pop/master.ts',
      watch: false,
      autorestart: true,
      kill_timeout: 12000,
      restart_delay: 15000,
      exp_backoff_restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '30s',
      max_memory_restart: '1000M', // Protective safety net
      log_file: './logs/pop-scraper-master.log',
      error_file: './logs/pop-scraper-master-error.log',
      time: true,
    }
  ],
};
