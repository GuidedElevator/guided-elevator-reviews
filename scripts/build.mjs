/**
 * Static site build: validate reviews, ensure public/ is complete, inject Review schema.
 */
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const dataDir = join(root, "data");

const reviewsPath = join(dataDir, "reviews.json");
const reviews = JSON.parse(readFileSync(reviewsPath, "utf8"));

if (!Array.isArray(reviews) || reviews.length === 0) {
  console.error("Build failed: data/reviews.json must be a non-empty array.");
  process.exit(1);
}

const required = ["author", "rating", "date"];
for (const [i, r] of reviews.entries()) {
  for (const key of required) {
    if (r[key] === undefined || r[key] === null || r[key] === "") {
      console.error(`Build failed: review[${i}] missing ${key}`);
      process.exit(1);
    }
  }
  const source = String(r.source || "google").toLowerCase();
  if (source !== "google" && source !== "yelp" && source !== "buildzoom") {
    console.error(
      `Build failed: review[${i}] has unsupported source "${r.source}"`
    );
    process.exit(1);
  }
}

// Ensure public/data has the reviews JSON
mkdirSync(join(publicDir, "data"), { recursive: true });
copyFileSync(reviewsPath, join(publicDir, "data", "reviews.json"));

const reviewNodes = reviews.map((r) => {
  const node = {
    "@type": "Review",
    author: { "@type": "Person", name: r.author },
    datePublished: r.date,
    reviewRating: {
      "@type": "Rating",
      ratingValue: String(r.rating),
      bestRating: "5",
      worstRating: "1",
    },
    itemReviewed: {
      "@type": "LocalBusiness",
      name: "Guided Elevator",
      "@id": "https://www.guidedelevator.com/#business",
    },
  };
  if (typeof r.text === "string" && r.text.trim()) {
    node.reviewBody = r.text.trim();
  }
  if (typeof r.reply === "string" && r.reply.trim()) {
    node.comment = {
      "@type": "Comment",
      author: { "@type": "Organization", name: "Guided Elevator" },
      text: r.reply.trim(),
    };
  }
  return node;
});

const graph = {
  "@context": "https://schema.org",
  "@graph": reviewNodes,
};

writeFileSync(join(dataDir, "reviews-schema.json"), JSON.stringify(graph));
writeFileSync(
  join(publicDir, "data", "reviews-schema.json"),
  JSON.stringify(graph)
);

// Inject static Review schema into public/index.html for crawlers
const indexPath = join(publicDir, "index.html");
if (!existsSync(indexPath)) {
  console.error("Build failed: public/index.html missing.");
  process.exit(1);
}

let html = readFileSync(indexPath, "utf8");

const schemaBlock = `    <script type="application/ld+json" id="reviews-schema">
${JSON.stringify(graph, null, 2)
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")
  .trimStart()}
    </script>`;

if (html.includes('id="reviews-schema"')) {
  html = html.replace(
    /<script type="application\/ld\+json" id="reviews-schema">[\s\S]*?<\/script>/,
    schemaBlock
  );
} else {
  html = html.replace("</head>", `${schemaBlock}\n  </head>`);
}

writeFileSync(indexPath, html);

// Required public files
for (const file of ["index.html", "styles.css", "app.js", "favicon.ico", "logo.png"]) {
  if (!existsSync(join(publicDir, file))) {
    console.error(`Build failed: public/${file} missing.`);
    process.exit(1);
  }
}

console.log(`Build OK: ${reviews.length} reviews validated & public/ ready.`);
