import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import type { UserRecord } from "@/lib/storage";
import { calcStreak } from "@/lib/storage";

export const Route = createFileRoute("/admin/user/$userId")({
  component: AdminUserDetail,
});

function isComplete(scores: UserRecord["scores"]) {
  return scores.reflex !== null && scores.memory !== null && scores.balance !== null;
}

function AdminUserDetail() {
  const { userId } = Route.useParams();

  const [authenticated, setAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { verifyAdminPasswordFn } = await import("@/server/adminFns");
      const result = await verifyAdminPasswordFn({ data: { password: passInput } });
      if (result.ok) {
        setAuthenticated(true);
        setPassError(false);
      } else {
        setPassError(true);
      }
    } catch {
      setPassError(true);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    (async () => {
      try {
        const { getUserByIdFn } = await import("@/server/userFns");
        const { getAllUsersFn } = await import("@/server/userFns");
        const [found, all] = await Promise.all([
          getUserByIdFn({ data: { userId } }),
          getAllUsersFn(),
        ]);
        if (!found) {
          setNotFound(true);
        } else {
          setUser(found);
        }
        setAllUsers(all);
      } catch (e) {
        console.error("Failed to load user", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [authenticated, userId]);

  const completedAttempts = useMemo(() => {
    if (!user) return [];
    return [...(user.playAttempts ?? [])].filter((a) => isComplete(a.scores)).sort((a, b) =>
      b.playedAt.localeCompare(a.playedAt),
    );
  }, [user]);

  const bestAttempt = useMemo(() => {
    if (completedAttempts.length === 0) return null;
    return completedAttempts.reduce((top, cur) => (cur.total > top.total ? cur : top));
  }, [completedAttempts]);

  const referredUsers = useMemo(() => {
    if (!user) return [];
    return allUsers
      .filter((u) => u.referredBy?.toUpperCase() === user.userId.toUpperCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allUsers, user]);

  const streak = useMemo(() => calcStreak(user?.playDates ?? []), [user]);

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-3 justify-center mb-8">
            <Shield className="w-8 h-8 text-accent" />
            <h1 className="text-2xl font-black">
              Admin <span className="text-gradient-energy">Access</span>
            </h1>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-gradient-card border border-border rounded-3xl p-6 shadow-card space-y-4"
          >
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="mt-1.5 w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </label>
            {passError && <p className="text-xs text-red-400">Incorrect password.</p>}
            <button className="w-full px-6 py-2.5 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-sm">
              Sign In
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm animate-pulse">Loading user details…</p>
      </div>
    );
  }

  // ── Not Found ───────────────────────────────────────────────────────────────
  if (notFound || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-2xl font-black text-gradient-energy">User Not Found</p>
          <p className="text-sm text-muted-foreground mt-2">No user found with ID: {userId}</p>
          <button
            onClick={() => window.close()}
            className="mt-6 px-5 py-2 rounded-full border border-border text-sm hover:bg-muted/20"
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  // ── User Detail ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.close()}
            className="p-2 rounded-full border border-border hover:bg-muted/20 transition-colors"
            title="Close tab"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black">User Details</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.name || "Unnamed"} · {user.contact}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{user.userId}</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard title="Best Score" value={bestAttempt?.total ?? 0} />
          <KpiCard title="Completed Attempts" value={completedAttempts.length} />
          <KpiCard title="Users Referred" value={referredUsers.length} />
          <KpiCard title="Current Streak" value={`${streak}d`} />
        </div>

        {/* User info */}
        <div className="bg-gradient-card border border-border rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-sm mb-3">Profile</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <InfoRow label="User ID" value={user.userId} mono />
            <InfoRow label="Contact" value={user.contact} mono />
            {user.name && <InfoRow label="Name" value={user.name} />}
            {user.address && <InfoRow label="Address" value={user.address} />}
            <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleString()} />
            <InfoRow label="Category" value={user.category} />
            <InfoRow label="Total (Best)" value={String(user.total)} />
            {user.referredBy && <InfoRow label="Referred By" value={user.referredBy} mono />}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* All Completed Attempts */}
          <div className="bg-gradient-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-3">All Completed Attempts</h2>
            {completedAttempts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No completed 3-game runs found.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {completedAttempts.map((a, idx) => (
                  <div
                    key={`${a.playedAt}-${idx}`}
                    className="rounded-xl border border-border/70 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(a.playedAt).toLocaleString()}
                      </div>
                      <div className="font-bold text-gradient-energy">{a.total}</div>
                    </div>
                    <div className="text-[11px] mt-1">
                      R:{a.scores.reflex ?? 0} · M:{a.scores.memory ?? 0} · B:{a.scores.balance ?? 0}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{a.category}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Referred Users */}
          <div className="bg-gradient-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-3">Referred Users</h2>
            {referredUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No referrals yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {referredUsers.map((u) => (
                  <div key={u.userId} className="rounded-xl border border-border/70 p-2.5">
                    <div className="text-sm font-semibold">{u.name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{u.contact}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Joined: {new Date(u.createdAt).toLocaleString()}
                    </div>
                    <div className="text-[11px] font-semibold text-gradient-energy">
                      Best: {u.total}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-4 shadow-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="text-2xl md:text-3xl font-black text-gradient-energy mt-1">{value}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
