import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  type GameSession, type PlayerRole,
  getOrCreatePlayerId, getSavedNickname, saveNickname,
  joinSession, useGameSession,
} from "@/lib/multiplayer";
import { MultiplayerScreen } from "@/components/game/MultiplayerScreen";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/mp/$sessionId")({
  component: MultiplayerPage,
  head: () => ({ meta: [{ title: "Multiplayer · Battleship" }] }),
});

function MultiplayerPage() {
  const { sessionId } = Route.useParams();
  const { session, loading, refetch } = useGameSession(sessionId);
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(getSavedNickname());
  const [nickSubmitted, setNickSubmitted] = useState(false);

  // Determine role once session loads
  useEffect(() => {
    if (!session || role) return;
    const myId = getOrCreatePlayerId();
    if (session.host_player_id === myId) { setRole("host"); setNickSubmitted(true); return; }
    if (session.guest_player_id === myId) { setRole("guest"); setNickSubmitted(true); return; }
    // New guest — prompt for nickname then join
  }, [session, role]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    sfx.click();
    setJoining(true);
    setJoinError(null);
    const nick = nickname.trim() || "Commander";
    saveNickname(nick);
    const { session: joined, role: r, error } = await joinSession(sessionId, nick);
    setJoining(false);
    if (error || !joined || !r) {
      setJoinError(error ?? "Failed to join game.");
      return;
    }
    setRole(r);
    setNickSubmitted(true);
  }

  if (loading) {
    return <div className="p-10 text-muted-foreground text-sm">Connecting to battle station…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass max-w-md w-full p-8 text-center space-y-4">
          <h2 className="font-display text-xl uppercase tracking-widest neon-enemy">Session Not Found</h2>
          <p className="text-sm text-muted-foreground">This battle session does not exist or has expired.</p>
          <a className="btn-cyber inline-flex" href="/play">Back to Command</a>
        </div>
      </div>
    );
  }

  // Prompt nickname for new guest
  if (!nickSubmitted) {
    const isFull = !!session.guest_player_id;
    if (isFull) {
      return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
          <div className="glass max-w-md w-full p-8 text-center space-y-4">
            <h2 className="font-display text-xl uppercase tracking-widest neon-enemy">Battle Full</h2>
            <p className="text-sm text-muted-foreground">This session already has two players.</p>
            <a className="btn-cyber inline-flex" href="/play">Find Another Battle</a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass max-w-md w-full p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">Join Battle</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {session.host_nickname} is waiting for an opponent.
            </p>
          </div>
          <form onSubmit={handleJoin} className="space-y-4">
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
            {joinError && <p className="text-xs text-[var(--enemy)]">{joinError}</p>}
            <button disabled={joining} className="btn-cyber w-full">
              {joining ? "Joining…" : "Enter Battle"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!role) return <div className="p-10 text-muted-foreground text-sm">Synchronising…</div>;

  return <MultiplayerScreen session={session} role={role} refetch={refetch} />;
}
