module.exports = {
  apps: [
    {
      name: "scraper-jp-op",
      script: "scripts/price-engine/queue-jp-op.ts",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_memory_restart: "1G"
    },
    {
      name: "scraper-en-op",
      script: "scripts/price-engine/queue-english-op.ts",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_memory_restart: "1G"
    },
    {
      name: "scraper-jp-dbfw",
      script: "scripts/price-engine/queue-dbfw.ts",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_memory_restart: "1G"
    },
    {
      name: "scraper-en-dbfw",
      script: "scripts/price-engine/queue-english-dbfw.ts",
      interpreter: "bun",
      env: {
        SAFE_MODE: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_memory_restart: "1G"
    }
  ]
};
