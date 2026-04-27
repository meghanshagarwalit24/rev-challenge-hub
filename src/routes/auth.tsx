import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Header } from "@/components/Header";
import {
  categorize,
  computeTotal,
  findUserByContact,
  generateUserId,
  getCurrentScores,
  MOCK_OTP,
  normalizeUsername,
  saveUser,
  saveUserRemote,
} from "@/lib/storage";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";

export const Route = createFileRoute("/auth")({
  component: Auth,
});

function Auth() {
  const nav = useNavigate();
  const [step, setStep] = useState<"contact" | "otp">("contact");
  const [contact, setContact] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const buildAutoUsername = (value: string, existingUsername?: string): string => {
    if (existingUsername) return normalizeUsername(existingUsername);
    const normalizedContact = value.trim().toLowerCase();
    const localPart = normalizedContact.includes("@")
      ? normalizedContact.split("@")[0]
      : normalizedContact.replace(/\D/g, "").slice(-8);
    const base = normalizeUsername(localPart || "player");
    return `${base}-${Math.random().toString(36).slice(2, 6)}`;
  };

  const { signIn: googleSignIn } = useGoogleSignIn({
    onSuccess: async (profile) => {
      setErr("");
      setLoading(true);
      const scores = getCurrentScores();
      const total = computeTotal(scores);
      const cat = categorize(total);
      const existing = findUserByContact(profile.email);
      const normalizedUsername = buildAutoUsername(profile.email, existing?.username);
      const payload = {
        userId: existing?.userId ?? generateUserId(),
        contact: profile.email,
        username: normalizedUsername || existing?.username,
        name: profile.name || existing?.name || "Google User",
        address: existing?.address,
        scores,
        total,
        category: cat.label,
        consent: true,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        referredBy: referredBy.trim() || existing?.referredBy,
        referCount: existing?.referCount ?? 0,
      };
      // Persist local login state immediately so `/profile` always opens after auth.
      saveUser(payload);
      try {
        await saveUserRemote(payload);
        nav({ to: "/profile" });
      } catch (e) {
        console.warn("Save encountered an issue after OTP/google verification", e);
        nav({ to: "/profile" });
      } finally {
        setLoading(false);
      }
    },
    onError: (reason) => setErr(reason),
  });

  const valid = (v: string) =>
    /^\S+@\S+\.\S+$/.test(v) || /^\+?\d{8,15}$/.test(v.replace(/\s/g, ""));

  const sendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!valid(contact)) {
      setErr("Enter a valid email or mobile number");
      return;
    }
    if (!consent) {
      setErr("Please accept the consent to continue");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 600);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (otp !== MOCK_OTP) {
      setErr("Invalid code. Hint: 123456 (mock)");
      return;
    }
    setLoading(true);
    const scores = getCurrentScores();
    const total = computeTotal(scores);
    const cat = categorize(total);
    const existing = findUserByContact(contact.trim());
    const normalizedUsername = buildAutoUsername(contact.trim(), existing?.username);
    const payload = {
      userId: existing?.userId ?? generateUserId(),
      contact: contact.trim(),
      username: normalizedUsername || existing?.username,
      name: existing?.name,
      address: existing?.address,
      scores,
      total,
      category: cat.label,
      consent: true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      referredBy: referredBy.trim() || existing?.referredBy,
      referCount: existing?.referCount ?? 0,
    };
    // Persist local login state immediately so `/profile` always opens after OTP verification.
    saveUser(payload);
    try {
      await saveUserRemote(payload);
      nav({ to: "/profile" });
    } catch (e) {
      console.warn("Save encountered an issue after OTP verification", e);
      nav({ to: "/profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl md:text-4xl font-black">
            Save Your <span className="text-gradient-energy">Score</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Verify to qualify for daily rewards</p>
        </motion.div>

        <div className="mt-8 bg-gradient-card border border-border rounded-3xl p-6 shadow-card">
          <AnimatePresence mode="wait">
            {step === "contact" ? (
              <motion.form
                key="contact"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={sendOtp}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email or Mobile Number
                  </label>
                  <input
                    autoFocus
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="you@email.com  or  +971 50 123 4567"
                    className="mt-2 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Enter either your email address or mobile number — we'll send a one-time code.
                  </p>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Referred by{" "}
                    <span className="text-muted-foreground/60 normal-case font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    value={referredBy}
                    onChange={(e) => setReferredBy(e.target.value)}
                    placeholder="@friend_username"
                    className="mt-2 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Enter your friend's username who referred you — they'll get more chances to win!
                    🏆
                  </p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 accent-[oklch(0.72_0.19_50)]"
                  />
                  <span className="text-xs text-muted-foreground">
                    I agree to be contacted via email/phone about Revital campaigns and to the
                    privacy policy (UAE compliant).
                  </span>
                </label>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <button
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send OTP"}
                </button>
                <button
                  type="button"
                  onClick={googleSignIn}
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.1z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 43.5c5.4 0 10.3-2.1 14-5.5l-6.5-5.3c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.5 39 16.2 43.5 24 43.5z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3c-.5.5 7-5.1 7-15 0-1.2-.1-2.4-.4-3.5z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={verify}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to{" "}
                  <span className="text-foreground font-medium">{contact}</span>
                </p>
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[0.5em] text-2xl font-black bg-background/60 border border-border rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground/70 text-center">
                  Mock mode — use code <span className="font-mono text-accent">123456</span>
                </p>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <button className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform">
                  Verify & Save Score
                </button>
                <button
                  type="button"
                  onClick={() => setStep("contact")}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change number/email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <Link
          to="/result"
          className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to result
        </Link>
      </main>
    </div>
  );
}
