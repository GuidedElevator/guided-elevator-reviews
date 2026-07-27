import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviews = JSON.parse(readFileSync(join(root, "data", "reviews.json"), "utf8"));
const html = readFileSync(join(root, "public", "index.html"), "utf8");

const checks = [
  ["review count is 89", reviews.length === 89],
  ["title present", html.includes("Guided Elevator Reviews | 4.9")],
  ["meta description", html.includes("Family-owned elevator installation")],
  ["phone present", html.includes("(562) 420-3139")],
  ["CSLB present", html.includes("CSLB #864630")],
  ["LocalBusiness schema", html.includes('"@type": "LocalBusiness"')],
  ["AggregateRating", html.includes('"reviewCount": "89"')],
  ["canonical domain", html.includes("guidedelevatorreviews.com")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log("All verify checks passed.");
