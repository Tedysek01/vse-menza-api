import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { pragueToday } from "./dates.js";
import { loadCanteens } from "./registry.js";
import { AREAS, type AreaId, type Canteen } from "./types.js";

// Vercel's zero-config Hono support uses this file (src/app.ts) as the entrypoint and
// needs the app as the default export. The named export is for dev.ts and the tests.
export const app = new Hono();

app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "vse-menza-api",
    endpoints: {
      "GET /canteens": "all canteens with location/hours, no menus",
      "GET /menu": "all menus; filters: ?area=zizkov|jizni-mesto|jarov, ?canteen=<id>, ?date=YYYY-MM-DD|today",
      "GET /menu/today": "same as /menu?date=today",
    },
    areas: AREAS,
  }),
);

app.get("/canteens", async (c) => {
  const { canteens, warnings, allFailed } = await loadCanteens();
  if (allFailed) return c.json({ error: "All upstream sources failed", warnings }, 502);
  cacheHeaders(c);
  return c.json({
    canteens: canteens.map(({ days: _days, ...rest }) => rest),
    warnings,
  });
});

app.get("/menu/today", (c) => menu(c, "today"));
app.get("/menu", (c) => menu(c, c.req.query("date")));

async function menu(c: Context, dateParam: string | undefined) {
  const areaParam = c.req.query("area");
  let area: AreaId | undefined;
  if (areaParam) {
    if (!isArea(areaParam)) {
      return c.json({ error: `Unknown area "${areaParam}". Use one of: ${AREAS.join(", ")}` }, 400);
    }
    area = areaParam;
  }
  let date: string | null = null;
  if (dateParam === "today") date = pragueToday();
  else if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return c.json({ error: `Invalid date "${dateParam}". Use YYYY-MM-DD or "today".` }, 400);
    }
    date = dateParam;
  }

  const { canteens, warnings, allFailed } = await loadCanteens(area ? [area] : undefined);
  if (allFailed) return c.json({ error: "All upstream sources failed", warnings }, 502);

  let result: Canteen[] = canteens;
  const canteenParam = c.req.query("canteen");
  if (canteenParam) {
    result = result.filter((x) => x.id === canteenParam);
    if (!result.length) {
      return c.json({ error: `Unknown canteen "${canteenParam}"`, canteens: canteens.map((x) => x.id) }, 404);
    }
  }
  if (date) result = result.map((x) => ({ ...x, days: x.days.filter((d) => d.date === date) }));

  cacheHeaders(c);
  return c.json({ date, today: pragueToday(), canteens: result, warnings });
}

function cacheHeaders(c: Context) {
  // Lets a CDN (e.g. Vercel) absorb traffic so vse.cz sees a handful of requests per hour.
  c.header("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600");
}

function isArea(s: string): s is AreaId {
  return (AREAS as readonly string[]).includes(s);
}

export default app;
