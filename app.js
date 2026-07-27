/**
 * Guided Elevator Reviews — client logic
 * Loads reviews from /data/reviews.json (exact export; never invented).
 */

(() => {
  "use strict";

  const PAGE_SIZE = 9;
  const REVIEWS_URL = "/data/reviews.json";

  const grid = document.getElementById("reviews-grid");
  const loadMoreBtn = document.getElementById("load-more");
  const statusEl = document.getElementById("reviews-status");
  const yearEl = document.getElementById("year");

  /** @type {Array<{author:string,rating:number,date:string,text:?string,reply?:string}>} */
  let allReviews = [];
  let visibleCount = 0;

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // Render static hero stars (4.9)
  document.querySelectorAll(".stars[data-rating]").forEach((el) => {
    const rating = parseFloat(el.getAttribute("data-rating") || "0");
    el.classList.add("stars--lg");
    el.innerHTML = buildStars(rating);
  });

  init();

  async function init() {
    showSkeletons(6);

    try {
      const res = await fetch(REVIEWS_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Failed to load reviews (${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid reviews data");

      // Use exactly the provided data, preserve sort order (newest first)
      allReviews = data;
      visibleCount = 0;
      grid.innerHTML = "";
      grid.setAttribute("aria-busy", "false");

      injectReviewSchema(allReviews);
      renderNextPage();
    } catch (err) {
      console.error(err);
      grid.setAttribute("aria-busy", "false");
      grid.innerHTML = `
        <div class="error-state" role="alert">
          <p><strong>We couldn’t load reviews right now.</strong></p>
          <p>Please refresh the page, or call
            <a href="tel:+15624203139">(562) 420-3139</a>.
          </p>
        </div>`;
      statusEl.textContent = "";
      loadMoreBtn.hidden = true;
    }
  }

  function showSkeletons(count) {
    grid.innerHTML = Array.from({ length: count }, () =>
      `<div class="skeleton-card" aria-hidden="true"></div>`
    ).join("");
  }

  function renderNextPage() {
    const next = allReviews.slice(visibleCount, visibleCount + PAGE_SIZE);
    const fragment = document.createDocumentFragment();

    next.forEach((review, i) => {
      fragment.appendChild(createReviewCard(review, visibleCount + i));
    });

    grid.appendChild(fragment);
    visibleCount += next.length;

    updateStatus();
  }

  function updateStatus() {
    const total = allReviews.length;
    const remaining = total - visibleCount;

    if (total === 0) {
      statusEl.textContent = "No reviews available.";
      loadMoreBtn.hidden = true;
      return;
    }

    statusEl.textContent = `Showing ${visibleCount} of ${total} reviews`;

    if (remaining > 0) {
      loadMoreBtn.hidden = false;
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent =
        remaining === 1
          ? "Load 1 more review"
          : `Load more reviews (${remaining} remaining)`;
    } else {
      loadMoreBtn.hidden = true;
      statusEl.textContent = `Showing all ${total} Google reviews`;
    }
  }

  /**
   * @param {{author:string,rating:number,date:string,text:?string,reply?:string}} review
   * @param {number} index
   */
  function createReviewCard(review, index) {
    const card = document.createElement("article");
    card.className = "review-card";
    card.style.animationDelay = `${(index % PAGE_SIZE) * 30}ms`;
    card.setAttribute(
      "aria-label",
      `Review by ${review.author}, ${review.rating} out of 5 stars`
    );

    const rating = Number(review.rating) || 0;
    const dateLabel = formatDate(review.date);
    const hasText = typeof review.text === "string" && review.text.trim().length > 0;
    const text = hasText ? review.text.trim() : "";
    const hasReply =
      typeof review.reply === "string" && review.reply.trim().length > 0;

    card.innerHTML = `
      <div class="review-card-top">
        <div>
          <div class="stars" role="img" aria-label="${rating} out of 5 stars">
            ${buildStars(rating)}
          </div>
          <p class="reviewer-name">${escapeHtml(review.author || "Google User")}</p>
        </div>
        <time class="review-date" datetime="${escapeAttr(review.date || "")}">
          ${escapeHtml(dateLabel)}
        </time>
      </div>
      <p class="review-text${hasText ? "" : " review-text--empty"}">
        ${hasText ? escapeHtml(text) : "Rated Guided Elevator without a written comment."}
      </p>
      ${
        hasReply
          ? `<div class="review-reply">
              <p class="review-reply-label">Response from Guided Elevator</p>
              <p class="review-reply-text">${escapeHtml(review.reply.trim())}</p>
            </div>`
          : ""
      }
    `;

    return card;
  }

  /**
   * Build star SVGs for a rating (supports half stars for aggregate display).
   * @param {number} rating
   */
  function buildStars(rating) {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
    const roundedHalf = rating - full >= 0.75;
    let filled = full + (roundedHalf ? 1 : 0);
    if (hasHalf) {
      // use half for aggregate only
    }

    let html = "";
    for (let i = 1; i <= 5; i++) {
      if (i <= full || (roundedHalf && i === full + 1)) {
        html += starSvg("full");
      } else if (hasHalf && i === full + 1) {
        html += starSvg("half");
      } else {
        html += starSvg("empty");
      }
    }
    return html;
  }

  /** @param {"full"|"half"|"empty"} type */
  function starSvg(type) {
    if (type === "empty") {
      return `<svg class="star-empty" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
    }
    if (type === "half") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="halfGrad">
            <stop offset="50%" stop-color="currentColor"/>
            <stop offset="50%" stop-color="#cbd5e1"/>
          </linearGradient>
        </defs>
        <path fill="url(#halfGrad)" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
  }

  /**
   * Inject Schema.org Review objects for each review (plus keep AggregateRating on LocalBusiness).
   * @param {Array} reviews
   */
  function injectReviewSchema(reviews) {
    // Remove any previous dynamic schema
    document
      .querySelectorAll('script[data-review-schema="true"]')
      .forEach((n) => n.remove());

    // Schema.org best practice: attach reviews to LocalBusiness
    // Chunk if needed; 89 is fine in one graph
    const reviewNodes = reviews
      .filter((r) => r && r.author)
      .map((r) => {
        /** @type {Record<string, unknown>} */
        const node = {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: r.author,
          },
          datePublished: r.date || undefined,
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
            author: {
              "@type": "Organization",
              name: "Guided Elevator",
            },
            text: r.reply.trim(),
          };
        }

        return node;
      });

    const graph = {
      "@context": "https://schema.org",
      "@graph": reviewNodes,
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.reviewSchema = "true";
    script.textContent = JSON.stringify(graph);
    document.head.appendChild(script);
  }

  /** @param {string} dateStr */
  function formatDate(dateStr) {
    if (!dateStr) return "";
    // Expect YYYY-MM-DD
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /** @param {string} str */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** @param {string} str */
  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, "&#96;");
  }

  loadMoreBtn?.addEventListener("click", () => {
    loadMoreBtn.disabled = true;
    renderNextPage();
  });

  // Optional: infinite scroll near bottom of grid
  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        if (loadMoreBtn.hidden || loadMoreBtn.disabled) return;
        const rect = loadMoreBtn.getBoundingClientRect();
        if (rect.top < window.innerHeight + 200) {
          loadMoreBtn.disabled = true;
          renderNextPage();
        }
      });
    },
    { passive: true }
  );
})();
