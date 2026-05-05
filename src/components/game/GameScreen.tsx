import { useEffect, useRef, useState } from "react";
import { GameBoard3D } from "./GameBoard3D";
import { CyberModal } from "./CyberModal";
import { PlacementBoard } from "./PlacementBoard";
import {
  type BoardState, type PlacedShip, autoPlace, allSunk, fireAt, cellKey,
} from "@/lib/game/types";
import { aiMove, aiPostShot, createAI, type Difficulty } from "@/lib/game/ai";
import { sfx } from "@/lib/sound";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Phase = "setup" | "playing" | "over";

export function GameScreen() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [player, setPlayer] = useState<BoardState>({ ships: [], shots: {} });
  const [enemy, setEnemy] = useState<BoardState>({ ships: [], shots: {} });
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [log, setLog] = useState<string[]>([]);
  const [modal, setModal] = useState<{
    variant: "info" | "win" | "lose" | "danger" | "sunk"; title: string; body?: string;
  } | null>(null);
  const [shotsFired, setShotsFired] = useState(0);
  const startTime = useRef<number>(0);
  const aiMem = useRef(createAI());
  const savedRef = useRef(false);

  function startMatch(ships: PlacedShip[]) {
    setPlayer({ ships: ships.map((s) => ({ ...s, hits: 0 })), shots: {} });
    setEnemy({ ships: autoPlace(), shots: {} });
    setLog(["Battle commenced. Awaiting fire command."]);
    setShotsFired(0);
    setTurn("player");
    aiMem.current = createAI();
    savedRef.current = false;
    startTime.current = Date.now();
    setPhase("playing");
  }

  function pushLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 8));
  }

  async function recordMatch(result: "win" | "loss") {
    if (!user || savedRef.current) return;
    savedRef.current = true;
    const shipsDestroyed = result === "win"
      ? enemy.ships.filter((s) => s.hits >= s.size).length
      : enemy.ships.filter((s) => s.hits >= s.size).length;
    await supabase.from("matches").insert({
      user_id: user.id,
      result,
      difficulty,
      ships_destroyed: shipsDestroyed,
      shots_fired: shotsFired,
      duration_seconds: Math.floor((Date.now() - startTime.current) / 1000),
    });
  }

  function playerFire(x: number, y: number) {
    if (turn !== "player" || phase !== "playing") return;
    if (enemy.shots[cellKey(x, y)]) return;
    const { board, outcome, ship } = fireAt(enemy, x, y);
    setEnemy(board);
    setShotsFired((n) => n + 1);
    if (outcome === "miss") { sfx.miss(); pushLog(`Miss at ${String.fromCharCode(65 + x)}${y + 1}`); }
    else if (outcome === "hit") { sfx.hit(); pushLog(`Direct hit at ${String.fromCharCode(65 + x)}${y + 1}`); }
    else if (outcome === "sunk" && ship) {
      sfx.sunk();
      pushLog(`Enemy ${ship.name} destroyed!`);
      setModal({ variant: "sunk", title: "Ship Destroyed", body: `Enemy ${ship.name} obliterated.` });
      setTimeout(() => setModal(null), 1800);
    }
    if (allSunk(board)) {
      setTimeout(() => {
        sfx.win();
        setPhase("over");
        setModal({ variant: "win", title: "Victory", body: "Enemy fleet annihilated. Command salutes you." });
        recordMatch("win");
      }, 350);
      return;
    }
    if (outcome === "miss") setTurn("enemy");
  }

  function toggleEnemyMark(x: number, y: number) {
    const k = cellKey(x, y);
    if (enemy.shots[k]) return;
    sfx.click();
    setEnemy((b) => {
      const marks = { ...(b.marks ?? {}) };
      if (marks[k]) delete marks[k]; else marks[k] = true;
      return { ...b, marks };
    });
  }

  const [enemyTick, setEnemyTick] = useState(0);
  // Enemy turn
  useEffect(() => {
    if (phase !== "playing" || turn !== "enemy") return;
    const t = setTimeout(() => {
      const move = aiMove(difficulty, player, aiMem.current);
      const { board, outcome, ship } = fireAt(player, move.x, move.y);
      setPlayer(board);
      aiPostShot(aiMem.current, move.x, move.y, outcome, board);
      if (outcome === "miss") { sfx.miss(); pushLog(`Enemy missed at ${String.fromCharCode(65 + move.x)}${move.y + 1}`); }
      else if (outcome === "hit") { sfx.hit(); pushLog(`Enemy hit at ${String.fromCharCode(65 + move.x)}${move.y + 1}`); }
      else if (outcome === "sunk" && ship) {
        sfx.sunk();
        pushLog(`Your ${ship.name} was destroyed!`);
        setModal({ variant: "danger", title: "Ship Lost", body: `Your ${ship.name} is down.` });
        setTimeout(() => setModal(null), 1400);
      }
      if (allSunk(board)) {
        setTimeout(() => {
          sfx.lose();
          setPhase("over");
          setModal({ variant: "lose", title: "Defeat", body: "Fleet eliminated. Stand down." });
          recordMatch("loss");
        }, 350);
        return;
      }
      if (outcome === "miss") setTurn("player");
      else setEnemyTick((n) => n + 1); // hit/sunk: another enemy turn
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, enemyTick]);

  if (phase === "setup") {
    return (
      <div className="h-[calc(100vh-80px)] p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Difficulty:</span>
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button key={d}
              onClick={() => { sfx.click(); setDifficulty(d); }}
              className={`px-3 py-1 rounded-md text-xs uppercase font-display tracking-widest border transition ${
                difficulty === d ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10" : "border-border text-muted-foreground"
              }`}
            >{d}</button>
          ))}
        </div>
        <PlacementBoard onConfirm={startMatch} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] p-4 grid grid-rows-[auto_1fr] gap-4">
      <div className="glass px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="font-display uppercase tracking-widest text-sm">
            Turn: <span className={turn === "player" ? "neon-cyan" : "neon-enemy"}>{turn === "player" ? "Player" : "Enemy"}</span>
          </span>
          <span className="text-xs text-muted-foreground">Difficulty: <span className="text-foreground uppercase">{difficulty}</span></span>
          <span className="text-xs text-muted-foreground">Shots: {shotsFired}</span>
        </div>
        <button className="btn-danger" onClick={() => { sfx.click(); setPhase("setup"); }}>Surrender</button>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px_1fr] gap-4 min-h-0">
        <section className="glass relative overflow-hidden min-h-[300px]">
          <div className="absolute top-3 left-3 z-10 font-display text-xs uppercase tracking-widest neon-cyan">Allied Fleet</div>
          <GameBoard3D board={player} isEnemy={false} revealShips />
        </section>

        <section className="glass p-4 flex flex-col">
          <h3 className="font-display uppercase tracking-widest text-xs neon-cyan mb-3">Comms Log</h3>
          <ul className="text-xs space-y-1.5 font-mono overflow-y-auto flex-1">
            {log.map((l, i) => (
              <li key={i} className="text-muted-foreground" style={{ opacity: 1 - i * 0.1 }}>› {l}</li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <div>Enemy ships down: <span className="neon-enemy">{enemy.ships.filter((s) => s.hits >= s.size).length}/5</span></div>
            <div>Allied ships down: <span className="neon-cyan">{player.ships.filter((s) => s.hits >= s.size).length}/5</span></div>
          </div>
        </section>

        <section className="glass relative overflow-hidden min-h-[300px]">
          <div className="absolute top-3 left-3 z-10 font-display text-xs uppercase tracking-widest neon-enemy">Enemy Waters</div>
          <GameBoard3D
            board={enemy}
            isEnemy
            revealShips={phase === "over"}
            onCellClick={(x, y) => playerFire(x, y)}
          />
        </section>
      </div>

      <CyberModal
        open={!!modal}
        variant={modal?.variant ?? "info"}
        title={modal?.title ?? ""}
        onClose={() => phase === "over" ? null : setModal(null)}
        actions={
          phase === "over" ? (
            <>
              <button className="btn-cyber" onClick={() => { setModal(null); setPhase("setup"); }}>New Battle</button>
              <a className="btn-danger" href="/stats">View Stats</a>
            </>
          ) : null
        }
      >
        {modal?.body}
      </CyberModal>
    </div>
  );
}
