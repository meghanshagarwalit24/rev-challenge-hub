import { Link } from "@tanstack/react-router";
import logo from "@/assets/revital-logo.png";

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <img src={logo} alt="Revital Energy Challenge" className="h-10 md:h-12 transition-transform group-hover:scale-105" />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/retrieve" className="px-3 py-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            My Score
          </Link>
          <Link to="/challenges" className="px-4 py-2 rounded-full bg-gradient-energy text-energy-foreground font-semibold shadow-button hover:scale-105 active:scale-95 transition-transform">
            Play
          </Link>
        </nav>
      </div>
    </header>
  );
}
