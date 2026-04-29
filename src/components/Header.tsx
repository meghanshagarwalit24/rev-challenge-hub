import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/revital-logo.png";
import { getUser, type UserRecord } from "@/lib/storage";

export function Header() {
  const nav = useNavigate();
  const routerState = useRouterState();
  const [user, setUser] = useState<UserRecord | null>(getUser());

  // Refresh user state on every route change
  useEffect(() => {
    setUser(getUser());
  }, [routerState.location.pathname]);

  useEffect(() => {
    const syncAuth = () => setUser(getUser());
    window.addEventListener("revital-auth-changed", syncAuth);
    return () => window.removeEventListener("revital-auth-changed", syncAuth);
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-[var(--garnet)]/10">
      <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" className="flex items-center group shrink-0">
          <img src={logo} alt="Revital Ginseng Plus" className="h-8 sm:h-9 md:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-xs sm:text-sm">
          <Link to="/retrieve" className="px-2.5 sm:px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium whitespace-nowrap">
            My Score
          </Link>
          {user ? (
            <button
              onClick={() => nav({ to: "/profile" })}
              aria-label="Go to profile"
              className="w-10 h-10 rounded-full bg-gradient-energy text-white shadow-button hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
            >
              <span className="text-lg leading-none">👤</span>
            </button>
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
