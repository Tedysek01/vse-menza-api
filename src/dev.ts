import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`vse-menza-api on http://localhost:${port}`);
});
