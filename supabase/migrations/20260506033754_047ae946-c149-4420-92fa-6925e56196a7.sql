ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS fleet_config jsonb,
  ADD COLUMN IF NOT EXISTS host_time_left integer,
  ADD COLUMN IF NOT EXISTS guest_time_left integer,
  ADD COLUMN IF NOT EXISTS turn_started_at timestamp with time zone;