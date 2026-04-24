import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { serve } from "srvx/node";

const handler = createStartHandler(defaultStreamHandler);

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: handler,
  port,
});
