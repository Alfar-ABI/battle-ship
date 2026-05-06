
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_player_id TEXT NOT NULL,
  guest_player_id TEXT,
  host_nickname TEXT NOT NULL DEFAULT 'Commander',
  guest_nickname TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  game_mode TEXT NOT NULL DEFAULT '10min',
  current_turn TEXT NOT NULL DEFAULT 'host',
  winner TEXT,
  host_ships JSONB,
  guest_ships JSONB,
  host_shots JSONB NOT NULL DEFAULT '{}'::jsonb,
  guest_shots JSONB NOT NULL DEFAULT '{}'::jsonb,
  host_ready BOOLEAN NOT NULL DEFAULT false,
  guest_ready BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Link-based multiplayer: anyone with the session id can read & participate.
CREATE POLICY "sessions_select_all" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "sessions_insert_all" ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions_update_all" ON public.game_sessions FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
