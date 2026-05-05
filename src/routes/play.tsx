import { createFileRoute } from "@tanstack/react-router";
import { GameScreen } from "@/components/game/GameScreen";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/play")({
  component: PlayPage,
  head: () => ({ meta: [{ title: "Battle · Battleship" }] }),
});

function PlayPage() {
  const { loading } = useAuth();
  if (loading) return <div className="p-10 text-muted-foreground text-sm">Booting comms…</div>;
  return <GameScreen />;
}
