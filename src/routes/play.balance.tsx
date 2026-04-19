import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { StartOverlay } from "@/components/StartOverlay";
import { isGameUnlocked, saveGameScore } from "@/lib/storage";

export const Route = createFileRoute("/play/balance")({
  component: BalanceGame,
});

const DURATION = 20; // seconds
const GRAVITY = 0.55;
const TAP_BOOST = -8;
const TARGET_Y = 50; // % from top — sweet zone center
const TARGET_BAND = 18; // % half-width

function BalanceGame() {
  const nav = useNavigate();
  const [showStart, setShowStart] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [y, setY] = useState(50);
  const vRef = useRef(0);
  const yRef = useRef(50);
  const [time, setTime] = useState(DURATION);
  const [hold, setHold] = useState(0); // ms in zone
  const lastFrame = useRef(0);
  const rafRef = useRef<number>(0);
  const startedAt = useRef(0);

  useEffect(() => { if (!isGameUnlocked("balance")) nav({ to: "/challenges" }); }, [nav]);

  const start = () => {
    if (done) { setDone(false); setHold(0); }
    yRef.current = 50; vRef.current = 0; setY(50);
    setTime(DURATION);
    startedAt.current = performance.now();
    lastFrame.current = performance.now();
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const tick = (t: number) => {
      const dt = Math.min(48, t - lastFrame.current) / 16.67;
      lastFrame.current = t;
      vRef.current += GRAVITY * dt;
      yRef.current += vRef.current * dt;
      if (yRef.current > 95) { yRef.current = 95; vRef.current = 0; }
      if (yRef.current < 5) { yRef.current = 5; vRef.current = Math.max(0, vRef.current); }
      setY(yRef.current);

      if (Math.abs(yRef.current - TARGET_Y) < TARGET_BAND) {
        setHold(h => h + (t - (lastFrame.current - (t - lastFrame.current))));
        setHold(h => h + 16);
      }

      const elapsed = (t - startedAt.current) / 1000;
      const remaining = Math.max(0, DURATION - elapsed);
      setTime(remaining);

      if (remaining <= 0) {
        setRunning(false);
        setDone(true);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  // Save score on done
  useEffect(() => {
    if (done) {
      const pct = Math.min(1, hold / (DURATION * 1000));
      const score = Math.round(pct * 100);
      saveGameScore("balance", score);
    }
  }, [done, hold]);

  const tap = () => {
    if (!running) { start(); return; }
    vRef.current = TAP_BOOST;
  };

  const inZone = Math.abs(y - TARGET_Y) < TARGET_BAND;
  const score = Math.round(Math.min(1, hold / (DURATION * 1000)) * 100);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">🔥 Tap Balance</h1>
          <p className="text-sm text-muted-foreground mt-1">Keep the ember in the zone</p>
          <ProgressDots current="balance" />
        </div>

        <div className="mt-4 flex justify-around bg-gradient-card border border-border rounded-2xl p-3">
          <div className="text-center"><div className="text-xs uppercase tracking-wider text-muted-foreground">Time</div><div className="text-xl font-black text-gradient-energy">{time.toFixed(1)}s</div></div>
          <div className="text-center"><div className="text-xs uppercase tracking-wider text-muted-foreground">In Zone</div><div className="text-xl font-black text-gradient-energy">{(hold/1000).toFixed(1)}s</div></div>
        </div>

        <button
          onClick={tap}
          className="mt-4 flex-1 min-h-[55vh] relative w-full rounded-3xl border border-border overflow-hidden bg-gradient-to-b from-[oklch(0.25_0.05_40)] to-[oklch(0.15_0.03_40)] active:scale-[0.99] transition-transform select-none"
          aria-label="Tap to lift ember"
        >
          {/* target zone */}
          <div
            className={`absolute left-0 right-0 border-y-2 ${inZone ? "border-accent bg-accent/15" : "border-accent/40 bg-accent/5"} transition-colors`}
            style={{ top: `${TARGET_Y - TARGET_BAND}%`, height: `${TARGET_BAND * 2}%` }}
          />
          <div className="absolute top-2 left-2 right-2 text-center text-xs uppercase tracking-widest text-accent/80">⟶ Sweet Zone ⟵</div>

          {/* ember */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-energy shadow-glow"
            style={{ top: `calc(${y}% - 2rem)` }}
            animate={{ scale: inZone ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />

          {!running && !done && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-background/80 backdrop-blur px-6 py-4 rounded-2xl border border-border">
                <p className="font-black text-xl">Tap to Start</p>
                <p className="text-xs text-muted-foreground mt-1">Tap repeatedly to fight gravity</p>
              </div>
            </div>
          )}
        </button>

        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-gradient-card border border-border rounded-3xl p-5 text-center shadow-card">
              <div className="text-4xl mb-2">🔥</div>
              <p className="text-3xl font-black text-gradient-energy">{score}/100</p>
              <p className="text-sm text-muted-foreground mt-1">{(hold/1000).toFixed(1)}s in the zone</p>
              <div className="mt-4 flex gap-2">
                <button onClick={start} className="flex-1 py-3 rounded-full bg-muted hover:bg-muted/80 font-semibold transition-colors">Retry</button>
                <button onClick={() => nav({ to: "/challenges" })} className="flex-1 py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform">
                  Continue →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Link to="/challenges" className="mt-3 text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to challenges
        </Link>
      </main>
    </div>
  );
}
