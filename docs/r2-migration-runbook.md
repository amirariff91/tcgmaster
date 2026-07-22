# R2 Image Migration Runbook (Supabase Storage → Cloudflare R2)

Move ~19.8k card images from Supabase Storage (`card-images`) to Cloudflare R2
(`tcgmaster-card-images`), served at `https://images.tcgmaster.com` with edge Image
Transformations. Reordered for safety after adversarial review — **run the phases in order**.

## Facts
- **Source**: Supabase Storage bucket `card-images` (PUBLIC). Objects reachable at
  `https://mquqwlxqrsvfflsgfhmi.supabase.co/storage/v1/object/public/card-images/<key>`.
  ~19,858 objects; keys: `cards/{id}.{ext}`, `one-piece/{slug}.png`, `dbfw/dotgg/{slug}.webp`,
  legacy `one-piece/{numeric}/...`. Ext: png/webp/jpg.
- **Dest**: R2 bucket `tcgmaster-card-images` (account `6e4d85e1…`), S3 endpoint
  `https://6e4d85e13fda8e813d504361e09b5643.r2.cloudflarestorage.com`. Custom domain
  `images.tcgmaster.com` **live** (SSL active). Image Transformations **enabled & verified**
  (real card 195 KB PNG → 4.7 KB AVIF via `/cdn-cgi/image`).
- **URL map**: `…/public/card-images/<key>` → `https://images.tcgmaster.com/<key>`.

## Credentials
- **R2 S3 keypair (dest)**: create an R2 API token (Dashboard → R2 → Manage R2 API Tokens →
  Object Read & Write on `tcgmaster-card-images`). The result page shows **Access Key ID** +
  **Secret Access Key** — use those two directly (do NOT hash the API token value).
- **Source needs NO Supabase key** — the bucket is public. Get the full key list from the DB
  (Supabase MCP) and fetch over HTTP (see Phase 2, option B).

## rclone remotes (env-only; nothing written to disk config)
```sh
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_ENDPOINT=https://6e4d85e13fda8e813d504361e09b5643.r2.cloudflarestorage.com \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_KEY" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET" \
  RCLONE_CONFIG_R2_REGION=auto
# Source A — Supabase S3 (if you have Supabase S3 keys):
export RCLONE_CONFIG_SB_TYPE=s3 RCLONE_CONFIG_SB_PROVIDER=Other \
  RCLONE_CONFIG_SB_ENDPOINT=https://mquqwlxqrsvfflsgfhmi.storage.supabase.co/storage/v1/s3 \
  RCLONE_CONFIG_SB_ACCESS_KEY_ID="$SB_KEY" RCLONE_CONFIG_SB_SECRET_ACCESS_KEY="$SB_SECRET" \
  RCLONE_CONFIG_SB_REGION=us-east-1
# Source B — public HTTP (no Supabase key); needs a keys.txt list of object keys:
export RCLONE_CONFIG_SBHTTP_TYPE=http \
  RCLONE_CONFIG_SBHTTP_URL=https://mquqwlxqrsvfflsgfhmi.supabase.co/storage/v1/object/public/card-images
```

---

## SAFE CUTOVER ORDER

### Phase 0 — Deploy the compatibility build FIRST (loader OFF)
Deploy the branch (grid fix + `images.tcgmaster.com` remotePattern + per-image loader code)
with **`NEXT_PUBLIC_IMAGE_CDN` UNSET**. Card images render exactly as today (`unoptimized`);
the added remotePattern lets deck-page built-in `<Image>`s accept `images.tcgmaster.com` so
the later DB rewrite can't 400 them. Nothing points at R2 yet.

### Phase 1 — Freeze image writers
Pause the Inngest image fetcher and do not run backfills/seeds for the window. Any object
written to Supabase after the copy but before the DB rewrite would get a rewritten R2 URL
pointing at a key that was never copied → hard 404.

### Phase 2 — Copy Supabase → R2 (Content-Type preserved)
```sh
# Option A (Supabase S3 source):
rclone copy SB:card-images R2:tcgmaster-card-images \
  --transfers 32 --checkers 64 --s3-no-check-bucket --fast-list --metadata -P
# Option B (public HTTP source; keys.txt = one object key per line, from the DB):
rclone copy SBHTTP: R2:tcgmaster-card-images --files-from keys.txt \
  --transfers 32 --checkers 64 --s3-no-check-bucket --metadata -P
```
`--metadata` is REQUIRED (rclone makes Content-Type preservation opt-in). Re-runnable.

### Phase 3 — Verify EXACTLY (not sampled)
```sh
rclone check SB:card-images R2:tcgmaster-card-images --size-only   # every key present
rclone size SB:card-images ; rclone size R2:tcgmaster-card-images  # counts/bytes match
# Content-Type across all objects (or every MIME/key class):
rclone lsjson R2:tcgmaster-card-images -R --no-modtime | \
  python3 -c "import sys,json;[print(o['Path'],o.get('Metadata',{}).get('content-type')) for o in json.load(sys.stdin)]" | \
  grep -viE 'image/(png|jpeg|webp)$' | head   # must be empty
# Edge preflight: a real key transforms 200 + image/avif:
curl -sI -H 'Accept: image/avif' \
  "https://images.tcgmaster.com/cdn-cgi/image/width=100,format=auto/cards/<sample-id>.png" | grep -i 'HTTP/\|content-type'
```

### Phase 4 — Purge Cloudflare negative cache
Purge cache for `images.tcgmaster.com` (Dashboard → Caching → Purge, or API) so any 404s
cached before the objects existed are cleared before the DB flips traffic there.

### Phase 5 — Reversible DB rewrite (GATED: dry-run + operator go)
```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS local_image_url_supabase varchar;
UPDATE cards SET local_image_url_supabase = local_image_url
 WHERE local_image_url LIKE 'https://mquqwlxqrsvfflsgfhmi.supabase.co/storage/v1/object/public/card-images/%'
   AND local_image_url_supabase IS NULL;

-- DRY-RUN count first:
SELECT count(*) FROM cards
 WHERE local_image_url LIKE 'https://mquqwlxqrsvfflsgfhmi.supabase.co/storage/v1/object/public/card-images/%';

UPDATE cards SET local_image_url = replace(
  local_image_url,
  'https://mquqwlxqrsvfflsgfhmi.supabase.co/storage/v1/object/public/card-images/',
  'https://images.tcgmaster.com/')
 WHERE local_image_url LIKE 'https://mquqwlxqrsvfflsgfhmi.supabase.co/storage/v1/object/public/card-images/%';
```

### Phase 6 — Turn the loader ON
Set `NEXT_PUBLIC_IMAGE_CDN=https://images.tcgmaster.com` as a Coolify **BUILD** variable
(Dockerfile passes it ARG→ENV before `npm run build`) and **rebuild/deploy**. A runtime-only
env will NOT flip the build-inlined loader. Card `<Image>`s now emit `/cdn-cgi/image/...`.

### Phase 7 — Live verify, then unfreeze
Browser-check grid + detail + search + marquee render from `images.tcgmaster.com`. Then repoint
the image WRITE path to R2 (below) and resume writers — or keep writers frozen until the
repoint ships.

### Caching
Set a Cloudflare **Cache Rule** on `images.tcgmaster.com`: Edge + Browser Cache TTL = long
(e.g. 30 days), **without `immutable`** — keys are stable (`upsert:true`), so an image
replacement must not be pinned for a year. Purge the specific key when an image is re-fetched.

---

## Rollback (SCOPED — never clobber post-cutover rows)
```sql
UPDATE cards SET local_image_url = local_image_url_supabase
 WHERE local_image_url LIKE 'https://images.tcgmaster.com/%'
   AND local_image_url_supabase LIKE 'https://mquqwlxqrsvfflsgfhmi.supabase.co/%';
```
Only reverts rows currently on R2 whose backup is a real Supabase URL; rows written fresh to
R2 after cutover (backup NULL / non-Supabase) are left alone. Images remain in Supabase (copy
is non-destructive); keep the `*.supabase.co` remotePattern + backup column during the window.
Unset the `NEXT_PUBLIC_IMAGE_CDN` build var and rebuild to revert delivery.

## Write path (repoint before decommissioning Supabase)
`lib/images/service.ts` (`downloadAndStoreImage`, `downloadAndStoreWithVariants`),
`scripts/backfill-images.ts`, `scripts/backfill-don-images.ts`, `scripts/seed-*.ts`, and
`inngest/functions/fetch-images.ts` still upload to Supabase Storage + set `local_image_url`.
Repoint them to write to R2 (S3 PUT to the R2 endpoint) and set the `images.tcgmaster.com` URL.
Until then, keep writers frozen or accept that new images land on Supabase (served via the
retained remotePattern) — do NOT delete the Supabase bucket until the repoint is live.
