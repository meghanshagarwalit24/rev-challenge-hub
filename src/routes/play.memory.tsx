import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { StartOverlay } from "@/components/StartOverlay";
import { isGameUnlocked, saveGameScore } from "@/lib/storage";
import revitalProduct from "@/assets/revital-poster.png";

export const Route = createFileRoute("/play/memory")({
  component: MemoryGame,
});

const SYMBOLS = ["⚡", "🔥", "💪", "🌟"]; // 4 pairs = 8 cards around center
const MAX_DURATION = 20;
const TOTAL_PAIRS = SYMBOLS.length;

interface Card { id: number; symbol: string; matched: boolean; }

function shuffle<T>(arr: T[]) { return arr.map(v => [Math.random(), v] as const).sort((a,b)=>a[0]-b[0]).map(([,v])=>v); }

function buildDeck(): Card[] {
  return shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({ id: i, symbol: s, matched: false }));
}

function MemoryGame() {
  const nav = useNavigate();
  const [showStart, setShowStart] = useState(true);
  const [deck, setDeck] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { if (!isGameUnlocked("memory")) nav({ to: "/challenges" }); }, [nav]);

  useEffect(() => {
    if (done || showStart) return;
    const t = setInterval(() => setSeconds(s => {
      const next = s + 1;
      if (next >= MAX_DURATION) setDone(true);
      return next;
    }), 1000);
    return () => clearInterval(t);
  }, [done, showStart]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    setMoves(m => m + 1);
    const [a, b] = flipped;
    const ca = deck.find(c => c.id === a)!;
    const cb = deck.find(c => c.id === b)!;
    if (ca.symbol === cb.symbol) {
      setTimeout(() => {
        setDeck(d => d.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c));
        setFlipped([]);
      }, 350);
    } else {
      setTimeout(() => setFlipped([]), 750);
    }
  }, [flipped, deck]);

  useEffect(() => {
    if (deck.every(c => c.matched) && !done) setDone(true);
  }, [deck, done]);

  useEffect(() => {
    if (!done) return;
    const allMatched = deck.every(c => c.matched);
    let score: number;
    if (allMatched) {
      const ideal = TOTAL_PAIRS;
      const moveScore = Math.max(0, 100 - Math.max(0, moves - ideal) * 8);
      const timeScore = Math.max(0, 100 - Math.max(0, seconds - 8) * 6);
      score = Math.round((moveScore + timeScore) / 2);
    } else {
      const pairs = deck.filter(c => c.matched).length / 2;
      score = Math.round((pairs / TOTAL_PAIRS) * 100);
    }
    saveGameScore("memory", score);
    const t = setTimeout(() => nav({ to: "/play/balance" }), 1500);
    return () => clearTimeout(t);
  }, [done, deck, moves, seconds, nav]);

  const flip = (id: number) => {
    if (showStart) return;
    if (flipped.length === 2) return;
    if (flipped.includes(id)) return;
    if (deck.find(c => c.id === id)?.matched) return;
    setFlipped([...flipped, id]);
  };

  // Build 3x3 layout: 8 cards around a fixed center product image (index 4)
  const grid: (Card | "center")[] = [
    deck[0], deck[1], deck[2],
    deck[3], "center", deck[4],
    deck[5], deck[6], deck[7],
  ];

  return (
    <div className="min-h-screen">
      <Header />
      {showStart && (
        <StartOverlay
          emoji="🧠"
          title="Memory Match"
          lines={[
            "Flip cards to find matching pairs.",
            "The Revital product stays in the center as your guide.",
            "Match all 4 pairs as fast as you can!",
          ]}
          onStart={() => setShowStart(false)}
        />
      )}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">🧠 Memory Match</h1>
          <p className="text-sm text-muted-foreground mt-1">Match all {TOTAL_PAIRS} pairs · {Math.max(0, MAX_DURATION - seconds)}s left</p>
          <ProgressDots current="memory" />
        </div>

        <div className="mt-5 flex justify-around bg-gradient-card border border-border rounded-2xl p-3">
          <Stat label="Moves" value={moves} />
          <Stat label="Time" value={`${seconds}s`} />
          <Stat label="Pairs" value={`${deck.filter(c=>c.matched).length/2}/${TOTAL_PAIRS}`} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3">
          {grid.map((cell, idx) => {
            if (cell === "center") {
              return (
                <div
                  key="center"
                  className="aspect-square rounded-2xl bg-gradient-card border-2 border-accent/60 shadow-glow flex items-center justify-center p-2 relative overflow-hidden"
                >
                  <img
                    src={revitalProduct}
                    alt="Revital product"
                    className="w-full h-full object-contain"
                  />
                </div>
              );
            }
            const card = cell;
            const isUp = flipped.includes(card.id) || card.matched;
            return (
              <button
                key={`c-${card.id}-${idx}`}
                onClick={() => flip(card.id)}
                className="aspect-square perspective-card group"
                disabled={card.matched}
                aria-label="card"
              >
                <div className={`relative w-full h-full preserve-3d transition-transform duration-500 ${isUp ? "[transform:rotateY(180deg)]" : ""}`}>
                  <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-energy shadow-card group-active:scale-95 transition-transform flex items-center justify-center">
                    <span className="text-2xl text-energy-foreground/40 font-black">?</span>
                  </div>
                  <div className={`absolute inset-0 backface-hidden [transform:rotateY(180deg)] rounded-2xl ${card.matched ? "bg-accent/30 ring-2 ring-accent" : "bg-card"} border border-border flex items-center justify-center text-3xl md:text-5xl`}>
                    {card.symbol}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 backdrop-blur-md px-4">
              <div className="bg-gradient-card border border-border rounded-3xl p-8 text-center shadow-card max-w-sm w-full">
                <div className="text-5xl mb-3">🧠</div>
                <h2 className="text-2xl font-black text-gradient-energy">Nice work!</h2>
                <p className="mt-3 text-sm text-muted-foreground">Loading next challenge…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Link to="/challenges" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to challenges
        </Link>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-black text-gradient-energy">{value}</div>
    </div>
  );
}
