-- ============================================================
-- 🏆 CHESS OX — ULTIMATE MASTER DATABASE SCHEMA
-- ============================================================
-- This file contains the ENTIRE database architecture including:
-- Profiles, Wallets, Tournaments, Matches, Clans, Social, 
-- Reports, KYC, and all Atomic RPC Functions.
-- Date: May 13, 2026
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. PROFILES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  full_name       TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  player_id       TEXT UNIQUE,
  profile_image   TEXT DEFAULT '',
  iq_level        INTEGER DEFAULT 100,
  rank            TEXT DEFAULT 'Bronze' CHECK (rank IN ('Bronze','Copil','Silver','Gold','Platinum','Diamond','Kingdom','Grand Master')),
  kyc_status      TEXT DEFAULT 'not_verified' CHECK (kyc_status IN ('not_verified','pending','verified','approved','rejected')),
  kyc_verified    BOOLEAN DEFAULT FALSE,
  kyc_rejection_reason TEXT DEFAULT '',
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','blocked','banned')),
  is_admin        BOOLEAN DEFAULT FALSE,
  is_online       BOOLEAN DEFAULT FALSE,
  last_seen       TIMESTAMPTZ DEFAULT NOW(),
  total_matches   INTEGER DEFAULT 0,
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  draws           INTEGER DEFAULT 0,
  win_rate        NUMERIC DEFAULT 0,
  current_streak  INTEGER DEFAULT 0,
  best_streak     INTEGER DEFAULT 0,
  trophy_gold     INTEGER DEFAULT 0,
  trophy_silver   INTEGER DEFAULT 0,
  trophy_bronze   INTEGER DEFAULT 0,
  payout_details  JSONB DEFAULT '{}'::jsonb,
  settings        JSONB DEFAULT '{
    "theme": "dark",
    "highlight_moves": true,
    "legal_moves": true,
    "premoves": false,
    "result_animation": true,
    "language": "en",
    "chat_enabled": true,
    "notifications": {"match_found": true, "tournament": true, "friend_request": true},
    "privacy": {"visibility": "public", "online_status": true, "friend_requests": "everyone"},
    "challenge_mode": "auto_accept"
  }'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist for existing installations
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rank_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rank_check CHECK (rank IN ('Bronze','Copil','Silver','Gold','Platinum','Diamond','Kingdom','Grand Master'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trophy_gold INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trophy_silver INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trophy_bronze INTEGER DEFAULT 0;

-- ─── 2. WALLETS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance         NUMERIC DEFAULT 0 CHECK (balance >= 0),
  locked_balance  NUMERIC DEFAULT 0,
  total_deposit   NUMERIC DEFAULT 0,
  total_withdraw  NUMERIC DEFAULT 0,
  total_deposited NUMERIC DEFAULT 0, -- Legacy field
  total_withdrawn NUMERIC DEFAULT 0, -- Legacy field
  total_won       NUMERIC DEFAULT 0,
  total_spent     NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_balance NUMERIC DEFAULT 0;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_deposit NUMERIC DEFAULT 0;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_withdraw NUMERIC DEFAULT 0;

-- ─── 3. TRANSACTIONS & WITHDRAWALS ─────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('deposit','withdraw','tournament_entry','tournament_prize','refund')),
  amount               NUMERIC NOT NULL,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending','success','failed','cancelled','processing')),
  razorpay_order_id    TEXT DEFAULT '',
  razorpay_payment_id  TEXT DEFAULT '',
  reference_id         TEXT DEFAULT '',
  description          TEXT DEFAULT '',
  balance_after        NUMERIC DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Force update check constraints for existing tables
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','success','failed','cancelled','processing'));
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('deposit','withdraw','tournament_entry','tournament_prize','refund'));

CREATE TABLE IF NOT EXISTS withdraw_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount           NUMERIC NOT NULL CHECK (amount >= 30),
  gst_amount       NUMERIC DEFAULT 0,
  net_amount       NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','success')),
  upi_id           TEXT,
  admin_note       TEXT,
  rejection_reason TEXT DEFAULT '',
  processed_by     UUID REFERENCES profiles(id),
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Force update check constraints for existing tables
ALTER TABLE withdraw_requests DROP CONSTRAINT IF EXISTS withdraw_requests_status_check;
ALTER TABLE withdraw_requests ADD CONSTRAINT withdraw_requests_status_check CHECK (status IN ('pending','approved','rejected','completed','success'));

ALTER TABLE withdraw_requests ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE withdraw_requests ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE withdraw_requests ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0;
ALTER TABLE withdraw_requests ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- ─── 4. TOURNAMENTS & PLAYERS ──────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tr_id             TEXT UNIQUE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('free','paid')),
  format            TEXT DEFAULT 'standard' CHECK (format IN ('quick','battle','standard','knockout')),
  entry_fee         NUMERIC DEFAULT 0,
  timer_type        INTEGER NOT NULL CHECK (timer_type IN (1,3,5,10)),
  max_players       INTEGER DEFAULT 16,
  current_players   INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','full','live','starting','completed','cancelled')),
  phase             TEXT DEFAULT 'upcoming',
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  prize_pool        NUMERIC DEFAULT 0,
  prize_first       NUMERIC DEFAULT 0,
  prize_second      NUMERIC DEFAULT 0,
  prize_third       NUMERIC DEFAULT 0,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tournament_players (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score          NUMERIC DEFAULT 0,
  wins           INTEGER DEFAULT 0,
  losses         INTEGER DEFAULT 0,
  draws          INTEGER DEFAULT 0,
  rank           INTEGER DEFAULT 0,
  max_round      INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  joined_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS max_round INTEGER DEFAULT 0;

-- ─── 5. MATCHES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_type      TEXT NOT NULL CHECK (match_type IN ('random','friend','room','bot','tournament')),
  timer_type      INTEGER CHECK (timer_type IN (1,3,5,10)),
  tournament_id   UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  round           INTEGER DEFAULT 1,
  result          TEXT DEFAULT 'ongoing' CHECK (result IN ('player1_win','player2_win','draw','ongoing','cancelled')),
  winner_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  iq_change_p1    INTEGER DEFAULT 0,
  iq_change_p2    INTEGER DEFAULT 0,
  moves           JSONB DEFAULT '[]'::jsonb,
  fen             TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  room_id         TEXT,
  status          TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  bot_difficulty  INTEGER,
  bracket_index   INTEGER,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5.1 PUBLIC ROOMS (LOBBY SYSTEM) ──────────────────────────
CREATE TABLE IF NOT EXISTS public_rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code       TEXT UNIQUE NOT NULL,
  host_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timer_type      INTEGER NOT NULL CHECK (timer_type IN (1,3,5,10)),
  max_players     INTEGER DEFAULT 20,
  current_players INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULL', 'WAITING', 'MATCH_RUNNING', 'HOST_OFFLINE', 'CLOSED')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE TABLE IF NOT EXISTS public_room_players (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES public_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  queue_pos       INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'spectating', 'left')),
  UNIQUE(room_id, user_id)
);

-- ─── 6. CLANS SYSTEM ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT UNIQUE NOT NULL,
  tag           TEXT UNIQUE NOT NULL,
  description   TEXT DEFAULT '',
  leader_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_members INTEGER DEFAULT 1,
  total_wars    INTEGER DEFAULT 0,
  war_wins      INTEGER DEFAULT 0,
  war_points    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clan_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clan_id    UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member' CHECK (role IN ('leader','co_leader','member')),
  war_points INTEGER DEFAULT 0,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS clan_join_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clan_id      UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  sender_type  TEXT DEFAULT 'user' CHECK (sender_type IN ('user', 'clan')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clan_id, user_id)
);

-- ─── 7. SOCIAL & SUPPORT ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_challenges (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timer        INTEGER NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  data       JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'issue' CHECK (type IN ('issue', 'player')),
    reported_user TEXT,
    issue_type TEXT,
    priority TEXT DEFAULT 'Low',
    reason TEXT,
    description TEXT NOT NULL,
    screenshot_url TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored'))
);

CREATE TABLE IF NOT EXISTS feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rating INTEGER DEFAULT 5,
    message TEXT NOT NULL
);

-- ─── 8. ATOMIC RPC FUNCTIONS ──────────────────────────────

-- [A] Wallet: Credit Deposit
DROP FUNCTION IF EXISTS credit_wallet_deposit(UUID, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION credit_wallet_deposit(p_user_id UUID, p_amount NUMERIC, p_payment_id TEXT, p_order_id TEXT)
RETURNS JSON AS $$
DECLARE v_new_balance NUMERIC;
BEGIN
    IF EXISTS (SELECT 1 FROM transactions WHERE reference_id = p_payment_id AND status = 'success') THEN
        RETURN json_build_object('success', false, 'message', 'Already processed.');
    END IF;
    UPDATE wallets SET balance = balance + p_amount, total_deposit = total_deposit + p_amount, updated_at = NOW() WHERE user_id = p_user_id RETURNING balance INTO v_new_balance;
    UPDATE transactions SET status = 'success', reference_id = p_payment_id, amount = p_amount WHERE user_id = p_user_id AND (reference_id LIKE 'dep_init_%' OR razorpay_order_id = p_order_id) AND status = 'pending';
    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [B] Wallet: Lock for Withdraw
DROP FUNCTION IF EXISTS lock_wallet_withdraw(UUID, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION lock_wallet_withdraw(p_user_id UUID, p_amount NUMERIC, p_upi_id TEXT)
RETURNS JSON AS $$
DECLARE v_balance NUMERIC; v_new_balance NUMERIC; v_gst NUMERIC; v_net NUMERIC; v_req_id UUID;
BEGIN
    SELECT balance INTO v_balance FROM wallets WHERE user_id = p_user_id FOR UPDATE;
    IF v_balance < p_amount THEN RETURN json_build_object('success', false, 'message', 'Insufficient balance.'); END IF;
    
    v_gst := ROUND(p_amount * 0.18, 2);
    v_net := p_amount - v_gst;

    UPDATE wallets SET balance = balance - p_amount, locked_balance = locked_balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id RETURNING balance INTO v_new_balance;
    INSERT INTO withdraw_requests (user_id, amount, gst_amount, net_amount, upi_id, status) VALUES (p_user_id, p_amount, v_gst, v_net, p_upi_id, 'pending') RETURNING id INTO v_req_id;
    INSERT INTO transactions (user_id, type, amount, status, reference_id) VALUES (p_user_id, 'withdraw', p_amount, 'processing', v_req_id::TEXT);
    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [C] Wallet: Process Withdraw (Admin)
DROP FUNCTION IF EXISTS process_withdraw_atomic(UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION process_withdraw_atomic(p_request_id UUID, p_admin_id UUID, p_action TEXT, p_admin_note TEXT DEFAULT '')
RETURNS JSON AS $$
DECLARE v_user_id UUID; v_amount NUMERIC; v_new_balance NUMERIC; v_status TEXT;
BEGIN
    SELECT user_id, amount, status INTO v_user_id, v_amount, v_status FROM withdraw_requests WHERE id = p_request_id FOR UPDATE;
    IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'message', 'Not found.'); END IF;
    IF v_status != 'pending' THEN RETURN json_build_object('success', false, 'message', 'Already processed.'); END IF;
    IF p_action = 'approve' THEN
        UPDATE wallets SET locked_balance = locked_balance - v_amount, total_withdraw = total_withdraw + v_amount, updated_at = NOW() WHERE user_id = v_user_id RETURNING balance INTO v_new_balance;
        UPDATE withdraw_requests SET status = 'success', admin_note = p_admin_note, processed_by = p_admin_id, processed_at = NOW() WHERE id = p_request_id;
        UPDATE transactions SET status = 'success' WHERE user_id = v_user_id AND reference_id = p_request_id::TEXT;
    ELSE
        UPDATE wallets SET balance = balance + v_amount, locked_balance = locked_balance - v_amount, updated_at = NOW() WHERE user_id = v_user_id RETURNING balance INTO v_new_balance;
        UPDATE withdraw_requests SET status = 'rejected', admin_note = p_admin_note, processed_by = p_admin_id, processed_at = NOW() WHERE id = p_request_id;
        UPDATE transactions SET status = 'failed', description = 'Rejected: ' || p_admin_note WHERE user_id = v_user_id AND reference_id = p_request_id::TEXT;
    END IF;
    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [D] Tournament: Join Paid (Atomic)
DROP FUNCTION IF EXISTS join_paid_tournament_atomic(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION join_paid_tournament_atomic(p_tournament_id UUID, p_user_id UUID, p_fee NUMERIC)
RETURNS JSON AS $$
DECLARE v_bal NUMERIC; v_curr INT; v_max INT; v_new_bal NUMERIC; v_status TEXT;
BEGIN
    SELECT status, current_players, max_players INTO v_status, v_curr, v_max FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
    IF v_status != 'upcoming' THEN RETURN json_build_object('success', false, 'message', 'Closed.'); END IF;
    IF v_curr >= v_max THEN RETURN json_build_object('success', false, 'message', 'Full.'); END IF;
    IF EXISTS (SELECT 1 FROM tournament_players WHERE tournament_id = p_tournament_id AND user_id = p_user_id) THEN RETURN json_build_object('success', false, 'message', 'Already joined.'); END IF;
    SELECT balance INTO v_bal FROM wallets WHERE user_id = p_user_id FOR UPDATE;
    IF v_bal < p_fee THEN RETURN json_build_object('success', false, 'message', 'Low balance.'); END IF;
    UPDATE wallets SET balance = balance - p_fee, total_spent = total_spent + p_fee WHERE user_id = p_user_id RETURNING balance INTO v_new_bal;
    INSERT INTO tournament_players (tournament_id, user_id) VALUES (p_tournament_id, p_user_id);
    UPDATE tournaments SET current_players = current_players + 1 WHERE id = p_tournament_id;
    RETURN json_build_object('success', true, 'new_balance', v_new_bal, 'current_players', v_curr + 1);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [E] Tournament: Cancel & Refund
DROP FUNCTION IF EXISTS cancel_tournament_atomic(UUID, UUID);
CREATE OR REPLACE FUNCTION cancel_tournament_atomic(p_tournament_id UUID, p_admin_id UUID)
RETURNS JSON AS $$
DECLARE v_status TEXT; v_fee NUMERIC; v_type TEXT; v_player RECORD; v_refunded INT := 0;
BEGIN
    SELECT status, entry_fee, type INTO v_status, v_fee, v_type FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
    IF v_status IN ('cancelled', 'completed') THEN RETURN json_build_object('success', false, 'message', 'Cannot cancel.'); END IF;
    UPDATE tournaments SET status = 'cancelled', updated_at = NOW() WHERE id = p_tournament_id;
    IF v_type = 'paid' AND v_fee > 0 THEN
        FOR v_player IN SELECT user_id FROM tournament_players WHERE tournament_id = p_tournament_id LOOP
            UPDATE wallets SET balance = balance + v_fee WHERE user_id = v_player.user_id;
            INSERT INTO transactions (user_id, type, amount, status, description, reference_id) VALUES (v_player.user_id, 'refund', v_fee, 'success', 'Tournament Cancelled', p_tournament_id::TEXT);
            v_refunded := v_refunded + 1;
        END LOOP;
    END IF;
    RETURN json_build_object('success', true, 'refunds', v_refunded);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [F] Match: Process Result
DROP FUNCTION IF EXISTS process_match_result_atomic(UUID, INT, BOOLEAN, BOOLEAN, BOOLEAN);
CREATE OR REPLACE FUNCTION process_match_result_atomic(p_user_id UUID, p_iq_change INT, p_won BOOLEAN, p_lost BOOLEAN, p_drew BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET 
    iq_level = GREATEST(0, COALESCE(iq_level, 100) + p_iq_change),
    total_matches = COALESCE(total_matches, 0) + 1,
    wins = COALESCE(wins, 0) + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = COALESCE(losses, 0) + (CASE WHEN p_lost THEN 1 ELSE 0 END),
    draws = COALESCE(draws, 0) + (CASE WHEN p_drew THEN 1 ELSE 0 END),
    current_streak = (CASE WHEN p_won THEN COALESCE(current_streak, 0) + 1 ELSE 0 END),
    best_streak = GREATEST(COALESCE(best_streak, 0), (CASE WHEN p_won THEN COALESCE(current_streak, 0) + 1 ELSE 0 END)),
    win_rate = ROUND(((COALESCE(wins, 0) + (CASE WHEN p_won THEN 1 ELSE 0 END) + (0.5 * (COALESCE(draws, 0) + (CASE WHEN p_drew THEN 1 ELSE 0 END))))::NUMERIC / NULLIF(COALESCE(total_matches, 0) + 1, 0)) * 100),
    rank = (CASE 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 1500 THEN 'Grand Master' 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 1000 THEN 'Kingdom' 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 800 THEN 'Diamond' 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 600 THEN 'Platinum' 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 400 THEN 'Gold' 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 300 THEN 'Silver' 
      WHEN (COALESCE(iq_level, 100) + p_iq_change) >= 200 THEN 'Copil' 
      ELSE 'Bronze' 
    END)
  WHERE id = p_user_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [G] Clan: Update Member Count
CREATE OR REPLACE FUNCTION update_clan_member_count(p_clan_id UUID, p_delta INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE clans SET total_members = GREATEST(1, total_members + p_delta) WHERE id = p_clan_id;
END; $$ LANGUAGE plpgsql;

-- [H] Trophy: Increment
CREATE OR REPLACE FUNCTION increment_profile_trophy(p_user_id UUID, p_trophy_type TEXT)
RETURNS void AS $$
BEGIN
  IF p_trophy_type = 'trophy_gold' THEN UPDATE profiles SET trophy_gold = trophy_gold + 1 WHERE id = p_user_id;
  ELSIF p_trophy_type = 'trophy_silver' THEN UPDATE profiles SET trophy_silver = trophy_silver + 1 WHERE id = p_user_id;
  ELSIF p_trophy_type = 'trophy_bronze' THEN UPDATE profiles SET trophy_bronze = trophy_bronze + 1 WHERE id = p_user_id;
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [I] Arena: Update Player Stats
CREATE OR REPLACE FUNCTION update_arena_player_stats(
    p_tournament_id UUID,
    p_user_id UUID,
    p_points NUMERIC,
    p_win BOOLEAN,
    p_draw BOOLEAN,
    p_loss BOOLEAN
)
RETURNS void AS $$
BEGIN
    UPDATE tournament_players
    SET 
        score = score + p_points,
        wins = wins + (CASE WHEN p_win THEN 1 ELSE 0 END),
        draws = draws + (CASE WHEN p_draw THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN p_loss THEN 1 ELSE 0 END),
        matches_played = matches_played + 1
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [J] Tournament: Increment Players
CREATE OR REPLACE FUNCTION increment_tournament_players(p_tournament_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE tournaments SET current_players = current_players + 1 WHERE id = p_tournament_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [K] Public Room: Atomic Join
CREATE OR REPLACE FUNCTION join_public_room_atomic(
    p_room_id UUID,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_current INTEGER;
    v_max INTEGER;
    v_status TEXT;
    v_queue_pos INTEGER;
BEGIN
    SELECT current_players, max_players, status INTO v_current, v_max, v_status 
    FROM public_rooms WHERE id = p_room_id FOR UPDATE;

    IF v_status IN ('CLOSED', 'HOST_OFFLINE') THEN
        RETURN json_build_object('success', false, 'message', 'Room is no longer active.');
    END IF;

    IF v_current >= v_max THEN
        RETURN json_build_object('success', false, 'message', 'Room is full.');
    END IF;

    -- Check if already in room
    IF EXISTS (SELECT 1 FROM public_room_players WHERE room_id = p_room_id AND user_id = p_user_id) THEN
        RETURN json_build_object('success', true, 'message', 'Already in room.');
    END IF;

    -- Get next queue position
    SELECT COALESCE(MAX(queue_pos), 0) + 1 INTO v_queue_pos 
    FROM public_room_players WHERE room_id = p_room_id;

    INSERT INTO public_room_players (room_id, user_id, queue_pos) 
    VALUES (p_room_id, p_user_id, v_queue_pos);

    UPDATE public_rooms SET current_players = current_players + 1 WHERE id = p_room_id;

    RETURN json_build_object('success', true, 'queue_pos', v_queue_pos);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [L] Public Room: Atomic Leave
CREATE OR REPLACE FUNCTION leave_public_room_atomic(
    p_room_id UUID,
    p_user_id UUID
)
RETURNS JSON AS $$
BEGIN
    DELETE FROM public_room_players WHERE room_id = p_room_id AND user_id = p_user_id;
    
    IF FOUND THEN
        UPDATE public_rooms SET current_players = current_players - 1 WHERE id = p_room_id;
        
        -- Shift queue positions
        UPDATE public_room_players 
        SET queue_pos = queue_pos - 1 
        WHERE room_id = p_room_id AND queue_pos > (
            SELECT COALESCE(MAX(queue_pos), 0) FROM public_room_players WHERE room_id = p_room_id AND user_id = p_user_id
        );
        
        RETURN json_build_object('success', true);
    END IF;

    RETURN json_build_object('success', false, 'message', 'Player not found in room.');
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 9. TRIGGERS ──────────────────────────────────────────────

-- Auto-PlayerID
CREATE OR REPLACE FUNCTION generate_player_id() RETURNS TRIGGER AS $$
DECLARE seq_val INTEGER; BEGIN SELECT COUNT(*) + 1 INTO seq_val FROM profiles; NEW.player_id := 'PX-' || LPAD(seq_val::TEXT, 6, '0'); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_player_id ON profiles;
CREATE TRIGGER set_player_id BEFORE INSERT ON profiles FOR EACH ROW WHEN (NEW.player_id IS NULL) EXECUTE FUNCTION generate_player_id();

-- Auto-Wallet
CREATE OR REPLACE FUNCTION handle_new_user_wallet() RETURNS TRIGGER AS $$ BEGIN INSERT INTO wallets (user_id, balance) VALUES (NEW.id, 0); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION handle_new_user_wallet();

-- Notification Limiter
CREATE OR REPLACE FUNCTION limit_user_notifications() RETURNS TRIGGER AS $$ BEGIN DELETE FROM notifications WHERE id IN (SELECT id FROM notifications WHERE user_id = NEW.user_id ORDER BY created_at DESC OFFSET 10); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tr_limit_notifications ON notifications;
CREATE TRIGGER tr_limit_notifications AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION limit_user_notifications();

-- ─── 10. INDEXES & RLS ────────────────────────────────────────

-- Enable RLS for all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdraw_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Wallet Policies
DROP POLICY IF EXISTS "wallet_select" ON wallets;
CREATE POLICY "wallet_select" ON wallets FOR SELECT USING (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "txn_select" ON transactions;
CREATE POLICY "txn_select" ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Withdraw Requests Policies
DROP POLICY IF EXISTS "wr_select" ON withdraw_requests;
CREATE POLICY "wr_select" ON withdraw_requests FOR SELECT USING (auth.uid() = user_id);

-- Tournament Policies
DROP POLICY IF EXISTS "tournaments_read" ON tournaments;
CREATE POLICY "tournaments_read" ON tournaments FOR SELECT USING (true);
DROP POLICY IF EXISTS "tp_read" ON tournament_players;
CREATE POLICY "tp_read" ON tournament_players FOR SELECT USING (true);

-- Match Policies
DROP POLICY IF EXISTS "matches_read" ON matches;
CREATE POLICY "matches_read" ON matches FOR SELECT USING (true);

-- Social & Support Policies
DROP POLICY IF EXISTS "challenges_view" ON game_challenges;
CREATE POLICY "challenges_view" ON game_challenges FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
DROP POLICY IF EXISTS "notif_view" ON notifications;
CREATE POLICY "notif_view" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reports" ON reports;
CREATE POLICY "Users can insert their own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Users can insert feedback" ON feedbacks;
CREATE POLICY "Users can insert feedback" ON feedbacks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view feedback" ON feedbacks;
CREATE POLICY "Admins can view feedback" ON feedbacks FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Clan Policies
DROP POLICY IF EXISTS "clans_read" ON clans;
CREATE POLICY "clans_read" ON clans FOR SELECT USING (true);
DROP POLICY IF EXISTS "clan_members_read" ON clan_members;
CREATE POLICY "clan_members_read" ON clan_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "cjr_read" ON clan_join_requests;
CREATE POLICY "cjr_read" ON clan_join_requests FOR SELECT USING (true);

-- [L] Public Room Lobby System (Enterprise Grade)
CREATE TABLE IF NOT EXISTS public_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    timer_type INT DEFAULT 5,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, WAITING, MATCH_RUNNING, HOST_OFFLINE, CLOSED
    current_players INT DEFAULT 0,
    max_players INT DEFAULT 20,
    is_private BOOLEAN DEFAULT false,
    password_hash TEXT,
    region TEXT DEFAULT 'global',
    spectator_count INT DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    server_node TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration for missing columns (Public Rooms)
ALTER TABLE public_rooms ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public_rooms ADD COLUMN IF NOT EXISTS server_node TEXT;
ALTER TABLE public_rooms ADD COLUMN IF NOT EXISTS spectator_count INT DEFAULT 0;
ALTER TABLE public_rooms ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
ALTER TABLE public_rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public_rooms ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS public_room_players (
    room_id UUID REFERENCES public_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    queue_pos INT NOT NULL,
    status TEXT DEFAULT 'waiting', -- waiting, playing
    socket_id TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    device_id TEXT,
    ping_ms INT DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- Migration for missing columns (Enterprise stability)
ALTER TABLE public_room_players ADD COLUMN IF NOT EXISTS socket_id TEXT;
ALTER TABLE public_room_players ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public_room_players ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public_room_players ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- High Performance Indexes
CREATE INDEX IF NOT EXISTS idx_room_status ON public_rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON public_room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_queue_position ON public_room_players(room_id, queue_pos);

-- [L] Public Room: Atomic Join (Enterprise Grade)
CREATE OR REPLACE FUNCTION join_public_room_atomic(
    p_room_id UUID,
    p_user_id UUID,
    p_socket_id TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_guest_count INT;
    v_max INT;
    v_status TEXT;
    v_host_id UUID;
    v_queue_pos INT;
BEGIN
    -- Match Locking System (FOR UPDATE)
    SELECT host_id, max_players, status INTO v_host_id, v_max, v_status
    FROM public_rooms WHERE id = p_room_id FOR UPDATE;

    IF v_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Room not found.');
    END IF;

    IF v_status = 'CLOSED' OR v_status = 'HOST_OFFLINE' THEN
        RETURN json_build_object('success', false, 'message', 'Room is no longer active.');
    END IF;

    -- Host Exclusion: Host should never be in the queue table
    IF v_host_id = p_user_id THEN
        RETURN json_build_object('success', true, 'message', 'Host joined.');
    END IF;

    -- Source of Truth: Count actual players in table
    SELECT COUNT(*) INTO v_guest_count FROM public_room_players WHERE room_id = p_room_id;

    IF v_guest_count + 1 >= v_max THEN
        RETURN json_build_object('success', false, 'message', 'Room is full.');
    END IF;

    -- Check if already in room
    IF EXISTS (SELECT 1 FROM public_room_players WHERE room_id = p_room_id AND user_id = p_user_id) THEN
        UPDATE public_room_players 
        SET socket_id = p_socket_id, last_seen = NOW(), device_id = p_device_id
        WHERE room_id = p_room_id AND user_id = p_user_id;
        
        -- Sync current_players count for UI/Listing
        UPDATE public_rooms SET current_players = v_guest_count + 1 WHERE id = p_room_id;
        
        RETURN json_build_object('success', true, 'message', 'Reconnected to room.');
    END IF;

    -- Get next queue position (FIFO)
    SELECT COALESCE(MAX(queue_pos), 0) + 1 INTO v_queue_pos 
    FROM public_room_players WHERE room_id = p_room_id;

    INSERT INTO public_room_players (room_id, user_id, queue_pos, socket_id, device_id) 
    VALUES (p_room_id, p_user_id, v_queue_pos, p_socket_id, p_device_id);

    -- Sync total count (Host + All Guests)
    UPDATE public_rooms SET current_players = v_guest_count + 2, last_activity_at = NOW() WHERE id = p_room_id;

    RETURN json_build_object('success', true, 'queue_pos', v_queue_pos);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- [L] Public Room: Atomic Leave
CREATE OR REPLACE FUNCTION leave_public_room_atomic(
    p_room_id UUID,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_queue_pos INT;
BEGIN
    SELECT queue_pos INTO v_queue_pos FROM public_room_players WHERE room_id = p_room_id AND user_id = p_user_id;
    
    DELETE FROM public_room_players WHERE room_id = p_room_id AND user_id = p_user_id;
    
    IF FOUND THEN
        UPDATE public_rooms SET current_players = current_players - 1, last_activity_at = NOW() WHERE id = p_room_id;
        
        -- Shift queue positions (FIFO fairness)
        UPDATE public_room_players 
        SET queue_pos = queue_pos - 1 
        WHERE room_id = p_room_id AND queue_pos > v_queue_pos;
    END IF;

    RETURN json_build_object('success', true);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'CHESS OX ULTIMATE MASTER SCHEMA COMPILED! 🏁' AS status;
