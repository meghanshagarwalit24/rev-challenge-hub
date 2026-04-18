import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Header } from "@/components/Header";
import { findUserByContact, MOCK_OTP, type UserRecord } from "@/lib/storage";

export const Route = createFileRoute("/retrieve")({
  component: Retrieve,
});

function Retrieve() {
  const [step, setStep] = useState<"contact" | "otp" | "result">("contact");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [err, setErr] = useState("");

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const u = findUserByContact(contact.trim());
    if (!u) { setErr("No score found for this contact."); return; }
    setStep("otp");
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== MOCK_OTP) { setErr("Invalid code. Use 123456 (mock)."); return; }
    setUser(findUserByContact(contact.trim()));
    setStep("result");
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl md:text-4xl font-black">Retrieve Your <span className="text-gradient-energy">Score</span></h1>
          <p className="text-sm text-muted-foreground mt-2">Enter the email or mobile you registered with.</p>
        </motion.div>

        <div className="mt-8 bg-gradient-card border border-border rounded-3xl p-6 shadow-card">
          <AnimatePresence mode="wait">
            {step === "contact" && (
              <motion.form key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={next} className="space-y-4">
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Mobile or Email" className="w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
                {err && <p className="text-sm text-destructive">{err}</p>}
                <button className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform">Continue</button>
              </motion.form>
            )}
            {step === "otp" && (
              <motion.form key="o" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={verify} className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent.</p>
                <input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="• • • • • •" className="w-full text-center tracking-[0.5em] text-2xl font-black bg-background/60 border border-border rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
                <p className="text-[11px] text-muted-foreground/70 text-center">Mock — use <span className="font-mono text-accent">123456</span></p>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <button className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform">Verify</button>
              </motion.form>
            )}
            {step === "result" && user && (
              <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="text-5xl">⚡</div>
                <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">Your Score</p>
                <p className="text-5xl font-black text-gradient-energy mt-2">{user.total}<span className="text-lg text-muted-foreground">/300</span></p>
                <p className="mt-2 inline-block px-4 py-1 rounded-full bg-accent/15 border border-accent/40 text-accent font-semibold text-sm">{user.category}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                  <Mini label="Reflex" value={user.scores.reflex ?? 0} />
                  <Mini label="Memory" value={user.scores.memory ?? 0} />
                  <Mini label="Balance" value={user.scores.balance ?? 0} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Saved {new Date(user.createdAt).toLocaleString()}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">← Home</Link>
      </main>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/40 rounded-xl p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-black text-gradient-energy">{value}</div>
    </div>
  );
}
