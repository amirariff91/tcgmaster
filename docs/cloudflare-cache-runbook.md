# Cloudflare zone runbook — tcgmaster.com

Zone `9fed7d9dfdfbe82affbea2aabc136a2f`, account `6e4d85e13fda8e813d504361e09b5643`, **Free** plan.

The API token currently in use (`cfut_Xdpk…`) is **read-only** — it verifies and reads
analytics fine, but every `PATCH /settings/*` returns `9109 Unauthorized` and rulesets
cannot be written. Everything below needs a token with **Zone → Zone Settings → Edit**
and **Zone → Cache Rules → Edit**, or the dashboard.

## Why this matters

Measured before the app-side fix: cache hit ratio **1.6–3.8%** over five days on
~19k–41k requests/day. Cause was the app, not the edge — card pages served
`cache-control: private, no-store` with `cf-cache-status: DYNAMIC`.

That is fixed in code (see `perf: make card and set pages edge-cacheable`). A production
build now emits:

| route | before | after |
|---|---|---|
| `/[game]/[set]/[card]` | `private, no-store` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/[game]/[set]` | `private, no-store` | `s-maxage=3600, stale-while-revalidate=31532400` |

Cloudflare will only act on those headers once the app is redeployed. The steps below
then compound it.

---

## 1. Zone settings

```bash
export CF_TOKEN=<token with Zone Settings:Edit>
ZONE=9fed7d9dfdfbe82affbea2aabc136a2f

patch() {
  curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE/settings/$1" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    -d "{\"value\":$2}" | python3 -m json.tool | head -5
}

patch always_use_https '"on"'      # currently OFF
patch min_tls_version  '"1.2"'     # currently 1.0
patch early_hints      '"on"'      # currently OFF
patch browser_cache_ttl 0          # 0 = "Respect Existing Headers"; currently 14400 (4h)
```

`browser_cache_ttl` note: the R2 custom domain is unaffected — a live probe of
`images.tcgmaster.com` already returns the origin's `max-age=2592000` intact. The 4h
clamp only hits `tcgmaster.com`, where it would otherwise cap the immutable
`/_next/static/*` assets. Set it to *Respect Existing Headers*.

`tiered_caching` is read-only on Free (`editable: false`) — ignore it.

## 2. Cache Rules

There is currently **no** `http_request_cache_settings` ruleset on the zone at all —
only the managed WAF/DDoS ones. Create the entrypoint with all three rules:

```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_request_cache_settings/entrypoint" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{
  "rules": [
    {
      "description": "Immutable Next build assets",
      "expression": "(http.host eq \"tcgmaster.com\" and starts_with(http.request.uri.path, \"/_next/static/\"))",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": { "mode": "override_origin", "default": 31536000 },
        "browser_ttl": { "mode": "override_origin", "default": 31536000 }
      }
    },
    {
      "description": "R2 card images",
      "expression": "(http.host eq \"images.tcgmaster.com\")",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": { "mode": "respect_origin" },
        "browser_ttl": { "mode": "respect_origin" }
      }
    },
    {
      "description": "ISR catalog pages - honour s-maxage from Next",
      "expression": "(http.host eq \"tcgmaster.com\" and not starts_with(http.request.uri.path, \"/api/\") and not starts_with(http.request.uri.path, \"/collection\") and not starts_with(http.request.uri.path, \"/portfolio\") and not starts_with(http.request.uri.path, \"/alerts\") and not starts_with(http.request.uri.path, \"/settings\") and not starts_with(http.request.uri.path, \"/achievements\") and not starts_with(http.request.uri.path, \"/login\") and not starts_with(http.request.uri.path, \"/signup\") and not starts_with(http.request.uri.path, \"/auth\"))",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": { "mode": "respect_origin" },
        "browser_ttl": { "mode": "respect_origin" }
      }
    }
  ]
}' | python3 -m json.tool | head -20
```

Rule 3 deliberately excludes every authenticated surface. Ship it **after** the app
redeploy — before that, the pages still say `no-store` and the rule is a no-op at best.

## 3. Image Transformations — the real cap

Free tier allows **5,000 unique transformations/month** and rejects further variants with
**error 9422**. `image_resizing` is already `on`.

Fixed in code: `lib/images/cloudflare-loader.ts` now snaps widths to
**160 / 320 / 640 / 1280**, and `next.config.ts` narrows `deviceSizes`/`imageSizes` to
match. Verified — every one of Next's 16 candidate widths now collapses to 4 variants,
and the live page's `width=3840` request (for ~600px source art) caps at 1280.

Still worth watching: 15,342 cards × 4 = ~61k *potential* variants. Only viewed cards
mint a transformation, and current measured usage is low (~1–3/min), but there is no
alarm on it. Check monthly:

```bash
curl -s https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"query { viewer { zones(filter:{zoneTag:\"9fed7d9dfdfbe82affbea2aabc136a2f\"}) { imageResizingRequests1mGroups(limit:100, filter:{datetime_geq:\"2026-07-01T00:00:00Z\"}) { sum { requests } } } } }"}'
```

If it approaches the cap, buy the **Cloudflare Images** paid tier. Do **not** buy
Cloudflare Pro for this — Pro is a separate $20/mo zone subscription and **does not lift
the Images cap**.

## 4. Verify

```bash
# Card page: expect s-maxage + HIT on the second request (was private/no-store, DYNAMIC)
curl -sI https://tcgmaster.com/one-piece/op-550801/op-st01-001_p4-ja \
  | grep -iE 'cache-control|cf-cache-status'

# Transform widths: expect only 160/320/640/1280, never 3840
curl -s https://tcgmaster.com/one-piece/op-550801/op-st01-001_p4-ja \
  | grep -oE 'cdn-cgi/image/width=[0-9]+' | sort -u
```

Then re-check the zone hit ratio 24h later against the 1.6–3.8% baseline:

```bash
curl -s https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"query { viewer { zones(filter:{zoneTag:\"9fed7d9dfdfbe82affbea2aabc136a2f\"}) { httpRequests1dGroups(limit:7, orderBy:[date_DESC], filter:{date_geq:\"2026-07-20\"}) { dimensions { date } sum { requests cachedRequests } } } } }"}'
```

## 5. Coolify — unrelated but adjacent

App `tcgmaster-scrapers` (`wkbf6vskjg5jc51ahhkg5ucn`) runs with `limits_memory: 0`,
`limits_cpus: 0` and no healthcheck, so it reports `running:unknown`. It currently runs
4 PM2 workers from `main`. Set a memory limit and a healthcheck before adding more.
