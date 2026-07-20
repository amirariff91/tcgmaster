-- Create tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  format TEXT NOT NULL,
  num_players INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL UNIQUE,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create decks table
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  placement TEXT NOT NULL,
  leader_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL UNIQUE,
  total_price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create deck_cards junction table
CREATE TABLE IF NOT EXISTS public.deck_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  raw_card_id_string TEXT NOT NULL, -- e.g. "OP05-119" from the source site if it fails to link
  raw_card_name TEXT, -- e.g. "Monkey D Luffy" if it fails to link
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_game_id ON public.tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON public.tournaments(date DESC);
CREATE INDEX IF NOT EXISTS idx_decks_tournament_id ON public.decks(tournament_id);
CREATE INDEX IF NOT EXISTS idx_decks_leader_card_id ON public.decks(leader_card_id);
CREATE INDEX IF NOT EXISTS idx_deck_cards_deck_id ON public.deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_cards_card_id ON public.deck_cards(card_id);

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Allow public read access on decks" ON public.decks FOR SELECT USING (true);
CREATE POLICY "Allow public read access on deck_cards" ON public.deck_cards FOR SELECT USING (true);

-- Create function to update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_tournaments_modtime
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decks_modtime
    BEFORE UPDATE ON public.decks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
