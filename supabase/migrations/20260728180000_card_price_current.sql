-- WP8a: durable current price projection.  The scraper owns the source values;
-- the trigger keeps the legacy search-ranking mirror in sync.

CREATE TABLE IF NOT EXISTS card_price_current (
  card_id uuid PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  source_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  graded_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  headline_cents integer,
  headline_source text,
  headline_kind price_kind,
  headline_currency char(3),
  headline_grade text,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION mirror_headline_to_ttl()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE cards
  SET price_cache_ttl = NEW.headline_cents
  WHERE id = NEW.card_id
    AND price_cache_ttl IS DISTINCT FROM NEW.headline_cents;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mirror_headline_to_ttl ON card_price_current;
CREATE TRIGGER mirror_headline_to_ttl
AFTER INSERT OR UPDATE ON card_price_current
FOR EACH ROW EXECUTE FUNCTION mirror_headline_to_ttl();

ALTER TABLE card_price_current ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON card_price_current;
CREATE POLICY "Public read" ON card_price_current
  FOR SELECT TO anon, authenticated USING (TRUE);
