/**
 * Guided Elevator Reviews — client logic
 * Loads reviews from /data/reviews.json (exact export; never invented).
 *
 * Masonry: pack each card into the shortest column (height-balanced).
 * Ties break left-to-right so early/newest items still fill across the top.
 * Avoids one tall column with empty space beside it while scrolling.
 */

(() => {
  "use strict";

  // First paint + each "Load more" click. Multiple of 3 keeps masonry balanced.
  // No infinite scroll — user opts in via the button so they don't auto-load all 94.
  const PAGE_SIZE = 18;
  const REVIEWS_URL = "/data/reviews.json";

  const grid = document.getElementById("reviews-grid");
  const loadMoreBtn = document.getElementById("load-more");
  const statusEl = document.getElementById("reviews-status");
  const sortSelect = document.getElementById("review-sort");
  const yearEl = document.getElementById("year");
  const siteHeader = document.querySelector(".site-header");
  const reviewsToolbar = document.querySelector(".reviews-toolbar");
  const reviewsMosaic = document.querySelector(".reviews-mosaic");

  /** @type {Array<{author:string,rating:number,date:string,text:?string,reply?:string}>} */
  let sourceReviews = [];
  /** @type {Array<{author:string,rating:number,date:string,text:?string,reply?:string}>} */
  let sortedReviews = [];
  let visibleCount = 0;
  /** Prevents double load-more from click + infinite scroll races */
  let isLoadingMore = false;
  /** @type {HTMLElement[]} */
  let columns = [];
  let columnCount = 0;
  /** @type {"newest"|"oldest"|"highest"|"lowest"|"source-az"|"source-za"} */
  let currentSort = "newest";

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  if (sortSelect && sortSelect.value) {
    currentSort = /** @type {typeof currentSort} */ (sortSelect.value);
  }

  // Render static hero stars (4.9)
  document.querySelectorAll(".stars[data-rating]").forEach((el) => {
    const rating = parseFloat(el.getAttribute("data-rating") || "0");
    el.classList.add("stars--lg");
    el.innerHTML = buildStars(rating);
  });

  updateHeaderStickyOffset();
  updateToolbarStuckState();
  init();

  async function init() {
    ensureColumns(getDesiredColumnCount());
    showSkeletons(6);

    try {
      const res = await fetch(REVIEWS_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Failed to load reviews (${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid reviews data");

      // Exact export only — never invent reviews
      sourceReviews = data;
      injectReviewSchema(sourceReviews);
      applySortAndRender({ resetVisible: true });
      grid.setAttribute("aria-busy", "false");
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
      if (sortSelect) sortSelect.disabled = true;
      columns = [];
      columnCount = 0;
    }
  }

  /**
   * @param {{resetVisible?: boolean}} [opts]
   */
  function applySortAndRender(opts = {}) {
    const resetVisible = opts.resetVisible !== false;
    sortedReviews = sortReviews(sourceReviews, currentSort);

    if (resetVisible) {
      visibleCount = 0;
    }

    clearColumns();
    // After a sort change, always start with first page of the new order
    if (resetVisible || visibleCount === 0) {
      renderNextPage();
    } else {
      const count = visibleCount;
      visibleCount = 0;
      const next = sortedReviews.slice(0, count);
      next.forEach((review, i) => {
        const card = createReviewCard(review, i);
        placeCard(card, i);
      });
      visibleCount = next.length;
      updateStatus();
    }
  }

  /**
   * @param {Array<{author:string,rating:number,date:string,text:?string,reply?:string,source?:string}>} reviews
   * @param {"newest"|"oldest"|"highest"|"lowest"|"source-az"|"source-za"} mode
   */
  function sortReviews(reviews, mode) {
    const list = reviews.slice();

    const dateValue = (r) => {
      const t = Date.parse(`${r.date || ""}T12:00:00`);
      return Number.isNaN(t) ? 0 : t;
    };

    const sourceKey = (r) => normalizeSource(r.source);

    list.sort((a, b) => {
      if (mode === "newest") {
        return dateValue(b) - dateValue(a);
      }
      if (mode === "oldest") {
        return dateValue(a) - dateValue(b);
      }
      if (mode === "highest") {
        const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return dateValue(b) - dateValue(a);
      }
      if (mode === "lowest") {
        const ratingDiff = (Number(a.rating) || 0) - (Number(b.rating) || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return dateValue(b) - dateValue(a);
      }
      if (mode === "source-az") {
        const sourceDiff = sourceKey(a).localeCompare(sourceKey(b));
        if (sourceDiff !== 0) return sourceDiff;
        return dateValue(b) - dateValue(a);
      }
      if (mode === "source-za") {
        const sourceDiff = sourceKey(b).localeCompare(sourceKey(a));
        if (sourceDiff !== 0) return sourceDiff;
        return dateValue(b) - dateValue(a);
      }
      return 0;
    });

    return list;
  }

  /** @returns {number} */
  function getDesiredColumnCount() {
    const w = window.innerWidth;
    if (w >= 900) return 3;
    if (w >= 640) return 2;
    return 1;
  }

  /**
   * Create flex column containers for height-balanced masonry.
   * @param {number} count
   */
  function ensureColumns(count) {
    if (columnCount === count && columns.length === count) return;

    // Preserve logical order (dataset.order), then re-pack by shortest column
    const existingCards = collectCardsInDisplayOrder();

    grid.innerHTML = "";
    columns = [];
    columnCount = count;
    grid.style.setProperty("--masonry-cols", String(count));

    for (let i = 0; i < count; i++) {
      const col = document.createElement("div");
      col.className = "reviews-col";
      col.setAttribute("role", "presentation");
      grid.appendChild(col);
      columns.push(col);
    }

    existingCards.forEach((card) => {
      placeCard(card);
    });
  }

  function clearColumns() {
    ensureColumns(getDesiredColumnCount());
    columns.forEach((col) => {
      col.innerHTML = "";
    });
  }

  /**
   * Cards in original sort order (dataset.order), not visual column order.
   * @returns {HTMLElement[]}
   */
  function collectCardsInDisplayOrder() {
    const all = Array.from(grid.querySelectorAll(".review-card"));
    if (all.every((el) => el.dataset.order != null)) {
      return all.sort(
        (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
      );
    }
    return all;
  }

  /**
   * Place a card into the currently shortest column so the mosaic stays
   * height-balanced (avoids one tall column and empty space beside it).
   * Ties break left-to-right so early/newest cards still fill across the top.
   * @param {HTMLElement} card
   */
  function placeCard(card) {
    if (!columns.length) ensureColumns(getDesiredColumnCount());

    let shortest = 0;
    let minHeight = Number.POSITIVE_INFINITY;

    for (let i = 0; i < columns.length; i++) {
      // Force layout so height includes cards just appended in this batch
      const h = columns[i].offsetHeight;
      if (h < minHeight) {
        minHeight = h;
        shortest = i;
      }
    }

    columns[shortest].appendChild(card);
  }

  function showSkeletons(count) {
    ensureColumns(getDesiredColumnCount());
    columns.forEach((col) => {
      col.innerHTML = "";
    });
    for (let i = 0; i < count; i++) {
      const sk = document.createElement("div");
      sk.className = "skeleton-card";
      sk.setAttribute("aria-hidden", "true");
      placeCard(sk);
    }
  }

  function renderNextPage() {
    if (isLoadingMore) return;

    const total = sortedReviews.length;
    if (visibleCount >= total) {
      updateStatus();
      return;
    }

    isLoadingMore = true;
    try {
      ensureColumns(getDesiredColumnCount());
      const next = sortedReviews.slice(visibleCount, visibleCount + PAGE_SIZE);

      next.forEach((review, i) => {
        const index = visibleCount + i;
        const card = createReviewCard(review, index);
        placeCard(card);
      });

      visibleCount = Math.min(total, visibleCount + next.length);
    } finally {
      isLoadingMore = false;
      updateStatus();
    }
  }

  /**
   * Full re-pack of currently visible cards into shortest-column masonry.
   * Used after breakpoint changes and after sort (via clear + re-render).
   */
  function relayoutVisible() {
    if (!sortedReviews.length || visibleCount === 0) {
      ensureColumns(getDesiredColumnCount());
      return;
    }

    const count = Math.min(visibleCount, sortedReviews.length);
    visibleCount = count;
    clearColumns();
    for (let i = 0; i < count; i++) {
      const card = createReviewCard(sortedReviews[i], i);
      placeCard(card);
    }
    updateStatus();
  }

  function updateStatus() {
    const total = sortedReviews.length;
    if (visibleCount > total) visibleCount = total;

    const remaining = Math.max(0, total - visibleCount);

    if (total === 0) {
      statusEl.textContent = "No reviews available.";
      loadMoreBtn.hidden = true;
      loadMoreBtn.setAttribute("hidden", "");
      loadMoreBtn.disabled = true;
      return;
    }

    // Status text and button always share the same remaining math
    if (remaining > 0) {
      statusEl.textContent = `Showing ${visibleCount} of ${total} reviews`;
      loadMoreBtn.hidden = false;
      loadMoreBtn.removeAttribute("hidden");
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent =
        remaining === 1
          ? "Load 1 more review"
          : `Load more reviews (${remaining} remaining)`;
    } else {
      statusEl.textContent = `Showing all ${total} customer reviews`;
      loadMoreBtn.hidden = true;
      loadMoreBtn.setAttribute("hidden", "");
      loadMoreBtn.disabled = true;
    }
  }

  /**
   * @param {{author:string,rating:number,date:string,text:?string,reply?:string,source?:string,location?:string}} review
   * @param {number} index
   */
  function createReviewCard(review, index) {
    const card = document.createElement("article");
    card.className = "review-card";
    card.dataset.order = String(index);
    card.style.animationDelay = `${(index % PAGE_SIZE) * 30}ms`;

    const source = normalizeSource(review.source);
    const sourceLabel = sourceDisplayName(source);
    card.setAttribute(
      "aria-label",
      `Review by ${review.author}, ${review.rating} out of 5 stars, via ${sourceLabel}`
    );

    const rating = Number(review.rating) || 0;
    const dateLabel = formatDate(review.date);
    const hasText =
      typeof review.text === "string" && review.text.trim().length > 0;
    const text = hasText ? review.text.trim() : "";
    const hasReply =
      typeof review.reply === "string" && review.reply.trim().length > 0;
    const hasLocation =
      typeof review.location === "string" && review.location.trim().length > 0;

    card.innerHTML = `
      <div class="review-card-top">
        <div>
          <div class="stars" role="img" aria-label="${rating} out of 5 stars">
            ${buildStars(rating)}
          </div>
          <p class="reviewer-name">${escapeHtml(review.author || "Customer")}</p>
          ${
            hasLocation
              ? `<p class="reviewer-location">${escapeHtml(review.location.trim())}</p>`
              : ""
          }
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
      <div class="review-source" title="${sourceLabel} review">
        ${sourceLogo(source)}
        <span class="visually-hidden">Source: ${sourceLabel}</span>
      </div>
    `;

    return card;
  }

  /** @param {unknown} raw */
  function normalizeSource(raw) {
    const s = String(raw || "google").toLowerCase().trim();
    if (s === "yelp") return "yelp";
    if (s === "buildzoom") return "buildzoom";
    return "google";
  }

  /** @param {"google"|"yelp"|"buildzoom"} source */
  function sourceDisplayName(source) {
    if (source === "yelp") return "Yelp";
    if (source === "buildzoom") return "BuildZoom";
    return "Google";
  }

  /**
   * Brand-style source mark for the card corner.
   * @param {"google"|"yelp"|"buildzoom"} source
   */
  function sourceLogo(source) {
    if (source === "yelp") {
      // Red Yelp burst mark (classic burst silhouette)
      return `<svg class="source-logo source-logo--yelp" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
        <path fill="#D32323" d="M42.9 240.32l99.62 48.61c19.2 9.4 16.2 37.51-4.5 42.71L30.5 358.45a22.79 22.79 0 0 1-28.21-19.6 197.16 197.16 0 0 1 9-85.32 22.8 22.8 0 0 1 31.61-13.21zm44 239.25a199.45 199.45 0 0 0 79.42 32.11A22.78 22.78 0 0 0 192.94 490l3.9-110.82c.7-21.3-25.5-31.91-39.81-16.1l-74.21 82.4a22.82 22.82 0 0 0 4.09 34.09zm145.34-109.92l58.81 94a22.93 22.93 0 0 0 34 5.5 198.36 198.36 0 0 0 52.71-67.61A23 23 0 0 0 364.17 370l-105.42-34.26c-19.41-6.21-28.51 23.91-11.51 34.91zm148.33-132.23a197.44 197.44 0 0 0-50.41-69.31 22.85 22.85 0 0 0-34 4.4l-62 91.92c-11.9 17.7 12.8 36.31 28.5 20.91l105.41-34.22a22.87 22.87 0 0 0 12.5-13.7zm-77.71-110.62l-14.81-2.81c-18.11-3.41-28.31 16.7-16.41 30.5l80.81 93.41c14.91 17.3 42.11 3.71 34.51-16.4a198 198 0 0 0-55.41-96.7 22.79 22.79 0 0 0-28.69-8z"/>
      </svg>`;
    }

    if (source === "buildzoom") {
      // Official BuildZoom house + magnifying glass mark (from their site)
      return `<img class="source-logo source-logo--buildzoom" src="/buildzoom-logo.png" width="20" height="20" alt="" decoding="async" />`;
    }

    // Multicolor Google "G"
    return `<svg class="source-logo source-logo--google" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>`;
  }

  /**
   * @param {number} rating
   */
  function buildStars(rating) {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
    const roundedHalf = rating - full >= 0.75;

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
   * @param {Array} reviews
   */
  function injectReviewSchema(reviews) {
    document
      .querySelectorAll('script[data-review-schema="true"]')
      .forEach((n) => n.remove());

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

  /**
   * Keep CSS sticky offset aligned with the live sticky header height.
   */
  function updateHeaderStickyOffset() {
    if (!siteHeader) return;
    const h = Math.ceil(siteHeader.getBoundingClientRect().height);
    document.documentElement.style.setProperty(
      "--header-sticky-offset",
      `${h}px`
    );
  }

  /**
   * Visual cue when the reviews title/sort bar is pinned under the header.
   */
  function updateToolbarStuckState() {
    if (!reviewsToolbar || !siteHeader) return;
    const headerBottom = siteHeader.getBoundingClientRect().bottom;
    const toolbarTop = reviewsToolbar.getBoundingClientRect().top;
    const stuck = toolbarTop <= headerBottom + 1;
    reviewsToolbar.classList.toggle("is-stuck", stuck);
  }

  /**
   * After re-sort: scroll so the top of the mosaic sits just under the
   * pinned header + Customer Reviews toolbar, keeping the normal gap
   * (toolbar margin-bottom) so spacing matches a natural scroll stop.
   *
   * Note: when the toolbar is already sticky, its getBoundingClientRect is
   * pinned under the header — so we must target the mosaic, not the toolbar.
   */
  function scrollToTopOfMosaic() {
    if (!siteHeader || !reviewsMosaic) return;

    updateHeaderStickyOffset();

    const headerH = siteHeader.getBoundingClientRect().height;
    const toolbarH = reviewsToolbar
      ? reviewsToolbar.getBoundingClientRect().height
      : 0;

    // margin-bottom is outside the border box — without it, the mosaic
    // sits flush against the stuck toolbar (gap collapses to 0).
    const toolbarGap = reviewsToolbar
      ? parseFloat(window.getComputedStyle(reviewsToolbar).marginBottom) || 0
      : 0;

    const mosaicDocTop =
      reviewsMosaic.getBoundingClientRect().top + window.scrollY;
    // Leave header + sticky toolbar + its bottom margin above the mosaic
    const targetY = Math.max(
      0,
      mosaicDocTop - headerH - toolbarH - toolbarGap
    );

    window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    updateToolbarStuckState();
  }

  sortSelect?.addEventListener("change", () => {
    currentSort = /** @type {typeof currentSort} */ (
      sortSelect.value || "newest"
    );
    applySortAndRender({ resetVisible: true });
    // Jump to top of the new mosaic under the pinned title/sort bar
    scrollToTopOfMosaic();
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTopOfMosaic);
    });
  });

  loadMoreBtn?.addEventListener("click", () => {
    if (isLoadingMore || loadMoreBtn.disabled || loadMoreBtn.hidden) return;
    // Append the next batch below without jumping scroll — user keeps
    // reading from the same place and scrolls into the new cards naturally.
    renderNextPage();
  });

  // Sticky toolbar state only — do not auto-load on scroll (button is intentional)
  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        updateToolbarStuckState();
      });
    },
    { passive: true }
  );

  let resizeTicking = false;
  window.addEventListener(
    "resize",
    () => {
      if (resizeTicking) return;
      resizeTicking = true;
      requestAnimationFrame(() => {
        resizeTicking = false;
        updateHeaderStickyOffset();
        updateToolbarStuckState();
        const desired = getDesiredColumnCount();
        if (desired !== columnCount) {
          relayoutVisible();
        }
      });
    },
    { passive: true }
  );

  // Header height can change after fonts/images load
  if (siteHeader && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      updateHeaderStickyOffset();
      updateToolbarStuckState();
    });
    ro.observe(siteHeader);
  }
})();
