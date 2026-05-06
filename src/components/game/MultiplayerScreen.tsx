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
  getActiveRemaining, getStoredRemaining, isTimedMode,
  fireShot, endByTimeout, submitShips,
} from "@/lib/multiplayer";

interface Props {
  session: GameSession;
  role: PlayerRole;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MultiplayerScreen({ session, role }: Props) {
  const [sunk, setSunk] = useState<{ name: string; side: "enemy" | "player" } | null>(null);
  const [log, setLog] = useState<string[]>(["Connection established. Awaiting opponent."]);
  const [timeLeft, setTimeLeft] = useState(getGameDuration(session.game_mode));
  const timerEndedRef = useRef(false);

  const myNick = role === "host" ? session.host_nickname : (session.guest_nickname ?? "Guest");
  const opNick = role === "host" ? (session.guest_nickname ?? "Opponent") : session.host_nickname;

  function pushLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 8));
  }

  // Timer countdown when game is playing
  useEffect(() => {
    if (session.status !== "playing" || !session.started_at) return;
    timerEndedRef.current = false;
    const tick = setInterval(() => {
      const remaining = getRemainingSeconds(session);
      setTimeLeft(remaining);
      if (remaining <= 0 && !timerEndedRef.current) {
        timerEndedRef.current = true;
        clearInterval(tick);
        endByTimer(session);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [session.status, session.started_at, session.id]);

  // Update log when turn changes
  useEffect(() => {
    if (session.status !== "playing") return;
    const isMyTurn = session.current_turn === role;
    pushLog(isMyTurn ? "Your turn — fire!" : `${opNick}'s turn…`);
  }, [session.current_turn, session.status]);

  // Banner when both are in placing phase
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
        <PlacementBoard onConfirm={async (ships) => {
          sfx.click();
          await submitShips(session.id, role, ships);
        }} />
      </div>
    );
  }

  // ── Playing / Finished ───────────────────────────────────────────────────

  const myBoard = getBoardForRole(session, role);
  const opBoard = getOpponentBoard(session, role);
  const isMyTurn = session.current_turn === role;
  const mySunk = countSunk(session, role);
  const opSunkByMe = countSunk(session, role === "host" ? "guest" : "host");

  async function handleFire(x: number, y: number) {
    if (!isMyTurn || session.status !== "playing") return;
    const k = cellKey(x, y);
    const myShots = role === "host" ? session.host_shots : session.guest_shots;
    if (myShots[k]) return;

    const result = await fireShot(session, role, x, y);
    if (!result) return;

    if (result.outcome === "miss") { sfx.miss(); pushLog(`Miss at ${String.fromCharCode(65 + x)}${y + 1}`); }
    else if (result.outcome === "hit") { sfx.hit(); pushLog(`Hit at ${String.fromCharCode(65 + x)}${y + 1}`); }
    else if (result.outcome === "sunk" && result.shipName) {
      sfx.sunk();
      pushLog(`Enemy ${result.shipName} destroyed!`);
      setSunk({ name: result.shipName, side: "enemy" });
    }
    if (result.gameOver) sfx.win();
  }

  function toggleMark(x: number, y: number) {
    sfx.click();
  }

  const isOver = session.status === "finished";
  let winText = "";
  if (isOver) {
    if (session.winner === role) winText = "Victory";
    else if (session.winner === "draw") winText = "Draw";
    else winText = "Defeat";
  }

  const winVariant = session.winner === role ? "win" : session.winner === "draw" ? "info" : "lose";
  const winnerNick = session.winner === "host" ? session.host_nickname : session.winner === "guest" ? (session.guest_nickname ?? "Opponent") : null;

  return (
    <div className="h-[calc(100vh-80px)] p-4 grid grid-rows-[auto_1fr] gap-4">
      {/* HUD */}
      <div className="glass px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="font-display uppercase tracking-widest text-sm">
            Turn: <span className={isMyTurn ? "neon-cyan" : "neon-enemy"}>
              {isMyTurn ? "You" : opNick}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            vs <span className="text-foreground">{opNick}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {session.status === "playing" && (
            <span className={`font-display text-sm tabular-nums ${timeLeft < 30 ? "neon-enemy animate-pulse-glow" : "neon-cyan"}`}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Boards */}
      <div className="grid lg:grid-cols-[1fr_260px_1fr] gap-4 min-h-0">
        {/* My board */}
        <section className="glass relative overflow-hidden min-h-[300px]">
          <div className="absolute top-3 left-3 z-10 font-display text-xs uppercase tracking-widest neon-cyan">
            {myNick} (You)
          </div>
          <GameBoard3D board={myBoard} isEnemy={false} revealShips />
        </section>

        {/* Comms */}
        <section className="glass p-4 flex flex-col">
          <h3 className="font-display uppercase tracking-widest text-xs neon-cyan mb-3">Comms</h3>
          <ul className="text-xs space-y-1.5 font-mono overflow-y-auto flex-1">
            {log.map((l, i) => (
              <li key={i} className="text-muted-foreground" style={{ opacity: 1 - i * 0.1 }}>› {l}</li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
            <div>Enemy sunk: <span className="neon-enemy">{mySunk}/5</span></div>
            <div>Your losses: <span className="neon-cyan">{opSunkByMe}/5</span></div>
          </div>
        </section>

        {/* Opponent board */}
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
            onCellClick={handleFire}
            onCellRightClick={toggleMark}
          />
        </section>
      </div>

      <SunkBanner shipName={sunk?.name ?? null} side={sunk?.side ?? "enemy"} />

      <CyberModal
        open={isOver}
        variant={winVariant}
        title={winText}
        onClose={() => {}}
        actions={
          <a className="btn-cyber" href="/play">New Battle</a>
        }
      >
        {session.winner === "draw"
          ? "Both fleets equally battered. A strategic draw."
          : session.winner === role
            ? `${opNick}'s fleet annihilated. Command salutes you.`
            : `${winnerNick} prevails. Your fleet has fallen.`}
        <div className="mt-3 text-xs text-muted-foreground">
          Enemy ships sunk: {mySunk}/5 · Your losses: {opSunkByMe}/5
        </div>
      </CyberModal>
    </div>
  );
}
