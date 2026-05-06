-- Extend game_sessions with chess-clock, fleet config, and grid size
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS fleet_config jsonb,
  ADD COLUMN IF NOT EXISTS grid_size integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS host_time_left_ms integer,
  ADD COLUMN IF NOT EXISTS guest_time_left_ms integer,
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;

-- Multi-player rooms (3-4 players)
CREATE TABLE IF NOT EXISTS public.mp_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  host_player_id text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  game_mode text NOT NULL DEFAULT '10min',
  grid_size integer NOT NULL DEFAULT 10,
  fleet_config jsonb,
  max_players smallint NOT NULL DEFAULT 2,
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  ships jsonb NOT NULL DEFAULT '{}'::jsonb,
  shots jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_left jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn_started_at timestamptz,
  current_turn text,
  winner text,
  started_at timestamptz,
  ended_at timestamptz
);

ALTER TABLE public.mp_rooms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mp_rooms' AND policyname = 'allow_all_mp_rooms'
  ) THEN
    CREATE POLICY "allow_all_mp_rooms" ON public.mp_rooms
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add mp_rooms to realtime (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mp_rooms;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Global leaderboard (2-player games only)
CREATE TABLE IF NOT EXISTS public.leaderboard (
  player_id text PRIMARY KEY,
  nickname text NOT NULL,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  games integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard' AND policyname = 'allow_all_leaderboard'
  ) THEN
    CREATE POLICY "allow_all_leaderboard" ON public.leaderboard
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
