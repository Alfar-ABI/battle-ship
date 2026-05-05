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

const dramatic = (v: Props["variant"]) => v === "win" || v === "lose";

export function CyberModal({ open, variant, title, children, actions, onClose }: Props) {
  const p = palette[variant];
  const big = dramatic(variant);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />

          {/* Dramatic flash for win/lose */}
          {big && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(circle at center, ${p.color}, transparent 65%)` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 0.55, 0.18], scale: [0.4, 1.4, 1] }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
          )}

          {/* Rotating rays for win/lose */}
          {big && (
            <motion.div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
            >
              <div
                className="w-[140vmax] h-[140vmax] opacity-25"
                style={{
                  background: `repeating-conic-gradient(from 0deg, ${p.color} 0deg 6deg, transparent 6deg 18deg)`,
                  maskImage: "radial-gradient(circle at center, black 10%, transparent 60%)",
                  WebkitMaskImage: "radial-gradient(circle at center, black 10%, transparent 60%)",
                }}
              />
            </motion.div>
          )}

          {/* Particle sparks for win/lose */}
          {big && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * Math.PI * 2;
                const dist = 220 + Math.random() * 200;
                return (
                  <motion.span
                    key={i}
                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: p.color, boxShadow: `0 0 12px ${p.color}` }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist,
                      opacity: 0,
                      scale: 0.4,
                    }}
                    transition={{ duration: 1.6 + Math.random() * 0.6, ease: "easeOut" }}
                  />
                );
              })}
            </div>
          )}

          {/* Modal card */}
          <motion.div
            initial={{ scale: big ? 0.5 : 0.85, opacity: 0, y: 20, rotateX: big ? -25 : 0 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: big ? 180 : 260, damping: big ? 14 : 22 }}
            className="glass relative max-w-md w-full p-8 text-center"
            style={{ boxShadow: p.glow, borderColor: p.color, perspective: 800 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="absolute inset-0 rounded-md pointer-events-none"
              style={{ boxShadow: `inset 0 0 60px ${p.color}` }}
              animate={{ opacity: [0.3, 0.85, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Animated underline bar */}
            {big && (
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 -top-1 h-0.5"
                style={{ background: p.color, boxShadow: `0 0 12px ${p.color}` }}
                initial={{ width: 0 }}
                animate={{ width: "85%" }}
                transition={{ duration: 0.7, delay: 0.15 }}
              />
            )}

            <motion.h2
              className={`font-display ${big ? "text-5xl" : "text-3xl"} uppercase tracking-widest mb-3 relative`}
              style={{ color: p.color, textShadow: `0 0 18px ${p.color}` }}
              initial={big ? { letterSpacing: "0.6em", opacity: 0 } : false}
              animate={big ? { letterSpacing: "0.12em", opacity: 1 } : {}}
              transition={{ duration: 0.7 }}
            >
              {big ? (
                <span className="inline-block">
                  {title.split("").map((ch, i) => (
                    <motion.span
                      key={i}
                      className="inline-block"
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 300, damping: 18 }}
                    >
                      {ch === " " ? "\u00A0" : ch}
                    </motion.span>
                  ))}
                </span>
              ) : title}
            </motion.h2>

            <div className="text-sm text-muted-foreground mb-6 relative">{children}</div>
            <div className="flex flex-wrap gap-3 justify-center relative">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
