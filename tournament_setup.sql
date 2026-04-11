-- 1. Alter tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS format text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS phase text DEFAULT 'qualifier',
ADD COLUMN IF NOT EXISTS bracket_state jsonb DEFAULT '[]'::jsonb;

-- 2. Alter tournament_players table
ALTER TABLE tournament_players
ADD COLUMN IF NOT EXISTS is_eliminated boolean DEFAULT false;

-- 3. Modify increment_tournament_score RPC (if it restricts fields, ensure we support arbitrary score increments)
CREATE OR REPLACE FUNCTION increment_tournament_score(
    p_tournament_id uuid,
    p_user_id uuid,
    p_score int,
    p_won int,
    p_drew int
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE tournament_players
    SET score = score + p_score,
        wins = wins + p_won,
        draws = draws + p_drew
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id;
END;
$$;
