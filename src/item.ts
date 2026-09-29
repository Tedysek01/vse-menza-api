import type { MenuItem } from "./types";

// Each restaurant types its menu differently; examples from the live page (29. 9. 2026):
//   AV Gastro  "Plzeňský vepřový guláš … (1,3,7)  Pilsner-style pork goulash … (1,3,7)"
//   AK         "Celerový krém / Cream of celery soup (alergeny:  1, 6, 7, 9) 49,-"
//   Umbrella   "I. 150g Vepřové řízečky s vařeným bramborem, máslo *1,3,7189,-"   ← allergen 7 + price 189 glued
// Everything here is best-effort; `raw` always carries the original text.

const MAX_ALLERGEN = 14; // EU list: 1 gluten … 14 molluscs
const ALLERGEN_GROUP = /\((?:alergeny:\s*)?(\d{1,2}(?:\s*,\s*\d{1,2})*)\)/gi;
// Letters that only occur in Czech. Used to tell "Czech / English" apart from "knedlík / rýže".
const CZECH_ONLY = /[ěščřžůťďňĚŠČŘŽŮŤĎŇ]/;

export function parseItem(input: string): MenuItem | null {
  const raw = normalize(input);
  // AK separates dishes with "-" rows; WebKredit Jarov carries an empty "B2-" slot.
  if (!raw || /^[-–—\s]*$/.test(raw) || /^[A-Z]\d*-$/.test(raw)) return null;

  let text = raw;
  let price: number | null = null;
  const allergens = new Set<number>();

  // Umbrella: "*1,3,7189,-" or "*11 199,-" at the end.
  const star = text.match(/\s*\*(\d{1,2}(?:,\d+)*)(?:\s+(\d+))?(,-)?\s*$/);
  if (star) {
    const tokens = star[1]!.split(",").map(Number);
    if (star[2]) {
      price = Number(star[2]);
    } else if (star[3]) {
      // No space before ",-": the last token is an allergen with the price glued on.
      const glued = unglue(String(tokens.pop()), tokens.at(-1) ?? 0);
      if (glued) {
        tokens.push(glued.allergen);
        price = glued.price;
      }
    }
    tokens.filter(isAllergen).forEach((n) => allergens.add(n));
    text = text.slice(0, star.index);
  }

  // "189,-" at the end (AK, Umbrella).
  const trailing = text.match(/\s*(\d+)\s*,-\s*$/);
  if (trailing) {
    price ??= Number(trailing[1]);
    text = text.slice(0, trailing.index);
  }

  // AV Gastro soups: "K menu 20 Kč" … "With meal: 20 CZK" — the soup's price with a main.
  text = text.replace(/\s*K\s+menu\s+(\d+)\s*Kč\s*/i, (_, n: string) => {
    price ??= Number(n);
    return " ";
  });
  text = text.replace(/\s*With meal:\s*\d+\s*CZK\s*/i, " ").trim();

  let [name, nameEn] = splitBilingual(text);

  for (const m of text.matchAll(ALLERGEN_GROUP)) {
    const nums = m[1]!.split(",").map((s) => Number(s.trim()));
    if (nums.every(isAllergen)) nums.forEach((n) => allergens.add(n));
  }
  name = clean(stripAllergens(name));
  nameEn = nameEn === null ? null : clean(stripAllergens(nameEn)) || null;

  return {
    name: name || raw,
    nameEn,
    allergens: [...allergens].sort((a, b) => a - b),
    price,
    raw,
  };
}

/**
 * Splits "Czech English" into its halves.
 * A) AV Gastro repeats the trailing bracket in both languages: "… (1,3,7)English … (1,3,7)"
 *    (also "(100g)" on the buffet line), so the first copy marks where English starts.
 * B) AK uses "Czech / English". Only accepted when the right side starts with a capital
 *    or quote and has no Czech-only letters, so "knedlíky / dušená rýže" stays whole.
 */
function splitBilingual(text: string): [string, string | null] {
  const brackets = [...text.matchAll(/\([^()]*\)/g)];
  const last = brackets.at(-1);
  if (last && text.slice(last.index! + last[0].length).trim() === "") {
    const key = last[0].replace(/\s+/g, "");
    const first = brackets.find((b) => b.index! < last.index! && b[0].replace(/\s+/g, "") === key);
    if (first) {
      const cut = first.index! + first[0].length;
      const en = text.slice(cut).trim();
      if (en) return [text.slice(0, cut), en];
    }
  }

  for (const m of text.matchAll(/\//g)) {
    const left = text.slice(0, m.index).trim();
    const right = text.slice(m.index! + 1).trim();
    if (left && /^["„“'A-Z]/.test(right) && !CZECH_ONLY.test(right)) return [left, right];
  }
  return [text, null];
}

/**
 * "7189" after allergen 3 → { allergen: 7, price: 189 }.
 * Allergen lists are ascending, so the allergen is the shortest prefix that is larger
 * than the previous one and ≤ 14 ("1189" after 3 → 11 + 89).
 */
function unglue(token: string, previous: number): { allergen: number; price: number } | null {
  for (let len = 1; len <= 2 && len < token.length; len++) {
    const allergen = Number(token.slice(0, len));
    const rest = token.slice(len);
    if (allergen > previous && isAllergen(allergen) && !rest.startsWith("0")) {
      return { allergen, price: Number(rest) };
    }
  }
  return null;
}

function isAllergen(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_ALLERGEN;
}

function stripAllergens(s: string): string {
  return s.replace(ALLERGEN_GROUP, " ");
}

export function normalize(s: string): string {
  // \s also covers the non-breaking spaces WebKredit sends ("s vejci").
  return s.replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[\s\-–—/,]+|[\s\-–—/,]+$/g, "").trim();
}
