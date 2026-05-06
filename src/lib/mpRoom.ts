import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  allSunk, cellKey, fireAt,
  DEFAULT_FLEET, expandFleet,
  type BoardState, type PlacedShip, type FleetConfig,
} from "@/lib/game/types";
import type { GameMode } from "@/lib/multiplayer";
import { getOrCreatePlayerId, saveNickname } from "@/lib/multiplayer";

// Colors per player index (0-3)
export const PLAYER_COLORS = ["#3ad8ff", "#ff3b30", "#34d399", "#ffd84a"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export interface RoomPlayer {
  player_id: string;
  nickname: string;
  color: PlayerColor;
  ready: boolean;
  eliminated: boolean;
  slot: number; // 0-3
}

export interface MpRoom {
  id: string;
  created_at: string;
  host_player_id: string;
  status: "waiting" | "placing" | "playing" | "finished";
  game_mode: GameMode;
  grid_size: number;
  fleet_config: FleetConfig | null;
  max_players: number;
  players: RoomPlayer[];
  ships: Record<string, PlacedShip[]>; // keyed by player_id
  shots: Record<string, Record<string, Record<string, "hit" | "miss">>>; // [attacker][defender][cell]
  time_left: Record<string, number>; // keyed by player_id, ms
  turn_started_at: string | null;
  current_turn: string | null; // player_id
  winner: string | null; // player_id or "draw"
  started_at: string | null;
  ended_at: string | null;
}

export interface CreateRoomParams {
  mode: GameMode;
  maxPlayers: 2 | 3 | 4;
  fleet?: FleetConfig;
  gridSize?: number;
  nickname: string;
}

function initialTimeMs(mode: GameMode): number | null {
  if (mode === "infinite") return null;
  return mode === "4min" ? 4 * 60 * 1000 : 10 * 60 * 1000;
}

export async function createRoom(params: CreateRoomParams): Promise<MpRoom | null> {
  const playerId = getOrCreatePlayerId();
  saveNickname(params.nickname);

  const hostPlayer: RoomPlayer = {
    player_id: playerId,
    nickname: params.nickname || "Commander",
    color: PLAYER_COLORS[0],
    ready: false,
    eliminated: false,
    slot: 0,
  };

  const tMs = initialTimeMs(params.mode);
  const timeLeft: Record<string, number> = tMs !== null ? { [playerId]: tMs } : {};

  const { data, error } = await supabase
    .from("mp_rooms")
    .insert({
      host_player_id: playerId,
      status: "waiting",
      game_mode: params.mode,
      grid_size: params.gridSize ?? 10,
      fleet_config: params.fleet ?? null,
      max_players: params.maxPlayers,
      players: [hostPlayer],
      ships: {},
      shots: {},
      time_left: timeLeft,
    })
    .select()
    .single();

  if (error || !data) return null;
  return normalizeRoom(data);
}

export async function joinRoom(
  roomId: string,
  nickname: string,
): Promise<{ room: MpRoom | null; error?: string }> {
  const playerId = getOrCreatePlayerId();
  saveNickname(nickname);

  const { data, error } = await supabase.from("mp_rooms").select().eq("id", roomId).single();
  if (error || !data) return { room: null, error: "Room not found." };

  const room = normalizeRoom(data);

  // Already in room?
  const existing = room.players.find((p) => p.player_id === playerId);
  if (existing) return { room };

  if (room.status !== "waiting") return { room: null, error: "Game already started." };
  if (room.players.length >= room.max_players) return { room: null, error: "Room is full." };

  const slot = room.players.length;
  const newPlayer: RoomPlayer = {
    player_id: playerId,
    nickname: nickname || "Commander",
    color: PLAYER_COLORS[slot % PLAYER_COLORS.length],
    ready: false,
    eliminated: false,
    slot,
  };

  const tMs = initialTimeMs(room.game_mode);
  const newTimeLeft = { ...room.time_left };
  if (tMs !== null) newTimeLeft[playerId] = tMs;

  const newStatus = room.players.length + 1 >= room.max_players ? "placing" : "waiting";

  const { data: updated, error: err2 } = await supabase
    .from("mp_rooms")
    .update({
      players: [...room.players, newPlayer],
      time_left: newTimeLeft,
      status: newStatus,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (err2 || !updated) return { room: null, error: "Failed to join." };
  return { room: normalizeRoom(updated) };
}

export async function fetchRoom(roomId: string): Promise<MpRoom | null> {
  const { data, error } = await supabase.from("mp_rooms").select().eq("id", roomId).single();
  if (error || !data) return null;
  return normalizeRoom(data);
}

export async function submitRoomShips(roomId: string, playerId: string, ships: PlacedShip[]): Promise<void> {
  const room = await fetchRoom(roomId);
  if (!room) return;

  const newShips = { ...room.ships, [playerId]: ships };
  const newPlayers = room.players.map((p) =>
    p.player_id === playerId ? { ...p, ready: true } : p
  );

  const allReady = newPlayers.every((p) => p.ready);
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    ships: newShips,
    players: newPlayers,
  };

  if (allReady && room.status === "placing") {
    // Determine first player (host goes first)
    const firstPlayer = newPlayers[0].player_id;
    update.status = "playing";
    update.started_at = now;
    update.current_turn = firstPlayer;
    update.turn_started_at = now;
  }

  await supabase.from("mp_rooms").update(update).eq("id", roomId);
}

export interface RoomShotResult {
  outcome: "miss" | "hit" | "sunk";
  shipName?: string;
  targetEliminated?: boolean;
  gameOver?: boolean;
  winner?: string;
}

export async function fireRoomShot(
  room: MpRoom,
  attackerId: string,
  defenderId: string,
  x: number,
  y: number,
): Promise<RoomShotResult | null> {
  if (room.status !== "playing") return null;
  if (room.current_turn !== attackerId) return null;

  const defender = room.players.find((p) => p.player_id === defenderId);
  if (!defender || defender.eliminated) return null;

  const k = cellKey(x, y);
  const attackerShots = room.shots[attackerId]?.[defenderId] ?? {};
  if (attackerShots[k]) return null;

  const defenderShips = (room.ships[defenderId] ?? []).map((s) => ({ ...s }));
  const board: BoardState = { ships: defenderShips, shots: attackerShots };
  const { board: newBoard, outcome, ship } = fireAt(board, x, y);

  // Update shots
  const newShots = {
    ...room.shots,
    [attackerId]: {
      ...(room.shots[attackerId] ?? {}),
      [defenderId]: newBoard.shots,
    },
  };

  // Update ships
  const newShips = { ...room.ships, [defenderId]: newBoard.ships };

  // Chess clock
  const storedMs = room.time_left[attackerId] ?? null;
  const newTimeLeft = { ...room.time_left };
  if (storedMs !== null && room.turn_started_at) {
    const elapsed = Date.now() - new Date(room.turn_started_at).getTime();
    newTimeLeft[attackerId] = Math.max(0, storedMs - elapsed);
  }

  // Check defender eliminated
  const defenderEliminated = allSunk({ ships: newBoard.ships, shots: newBoard.shots });
  const newPlayers = room.players.map((p) =>
    p.player_id === defenderId ? { ...p, eliminated: defenderEliminated } : p
  );

  // Check game over (only 1 active player left)
  const activePlayers = newPlayers.filter((p) => !p.eliminated);
  const gameOver = activePlayers.length <= 1;
  const winnerId = gameOver ? (activePlayers[0]?.player_id ?? null) : null;

  // Determine next turn (skip eliminated)
  const now = new Date().toISOString();
  let nextTurn = room.current_turn;
  if (!gameOver && outcome === "miss") {
    nextTurn = getNextTurn(newPlayers, attackerId);
  }

  const update: Record<string, unknown> = {
    shots: newShots,
    ships: newShips,
    players: newPlayers,
    time_left: newTimeLeft,
    current_turn: nextTurn,
    turn_started_at: now,
  };

  if (gameOver) {
    update.status = "finished";
    update.winner = winnerId;
    update.ended_at = now;
  } else if (storedMs !== null && newTimeLeft[attackerId] <= 0) {
    // Attacker ran out of time → they're eliminated
    const timedOutPlayers = newPlayers.map((p) =>
      p.player_id === attackerId ? { ...p, eliminated: true } : p
    );
    const stillActive = timedOutPlayers.filter((p) => !p.eliminated);
    update.players = timedOutPlayers;
    if (stillActive.length <= 1) {
      update.status = "finished";
      update.winner = stillActive[0]?.player_id ?? "draw";
      update.ended_at = now;
    } else {
      update.current_turn = getNextTurn(timedOutPlayers, attackerId);
    }
  }

  await supabase.from("mp_rooms").update(update).eq("id", room.id);

  return {
    outcome,
    shipName: ship?.name,
    targetEliminated: defenderEliminated,
    gameOver,
    winner: winnerId ?? undefined,
  };
}

function getNextTurn(players: RoomPlayer[], currentId: string): string {
  const active = players.filter((p) => !p.eliminated);
  if (active.length === 0) return currentId;
  const idx = active.findIndex((p) => p.player_id === currentId);
  return active[(idx + 1) % active.length].player_id;
}

export async function endRoomByTimer(room: MpRoom): Promise<void> {
  // Most ships sunk across all opponents wins
  const scores: Record<string, number> = {};
  for (const p of room.players) {
    let sunk = 0;
    for (const defender of room.players) {
      if (defender.player_id === p.player_id) continue;
      const defShips = room.ships[defender.player_id] ?? [];
      const shots = room.shots[p.player_id]?.[defender.player_id] ?? {};
      const board: BoardState = { ships: defShips, shots };
      sunk += board.ships.filter((s) => s.hits >= s.size).length;
    }
    scores[p.player_id] = sunk;
  }
  const maxScore = Math.max(...Object.values(scores));
  const winners = Object.entries(scores).filter(([, v]) => v === maxScore).map(([k]) => k);
  const winner = winners.length === 1 ? winners[0] : "draw";
  await supabase.from("mp_rooms").update({
    status: "finished",
    winner,
    ended_at: new Date().toISOString(),
  }).eq("id", room.id);
}

export function getRoomChessClockRemaining(room: MpRoom, playerId: string): number | null {
  if (room.game_mode === "infinite") return null;
  const storedMs = room.time_left[playerId];
  if (storedMs === undefined || storedMs === null) return null;

  if (room.status !== "playing" || room.current_turn !== playerId || !room.turn_started_at) {
    return storedMs / 1000;
  }
  const elapsed = Date.now() - new Date(room.turn_started_at).getTime();
  return Math.max(0, (storedMs - elapsed) / 1000);
}

export function getRoomBoardForPlayer(room: MpRoom, playerId: string): BoardState {
  const myShips = room.ships[playerId] ?? [];
  const incomingShots: Record<string, "hit" | "miss"> = {};
  for (const other of room.players) {
    if (other.player_id === playerId) continue;
    const theirShotsAtMe = room.shots[other.player_id]?.[playerId] ?? {};
    for (const [k, v] of Object.entries(theirShotsAtMe)) {
      incomingShots[k] = v;
    }
  }
  return { ships: myShips, shots: incomingShots };
}

export function getRoomOpponentBoard(room: MpRoom, attackerId: string, defenderId: string): BoardState {
  const defShips = room.ships[defenderId] ?? [];
  const myShots = room.shots[attackerId]?.[defenderId] ?? {};
  return { ships: defShips, shots: myShots };
}

function normalizeRoom(raw: Record<string, unknown>): MpRoom {
  return {
    ...raw,
    players: (raw.players as RoomPlayer[]) ?? [],
    ships: (raw.ships as Record<string, PlacedShip[]>) ?? {},
    shots: (raw.shots as Record<string, Record<string, Record<string, "hit" | "miss">>>) ?? {},
    time_left: (raw.time_left as Record<string, number>) ?? {},
    grid_size: (raw.grid_size as number) ?? 10,
    fleet_config: (raw.fleet_config as FleetConfig | null) ?? null,
    max_players: (raw.max_players as number) ?? 2,
  } as MpRoom;
}

export function useMpRoom(roomId: string | null) {
  const [room, setRoom] = useState<MpRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    fetchRoom(roomId).then((r) => { setRoom(r); setLoading(false); });

    const channel = supabase
      .channel(`mp_room:${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "mp_rooms",
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        setRoom(normalizeRoom(payload.new as Record<string, unknown>));
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  return { room, loading };
}
