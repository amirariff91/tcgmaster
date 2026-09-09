# Task 5 kickoff prompt — Supabase Storage decommission (saved copy — paste into a
# fresh Claude Code session ONLY after a healthy R2 window; add tokens where marked)

tcgmaster: decommission the Supabase Storage `card-images` bucket now that card images
are served from Cloudflare R2 + paid transforms via images.tcgmaster.com (live since
2026-07-28 ~11:50Z, deployed with NEXT_PUBLIC_IMAGE_CDN baked in). The R2 copy was
verified complete 15,024/15,024 objects / ~3.0 GiB on 2026-07-28; the Supabase bucket
has been kept purely as rollback. This session deletes the bucket's OBJECTS (keep the
empty bucket) after verifying preconditions. This is destructive and gated — PAUSE for
explicit user approval before any deletion.

Supabase project: mquqwlxqrsvfflsgfhmi (use the Supabase MCP; DB read-only here — the
bucket work goes through the Storage API with the service key from .env.local).
Coolify API token (only needed if a rollback deploy is required): <PASTE TOKEN>

## Read first
1. feature-research/price-overhaul/progress.md — "R2 CUTOVER LIVE" + "Post-overhaul
   follow-up sweep" sections (context, object counts, what was verified when).
2. Memory file coolify-deploy.md if a deploy becomes necessary (deploy apps SERIALLY).

## Preconditions — verify ALL, show evidence, and STOP if any fails
1. **Egress window**: ask the user to confirm the Supabase dashboard shows Storage
   egress ~zero for at least several consecutive days since 2026-07-28. (Claude cannot
   see the usage dashboard — this is the user's call. Do not proceed on "probably".)
2. **CDN carrying traffic**: user confirms Cloudflare analytics for images.tcgmaster.com
   show the image traffic. Also probe: a sampled R2 object URL returns 200 image/*, and
   the transform endpoint returns 200 (AVIF/WebP), not 429 (ERROR 9422 = transforms
   quota problem — abort if it reappears).
3. **No fresh renders reference Supabase Storage**: curl the live HTML of home, a set
   page, a card detail page, and /decks; grep for `supabase.co/storage` — must be 0
   hits everywhere, and images.tcgmaster.com refs present. Note ISR: stale prerendered
   pages may still hold old URLs until revalidation; if any hit is found, check whether
   it's a stale ISR page (re-request with cache busting / revalidate) before concluding.
4. **No code writers**: `grep -rn "card-images" app lib scripts inngest --include='*.ts*'`
   — confirm no upload/write path targets the Supabase bucket (writers have been quiet
   since 2026-07-22; verify that's still true in code, not just history).
5. **Object inventory**: list the bucket via the Storage API (service key,
   /storage/v1/object/list/card-images, paginated — the public endpoint cannot list
   dirs, expected 400 there). Record the exact object count. Expect ~15,024; a LARGER
   count means something wrote after the R2 copy → STOP, diff keys against R2, copy the
   delta to R2 first (rclone, same method as the cutover), and only then continue.

## Execution (after the PAUSE)
1. Present the user: object count, total size, verification evidence summary, the
   rollback statement below — then PAUSE for explicit approval of the deletion
   (AskUserQuestion). No approval, no deletion.
2. Delete objects in batches via the Storage API (service key; batch remove ~100 keys
   per call, log progress every ~1k). KEEP the empty bucket itself (rollback target and
   avoids breaking any dangling bucket references).
3. Verify: bucket object count = 0; live pages still 200 with images loading from
   images.tcgmaster.com; R2 sampled object still 200; no new Sentry/log noise.
4. Update feature-research/price-overhaul/progress.md with counts, timestamps, and the
   before/after evidence.

## Rollback
Re-copy from R2 back into the bucket: R2 still holds all 15,024 objects; the cutover
session's method was rclone with a keys list (--files-from, --no-traverse). Site keeps
working on R2 the whole time regardless — rollback is only needed if the user decides
to return to Supabase-served images (would also need the NEXT_PUBLIC_IMAGE_CDN build
flag removed + web redeploy via Coolify, serially).

## Known accepted states (do NOT "fix")
- Supabase Storage egress won't be exactly zero (dashboard/API pings are fine); the
  bar is "no meaningful image-serving traffic".
- The empty `card-images` bucket stays.
- Plain-R2 serving AND transforms both being 200 was verified 2026-07-28; transforms
  are a paid account-level feature (images_v2_stream_bundle_basic).

## Token hygiene (if the user hasn't done it yet, prompt them BEFORE starting)
- Rotate the Cloudflare API token exposed in July transcripts; swap Coolify R2 env to
  a bucket-scoped R2 token.
- Rotate the Coolify API token used in the 2026-07-28 sessions.
