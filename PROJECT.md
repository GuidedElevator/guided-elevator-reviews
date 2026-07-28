# PROJECT.md — Guided Elevator Reviews

Hand-off document for the **standalone Google reviews showcase** site. A clean agent (or developer) should be able to continue work from this file alone.

---

## Purpose

- Dedicated review wall for **Guided Elevator** (NiceJob / high-end testimonial style).
- **Not** part of the main marketing site at [guidedelevator.com](https://www.guidedelevator.com).
- Builds trust with real Google reviews for homeowners and contractors in **Los Angeles & Orange County**.

**Canonical product URLs**

| Role | URL |
| --- | --- |
| Custom domain | https://www.guidedelevatorreviews.com / https://guidedelevatorreviews.com |
| Vercel production alias | https://guided-elevator-reviews.vercel.app |
| Main company site | https://www.guidedelevator.com |
| Service request form | https://www.guidedelevator.com/service |
| Google Business reviews | [Google Maps GBP reviews](https://www.google.com/maps/place/Guided+Elevator/@33.8469193,-118.0971524,17z/data=!4m8!3m7!1s0x80dd3274e92cc751:0xe09160a0865914c8!8m2!3d33.8469193!4d-118.0945775!9m1!1b1!16s%2Fg%2F1tdq69zj?entry=ttu&g_ep=EgoyMDI2MDcxOS4wIKXMDSoASAFQAw%3D%3D) |

---

## Repo & deploy

| Item | Value |
| --- | --- |
| Local path | `C:\Users\GuidedElevator\Dropbox\Development Items\Groksite\guided-reviews` |
| Sibling main site | `..\guided-elevator` (Next.js marketing site — separate project) |
| GitHub | https://github.com/GuidedElevator/guided-elevator-reviews |
| Default branch | `main` |
| GitHub org/user | `GuidedElevator` |
| Vercel team | `guided-elevator-projects` |
| Vercel project name | `guided-elevator-reviews` |
| Vercel CLI user | `guidedelevator` |
| Framework | **None** — static HTML/CSS/JS |
| Output / public root | **`public/`** (Vercel treats this as the deploy root) |

### Deploy commands

```bash
# Local
npm start          # serve public/ on http://localhost:3000
npm run build      # validate reviews, copy JSON into public/, inject Review schema into index.html
npm run verify     # SEO/content smoke checks

# Ship
git add -A && git commit -m "..." && git push origin main
vercel deploy --prod --yes
```

GitHub is connected to Vercel; production deploys also work from push if auto-deploy is enabled. CLI deploy has been used successfully.

### Critical Vercel detail

If you put only root-level HTML and also have a `public/` folder, Vercel’s static detection may deploy **only** `public/` and 404 the rest. **All served assets live under `public/`.** Source-of-truth reviews also live in root `data/reviews.json`; build copies into `public/data/`.

---

## Stack

- **No React/Next** on this site — keep it fast and simple.
- `public/index.html` — structure, SEO meta, Open Graph, LocalBusiness + AggregateRating JSON-LD (static).
- `public/styles.css` — design system, layout, sticky toolbar, masonry columns.
- `public/app.js` — load reviews, sort, masonry packing, sticky offset, load-more / infinite scroll, Review schema injection.
- `scripts/build.mjs` — validate JSON, sync `public/data/`, inject full Review `@graph` into `public/index.html`.
- `scripts/verify.mjs` — asserts 89 reviews, title, phone, CSLB, schema, domain strings.
- `vercel.json` — security headers + cache headers for data/static assets.

**Node:** `>=18` (engines field; Vercel may warn about auto major upgrades).

---

## Company facts (do not invent)

| Field | Value |
| --- | --- |
| Name | Guided Elevator |
| Phone | (562) 420-3139 → `tel:+15624203139` |
| Address | 20204 State Road, Cerritos, CA 90703 |
| CSLB | #864630 |
| Email | sales@guidedelevator.com |
| Since | 2006 (family-owned) |
| Service area | Los Angeles & Orange County |
| Display rating | **4.9** out of 5 |
| Review count (current data) | **89** Google reviews |
| Brand orange (main site) | `#ff5c00` (hover/dark `#e04f00`, light `#ff7a33`) |
| Design palette | Deep navy (`#0a1f3a` etc.) + white + gold stars (`#d4a017`) + green reply accents |

Main site brand tokens live in `guided-elevator/src/app/globals.css` (`--brand-orange`).

---

## Reviews data

### Source of truth

- **Canonical export:** root `data/reviews.json`
- **Originally imported from:**  
  `C:\Users\GuidedElevator\Dropbox\Development Items\Groksite\reviews-clean.json`
- **Runtime fetch:** `/data/reviews.json` (from `public/data/reviews.json` after build/copy)

### Schema (per review)

```json
{
  "author": "string",
  "rating": 1–5,
  "date": "YYYY-MM-DD",
  "text": "string | null",
  "reply": "string (optional company reply)"
}
```

### Content rules

1. **Never invent reviews.** Only exact data from the JSON.
2. Some reviews have `text: null` — UI shows a short italic placeholder; still show stars/name/date.
3. Optional `reply` renders in a green-tinted “Response from Guided Elevator” box.
4. JSON is roughly newest-first; client re-sorts based on UI control.
5. When updating reviews: replace `data/reviews.json`, run `npm run build`, update hard-coded **4.9** / **89** in HTML + AggregateRating + verify script if counts change.

### Stats from last import (for orientation)

- 89 total; mostly 5★; includes replies on a subset; a few null texts.

---

## Page structure & UX

### Header (sticky, z-index 50)

- Logo + “Guided Elevator Reviews” + LA/OC subtitle  
- Phone `(562) 420-3139` — **must stay single-line on mobile** (`white-space: nowrap`, `min-width: max-content`)  
- Orange **Request Service** → `https://www.guidedelevator.com/service` (new tab)  
- Outline **Visit GuidedElevator.com →**

### Hero

- Intro copy (family-owned since 2006, services listed)  
- CTAs: Request Service, Call, Visit site  
- **Rating card (4.9)** — entire card is a **link** to Google Business reviews (new tab); hover lift  

### Stats bar

- 4.9 ★ Google Rating · 89+ Reviews · Since 2006 · LA & OC  

### Reviews section (two logical blocks)

1. **`.reviews-toolbar`** (title, description, sort) — **position: sticky** under header  
2. **`.reviews-mosaic`** (grid + load more) — scrolls while toolbar is pinned  

**Sort dropdown** (right-aligned): `newest` | `oldest` | `highest` | `lowest`  
- Highest/lowest use rating, then date desc for ties.  
- On change: re-sort full list, reset to first page of cards, **scroll to top of mosaic** under pinned toolbar **including toolbar `margin-bottom`** so gap does not collapse.

**Sticky behavior**

- CSS `top: var(--header-sticky-offset)` — JS sets offset from live `.site-header` height (`ResizeObserver`).  
- `.is-stuck` class adds border/shadow when pinned.  
- Full-bleed `::before` on toolbar so background covers edges while stuck.

**Masonry**

- **Not** CSS `column-count` (that fills top-to-bottom per column → old reviews at top of col 2/3).  
- **JS left-to-right packing:** N flex columns (1 / 2 / 3 by breakpoint), cards assigned `index % columns`.  
- Newest (or current sort order) appears **across the top** of all columns.  
- Breakpoints: `<640` → 1 col; `≥640` → 2; `≥900` → 3. Resize relayouts.

**Pagination**

- `PAGE_SIZE = 9`  
- Load more button + infinite scroll near load-more control  

### CTA band + footer

- Request Service (orange), phone, main site  
- Footer: Guided Elevator, CSLB, phone, site link, address, “genuine Google reviews…” disclaimer  

---

## SEO & schema

### Meta (in `public/index.html`)

- **Title:** `Guided Elevator Reviews | 4.9★ from 89 Google Reviews (Los Angeles & Orange County)`  
- **Description:** family-owned elevator install/repair/maintenance/dumbwaiter, LA & OC since 2006  
- Canonical: `https://www.guidedelevatorreviews.com/`  
- Open Graph / Twitter use logo.png  

### Structured data

1. Static in HTML: `LocalBusiness` + `AggregateRating` (`ratingValue` 4.9, `reviewCount` 89)  
2. Build + client: full `Review` graph for each review (`data/reviews-schema.json` + injected `#reviews-schema` + optional runtime script)  
3. `robots.txt` + `sitemap.xml` in `public/`  

When review count/rating changes, update **all** hard-coded occurrences (hero, stats, meta, schema, verify).

---

## File map

```
guided-reviews/
├── PROJECT.md              ← this hand-off doc
├── README.md               ← shorter public overview
├── package.json
├── vercel.json
├── .gitignore
├── data/
│   ├── reviews.json        ← canonical review data
│   └── reviews-schema.json ← generated Review @graph
├── public/                 ← everything Vercel serves
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── data/reviews.json
│   ├── data/reviews-schema.json
│   ├── favicon.ico / favicon.png / logo.png
│   ├── robots.txt
│   └── sitemap.xml
└── scripts/
    ├── build.mjs
    └── verify.mjs
```

Assets originally copied from parent Groksite / main site (`Logo.png`, favicons).

---

## Design / CSS notes

- Font: Inter (Google Fonts)  
- Mobile-first; header actions wrap on small screens  
- `.btn-orange` = main-site brand orange  
- Phone pill: `.phone-link` — do not allow flex shrink to wrap the number  
- Sticky stacking: header `z-index: 50`, reviews toolbar `z-index: 40`  
- Prefer reduced-motion: disable card animations  

### Important JS functions (`public/app.js`)

| Function | Role |
| --- | --- |
| `sortReviews` | newest/oldest/highest/lowest |
| `applySortAndRender` | re-sort + rebuild mosaic |
| `placeCard` / `ensureColumns` | L→R masonry |
| `renderNextPage` | load more |
| `updateHeaderStickyOffset` | `--header-sticky-offset` |
| `updateToolbarStuckState` | `.is-stuck` |
| `scrollToTopOfMosaic` | after sort: pin mosaic top under header+toolbar **+ margin-bottom gap** |
| `injectReviewSchema` | client-side Review JSON-LD |

---

## DNS / domains

Domains on Vercel project: `guidedelevatorreviews.com`, `www.guidedelevatorreviews.com`.

Registrar historically used **Namecheap-style** nameservers (`dns1.registrar-servers.com`). If SSL/domain shows invalid, check Project → Settings → Domains for current A/CNAME targets (values can change; do not hard-code old IPs forever).

---

## What was intentionally decided

1. **Separate repo/project** from main Next.js site — reviews showcase stays independent.  
2. **Static only** — no framework, no CMS, no live Google API (export JSON).  
3. **Masonry via JS columns**, not CSS multi-column, so sort order reads left-to-right across the top.  
4. **Sticky toolbar**, not a nested scroll pane — page scroll pins title/sort; mosaic continues.  
5. **Sort reset** always returns to first page of the new order and scrolls to mosaic top with correct gap.  
6. **Request Service** orange CTA in header, hero, and bottom band — primary conversion action.  

---

## Common tasks for the next agent

### Update reviews from a new export

1. Replace `data/reviews.json` with the new clean export.  
2. Recount reviews / average if needed; update 4.9 and 89 everywhere hard-coded.  
3. `npm run build && npm run verify`  
4. Commit, push, `vercel deploy --prod --yes`  

### Change copy or CTAs

- Edit `public/index.html` (and CSS if layout).  
- Keep service URL and phone consistent with main site constants.  

### Fix layout / sticky / sort

- Almost always `public/styles.css` + `public/app.js`.  
- After sticky/sort work, test: deep scroll → change sort → gap under toolbar → phone on narrow viewport.  

### Do not

- Invent reviews or fake ratings.  
- Merge this into the Next.js main site without an explicit product decision.  
- Move served files out of `public/` without adjusting Vercel output.  

---

## Related monorepo context

Parent folder: `Groksite/`

- `guided-elevator/` — main Next.js site (elevators, marketing, Jobber, etc.)  
- `reviews-clean.json` — original reviews export used to seed this project  
- `guided-reviews/` — **this** project  

Main site also has Google reviews carousel / API pieces under `guided-elevator/src/lib/google-reviews*` — **this reviews site does not use those**; it uses the static JSON only.

---

## Recent commit themes (history orientation)

1. Initial static site + schema + Vercel/GitHub  
2. Move deployable assets into `public/` (fix Vercel 404)  
3. Orange Request Service + multi-column (later replaced with L→R masonry)  
4. Sort control, sticky toolbar, Google rating link, header CTA  
5. Post-sort scroll + gap preservation  
6. Header phone nowrap on mobile  

---

## Verification checklist before shipping

- [ ] `npm run build` succeeds (89 or current count validated)  
- [ ] `npm run verify` passes  
- [ ] Homepage loads: header CTAs, 4.9 card links to Google, reviews mosaic  
- [ ] Sort all four modes; mosaic top order correct (L→R)  
- [ ] Sticky toolbar under header while scrolling mosaic  
- [ ] After sort while deep-scrolled: returns to top of mosaic with gap under toolbar  
- [ ] Mobile: phone number single line; CTAs usable  
- [ ] `/data/reviews.json` 200; no invented content  

---

*Last updated for hand-off after production deploys through commit `18480ba` (phone wrap fix) and related UX polish on `main`.*
