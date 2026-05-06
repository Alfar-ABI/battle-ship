import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { allSunk, cellKey, fireAt, shipCells, type BoardState, type FleetConfig, type PlacedShip } from "@/lib/game/types";

export type GameMode = "4min" | "10min" | "infinite";
export type SessionStatus = "waiting" | "placing" | "playing" | "finished";
export type PlayerRole = "host" | "guest";

export interface GameSession {
  id: string;
  host_player_id: string;
  guest_player_id: string | null;
  host_nickname: string;
  guest_nickname: string | null;
  status: SessionStatus;
  game_mode: GameMode;
  current_turn: PlayerRole;
  winner: PlayerRole | "draw" | null;
  host_ships: PlacedShip[] | null;
  guest_ships: PlacedShip[] | null;
  host_shots: Record<string, "miss" | "hit">;
  guest_shots: Record<string, "miss" | "hit">;
  host_ready: boolean;
  guest_ready: boolean;
  fleet_config: FleetConfig | null;
  grid_size: number;
  host_time_left: number | null;
  guest_time_left: number | null;
  turn_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

const STORAGE_KEY = "mp_player_id";
const NICKNAME_KEY = "mp_nickname";

export function getOrCreatePlayerId(): string {
  if (typeof localStorage === "undefined") return crypto.randomUUID();
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(STORAGE_KEY, id); }
  return id;
}

export function getSavedNickname(): string {
  return (typeof localStorage !== "undefined" && localStorage.getItem(NICKNAME_KEY)) || "";
}

export function saveNickname(name: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(NICKNAME_KEY, name);
}

export function getGameDuration(mode: GameMode): number {
  if (mode === "4min") return 240;
  if (mode === "10min") return 600;
  return Infinity;
}

export function isTimedMode(mode: GameMode): boolean {
  return mode !== "infinite";
}

export function getActiveRemaining(session: GameSession): number {
  if (!isTimedMode(session.game_mode)) return Infinity;
  const role = session.current_turn;
  const stored = role === "host" ? session.host_time_left : session.guest_time_left;
  const base = stored ?? getGameDuration(session.game_mode);
  if (session.status !== "playing" || !session.turn_started_at) return base;
  const elapsed = (Date.now() - new Date(session.turn_started_at).getTime()) / 1000;
  return Math.max(0, base - elapsed);
}

export function getStoredRemaining(session: GameSession, role: PlayerRole): number {
  if (!isTimedMode(session.game_mode)) return Infinity;
  if (session.current_turn === role) return getActiveRemaining(session);
  return (role === "host" ? session.host_time_left : session.guest_time_left) ?? getGameDuration(session.game_mode);
}

export async function createSession(
  mode: GameMode,
  nickname: string,
  fleetConfig?: FleetConfig,
  gridSize = 10,
): Promise<GameSession | null> {
  const playerId = getOrCreatePlayerId();
  saveNickname(nickname);
  const initial = isTimedMode(mode) ? getGameDuration(mode) : null;
  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      host_player_id: playerId,
      host_nickname: nickname || "Commander",
      game_mode: mode,
      status: "waiting",
      fleet_config: (fleetConfig as unknown) ?? null,
      grid_size: gridSize,
      host_time_left: initial,
      guest_time_left: initial,
    } as never)
    .select()
    .single();
  if (error || !data) return null;
  return normalizeSession(data);
}

export async function joinSession(
  sessionId: string,
  nickname: string,
): Promise<{ session: GameSession | null; role: PlayerRole | null; error?: string }> {
  const playerId = getOrCreatePlayerId();
  saveNickname(nickname);

  const { data: existing, error: fetchErr } = await supabase
    .from("game_sessions")
    .select()
    .eq("id", sessionId)
    .single();

  if (fetchErr || !existing) return { session: null, role: null, error: "Session not found." };
  const s = normalizeSession(existing);

  if (s.host_player_id === playerId) return { session: s, role: "host" };
  if (s.guest_player_id === playerId) return { session: s, role: "guest" };
  if (s.status !== "waiting") return { session: null, role: null, error: "Game already started." };
  if (s.guest_player_id && s.guest_player_id !== playerId) return { session: null, role: null, error: "Game is full." };

  const { data: updated, error: updateErr } = await supabase
    .from("game_sessions")
    .update({ guest_player_id: playerId, guest_nickname: nickname || "Commander", status: "placing" })
    .eq("id", sessionId)
    .select()
    .single();

  if (updateErr || !updated) return { session: null, role: null, error: "Failed to join." };
  return { session: normalizeSession(updated), role: "guest" };
}

export async function fetchSession(sessionId: string): Promise<GameSession | null> {
  const { data, error } = await supabase.from("game_sessions").select().eq("id", sessionId).single();
  if (error || !data) return null;
  return normalizeSession(data);
}

export async function submitShips(sessionId: string, role: PlayerRole, ships: PlacedShip[]): Promise<void> {
  const field = role === "host" ? "host_ships" : "guest_ships";
  const readyField = role === "host" ? "host_ready" : "guest_ready";
  await supabase.from("game_sessions").update({ [field]: ships as unknown, [readyField]: true } as never).eq("id", sessionId);
  const s = await fetchSession(sessionId);
  if (!s) return;
  const bothReady = (role === "host" ? true : s.host_ready) && (role === "guest" ? true : s.guest_ready);
  if (bothReady && s.status === "placing") {
    const now = new Date().toISOString();
    await supabase.from("game_sessions").update({
      status: "playing",
      current_turn: "host" as PlayerRole,
      started_at: now,
      turn_started_at: now,
    } as never).eq("id", sessionId);
  }
}

export type ShotResult = { outcome: "miss" | "hit" | "sunk"; shipName?: string; gameOver?: boolean; winner?: PlayerRole | "draw" };

export async function fireShot(
  session: GameSession,
  role: PlayerRole,
  x: number,
  y: number,
): Promise<ShotResult | null> {
  if (session.status !== "playing") return null;
  if (session.current_turn !== role) return null;

  const opponentShips = (role === "host" ? session.guest_ships : session.host_ships) ?? [];
  const myShots = role === "host" ? { ...session.host_shots } : { ...session.guest_shots };
  const k = cellKey(x, y);
  if (myShots[k]) return null;

  const opponentBoard: BoardState = { ships: opponentShips.map((s) => ({ ...s })), shots: myShots };
  const { board: newBoard, outcome, ship } = fireAt(opponentBoard, x, y);

  const shotsField = role === "host" ? "host_shots" : "guest_shots";
  const shipsField = role === "host" ? "guest_ships" : "host_ships";

  const isGameOver = allSunk(newBoard);
  const nextTurn: PlayerRole = outcome === "miss" ? (role === "host" ? "guest" : "host") : role;

  let hostTL = session.host_time_left;
  let guestTL = session.guest_time_left;
  if (isTimedMode(session.game_mode) && session.turn_started_at) {
    const elapsed = (Date.now() - new Date(session.turn_started_at).getTime()) / 1000;
    if (role === "host") hostTL = Math.max(0, (hostTL ?? getGameDuration(session.game_mode)) - elapsed);
    else guestTL = Math.max(0, (guestTL ?? getGameDuration(session.game_mode)) - elapsed);
  }

  const updatePayload: Record<string, unknown> = {
    [shotsField]: newBoard.shots,
    [shipsField]: newBoard.ships,
    current_turn: nextTurn,
    turn_started_at: new Date().toISOString(),
    host_time_left: hostTL,
    guest_time_left: guestTL,
  };

  if (isGameOver) {
    updatePayload.status = "finished";
    updatePayload.winner = role;
    updatePayload.ended_at = new Date().toISOString();
  }

  await supabase.from("game_sessions").update(updatePayload as never).eq("id", session.id);

  return {
    outcome,
    shipName: ship?.name,
    gameOver: isGameOver,
    winner: isGameOver ? role : undefined,
  };
}

export async function endByTimeout(session: GameSession, loser: PlayerRole): Promise<PlayerRole> {
  const winner: PlayerRole = loser === "host" ? "guest" : "host";
  await supabase
    .from("game_sessions")
    .update({ status: "finished", winner, ended_at: new Date().toISOString() } as never)
    .eq("id", session.id);
  return winner;
}

export async function upsertLeaderboard(playerId: string, nickname: string, result: "win" | "loss", score = 0) {
  const { data } = await supabase.from("leaderboard").select().eq("player_id", playerId).single();
  if (data) {
    await supabase.from("leaderboard").update({
      nickname,
      wins: ((data as any).wins ?? 0) + (result === "win" ? 1 : 0),
      losses: ((data as any).losses ?? 0) + (result === "loss" ? 1 : 0),
      games: ((data as any).games ?? 0) + 1,
      score: ((data as any).score ?? 0) + score,
      updated_at: new Date().toISOString(),
    }).eq("player_id", playerId);
  } else {
    await supabase.from("leaderboard").insert({
      player_id: playerId,
      nickname,
      wins: result === "win" ? 1 : 0,
      losses: result === "loss" ? 1 : 0,
      games: 1,
      score,
    });
  }
}

function normalizeSession(raw: Record<string, unknown>): GameSession {
  return {
    ...raw,
    host_shots: (raw.host_shots as Record<string, "miss" | "hit">) ?? {},
    guest_shots: (raw.guest_shots as Record<string, "miss" | "hit">) ?? {},
    grid_size: (raw.grid_size as number) ?? 10,
    fleet_config: (raw.fleet_config as FleetConfig | null) ?? null,
  } as GameSession;
}

export function useGameSession(sessionId: string | null) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refetch = useRef(async () => {
    if (!sessionId) return;
    const s = await fetchSession(sessionId);
    if (s) setSession(s);
  });

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetchSession(sessionId).then((s) => { setSession(s); setLoading(false); });

    refetch.current = async () => {
      const s = await fetchSession(sessionId);
      if (s) setSession(s);
    };

    const channel = supabase
      .channel(`game_session:${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(normalizeSession(payload.new as Record<string, unknown>));
      })
      .subscribe();

    channelRef.current = channel;

    // Polling fallback in case Realtime misses updates
    const poll = setInterval(() => { void refetch.current(); }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [sessionId]);

  return { session, loading, refetch: refetch.current };
}

export function getBoardForRole(session: GameSession, role: PlayerRole): BoardState {
  const myShips = (role === "host" ? session.host_ships : session.guest_ships) ?? [];
  const opShots = role === "host" ? session.guest_shots : session.host_shots;
  return { ships: myShips, shots: opShots };
}

export function getOpponentBoard(session: GameSession, role: PlayerRole): BoardState {
  const opShips = (role === "host" ? session.guest_ships : session.host_ships) ?? [];
  const myShots = role === "host" ? session.host_shots : session.guest_shots;
  return { ships: opShips, shots: myShots };
}

export function countSunk(session: GameSession, role: PlayerRole): number {
  const ships = role === "host" ? session.guest_ships : session.host_ships;
  return (ships ?? []).filter((s) => s.hits >= s.size).length;
}

export function sunkCells(ships: PlacedShip[]): Set<string> {
  const out = new Set<string>();
  for (const ship of ships) {
    if (ship.hits >= ship.size) {
      for (const c of shipCells(ship)) out.add(cellKey(c.x, c.y));
    }
  }
  return out;
}
