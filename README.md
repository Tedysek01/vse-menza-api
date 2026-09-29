# vse-menza-api

JSON API over the VŠE canteen menus.

```bash
npm install
npm run dev        # http://localhost:8787
npm test           # parsers + API against saved real pages (test/fixtures)
```

## Endpoints

| | |
|---|---|
| `GET /menu/today` | today's menu in every canteen |
| `GET /menu` | all published days; filters `?area=zizkov\|jizni-mesto\|jarov`, `?canteen=<id>`, `?date=YYYY-MM-DD\|today` |
| `GET /canteens` | canteens with location / hours / contact, no menus |

Each dish: `{ name, nameEn, allergens, price, raw }`. `name`/`nameEn`/`allergens`/`price` are parsed
from free text that every restaurant types differently, so `raw` always carries the original.

## Sources

| canteen id | where | source |
|---|---|---|
| `avgastro-zizkov`, `pizza`, `restaurace-ak`, `umbrella` | Žižkov | https://www.vse.cz/menza/stravovani-zizkov/ |
| `avgastro-jm` | Jižní Město | https://www.vse.cz/menza/stravovani-jizni-mesto/ |
| `jarov` | Jarov dorms | WebKredit JSON (`webkredit_italska`, canteen 5) |
| `volha` | Jižní Město dorms | listed only: their site has just a PDF from 12/2025 |

Not included: Jindřichův Hradec (its WebKredit instance is empty) and WebKredit "Kredenc"
(every row is hidden in WebKredit itself).

Upstream pages are cached 15 min in memory and responses carry `s-maxage=900`, so vse.cz sees a
few requests per hour. If one source fails, the others are still served and `warnings` says why.

## Deploy

`src/index.ts` default-exports the Hono app, which is what Vercel's zero-config Hono support
expects (`vercel deploy`).
