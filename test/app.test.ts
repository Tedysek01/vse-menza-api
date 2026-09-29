import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { clearCache } from "../src/registry";

// Loosely typed: the tests assert on the JSON shape directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

// Serves the saved pages instead of hitting vse.cz.
function fakeUpstream(overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    for (const [needle, respond] of Object.entries(overrides)) if (url.includes(needle)) return respond();
    if (url.includes("stravovani-zizkov")) return new Response(fixture("zizkov-2026-09-29.html"));
    if (url.includes("stravovani-jizni-mesto")) return new Response(fixture("jizni-mesto-2026-09-29.html"));
    if (url.includes("webkredit")) return new Response(fixture("webkredit-jarov-2026-09-29.json"));
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearCache();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("API", () => {
  it("GET /menu/today returns every canteen with only today's day", async () => {
    fakeUpstream();
    const res = await app.request("/menu/today");
    expect(res.status).toBe(200);
    const body: Json = await res.json();
    expect(body.date).toBe("2026-09-29");
    expect(body.canteens.map((c: { id: string }) => c.id)).toEqual([
      "avgastro-zizkov",
      "pizza",
      "restaurace-ak",
      "umbrella",
      "avgastro-jm",
      "jarov",
      "volha",
    ]);
    for (const c of body.canteens) for (const d of c.days) expect(d.date).toBe("2026-09-29");
    expect(res.headers.get("cache-control")).toContain("s-maxage");
  });

  it("filters by area and canteen", async () => {
    fakeUpstream();
    const res = await app.request("/menu?area=zizkov&canteen=umbrella");
    const body: Json = await res.json();
    expect(body.canteens).toHaveLength(1);
    expect(body.canteens[0].id).toBe("umbrella");
  });

  it("caches upstream pages between requests", async () => {
    const fetchMock = fakeUpstream();
    await app.request("/menu");
    await app.request("/menu");
    expect(fetchMock).toHaveBeenCalledTimes(3); // Žižkov, Jižní Město, WebKredit — once each
  });

  it("keeps serving other canteens when one source is down, and says so", async () => {
    fakeUpstream({ webkredit: () => new Response("down", { status: 503 }) });
    const body: Json = await (await app.request("/menu")).json();
    expect(body.canteens.map((c: { id: string }) => c.id)).not.toContain("jarov");
    expect(body.warnings.join()).toMatch(/HTTP 503/);
  });

  it("rejects bad input", async () => {
    fakeUpstream();
    expect((await app.request("/menu?date=zitra")).status).toBe(400);
    expect((await app.request("/menu?area=praha")).status).toBe(400);
    expect((await app.request("/menu?canteen=nope")).status).toBe(404);
  });

  it("GET /canteens lists canteens without menus", async () => {
    fakeUpstream();
    const body: Json = await (await app.request("/canteens")).json();
    expect(body.canteens.find((c: { id: string }) => c.id === "volha").note).toMatch(/current menu/);
    expect(body.canteens[0].days).toBeUndefined();
  });
});
