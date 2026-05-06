import { useEffect, useRef, useState } from "react";
import { GameBoard3D } from "./GameBoard3D";
import { CyberModal } from "./CyberModal";
import { SunkBanner } from "./SunkBanner";
import { PlacementBoard } from "./PlacementBoard";
import { sfx } from "@/lib/sound";
import { cellKey, expandFleet, DEFAULT_FLEET } from "@/lib/game/types";
import {
  type GameSession, type PlayerRole,
  getBoardForRole, getOpponentBoard, countSunk,
  getGameDuration, fireShot, endByTimeout, submitShips,
} from "@/lib/multiplayer";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  session: GameSession;
  role: PlayerRole;
}

function formatTime(secs: number): string {
  if (!isFinite(secs)) return "∞";
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MultiplayerScreen({ session, role }: Props) {
  const { user } = useAuth();
  const [sunk, setSunk] = useState<{ name: string; side: "enemy" | "player" } | null>(null);
  const [log, setLog] = useState<string[]>(["Connection established. Awaiting opponent."]);
  const [marks, setMarks] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(`marks_${session.id}`) ?? "{}"); }
    catch { return {}; }
  });
  const [showEndModal, setShowEndModal] = useState(true);
  // Chess clocks — each player's time ticks only on their turn
  const dur = getGameDuration(session.game_mode);
  const [myTime, setMyTime] = useState(dur);
  const [opTime, setOpTime] = useState(dur);
  const myTimeRef = useRef(dur);
  const opTimeRef = useRef(dur);
  const lastTickRef = useRef(Date.now());
  const timerEndedRef = useRef(false);
  const savedMatchRef = useRef(false);

  const myNick = role === "host" ? session.host_nickname : (session.guest_nickname ?? "Guest");
  const opNick = role === "host" ? (session.guest_nickname ?? "Opponent") : session.host_nickname;
  const fleet = expandFleet(session.fleet_config ?? DEFAULT_FLEET);
  const gridSize = session.grid_size ?? 10;
  const totalShips = fleet.length;

  function pushLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 8));
  }

  // Chess clock — only the active player's timer ticks; re-runs when turn changes
  useEffect(() => {
    if (session.status !== "playing" || !isFinite(dur)) return;
    timerEndedRef.current = false;
    lastTickRef.current = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (session.current_turn === role) {
        myTimeRef.current = Math.max(0, myTimeRef.current - elapsed);
        setMyTime(myTimeRef.current);
        if (myTimeRef.current <= 0 && !timerEndedRef.current) {
          timerEndedRef.current = true;
          clearInterval(tick);
          void endByTimeout(session, role);
        }
      } else {
        opTimeRef.current = Math.max(0, opTimeRef.current - elapsed);
        setOpTime(opTimeRef.current);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [session.status, session.current_turn, session.id]);

  // Persist marks to localStorage
  useEffect(() => {
    localStorage.setItem(`marks_${session.id}`, JSON.stringify(marks));
  }, [marks, session.id]);

  // Record match in stats when game finishes
  useEffect(() => {
    if (session.status !== "finished" || savedMatchRef.current || !user) return;
    savedMatchRef.current = true;
    const myShots = role === "host" ? session.host_shots : session.guest_shots;
    const opShips = (role === "host" ? session.guest_ships : session.host_ships) ?? [];
    const shipsDestroyed = (opShips as any[]).filter((s) => s.hits >= s.size).length;
    const duration = session.started_at
      ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      : 0;
    void supabase.from("matches").insert({
      user_id: user.id,
      result: session.winner === role ? "win" : "loss",
      difficulty: "player",
      ships_destroyed: shipsDestroyed,
      shots_fired: Object.keys(myShots).length,
      duration_seconds: duration,
    });
  }, [session.status, session.winner, user]);

  // Reset on new session
  useEffect(() => {
    setShowEndModal(true);
    savedMatchRef.current = false;
  }, [session.id]);

  // Update log when turn changes
  useEffect(() => {
    if (session.status !== "playing") return;
    const isMyTurn = session.current_turn === role;
    pushLog(isMyTurn ? "Your turn — fire!" : `${opNick}'s turn…`);
  }, [session.current_turn, session.status]);

  // Placement phase
  if (session.status === "waiting" || session.status === "placing") {
    const myReady = role === "host" ? session.host_ready : session.guest_ready;
    const opReady = role === "host" ? session.guest_ready : session.host_ready;
    const opJoined = !!session.guest_player_id;

    if (!opJoined) {
      return (
        <div className="h-[calc(100vh-80px)] flex items-center justify-center p-6">
          <div className="glass max-w-lg w-full p-8 text-center space-y-5">
            <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">Waiting for Opponent</h2>
            <p className="text-sm text-muted-foreground">Share this link with your friend:</p>
            <div className="input-cyber text-xs break-all select-all cursor-text">
              {typeof window !== "undefined" ? window.location.href : ""}
            </div>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span>Grid: {gridSize}×{gridSize}</span>
              <span>Mode: {session.game_mode === "infinite" ? "∞ Unlimited" : session.game_mode}</span>
              <span>Ships: {totalShips}</span>
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
      return (
        <div className="h-[calc(100vh-80px)] flex items-center justify-center p-6">
          <div className="glass max-w-md w-full p-8 text-center space-y-4">
            <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">Fleet Deployed</h2>
            <p className="text-sm text-muted-foreground">
              {opReady ? "Both fleets ready — starting battle…" : `Waiting for ${opNick} to place ships…`}
            </p>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
              <span>{myNick}: <span className="text-[var(--cyan)]">Ready</span></span>
              <span>{opNick}: <span className={opReady ? "text-[var(--cyan)]" : "text-muted-foreground"}>
                {opReady ? "Ready" : "Placing…"}
              </span></span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-80px)] p-4">
        <div className="mb-2 text-xs text-muted-foreground font-display uppercase tracking-widest">
          {opNick} has joined — place your fleet
        </div>
        <PlacementBoard
          fleet={fleet}
          boardSize={gridSize}
          onConfirm={async (ships) => {
            sfx.click();
            await submitShips(session.id, role, ships);
          }}
        />
      </div>
    );
  }

  // ── Playing / Finished ─────────────────────────────────────────────────

  const myBoard = getBoardForRole(session, role);
  const opBoardRaw = getOpponentBoard(session, role);
  const opBoard = { ...opBoardRaw, marks };
  const isMyTurn = session.current_turn === role;
  const mySunk = countSunk(session, role);
  const opSunkByMe = countSunk(session, role === "host" ? "guest" : "host");

  // Simple handleFire — no locking, pure Realtime drives state (PR #3 approach)
  async function handleFire(x: number, y: number) {
    if (!isMyTurn || session.status !== "playing") return;
    const k = cellKey(x, y);
    const myShots = role === "host" ? session.host_shots : session.guest_shots;
    if (myShots[k]) return;

    const result = await fireShot(session, role, x, y);
    if (!result) return;

    const coord = `${String.fromCharCode(65 + x)}${y + 1}`;
    if (result.outcome === "miss") { sfx.miss(); pushLog(`Miss at ${coord}`); }
    else if (result.outcome === "hit") { sfx.hit(); pushLog(`Hit at ${coord}`); }
    else if (result.outcome === "sunk" && result.shipName) {
      sfx.sunk();
      pushLog(`Enemy ${result.shipName} destroyed!`);
      setSunk({ name: result.shipName, side: "enemy" });
    }
    if (result.gameOver) sfx.win();
  }

  function toggleMark(x: number, y: number) {
    const k = cellKey(x, y);
    const myShots = role === "host" ? session.host_shots : session.guest_shots;
    if (myShots[k]) return;
    sfx.click();
    setMarks((m) => {
      const next = { ...m };
      if (next[k]) delete next[k];
      else next[k] = true;
      return next;
    });
  }

  const isOver = session.status === "finished";
  let winText = "";
  if (isOver) {
    if (session.winner === role) winText = "Victory";
    else if (session.winner === "draw") winText = "Draw";
    else winText = "Defeat";
  }

  const winVariant = session.winner === role ? "win" : session.winner === "draw" ? "info" : "lose";
  const winnerNick = session.winner === "host" ? session.host_nickname
    : session.winner === "guest" ? (session.guest_nickname ?? "Opponent") : null;
  const myTimeLow = isFinite(myTime) && myTime < 30;
  const opTimeLow = isFinite(opTime) && opTime < 30;

  return (
    <div className="h-[calc(100vh-80px)] p-4 grid grid-rows-[auto_1fr] gap-4">
      {/* HUD */}
      <div className="glass px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-display uppercase tracking-widest text-sm">
            Turn: <span className={isMyTurn ? "neon-cyan" : "neon-enemy"}>
              {isMyTurn ? "You" : opNick}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">vs <span className="text-foreground">{opNick}</span></span>
        </div>
        {session.status === "playing" && isFinite(dur) && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">{opNick}</div>
              <div className={`font-display text-sm tabular-nums ${opTimeLow ? "neon-enemy animate-pulse-glow" : "text-muted-foreground"}`}>
                ⏱ {formatTime(opTime)}
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">You</div>
              <div className={`font-display text-sm tabular-nums ${myTimeLow ? "neon-enemy animate-pulse-glow" : "neon-cyan"}`}>
                ⏱ {formatTime(myTime)}
              </div>
            </div>
          </div>
        )}
        {session.status === "playing" && !isFinite(dur) && (
          <span className="font-display text-sm text-muted-foreground">∞ Unlimited</span>
        )}
      </div>

      {/* Boards */}
      <div className="grid lg:grid-cols-[1fr_240px_1fr] gap-4 min-h-0">
        <section className="glass relative overflow-hidden min-h-[300px]">
          <div className="absolute top-3 left-3 z-10 font-display text-xs uppercase tracking-widest neon-cyan">
            {myNick} (You)
          </div>
          <GameBoard3D board={myBoard} isEnemy={false} revealShips boardSize={gridSize} />
        </section>

        <section className="glass p-4 flex flex-col">
          <h3 className="font-display uppercase tracking-widest text-xs neon-cyan mb-3">Comms</h3>
          <ul className="text-xs space-y-1.5 font-mono overflow-y-auto flex-1">
            {log.map((l, i) => (
              <li key={i} className="text-muted-foreground" style={{ opacity: 1 - i * 0.1 }}>› {l}</li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            <div>Enemy sunk: <span className="neon-enemy">{mySunk}/{totalShips}</span></div>
            <div>Your losses: <span className="neon-cyan">{opSunkByMe}/{totalShips}</span></div>
            <div className="pt-1 text-[10px] opacity-60">Right-click to mark cells</div>
          </div>
        </section>

        <section className="glass relative overflow-hidden min-h-[300px]">
          <div className="absolute top-3 left-3 z-10 font-display text-xs uppercase tracking-widest neon-enemy">
            {opNick}'s Waters
          </div>
          {isMyTurn && session.status === "playing" && (
            <div className="absolute top-3 right-3 z-10 font-mono text-[10px] text-muted-foreground">Click to fire</div>
          )}
          <GameBoard3D
            board={opBoard}
            isEnemy
            revealShips={isOver}
            boardSize={gridSize}
            onCellClick={handleFire}
            onCellRightClick={toggleMark}
          />
        </section>
      </div>

      <SunkBanner shipName={sunk?.name ?? null} side={sunk?.side ?? "enemy"} />

      <CyberModal
        open={isOver && showEndModal}
        variant={winVariant}
        title={winText}
        onClose={() => {}}
        actions={
          <>
            <button className="btn-cyber" onClick={() => setShowEndModal(false)}>View Boards</button>
            <a className="btn-cyber" href="/play">New Battle</a>
          </>
        }
      >
        {session.winner === "draw"
          ? "Both fleets equally battered. A strategic draw."
          : session.winner === role
            ? `${opNick}'s fleet annihilated. Command salutes you.`
            : `${winnerNick} prevails. Your fleet has fallen.`}
        <div className="mt-3 text-xs text-muted-foreground">
          Enemy ships sunk: {mySunk}/{totalShips} · Your losses: {opSunkByMe}/{totalShips}
        </div>
      </CyberModal>

      {isOver && !showEndModal && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass px-6 py-3 flex items-center gap-4">
          <span className="font-display text-sm uppercase tracking-widest" style={{ color: winVariant === "win" ? "var(--cyan)" : "var(--enemy)" }}>{winText}</span>
          <a className="btn-cyber text-xs" href="/play">New Battle</a>
        </div>
      )}
    </div>
  );
}
