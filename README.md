# vse-menza-api

JSON API over the menus of the VŠE (Prague University of Economics and Business) canteens.
Free, no key, CORS open.

**https://vse-menza-api.vercel.app**

```bash
curl https://vse-menza-api.vercel.app/menu/today
```

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /menu/today` | today's menu (Prague time) in every canteen |
| `GET /menu` | every day the canteens have published, usually the rest of the week |
| `GET /canteens` | the canteens with location, opening hours and contact, without menus |
| `GET /` | a short description of the endpoints |

`/menu` and `/menu/today` take optional query parameters, which can be combined:

| Parameter | Values | Example |
|---|---|---|
| `area` | `zizkov`, `jizni-mesto`, `jarov` | `/menu/today?area=zizkov` |
| `canteen` | a canteen id (table below) | `/menu?canteen=umbrella` |
| `date` | `YYYY-MM-DD` or `today` | `/menu?date=2026-10-01` |

A canteen with nothing published for the requested day is still listed, with `"days": []`.

## Examples

```bash
# Today at Žižkov
curl "https://vse-menza-api.vercel.app/menu/today?area=zizkov"

# Restaurace AK for one day
curl "https://vse-menza-api.vercel.app/menu?canteen=restaurace-ak&date=2026-09-30"

# The whole published week at Jarov
curl "https://vse-menza-api.vercel.app/menu?area=jarov"
```

JavaScript:

```js
const res = await fetch("https://vse-menza-api.vercel.app/menu/today?area=zizkov");
const { canteens } = await res.json();
for (const canteen of canteens) {
  for (const section of canteen.days[0]?.sections ?? []) {
    console.log(`${canteen.name} / ${section.name}: ${section.items.map((i) => i.name).join(", ")}`);
  }
}
```

## Response

`GET /menu?canteen=restaurace-ak&date=2026-09-30`, shortened to two dishes:

```json
{
  "date": "2026-09-30",
  "today": "2026-09-29",
  "canteens": [
    {
      "id": "restaurace-ak",
      "name": "Restaurace AK VŠE",
      "area": "zizkov",
      "source": "https://www.vse.cz/menza/stravovani-zizkov/",
      "info": {
        "Web": "http://restauraceak.cz",
        "Umístění": "restauraci AK VŠE naleznete ve 3. patře Italské budovy"
      },
      "days": [
        {
          "date": "2026-09-30",
          "sections": [
            {
              "name": "Denní nabídka",
              "items": [
                {
                  "name": "Celerový krém",
                  "nameEn": "Cream of celery soup",
                  "allergens": [1, 6, 7, 9],
                  "price": 49,
                  "raw": "Celerový krém / Cream of celery soup (alergeny: 1, 6, 7, 9) 49,-"
                },
                {
                  "name": "Smažený květák, vařené brambory, tatarská omáčka",
                  "nameEn": "Fried cauliflower, boiled potatoes, tartar sauce",
                  "allergens": [1, 3, 6, 7, 10],
                  "price": 177,
                  "raw": "Smažený květák, vařené brambory, tatarská omáčka/ Fried cauliflower, boiled potatoes, tartar sauce (alergeny: 1, 3, 6, 7, 10) 177,-"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "warnings": []
}
```

| Field | Meaning |
|---|---|
| `date` | the day you asked for, or `null` when you asked for all days |
| `today` | today's date in Prague |
| `canteens[].info` | whatever the source lists (location, opening hours, contact, price list), with the source's Czech labels |
| `canteens[].note` | set when a canteen has no menu online (Volha) |
| `days[].sections[].name` | the canteen's own category: `Polévka`, `Oběd`, `Minutky`, `Pizza`, … |
| `items[].name` | the dish in Czech, without allergens and price |
| `items[].nameEn` | the English name when the canteen writes one (AV Gastro, AK), otherwise `null` |
| `items[].allergens` | allergen numbers 1 to 14, see below |
| `items[].price` | price in CZK, or `null` when the source gives none (most AV Gastro dishes) |
| `items[].raw` | the dish exactly as the source wrote it |
| `warnings` | sources that failed or were served from an older copy; empty when everything loaded |

Every canteen types its menu differently, so `name`, `nameEn`, `allergens` and `price` are parsed
from free text. If one of them looks wrong, `raw` has the original.

Allergens use the EU numbering that Czech canteens print: 1 gluten, 2 crustaceans, 3 eggs, 4 fish,
5 peanuts, 6 soy, 7 milk, 8 nuts, 9 celery, 10 mustard, 11 sesame, 12 sulphites, 13 lupin,
14 molluscs.

## Canteens

| `id` | `area` | Canteen | Data from |
|---|---|---|---|
| `avgastro-zizkov` | `zizkov` | Menza AV Gastro (studentská a zaměstnanecká) | [vse.cz Žižkov page](https://www.vse.cz/menza/stravovani-zizkov/) |
| `pizza` | `zizkov` | Pizza VŠEm, Zdravá výživa | same page |
| `restaurace-ak` | `zizkov` | Restaurace AK VŠE | same page |
| `umbrella` | `zizkov` | Umbrella pizza bar | same page |
| `avgastro-jm` | `jizni-mesto` | Závodní stravování AV Gastro | [vse.cz Jižní Město page](https://www.vse.cz/menza/stravovani-jizni-mesto/) |
| `jarov` | `jarov` | Menza restaurant Jarov | WebKredit, the canteens' ordering system |
| `volha` | `jizni-mesto` | Menza restaurant Volha | listed without a menu: its website only has a PDF from December 2025 |

Not included: Jindřichův Hradec (its WebKredit system has no menus) and the Fresh Point fridge
(the vse.cz page only links to its own app).

## Errors and caching

| Status | When |
|---|---|
| `400` | unknown `area` or a `date` that isn't `YYYY-MM-DD` / `today` |
| `404` | unknown `canteen`; the response lists the valid ids |
| `502` | vse.cz and WebKredit all failed and there's no earlier copy to fall back on |

When only one source fails, the rest still comes back with status 200 and `warnings` says what
failed. If the server still has an earlier copy of the failed source in memory, it serves that
copy and `warnings` says how old it is.

Each server instance fetches a source at most once every 15 minutes, and Vercel's CDN caches the
responses for another 15, so the API sends very little traffic to vse.cz. The flip side: a menu
change on vse.cz can take up to about half an hour to show up here.

## Development

```bash
npm install
npm run dev        # http://localhost:8787
npm test           # parsers and API against saved real pages in test/fixtures
npm run typecheck
```

Deploys to Vercel as a zero-config Hono app: `src/app.ts` default-exports the app, `vercel.json`
pins the function to Frankfurt (`fra1`). Deploy with `vercel deploy --prod`.
