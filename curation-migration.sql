-- Add curation_status to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS curation_status text DEFAULT 'pending';

-- Optional: Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_cards_curation_status ON cards(curation_status);
