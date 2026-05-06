import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { useAuth } from "@/lib/auth";
import {
  type GameMode, createSession,
  getOrCreatePlayerId, getSavedNickname, saveNickname,
} from "@/lib/multiplayer";
import { SHIP_TYPES, DEFAULT_FLEET, fleetTotal, type FleetConfig, type ShipKind } from "@/lib/game/types";
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
          {/* vs Bot */}
          <button
            onClick={() => { sfx.click(); onSelectBot(); }}
            className="glass p-6 text-left space-y-3 hover:border-[var(--cyan)] transition group rounded-lg border border-border"
          >
            <div className="text-3xl">🤖</div>
            <div>
              <div className="font-display text-lg uppercase tracking-widest neon-cyan group-hover:brightness-125">vs Bot</div>
              <div className="text-xs text-muted-foreground mt-1">Solo battle against AI — Easy, Medium, or Hard difficulty</div>
            </div>
            <div className="text-xs text-muted-foreground">Unlimited • Play offline</div>
          </button>

          {/* vs Human */}
          <button
            onClick={() => { sfx.click(); onSelectMultiplayer(); }}
            className="glass p-6 text-left space-y-3 hover:border-[var(--cyan)] transition group rounded-lg border border-border"
          >
            <div className="text-3xl">🎮</div>
            <div>
              <div className="font-display text-lg uppercase tracking-widest neon-cyan group-hover:brightness-125">vs Human</div>
              <div className="text-xs text-muted-foreground mt-1">Real-time multiplayer — send a link to your friend</div>
            </div>
            <div className="text-xs text-muted-foreground">4 min or 10 min timed match</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateMultiplayer({ onBack }: { onBack: () => void }) {
  const nav = useNavigate();
  const [nickname, setNickname] = useState(getSavedNickname());
  const [gameMode, setGameMode] = useState<GameMode>("10min");
  const [customFleet, setCustomFleet] = useState(false);
  const [fleet, setFleet] = useState<FleetConfig>({ ...DEFAULT_FLEET });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = fleetTotal(fleet);

  function setShipCount(kind: ShipKind, n: number) {
    sfx.click();
    setFleet((f) => ({ ...f, [kind]: Math.max(0, Math.min(5, n)) }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    sfx.click();
    if (customFleet && total === 0) {
      setError("Your fleet must have at least one ship.");
      return;
    }
    setCreating(true);
    setError(null);
    const nick = nickname.trim() || "Commander";
    saveNickname(nick);
    getOrCreatePlayerId();
    const session = await createSession(gameMode, nick, customFleet ? fleet : DEFAULT_FLEET);
    setCreating(false);
    if (!session) { setError("Failed to create session. Try again."); return; }
    nav({ to: "/mp/$sessionId", params: { sessionId: session.id } });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="glass max-w-md w-full p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => { sfx.click(); onBack(); }} className="text-muted-foreground hover:text-foreground text-sm">← Back</button>
          <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">New Multiplayer Battle</h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
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

          <div>
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 block">Per-Player Time Bank</label>
            <div className="grid grid-cols-3 gap-2">
              {(["4min", "10min", "infinite"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { sfx.click(); setGameMode(m); }}
                  className={`py-2.5 rounded-md text-xs font-display uppercase tracking-widest border transition ${
                    gameMode === m
                      ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m === "4min" ? "4 Min" : m === "10min" ? "10 Min" : "∞ Untimed"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {gameMode === "infinite"
                ? "No time limit. Game ends when one fleet is destroyed."
                : "Each player has their own clock that only ticks on their turn. Run out of time and you lose."}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-display uppercase tracking-widest text-muted-foreground">Fleet Configuration</label>
              <button
                type="button"
                onClick={() => { sfx.click(); setCustomFleet((c) => !c); }}
                className={`text-[10px] font-display uppercase tracking-widest px-2 py-1 rounded border transition ${
                  customFleet ? "border-[var(--cyan)] text-[var(--cyan)]" : "border-border text-muted-foreground"
                }`}
              >
                {customFleet ? "Custom" : "Standard"}
              </button>
            </div>
            {customFleet ? (
              <div className="space-y-2">
                {SHIP_TYPES.map((t) => {
                  const n = fleet[t.id] ?? 0;
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
                      <div className="flex-1">
                        <div className="font-display text-xs uppercase tracking-wider">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground">size {t.size}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShipCount(t.id, n - 1)} className="w-7 h-7 rounded border border-border text-sm">−</button>
                        <span className="w-6 text-center font-display tabular-nums">{n}</span>
                        <button type="button" onClick={() => setShipCount(t.id, n + 1)} className="w-7 h-7 rounded border border-border text-sm">+</button>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[10px] text-muted-foreground text-right">
                  Total ships: <span className="text-foreground">{total}</span> (0–5 of each)
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Standard fleet: 1 of each ship (5 total).</p>
            )}
          </div>

          {error && <p className="text-xs text-[var(--enemy)]">{error}</p>}

          <button disabled={creating} className="btn-cyber w-full">
            {creating ? "Creating…" : "Create Battle & Get Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
