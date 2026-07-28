/**
 * Guided Elevator Reviews — client logic
 * Loads reviews from /data/reviews.json (exact export; never invented).
 *
 * Masonry: left-to-right packing into N columns so top-of-list reviews sit
 * across the top (not newspaper-style top-to-bottom column fill).
 */

(() => {
  "use strict";

  const PAGE_SIZE = 9;
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
  /** @type {HTMLElement[]} */
  let columns = [];
  let columnCount = 0;
  /** @type {"newest"|"oldest"|"highest"|"lowest"} */
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
   * @param {Array<{author:string,rating:number,date:string,text:?string,reply?:string}>} reviews
   * @param {"newest"|"oldest"|"highest"|"lowest"} mode
   */
  function sortReviews(reviews, mode) {
    const list = reviews.slice();

    const dateValue = (r) => {
      const t = Date.parse(`${r.date || ""}T12:00:00`);
      return Number.isNaN(t) ? 0 : t;
    };

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
   * Create flex column containers for left-to-right masonry.
   * @param {number} count
   */
  function ensureColumns(count) {
    if (columnCount === count && columns.length === count) return;

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

    existingCards.forEach((card, i) => {
      placeCard(card, i);
    });
  }

  function clearColumns() {
    ensureColumns(getDesiredColumnCount());
    columns.forEach((col) => {
      col.innerHTML = "";
    });
  }

  /**
   * @returns {HTMLElement[]}
   */
  function collectCardsInDisplayOrder() {
    if (!columns.length) {
      return Array.from(grid.querySelectorAll(".review-card"));
    }

    const all = Array.from(grid.querySelectorAll(".review-card"));
    if (all.every((el) => el.dataset.order != null)) {
      return all.sort(
        (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
      );
    }

    const perCol = columns.map((col) =>
      Array.from(col.querySelectorAll(".review-card"))
    );
    const maxLen = Math.max(0, ...perCol.map((list) => list.length));
    /** @type {HTMLElement[]} */
    const ordered = [];

    for (let row = 0; row < maxLen; row++) {
      for (let c = 0; c < perCol.length; c++) {
        if (perCol[c][row]) ordered.push(perCol[c][row]);
      }
    }
    return ordered;
  }

  /**
   * @param {HTMLElement} card
   * @param {number} index
   */
  function placeCard(card, index) {
    if (!columns.length) ensureColumns(getDesiredColumnCount());
    const colIndex = index % columns.length;
    columns[colIndex].appendChild(card);
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
      placeCard(sk, i);
    }
  }

  function renderNextPage() {
    ensureColumns(getDesiredColumnCount());
    const next = sortedReviews.slice(visibleCount, visibleCount + PAGE_SIZE);

    next.forEach((review, i) => {
      const index = visibleCount + i;
      const card = createReviewCard(review, index);
      placeCard(card, index);
    });

    visibleCount += next.length;
    updateStatus();
  }

  function relayoutVisible() {
    if (!sortedReviews.length || visibleCount === 0) {
      ensureColumns(getDesiredColumnCount());
      return;
    }

    const count = visibleCount;
    clearColumns();
    for (let i = 0; i < count; i++) {
      const card = createReviewCard(sortedReviews[i], i);
      placeCard(card, i);
    }
    updateStatus();
  }

  function updateStatus() {
    const total = sortedReviews.length;
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
    card.dataset.order = String(index);
    card.style.animationDelay = `${(index % PAGE_SIZE) * 30}ms`;
    card.setAttribute(
      "aria-label",
      `Review by ${review.author}, ${review.rating} out of 5 stars`
    );

    const rating = Number(review.rating) || 0;
    const dateLabel = formatDate(review.date);
    const hasText =
      typeof review.text === "string" && review.text.trim().length > 0;
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
    loadMoreBtn.disabled = true;
    renderNextPage();
  });

  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        updateToolbarStuckState();
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
