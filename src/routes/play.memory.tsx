import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { saveGameScore } from "@/lib/storage";

export const Route = createFileRoute("/play/memory")({
  component: MemoryGame,
});

const SYMBOLS = ["⚡", "🔥", "💪", "🧠", "🌟", "❤️", "🏆", "🎯"];

interface Card { id: number; symbol: string; matched: boolean; }

function shuffle<T>(arr: T[]) { return arr.map(v => [Math.random(), v] as const).sort((a,b)=>a[0]-b[0]).map(([,v])=>v); }

function buildDeck(): Card[] {
  return shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({ id: i, symbol: s, matched: false }));
}

function MemoryGame() {
  const nav = useNavigate();
  const [deck, setDeck] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

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
    if (deck.every(c => c.matched) && !done) {
      setDone(true);
      // Score: ideal 8 moves, 30s. Penalize extra moves & time.
      const moveScore = Math.max(0, 100 - Math.max(0, moves - 8) * 5);
      const timeScore = Math.max(0, 100 - Math.max(0, seconds - 25) * 2);
      const score = Math.round((moveScore + timeScore) / 2);
      saveGameScore("memory", score);
    }
  }, [deck, done, moves, seconds]);

  const flip = (id: number) => {
    if (flipped.length === 2) return;
    if (flipped.includes(id)) return;
    if (deck.find(c => c.id === id)?.matched) return;
    setFlipped([...flipped, id]);
  };

  const reset = () => { setDeck(buildDeck()); setFlipped([]); setMoves(0); setSeconds(0); setDone(false); };

  const finalScore = Math.round((Math.max(0, 100 - Math.max(0, moves - 8) * 5) + Math.max(0, 100 - Math.max(0, seconds - 25) * 2)) / 2);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">🧠 Memory Match</h1>
          <p className="text-sm text-muted-foreground mt-1">Match all 8 pairs</p>
          <ProgressDots current="memory" />
        </div>

        <div className="mt-5 flex justify-around bg-gradient-card border border-border rounded-2xl p-3">
          <Stat label="Moves" value={moves} />
          <Stat label="Time" value={`${seconds}s`} />
          <Stat label="Pairs" value={`${deck.filter(c=>c.matched).length/2}/8`} />
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 md:gap-3">
          {deck.map(card => {
            const isUp = flipped.includes(card.id) || card.matched;
            return (
              <button
                key={card.id}
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-gradient-card border border-border rounded-3xl p-6 text-center shadow-card">
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-2xl font-black">Complete!</h2>
              <p className="text-muted-foreground mt-1">{moves} moves · {seconds}s</p>
              <p className="mt-4 text-3xl font-black text-gradient-energy">{finalScore}/100</p>
              <div className="mt-5 flex gap-2">
                <button onClick={reset} className="flex-1 py-3 rounded-full bg-muted hover:bg-muted/80 font-semibold transition-colors">Retry</button>
                <button onClick={() => nav({ to: "/challenges" })} className="flex-1 py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform">
                  Continue →
                </button>
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
