import { useEffect, useRef, useState } from "react";
import { GameBoard3D } from "./GameBoard3D";
import { CyberModal } from "./CyberModal";
import { SunkBanner } from "./SunkBanner";
import { PlacementBoard } from "./PlacementBoard";
import { sfx } from "@/lib/sound";
import { cellKey, expandFleet, DEFAULT_FLEET } from "@/lib/game/types";
import {
  type MpRoom, type RoomPlayer,
  PLAYER_COLORS,
  getRoomBoardForPlayer, getRoomOpponentBoard, getRoomChessClockRemaining,
  fireRoomShot, submitRoomShips, endRoomByTimer,
} from "@/lib/mpRoom";

interface Props {
  room: MpRoom;
  playerId: string;
}

function formatTime(secs: number | null): string {
  if (secs === null) return "∞";
  if (!isFinite(secs)) return "∞";
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MpRoomScreen({ room, playerId }: Props) {
  const [sunk, setSunk] = useState<{ name: string; side: "enemy" | "player" } | null>(null);
  const [log, setLog] = useState<string[]>(["Battle station active."]);
  const [marks, setMarks] = useState<Record<string, Record<string, boolean>>>(() => {
    try { return JSON.parse(localStorage.getItem(`room_marks_${room.id}`) ?? "{}"); }
    catch { return {}; }
  });
  const [clocks, setClocks] = useState<Record<string, number | null>>({});
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showEndModal, setShowEndModal] = useState(true);
  const timerEndedRef = useRef(false);

  const me = room.players.find((p) => p.player_id === playerId);
  const myNick = me?.nickname ?? "You";
  const myColor = me?.color ?? PLAYER_COLORS[0];
  const opponents = room.players.filter((p) => p.player_id !== playerId);
  const isMyTurn = room.current_turn === playerId;
  const isTimed = room.game_mode !== "infinite";
  const fleet = expandFleet(room.fleet_config ?? DEFAULT_FLEET);
  const gridSize = room.grid_size ?? 10;
  const totalShips = fleet.length;
  const activeOpponents = opponents.filter((p) => !p.eliminated);

  function pushLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 10));
  }

  // Auto-select first available target when it's my turn
  useEffect(() => {
    if (isMyTurn && (!selectedTarget || !activeOpponents.find((p) => p.player_id === selectedTarget))) {
      setSelectedTarget(activeOpponents[0]?.player_id ?? null);
    }
  }, [isMyTurn, room.players]);

  // Chess clocks
  useEffect(() => {
    if (room.status !== "playing" || !isTimed) {
      setClocks({});
      return;
    }
    timerEndedRef.current = false;

    const tick = setInterval(() => {
      const newClocks: Record<string, number | null> = {};
      for (const p of room.players) {
        newClocks[p.player_id] = getRoomChessClockRemaining(room, p.player_id);
      }
      setClocks(newClocks);

      // Detect active player timeout
      if (room.current_turn) {
        const myTime = getRoomChessClockRemaining(room, room.current_turn);
        if (myTime !== null && myTime <= 0 && !timerEndedRef.current) {
          timerEndedRef.current = true;
          clearInterval(tick);
          endRoomByTimer(room);
        }
      }
    }, 250);

    // Init clocks
    const initClocks: Record<string, number | null> = {};
    for (const p of room.players) initClocks[p.player_id] = getRoomChessClockRemaining(room, p.player_id);
    setClocks(initClocks);

    return () => clearInterval(tick);
  }, [room.status, room.current_turn, room.turn_started_at, room.game_mode]);

  // Persist marks to localStorage
  useEffect(() => {
    localStorage.setItem(`room_marks_${room.id}`, JSON.stringify(marks));
  }, [marks, room.id]);

  // Placement phase
  if (room.status === "waiting" || room.status === "placing") {
    const myPlayer = room.players.find((p) => p.player_id === playerId);
    const myReady = myPlayer?.ready ?? false;
    const allJoined = room.players.length >= room.max_players;

    if (!allJoined) {
      return (
        <div className="h-[calc(100vh-80px)] flex items-center justify-center p-6">
          <div className="glass max-w-lg w-full p-8 text-center space-y-5">
            <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">
              Waiting for Players ({room.players.length}/{room.max_players})
            </h2>
            <div className="flex flex-col gap-2">
              {room.players.map((p) => (
                <div key={p.player_id} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <span>{p.nickname}</span>
                  {p.player_id === room.host_player_id && <span className="text-xs text-muted-foreground">(host)</span>}
                </div>
              ))}
              {Array.from({ length: room.max_players - room.players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span>Waiting…</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Share this link:</p>
            <div className="input-cyber text-xs break-all select-all cursor-text">
              {typeof window !== "undefined" ? window.location.href : ""}
            </div>
            <button
              className="btn-cyber text-xs"
              onClick={() => { navigator.clipboard.writeText(window.location.href); sfx.click(); }}
            >
              Copy Link
            </button>
          </div>
        </div>
      );
    }

    if (myReady) {
      const readyCount = room.players.filter((p) => p.ready).length;
      return (
        <div className="h-[calc(100vh-80px)] flex items-center justify-center p-6">
          <div className="glass max-w-md w-full p-8 text-center space-y-4">
            <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">Fleet Deployed</h2>
            <p className="text-sm text-muted-foreground">
              {readyCount}/{room.max_players} players ready…
            </p>
            <div className="flex flex-col gap-2">
              {room.players.map((p) => (
                <div key={p.player_id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span>{p.nickname}</span>
                  </div>
                  <span style={{ color: p.ready ? p.color : undefined }} className={p.ready ? "" : "text-muted-foreground"}>
                    {p.ready ? "Ready" : "Placing…"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-80px)] p-4">
        <div className="mb-2 text-xs text-muted-foreground font-display uppercase tracking-widest">
          All players joined — place your fleet
        </div>
        <PlacementBoard
          fleet={expandFleet(room.fleet_config ?? DEFAULT_FLEET)}
          boardSize={gridSize}
          onConfirm={async (ships) => {
            sfx.click();
            await submitRoomShips(room.id, playerId, ships);
          }}
        />
      </div>
    );
  }

  // ── Playing / Finished ─────────────────────────────────────────────────

  const myBoard = getRoomBoardForPlayer(room, playerId);
  const isOver = room.status === "finished";
  const amEliminated = me?.eliminated ?? false;

  const currentTurnPlayer = room.players.find((p) => p.player_id === room.current_turn);

  async function handleFire(defenderId: string, x: number, y: number) {
    if (!isMyTurn || room.status !== "playing" || amEliminated) return;
    const defender = room.players.find((p) => p.player_id === defenderId);
    if (!defender || defender.eliminated) return;

    const k = cellKey(x, y);
    const myShots = room.shots[playerId]?.[defenderId] ?? {};
    if (myShots[k]) return;

    const result = await fireRoomShot(room, playerId, defenderId, x, y);
    if (!result) return;

    const coord = `${String.fromCharCode(65 + x)}${y + 1}`;
    if (result.outcome === "miss") {
      sfx.miss();
      pushLog(`Miss at ${defender.nickname} ${coord}`);
    } else if (result.outcome === "hit") {
      sfx.hit();
      pushLog(`Hit ${defender.nickname} at ${coord}`);
    } else if (result.outcome === "sunk" && result.shipName) {
      sfx.sunk();
      pushLog(`${defender.nickname}'s ${result.shipName} destroyed!`);
      setSunk({ name: result.shipName, side: "enemy" });
    }
    if (result.targetEliminated) pushLog(`${defender.nickname} eliminated!`);
    if (result.gameOver) sfx.win();
  }

  function toggleMark(defenderId: string, x: number, y: number) {
    const k = cellKey(x, y);
    const existingShot = room.shots[playerId]?.[defenderId]?.[k];
    if (existingShot) return;
    sfx.click();
    setMarks((m) => {
      const defMarks = { ...(m[defenderId] ?? {}) };
      if (defMarks[k]) delete defMarks[k];
      else defMarks[k] = true;
      return { ...m, [defenderId]: defMarks };
    });
  }

  const winnerPlayer = room.winner && room.winner !== "draw"
    ? room.players.find((p) => p.player_id === room.winner)
    : null;
  const isWinner = room.winner === playerId;
  const isDraw = room.winner === "draw";

  return (
    <div className="h-[calc(100vh-80px)] p-3 grid grid-rows-[auto_1fr] gap-3 overflow-hidden">
      {/* HUD */}
      <div className="glass px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display uppercase tracking-widest text-xs">
            Turn:{" "}
            <span style={{ color: currentTurnPlayer?.color ?? "inherit" }}>
              {room.current_turn === playerId ? "You" : (currentTurnPlayer?.nickname ?? "…")}
            </span>
          </span>
          {room.players.map((p) => (
            <div key={p.player_id} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: p.color, opacity: p.eliminated ? 0.3 : 1 }}
              />
              <span className="text-xs" style={{ color: p.color, opacity: p.eliminated ? 0.4 : 1 }}>
                {p.player_id === playerId ? "You" : p.nickname}
                {p.eliminated ? " ✗" : ""}
              </span>
            </div>
          ))}
        </div>

        {isTimed && (
          <div className="flex items-center gap-3">
            {room.players.map((p) => {
              const t = clocks[p.player_id] ?? null;
              const isActive = room.current_turn === p.player_id;
              const isLow = t !== null && t < 30 && isActive;
              return (
                <div key={p.player_id} className="text-center">
                  <div className="text-[9px] text-muted-foreground" style={{ color: p.color }}>{p.player_id === playerId ? "You" : p.nickname}</div>
                  <div
                    className={`font-display text-xs tabular-nums ${isLow ? "animate-pulse-glow" : ""}`}
                    style={{ color: isLow ? "#ff3b30" : p.color, opacity: p.eliminated ? 0.4 : 1 }}
                  >
                    ⏱ {formatTime(t)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main area */}
      <div
        className="grid gap-3 min-h-0"
        style={{ gridTemplateColumns: `1fr ${opponents.length > 0 ? "200px" : ""} ${opponents.map(() => "1fr").join(" ")}` }}
      >
        {/* My board */}
        <section className="glass relative overflow-hidden min-h-[200px]">
          <div className="absolute top-2 left-2 z-10 font-display text-xs uppercase tracking-widest" style={{ color: myColor }}>
            {myNick} (You)
            {amEliminated && <span className="ml-2 text-[var(--enemy)]">SUNK</span>}
          </div>
          <GameBoard3D
            board={myBoard}
            isEnemy={false}
            revealShips
            boardSize={gridSize}
            playerColor={myColor}
          />
        </section>

        {/* Comms + target selector */}
        <section className="glass p-3 flex flex-col gap-3 text-xs overflow-hidden">
          <h3 className="font-display uppercase tracking-widest text-xs neon-cyan">Comms</h3>
          <ul className="space-y-1 font-mono overflow-y-auto flex-1">
            {log.map((l, i) => (
              <li key={i} className="text-muted-foreground" style={{ opacity: 1 - i * 0.09 }}>› {l}</li>
            ))}
          </ul>
          {isMyTurn && !amEliminated && activeOpponents.length > 1 && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Target:</div>
              <div className="flex flex-col gap-1">
                {activeOpponents.map((p) => (
                  <button
                    key={p.player_id}
                    onClick={() => { sfx.click(); setSelectedTarget(p.player_id); }}
                    className={`px-2 py-1 rounded border text-xs font-display uppercase tracking-widest transition ${
                      selectedTarget === p.player_id ? "bg-white/10" : "border-border text-muted-foreground"
                    }`}
                    style={{
                      borderColor: selectedTarget === p.player_id ? p.color : undefined,
                      color: selectedTarget === p.player_id ? p.color : undefined,
                    }}
                  >
                    {p.nickname}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            {opponents.map((p) => {
              const myShots = room.shots[playerId]?.[p.player_id] ?? {};
              const theirShips = room.ships[p.player_id] ?? [];
              const sunkCount = theirShips.filter((s) => s.hits >= s.size).length;
              return (
                <div key={p.player_id}>
                  <span style={{ color: p.color }}>{p.nickname}</span>: {sunkCount}/{totalShips} sunk
                  {p.eliminated && " (eliminated)"}
                </div>
              );
            })}
          </div>
        </section>

        {/* Opponent boards */}
        {opponents.map((op) => {
          const opBoard = getRoomOpponentBoard(room, playerId, op.player_id);
          const opBoardWithMarks = { ...opBoard, marks: marks[op.player_id] ?? {} };
          const isTarget = selectedTarget === op.player_id;
          const canFire = isMyTurn && !amEliminated && !op.eliminated && room.status === "playing";

          return (
            <section
              key={op.player_id}
              className="glass relative overflow-hidden min-h-[200px] transition"
              style={{
                boxShadow: isTarget && canFire ? `0 0 20px ${op.color}66` : undefined,
                opacity: op.eliminated ? 0.4 : 1,
              }}
            >
              <div className="absolute top-2 left-2 z-10 font-display text-xs uppercase tracking-widest" style={{ color: op.color }}>
                {op.nickname}
                {op.eliminated && " — Eliminated"}
              </div>
              {canFire && isTarget && (
                <div className="absolute top-2 right-2 z-10 font-mono text-[10px] text-muted-foreground">Click to fire</div>
              )}
              {canFire && !isTarget && activeOpponents.length > 1 && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer bg-black/0 hover:bg-black/20 transition"
                  onClick={() => { sfx.click(); setSelectedTarget(op.player_id); }}
                >
                  <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Select Target</span>
                </div>
              )}
              <GameBoard3D
                board={opBoardWithMarks}
                isEnemy
                revealShips={isOver || op.eliminated}
                boardSize={gridSize}
                playerColor={op.color}
                onCellClick={canFire && isTarget ? (x, y) => handleFire(op.player_id, x, y) : undefined}
                onCellRightClick={(x, y) => toggleMark(op.player_id, x, y)}
              />
            </section>
          );
        })}
      </div>

      <SunkBanner shipName={sunk?.name ?? null} side={sunk?.side ?? "enemy"} />

      <CyberModal
        open={isOver && showEndModal}
        variant={isWinner ? "win" : isDraw ? "info" : "lose"}
        title={isWinner ? "Victory!" : isDraw ? "Draw" : "Defeated"}
        onClose={() => {}}
        actions={
          <>
            <button className="btn-cyber" onClick={() => setShowEndModal(false)}>View Boards</button>
            <a className="btn-cyber" href="/play">New Battle</a>
          </>
        }
      >
        {isDraw
          ? "All fleets equally battered. Strategic draw."
          : isWinner
            ? "Your fleet stands alone. Command salutes you."
            : `${winnerPlayer?.nickname ?? "Opponent"} prevails.`}
      </CyberModal>

      {isOver && !showEndModal && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass px-6 py-3 flex items-center gap-4">
          <span className="font-display text-sm uppercase tracking-widest" style={{ color: isWinner ? "var(--cyan)" : "var(--enemy)" }}>
            {isWinner ? "Victory" : isDraw ? "Draw" : "Defeated"}
          </span>
          <a className="btn-cyber text-xs" href="/play">New Battle</a>
        </div>
      )}
    </div>
  );
}
