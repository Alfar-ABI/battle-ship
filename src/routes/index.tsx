import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Battleship" },
      { name: "description", content: "A high-end 3D Battleship arena. Play vs adaptive AI." },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
            ▰ Tactical Naval Simulator
          </div>
          <h1 className="font-display text-5xl md:text-6xl uppercase neon-cyan leading-none">
            Battleship
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Choose how to enter the war room.
          </p>
        </div>

        <div className="glass p-6 space-y-3">
          <Link to="/login" className="btn-cyber w-full">
            Log In / Sign Up
          </Link>
          <Link to="/play" className="btn-danger w-full">
            Play as Guest
          </Link>
          <p className="text-[10px] text-muted-foreground text-center pt-2">
            Guests can play full matches. Sign in to save match history & stats.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
