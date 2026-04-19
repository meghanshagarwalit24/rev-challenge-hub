import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { StartOverlay } from "@/components/StartOverlay";
import { saveGameScore } from "@/lib/storage";

export const Route = createFileRoute("/play/reflex")({
  component: ReflexGame,
});

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "done";
const ROUNDS = 5;
const MAX_DURATION = 20; // seconds total cap

function ReflexGame() {
  const nav = useNavigate();
  const [showStart, setShowStart] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(MAX_DURATION);
  const startRef = useRef(0);
  const sessionStartRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const finish = (finalTimes: number[]) => {
    const avg = finalTimes.length ? finalTimes.reduce((a, b) => a + b, 0) / finalTimes.length : 700;
    const score = Math.max(0, Math.min(100, Math.round((700 - avg) / 5)));
    saveGameScore("reflex", score);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase("done");
    setTimeout(() => nav({ to: "/play/memory" }), 1500);
  };

  // Global 20s timer
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    if (sessionStartRef.current === 0) sessionStartRef.current = performance.now();
    tickRef.current = setInterval(() => {
      const elapsed = (performance.now() - sessionStartRef.current) / 1000;
      const left = Math.max(0, MAX_DURATION - elapsed);
      setTimeLeft(left);
      if (left <= 0) finish(times);
    }, 100);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, times]);

  const startRound = () => {
    if (sessionStartRef.current === 0) sessionStartRef.current = performance.now();
    setPhase("waiting");
    const delay = 700 + Math.random() * 1600;
    timeoutRef.current = setTimeout(() => {
      startRef.current = performance.now();
      setPhase("go");
    }, delay);
  };

  const handleTap = () => {
    if (phase === "done") return;
    if (phase === "idle") { startRound(); return; }
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
        finish(next);
      } else {
        setPhase("idle");
        setTimeout(startRound, 500);
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
      {showStart && (
        <StartOverlay
          emoji="⚡"
          title="Reflex Tap"
          lines={[
            "Tap the screen the instant it turns green.",
            "Beat your reaction time across quick rounds.",
            "Don't tap too early!",
          ]}
          onStart={() => setShowStart(false)}
        />
      )}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">⚡ Reflex Tap</h1>
          <p className="text-sm text-muted-foreground mt-1">{timeLeft.toFixed(1)}s left</p>
          <ProgressDots current="reflex" />
        </div>

        <button
          onClick={handleTap}
          disabled={phase === "done" || showStart}
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
                  <p className="mt-3 text-sm text-white/80">Loading next challenge…</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </button>

        <Link to="/challenges" className="mt-3 text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to challenges
        </Link>
      </main>
    </div>
  );
}
