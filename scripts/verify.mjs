import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviews = JSON.parse(readFileSync(join(root, "data", "reviews.json"), "utf8"));
const html = readFileSync(join(root, "public", "index.html"), "utf8");
const appJs = readFileSync(join(root, "public", "app.js"), "utf8");

const sources = reviews.reduce((acc, r) => {
  const s = String(r.source || "google").toLowerCase();
  acc[s] = (acc[s] || 0) + 1;
  return acc;
}, {});

const checks = [
  ["review count is 94", reviews.length === 94],
  ["has google reviews", (sources.google || 0) >= 1],
  ["has yelp reviews", (sources.yelp || 0) >= 1],
  ["has buildzoom reviews", (sources.buildzoom || 0) >= 1],
  ["title present", html.includes("Guided Elevator Reviews | 4.9")],
  ["generic customer reviews title", html.includes("94 Customer Reviews")],
  ["meta description", html.includes("Family-owned elevator installation")],
  ["phone present", html.includes("(562) 420-3139")],
  ["CSLB present", html.includes("CSLB #864630")],
  ["LocalBusiness schema", html.includes('"@type": "LocalBusiness"')],
  ["AggregateRating count 94", html.includes('"reviewCount": "94"')],
  ["canonical domain", html.includes("guidedelevatorreviews.com")],
  ["mentions BuildZoom in copy", html.includes("BuildZoom")],
  ["app supports buildzoom source", appJs.includes("buildzoom")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed += 1;
}

console.log(
  `Sources: google=${sources.google || 0}, yelp=${sources.yelp || 0}, buildzoom=${sources.buildzoom || 0}`
);

if (failed) {
  process.exit(1);
}
console.log("All verify checks passed.");
