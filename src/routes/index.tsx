import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Cyber-Command · Battleship" },
      { name: "description", content: "Command a fleet in a 3D Battleship arena. Play vs adaptive AI." },
    ],
  }),
});

function Index() {
  return (
    <div className="px-6 lg:px-12 py-16 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">
          ▰ Tactical Naval Simulator · v1.0
        </div>
        <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.95]">
          Command the <span className="neon-cyan">Fleet.</span><br />
          Sink the <span className="neon-enemy">Enemy.</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted-foreground">
          A high-end 3D Battleship arena. Deploy your ships across a holographic grid, then duel an
          adaptive AI through Easy, Medium, and probability-driven Hard modes.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/play" className="btn-cyber">⚓ Start Battle</Link>
          <Link to="/login" className="btn-danger">Sync Profile</Link>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {[
            { t: "3D Arena", d: "Floating holo-grid with low-poly ships and reactive lighting." },
            { t: "Adaptive AI", d: "Hard mode uses a probability density map to hunt your fleet." },
            { t: "Persistent Stats", d: "Match history, winrate, and ships destroyed — synced." },
          ].map((f, i) => (
            <motion.div key={f.t}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass p-5"
            >
              <div className="font-display uppercase tracking-widest text-sm neon-cyan">{f.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
