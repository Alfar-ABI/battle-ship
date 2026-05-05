import { motion, AnimatePresence } from "framer-motion";

interface Props {
  shipName: string | null;
  side: "enemy" | "player";
}

/** Persistent, subtle, animated banner shown when a ship is sunk. */
export function SunkBanner({ shipName, side }: Props) {
  const color = side === "enemy" ? "var(--enemy)" : "var(--cyan)";
  return (
    <AnimatePresence>
      {shipName && (
        <motion.div
          key={shipName + side}
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 0.75, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-40"
        >
          <motion.div
            className="glass px-5 py-2 flex items-center gap-3 relative overflow-hidden"
            style={{ borderColor: color, boxShadow: `0 0 30px ${color}` }}
            animate={{ boxShadow: [`0 0 18px ${color}`, `0 0 36px ${color}`, `0 0 18px ${color}`] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            <motion.span
              className="block w-2 h-2 rounded-full"
              style={{ background: color }}
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span
              className="font-display uppercase tracking-widest text-xs"
              style={{ color, textShadow: `0 0 8px ${color}` }}
            >
              {side === "enemy" ? "Enemy" : "Allied"} {shipName} · Down
            </span>
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(110deg, transparent 35%, ${color}33 50%, transparent 65%)`,
              }}
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
