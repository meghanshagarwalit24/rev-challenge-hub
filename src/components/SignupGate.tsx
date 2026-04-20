import { useState } from "react";
import { motion } from "framer-motion";
import { categorize, computeTotal, getCurrentScores, saveUser } from "@/lib/storage";

interface SignupGateProps {
  onSuccess: () => void;
}

export function SignupGate({ onSuccess }: SignupGateProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = (v: string) =>
    /^\S+@\S+\.\S+$/.test(v) || /^\+?\d{8,15}$/.test(v.replace(/\s/g, ""));

  const completeSignup = (contactValue: string, displayName: string) => {
    const scores = getCurrentScores();
    const total = computeTotal(scores);
    const cat = categorize(total);
    saveUser({
      contact: contactValue.trim(),
      name: displayName.trim() || undefined,
      scores,
      total,
      category: cat.label,
      consent: true,
      createdAt: new Date().toISOString(),
    });
    onSuccess();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Please enter your name");
    if (!valid(contact)) return setErr("Enter a valid email or mobile number");
    if (!consent) return setErr("Please accept the consent to continue");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      completeSignup(contact, name);
    }, 500);
  };

  const google = () => {
    if (!consent) return setErr("Please accept the consent to continue with Google");
    completeSignup("google.user@revital.demo", name || "Google User");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md px-4 overflow-y-auto py-8"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-md bg-gradient-card border border-border rounded-3xl p-6 shadow-card"
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="text-2xl md:text-3xl font-black text-gradient-energy">Unlock Your Score</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your details to reveal your Energy Score and qualify for the daily prize.
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Email or Mobile Number</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="you@email.com  or  +971 50 123 4567"
              className="mt-1.5 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 accent-[oklch(0.72_0.19_50)]"
            />
            <span className="text-xs text-muted-foreground">
              I agree to be contacted by Revital about campaigns & rewards, and accept the privacy policy (UAE compliant).
            </span>
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            disabled={loading}
            className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? "Saving..." : "Reveal My Score →"}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            type="button"
            onClick={google}
            className="w-full py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.1z"/><path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2.1 14-5.5l-6.5-5.3c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.5 39 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3c-.5.5 7-5.1 7-15 0-1.2-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
