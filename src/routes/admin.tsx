import { createFileRoute, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
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
  Trophy,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  Shield,
  LogOut,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getAllUsersRemote, calcStreak, dedupeAttempts, type UserRecord } from "@/lib/storage";
import type { AdminLog, PlatformSettings } from "@/server/adminFns";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "overview" | "users" | "datewise" | "winners" | "streaks" | "logs" | "settings";
type UserSortKey =
  | "userId"
  | "contact"
  | "email"
  | "name"
  | "referCount"
  | "referredBy"
  | "joinedOn"
  | "completeDays"
  | "all3Completed";
type SortDir = "asc" | "desc";

interface DateWiseEntry {
  date: string;
  users: {
    userId: string;
    contact: string;
    email?: string;
    name?: string;
    scores: UserRecord["scores"];
    total: number;
    category: string;
  }[];
  winners: {
    userId: string;
    contact: string;
    name?: string;
    total: number;
    scores: UserRecord["scores"];
  }[];
}

interface AdminUserRow extends UserRecord {
  selectedScores: UserRecord["scores"];
  selectedTotal: number;
  selectedCategory: string;
  selectedPlayedAt: string;
  attemptsInRange: number;
  joinedAtIso: string;
  joinedDays: number | null;
  currentStreak: number;
  completedAll3Plays: number;
  completedAll3Days: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const CATEGORIES = ["Peak Performer", "High Energy", "Charged Up", "Warming Up", "Recharge Needed"];
const CHART_COLORS = ["#F37421", "#FAAD14", "#52C41A", "#1890FF", "#9B59B6"];
const FALLBACK_DATE = "1970-01-01";

function getSafeDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getSafeIsoTimestamp(value?: string) {
  const date = getSafeDate(value);
  return date ? date.toISOString() : "";
}

function getSafeIsoDay(value?: string) {
  const iso = getSafeIsoTimestamp(value);
  return iso ? iso.slice(0, 10) : FALLBACK_DATE;
}

function getJoinedDays(value?: string) {
  const joinedDate = getSafeDate(value);
  if (!joinedDate) return null;
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now.getTime() - joinedDate.getTime()) / msPerDay));
}

function getCompletedAll3Days(user: UserRecord) {
  const completedAttempts = dedupeAttempts(user.playAttempts ?? []).filter((attempt) =>
    isComplete(attempt.scores),
  );
  const completedDays = new Set(
    completedAttempts
      .map((attempt) => getSafeIsoDay(attempt.playedAt || attempt.date))
      .filter((day) => day !== FALLBACK_DATE),
  );

  if (completedDays.size === 0 && isComplete(user.scores)) {
    completedDays.add(getSafeIsoDay(user.createdAt));
  }

  return completedDays.size;
}

function groupByDate(users: UserRecord[]): DateWiseEntry[] {
  const map = new Map<string, DateWiseEntry["users"]>();
  for (const u of users) {
    const completedAttempts = dedupeAttempts([...(u.playAttempts ?? [])]).filter((a) =>
      isComplete(a.scores),
    );
    if (completedAttempts.length > 0) {
      const bestByDate = new Map<string, (typeof completedAttempts)[number]>();
      for (const attempt of completedAttempts) {
        const current = bestByDate.get(attempt.date);
        if (
          !current ||
          attempt.total > current.total ||
          (attempt.total === current.total && attempt.playedAt > current.playedAt)
        ) {
          bestByDate.set(attempt.date, attempt);
        }
      }
      for (const [date, attempt] of bestByDate.entries()) {
        if (!map.has(date)) map.set(date, []);
        map.get(date)!.push({
          userId: u.userId,
          contact: u.contact,
          email: u.email,
          name: u.name,
          scores: attempt.scores,
          total: attempt.total,
          category: attempt.category,
        });
      }
      continue;
    }

    const fallbackDate = getSafeIsoDay(u.createdAt);
    if (!map.has(fallbackDate)) map.set(fallbackDate, []);
    map.get(fallbackDate)!.push({
      userId: u.userId,
      contact: u.contact,
      email: u.email,
      name: u.name,
      scores: u.scores,
      total: u.total,
      category: u.category,
    });
  }
  const sortedEntries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  const priorWinnerIds = new Set<string>();
  const withWinners = sortedEntries.map(([date, userList]) => {
    const sortedUsers = [...userList].sort((a, b) => b.total - a.total);
    const winners = [...userList]
      .filter((u) => !priorWinnerIds.has(u.userId))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((u) => ({
        userId: u.userId,
        contact: u.contact,
        name: u.name,
        total: u.total,
        scores: u.scores,
      }));

    winners.forEach((winner) => priorWinnerIds.add(winner.userId));
    return { date, users: sortedUsers, winners };
  });

  return withWinners.sort((a, b) => b.date.localeCompare(a.date));
}

async function downloadDailyWinnersImage(
  date: string,
  winners: DateWiseEntry["winners"],
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, 1200, 1600);
  bg.addColorStop(0, "#FFE882");
  bg.addColorStop(0.45, "#F7C452");
  bg.addColorStop(1, "#E9972E");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#7A1F1F";
  ctx.font = "bold 88px Arial";
  ctx.fillText("REVITAL ENERGY", 90, 170);
  ctx.font = "bold 64px Arial";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Daily Top 10 Winners", 90, 250);

  ctx.fillStyle = "rgba(122,31,31,0.18)";
  ctx.fillRect(80, 300, 1040, 1180);

  ctx.fillStyle = "#7A1F1F";
  ctx.font = "bold 36px Arial";
  ctx.fillText(`Date: ${date}`, 110, 355);

  winners.forEach((winner, index) => {
    const y = 420 + index * 100;
    ctx.fillStyle = index < 3 ? "#7A1F1F" : "#4C2A16";
    ctx.font = index < 3 ? "bold 34px Arial" : "bold 30px Arial";
    const displayName = winner.name?.trim() || winner.contact;
    ctx.fillText(`${index + 1}. ${displayName}`, 120, y);
    ctx.font = "bold 26px Arial";
    ctx.fillText(`Score: ${winner.total}`, 830, y);
  });

  ctx.fillStyle = "#7A1F1F";
  ctx.font = "bold 30px Arial";
  ctx.fillText("Powered by Revital Ginseng Plus", 90, 1530);

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `revital-daily-winners-${date}.png`;
  a.click();
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
    const fallbackDate = getSafeIsoDay(user.createdAt);
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
      countInRange: isComplete(user.scores) ? 1 : 0,
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

function exportPdf(rows: (string | number)[][], filename: string) {
  const [header, ...body] = rows;
  const escaped = (value: string | number) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escaped(filename)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { margin: 0 0 12px 0; font-size: 18px; }
          p { margin: 0 0 12px 0; font-size: 12px; color: #444; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Revital Users Export</h1>
        <p>Generated at: ${escaped(new Date().toLocaleString())}</p>
        <table>
          <thead>
            <tr>${header.map((cell) => `<th>${escaped(cell)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${body
              .map((row) => `<tr>${row.map((cell) => `<td>${escaped(cell)}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// ── Main Admin Component ───────────────────────────────────────────────────────
function Admin() {
  const matchRoute = useMatchRoute();
  const detailMatch = matchRoute({ to: "/admin/user/$userId", fuzzy: false });
  const isUserDetailRoute = Boolean(detailMatch);

  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("adminAuth") === "true";
  });
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
    homeAnnouncementMode: "winner",
    homeAnnouncementText: "🔥 Play now and become today's Revital Energy Challenge winner!",
  });
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters
  const [filterCat, setFilterCat] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [dateWiseSearch, setDateWiseSearch] = useState("");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [userSort, setUserSort] = useState<{ key: UserSortKey; dir: SortDir }>({
    key: "joinedOn",
    dir: "desc",
  });

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
            joinedAtIso: getSafeIsoTimestamp(u.createdAt),
            joinedDays: getJoinedDays(u.createdAt),
            currentStreak: calcStreak(u.playDates ?? []),
            completedAll3Plays: Math.max(
              dedupeAttempts(u.playAttempts ?? []).filter((attempt) => isComplete(attempt.scores))
                .length,
              isComplete(u.scores) ? 1 : 0,
            ),
            completedAll3Days: getCompletedAll3Days(u),
          } as AdminUserRow;
        })
        .filter((u): u is AdminUserRow => !!u)
        .filter((u) => {
          if (filterCat !== "all" && u.selectedCategory !== filterCat) return false;
          const selectedDate = getSafeDate(u.selectedPlayedAt);
          if (from && selectedDate && selectedDate < new Date(from)) return false;
          if (to && selectedDate && selectedDate > new Date(to + "T23:59:59")) return false;
          if (
            search &&
            !u.contact.toLowerCase().includes(search.toLowerCase()) &&
            !(u.email || "").toLowerCase().includes(search.toLowerCase()) &&
            !(u.name || "").toLowerCase().includes(search.toLowerCase()) &&
            !u.userId.toLowerCase().includes(search.toLowerCase())
          )
            return false;
          return true;
        }),
    [users, filterCat, from, to, search],
  );

  const sortedFiltered = useMemo(() => {
    const valueFor = (u: AdminUserRow, key: UserSortKey): string | number => {
      switch (key) {
        case "userId":
          return u.userId;
        case "contact":
          return u.contact;
        case "email":
          return u.email || "";
        case "name":
          return u.name || "";
        case "referCount":
          return u.referCount ?? 0;
        case "referredBy":
          return u.referredBy || "";
        case "joinedOn":
          return getSafeDate(u.joinedAtIso)?.getTime() ?? 0;
        case "completeDays":
          return u.completedAll3Days;
        case "all3Completed":
          return u.completedAll3Plays;
      }
    };

    return [...filtered].sort((a, b) => {
      const av = valueFor(a, userSort.key);
      const bv = valueFor(b, userSort.key);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else
        cmp = String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
          numeric: true,
        });
      return userSort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, userSort]);

  const toggleUserSort = (key: UserSortKey) => {
    setUserSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

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
            (u.email || "").toLowerCase().includes(q) ||
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

  const winnersByDate = useMemo(
    () =>
      dateWise
        .map((d) => ({ date: d.date, winners: d.winners }))
        .filter((d) => d.winners.length > 0),
    [dateWise],
  );

  const handleExportCsv = () => {
    const rows: (string | number)[][] = [
      [
        "User ID",
        "Joined Date",
        "Phone Number",
        "Name",
        "Email",
        "Refer Count",
        "Referral By",
        "Number of Days (All 3 Games)",
        "Number of Times Completed All 3",
      ],
      ...filtered.map((u) => [
        u.userId,
        u.joinedAtIso ? new Date(u.joinedAtIso).toLocaleDateString() : "",
        u.contact,
        u.name || "",
        u.email || "",
        u.referCount ?? 0,
        u.referredBy || "",
        u.completedAll3Days,
        u.completedAll3Plays,
      ]),
    ];
    exportCsv(rows, `revital-users-${Date.now()}.csv`);
    addLog("EXPORT_CSV", `Exported ${filtered.length} users as CSV`);
  };

  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      [
        "User ID",
        "Joined Date",
        "Phone Number",
        "Name",
        "Email",
        "Refer Count",
        "Referral By",
        "Number of Days (All 3 Games)",
        "Number of Times Completed All 3",
      ],
      ...filtered.map((u) => [
        u.userId,
        u.joinedAtIso ? new Date(u.joinedAtIso).toLocaleDateString() : "",
        u.contact,
        u.name || "",
        u.email || "",
        u.referCount ?? 0,
        u.referredBy || "",
        u.completedAll3Days,
        u.completedAll3Plays,
      ]),
    ];
    exportExcel(rows, `revital-users-${Date.now()}.xls`);
    addLog("EXPORT_EXCEL", `Exported ${filtered.length} users as Excel`);
  };

  const handleExportPdf = () => {
    const rows: (string | number)[][] = [
      [
        "User ID",
        "Joined Date",
        "Phone Number",
        "Name",
        "Email",
        "Refer Count",
        "Referral By",
        "Number of Days (All 3 Games)",
        "Number of Times Completed All 3",
      ],
      ...filtered.map((u) => [
        u.userId,
        u.joinedAtIso ? new Date(u.joinedAtIso).toLocaleDateString() : "",
        u.contact,
        u.name || "",
        u.email || "",
        u.referCount ?? 0,
        u.referredBy || "",
        u.completedAll3Days,
        u.completedAll3Plays,
      ]),
    ];
    exportPdf(rows, `revital-users-${Date.now()}.pdf`);
    addLog("EXPORT_PDF", `Exported ${filtered.length} users as PDF`);
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
    if (isUserDetailRoute) {
      navigate({ to: "/admin" });
    }
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
    { id: "winners", label: "Winners", icon: <Trophy className="w-4 h-4" /> },
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
          {navItems.map((n) => {
            const isActive = (isUserDetailRoute && n.id === "users") || tab === n.id;

            return (
              <button
                key={n.id}
                onClick={() => handleTabChange(n.id)}
                className={`group mx-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-accent/30 via-accent/20 to-accent/10 text-foreground border-accent/60 shadow-[0_6px_20px_rgba(243,116,33,0.2)]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10 hover:border-accent/35 hover:shadow-[0_4px_14px_rgba(243,116,33,0.12)]"
                }`}
              >
                <span
                  className={`h-4 w-1 rounded-full transition-all ${
                    isActive
                      ? "bg-accent opacity-100"
                      : "bg-accent/60 opacity-0 group-hover:opacity-70"
                  }`}
                />
                <span
                  className={`${isActive ? "text-accent" : "text-inherit group-hover:text-accent"}`}
                >
                  {n.icon}
                </span>
                <span>{n.label}</span>
              </button>
            );
          })}
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
          {isUserDetailRoute ? (
            <Outlet />
          ) : (
            <>
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
                    <KpiCard title="Avg Score" value={`${stats.avg}/1500`} />
                    <KpiCard title="Median Score" value={`${stats.median}/1500`} />
                    <KpiCard title="Best Score" value={`${stats.bestScore}/1500`} />
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
                        <BarChart
                          data={stats.dist}
                          margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                        >
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
                                <Td className="font-bold text-gradient-energy">
                                  {u.referCount ?? 0}
                                </Td>
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
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                >
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
                      <button
                        onClick={handleExportPdf}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border hover:bg-muted/30 font-bold transition-colors text-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
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
                    {(search || filterCat !== "all" || from || to) && (
                      <button
                        onClick={() => {
                          setSearch("");
                          setFilterCat("all");
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
                          <SortableTh
                            label="User ID"
                            sortKey="userId"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Joining Date"
                            sortKey="joinedOn"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Phone Number"
                            sortKey="contact"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Name"
                            sortKey="name"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Email"
                            sortKey="email"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Refer Count"
                            sortKey="referCount"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Referred By (User ID)"
                            sortKey="referredBy"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Number of Days (All 3 Games)"
                            sortKey="completeDays"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                          <SortableTh
                            label="Number of Times Completed All 3"
                            sortKey="all3Completed"
                            sort={userSort}
                            onSort={toggleUserSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 && (
                          <tr>
                            <td
                              colSpan={9}
                              className="py-10 text-center text-muted-foreground text-sm"
                            >
                              No users match filters.
                            </td>
                          </tr>
                        )}
                        {sortedFiltered.map((u, i) => (
                          <tr
                            key={i}
                            onClick={() =>
                              navigate({ to: "/admin/user/$userId", params: { userId: u.userId } })
                            }
                            className="border-b border-border/40 hover:bg-muted/10 transition-colors cursor-pointer"
                          >
                            <Td className="font-mono text-[11px]">{u.userId}</Td>
                            <Td className="text-muted-foreground text-[11px]">
                              {u.joinedAtIso ? new Date(u.joinedAtIso).toLocaleDateString() : "—"}
                            </Td>
                            <Td className="font-mono text-[11px]">{u.contact}</Td>
                            <Td>{u.name || "—"}</Td>
                            <Td className="font-mono text-[11px]">{u.email || "—"}</Td>
                            <Td className="font-bold text-center">{u.referCount ?? 0}</Td>
                            <Td className="font-mono text-[11px]">{u.referredBy || "—"}</Td>
                            <Td className="font-medium text-center">{u.completedAll3Days}</Td>
                            <Td className="font-bold text-center">{u.completedAll3Plays}</Td>
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
                      const winnerIds = new Set(d.winners.map((w) => w.userId));
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
                            <div className="border-t border-border">
                              <div className="p-4 border-b border-border/50 bg-muted/10">
                                <p className="text-xs text-muted-foreground">
                                  Top 10 winners are auto-selected daily by highest total score.
                                </p>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {d.winners.map((winner, idx) => (
                                    <div
                                      key={`${d.date}-${winner.userId}-${idx}`}
                                      className="text-xs rounded-xl px-3 py-2 border border-accent/30 bg-accent/10 flex justify-between"
                                    >
                                      <span className="font-semibold">
                                        #{idx + 1} {winner.name || winner.contact}
                                      </span>
                                      <span className="font-bold text-accent">{winner.total}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[600px]">
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/10 text-left">
                                      <Th>User ID</Th>
                                      <Th>Contact</Th>
                                      <Th>Email</Th>
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
                                        className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${
                                          winnerIds.has(u.userId) ? "bg-accent/10" : ""
                                        }`}
                                      >
                                        <Td className="font-mono text-[11px]">{u.userId}</Td>
                                        <Td className="font-mono text-[11px]">{u.contact}</Td>
                                        <Td className="font-mono text-[11px]">{u.email || "—"}</Td>
                                        <Td>{u.name || "—"}</Td>
                                        <Td>{u.scores.reflex ?? "—"}</Td>
                                        <Td>{u.scores.memory ?? "—"}</Td>
                                        <Td>{u.scores.balance ?? "—"}</Td>
                                        <Td className="font-bold text-gradient-energy">
                                          {u.total}
                                        </Td>
                                        <Td>
                                          <CategoryBadge cat={u.category} />
                                        </Td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── WINNERS ────────────────────────────────────────────────── */}
              {tab === "winners" && (
                <motion.div
                  key="winners"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <SectionTitle>Daily Top 10 Winners (Date-wise)</SectionTitle>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Only selected winners are shown here, grouped by date.
                  </p>
                  <div className="space-y-3">
                    {winnersByDate.length === 0 && (
                      <p className="text-muted-foreground text-sm py-8 text-center">
                        No winners selected yet.
                      </p>
                    )}
                    {winnersByDate.map((d) => (
                      <div
                        key={`winners-${d.date}`}
                        className="bg-gradient-card border border-border rounded-2xl p-4 shadow-card"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-sm">{d.date}</h3>
                            <span className="text-xs text-muted-foreground">
                              {d.winners.length} winner{d.winners.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <button
                            onClick={() => downloadDailyWinnersImage(d.date, d.winners)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-xs"
                          >
                            <Download className="w-3.5 h-3.5" /> Download winners image
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {d.winners.map((winner, idx) => (
                            <div
                              key={`${d.date}-${winner.userId}-${idx}`}
                              className="text-xs rounded-xl px-3 py-2 border border-accent/30 bg-accent/10 flex justify-between"
                            >
                              <span className="font-semibold">
                                #{idx + 1} {winner.name || winner.contact}
                              </span>
                              <span className="font-bold text-accent">{winner.total}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
                            <td
                              colSpan={7}
                              className="py-10 text-center text-muted-foreground text-sm"
                            >
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
                <motion.div
                  key="logs"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                >
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
                            <td
                              colSpan={3}
                              className="py-10 text-center text-muted-foreground text-sm"
                            >
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
                  <SectionTitle>Tracking, Security & Homepage Settings</SectionTitle>
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

                    <SettingsSection title="Homepage Announcement Bar">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Content Type
                          </label>
                          <select
                            value={settings.homeAnnouncementMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                homeAnnouncementMode: e.target.value as "winner" | "text",
                              }))
                            }
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="winner">Show daily winner</option>
                            <option value="text">Show custom text</option>
                          </select>
                        </div>
                        {settings.homeAnnouncementMode === "text" && (
                          <SettingsField
                            label="Custom text"
                            value={settings.homeAnnouncementText}
                            onChange={(v) => setSettings((s) => ({ ...s, homeAnnouncementText: v }))}
                            placeholder="Type announcement text shown when custom text is selected"
                            hint="Used on the moving bar at the top of the home page."
                          />
                        )}
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-black">{children}</h2>;
}

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-3 shadow-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-lg font-black mt-1 text-gradient-energy">{value}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`py-2.5 px-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2 px-3 ${className}`}>{children}</td>;
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: UserSortKey;
  sort: { key: UserSortKey; dir: SortDir };
  onSort: (key: UserSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <Th>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-60" />
        )}
      </button>
    </Th>
  );
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
