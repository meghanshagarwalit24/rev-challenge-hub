import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { getUser, saveUserRemote, type UserRecord } from "@/lib/storage";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const nav = useNavigate();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      nav({ to: "/auth" });
      return;
    }
    setUser(u);
    setName(u.name || "");
    setAddress(u.address || "");
  }, [nav]);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveUserRemote({ ...user, name: name.trim(), address: address.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-gradient-card border border-border rounded-3xl p-6 shadow-card text-center">
            <div className="text-5xl">🏆</div>
            <h1 className="mt-3 text-2xl md:text-3xl font-black">You're In!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your score is saved. You're now in the prize draw.
            </p>

            <div className="mt-5 bg-background/40 rounded-2xl p-4 text-left space-y-2">
              <Row label="User ID" value={user.userId} mono />
              <Row label={user.contact.includes("@") ? "Email" : "Mobile"} value={user.contact} />
              {user.name && <Row label="Name" value={user.name} />}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Total" value={`${user.total}/300`} />
              <Stat label="Tier" value={user.category.split(" ")[0]} />
              <Stat label="Eligible" value="✓" />
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
          <button className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform">
            {saved ? "✓ Saved!" : "Save Profile"}
          </button>
        </motion.form>

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
