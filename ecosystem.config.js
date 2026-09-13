/**
 * PM2 Ecosystem Config — TCGMaster 24/7 Multi-TCG Supervision
 *
 * Runs 4 concurrent lockstep workers (One Piece, Pokemon, Dragon Ball FW, Riftbound)
 * each processing their latest sets first, completing each set 100% (JA + EN) before advancing.
 */

module.exports = {
  apps: [
    {
      name: "worker-onepiece",
      script: "scripts/price-engine/run-lockstep-worker.ts",
      args: "--game one-piece --loop",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "1G"
    },
    {
      name: "worker-pokemon",
      script: "scripts/price-engine/run-lockstep-worker.ts",
      args: "--game pokemon --loop",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "1G"
    },
    {
      name: "worker-dbfw",
      script: "scripts/price-engine/run-lockstep-worker.ts",
      args: "--game dbfw --loop",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "1G"
    },
    {
      name: "worker-riftbound",
      script: "scripts/price-engine/run-lockstep-worker.ts",
      args: "--game riftbound --loop",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "1G"
    }
  ]
};
