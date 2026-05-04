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

  const currentBand = hasPlayedBefore
    ? (rankBands.find(
        (band) => finalPercentageValue >= band.min && finalPercentageValue < band.max,
      ) ?? rankBands[0])
    : null;
  const currentBandIndex = currentBand
    ? rankBands.findIndex((band) => band.grade === currentBand.grade)
    : -1;

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
              <p className="mt-1 text-xs text-muted-foreground">
                {hasPlayedBefore
                  ? `You are currently in ${currentBand?.grade} (${currentBand?.label}) at ${finalPercentage}%.`
                  : "Complete all 3 games once to get your first rank. Start from D and move upward to S."}
              </p>
              <div className="mt-3 rounded-2xl border border-border/70 bg-[#d9dde3] p-3 sm:p-4">
                <div className="relative h-40 sm:h-44 overflow-hidden rounded-xl bg-[#d0d4da]">
                  <svg viewBox="0 0 720 220" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <path
                      d="M20 185 C80 115, 150 200, 230 130 C300 70, 360 120, 430 150 C500 178, 560 85, 700 52"
                      fill="none"
                      stroke="#7A160D"
                      strokeWidth="42"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 185 C80 115, 150 200, 230 130 C300 70, 360 120, 430 150 C500 178, 560 85, 700 52"
                      fill="none"
                      stroke="#A7B0BA"
                      strokeWidth="6"
                      strokeDasharray="20 14"
                      strokeLinecap="round"
                    />
                    <text x="26" y="170" fill="#fff" fontSize="18" fontWeight="700">START</text>
                    <text x="650" y="32" fill="#3D3D3D" fontSize="18" fontWeight="700">🏁</text>
                  </svg>

                  {[
                    { grade: 'D', x: '10%', y: '66%', color: '#ffe500', textColor: '#6b2100' },
                    { grade: 'C', x: '26%', y: '40%', color: '#ff7a00', textColor: '#3f1000' },
                    { grade: 'B', x: '46%', y: '47%', color: '#d5d9df', textColor: '#7A160D' },
                    { grade: 'A', x: '65%', y: '42%', color: '#a44f1a', textColor: '#fff' },
                    { grade: 'S', x: '88%', y: '18%', color: '#7A160D', textColor: '#fff' },
                  ].map((marker) => {
                    const isCurrent = hasPlayedBefore && currentBand?.grade === marker.grade;
                    const isUnlocked = hasPlayedBefore && currentBandIndex >= rankBands.findIndex((b) => b.grade === marker.grade);
                    return (
                      <div
                        key={marker.grade}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: marker.x, top: marker.y }}
                      >
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-black shadow"
                          style={{
                            backgroundColor: marker.color,
                            color: marker.textColor,
                            opacity: isUnlocked || !hasPlayedBefore ? 1 : 0.6,
                            transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                          }}
                        >
                          {marker.grade}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {rankBands
                  .slice()
                  .reverse()
                  .map((band) => {
                    const index = rankBands.findIndex((item) => item.grade === band.grade);
                  const isUnlocked = hasPlayedBefore && index <= currentBandIndex;
                  const isCurrent = hasPlayedBefore && currentBand?.grade === band.grade;
                  return (
                    <div
                      key={band.grade}
                      className={`rounded-xl border px-3 py-2 transition-colors ${
                        isCurrent
                          ? "border-[var(--garnet)] bg-[var(--marigold)]/30"
                          : isUnlocked
                            ? "border-border bg-background/80"
                            : "border-border/60 bg-background/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                              isCurrent
                                ? "bg-[var(--garnet)] text-white"
                                : isUnlocked
                                  ? "bg-[var(--garnet)]/80 text-white"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {band.grade}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-garnet">{band.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Target: {band.thresholdText}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {isCurrent ? "Current" : isUnlocked ? "Completed" : "Locked"}
                        </span>
                      </div>
                    </div>
                  );
                  })}
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
