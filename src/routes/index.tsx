import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Leaderboard } from "@/components/Leaderboard";
import { getDailyLeaderboard, getGlobalLeaderboard, type LeaderEntry } from "@/lib/leaderboard";
import logo from "@/assets/revital-logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [daily, setDaily] = useState<LeaderEntry[]>([]);
  const [global, setGlobal] = useState<LeaderEntry[]>([]);
  useEffect(() => {
    setDaily(getDailyLeaderboard());
    setGlobal(getGlobalLeaderboard());
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-[var(--marigold)] rounded-full blur-3xl opacity-50 float-anim" />
      <div className="absolute top-40 -left-32 w-96 h-96 bg-[var(--tiger)] rounded-full blur-3xl opacity-30 float-anim" style={{ animationDelay: "1.5s" }} />

      <Header />

      {/* HERO */}
      <main className="relative max-w-6xl mx-auto px-4 pt-8 md:pt-14 pb-16">
        <section className="text-center">
          <motion.img
            src={heroWordmark}
            alt="Revital Energy Challenge"
            className="mx-auto h-40 md:h-72 w-auto drop-shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12, delay: 0.1 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 inline-block px-4 py-1.5 rounded-full bg-[var(--garnet)] text-white text-xs uppercase tracking-[0.2em] font-bold shadow-button"
          >
            ⚡ Power Up. Play. Conquer.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 text-4xl md:text-7xl font-black leading-[1.05] text-garnet"
          >
            YOUR DAY TESTS YOU<br />
            <span className="text-gradient-energy">ARE YOU READY?</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-5 text-base md:text-xl text-garnet/80 max-w-2xl mx-auto"
          >
            Take the Revital <span className="font-script text-[var(--tiger)] text-xl md:text-2xl">Energy Challenge</span>
            <br />Play 3 quick games. Score your energy. Climb the leaderboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/challenges"
              className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full bg-gradient-energy text-white font-bold text-lg shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform"
            >
              <span className="relative z-10">Start Now! →</span>
              <span className="absolute inset-0 rounded-full shimmer opacity-0 group-hover:opacity-100" />
            </Link>
            <Link
              to="/retrieve"
              className="px-6 py-4 rounded-full border-2 border-[var(--garnet)]/20 bg-white/80 backdrop-blur text-garnet hover:bg-white hover:border-[var(--tiger)] transition-colors font-semibold"
            >
              View My Score
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-12 grid grid-cols-3 gap-3 md:gap-6 max-w-2xl mx-auto"
          >
            {[
              { n: "3", label: "Quick games" },
              { n: "60s", label: "Per challenge" },
              { n: "Daily", label: "Leaderboard" },
            ].map((s) => (
              <div key={s.label} className="bg-white/90 border-2 border-[var(--garnet)]/10 rounded-2xl p-4 backdrop-blur shadow-card">
                <div className="text-2xl md:text-4xl font-black text-gradient-energy">{s.n}</div>
                <div className="text-[11px] md:text-sm text-muted-foreground uppercase tracking-wider mt-1 font-semibold">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* LEADERBOARDS */}
        <section className="mt-20 md:mt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-[var(--marigold)] text-garnet text-xs uppercase tracking-[0.2em] font-black">
              🏆 Hall of Champions
            </div>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-garnet">
              Who's <span className="text-gradient-energy">Topping the Charts?</span>
            </h2>
            <p className="mt-2 text-muted-foreground">Daily prizes for the daily board. Eternal glory for the global one.</p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2">
            <Leaderboard
              title="Today's Leaders"
              subtitle="Daily Reward Pool"
              emoji="🔥"
              entries={daily}
              accent="tiger"
            />
            <Leaderboard
              title="Global Leaderboard"
              subtitle="All-Time Top 10"
              emoji="👑"
              entries={global}
              accent="marigold"
              highlightWinner={false}
            />
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/challenges"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--garnet)] text-white font-bold hover:scale-105 active:scale-95 transition-transform shadow-button"
            >
              Join the Leaderboard →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
