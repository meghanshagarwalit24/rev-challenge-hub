import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Flame,
  ScrollText,
  Settings,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  Shield,
  LogOut,
  X,
} from "lucide-react";
import { getAllUsersRemote, calcStreak, dedupeAttempts, type UserRecord } from "@/lib/storage";
import type { AdminLog, PlatformSettings } from "@/server/adminFns";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "overview" | "users" | "datewise" | "streaks" | "logs" | "settings";
type GameFilter = "all" | "reflex" | "memory" | "balance";

interface DateWiseEntry {
  date: string;
  users: {
    userId: string;
    contact: string;
    name?: string;
    scores: UserRecord["scores"];
    total: number;
    category: string;
  }[];
}

interface AdminUserRow extends UserRecord {
  selectedScores: UserRecord["scores"];
  selectedTotal: number;
  selectedCategory: string;
  selectedPlayedAt: string;
  attemptsInRange: number;
}

interface DateWiseAttemptGroup {
  date: string;
  attempts: NonNullable<UserRecord["playAttempts"]>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const CATEGORIES = ["Peak Performer", "High Energy", "Charged Up", "Warming Up", "Recharge Needed"];
const CHART_COLORS = ["#F37421", "#FAAD14", "#52C41A", "#1890FF", "#9B59B6"];

function groupByDate(users: UserRecord[]): DateWiseEntry[] {
  const map = new Map<string, DateWiseEntry["users"]>();
  for (const u of users) {
    const dates =
      u.playDates && u.playDates.length > 0
        ? u.playDates
        : [new Date(u.createdAt).toISOString().slice(0, 10)];
    for (const d of dates) {
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push({
        userId: u.userId,
        contact: u.contact,
        name: u.name,
        scores: u.scores,
        total: u.total,
        category: u.category,
      });
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, userList]) => ({ date, users: userList }));
}

function isComplete(scores: UserRecord["scores"]) {
  return scores.reflex !== null && scores.memory !== null && scores.balance !== null;
}

function pickBestAttempt(user: UserRecord, from?: string, to?: string) {
  const attempts = (user.playAttempts ?? []).filter((a) => isComplete(a.scores));
  const inRange = attempts.filter((a) => {
    if (from && a.date < from) return false;
    if (to && a.date > to) return false;
    return true;
  });
  const source = inRange.length > 0 ? inRange : attempts;
  if (source.length === 0) {
    if (!isComplete(user.scores)) return { best: null, countInRange: 0 };
    const fallbackDate = new Date(user.createdAt).toISOString().slice(0, 10);
    if ((from && fallbackDate < from) || (to && fallbackDate > to)) {
      return { best: null, countInRange: 0 };
    }
    return {
      best: {
        playedAt: user.createdAt,
        date: fallbackDate,
        scores: user.scores,
        total: user.total,
        category: user.category,
      },
      countInRange: 1,
    };
  }
  const best = source.reduce((top, cur) => (cur.total > top.total ? cur : top));
  return { best, countInRange: inRange.length || source.length };
}

function exportCsv(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  // Prepend UTF-8 BOM so Excel auto-detects the encoding for international characters
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(rows: (string | number)[][], filename: string) {
  // Uses SpreadsheetML (XML) format — no external library needed; Excel opens it natively
  const header = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Data"><Table>`;
  const footer = `</Table></Worksheet></Workbook>`;
  const xmlRows = rows
    .map(
      (r) =>
        `<Row>${r
          .map(
            (c) =>
              `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${String(c)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}</Data></Cell>`,
          )
          .join("")}</Row>`,
    )
    .join("");
  const blob = new Blob([header + xmlRows + footer], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Admin Component ───────────────────────────────────────────────────────
function Admin() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem("adminAuth") === "true",
  );
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    ga4: "",
    metaPixel: "",
    clarity: "",
    recaptchaSite: "",
    recaptchaSecret: "",
  });
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Filters
  const [filterCat, setFilterCat] = useState("all");
  const [filterGame, setFilterGame] = useState<GameFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [dateWiseSearch, setDateWiseSearch] = useState("");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const addLog = useCallback(async (action: string, details: string) => {
    try {
      const { addAdminLogFn } = await import("@/server/adminFns");
      await addAdminLogFn({ data: { action, details } });
    } catch (e) {
      if (import.meta.env.DEV) console.warn("Failed to add admin log:", e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, adminMod] = await Promise.all([getAllUsersRemote(), import("@/server/adminFns")]);
      setUsers(u);
      const [l, s] = await Promise.all([
        adminMod.getAdminLogsFn(),
        adminMod.getPlatformSettingsFn(),
      ]);
      setLogs(l);
      setSettings(s);
    } catch (e) {
      console.error("Admin load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadData();
      addLog("DASHBOARD_OPEN", "Admin dashboard opened");
    }
  }, [authenticated, loadData, addLog]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { verifyAdminPasswordFn } = await import("@/server/adminFns");
      const result = await verifyAdminPasswordFn({ data: { password: passInput } });
      if (result.ok) {
        sessionStorage.setItem("adminAuth", "true");
        setAuthenticated(true);
        setPassError(false);
      } else {
        setPassError(true);
      }
    } catch {
      setPassError(true);
    }
  };

  // ── Filtered users for table ─────────────────────────────────────────────────
  const filtered = useMemo<AdminUserRow[]>(
    () =>
      users
        .map((u) => {
          const picked = pickBestAttempt(u, from || undefined, to || undefined);
          if (!picked.best) return null;
          return {
            ...u,
            selectedScores: picked.best.scores,
            selectedTotal: picked.best.total,
            selectedCategory: picked.best.category,
            selectedPlayedAt: picked.best.playedAt,
            attemptsInRange: picked.countInRange,
          } as AdminUserRow;
        })
        .filter((u): u is AdminUserRow => !!u)
        .filter((u) => {
          if (filterCat !== "all" && u.selectedCategory !== filterCat) return false;
          if (filterGame !== "all" && u.selectedScores[filterGame] === null) return false;
          if (from && new Date(u.selectedPlayedAt) < new Date(from)) return false;
          if (to && new Date(u.selectedPlayedAt) > new Date(to + "T23:59:59")) return false;
          if (
            search &&
            !u.contact.toLowerCase().includes(search.toLowerCase()) &&
            !(u.name || "").toLowerCase().includes(search.toLowerCase()) &&
            !u.userId.toLowerCase().includes(search.toLowerCase())
          )
            return false;
          return true;
        }),
    [users, filterCat, filterGame, from, to, search],
  );

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = users.length;
    const avg = total ? Math.round(users.reduce((s, u) => s + u.total, 0) / total) : 0;
    const totals = users.map((u) => u.total).sort((a, b) => a - b);
    const median = totals.length
      ? totals.length % 2 === 0
        ? Math.round((totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2)
        : totals[Math.floor(totals.length / 2)]
      : 0;
    const bestScore = totals.length ? totals[totals.length - 1] : 0;
    const dist = CATEGORIES.map((label) => ({
      label,
      count: users.filter((u) => u.category === label).length,
    }));
    const completed = users.filter(
      (u) => u.scores.reflex !== null && u.scores.memory !== null && u.scores.balance !== null,
    ).length;
    const reflexPlayed = users.filter((u) => u.scores.reflex !== null).length;
    const memoryPlayed = users.filter((u) => u.scores.memory !== null).length;
    const balancePlayed = users.filter((u) => u.scores.balance !== null).length;
    const participation = [
      { name: "Reflex", value: reflexPlayed },
      { name: "Memory", value: memoryPlayed },
      { name: "Balance", value: balancePlayed },
      { name: "All 3", value: completed },
    ];
    const totalReferrals = users.reduce((s, u) => s + (u.referCount ?? 0), 0);
    const referredUsers = users.filter((u) => !!u.referredBy).length;
    const attemptsPerUser = total
      ? Number(
          (
            users.reduce(
              (sum, user) =>
                sum +
                Math.max(
                  dedupeAttempts(user.playAttempts ?? []).filter((attempt) =>
                    isComplete(attempt.scores),
                  ).length,
                  isComplete(user.scores) ? 1 : 0,
                ),
              0,
            ) / total
          ).toFixed(1),
        )
      : 0;
    const returningUsers = users.filter(
      (u) =>
        dedupeAttempts(u.playAttempts ?? []).filter((attempt) => isComplete(attempt.scores))
          .length > 1 || (u.playDates ?? []).length > 1,
    ).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const topReferrers = [...users]
      .filter((u) => (u.referCount ?? 0) > 0)
      .sort((a, b) => (b.referCount ?? 0) - (a.referCount ?? 0))
      .slice(0, 5);
    return {
      total,
      avg,
      median,
      bestScore,
      dist,
      completed,
      completionRate,
      participation,
      totalReferrals,
      referredUsers,
      attemptsPerUser,
      returningUsers,
      topReferrers,
    };
  }, [users]);

  // ── Date-wise ───────────────────────────────────────────────────────────────
  const dateWise = useMemo(() => {
    const all = groupByDate(users);
    if (!dateWiseSearch) return all;
    const q = dateWiseSearch.toLowerCase();
    return all
      .map((d) => ({
        ...d,
        users: d.users.filter(
          (u) =>
            u.contact.toLowerCase().includes(q) ||
            u.userId.toLowerCase().includes(q) ||
            (u.name || "").toLowerCase().includes(q),
        ),
      }))
      .filter((d) => d.date.includes(q) || d.users.length > 0);
  }, [users, dateWiseSearch]);

  // ── Streaks ─────────────────────────────────────────────────────────────────
  const streaks = useMemo(
    () =>
      [...users]
        .map((u) => ({ ...u, streak: calcStreak(u.playDates ?? []) }))
        .sort((a, b) => b.streak - a.streak),
    [users],
  );

  // ── Logs filtered ───────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    if (!logSearch) return logs;
    const q = logSearch.toLowerCase();
    return logs.filter(
      (l) => l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q),
    );
  }, [logs, logSearch]);

  const handleExportCsv = () => {
    const rows: (string | number)[][] = [
      [
        "User ID",
        "Contact",
        "Name",
        "Reflex",
        "Memory",
        "Balance",
        "Total",
        "Category",
        "Refer Count",
        "Referred By (User ID)",
        "Created",
      ],
      ...filtered.map((u) => [
        u.userId,
        u.contact,
        u.name || "",
        u.selectedScores.reflex ?? "",
        u.selectedScores.memory ?? "",
        u.selectedScores.balance ?? "",
        u.selectedTotal,
        u.selectedCategory,
        u.referCount ?? 0,
        u.referredBy || "",
        new Date(u.selectedPlayedAt).toISOString(),
      ]),
    ];
    exportCsv(rows, `revital-users-${Date.now()}.csv`);
    addLog("EXPORT_CSV", `Exported ${filtered.length} users as CSV`);
  };

  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      [
        "User ID",
        "Contact",
        "Name",
        "Reflex",
        "Memory",
        "Balance",
        "Total",
        "Category",
        "Refer Count",
        "Referred By (User ID)",
        "Created",
      ],
      ...filtered.map((u) => [
        u.userId,
        u.contact,
        u.name || "",
        u.selectedScores.reflex ?? "",
        u.selectedScores.memory ?? "",
        u.selectedScores.balance ?? "",
        u.selectedTotal,
        u.selectedCategory,
        u.referCount ?? 0,
        u.referredBy || "",
        new Date(u.selectedPlayedAt).toISOString(),
      ]),
    ];
    exportExcel(rows, `revital-users-${Date.now()}.xls`);
    addLog("EXPORT_EXCEL", `Exported ${filtered.length} users as Excel`);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { savePlatformSettingsFn, getAdminLogsFn } = await import("@/server/adminFns");
      await savePlatformSettingsFn({ data: settings });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      await addLog("SETTINGS_SAVED", "Platform settings updated");
      setLogs(await getAdminLogsFn());
    } catch (e) {
      console.error("Save settings error", e);
    }
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSidebarOpen(false);
    addLog("TAB_CHANGE", `Navigated to ${t}`);
  };

  // ── Login Screen ─────────────────────────────────────────────────────────────
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

  // ── Dashboard ────────────────────────────────────────────────────────────────
  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { id: "datewise", label: "Date-wise", icon: <CalendarDays className="w-4 h-4" /> },
    { id: "streaks", label: "Streaks", icon: <Flame className="w-4 h-4" /> },
    { id: "logs", label: "Admin Logs", icon: <ScrollText className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
          aria-label="Toggle sidebar"
        >
          <div className="w-5 h-0.5 bg-foreground mb-1" />
          <div className="w-5 h-0.5 bg-foreground mb-1" />
          <div className="w-5 h-0.5 bg-foreground" />
        </button>
        <Shield className="w-5 h-5 text-accent" />
        <span className="font-black text-sm tracking-wide">
          Admin <span className="text-gradient-energy">Dashboard</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh data"
            className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("adminAuth");
              setAuthenticated(false);
            }}
            title="Sign out"
            className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-30 w-56 bg-background border-r border-border flex flex-col pt-4 pb-6 gap-1
            top-14 h-[calc(100vh-3.5rem)] lg:h-auto transition-transform duration-200
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="px-3 mb-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground px-2">
              Navigation
            </p>
          </div>
          {navItems.map((n) => (
            <button
              key={n.id}
              onClick={() => handleTabChange(n.id)}
              className={`mx-2 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === n.id
                  ? "bg-accent/20 text-accent"
                  : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </aside>

        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6 min-w-0">
          {/* ── OVERVIEW ───────────────────────────────────────────────── */}
          {tab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SectionTitle>Campaign Overview</SectionTitle>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mt-4">
                <KpiCard title="Total Users" value={stats.total} />
                <KpiCard title="Avg Score" value={`${stats.avg}/300`} />
                <KpiCard title="Median Score" value={`${stats.median}/300`} />
                <KpiCard title="Best Score" value={`${stats.bestScore}/300`} />
                <KpiCard title="Completed All" value={stats.completed} />
                <KpiCard title="Conversion" value={`${stats.completionRate}%`} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <KpiCard title="Total Referrals" value={stats.totalReferrals} />
                <KpiCard title="Users Referred" value={stats.referredUsers} />
                <KpiCard title="Avg Attempts / User" value={stats.attemptsPerUser} />
                <KpiCard title="Returning Users" value={stats.returningUsers} />
              </div>

              <div className="mt-5 grid md:grid-cols-2 gap-4">
                <div className="bg-gradient-card border border-border rounded-3xl p-5 shadow-card">
                  <h3 className="font-black text-sm mb-3">Score Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.dist} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={44}
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.dist.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gradient-card border border-border rounded-3xl p-5 shadow-card">
                  <h3 className="font-black text-sm mb-3">Game Participation</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.participation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ name, value }: { name: string; value: number }) =>
                          `${name}: ${value}`
                        }
                      >
                        {stats.participation.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip
                        contentStyle={{
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {stats.topReferrers.length > 0 && (
                <div className="mt-5 bg-gradient-card border border-border rounded-3xl p-5 shadow-card">
                  <h3 className="font-black text-sm mb-3">🏆 Top Referrers</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <Th>Rank</Th>
                          <Th>Contact</Th>
                          <Th>Name</Th>
                          <Th>Referrals</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topReferrers.map((u, i) => (
                          <tr key={u.userId} className="border-b border-border/40">
                            <Td className="font-bold text-accent">#{i + 1}</Td>
                            <Td className="font-mono text-[11px]">{u.contact}</Td>
                            <Td>{u.name || "—"}</Td>
                            <Td className="font-bold text-gradient-energy">{u.referCount ?? 0}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── USERS TABLE ─────────────────────────────────────────────── */}
          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <SectionTitle>All Users</SectionTitle>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border hover:bg-muted/30 font-bold transition-colors text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Excel
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user…"
                    className="pl-7 pr-3 py-1.5 bg-background/60 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-ring text-xs"
                  />
                </div>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs"
                >
                  <option value="all">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filterGame}
                  onChange={(e) => setFilterGame(e.target.value as GameFilter)}
                  className="bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs"
                >
                  <option value="all">All games</option>
                  <option value="reflex">Reflex played</option>
                  <option value="memory">Memory played</option>
                  <option value="balance">Balance played</option>
                </select>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs"
                />
                <span className="self-center text-muted-foreground text-xs">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs"
                />
                {(search || filterCat !== "all" || filterGame !== "all" || from || to) && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFilterCat("all");
                      setFilterGame("all");
                      setFrom("");
                      setTo("");
                    }}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {filtered.length} of {users.length} users
              </p>

              <div className="mt-3 bg-gradient-card border border-border rounded-2xl overflow-x-auto shadow-card">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/10">
                      <Th>User ID</Th>
                      <Th>Contact</Th>
                      <Th>Name</Th>
                      <Th>Reflex</Th>
                      <Th>Memory</Th>
                      <Th>Balance</Th>
                      <Th>Total</Th>
                      <Th>Category</Th>
                      <Th>Refer Count</Th>
                      <Th>Referred By (User ID)</Th>
                      <Th>Timestamp</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={11}
                          className="py-10 text-center text-muted-foreground text-sm"
                        >
                          No users match filters.
                        </td>
                      </tr>
                    )}
                    {filtered.map((u, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelectedUserId(u.userId)}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors cursor-pointer"
                      >
                        <Td className="font-mono text-[11px]">{u.userId}</Td>
                        <Td className="font-mono text-[11px]">{u.contact}</Td>
                        <Td>{u.name || "—"}</Td>
                        <Td>{u.selectedScores.reflex ?? "—"}</Td>
                        <Td>{u.selectedScores.memory ?? "—"}</Td>
                        <Td>{u.selectedScores.balance ?? "—"}</Td>
                        <Td className="font-bold text-gradient-energy">{u.selectedTotal}</Td>
                        <Td>
                          <CategoryBadge cat={u.selectedCategory} />
                        </Td>
                        <Td className="font-bold text-center">{u.referCount ?? 0}</Td>
                        <Td className="font-mono text-[11px] text-muted-foreground uppercase">
                          {u.referredBy || "—"}
                        </Td>
                        <Td className="text-muted-foreground text-[11px]">
                          {new Date(u.selectedPlayedAt).toLocaleString()}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── DATE-WISE ───────────────────────────────────────────────── */}
          {tab === "datewise" && (
            <motion.div
              key="datewise"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SectionTitle>Date-wise Users</SectionTitle>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Users grouped by the dates they played.
              </p>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={dateWiseSearch}
                  onChange={(e) => setDateWiseSearch(e.target.value)}
                  placeholder="Search by date, user, contact…"
                  className="pl-7 pr-3 py-1.5 bg-background/60 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-ring text-xs w-full max-w-xs"
                />
              </div>

              <div className="space-y-3">
                {dateWise.length === 0 && (
                  <p className="text-muted-foreground text-sm py-8 text-center">No data yet.</p>
                )}
                {dateWise.map((d) => {
                  const isOpen = expandedDates.has(d.date);
                  const toggle = () => {
                    setExpandedDates((s) => {
                      const ns = new Set(s);
                      if (ns.has(d.date)) {
                        ns.delete(d.date);
                      } else {
                        ns.add(d.date);
                      }
                      return ns;
                    });
                  };
                  return (
                    <div
                      key={d.date}
                      className="bg-gradient-card border border-border rounded-2xl overflow-hidden shadow-card"
                    >
                      <button
                        onClick={toggle}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors text-left"
                      >
                        <div>
                          <span className="font-bold text-sm">{d.date}</span>
                          <span className="ml-3 text-xs text-muted-foreground">
                            {d.users.length} user{d.users.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="border-t border-border overflow-x-auto">
                          <table className="w-full text-sm min-w-[600px]">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/10 text-left">
                                <Th>User ID</Th>
                                <Th>Contact</Th>
                                <Th>Name</Th>
                                <Th>Reflex</Th>
                                <Th>Memory</Th>
                                <Th>Balance</Th>
                                <Th>Total</Th>
                                <Th>Category</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.users.map((u, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                                >
                                  <Td className="font-mono text-[11px]">{u.userId}</Td>
                                  <Td className="font-mono text-[11px]">{u.contact}</Td>
                                  <Td>{u.name || "—"}</Td>
                                  <Td>{u.scores.reflex ?? "—"}</Td>
                                  <Td>{u.scores.memory ?? "—"}</Td>
                                  <Td>{u.scores.balance ?? "—"}</Td>
                                  <Td className="font-bold text-gradient-energy">{u.total}</Td>
                                  <Td>
                                    <CategoryBadge cat={u.category} />
                                  </Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STREAKS ────────────────────────────────────────────────── */}
          {tab === "streaks" && (
            <motion.div
              key="streaks"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SectionTitle>Consistent Players</SectionTitle>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Users ranked by their current consecutive-day play streak.
              </p>

              <div className="bg-gradient-card border border-border rounded-2xl overflow-x-auto shadow-card">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/10 text-left">
                      <Th>#</Th>
                      <Th>User ID</Th>
                      <Th>Contact</Th>
                      <Th>Name</Th>
                      <Th>🔥 Streak (days)</Th>
                      <Th>Total Play Days</Th>
                      <Th>Score</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {streaks.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                          No users yet.
                        </td>
                      </tr>
                    )}
                    {streaks.map((u, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                      >
                        <Td className="text-muted-foreground">{i + 1}</Td>
                        <Td className="font-mono text-[11px]">{u.userId}</Td>
                        <Td className="font-mono text-[11px]">{u.contact}</Td>
                        <Td>{u.name || "—"}</Td>
                        <Td>
                          <span
                            className={`font-black text-base ${
                              u.streak >= 7
                                ? "text-orange-400"
                                : u.streak >= 3
                                  ? "text-yellow-400"
                                  : "text-foreground"
                            }`}
                          >
                            {u.streak}
                            {u.streak >= 7 ? " 🔥" : u.streak >= 3 ? " ⚡" : ""}
                          </span>
                        </Td>
                        <Td className="text-muted-foreground">{(u.playDates ?? []).length}</Td>
                        <Td className="font-bold text-gradient-energy">{u.total}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── LOGS ─────────────────────────────────────────────────────── */}
          {tab === "logs" && (
            <motion.div key="logs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <SectionTitle>Admin Logs</SectionTitle>
                <span className="text-xs text-muted-foreground bg-muted/20 border border-border px-3 py-1 rounded-full">
                  Read-only · Lifetime retention · {logs.length} entries
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                All admin actions are recorded here permanently. Deletion is disabled.
              </p>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search logs…"
                  className="pl-7 pr-3 py-1.5 bg-background/60 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-ring text-xs w-full max-w-xs"
                />
              </div>

              <div className="bg-gradient-card border border-border rounded-2xl overflow-x-auto shadow-card">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/10 text-left">
                      <Th>Timestamp</Th>
                      <Th>Action</Th>
                      <Th>Details</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-10 text-center text-muted-foreground text-sm">
                          No logs yet.
                        </td>
                      </tr>
                    )}
                    {filteredLogs.map((l, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                      >
                        <Td className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(l.timestamp).toLocaleString()}
                        </Td>
                        <Td>
                          <span className="font-mono text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded">
                            {l.action}
                          </span>
                        </Td>
                        <Td className="text-[12px]">{l.details}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── SETTINGS ─────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SectionTitle>Tracking & Security Settings</SectionTitle>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Settings are stored in the database and injected into all pages automatically.
              </p>

              <form onSubmit={saveSettings} className="space-y-4">
                <SettingsSection title="Google Analytics (GA4)">
                  <SettingsField
                    label="Measurement ID"
                    value={settings.ga4}
                    onChange={(v) => setSettings((s) => ({ ...s, ga4: v }))}
                    placeholder="G-XXXXXXXXXX"
                    hint="Paste your GA4 Measurement ID. The gtag script will be injected automatically."
                  />
                </SettingsSection>

                <SettingsSection title="Meta Pixel">
                  <SettingsField
                    label="Pixel ID"
                    value={settings.metaPixel}
                    onChange={(v) => setSettings((s) => ({ ...s, metaPixel: v }))}
                    placeholder="123456789012345"
                    hint="Found in Facebook Events Manager → Pixels → Your Pixel → Setup."
                  />
                </SettingsSection>

                <SettingsSection title="Microsoft Clarity">
                  <SettingsField
                    label="Project ID"
                    value={settings.clarity}
                    onChange={(v) => setSettings((s) => ({ ...s, clarity: v }))}
                    placeholder="abcdefghij"
                    hint="Found in Clarity dashboard → Settings → Overview → Project ID."
                  />
                </SettingsSection>

                <SettingsSection title="Google reCAPTCHA v2">
                  <div className="grid md:grid-cols-2 gap-3">
                    <SettingsField
                      label="Site Key (public)"
                      value={settings.recaptchaSite}
                      onChange={(v) => setSettings((s) => ({ ...s, recaptchaSite: v }))}
                      placeholder="6Lc…"
                      hint="Used client-side on forms."
                    />
                    <SettingsField
                      label="Secret Key (server)"
                      value={settings.recaptchaSecret}
                      onChange={(v) => setSettings((s) => ({ ...s, recaptchaSecret: v }))}
                      placeholder="6Lc…"
                      hint="Used server-side to verify tokens. Keep private."
                      isSecret
                    />
                  </div>
                </SettingsSection>

                <div className="flex items-center gap-3 pt-2">
                  <button className="px-6 py-2.5 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-sm">
                    Save Settings
                  </button>
                  {savedFlash && <span className="text-sm text-accent">✓ Saved</span>}
                </div>
              </form>
            </motion.div>
          )}
        </main>
      </div>

      {/* ── User Detail Modal ──────────────────────────────────────────────── */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          allUsers={users}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── User Detail Modal ──────────────────────────────────────────────────────────
function UserDetailModal({
  userId,
  allUsers,
  onClose,
}: {
  userId: string;
  allUsers: UserRecord[];
  onClose: () => void;
}) {
  const user = useMemo(() => allUsers.find((u) => u.userId === userId) ?? null, [allUsers, userId]);

  const completedAttempts = useMemo(() => {
    if (!user) return [];
    return dedupeAttempts([...(user.playAttempts ?? [])])
      .filter(
        (a) => a.scores.reflex !== null && a.scores.memory !== null && a.scores.balance !== null,
      )
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }, [user]);

  const dateWiseAttempts = useMemo<DateWiseAttemptGroup[]>(() => {
    const groups = new Map<string, NonNullable<UserRecord["playAttempts"]>>();
    for (const attempt of completedAttempts) {
      const bucket = groups.get(attempt.date) ?? [];
      bucket.push(attempt);
      groups.set(attempt.date, bucket);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, attempts]) => ({ date, attempts }));
  }, [completedAttempts]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-3xl shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full border border-border hover:bg-muted/20 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 py-6">
          {!user ? (
            <div className="text-center py-12">
              <p className="text-2xl font-black text-gradient-energy">User Not Found</p>
              <p className="text-sm text-muted-foreground mt-2">No user found with ID: {userId}</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-6 pr-10">
                <h1 className="text-2xl font-black">User Details</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user.name || "Unnamed"} · {user.contact}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{user.userId}</p>
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
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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
                            R:{a.scores.reflex ?? 0} · M:{a.scores.memory ?? 0} · B:
                            {a.scores.balance ?? 0}
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
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {referredUsers.map((u) => (
                        <div key={u.userId} className="rounded-xl border border-border/70 p-2.5">
                          <div className="text-sm font-semibold">{u.name || "—"}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {u.contact}
                          </div>
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

              <div className="bg-gradient-card border border-border rounded-2xl p-4 mt-4">
                <h2 className="font-bold text-sm mb-3">Date-wise Scores</h2>
                {dateWiseAttempts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No dated attempts available yet.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {dateWiseAttempts.map((d) => (
                      <div
                        key={d.date}
                        className="rounded-xl border border-border/70 overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
                          <div className="font-semibold text-sm">{d.date}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {d.attempts.length} run{d.attempts.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div className="divide-y divide-border/60">
                          {d.attempts.map((a, idx) => (
                            <div
                              key={`${d.date}-${a.playedAt}-${idx}`}
                              className="px-3 py-2 text-[11px] flex items-center justify-between gap-2"
                            >
                              <div className="text-muted-foreground">
                                {new Date(a.playedAt).toLocaleTimeString()}
                              </div>
                              <div className="font-medium">
                                R:{a.scores.reflex ?? 0} · M:{a.scores.memory ?? 0} · B:
                                {a.scores.balance ?? 0}
                              </div>
                              <div className="font-bold text-gradient-energy">{a.total}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-black">{children}</h2>;
}

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-4 shadow-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="text-2xl md:text-3xl font-black text-gradient-energy mt-1">{value}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`py-2.5 px-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2 px-3 ${className}`}>{children}</td>;
}

const catColors: Record<string, string> = {
  "Peak Performer": "bg-orange-500/15 text-orange-400",
  "High Energy": "bg-yellow-500/15 text-yellow-400",
  "Charged Up": "bg-green-500/15 text-green-400",
  "Warming Up": "bg-blue-500/15 text-blue-400",
  "Recharge Needed": "bg-purple-500/15 text-purple-400",
};

function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${catColors[cat] ?? "bg-muted/30"}`}
    >
      {cat}
    </span>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-5 shadow-card">
      <h3 className="font-black text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  isSecret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  isSecret?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">{hint}</p>}
      <input
        type={isSecret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
