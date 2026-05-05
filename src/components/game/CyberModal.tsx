import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  variant: "info" | "win" | "lose" | "danger";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}

const palette = {
  info:   { color: "var(--cyan)",  glow: "var(--shadow-glow-cyan)" },
  win:    { color: "var(--cyan)",  glow: "var(--shadow-glow-cyan)" },
  lose:   { color: "var(--enemy)", glow: "var(--shadow-glow-enemy)" },
  danger: { color: "var(--enemy)", glow: "var(--shadow-glow-enemy)" },
};

export function CyberModal({ open, variant, title, children, actions, onClose }: Props) {
  const p = palette[variant];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="glass relative max-w-md w-full p-8 text-center"
            style={{ boxShadow: p.glow, borderColor: p.color }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="absolute inset-0 rounded-md pointer-events-none"
              style={{ boxShadow: `inset 0 0 60px ${p.color}` }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <h2
              className="font-display text-3xl uppercase tracking-widest mb-3 relative"
              style={{ color: p.color, textShadow: `0 0 12px ${p.color}` }}
            >
              {title}
            </h2>
            <div className="text-sm text-muted-foreground mb-6 relative">{children}</div>
            <div className="flex flex-wrap gap-3 justify-center relative">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
