-- SELECT count(DISTINCT ph.card_id), count(*) FROM price_history ph JOIN cards c ON c.id = ph.card_id WHERE ph.source = 'pricecharting' AND c.number ~ '[_-][PpRr][0-9]+$' AND ph.recorded_at < '2026-07-27T09:00:00Z';

-- Variant guard deployed 2026-07-27T09:00Z stopped PriceCharting matching suffixed variant cards; rows written before that for suffixed cards are wrong-product matches (an earlier purge ran before the deploy, so a gap window re-poisoned ~124 cards).

UPDATE cards
SET last_price_fetch = NULL
WHERE id IN (
  SELECT c.id
  FROM cards c
  JOIN price_history ph ON ph.card_id = c.id
  WHERE ph.source = 'pricecharting'
    AND c.number ~ '[_-][PpRr][0-9]+$'
    AND ph.recorded_at < '2026-07-27T09:00:00Z'
);

DELETE FROM price_history ph
USING cards c
WHERE c.id = ph.card_id
  AND ph.source = 'pricecharting'
  AND c.number ~ '[_-][PpRr][0-9]+$'
  AND ph.recorded_at < '2026-07-27T09:00:00Z';
