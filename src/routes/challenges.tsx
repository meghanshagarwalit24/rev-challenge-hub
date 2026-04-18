import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { getCurrentScores } from "@/lib/storage";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/challenges")({
  component: Challenges,
});

const games = [
  {
    key: "reflex" as const, to: "/play/reflex" as const,
    title: "Reflex Tap", emoji: "⚡",
    desc: "Tap the moment the orb glows. Faster = higher score.",
    grad: "from-[oklch(0.88_0.17_90)] to-[oklch(0.72_0.19_50)]",
  },
  {
    key: "memory" as const, to: "/play/memory" as const,
    title: "Memory Match", emoji: "🧠",
    desc: "Flip cards & match all pairs. Fewer moves = bigger reward.",
    grad: "from-[oklch(0.72_0.19_50)] to-[oklch(0.55_0.22_30)]",
  },
  {
    key: "balance" as const, to: "/play/balance" as const,
    title: "Tap Balance", emoji: "🔥",
    desc: "Tap to keep the ember floating against gravity.",
    grad: "from-[oklch(0.55_0.22_30)] to-[oklch(0.45_0.18_28)]",
  },
];

function Challenges() {
  const [scores, setScores] = useState({ reflex: null, memory: null, balance: null } as ReturnType<typeof getCurrentScores>);
  useEffect(() => { setScores(getCurrentScores()); }, []);
  const allDone = scores.reflex !== null && scores.memory !== null && scores.balance !== null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl md:text-5xl font-black">Pick Your <span className="text-gradient-energy">Challenge</span></h1>
          <p className="mt-3 text-muted-foreground">Complete all 3 to qualify for daily rewards.</p>
          <ProgressDots />
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {games.map((g, i) => {
            const done = scores[g.key] !== null;
            return (
              <motion.div
                key={g.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                <Link to={g.to} className="block group">
                  <div className={`relative overflow-hidden rounded-3xl bg-gradient-card border border-border p-6 h-full shadow-card transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-glow group-active:scale-[0.98]`}>
                    <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${g.grad} opacity-30 blur-2xl group-hover:opacity-60 transition-opacity`} />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <div className="text-5xl">{g.emoji}</div>
                        {done && (
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-accent/20 text-accent border border-accent/40">
                            ✓ {scores[g.key]} pts
                          </span>
                        )}
                      </div>
                      <h3 className="mt-4 text-2xl font-black">{g.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
                      <div className="mt-6 inline-flex items-center gap-2 text-energy font-semibold text-sm">
                        {done ? "Play again" : "Start"} <span className="transition-transform group-hover:translate-x-1">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-10 text-center">
          {allDone ? (
            <Link to="/result" className="inline-flex px-8 py-4 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform">
              See Your Score →
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Finish all 3 challenges to reveal your total energy score.</p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
