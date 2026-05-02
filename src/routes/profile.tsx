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
  resetScores,
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
  const [copiedUserId, setCopiedUserId] = useState(false);
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
    return [];
  }, [user]);

  if (!user) return null;

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${encodeURIComponent(user.userId)}`
      : `/?ref=${encodeURIComponent(user.userId)}`;
  const hasSavedEmail = Boolean(user.email?.trim());
  const finalPercentage = totalToPercentage(user.total).toFixed(2);
  const finalPercentageValue = Number(finalPercentage);
  const hasCompletedRun =
    user.scores.reflex !== null && user.scores.memory !== null && user.scores.balance !== null;
  const hasPlayedBefore = Boolean((user.playAttempts?.length ?? 0) > 0 || hasCompletedRun);
  const finalPercentDisplay = hasPlayedBefore ? `${finalPercentage}%` : "—";
  const tierDisplay = hasPlayedBefore ? user.category.split(" ")[0] : "Not started";
  const eligibleDisplay = hasPlayedBefore ? "✓" : "Not yet";
  const rankBands = [
    { grade: "D", label: "Recharge Needed", thresholdText: "< 20%", min: 0, max: 20 },
    { grade: "C", label: "Warming Up", thresholdText: "≥ 20%", min: 20, max: 40 },
    { grade: "B", label: "Charged Up", thresholdText: "≥ 40%", min: 40, max: 60 },
    { grade: "A", label: "High Energy", thresholdText: "≥ 60%", min: 60, max: 80 },
    { grade: "S", label: "Peak Performer", thresholdText: "≥ 80%", min: 80, max: 101 },
  ] as const;

  const currentBandGrade = hasPlayedBefore
    ? (rankBands.find((band) => finalPercentageValue >= band.min && finalPercentageValue < band.max)
        ?.grade ?? "D")
    : null;

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

  const copyToClipboard = async (value: string): Promise<boolean> => {
    const fallbackCopy = () => {
      const helper = document.createElement("textarea");
      helper.value = value;
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

    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    return fallbackCopy();
  };

  const copyReferralUrl = async () => {
    try {
      const success = await copyToClipboard(referralUrl);
      if (!success) throw new Error("Copy failed");
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  const copyUserId = async () => {
    try {
      const success = await copyToClipboard(user.userId);
      if (!success) throw new Error("Copy failed");
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 1500);
    } catch {
      setCopiedUserId(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8">
        <div className="sticky top-20 z-30 mb-4 rounded-2xl border border-border bg-background/85 p-2 shadow-sm backdrop-blur">
          <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
            <a
              href="#your-score-section"
              className="rounded-xl px-3 py-2 text-center font-semibold text-garnet hover:bg-[var(--marigold)]/30 transition-colors"
            >
              Your Score
            </a>
            <a
              href="#profile-section"
              className="rounded-xl px-3 py-2 text-center font-semibold text-garnet hover:bg-[var(--marigold)]/30 transition-colors"
            >
              Profile
            </a>
            <a
              href="#datewise-section"
              className="rounded-xl px-3 py-2 text-center font-semibold text-garnet hover:bg-[var(--marigold)]/30 transition-colors"
            >
              Date-wise Score
            </a>
          </div>
        </div>
        <motion.div
          id="your-score-section"
          className="scroll-mt-28"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-gradient-card border border-border rounded-3xl p-6 shadow-card text-center">
            <div className="text-5xl">{hasPlayedBefore ? "🏆" : "⚡"}</div>
            <h1 className="mt-3 text-2xl md:text-3xl font-black">
              {hasPlayedBefore ? "You're In!" : "You are yet to play"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hasPlayedBefore
                ? "Your score is saved. You're now in the prize draw."
                : "Play your first challenge to unlock your score band and start climbing the leaderboard."}
            </p>

            {!hasPlayedBefore && (
              <div className="mt-4">
                <Link
                  to="/play/reflex"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-energy text-white font-bold shadow-button hover:scale-105 active:scale-95 transition-transform"
                >
                  Play Now →
                </Link>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Final %" value={finalPercentDisplay} />
              <Stat label="Tier" value={tierDisplay} />
              <Stat label="Eligible" value={eligibleDisplay} />
            </div>

            <div className="mt-4 bg-background/40 rounded-2xl p-4 text-left">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Energy Rank Roadmap
              </p>
              <div className="mt-3 rounded-2xl border border-border/70 bg-white/70 p-3">
                <div className="relative h-44 overflow-hidden rounded-xl bg-slate-100/90">
                  <svg viewBox="0 0 100 40" className="absolute inset-0 h-full w-full">
                    <path
                      d="M 3 33 C 16 18, 24 34, 38 20 C 52 7, 61 30, 74 17 C 84 7, 91 13, 98 8"
                      fill="none"
                      stroke="#2f2f2f"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 3 33 C 16 18, 24 34, 38 20 C 52 7, 61 30, 74 17 C 84 7, 91 13, 98 8"
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute left-[2%] top-[66%] rounded-md border border-white/80 bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow">
                    STOP
                  </div>
                  <div className="absolute right-[5%] top-[4%] text-lg" aria-label="finish flag">
                    🏁
                  </div>
                  {["D", "C", "B", "A", "S"].map((grade, idx) => {
                    const nodePos = [
                      "left-[7%] top-[58%]",
                      "left-[22%] top-[40%]",
                      "left-[41%] top-[45%]",
                      "left-[60%] top-[30%]",
                      "left-[82%] top-[8%]",
                    ][idx];
                    const color = [
                      "bg-yellow-400",
                      "bg-red-500",
                      "bg-emerald-500",
                      "bg-blue-600",
                      "bg-purple-700",
                    ][idx];
                    const isCurrent = currentBandGrade === grade;
                    return (
                      <div key={grade} className={`absolute ${nodePos}`}>
                        <div
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white shadow-lg ${color} ${isCurrent ? "ring-4 ring-yellow-300" : ""}`}
                        >
                          {grade}
                          <span
                            className={`absolute left-1/2 top-[90%] h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent ${
                              idx === 0
                                ? "border-t-yellow-400"
                                : idx === 1
                                  ? "border-t-red-500"
                                  : idx === 2
                                    ? "border-t-emerald-500"
                                    : idx === 3
                                      ? "border-t-blue-600"
                                      : "border-t-purple-700"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs">
                  {rankBands
                    .slice()
                    .reverse()
                    .map((band) => (
                      <div
                        key={band.grade}
                        className="flex items-center justify-between rounded-lg bg-background/70 px-2 py-1"
                      >
                        <span className="font-bold text-garnet">
                          {band.grade} / {band.label}
                        </span>
                        <span className="text-muted-foreground">{band.thresholdText}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-4 bg-background/40 rounded-2xl p-4 text-left space-y-2">
              <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
                  User ID
                </span>
                <button
                  type="button"
                  onClick={copyUserId}
                  className="w-full text-left sm:text-right text-sm font-semibold font-mono break-all hover:text-primary transition-colors"
                  title="Copy User ID"
                >
                  {copiedUserId ? "Copied!" : user.userId}
                </button>
              </div>
              <Row label="Mobile" value={user.contact} />
              {user.email && <Row label="Email" value={user.email} />}
              {user.name && <Row label="Name" value={user.name} />}
              {user.referredBy && <Row label="Referred By ID" value={user.referredBy} mono />}
              {user.referredBy && <Row label="Referrer Name" value={referrerName || "—"} />}
            </div>

            <div className="mt-4 bg-background/40 rounded-2xl p-4 text-left">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Your Referral URL
              </p>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={referralUrl}
                  className="flex-1 min-w-0 bg-background/60 border border-border rounded-xl px-3 py-2 text-[11px] font-mono break-all"
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
          id="profile-section"
          className="mt-6 bg-gradient-card border border-border rounded-3xl p-6 shadow-card space-y-4 scroll-mt-28"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={save}
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
          id="datewise-section"
          className="mt-6 bg-gradient-card border border-border rounded-3xl p-6 shadow-card scroll-mt-28"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-black text-lg">Date-wise Score History</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your saved attempts grouped by play date and final percentage.
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
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                      No attempts yet. Play all three games to see your score history.
                    </td>
                  </tr>
                ) : (
                  attempts.map((attempt, idx) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              resetScores();
              nav({ to: "/challenges" });
            }}
            className="flex-1 text-center py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors"
          >
            {hasPlayedBefore ? "Play Again" : "Play"}
          </button>
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
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <span
        className={`w-full text-sm font-semibold sm:text-right ${mono ? "font-mono break-all" : "break-words"}`}
      >
        {value}
      </span>
    </div>
  );
}
