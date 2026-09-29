import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCzechDate } from "../src/dates.js";
import { parseVsePage } from "../src/sources/vse.js";
import { parseWebKredit } from "../src/sources/webkredit.js";
import { ParseError } from "../src/types.js";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const allItems = (days: { sections: { items: { raw: string }[] }[] }[]) =>
  days.flatMap((d) => d.sections.flatMap((s) => s.items));

describe("parseCzechDate", () => {
  it("reads vse.cz day headers", () => {
    expect(parseCzechDate("úterý 29. září 2026")).toBe("2026-09-29");
    expect(parseCzechDate("čtvrtek 1. října 2026")).toBe("2026-10-01");
    expect(parseCzechDate("Nabídka není k dispozici.")).toBeNull();
  });
});

describe("parseVsePage – Žižkov", () => {
  const canteens = parseVsePage(fixture("zizkov-2026-09-29.html"), "zizkov", "https://www.vse.cz/menza/stravovani-zizkov/");
  const byId = Object.fromEntries(canteens.map((c) => [c.id, c]));

  it("finds the four canteens with menus (the Fresh Point fridge has none)", () => {
    expect(canteens.map((c) => c.id)).toEqual(["avgastro-zizkov", "pizza", "restaurace-ak", "umbrella"]);
    expect(byId["avgastro-zizkov"]!.name).toBe("Menza AV Gastro (studentská a zaměstnanecká)");
  });

  it("merges today + week tabs into one list of dated days without duplicates", () => {
    expect(byId["avgastro-zizkov"]!.days.map((d) => d.date)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("keeps sections in page order", () => {
    const today = byId["avgastro-zizkov"]!.days[0]!;
    expect(today.sections.map((s) => s.name)).toEqual(["Polévka", "Oběd", "Teplý bufet", "Večeře", "Ostatní"]);
    expect(today.sections[1]!.items).toHaveLength(4);
  });

  it("handles AK: nothing today, Wednesday in the week tab, '-' rows dropped", () => {
    const ak = byId["restaurace-ak"]!;
    expect(ak.days.map((d) => d.date)).toEqual(["2026-09-30"]);
    expect(allItems(ak.days).some((i) => i.raw === "-")).toBe(false);
    expect(ak.days[0]!.sections.map((s) => s.name)).toEqual(["Denní nabídka", "Denní menu", "Minutky"]);
  });

  it("turns Umbrella's un-numbered lines into sub-sections instead of fake dishes", () => {
    const sections = byId["umbrella"]!.days[0]!.sections;
    expect(sections.map((s) => [s.name, s.items.length])).toEqual([
      ["Menu", 1], // "Polévka: Dle denní nabídky"
      ["Hotová jídla", 3],
      ["Speciality šéfkuchaře", 3],
      ["Studentské menu vč. polévky od 149,-/ + nápoj dle nabídky 20,-", 3],
    ]);
    expect(sections[1]!.items[0]).toMatchObject({ allergens: [1, 3, 7], price: 189 });
  });

  it("leaves sections without numbered dishes alone", () => {
    const pizza = byId["pizza"]!.days[0]!.sections;
    expect(pizza[0]!.name).toBe("Pizza");
    expect(pizza[0]!.items).toHaveLength(15);
  });

  it("reads the info list under each canteen", () => {
    expect(byId["restaurace-ak"]!.info).toMatchObject({
      Web: "http://restauraceak.cz",
      Umístění: "restauraci AK VŠE naleznete ve 3. patře Italské budovy",
    });
    expect(byId["avgastro-zizkov"]!.info["Kontakt"]).toBe("info.avgastro@email.cz");
  });

  it("throws a ParseError when the layout is gone", () => {
    expect(() => parseVsePage("<html><body>nic</body></html>", "zizkov", "x")).toThrow(ParseError);
  });
});

describe("parseVsePage – Jižní Město", () => {
  it("finds the AV Gastro canteen (Volha has no menu on the page)", () => {
    const canteens = parseVsePage(fixture("jizni-mesto-2026-09-29.html"), "jizni-mesto", "x");
    expect(canteens.map((c) => c.id)).toEqual(["avgastro-jm"]);
    expect(canteens[0]!.days.length).toBeGreaterThan(0);
    expect(allItems(canteens[0]!.days).some((i) => i.raw.startsWith("Pórková s vejci"))).toBe(true);
  });
});

describe("parseWebKredit – Jarov", () => {
  const days = parseWebKredit(JSON.parse(fixture("webkredit-jarov-2026-09-29.json")));

  it("groups by date and meal kind", () => {
    expect(days.map((d) => d.date)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(days[0]!.sections.map((s) => s.name)).toContain("Oběd");
  });

  it("drops the empty 'B2-' slot and normalizes non-breaking spaces", () => {
    const items = allItems(days);
    expect(items.some((i) => i.raw === "B2-")).toBe(false);
    expect(items.some((i) => i.raw.includes(" "))).toBe(false);
  });
});
