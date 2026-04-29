import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import {
  dedupeAttempts,
  findUserByContactRemote,
  getAllUsersRemote,
  getUser,
  saveUserRemote,
  totalToPercentage,
  type UserRecord,
} from "@/lib/storage";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const nav = useNavigate();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [referrerName, setReferrerName] = useState("");
  const [referralUsers, setReferralUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      nav({ to: "/auth" });
      return;
    }
    setUser(u);
    setName(u.name || "");
    setEmail(u.email || "");
    setAddress(u.address || "");

    const loadReferralData = async () => {
      try {
        const latestUser = await findUserByContactRemote(u.contact);
        const currentUser = latestUser ?? u;
        setUser(currentUser);
        setName(currentUser.name || "");
        setEmail(currentUser.email || "");
        setAddress(currentUser.address || "");

        const allUsers = await getAllUsersRemote();
        if (currentUser.referredBy) {
          const referrer = allUsers.find(
            (candidate) => candidate.userId.toUpperCase() === currentUser.referredBy?.toUpperCase(),
          );
          setReferrerName(referrer?.name || referrer?.contact || "");
        }
        setReferralUsers(
          allUsers.filter(
            (candidate) => candidate.referredBy?.toUpperCase() === currentUser.userId.toUpperCase(),
          ),
        );
      } catch {
        setReferrerName("");
        setReferralUsers([]);
      }
    };
    loadReferralData();
  }, [nav]);

  const attempts = useMemo(() => {
    if (!user) return [];
    const historic = dedupeAttempts([...(user.playAttempts ?? [])]);
    if (historic.length > 0) {
      return [...historic].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    }
    return [
      {
        playedAt: user.createdAt,
        date: user.createdAt.slice(0, 10),
        scores: user.scores,
        total: user.total,
        category: user.category,
      },
    ];
  }, [user]);

  if (!user) return null;

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth?ref=${encodeURIComponent(user.userId)}`
      : `/auth?ref=${encodeURIComponent(user.userId)}`;
  const hasSavedEmail = Boolean(user.email?.trim());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!hasSavedEmail && normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    const emailToPersist = hasSavedEmail ? user.email : normalizedEmail || undefined;
    const updated = {
      ...user,
      name: name.trim(),
      email: emailToPersist,
      address: address.trim(),
    };
    await saveUserRemote(updated);
    setUser(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyReferralUrl = async () => {
    const fallbackCopy = () => {
      const helper = document.createElement("textarea");
      helper.value = referralUrl;
      helper.setAttribute("readonly", "true");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      helper.style.pointerEvents = "none";
      document.body.appendChild(helper);
      helper.focus();
      helper.select();
      const copiedWithFallback = document.execCommand("copy");
      document.body.removeChild(helper);
      return copiedWithFallback;
    };

    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else if (!fallbackCopy()) {
        throw new Error("Copy failed");
      }
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-gradient-card border border-border rounded-3xl p-6 shadow-card text-center">
            <div className="text-5xl">🏆</div>
            <h1 className="mt-3 text-2xl md:text-3xl font-black">You're In!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your score is saved. You're now in the prize draw.
            </p>

            <div className="mt-5 bg-background/40 rounded-2xl p-4 text-left space-y-2">
              <Row label="User ID" value={user.userId} mono />
              <Row label="Mobile" value={user.contact} />
              {user.email && <Row label="Email" value={user.email} />}
              {user.name && <Row label="Name" value={user.name} />}
              {user.referredBy && <Row label="Referred By ID" value={user.referredBy} mono />}
              {user.referredBy && <Row label="Referrer Name" value={referrerName || "—"} />}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Score" value={`${user.total}`} />
              <Stat label="Tier" value={user.category.split(" ")[0]} />
              <Stat label="Eligible" value="✓" />
            </div>

            <div className="mt-4 bg-background/40 rounded-2xl p-4 text-left">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Your Referral URL
              </p>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={referralUrl}
                  className="flex-1 bg-background/60 border border-border rounded-xl px-3 py-2 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={copyReferralUrl}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted/40 transition-colors"
                >
                  {copied ? "Copied!" : copyError ? "Copy failed" : "Copy URL"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Total successful referrals:{" "}
                <span className="font-bold">{referralUsers.length}</span>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={save}
          className="mt-6 bg-gradient-card border border-border rounded-3xl p-6 shadow-card space-y-4"
        >
          <h2 className="font-black text-lg">
            Complete your profile{" "}
            <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </h2>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Full name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {!hasSavedEmail && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Gmail / Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="mt-2 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Address (for prize delivery)
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="mt-2 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform">
            {saved ? "✓ Saved!" : "Save Profile"}
          </button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 bg-gradient-card border border-border rounded-3xl p-6 shadow-card"
        >
          <h2 className="font-black text-lg">Date-wise Score History</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your saved attempts grouped by play date and final percentage score.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Final %</th>
                  <th className="py-2 pr-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt, idx) => (
                  <tr key={`${attempt.playedAt}-${idx}`} className="border-b border-border/40">
                    <td className="py-2 pr-3">{attempt.date}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">
                      {new Date(attempt.playedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-3 font-bold text-gradient-energy">
                      {totalToPercentage(attempt.total).toFixed(2)}%
                    </td>
                    <td className="py-2 pr-3">{attempt.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <div className="mt-6 flex gap-2">
          <Link
            to="/challenges"
            className="flex-1 text-center py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors"
          >
            Play Again
          </Link>
          <Link
            to="/"
            className="flex-1 text-center py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors"
          >
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/40 rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-black text-gradient-energy">{value}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <span className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
