import { motion } from "framer-motion";

interface StartOverlayProps {
  emoji?: string;
  title: string;
  lines: string[];
  onStart: () => void;
}

export function StartOverlay({ emoji, title, lines, onStart }: StartOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-md bg-gradient-card border border-border rounded-3xl p-6 text-center shadow-card"
      >
        {emoji && <div className="text-5xl mb-3">{emoji}</div>}
        <h2 className="text-2xl md:text-3xl font-black text-gradient-energy">{title}</h2>
        <div className="mt-4 space-y-1.5">
          {lines.map((l, i) => (
            <p key={i} className="text-sm md:text-base text-muted-foreground">{l}</p>
          ))}
        </div>
        <button
          onClick={onStart}
          className="mt-6 w-full py-4 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform"
        >
          ▶ Start Now
        </button>
        <p className="mt-3 text-xs text-muted-foreground">20 seconds max</p>
      </motion.div>
    </motion.div>
  );
}
