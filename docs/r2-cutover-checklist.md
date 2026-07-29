# R2 cutover — remaining steps (generated 2026-07-28)

Code side is complete on branch infra/r2-cutover; everything below is operator action.

### (a) What was missing

- Existing Supabase `local_image_url` values were never deterministically mapped to R2.
- The Cloudflare loader only transformed URLs already hosted on `images.tcgmaster.com`.
- Deck pages using built-in `<Image>` bypassed the custom loader.
- `next.config.ts`, Docker build ARG wiring, R2 writes, and backfill helpers already existed.
- No complete whole-bucket upload script exists; the backfill scripts only process rows with `local_image_url IS NULL`.

The new resolver maps:

`Supabase .../card-images/<key>` → `https://images.tcgmaster.com/<key>`

only when `NEXT_PUBLIC_IMAGE_CDN` is set. Otherwise, URLs remain unchanged.

### (b) Files changed

- [lib/images/cloudflare-loader.ts](/Users/amirariff/projects/tcgmaster-wt/r2/lib/images/cloudflare-loader.ts)
- [app/decks/page.tsx](/Users/amirariff/projects/tcgmaster-wt/r2/app/decks/page.tsx)
- [app/[game]/decks/page.tsx](</Users/amirariff/projects/tcgmaster-wt/r2/app/[game]/decks/page.tsx>)
- [app/[game]/decks/[id]/page.tsx](</Users/amirariff/projects/tcgmaster-wt/r2/app/[game]/decks/[id]/page.tsx>)
- [app/[game]/decks/archetype/[id]/page.tsx](</Users/amirariff/projects/tcgmaster-wt/r2/app/[game]/decks/archetype/[id]/page.tsx>)

`next.config.ts` already allows `images.tcgmaster.com`; no change was needed.

### (c) Operator checklist

1. Deploy this code once with `NEXT_PUBLIC_IMAGE_CDN` unset as the compatibility build.

2. Freeze image writers, including Inngest fetchers and seeds/backfills.

3. Copy the complete Supabase bucket to R2. Configure the rclone remotes using the runbook’s variable names:

   `RCLONE_CONFIG_R2_TYPE`, `RCLONE_CONFIG_R2_PROVIDER`, `RCLONE_CONFIG_R2_ENDPOINT`, `RCLONE_CONFIG_R2_ACCESS_KEY_ID`, `RCLONE_CONFIG_R2_SECRET_ACCESS_KEY`, `RCLONE_CONFIG_R2_REGION`

   Then run:

   ```sh
   rclone copy SB:card-images R2:tcgmaster-card-images \
     --transfers 32 --checkers 64 --s3-no-check-bucket --fast-list --metadata -P
   ```

   Public-HTTP alternative:

   ```sh
   rclone copy SBHTTP: R2:tcgmaster-card-images \
     --files-from keys.txt --transfers 32 --checkers 64 \
     --s3-no-check-bucket --metadata -P
   ```

4. Verify the copy completely:

   ```sh
   rclone check SB:card-images R2:tcgmaster-card-images --size-only
   rclone size SB:card-images
   rclone size R2:tcgmaster-card-images
   ```

5. Optional null-row backfills, only while writers are frozen:

   ```sh
   bun run scripts/backfill-images.ts
   bun run scripts/backfill-don-images.ts
   ```

   These require `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in the operator shell. They do not replace the full bucket copy.

6. Purge Cloudflare negative cache for `images.tcgmaster.com`.

7. In Coolify, set `NEXT_PUBLIC_IMAGE_CDN` as a **BUILD variable** on the web app, then rebuild and deploy:

   ```text
   NEXT_PUBLIC_IMAGE_CDN
   ```

   Runtime-only configuration will not enable the client loader.

8. Before unfreezing writers, configure runtime R2 variables wherever `lib/images/r2.ts` runs:

   ```text
   R2_ACCOUNT_ID
   R2_ACCESS_KEY_ID
   R2_SECRET_ACCESS_KEY
   R2_BUCKET   (optional; defaults to tcgmaster-card-images)
   ```

9. Verify in DevTools that requests use `images.tcgmaster.com`, especially paths like:

   ```text
   https://images.tcgmaster.com/cdn-cgi/image/width=320,.../cards/<key>.png
   ```

   Edge preflight:

   ```sh
   curl -sI -H 'Accept: image/avif' \
     'https://images.tcgmaster.com/cdn-cgi/image/width=100,format=auto/cards/<known-key>.png'
   ```

   Expect `200` and an image content type. Refresh representative grid, detail, search, collection, marquee, and deck pages. Clear or revalidate stale ISR pages if they still contain Supabase URLs.

10. Measure egress using equal pre/post windows in Supabase Storage billing/usage for `card-images`. Compare:

   `drop = pre-cutover egress - post-cutover egress`

   Cloudflare Analytics for `images.tcgmaster.com` should increase while Supabase Storage image egress falls sharply.

A database URL rewrite is no longer required for browser delivery because the resolver handles legacy URLs deterministically. It may still be performed later as optional data cleanup.

### (d) Risks

- Partial R2 copies produce deterministic 404s; the code intentionally does not perform per-image existence checks.
- Cached ISR HTML may still embed Supabase URLs until revalidated or purged.
- Writers must not resume with missing R2 credentials, or newly written Supabase objects may map to nonexistent R2 keys.
- Current card metadata does not define card-specific OG images; any future OG metadata using `local_image_url` should use the same resolver.
- Supabase remote access should remain allowed during rollback and the transition window.

