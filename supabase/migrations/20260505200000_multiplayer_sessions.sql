
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  host_player_id text not null,
  guest_player_id text,
  host_nickname text not null default 'Commander',
  guest_nickname text,
  status text not null default 'waiting'
    check (status in ('waiting', 'placing', 'playing', 'finished')),
  game_mode text not null default '10min'
    check (game_mode in ('4min', '10min')),
  current_turn text not null default 'host'
    check (current_turn in ('host', 'guest')),
  winner text check (winner in ('host', 'guest', 'draw')),
  host_ships jsonb,
  guest_ships jsonb,
  host_shots jsonb not null default '{}',
  guest_shots jsonb not null default '{}',
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

-- Public read so guests can join via link
create policy "sessions_select_all" on public.game_sessions
  for select using (true);

-- Anyone can create a session
create policy "sessions_insert_all" on public.game_sessions
  for insert with check (true);

-- Anyone can update (turn enforcement is in application logic)
create policy "sessions_update_all" on public.game_sessions
  for update using (true);

-- Enable realtime for this table
alter publication supabase_realtime add table public.game_sessions;
