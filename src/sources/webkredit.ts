import { parseItem } from "../item";
import type { MenuDay, MenuItem } from "../types";

// WebKredit (Anete) is the canteens' ordering system. Its menu endpoint is public:
//   GET https://webkredit.vse.cz/webkredit_italska/Api/Ordering/Menu?Dates=<ISO>&Dates=…&CanteenId=5
// Canteen ids in webkredit_italska (from its RSS titles, 29. 9. 2026):
//   1 Studentská, 2 Zaměstnanecká (both = Žižkov AV Gastro, which vse.cz already shows),
//   3 Chodov (= Jižní Město AV Gastro), 4 Kredenc (all rows hidden), 5 Jarov.
// The webkredit_JH instance (Jindřichův Hradec) is empty.

export interface WebKreditMenu {
  groups: Array<{
    date: string; // "2026-09-29T00:00:00.0000000Z"
    mealKindName: string;
    rows: Array<{
      item: {
        mealName: string;
        price: number;
        show: boolean;
      };
    }>;
  }>;
}

export function webKreditMenuUrl(base: string, canteenId: number, dates: string[]): string {
  const query = dates.map((d) => `Dates=${encodeURIComponent(`${d}T00:00:00.000Z`)}`).join("&");
  return `${base}/Api/Ordering/Menu?${query}&CanteenId=${canteenId}`;
}

export function parseWebKredit(json: WebKreditMenu): MenuDay[] {
  const days = new Map<string, MenuDay>();
  for (const group of json.groups ?? []) {
    const date = group.date.slice(0, 10);
    const items = group.rows
      // `show: false` rows are hidden in WebKredit's own UI too (Kredenc's price tiers).
      .filter((row) => row.item.show !== false)
      .map((row): MenuItem | null => {
        const item = parseItem(row.item.mealName);
        if (item && row.item.price > 0) item.price = row.item.price;
        return item;
      })
      .filter((item) => item !== null);
    if (!items.length) continue;

    const day = days.get(date) ?? { date, sections: [] };
    day.sections.push({ name: group.mealKindName, items });
    days.set(date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
