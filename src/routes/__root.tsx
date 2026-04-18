import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { CookieConsent } from "@/components/CookieConsent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-8xl font-black text-gradient-energy">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-energy px-6 py-3 text-sm font-semibold text-energy-foreground shadow-button hover:scale-105 transition-transform">
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F37421" },
      { title: "Revital Energy Challenge — Are You Ready?" },
      { name: "description", content: "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard." },
      { property: "og:title", content: "Revital Energy Challenge — Are You Ready?" },
      { property: "og:description", content: "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Revital Energy Challenge — Are You Ready?" },
      { name: "twitter:description", content: "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2561bd18-a65b-48f9-bd1a-18f8abaec95b/id-preview-605a5d92--f6ce6fc7-3c89-4c59-b074-ac2fbb50b2bb.lovable.app-1776510535243.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2561bd18-a65b-48f9-bd1a-18f8abaec95b/id-preview-605a5d92--f6ce6fc7-3c89-4c59-b074-ac2fbb50b2bb.lovable.app-1776510535243.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&family=Pacifico&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <CookieConsent />
    </>
  );
}
