import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { getAllUsers, type UserRecord } from "@/lib/storage";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

const SETTINGS_KEY = "revital.adminSettings";
interface Settings { ga4: string; metaPixel: string; clarity: string; recaptchaSite: string; recaptchaSecret: string; }
const defaultSettings: Settings = { ga4: "", metaPixel: "", clarity: "", recaptchaSite: "", recaptchaSecret: "" };

function loadSettings(): Settings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; }
  catch { return defaultSettings; }
}

function Admin() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { setUsers(getAllUsers()); setSettings(loadSettings()); }, []);

  const filtered = useMemo(() => users.filter(u => {
    if (filterCat !== "all" && u.category !== filterCat) return false;
    if (from && new Date(u.createdAt) < new Date(from)) return false;
    if (to && new Date(u.createdAt) > new Date(to + "T23:59:59")) return false;
    if (search && !u.contact.toLowerCase().includes(search.toLowerCase()) && !(u.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [users, filterCat, from, to, search]);

  const stats = useMemo(() => {
    const total = users.length;
    const avg = users.length ? Math.round(users.reduce((s, u) => s + u.total, 0) / users.length) : 0;
    const dist = ["Peak Performer", "High Energy", "Charged Up", "Warming Up", "Recharge Needed"]
      .map(label => ({ label, count: users.filter(u => u.category === label).length }));
    const completed = users.filter(u => u.scores.reflex !== null && u.scores.memory !== null && u.scores.balance !== null).length;
    return { total, avg, dist, completed };
  }, [users]);

  const exportCsv = () => {
    const rows = [
      ["Contact", "Name", "Address", "Reflex", "Memory", "Balance", "Total", "Category", "Consent", "Created"],
      ...filtered.map(u => [
        u.contact, u.name || "", u.address || "",
        u.scores.reflex ?? "", u.scores.memory ?? "", u.scores.balance ?? "",
        u.total, u.category, u.consent ? "Yes" : "No",
        new Date(u.createdAt).toISOString(),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `revital-users-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
  };

  const maxDist = Math.max(1, ...stats.dist.map(d => d.count));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Admin</p>
            <h1 className="text-3xl md:text-4xl font-black">Campaign <span className="text-gradient-energy">Dashboard</span></h1>
          </div>
          <button onClick={exportCsv} className="px-5 py-2.5 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-sm">
            ⬇ Export CSV
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card title="Total Users" value={stats.total} />
          <Card title="Avg Score" value={`${stats.avg}/300`} />
          <Card title="Completed All" value={stats.completed} />
          <Card title="Conversion" value={`${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`} />
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 bg-gradient-card border border-border rounded-3xl p-5 shadow-card">
          <h3 className="font-black text-lg">Score Distribution</h3>
          <div className="mt-4 space-y-2">
            {stats.dist.map(d => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground">{d.label}</div>
                <div className="flex-1 h-3 bg-background/60 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.count / maxDist) * 100}%` }} transition={{ duration: 0.7 }} className="h-full bg-gradient-energy" />
                </div>
                <div className="w-10 text-right text-sm font-bold tabular-nums">{d.count}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-6 bg-gradient-card border border-border rounded-3xl p-5 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-black text-lg">Users</h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-background/60 border border-border rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring" />
              <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="bg-background/60 border border-border rounded-full px-3 py-1.5">
                <option value="all">All categories</option>
                {["Peak Performer", "High Energy", "Charged Up", "Warming Up", "Recharge Needed"].map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background/60 border border-border rounded-full px-3 py-1.5" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background/60 border border-border rounded-full px-3 py-1.5" />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Contact</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">R</th>
                  <th className="py-2 pr-3">M</th>
                  <th className="py-2 pr-3">B</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">When</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No users yet. Play a round to populate.</td></tr>
                )}
                {filtered.map((u, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-3 font-mono text-xs">{u.contact}</td>
                    <td className="py-2 pr-3">{u.name || "—"}</td>
                    <td className="py-2 pr-3">{u.scores.reflex ?? "—"}</td>
                    <td className="py-2 pr-3">{u.scores.memory ?? "—"}</td>
                    <td className="py-2 pr-3">{u.scores.balance ?? "—"}</td>
                    <td className="py-2 pr-3 font-bold text-gradient-energy">{u.total}</td>
                    <td className="py-2 pr-3 text-xs">{u.category}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={saveSettings} className="mt-6 bg-gradient-card border border-border rounded-3xl p-5 shadow-card">
          <h3 className="font-black text-lg">Tracking & Security Keys</h3>
          <p className="text-xs text-muted-foreground">Update IDs anytime. Saved locally for now — will sync to your VPS API.</p>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <Field label="Google Analytics (GA4 ID)" value={settings.ga4} onChange={(v) => setSettings(s => ({ ...s, ga4: v }))} placeholder="G-XXXXXXXXXX" />
            <Field label="Meta Pixel ID" value={settings.metaPixel} onChange={(v) => setSettings(s => ({ ...s, metaPixel: v }))} placeholder="123456789012345" />
            <Field label="Microsoft Clarity ID" value={settings.clarity} onChange={(v) => setSettings(s => ({ ...s, clarity: v }))} placeholder="abcdefghij" />
            <Field label="reCAPTCHA Site Key" value={settings.recaptchaSite} onChange={(v) => setSettings(s => ({ ...s, recaptchaSite: v }))} placeholder="6Lc..." />
            <Field label="reCAPTCHA Secret" value={settings.recaptchaSecret} onChange={(v) => setSettings(s => ({ ...s, recaptchaSecret: v }))} placeholder="6Lc..." />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className="px-6 py-2.5 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-sm">Save Settings</button>
            {savedFlash && <span className="text-sm text-accent">✓ Saved</span>}
          </div>
        </form>

        <Link to="/" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">← Home</Link>
      </main>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-4 shadow-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="text-2xl md:text-3xl font-black text-gradient-energy mt-1">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}
