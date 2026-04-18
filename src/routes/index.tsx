import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import logo from "@/assets/revital-logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-energy rounded-full blur-3xl opacity-30 float-anim" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-flame rounded-full blur-3xl opacity-20 float-anim" style={{ animationDelay: "1.5s" }} />

      <Header />

      <main className="relative max-w-5xl mx-auto px-4 pt-10 md:pt-16 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.img
            src={logo}
            alt="Revital Energy Challenge"
            className="mx-auto h-32 md:h-44 drop-shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12, delay: 0.1 }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 inline-block px-4 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs uppercase tracking-[0.2em] font-semibold"
        >
          ⚡ Win prizes worth 100K AED
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-6 text-4xl md:text-7xl font-black leading-[1.05]"
        >
          Check Your <br />
          <span className="text-gradient-energy">Revital Energy</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="mt-5 text-base md:text-xl text-muted-foreground max-w-2xl mx-auto"
        >
          Your day tests you — <span className="font-script text-accent text-xl md:text-2xl">are you ready for it?</span>
          <br />Play 3 quick challenges. Get your energy score. Unlock daily rewards.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            to="/challenges"
            className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full bg-gradient-energy text-energy-foreground font-bold text-lg shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="relative z-10">Start Challenge →</span>
            <span className="absolute inset-0 rounded-full shimmer opacity-0 group-hover:opacity-100" />
          </Link>
          <Link
            to="/retrieve"
            className="px-6 py-4 rounded-full border border-border bg-card/40 backdrop-blur text-foreground/80 hover:text-foreground hover:bg-card/70 transition-colors font-medium"
          >
            View My Score
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-16 grid grid-cols-3 gap-3 md:gap-6 max-w-2xl mx-auto"
        >
          {[
            { n: "3", label: "Quick games" },
            { n: "60s", label: "Per challenge" },
            { n: "100K", label: "AED in prizes" },
          ].map((s) => (
            <div key={s.label} className="bg-gradient-card border border-border rounded-2xl p-4 backdrop-blur">
              <div className="text-2xl md:text-4xl font-black text-gradient-energy">{s.n}</div>
              <div className="text-[11px] md:text-sm text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
