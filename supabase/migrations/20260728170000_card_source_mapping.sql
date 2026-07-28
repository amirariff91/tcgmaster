-- WP7a: persisted cross-platform identity (docs/price-architecture-review.md §2).
-- Resolution stops happening inside pricing: the resolver writes here once per
-- (card, source); pricers only ever fetch by a stored anchor.

CREATE TYPE mapping_confidence AS ENUM ('confirmed', 'derived', 'rejected');

CREATE TABLE card_source_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source price_source NOT NULL,
  external_id text,
  external_url text,
  external_title text,
  external_set text,
  confidence mapping_confidence NOT NULL,
  matched_by text NOT NULL CHECK (matched_by IN ('dictionary', 'product-id', 'number-token', 'url', 'manual')),
  evidence jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, source),
  -- 'rejected' is knowledge ("this source does not list this card") and needs no
  -- anchor; anything the pricer may act on must have one.
  CONSTRAINT anchor_required
    CHECK (confidence = 'rejected' OR external_id IS NOT NULL OR external_url IS NOT NULL)
);
CREATE INDEX ON card_source_mapping (source, confidence);
CREATE INDEX ON card_source_mapping (source, verified_at);

-- No policies deliberately: service-role/postgres only (same posture as price_quarantine).
ALTER TABLE card_source_mapping ENABLE ROW LEVEL SECURITY;

-- Qualifier taxonomy as data, not regex (review §2 open question 1). A row is
-- acceptable for a base card only when every bracketed qualifier on it means
-- base_printing; unknown qualifiers fail toward "no mapping".
CREATE TABLE source_qualifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL,          -- card slug prefix: 'op' | 'dbfw'
  source price_source NOT NULL,
  qualifier text NOT NULL,     -- lowercased, as printed by the source
  means text NOT NULL CHECK (means IN ('base_printing', 'distinct_printing')),
  UNIQUE (game, source, qualifier)
);
ALTER TABLE source_qualifiers ENABLE ROW LEVEL SECURITY;

INSERT INTO source_qualifiers (game, source, qualifier, means) VALUES
  ('op',   'pricecharting', 'sp gold',         'distinct_printing'),
  ('op',   'pricecharting', 'manga',           'distinct_printing'),
  ('op',   'pricecharting', 'wanted',          'distinct_printing'),
  ('op',   'pricecharting', 'parallel',        'distinct_printing'),
  ('op',   'pricecharting', '2nd anniversary', 'distinct_printing'),
  ('dbfw', 'pricecharting', 'holo',            'base_printing');
