import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { useAuth } from "@/lib/auth";
import {
  type GameMode, createSession,
  getOrCreatePlayerId, getSavedNickname, saveNickname,
} from "@/lib/multiplayer";
import { SHIP_DEFS, type FleetConfig, DEFAULT_FLEET } from "@/lib/game/types";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/play")({
  component: PlayPage,
  head: () => ({ meta: [{ title: "Battle · Battleship" }] }),
});

type Screen = "lobby" | "bot" | "create-mp";

function PlayPage() {
  const { loading } = useAuth();
  const [screen, setScreen] = useState<Screen>("lobby");
  if (loading) return <div className="p-10 text-muted-foreground text-sm">Booting comms…</div>;
  if (screen === "bot") return <GameScreen onBack={() => setScreen("lobby")} />;
  if (screen === "create-mp") return <CreateMultiplayer onBack={() => setScreen("lobby")} />;
  return <Lobby onSelectBot={() => setScreen("bot")} onSelectMultiplayer={() => setScreen("create-mp")} />;
}

function Lobby({ onSelectBot, onSelectMultiplayer }: { onSelectBot: () => void; onSelectMultiplayer: () => void }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="glass max-w-2xl w-full p-10 space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl uppercase tracking-widest neon-cyan">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-2">Choose your battle mode</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <button
            onClick={() => { sfx.click(); onSelectBot(); }}
            className="glass p-6 text-left space-y-3 hover:border-[var(--cyan)] transition group rounded-lg border border-border"
          >
            <div className="text-3xl">🤖</div>
            <div>
              <div className="font-display text-lg uppercase tracking-widest neon-cyan group-hover:brightness-125">vs Bot</div>
              <div className="text-xs text-muted-foreground mt-1">Solo battle against AI — Easy, Medium, or Hard</div>
            </div>
            <div className="text-xs text-muted-foreground">Unlimited · Play offline</div>
          </button>

          <button
            onClick={() => { sfx.click(); onSelectMultiplayer(); }}
            className="glass p-6 text-left space-y-3 hover:border-[var(--cyan)] transition group rounded-lg border border-border"
          >
            <div className="text-3xl">🎮</div>
            <div>
              <div className="font-display text-lg uppercase tracking-widest neon-cyan group-hover:brightness-125">vs Human</div>
              <div className="text-xs text-muted-foreground mt-1">Real-time multiplayer — 2 to 4 players</div>
            </div>
            <div className="text-xs text-muted-foreground">Timed or unlimited · Custom fleets</div>
          </button>
        </div>

        <div className="text-center">
          <a href="/leaderboard" className="text-xs text-muted-foreground hover:text-foreground transition">
            🏆 Global Ranklist →
          </a>
        </div>
      </div>
    </div>
  );
}

function CreateMultiplayer({ onBack }: { onBack: () => void }) {
  const nav = useNavigate();
  const [nickname, setNickname] = useState(getSavedNickname());
  const [gameMode, setGameMode] = useState<GameMode>("10min");
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [gridSize, setGridSize] = useState(10);
  const [fleet, setFleet] = useState<FleetConfig>({ ...DEFAULT_FLEET });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalShips = SHIP_DEFS.reduce((sum, d) => sum + (fleet[d.id] ?? 0), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    sfx.click();
    if (totalShips === 0) { setError("Select at least 1 ship."); return; }
    setCreating(true);
    setError(null);
    const nick = nickname.trim() || "Commander";
    saveNickname(nick);
    getOrCreatePlayerId();

    if (playerCount === 2) {
      const session = await createSession(gameMode, nick, fleet, gridSize);
      setCreating(false);
      if (!session) { setError("Failed to create session. Try again."); return; }
      nav({ to: "/mp/$sessionId", params: { sessionId: session.id } });
    } else {
      // 3-4 player room
      const { createRoom } = await import("@/lib/mpRoom");
      const room = await createRoom({ mode: gameMode, maxPlayers: playerCount, fleet, gridSize, nickname: nick });
      setCreating(false);
      if (!room) { setError("Failed to create room. Try again."); return; }
      nav({ to: "/room/$roomId", params: { roomId: room.id } });
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="glass max-w-lg w-full p-8 space-y-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center gap-3">
          <button onClick={() => { sfx.click(); onBack(); }} className="text-muted-foreground hover:text-foreground text-sm">← Back</button>
          <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">New Battle</h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          {/* Callsign */}
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground">Your Callsign</label>
            <input
              type="text"
              className="input-cyber mt-1"
              placeholder="Commander"
              maxLength={32}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
          </div>

          {/* Player count */}
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 block">Players</label>
            <div className="flex gap-2">
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { sfx.click(); setPlayerCount(n); }}
                  className={`flex-1 py-2 rounded-md text-sm font-display uppercase tracking-widest border transition ${
                    playerCount === n
                      ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {n}P
                </button>
              ))}
            </div>
            {playerCount > 2 && (
              <p className="text-xs text-muted-foreground mt-1">
                Players share a room link. Turn-based — select your target each round.
              </p>
            )}
          </div>

          {/* Game mode */}
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 block">
              Timer Mode
            </label>
            <div className="flex gap-2">
              {(["4min", "10min", "infinite"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { sfx.click(); setGameMode(m); }}
                  className={`flex-1 py-2 rounded-md text-xs font-display uppercase tracking-widest border transition ${
                    gameMode === m
                      ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m === "infinite" ? "∞ No Limit" : m === "4min" ? "4 Min" : "10 Min"}
                </button>
              ))}
            </div>
            {gameMode !== "infinite" && (
              <p className="text-xs text-muted-foreground mt-1">
                Each player's clock only ticks on their turn (chess clock). Most ships sunk wins on timeout.
              </p>
            )}
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => { sfx.click(); setShowAdvanced((v) => !v); }}
            className="text-xs text-muted-foreground hover:text-foreground transition w-full text-left"
          >
            {showAdvanced ? "▼" : "▶"} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-4 border border-border rounded-md p-4">
              {/* Grid size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Grid Size
                  </label>
                  <span className="text-xs font-display neon-cyan">{gridSize}×{gridSize}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={16}
                  step={1}
                  value={gridSize}
                  onChange={(e) => { sfx.click(); setGridSize(Number(e.target.value)); }}
                  className="w-full accent-[var(--cyan)]"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>8×8</span><span>12×12</span><span>16×16</span>
                </div>
              </div>

              {/* Fleet config */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-display uppercase tracking-widest text-muted-foreground">Fleet Configuration</label>
                  <span className="text-xs text-muted-foreground">{totalShips} ships</span>
                </div>
                <div className="space-y-2">
                  {SHIP_DEFS.map((def) => (
                    <div key={def.id} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 font-mono">{def.name}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: def.size }).map((_, i) => (
                          <div key={i} className="w-3 h-3 rounded-sm bg-[var(--cyan)]/40" />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => setFleet((f) => ({ ...f, [def.id]: Math.max(0, (f[def.id] ?? 1) - 1) }))}
                          className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:border-[var(--cyan)] text-xs"
                        >−</button>
                        <span className="text-sm font-display neon-cyan w-4 text-center">{fleet[def.id] ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => setFleet((f) => ({ ...f, [def.id]: Math.min(5, (f[def.id] ?? 1) + 1) }))}
                          className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:border-[var(--cyan)] text-xs"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setFleet({ ...DEFAULT_FLEET })}
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[var(--enemy)]">{error}</p>}

          <button disabled={creating} className="btn-cyber w-full">
            {creating ? "Creating…" : "Create Battle & Get Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
