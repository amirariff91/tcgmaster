CREATE TABLE price_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source price_source NOT NULL,
  grade varchar(10) NOT NULL DEFAULT 'raw',
  price numeric(12,2) NOT NULL,
  price_native numeric(12,2),
  currency char(3),
  price_kind price_kind,
  reason text NOT NULL CHECK (reason IN ('number-mismatch','language-mismatch','title-drift','ratio-vs-median','no-evidence','sold-out')),
  evidence jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text CHECK (resolution IN ('released','discarded'))
);
CREATE INDEX ON price_quarantine (card_id, resolved_at);
CREATE INDEX ON price_quarantine (reason, observed_at);
