import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { serve } from "srvx/node";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// server.js lives at dist/server/server.js; client assets are at dist/client/
const clientDir = join(__dirname, "../client");

const MIME: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const ssrHandler = createStartHandler(defaultStreamHandler);

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: async (req: Request) => {
    const { pathname } = new URL(req.url);

    // Serve static client-side assets before falling through to SSR
    if (pathname.startsWith("/assets/")) {
      try {
        const filePath = join(clientDir, pathname);
        const data = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        return new Response(data, {
          headers: {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        // file not found — fall through to SSR (will 404 via router)
      }
    }

    return ssrHandler(req);
  },
  port,
});
