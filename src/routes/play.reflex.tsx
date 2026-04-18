import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { saveGameScore } from "@/lib/storage";

export const Route = createFileRoute("/play/reflex")({
  component: ReflexGame,
});

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "done";
const ROUNDS = 5;

function ReflexGame() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const startRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const startRound = () => {
    setPhase("waiting");
    const delay = 900 + Math.random() * 2200;
    timeoutRef.current = setTimeout(() => {
      startRef.current = performance.now();
      setPhase("go");
    }, delay);
  };

  const handleTap = () => {
    if (phase === "idle" || phase === "done") { startRound(); return; }
    if (phase === "tooSoon") { startRound(); return; }
    if (phase === "waiting") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase("tooSoon");
      return;
    }
    if (phase === "go") {
      const rt = performance.now() - startRef.current;
      const next = [...times, rt];
      setTimes(next);
      const nextRound = round + 1;
      setRound(nextRound);
      if (nextRound >= ROUNDS) {
        const avg = next.reduce((a, b) => a + b, 0) / next.length;
        // Score: faster = more, capped at 100. <200ms = 100, >700ms = 0
        const score = Math.max(0, Math.min(100, Math.round((700 - avg) / 5)));
        saveGameScore("reflex", score);
        setPhase("done");
      } else {
        setPhase("idle");
        setTimeout(startRound, 600);
      }
    }
  };

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const score = Math.max(0, Math.min(100, Math.round((700 - avg) / 5)));

  const palette: Record<Phase, string> = {
    idle: "from-muted to-muted",
    waiting: "from-flame to-ember",
    go: "from-accent to-energy",
    tooSoon: "from-destructive to-flame",
    done: "from-accent to-energy",
  };

  const label: Record<Phase, string> = {
    idle: "Tap to begin",
    waiting: "Wait for it…",
    go: "TAP NOW!",
    tooSoon: "Too soon! Tap to retry",
    done: "Complete!",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">⚡ Reflex Tap</h1>
          <p className="text-sm text-muted-foreground mt-1">Round {Math.min(round + 1, ROUNDS)} / {ROUNDS}</p>
          <ProgressDots current="reflex" />
        </div>

        <button
          onClick={handleTap}
          disabled={phase === "done"}
          className="mt-6 flex-1 min-h-[60vh] w-full rounded-3xl border border-border overflow-hidden relative active:scale-[0.99] transition-transform select-none"
          aria-label="Reflex tap area"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${palette[phase]} transition-colors duration-300`} />
          <div className="absolute inset-0 grid-bg opacity-30" />
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              {phase === "go" && (
                <motion.div
                  className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-white/90 shadow-glow"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
              <p className={`mt-6 text-2xl md:text-5xl font-black ${phase === "go" ? "text-energy-foreground" : "text-white drop-shadow"}`}>
                {label[phase]}
              </p>
              {phase === "done" && (
                <div className="mt-6 text-center">
                  <p className="text-white/80">Avg reaction</p>
                  <p className="text-4xl font-black text-white">{avg} ms</p>
                  <p className="mt-3 text-2xl font-bold text-white">Score: {score}/100</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </button>

        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex gap-2">
            <button onClick={() => { setTimes([]); setRound(0); setPhase("idle"); }} className="flex-1 py-3 rounded-full bg-muted text-foreground font-semibold hover:bg-muted/80 transition-colors">
              Retry
            </button>
            <button onClick={() => nav({ to: "/challenges" })} className="flex-1 py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform">
              Continue →
            </button>
          </motion.div>
        )}

        <Link to="/challenges" className="mt-3 text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to challenges
        </Link>
      </main>
    </div>
  );
}
