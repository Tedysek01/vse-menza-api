export const AREAS = ["zizkov", "jizni-mesto", "jarov"] as const;
export type AreaId = (typeof AREAS)[number];

export interface MenuItem {
  /** Czech name with allergens and price stripped. */
  name: string;
  /** English name when the source lists one (AV Gastro, AK), otherwise null. */
  nameEn: string | null;
  /** EU allergen numbers 1–14. */
  allergens: number[];
  /** CZK. Null when the source gives no price (most AV Gastro meals). */
  price: number | null;
  /** The untouched source text; the fields above are best-effort parses of it. */
  raw: string;
}

export interface MenuSection {
  /** Source category: "Polévka", "Oběd", "Minutky", "Pizza", … */
  name: string;
  items: MenuItem[];
}

export interface MenuDay {
  /** YYYY-MM-DD */
  date: string;
  sections: MenuSection[];
}

export interface Canteen {
  id: string;
  name: string;
  area: AreaId;
  /** Page the data was read from. */
  source: string;
  /** Location, opening hours, contact… as listed by the source (Czech labels). */
  info: Record<string, string>;
  /** Set when the canteen has no machine-readable menu. */
  note?: string;
  days: MenuDay[];
}

/** The page layout changed and the parser no longer finds what it expects. */
export class ParseError extends Error {
  override name = "ParseError";
}

/** The upstream site failed or returned a non-2xx status. */
export class UpstreamError extends Error {
  override name = "UpstreamError";
}
