import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/stats")({
  component: StatsPage,
  head: () => ({ meta: [{ title: "Stats · Cyber-Command" }] }),
});

interface Match {
  id: string;
  result: "win" | "loss";
  difficulty: string;
  ships_destroyed: number;
  shots_fired: number;
  duration_seconds: number;
  created_at: string;
}

function StatsPage() {
  const { user, loading } = useAuth();
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("matches").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setMatches((data ?? []) as Match[]);
    });
  }, [user]);

  if (loading) return <div className="p-10 text-muted-foreground text-sm">Loading…</div>;
  if (!user) {
    return (
      <div className="p-10 text-center">
        <Link to="/login" className="btn-cyber">Sign in to view stats</Link>
      </div>
    );
  }

  const wins = matches?.filter((m) => m.result === "win").length ?? 0;
  const losses = matches?.filter((m) => m.result === "loss").length ?? 0;
  const total = wins + losses;
  const winrate = total ? Math.round((wins / total) * 100) : 0;
  const shipsDestroyed = matches?.reduce((s, m) => s + m.ships_destroyed, 0) ?? 0;

  return (
    <div className="p-6 lg:p-12 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl uppercase tracking-widest neon-cyan mb-6">Service Record</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { l: "Battles", v: total },
          { l: "Wins", v: wins },
          { l: "Winrate", v: `${winrate}%` },
          { l: "Ships Destroyed", v: shipsDestroyed },
        ].map((s) => (
          <div key={s.l} className="glass p-5">
            <div className="text-xs font-display uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div className="font-display text-3xl mt-2 neon-cyan">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="glass p-5">
        <h2 className="font-display uppercase tracking-widest text-sm mb-4">Match History</h2>
        {matches === null ? (
          <p className="text-sm text-muted-foreground">Decrypting…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No engagements logged. <Link to="/play" className="neon-cyan">Start one →</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="text-left border-b border-border/40">
                  <th className="py-2">Date</th>
                  <th>Result</th>
                  <th>Difficulty</th>
                  <th>Shots</th>
                  <th>Ships KO</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="border-b border-border/20">
                    <td className="py-2 text-muted-foreground">{new Date(m.created_at).toLocaleString()}</td>
                    <td className={m.result === "win" ? "neon-cyan font-display uppercase" : "neon-enemy font-display uppercase"}>{m.result}</td>
                    <td className="uppercase text-xs">{m.difficulty}</td>
                    <td>{m.shots_fired}</td>
                    <td>{m.ships_destroyed}</td>
                    <td>{Math.floor(m.duration_seconds / 60)}m {m.duration_seconds % 60}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
