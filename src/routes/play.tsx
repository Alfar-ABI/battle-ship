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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    sfx.click();
    setCreating(true);
    setError(null);
    const nick = nickname.trim() || "Commander";
    saveNickname(nick);
    getOrCreatePlayerId(); // ensure ID exists
    const session = await createSession(gameMode, nick);
    setCreating(false);
    if (!session) { setError("Failed to create session. Try again."); return; }
    nav({ to: "/mp/$sessionId", params: { sessionId: session.id } });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="glass max-w-md w-full p-8 space-y-6">
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
            <label className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 block">Game Duration</label>
            <div className="flex gap-3">
              {(["4min", "10min"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { sfx.click(); setGameMode(m); }}
                  className={`flex-1 py-2.5 rounded-md text-sm font-display uppercase tracking-widest border transition ${
                    gameMode === m
                      ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m === "4min" ? "4 Minutes" : "10 Minutes"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              When time runs out, the player with more enemy ships sunk wins.
            </p>
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
