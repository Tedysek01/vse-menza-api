import { addDays, pragueToday } from "./dates.js";
import { parseVsePage } from "./sources/vse.js";
import { parseWebKredit, webKreditMenuUrl, type WebKreditMenu } from "./sources/webkredit.js";
import { UpstreamError, type AreaId, type Canteen } from "./types.js";

const USER_AGENT = "vse-menza-api/0.1 (student project; menu aggregator)";
const TIMEOUT_MS = 10_000;
// Menus change at most a few times a day; 15 minutes keeps load on vse.cz negligible.
const TTL_MS = 15 * 60 * 1000;
const WEBKREDIT = "https://webkredit.vse.cz/webkredit_italska";

interface Source {
  key: string;
  area: AreaId;
  load: (warnings: string[]) => Promise<Canteen[]>;
}

const vsePage = (area: AreaId, path: string): Source => {
  const url = `https://www.vse.cz/menza/${path}/`;
  return {
    key: url,
    area,
    load: async (warnings) => parseVsePage(await fetchText(url), area, url, warnings),
  };
};

export const SOURCES: Source[] = [
  vsePage("zizkov", "stravovani-zizkov"),
  vsePage("jizni-mesto", "stravovani-jizni-mesto"),
  {
    key: "webkredit:5",
    area: "jarov",
    load: async () => {
      const today = pragueToday();
      const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
      const json = JSON.parse(await fetchText(webKreditMenuUrl(WEBKREDIT, 5, dates))) as WebKreditMenu;
      return [
        {
          id: "jarov",
          name: "Menza restaurant Jarov",
          area: "jarov",
          source: `${WEBKREDIT}/Ordering/Menu?canteen=5`,
          info: {
            Umístění: "koleje Jarov, Jeseniova 208, Praha 3",
            "Otevírací doba jídelna": "Po – Pá 11:00 – 15:00",
          },
          days: parseWebKredit(json),
        },
      ];
    },
  },
  {
    key: "static:volha",
    area: "jizni-mesto",
    load: async () => [
      {
        id: "volha",
        name: "Menza restaurant Volha",
        area: "jizni-mesto",
        source: "https://menzavolha.cz/jidelni-listek/",
        info: {
          Umístění: "koleje Jižní Město, K Verneráku 950, Praha 4",
          "Otevírací doba": "Po – Čt 11:00 – 19:00, Pá 11:00 – 14:30",
        },
        // Their site links only a PDF for 15.–19. 12. 2025 (checked 29. 9. 2026).
        note: "Volha does not publish a current menu online.",
        days: [],
      },
    ],
  },
];

interface CacheEntry {
  at: number;
  canteens: Canteen[];
  warnings: string[];
}
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

export interface LoadResult {
  canteens: Canteen[];
  warnings: string[];
}

/**
 * Loads every source for the given areas. A failing source doesn't fail the request:
 * its last good data is served (with a warning), or it's left out (with a warning).
 */
export async function loadCanteens(areas?: AreaId[]): Promise<LoadResult> {
  const sources = SOURCES.filter((s) => !areas || areas.includes(s.area));
  const results = await Promise.all(sources.map((s) => loadSource(s)));
  return {
    canteens: results.flatMap((r) => r.canteens),
    warnings: results.flatMap((r) => r.warnings),
  };
}

async function loadSource(source: Source): Promise<LoadResult> {
  const cached = cache.get(source.key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached;

  let pending = inFlight.get(source.key);
  if (!pending) {
    const warnings: string[] = [];
    pending = source
      .load(warnings)
      .then((canteens) => ({ at: Date.now(), canteens, warnings }))
      .finally(() => inFlight.delete(source.key));
    inFlight.set(source.key, pending);
  }

  try {
    const entry = await pending;
    cache.set(source.key, entry);
    return entry;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[vse-menza-api] ${source.key} failed: ${reason}`);
    if (cached) {
      const age = Math.round((Date.now() - cached.at) / 60_000);
      return { canteens: cached.canteens, warnings: [...cached.warnings, `${source.key}: ${reason}; serving data from ${age} min ago`] };
    }
    return { canteens: [], warnings: [`${source.key}: ${reason}`] };
  }
}

async function fetchText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new UpstreamError(`${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new UpstreamError(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Test hook. */
export function clearCache(): void {
  cache.clear();
  inFlight.clear();
}
