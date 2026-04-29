import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--garnet)]/10 bg-white/95 backdrop-blur md:static md:mt-16 md:bg-white/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm md:flex-row md:gap-4 md:py-8">
        <p className="text-center font-medium text-garnet/70 md:text-left">
          © {new Date().getFullYear()} Revital Energy Challenge. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/rules" className="font-semibold text-garnet/80 transition-colors hover:text-[var(--tiger)]">
            Rules
          </Link>
          <span className="text-garnet/30">•</span>
          <Link to="/privacy" className="font-semibold text-garnet/80 transition-colors hover:text-[var(--tiger)]">
            Privacy Policy
          </Link>
          <span className="text-garnet/30">•</span>
          <Link to="/terms" className="font-semibold text-garnet/80 transition-colors hover:text-[var(--tiger)]">
            Terms & Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
