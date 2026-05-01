import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { getUser } from "@/lib/storage";
import { Leaderboard } from "@/components/Leaderboard";
import { getDailyLeaderboard, getGlobalLeaderboard, type LeaderEntry } from "@/lib/leaderboard";
import heroWordmark from "@/assets/revital-hero-wordmark.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const defaultAnnouncement = "🔥 Play now and become today's Revital Energy Challenge winner!";
  const [daily, setDaily] = useState<LeaderEntry[]>([]);
  const [global, setGlobal] = useState<LeaderEntry[]>([]);
  const [announcements, setAnnouncements] = useState<string[]>([defaultAnnouncement]);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getUser()));
  useEffect(() => {
    const syncAuth = () => setIsLoggedIn(Boolean(getUser()));
    window.addEventListener("revital-auth-changed", syncAuth);

    getDailyLeaderboard().then(setDaily);
    getGlobalLeaderboard().then(setGlobal);
    import("@/server/adminFns")
      .then((mod) => mod.getPlatformSettingsFn())
      .then((settings) => {
        if (settings.homeAnnouncementMode === "text") {
          const texts = (settings.homeAnnouncementTexts ?? [])
            .map((text) => text.trim())
            .filter(Boolean);
          setAnnouncements(texts.length ? texts : [defaultAnnouncement]);
          return;
        }
        getDailyLeaderboard().then((entries) => {
          const winner = entries[0];
          if (winner) {
            setAnnouncements([`🏆 Today's Winner: ${winner.name} with ${winner.score} points!`]);
          }
        });
      })
      .catch(() => null);

    return () => window.removeEventListener("revital-auth-changed", syncAuth);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-[var(--marigold)] rounded-full blur-3xl opacity-50 float-anim" />
      <div
        className="absolute top-40 -left-32 w-96 h-96 bg-[var(--tiger)] rounded-full blur-3xl opacity-30 float-anim"
        style={{ animationDelay: "1.5s" }}
      />

      <div className="announcement-track">
        <div className="announcement-marquee">
          {[...announcements, ...announcements].map((item, index) => (
            <span key={`${item}-${index}`} aria-hidden={index >= announcements.length}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <Header />

      {/* HERO */}
      <main className="relative max-w-6xl mx-auto px-4 pt-8 md:pt-14 pb-16">
        <section className="text-center">
          <motion.img
            src={heroWordmark}
            alt="Revital Energy Challenge"
            className="mx-auto h-28 md:h-48 w-auto drop-shadow-2xl"
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
            YOUR DAY TESTS YOU
            <br />
            <span className="text-gradient-energy">ARE YOU READY?</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-5 text-base md:text-xl text-garnet/80 max-w-2xl mx-auto"
          >
            Take the Revital{" "}
            <span className="font-script text-[var(--tiger)] text-xl md:text-2xl">
              Energy Challenge
            </span>
            <br />
            Play 3 quick games. Score your energy. Climb the leaderboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/play/reflex"
              className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full bg-gradient-energy text-white font-bold text-lg shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform"
            >
              <span className="relative z-10">Start Now! →</span>
              <span className="absolute inset-0 rounded-full shimmer opacity-0 group-hover:opacity-100" />
            </Link>
            <Link
              to={isLoggedIn ? "/profile" : "/auth"}
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
              { n: "15s", label: "Per challenge" },
              { n: "Daily", label: "Leaderboard" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/90 border-2 border-[var(--garnet)]/10 rounded-2xl p-4 backdrop-blur shadow-card"
              >
                <div className="text-2xl md:text-4xl font-black text-gradient-energy">{s.n}</div>
                <div className="text-[11px] md:text-sm text-muted-foreground uppercase tracking-wider mt-1 font-semibold">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* HOW TO PARTICIPATE */}
        <section className="mt-20 md:mt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-[var(--tiger)] text-white text-xs uppercase tracking-[0.2em] font-black">
              🎮 How to Participate
            </div>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-garnet">
              Get Started in <span className="text-gradient-energy">3 Easy Steps</span>
            </h2>
            <p className="mt-2 text-muted-foreground">
              No sign-up required. Just show up, play, and win.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                step: "01",
                emoji: "⚡",
                title: "Start the Challenge",
                desc: 'Hit "Start Now!" to kick off your first mini-game. No account needed — just your energy and reflexes.',
              },
              {
                step: "02",
                emoji: "🎯",
                title: "Play 3 Quick Games",
                desc: "Complete the Reflex, Balance, and Memory challenges. Each game takes about 15 seconds. Score as high as you can!",
              },
              {
                step: "03",
                emoji: "🏆",
                title: "Claim Your Score",
                desc: "Verify with OTP to save your score, climb the leaderboard, and compete for daily prizes.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative bg-white/90 border-2 border-[var(--garnet)]/10 rounded-2xl p-6 backdrop-blur shadow-card flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{item.emoji}</span>
                  <span className="text-xs font-black text-[var(--tiger)] uppercase tracking-widest">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg font-black text-garnet">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <Link
              to="/play/reflex"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-energy text-white font-bold text-lg shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform"
            >
              I'm Ready — Let's Go! →
            </Link>
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
            <p className="mt-2 text-muted-foreground">
              Daily prizes for the daily board. Eternal glory for the global one.
            </p>
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
              to="/play/reflex"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--garnet)] text-white font-bold hover:scale-105 active:scale-95 transition-transform shadow-button"
            >
              Join the Leaderboard →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
