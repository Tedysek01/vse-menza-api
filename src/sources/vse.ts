import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { parseCzechDate } from "../dates";
import { normalize, parseItem } from "../item";
import { ParseError, type AreaId, type Canteen, type MenuDay, type MenuSection } from "../types";

// Page layout (vse.cz WordPress, checked 29. 9. 2026), inside <article>:
//   <h2>Menza AV Gastro …</h2>
//   <ul class="nav-tabs">…</ul>
//   <div class="tab-content">
//     <div class="tab-pane" id="avgastro-zizkov-today"> <table class="menza-table">… </div>
//     <div class="tab-pane" id="avgastro-zizkov-week">  <table class="menza-table">×N </div>
//   </div>
//   <ul><li><strong>Umístění:</strong> …</li></ul>
// One table per day: date in <thead>, one row per category (th.menu-name), one <div> per dish.
// An <h2> without tab panes (Fresh Point fridge, Volha) has no menu here and is skipped.

export function parseVsePage(
  html: string,
  area: AreaId,
  source: string,
  warnings: string[] = [],
): Canteen[] {
  const $ = load(html);
  const article = $("article").first();
  if (!article.length) throw new ParseError(`${source}: no <article> on the page`);

  const canteens: Canteen[] = [];
  article.children("h2").each((_, h2) => {
    const block = $(h2).nextUntil("h2");
    const panes = block.find(".tab-pane[id]");
    if (!panes.length) return;

    const id = panes.first().attr("id")!.replace(/-(today|week)$/, "");
    const days = new Map<string, MenuDay>();
    // The week tab normally includes today; the today tab only adds a day the week tab lacks.
    for (const suffix of ["week", "today"]) {
      panes
        .filter((_, el) => $(el).attr("id") === `${id}-${suffix}`)
        .find("table.menza-table")
        .each((_, table) => {
          const day = parseDayTable($, table, `${source} #${id}-${suffix}`, warnings);
          if (day && !days.has(day.date)) days.set(day.date, day);
        });
    }

    canteens.push({
      id,
      name: normalize($(h2).text()),
      area,
      source,
      info: parseInfo($, block),
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    });
  });

  if (!canteens.length) throw new ParseError(`${source}: found no canteen menus (layout changed?)`);
  return canteens;
}

function parseDayTable(
  $: CheerioAPI,
  table: Element,
  where: string,
  warnings: string[],
): MenuDay | null {
  const label = normalize($(table).find("thead th").first().text());
  const date = parseCzechDate(label);
  if (!date) {
    warnings.push(`${where}: skipped a day with unreadable date "${label}"`);
    return null;
  }

  const sections: MenuSection[] = [];
  $(table)
    .find("tbody tr")
    .each((_, tr) => {
      const name = normalize($(tr).find(".menu-name").text());
      const items = $(tr)
        .find(".meal-name > div")
        .map((_, div) => parseItem($(div).text()))
        .get()
        .filter((item) => item !== null);
      if (items.length) sections.push(...splitNumberedSubsections({ name, items }));
    });
  return { date, sections };
}

const ROMAN_PREFIX = /^[IVX]+\.\s/;

/**
 * Umbrella puts its whole menu in one "Menu" row and numbers the dishes I.–IX.; the
 * un-numbered lines between them are sub-headings ("Hotová jídla", "Speciality šéfkuchaře",
 * "Studentské menu vč. polévky od 149,-/ + nápoj dle nabídky 20,-"), not dishes.
 * Sections without numbered dishes (every other canteen) pass through unchanged.
 */
export function splitNumberedSubsections(section: MenuSection): MenuSection[] {
  const numbered = section.items.filter((i) => ROMAN_PREFIX.test(i.raw)).length;
  if (numbered < 2) return [section];

  // An un-numbered line is a heading when the next line is a numbered dish;
  // otherwise it stays an item ("Polévka: Dle denní nabídky").
  const out: MenuSection[] = [{ name: section.name, items: [] }];
  section.items.forEach((item, i) => {
    const next = section.items[i + 1];
    if (!ROMAN_PREFIX.test(item.raw) && next && ROMAN_PREFIX.test(next.raw)) {
      out.push({ name: item.raw, items: [] });
    } else {
      out.at(-1)!.items.push(item);
    }
  });
  return out.filter((s) => s.items.length);
}

/** "<li><strong>Umístění:</strong> přízemí Italské budovy</li>" → { "Umístění": "přízemí …" } */
function parseInfo($: CheerioAPI, block: Cheerio<Element>): Record<string, string> {
  const info: Record<string, string> = {};
  block
    .filter("ul")
    .not(".nav-tabs")
    .find("li")
    .each((_, li) => {
      const strong = $(li).find("strong").first();
      const link = $(li).find("a").first();
      if (strong.length) {
        const key = normalize(strong.text()).replace(/:$/, "");
        const value = normalize($(li).text().replace(strong.text(), ""));
        if (key && value) info[key] = value;
      } else if (link.length) {
        // e.g. <li><a href="…pdf">Ceník</a></li>
        const key = normalize(link.text());
        const href = link.attr("href");
        if (key && href) info[key] = href;
      }
    });
  return info;
}
