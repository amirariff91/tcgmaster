-- =============================================================================
-- Dedup One Piece duplicate cards  (2026-07-22)   [hardened v2 after adversarial review]
-- Merge  one-piece-<code>  (LOSERS, set `one-piece-promo`, near-empty duplicates)
-- into   op-<code>         (WINNERS, proper sets, own all prices/images/trending).
--
-- Verified against live DB (project mquqwlxqrsvfflsgfhmi):
--   5249 one-piece-* rows (all in set one-piece-promo); 4571 match an op-* twin by
--   slug code (1:1, no collisions, same game, number_mismatches=0); 678 unmatched are
--   LEFT AS-IS. Losers hold 0 dependent rows in every FK table EXCEPT deck_cards (7).
--
-- SAFETY MODEL
--   * Section A commits reversible snapshots + an audit map (rebuilt fresh each run).
--   * Section B is ONE atomic DO block: it re-validates freshness/cardinality, locks
--     losers, DYNAMICALLY guards every FK referencing cards.id (so a CASCADE table can
--     never be missed), re-points deck_cards, then deletes — asserting exact counts and
--     RAISE-aborting (full rollback) on any drift.
--   * Must be executed as table owner / service role (cards has RLS; a restricted role
--     would silently match 0 rows and the delete-count assert would abort — fails safe).
--   * OPERATIONAL PRECONDITION: ensure the external importer is NOT running during
--     Section B (sub-second) to avoid a TOCTOU race on dependent rows.
-- =============================================================================


-- =============================================================================
-- SECTION A — SNAPSHOTS + AUDIT MAP  (committed; non-destructive)
-- =============================================================================

-- A0. Refuse to run if backups already exist (prevents silent stale/overwrite).
DO $$
BEGIN
  IF to_regclass('public.cards_dedup_backup_20260722') IS NOT NULL
     OR to_regclass('public.deck_cards_dedup_backup_20260722') IS NOT NULL
     OR to_regclass('public.dedup_premerge_totals_20260722') IS NOT NULL THEN
    RAISE EXCEPTION 'Backup tables already exist — rename/drop before re-running Section A';
  END IF;
END $$;

-- A1. Full backup of every one-piece-* row (matched + unmatched) for rollback.
CREATE TABLE cards_dedup_backup_20260722 AS
  SELECT * FROM cards WHERE slug LIKE 'one-piece-%';

-- A2. loser -> winner audit map (rebuilt fresh; enforces SAME GAME via set->game).
DROP TABLE IF EXISTS dedup_map_20260722;
CREATE TABLE dedup_map_20260722 AS
  SELECT l.id AS loser_id, l.slug AS loser_slug, l.set_id AS loser_set_id,
         w.id AS winner_id, w.slug AS winner_slug, w.set_id AS winner_set_id
  FROM cards l
  JOIN sets  ls ON l.set_id = ls.id
  JOIN cards w  ON w.slug LIKE 'op-%'
              AND lower(substring(w.slug from 4)) = lower(substring(l.slug from 11))
  JOIN sets  ws ON w.set_id = ws.id AND ws.game_id = ls.game_id   -- same game only
  WHERE l.slug LIKE 'one-piece-%';

-- A3. Snapshot the deck_cards rows that will be re-pointed.
CREATE TABLE deck_cards_dedup_backup_20260722 AS
  SELECT dc.* FROM deck_cards dc
  WHERE dc.card_id IN (SELECT loser_id FROM dedup_map_20260722);

-- A4. Capture pre-merge totals for post-verification (winner-owned data must be unchanged).
CREATE TABLE dedup_premerge_totals_20260722 AS
  SELECT (SELECT count(*) FROM cards WHERE slug LIKE 'op-%')        AS op_total,
         (SELECT count(*) FROM cards WHERE slug LIKE 'one-piece-%') AS onepiece_total,
         (SELECT count(*) FROM price_history)                       AS price_history_total,
         (SELECT count(*) FROM trending_scores)                     AS trending_total,
         (SELECT count(*) FROM price_cache)                         AS price_cache_total,
         (SELECT count(*) FROM deck_cards)                          AS deck_cards_total,
         now() AS captured_at;

-- A5. Verify snapshot (expect map=4571, cards_backup=5249, deck_backup=7, no dup loser/winner).
--   SELECT (SELECT count(*) FROM dedup_map_20260722)                                  AS map_rows,
--          (SELECT count(*) FROM cards_dedup_backup_20260722)                         AS cards_backup,
--          (SELECT count(*) FROM deck_cards_dedup_backup_20260722)                    AS deck_backup,
--          (SELECT count(*) FROM (SELECT loser_id  FROM dedup_map_20260722 GROUP BY loser_id  HAVING count(*)>1) x) AS dup_losers,
--          (SELECT count(*) FROM (SELECT winner_id FROM dedup_map_20260722 GROUP BY winner_id HAVING count(*)>1) y) AS dup_winners;


-- =============================================================================
-- SECTION B — MERGE  (ONE atomic DO block; aborts + rolls back on any drift)
-- =============================================================================
DO $$
DECLARE
  v_map int; v_dupL int; v_dupW int; v_stale int;
  v_dep bigint := 0; v_tmp bigint;
  v_expect_deck int; v_deck int; v_del int;
  r record;
BEGIN
  -- B1. Map freshness + cardinality (no loser->multi-winner, no shared winner).
  SELECT count(*) INTO v_map FROM dedup_map_20260722;
  IF v_map <> 4571 THEN RAISE EXCEPTION 'ABORT: map has % rows, expected 4571', v_map; END IF;

  SELECT count(*) INTO v_dupL FROM (SELECT loser_id  FROM dedup_map_20260722 GROUP BY loser_id  HAVING count(*)>1) a;
  SELECT count(*) INTO v_dupW FROM (SELECT winner_id FROM dedup_map_20260722 GROUP BY winner_id HAVING count(*)>1) b;
  IF v_dupL <> 0 OR v_dupW <> 0 THEN
    RAISE EXCEPTION 'ABORT: cardinality violation (dup_losers=%, dup_winners=%)', v_dupL, v_dupW;
  END IF;

  -- B2. Every mapped id still exists with the expected slug scheme (catch stale map).
  SELECT count(*) INTO v_stale FROM dedup_map_20260722 m
   WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.id=m.loser_id  AND c.slug LIKE 'one-piece-%')
      OR NOT EXISTS (SELECT 1 FROM cards c WHERE c.id=m.winner_id AND c.slug LIKE 'op-%');
  IF v_stale <> 0 THEN RAISE EXCEPTION 'ABORT: % stale/mismatched map rows', v_stale; END IF;

  -- B3. Lock the loser rows for the duration of the transaction.
  PERFORM 1 FROM cards WHERE id IN (SELECT loser_id FROM dedup_map_20260722) FOR UPDATE;

  -- B4. DYNAMIC dependency guard: sum loser-referencing rows across EVERY FK to cards.id
  --     (except deck_cards, which we re-point). Future-proof: if any new/omitted CASCADE
  --     table (e.g. price_history_ohlc) ever exists and holds loser rows, this aborts.
  FOR r IN
    SELECT DISTINCT tc.table_name AS t, kcu.column_name AS c
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
    WHERE tc.constraint_type='FOREIGN KEY'
      AND tc.table_schema='public'
      AND ccu.table_name='cards' AND ccu.column_name='id'
      AND NOT (tc.table_name='deck_cards' AND kcu.column_name='card_id')
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE %I IN (SELECT loser_id FROM dedup_map_20260722)',
      r.t, r.c) INTO v_tmp;
    v_dep := v_dep + v_tmp;
  END LOOP;
  IF v_dep <> 0 THEN
    RAISE EXCEPTION 'ABORT: losers hold % dependent rows (expected 0); use conflict-aware re-point', v_dep;
  END IF;

  -- B5. Re-point deck_cards loser -> winner; assert we moved exactly what we snapshotted.
  SELECT count(*) INTO v_expect_deck FROM deck_cards
   WHERE card_id IN (SELECT loser_id FROM dedup_map_20260722);
  UPDATE deck_cards dc SET card_id = m.winner_id
    FROM dedup_map_20260722 m WHERE dc.card_id = m.loser_id;
  GET DIAGNOSTICS v_deck = ROW_COUNT;
  IF v_deck <> v_expect_deck THEN
    RAISE EXCEPTION 'ABORT: deck_cards re-pointed % but expected %', v_deck, v_expect_deck;
  END IF;

  -- B6. Delete the matched losers; assert exact count.
  DELETE FROM cards WHERE id IN (SELECT loser_id FROM dedup_map_20260722);
  GET DIAGNOSTICS v_del = ROW_COUNT;
  IF v_del <> 4571 THEN
    RAISE EXCEPTION 'ABORT: deleted % losers, expected 4571', v_del;
  END IF;

  RAISE NOTICE 'MERGE OK: deck_cards re-pointed=%, losers deleted=%', v_deck, v_del;
END $$;


-- =============================================================================
-- SECTION C — POST-VERIFY  (winner-owned data unchanged; only losers gone)
-- =============================================================================
--   SELECT
--     (SELECT count(*) FROM cards WHERE slug LIKE 'op-%')        AS op_total_now,       -- expect 9335 (= pre)
--     (SELECT count(*) FROM cards WHERE slug LIKE 'one-piece-%') AS onepiece_now,       -- expect 678
--     (SELECT count(*) FROM price_history)                       AS price_history_now,  -- expect = pre
--     (SELECT count(*) FROM trending_scores)                     AS trending_now,       -- expect = pre
--     (SELECT count(*) FROM price_cache)                         AS price_cache_now,    -- expect = pre
--     t.*
--   FROM dedup_premerge_totals_20260722 t;


-- =============================================================================
-- SECTION D — ROLLBACK  (order fixed: re-insert cards BEFORE restoring deck_cards)
-- =============================================================================
-- BEGIN;
-- -- 1. Re-insert the deleted loser cards first (positional SELECT * matches the CTAS backup).
-- INSERT INTO cards
--   SELECT * FROM cards_dedup_backup_20260722
--   WHERE id IN (SELECT loser_id FROM dedup_map_20260722)
--   ON CONFLICT (id) DO NOTHING;
-- -- 2. Now restore deck_cards.card_id (loser ids exist again, so the FK check passes).
-- UPDATE deck_cards dc SET card_id = b.card_id
--   FROM deck_cards_dedup_backup_20260722 b WHERE dc.id = b.id;
-- COMMIT;
-- -- Drop backups only after the merge is confirmed good in prod:
-- --   DROP TABLE cards_dedup_backup_20260722, deck_cards_dedup_backup_20260722,
-- --              dedup_map_20260722, dedup_premerge_totals_20260722;
