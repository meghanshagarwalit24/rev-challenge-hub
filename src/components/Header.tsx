import { Link } from "@tanstack/react-router";
import logo from "@/assets/revital-logo.png";

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-[var(--garnet)]/10">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center group shrink-0">
          <img src={logo} alt="Revital Ginseng Plus" className="h-8 md:h-11 w-auto object-contain transition-transform group-hover:scale-105" />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/retrieve" className="px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium">
            My Score
          </Link>
          <Link to="/challenges" className="px-4 py-2 rounded-full bg-gradient-energy text-white font-semibold shadow-button hover:scale-105 active:scale-95 transition-transform">
            Play
          </Link>
        </nav>
      </div>
    </header>
  );
}
