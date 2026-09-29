// vse.cz writes day headers as "úterý 29. září 2026" (month in genitive).
const MONTHS: Record<string, number> = {
  ledna: 1,
  února: 2,
  března: 3,
  dubna: 4,
  května: 5,
  června: 6,
  července: 7,
  srpna: 8,
  září: 9,
  října: 10,
  listopadu: 11,
  prosince: 12,
};

/** "úterý 29. září 2026" → "2026-09-29", or null when it doesn't look like a date. */
export function parseCzechDate(label: string): string | null {
  const m = label.toLowerCase().match(/(\d{1,2})\.\s*(\p{L}+)\s+(\d{4})/u);
  if (!m) return null;
  const month = MONTHS[m[2]!];
  if (!month) return null;
  return `${m[3]}-${pad(month)}-${pad(Number(m[1]))}`;
}

/** Today's date in Prague as YYYY-MM-DD, independent of the server's timezone. */
export function pragueToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(now);
}

/** YYYY-MM-DD plus n days. */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
