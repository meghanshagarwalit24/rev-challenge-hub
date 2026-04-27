import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { CookieConsent } from "@/components/CookieConsent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-8xl font-black text-gradient-energy">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-energy px-6 py-3 text-sm font-semibold text-energy-foreground shadow-button hover:scale-105 transition-transform"
        >
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
      {
        name: "description",
        content:
          "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard.",
      },
      { property: "og:title", content: "Revital Energy Challenge — Are You Ready?" },
      {
        property: "og:description",
        content:
          "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Revital Energy Challenge — Are You Ready?" },
      {
        name: "twitter:description",
        content:
          "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2561bd18-a65b-48f9-bd1a-18f8abaec95b/id-preview-605a5d92--f6ce6fc7-3c89-4c59-b074-ac2fbb50b2bb.lovable.app-1776510535243.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2561bd18-a65b-48f9-bd1a-18f8abaec95b/id-preview-605a5d92--f6ce6fc7-3c89-4c59-b074-ac2fbb50b2bb.lovable.app-1776510535243.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://accounts.google.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&family=Pacifico&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    // Inject tracking scripts from platform settings stored in the database.
    // We do this lazily so it never blocks the initial paint.
    const inject = async () => {
      try {
        const { getPlatformSettingsFn } = await import("@/server/adminFns");
        const s = await getPlatformSettingsFn();

        // Google Analytics (GA4)
        if (s.ga4 && !document.getElementById("_ga4")) {
          const gScript = document.createElement("script");
          gScript.id = "_ga4";
          gScript.async = true;
          gScript.src = `https://www.googletagmanager.com/gtag/js?id=${s.ga4}`;
          document.head.appendChild(gScript);
          const gInline = document.createElement("script");
          gInline.id = "_ga4_inline";
          gInline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${s.ga4}');`;
          document.head.appendChild(gInline);
        }

        // Meta Pixel
        if (s.metaPixel && !document.getElementById("_fbpixel")) {
          const fbInline = document.createElement("script");
          fbInline.id = "_fbpixel";
          fbInline.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${s.metaPixel}');fbq('track','PageView');`;
          document.head.appendChild(fbInline);
        }

        // Microsoft Clarity
        if (s.clarity && !document.getElementById("_clarity")) {
          const clScript = document.createElement("script");
          clScript.id = "_clarity";
          clScript.textContent = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${s.clarity}");`;
          document.head.appendChild(clScript);
        }
      } catch (e) {
        // Tracking injection is best-effort — never throw to the user
        if (import.meta.env.DEV) console.warn("Tracking injection failed:", e);
      }
    };
    inject();
  }, []);

  return (
    <>
      <Outlet />
      <CookieConsent />
    </>
  );
}
