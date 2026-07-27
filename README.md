# Guided Elevator Reviews

Standalone Google reviews showcase for **Guided Elevator**.

- **Production domain:** [https://www.guidedelevatorreviews.com](https://www.guidedelevatorreviews.com)
- **Main company site:** [https://www.guidedelevator.com](https://www.guidedelevator.com)

This site is intentionally separate from the main marketing site — a clean, trustworthy review wall (NiceJob-style) for homeowners and contractors across Los Angeles & Orange County.

## Stack

- Static HTML / CSS / vanilla JS (fast, no framework runtime)
- Reviews loaded from `data/reviews.json` (export of Google Business Profile reviews)
- Deployed on **Vercel**
- Schema.org `LocalBusiness`, `AggregateRating`, and individual `Review` markup

## Local development

```bash
npm start
```

Opens a local static server at `http://localhost:3000`.

```bash
npm run build   # validate reviews + prepare static assets
npm run verify  # smoke checks for SEO/content requirements
```

## Content rules

- **Do not invent reviews.** Only use exact data from `data/reviews.json`.
- Keep tone professional and trustworthy.
- Rating display: **4.9** based on **89** Google reviews.

## Contact

- Phone: (562) 420-3139
- Address: 20204 State Road, Cerritos, CA 90703
- CSLB #864630
