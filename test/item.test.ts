import { describe, expect, it } from "vitest";
import { parseItem } from "../src/item.js";

// All inputs are verbatim strings from the live pages on 29. 9. 2026.
describe("parseItem", () => {
  it("splits AV Gastro Czech/English by the repeated allergen bracket", () => {
    const item = parseItem(
      "Zapečený kuřecí steak Cordon se šunkou a sýrem, smažené brambory (7)Baked Chicken Cordon Bleu with ham and cheese, fried potatoes (7)",
    );
    expect(item).toMatchObject({
      name: "Zapečený kuřecí steak Cordon se šunkou a sýrem, smažené brambory",
      nameEn: "Baked Chicken Cordon Bleu with ham and cheese, fried potatoes",
      allergens: [7],
      price: null,
    });
  });

  it("keeps a Czech '/ alternative' inside the Czech half", () => {
    const item = parseItem(
      'Cikánská vepřová pečené, houskové knedlíky / dušená rýže (1,3,7)"Gypsy-style" roast pork, bread dumplings / steamed rice (1, 3, 7)',
    );
    expect(item?.name).toBe("Cikánská vepřová pečené, houskové knedlíky / dušená rýže");
    expect(item?.nameEn).toBe('"Gypsy-style" roast pork, bread dumplings / steamed rice');
    expect(item?.allergens).toEqual([1, 3, 7]);
  });

  it("does not split a Czech-only dish on its slash", () => {
    const item = parseItem("Vepřový tokáň na víně s paprikou, vaječné špacle / houskové knedlíky (1,3,7)");
    expect(item?.name).toBe("Vepřový tokáň na víně s paprikou, vaječné špacle / houskové knedlíky");
    expect(item?.nameEn).toBeNull();
  });

  it("reads the soup's with-menu price and drops the price phrases from both names", () => {
    const item = parseItem(
      "Polévka – Kulajda s vejci a bramborami (1,3,7)                                                                          K menu 20 KčSoup – Kulajda (dill and potato soup) with eggs and potatoes (1,3,7)                   With meal: 20 CZK",
    );
    expect(item).toMatchObject({
      name: "Polévka – Kulajda s vejci a bramborami",
      nameEn: "Soup – Kulajda (dill and potato soup) with eggs and potatoes",
      allergens: [1, 3, 7],
      price: 20,
    });
  });

  it("splits the buffet line on its repeated (100g)", () => {
    const item = parseItem(
      "TEPLÝ BUFET / NO MEAT BUFET– Nabídka domácí a světové kuchyně (100g)HOT BUFFET / MEAT-FREE BUFFET – Selection of domestic and international cuisine (100g)",
    );
    expect(item?.name).toBe("TEPLÝ BUFET / NO MEAT BUFET– Nabídka domácí a světové kuchyně (100g)");
    expect(item?.nameEn).toBe("HOT BUFFET / MEAT-FREE BUFFET – Selection of domestic and international cuisine (100g)");
    expect(item?.allergens).toEqual([]);
  });

  it("parses AK's 'Czech / English (alergeny: …) price,-'", () => {
    const item = parseItem("Celerový krém / Cream of celery soup (alergeny:  1, 6, 7, 9) 49,-");
    expect(item).toMatchObject({
      name: "Celerový krém",
      nameEn: "Cream of celery soup",
      allergens: [1, 6, 7, 9],
      price: 49,
    });
  });

  it("unescapes AK's backslash quotes", () => {
    const item = parseItem(
      'Špagety „nero di seppia“ s uzeným lososem a smetanou / \\"Nero di seppia\\" spaghetti with smoked salmon and cream (alergeny: 1, 3, 4, 7, 14) 199,-',
    );
    expect(item?.nameEn).toBe('"Nero di seppia" spaghetti with smoked salmon and cream');
    expect(item?.allergens).toEqual([1, 3, 4, 7, 14]);
    expect(item?.price).toBe(199);
  });

  it("drops AK's '-' separator rows and WebKredit's empty 'B2-' slot", () => {
    expect(parseItem("-")).toBeNull();
    expect(parseItem("B2-")).toBeNull();
    expect(parseItem("   ")).toBeNull();
  });

  it("unglues Umbrella's allergen and price ('*1,3,7189,-' = allergens 1,3,7 + 189 Kč)", () => {
    const item = parseItem("I. 150g Vepřové řízečky s vařeným bramborem, máslo *1,3,7189,-");
    expect(item).toMatchObject({
      name: "I. 150g Vepřové řízečky s vařeným bramborem, máslo",
      allergens: [1, 3, 7],
      price: 189,
    });
  });

  it("unglues a two-digit allergen when the list order requires it", () => {
    // After 3, "1" can't be next (lists ascend), so it's allergen 11 + 89 Kč.
    expect(parseItem("Test *1,3,1189,-")).toMatchObject({ allergens: [1, 3, 11], price: 89 });
  });

  it("reads Umbrella's spaced '*11 199,-'", () => {
    const item = parseItem(
      "II. 300g Kuřecí red currry s rýžovými nudlemi, koriandr, sezam *11										199,-",
    );
    expect(item).toMatchObject({ allergens: [11], price: 199 });
    expect(item?.name).toBe("II. 300g Kuřecí red currry s rýžovými nudlemi, koriandr, sezam");
  });

  it("passes plain items through", () => {
    expect(parseItem("Gyros")).toMatchObject({ name: "Gyros", nameEn: null, allergens: [], price: null });
  });
});
