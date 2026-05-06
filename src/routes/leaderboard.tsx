import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreatePlayerId } from "@/lib/multiplayer";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Ranklist · Battleship" }] }),
});

interface LeaderboardEntry {
  player_id: string;
  nickname: string;
  wins: number;
  losses: number;
  games: number;
}

function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const myId = getOrCreatePlayerId();

  useEffect(() => {
    supabase
      .from("leaderboard")
      .select()
      .order("wins", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries((data ?? []) as LeaderboardEntry[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="glass max-w-2xl w-full p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-widest neon-cyan">Global Ranklist</h1>
            <p className="text-xs text-muted-foreground mt-1">2-player games only · ranked by wins</p>
          </div>
          <a href="/play" className="text-xs text-muted-foreground hover:text-foreground transition">← Back</a>
        </div>

        {loading ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Loading rankings…</div>
        ) : entries.length === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center">
            No ranked games yet. Play multiplayer to appear here!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-display uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left pb-3 pr-4">#</th>
                  <th className="text-left pb-3 pr-4">Callsign</th>
                  <th className="text-right pb-3 pr-4">Wins</th>
                  <th className="text-right pb-3 pr-4">Losses</th>
                  <th className="text-right pb-3">Win %</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const isMe = e.player_id === myId;
                  const winRate = e.games > 0 ? Math.round((e.wins / e.games) * 100) : 0;
                  return (
                    <tr
                      key={e.player_id}
                      className={`border-b border-border/40 transition ${isMe ? "bg-[var(--cyan)]/5" : "hover:bg-white/5"}`}
                    >
                      <td className="py-3 pr-4 font-display text-muted-foreground">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={isMe ? "neon-cyan font-display" : ""}>{e.nickname}</span>
                        {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </td>
                      <td className="py-3 pr-4 text-right font-display neon-cyan">{e.wins}</td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">{e.losses}</td>
                      <td className="py-3 text-right text-muted-foreground">{winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
