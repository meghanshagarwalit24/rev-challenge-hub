import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/revital-logo.png";
import { getUser, logout, type UserRecord } from "@/lib/storage";

export function Header() {
  const nav = useNavigate();
  const routerState = useRouterState();
  const [user, setUser] = useState<UserRecord | null>(getUser());
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Refresh user state on every route change
  useEffect(() => {
    setUser(getUser());
  }, [routerState.location.pathname]);

  useEffect(() => {
    const syncAuth = () => setUser(getUser());
    window.addEventListener("revital-auth-changed", syncAuth);
    return () => window.removeEventListener("revital-auth-changed", syncAuth);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    setOpen(false);
    nav({ to: "/" });
  };

  const initial = (user?.name || user?.contact || "U").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-[var(--garnet)]/10">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center group shrink-0">
          <img src={logo} alt="Revital Ginseng Plus" className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/retrieve" className="px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium">
            My Score
          </Link>
          {user ? (
            <div className="relative" ref={ref}>
              <button
                onClick={() => nav({ to: "/profile" })}
                aria-label="Go to profile"
                className="w-10 h-10 rounded-full bg-gradient-energy text-white font-bold shadow-button hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
              >
                {initial}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed in as</div>
                    <div className="text-sm font-semibold truncate">{user.contact}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">User ID</div>
                        <div className="text-[11px] font-mono font-semibold truncate">{user.userId || "—"}</div>
                      </div>
                      {user.userId && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await navigator.clipboard.writeText(user.userId);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1500);
                            } catch {}
                          }}
                          className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-md bg-gradient-energy text-white hover:scale-105 active:scale-95 transition-transform"
                          aria-label="Copy User ID"
                        >
                          {copied ? "✓ Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    ↩ Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth" className="px-4 py-2 rounded-full bg-gradient-energy text-white font-semibold shadow-button hover:scale-105 active:scale-95 transition-transform">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
