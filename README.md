# TCGMaster - Coolify Migration & Setup Guide

This guide is intended for migrating the TCGMaster platform from Supabase Cloud to a self-hosted **Coolify** environment.

## 1. Database Migration

Since `price_history` contains millions of rows, the best way to migrate the schema and core tables is through the Supabase Dashboard and the provided export scripts.

### Step A: Setup Supabase on Coolify
1. In your Coolify dashboard, create a new **Supabase** service.
2. Once deployed, note down your `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (Service Role Key).

### Step B: Export/Import Schema
1. Go to the original Supabase Cloud Dashboard -> Settings -> Database.
2. Click **Export schema**.
3. Go to your new Coolify Supabase Dashboard (or connect via `psql`) and run the schema SQL file.

### Step C: Export/Import Core Data (Cards & Sets)
To avoid re-scraping the 15,000+ cards and sets:
1. Run `bun run scripts/export-db.ts` to generate JSON dumps of the `cards` and `sets` tables in the `database-dumps/` folder. *(This is already done for you!)*
2. Update `.env` with your NEW Coolify Supabase credentials.
3. Run `bun run scripts/import-db.ts` to upload the data into your Coolify instance.

---

## 2. Environment Configuration

Rename `.env.example` to `.env` and fill in your values. 
```bash
cp .env.example .env
```
Ensure `NEXT_PUBLIC_SUPABASE_URL` points to your Coolify IP/domain (e.g. `http://<your-ip>:8000`).

---

## 3. Running the Next.js App

To run the web app locally or deploy it on Coolify (via Nixpacks/Node builder):
```bash
bun install
bun dev
# For production on Coolify: bun run build && bun start
```

---

## 4. Running the Price Scrapers

TCGMaster uses several background processes to scrape SnkrDunk, PriceCharting, and Yuyutei. 
On your Coolify server, you should run these as background workers (e.g., using PM2 or Coolify's worker configurations):

- **General JP Resolver**: `bun run scripts/price-engine/queue-jp-op.ts`
- **Manga Resolver**: `bun run scripts/price-engine/backfill-manga.ts` (Targeted scraping)

> **Note**: These scripts use Upstash Redis for rate-limiting to prevent IP bans. Make sure `UPSTASH_REDIS_REST_URL` is set in your `.env`.
