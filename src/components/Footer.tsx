import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--garnet)]/10 bg-white/60 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <p className="text-garnet/70 font-medium text-center md:text-left">
          © {new Date().getFullYear()} Revital Energy Challenge. All rights reserved.
        </p>
        <nav className="flex items-center gap-5">
          <Link to="/privacy" className="text-garnet/80 hover:text-[var(--tiger)] font-semibold transition-colors">
            Privacy Policy
          </Link>
          <span className="text-garnet/30">•</span>
          <Link to="/terms" className="text-garnet/80 hover:text-[var(--tiger)] font-semibold transition-colors">
            Terms & Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
