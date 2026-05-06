import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getOrCreatePlayerId, getSavedNickname, saveNickname } from "@/lib/multiplayer";
import { joinRoom, useMpRoom } from "@/lib/mpRoom";
import { MpRoomScreen } from "@/components/game/MpRoomScreen";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
  head: () => ({ meta: [{ title: "Room · Battleship" }] }),
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { room, loading } = useMpRoom(roomId);
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState(getSavedNickname());
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Check if already in room
  useEffect(() => {
    if (!room || joined) return;
    const inRoom = room.players.some((p) => p.player_id === playerId);
    if (inRoom) setJoined(true);
  }, [room, playerId, joined]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    sfx.click();
    setJoining(true);
    setJoinError(null);
    const nick = nickname.trim() || "Commander";
    saveNickname(nick);
    const { room: joined, error } = await joinRoom(roomId, nick);
    setJoining(false);
    if (error || !joined) { setJoinError(error ?? "Failed to join."); return; }
    setJoined(true);
  }

  if (loading) {
    return <div className="p-10 text-muted-foreground text-sm">Connecting to battle station…</div>;
  }

  if (!room) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass max-w-md w-full p-8 text-center space-y-4">
          <h2 className="font-display text-xl uppercase tracking-widest neon-enemy">Room Not Found</h2>
          <p className="text-sm text-muted-foreground">This battle room does not exist or has expired.</p>
          <a className="btn-cyber inline-flex" href="/play">Back to Command</a>
        </div>
      </div>
    );
  }

  const alreadyInRoom = room.players.some((p) => p.player_id === playerId);
  const isFull = room.players.length >= room.max_players && !alreadyInRoom;

  if (isFull) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass max-w-md w-full p-8 text-center space-y-4">
          <h2 className="font-display text-xl uppercase tracking-widest neon-enemy">Room Full</h2>
          <p className="text-sm text-muted-foreground">
            This {room.max_players}-player room is already full.
          </p>
          <a className="btn-cyber inline-flex" href="/play">Find Another Battle</a>
        </div>
      </div>
    );
  }

  if (!joined && !alreadyInRoom) {
    const hostPlayer = room.players[0];
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass max-w-md w-full p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">Join Battle Room</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {hostPlayer?.nickname ?? "Host"} is waiting · {room.max_players}P ·{" "}
              {room.game_mode === "infinite" ? "Unlimited" : room.game_mode} · {room.grid_size}×{room.grid_size}
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

  return <MpRoomScreen room={room} playerId={playerId} />;
}
