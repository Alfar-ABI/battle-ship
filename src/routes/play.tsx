import { createFileRoute, Link } from "@tanstack/react-router";
import { GameScreen } from "@/components/game/GameScreen";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/play")({
  component: PlayPage,
  head: () => ({ meta: [{ title: "Battle · Cyber-Command" }] }),
});

function PlayPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-muted-foreground text-sm">Booting comms…</div>;
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass max-w-md text-center p-10">
          <h2 className="font-display text-xl uppercase tracking-widest neon-cyan">Authentication Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">Sign in to access the war room.</p>
          <Link to="/login" className="btn-cyber">Authenticate</Link>
        </div>
      </div>
    );
  }
  return <GameScreen />;
}
