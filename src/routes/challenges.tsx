import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { ChallengeProgressBar } from "@/components/ChallengeProgressBar";
import { getCurrentScores, isGameUnlocked, CHALLENGE_ORDER, type GameKey } from "@/lib/storage";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/challenges")({
  component: Challenges,
});

const games: Array<{
  key: GameKey;
  to: "/play/reflex" | "/play/memory" | "/play/balance";
  title: string;
  emoji: string;
  desc: string;
  step: number;
}> = [
  { key: "reflex",  to: "/play/reflex",  step: 1, title: "Reflex Tap",   emoji: "⚡",
    desc: "Tap the moment the orb glows. Faster = higher score." },
  { key: "memory",  to: "/play/memory",  step: 2, title: "Memory Match", emoji: "🧠",
    desc: "Flip cards & match all pairs. Fewer moves = bigger reward." },
  { key: "balance", to: "/play/balance", step: 3, title: "Tap Balance",  emoji: "🔥",
    desc: "Tap to keep the ember floating in the sweet zone." },
];

function Challenges() {
  const [scores, setScores] = useState<ReturnType<typeof getCurrentScores>>({ reflex: null, memory: null, balance: null });
  useEffect(() => { setScores(getCurrentScores()); }, []);
  const allDone = CHALLENGE_ORDER.every((k) => scores[k] !== null);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[var(--marigold)] text-garnet text-xs uppercase tracking-[0.2em] font-black">
            Step by Step
          </div>
          <h1 className="mt-3 text-3xl md:text-5xl font-black text-garnet">
            Your <span className="text-gradient-energy">Challenge Path</span>
          </h1>
          <p className="mt-3 text-muted-foreground">Complete each challenge in order to unlock the next.</p>
          <ChallengeProgressBar />
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {games.map((g, i) => {
            const done = scores[g.key] !== null;
            const unlocked = isGameUnlocked(g.key);
            const isNext = !done && unlocked;

            const card = (
              <div
                className={`relative overflow-hidden rounded-3xl border-2 p-6 h-full shadow-card transition-all duration-300 ${
                  done
                    ? "bg-gradient-to-br from-[var(--marigold)]/30 to-white border-[var(--honey)]"
                    : isNext
                    ? "bg-white border-[var(--tiger)] group-hover:-translate-y-2 group-hover:shadow-glow group-active:scale-[0.98]"
                    : "bg-white/50 border-[var(--garnet)]/10 cursor-not-allowed"
                }`}
              >
                {/* step badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${
                    done ? "bg-[var(--honey)] text-white"
                    : isNext ? "bg-[var(--tiger)] text-white"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    Step {g.step}
                  </span>
                </div>

                {!unlocked && (
                  <div className="absolute inset-0 backdrop-blur-[2px] bg-white/30 z-10 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-5xl mb-2">🔒</div>
                      <div className="text-xs font-bold text-garnet uppercase tracking-wider">
                        Finish Step {g.step - 1} to Unlock
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="text-5xl">{g.emoji}</div>
                  {done && (
                    <span className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-full bg-[var(--honey)]/20 text-[var(--garnet)] border border-[var(--honey)]/40">
                      ✓ {scores[g.key]} pts
                    </span>
                  )}
                  <h3 className="mt-4 text-2xl font-black text-garnet">{g.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
                  <div className={`mt-6 inline-flex items-center gap-2 font-semibold text-sm ${
                    isNext ? "text-[var(--tiger)]" : done ? "text-[var(--honey)]" : "text-muted-foreground"
                  }`}>
                    {done ? "Play again" : isNext ? "Start now" : "Locked"}
                    {unlocked && <span className="transition-transform group-hover:translate-x-1">→</span>}
                  </div>
                </div>

                {isNext && (
                  <span className="absolute -top-2 -left-2 px-3 py-1 rounded-full bg-gradient-energy text-white text-[10px] font-black uppercase tracking-wider shadow-button glow-pulse">
                    ▶ Play Next
                  </span>
                )}
              </div>
            );

            return (
              <motion.div
                key={g.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                {unlocked ? (
                  <Link to={g.to} className="block group">{card}</Link>
                ) : (
                  <div className="block">{card}</div>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-10 text-center">
          {allDone ? (
            <Link to="/result" className="inline-flex px-8 py-4 rounded-full bg-gradient-energy text-white font-bold shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform">
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
