import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  allSunk, cellKey, fireAt, shipCells, DEFAULT_FLEET,
  type BoardState, type PlacedShip, type FleetConfig,
} from "@/lib/game/types";

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
  host_time_left_ms: number | null;
  guest_time_left_ms: number | null;
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

/** Returns per-player time in ms, or null for infinite mode */
export function getGameDurationMs(mode: GameMode): number | null {
  if (mode === "infinite") return null;
  return mode === "4min" ? 4 * 60 * 1000 : 10 * 60 * 1000;
}

/** @deprecated Use getGameDurationMs */
export function getGameDuration(mode: GameMode): number {
  if (mode === "infinite") return Infinity;
  return mode === "4min" ? 240 : 600;
}

/**
 * Chess-clock: returns remaining seconds for a player.
 * Active player's clock ticks; inactive player's clock is frozen.
 * Returns null for infinite mode.
 */
export function getChessClockRemaining(session: GameSession, role: PlayerRole): number | null {
  const durationMs = getGameDurationMs(session.game_mode);
  if (durationMs === null) return null;

  const storedMs = role === "host" ? session.host_time_left_ms : session.guest_time_left_ms;
  if (storedMs === null || storedMs === undefined) return durationMs / 1000;

  // Only tick if it's this player's turn and game is playing
  if (session.status !== "playing" || session.current_turn !== role || !session.turn_started_at) {
    return storedMs / 1000;
  }

  const elapsed = Date.now() - new Date(session.turn_started_at).getTime();
  return Math.max(0, (storedMs - elapsed) / 1000);
}

export async function createSession(
  mode: GameMode,
  nickname: string,
  fleetConfig?: FleetConfig,
  gridSize = 10,
): Promise<GameSession | null> {
  const playerId = getOrCreatePlayerId();
  saveNickname(nickname);
  const durationMs = getGameDurationMs(mode);
  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      host_player_id: playerId,
      host_nickname: nickname || "Commander",
      game_mode: mode,
      status: "waiting",
      fleet_config: fleetConfig ?? null,
      grid_size: gridSize,
      host_time_left_ms: durationMs,
      guest_time_left_ms: durationMs,
    })
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
  await supabase.from("game_sessions").update({ [field]: ships, [readyField]: true }).eq("id", sessionId);
  const s = await fetchSession(sessionId);
  if (!s) return;
  const bothReady = (role === "host" ? true : s.host_ready) && (role === "guest" ? true : s.guest_ready);
  if (bothReady && s.status === "placing") {
    const now = new Date().toISOString();
    await supabase.from("game_sessions").update({
      status: "playing",
      started_at: now,
      turn_started_at: now,
    }).eq("id", sessionId);
  }
}

export type ShotResult = {
  outcome: "miss" | "hit" | "sunk";
  shipName?: string;
  gameOver?: boolean;
  winner?: PlayerRole | "draw";
  timedOut?: boolean;
};

export async function fireShot(
  session: GameSession,
  role: PlayerRole,
  x: number,
  y: number,
): Promise<ShotResult | null> {
  if (session.status !== "playing") return null;
  if (session.current_turn !== role) return null;

  const k = cellKey(x, y);
  const myShots = role === "host" ? { ...session.host_shots } : { ...session.guest_shots };
  if (myShots[k]) return null;

  const opponentShips = (role === "host" ? session.guest_ships : session.host_ships) ?? [];
  const opponentBoard: BoardState = { ships: opponentShips.map((s) => ({ ...s })), shots: myShots };
  const { board: newBoard, outcome, ship } = fireAt(opponentBoard, x, y);

  const shotsField = role === "host" ? "host_shots" : "guest_shots";
  const shipsField = role === "host" ? "guest_ships" : "host_ships";
  const timeField = role === "host" ? "host_time_left_ms" : "guest_time_left_ms";

  // Chess clock: reduce this player's time
  const storedMs = role === "host" ? session.host_time_left_ms : session.guest_time_left_ms;
  let newTimeMs: number | null = storedMs;
  if (storedMs !== null && session.turn_started_at) {
    const elapsed = Date.now() - new Date(session.turn_started_at).getTime();
    newTimeMs = Math.max(0, storedMs - elapsed);
  }

  const isGameOver = allSunk(newBoard);
  // On miss, pass turn; on hit/sunk, keep turn
  const nextTurn: PlayerRole = outcome === "miss" ? (role === "host" ? "guest" : "host") : role;

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    [shotsField]: newBoard.shots,
    [shipsField]: newBoard.ships,
    current_turn: nextTurn,
    turn_started_at: now,
    [timeField]: newTimeMs,
  };

  if (isGameOver) {
    updatePayload.status = "finished";
    updatePayload.winner = role;
    updatePayload.ended_at = now;
  } else if (newTimeMs !== null && newTimeMs <= 0) {
    // This player ran out of time → they lose
    const opponent: PlayerRole = role === "host" ? "guest" : "host";
    updatePayload.status = "finished";
    updatePayload.winner = opponent;
    updatePayload.ended_at = now;
  }

  await supabase.from("game_sessions").update(updatePayload).eq("id", session.id);

  // Update leaderboard if game ended
  if (updatePayload.status === "finished" && updatePayload.winner && updatePayload.winner !== "draw") {
    const winnerRole = updatePayload.winner as PlayerRole;
    const winnerId = winnerRole === "host" ? session.host_player_id : session.guest_player_id;
    const winnerNick = winnerRole === "host" ? session.host_nickname : (session.guest_nickname ?? "Commander");
    const loserId = winnerRole === "host" ? session.guest_player_id : session.host_player_id;
    const loserNick = winnerRole === "host" ? (session.guest_nickname ?? "Commander") : session.host_nickname;
    if (winnerId) void upsertLeaderboard(winnerId, winnerNick, "win");
    if (loserId) void upsertLeaderboard(loserId, loserNick, "loss");
  }

  return {
    outcome,
    shipName: ship?.name,
    gameOver: isGameOver,
    winner: isGameOver ? role : undefined,
  };
}

export async function endByTimer(session: GameSession): Promise<PlayerRole | "draw"> {
  const hostSunk = (session.guest_ships ?? []).filter((s) => s.hits >= s.size).length;
  const guestSunk = (session.host_ships ?? []).filter((s) => s.hits >= s.size).length;
  const winner: PlayerRole | "draw" = hostSunk > guestSunk ? "host" : guestSunk > hostSunk ? "guest" : "draw";
  const now = new Date().toISOString();
  await supabase
    .from("game_sessions")
    .update({ status: "finished", winner, ended_at: now })
    .eq("id", session.id);

  if (winner !== "draw") {
    const winnerId = winner === "host" ? session.host_player_id : session.guest_player_id;
    const winnerNick = winner === "host" ? session.host_nickname : (session.guest_nickname ?? "Commander");
    const loserId = winner === "host" ? session.guest_player_id : session.host_player_id;
    const loserNick = winner === "host" ? (session.guest_nickname ?? "Commander") : session.host_nickname;
    if (winnerId) void upsertLeaderboard(winnerId, winnerNick, "win");
    if (loserId) void upsertLeaderboard(loserId, loserNick, "loss");
  }

  return winner;
}

async function upsertLeaderboard(playerId: string, nickname: string, result: "win" | "loss") {
  const { data } = await supabase.from("leaderboard").select().eq("player_id", playerId).single();
  if (data) {
    await supabase.from("leaderboard").update({
      nickname,
      wins: (data.wins ?? 0) + (result === "win" ? 1 : 0),
      losses: (data.losses ?? 0) + (result === "loss" ? 1 : 0),
      games: (data.games ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("player_id", playerId);
  } else {
    await supabase.from("leaderboard").insert({
      player_id: playerId,
      nickname,
      wins: result === "win" ? 1 : 0,
      losses: result === "loss" ? 1 : 0,
      games: 1,
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
    host_time_left_ms: raw.host_time_left_ms as number | null ?? null,
    guest_time_left_ms: raw.guest_time_left_ms as number | null ?? null,
    turn_started_at: raw.turn_started_at as string | null ?? null,
  } as GameSession;
}

export function useGameSession(sessionId: string | null) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    fetchSession(sessionId).then((s) => { setSession(s); setLoading(false); });

    const channel = supabase
      .channel(`game_session:${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "game_sessions",
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(normalizeSession(payload.new as Record<string, unknown>));
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  return { session, loading };
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

export function countSunk(session: GameSession, attackerRole: PlayerRole): number {
  const ships = attackerRole === "host" ? session.guest_ships : session.host_ships;
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

// Re-export for backward compat
export { DEFAULT_FLEET };
export type { FleetConfig };
