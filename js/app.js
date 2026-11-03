/**
 * ClassVault - Public Homepage & SPA View Controller
 * Manages class listings, live search, subject filters, stats calculation,
 * safe Google Drive redirection, and seamless switching between Public and Admin views.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Navigation & View Switching Elements
  const publicView = document.getElementById("publicView");
  const adminView = document.getElementById("adminView");
  const navAdminBtn = document.getElementById("navAdminBtn");
  const navHomeLink = document.getElementById("navHomeLink");
  const navSubjectsLink = document.getElementById("navSubjectsLink");
  const navRecordingsLink = document.getElementById("navRecordingsLink");
  const brandLogoLink = document.getElementById("brandLogoLink");
  const btnReturnPublic = document.getElementById("btnReturnPublic");
  const headerSearchWrapper = document.getElementById("headerSearchWrapper");
  const siteHeader = document.getElementById("header");

  // Public Catalog DOM Elements
  const heroSearchInput = document.getElementById("heroSearchInput");
  const headerSearchInput = document.getElementById("headerSearchInput");
  const searchClearBtn = document.getElementById("searchClearBtn");
  const categoriesContainer = document.getElementById("categoriesContainer");
  const recordingsGrid = document.getElementById("recordingsGrid");
  const resultsCount = document.getElementById("resultsCount");
  const statTotalClasses = document.getElementById("statTotalClasses");
  const statTotalSubjects = document.getElementById("statTotalSubjects");
  const statRecentClasses = document.getElementById("statRecentClasses");

  // State Management
  let allRecordings = [];
  let currentFiltered = [];
  let selectedSubject = "All";
  let searchKeyword = "";
  let searchDebounceTimer = null;
  let currentActiveView = "public";

  /**
   * Initialize App
   */
  async function init() {
    setupHeaderScroll();
    setupViewRouting();
    setupSearchListeners();
    renderCategories();
    renderLoadingSkeletons();
    await loadRecordings();

    // Check if initial URL demands admin view (e.g. #admin)
    if (window.location.hash === "#admin") {
      switchView("admin", false);
    }
  }

  /**
   * SPA View Switching Logic
   */
  function switchView(viewName, updateHash = true) {
    if (viewName === "admin") {
      currentActiveView = "admin";
      if (publicView) publicView.style.display = "none";
      if (adminView) adminView.style.display = "block";

      // Update Nav active classes
      if (navHomeLink) navHomeLink.classList.remove("active");
      if (navSubjectsLink) navSubjectsLink.classList.remove("active");
      if (navRecordingsLink) navRecordingsLink.classList.remove("active");
      if (navAdminBtn) navAdminBtn.classList.add("active");

      // Hide public search in header
      if (headerSearchWrapper) headerSearchWrapper.style.display = "none";

      if (updateHash && window.location.hash !== "#admin") {
        window.location.hash = "admin";
      }

      window.scrollTo({ top: 0, behavior: "smooth" });

      // Notify Admin Controller to refresh its dataset
      if (window.AdminController && typeof window.AdminController.onViewActivated === "function") {
        window.AdminController.onViewActivated();
      }
    } else {
      currentActiveView = "public";
      if (adminView) adminView.style.display = "none";
      if (publicView) publicView.style.display = "block";

      // Restore Nav active classes
      if (navHomeLink) navHomeLink.classList.add("active");
      if (navSubjectsLink) navSubjectsLink.classList.remove("active");
      if (navRecordingsLink) navRecordingsLink.classList.remove("active");
      if (navAdminBtn) navAdminBtn.classList.remove("active");

      // Restore public search in header
      if (headerSearchWrapper) headerSearchWrapper.style.display = "";

      if (updateHash && window.location.hash === "#admin") {
        history.pushState("", document.title, window.location.pathname + window.location.search);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });

      // Refresh public catalog to immediately reflect any additions/edits made in Admin
      loadRecordings();
    }
  }

  /**
   * Setup View Navigation Event Listeners
   */
  function setupViewRouting() {
    // Admin button click
    if (navAdminBtn) {
      navAdminBtn.addEventListener("click", () => {
        if (currentActiveView === "admin") {
          switchView("public");
        } else {
          switchView("admin");
        }
      });
    }

    // Home link click
    if (navHomeLink) {
      navHomeLink.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("public");
        const homeSection = document.getElementById("home");
        if (homeSection) homeSection.scrollIntoView({ behavior: "smooth" });
      });
    }

    // Brand logo click
    if (brandLogoLink) {
      brandLogoLink.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("public");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Return to Public Library button in Admin view
    if (btnReturnPublic) {
      btnReturnPublic.addEventListener("click", () => {
        switchView("public");
      });
    }

    // Subjects nav link click
    if (navSubjectsLink) {
      navSubjectsLink.addEventListener("click", (e) => {
        if (currentActiveView !== "public") {
          e.preventDefault();
          switchView("public");
          setTimeout(() => {
            const el = document.getElementById("subjects");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
      });
    }

    // Recordings nav link click
    if (navRecordingsLink) {
      navRecordingsLink.addEventListener("click", (e) => {
        if (currentActiveView !== "public") {
          e.preventDefault();
          switchView("public");
          setTimeout(() => {
            const el = document.getElementById("recordings");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
      });
    }

    // Browser back/forward navigation support
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#admin") {
        if (currentActiveView !== "admin") switchView("admin", false);
      } else {
        if (currentActiveView !== "public") switchView("public", false);
      }
    });
  }

  /**
   * Header scroll shadow effect
   */
  function setupHeaderScroll() {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 20) {
        siteHeader.classList.add("scrolled");
      } else {
        siteHeader.classList.remove("scrolled");
      }
    });
  }

  /**
   * Two-way synced search inputs & debounce
   */
  function setupSearchListeners() {
    const handleSearchInput = (value) => {
      searchKeyword = value.trim();

      // Sync both input fields
      if (heroSearchInput && heroSearchInput.value !== value) heroSearchInput.value = value;
      if (headerSearchInput && headerSearchInput.value !== value) headerSearchInput.value = value;

      // Toggle clear button
      if (searchClearBtn) {
        searchClearBtn.classList.toggle("visible", searchKeyword.length > 0);
      }

      // Debounce filtering for optimal UI responsiveness
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFilters();
      }, 150);
    };

    if (heroSearchInput) {
      heroSearchInput.addEventListener("input", (e) => handleSearchInput(e.target.value));
    }

    if (headerSearchInput) {
      headerSearchInput.addEventListener("input", (e) => handleSearchInput(e.target.value));
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        handleSearchInput("");
        if (heroSearchInput) heroSearchInput.focus();
      });
    }
  }

  /**
   * Load recordings from API / Local fallback
   */
  async function loadRecordings() {
    try {
      const response = await ClassService.fetchClasses();
      allRecordings = response.data || [];

      // Update statistics
      updateStats(allRecordings);

      // Re-render categories with dynamic counts
      renderCategories();

      // Apply initial filter
      applyFilters();
    } catch (err) {
      console.error("Failed to load recordings:", err);
      renderErrorState("Could not load class recordings. Please check your network or try again.");
    }
  }

  /**
   * Calculate and render library statistics
   */
  function updateStats(records) {
    if (!statTotalClasses || !statTotalSubjects || !statRecentClasses) return;

    // Total Classes
    const total = records.length;
    animateCounter(statTotalClasses, total);

    // Total Unique Subjects represented
    const uniqueSubjects = new Set(records.map(r => (r.subject || "Other").trim()).filter(Boolean));
    animateCounter(statTotalSubjects, uniqueSubjects.size);

    // Classes added in the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentCount = records.filter(r => {
      const recDate = new Date(r.date || r.createdAt);
      return !isNaN(recDate.getTime()) && recDate >= thirtyDaysAgo;
    }).length;

    animateCounter(statRecentClasses, recentCount);
  }

  /**
   * Smooth counter animation
   */
  function animateCounter(el, target) {
    const start = parseInt(el.textContent, 10) || 0;
    if (start === target) {
      el.textContent = target;
      return;
    }
    const duration = 350;
    const startTime = performance.now();

    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (target - start) * progress);
      el.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(update);
  }

  /**
   * Render category buttons with badges
   */
  function renderCategories() {
    if (!categoriesContainer) return;

    // Calculate count per subject
    const subjectCounts = {};
    CONFIG.SUBJECTS.forEach(sub => { subjectCounts[sub] = 0; });

    allRecordings.forEach(rec => {
      const sub = (rec.subject || "").trim();
      if (subjectCounts.hasOwnProperty(sub)) {
        subjectCounts[sub]++;
      } else {
        subjectCounts["Other"] = (subjectCounts["Other"] || 0) + 1;
      }
    });

    const categories = ["All", ...CONFIG.SUBJECTS];

    categoriesContainer.innerHTML = categories.map(cat => {
      const count = cat === "All" ? allRecordings.length : (subjectCounts[cat] || 0);
      const isActive = cat === selectedSubject;
      return `
        <button 
          type="button" 
          class="category-chip ${isActive ? "active" : ""}" 
          data-subject="${ClassService.escapeHtml(cat)}"
          role="tab"
          aria-selected="${isActive}"
        >
          <span>${ClassService.escapeHtml(cat)}</span>
          <span class="category-badge">${count}</span>
        </button>
      `;
    }).join("");

    // Add click event listeners
    categoriesContainer.querySelectorAll(".category-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        selectedSubject = chip.dataset.subject;
        categoriesContainer.querySelectorAll(".category-chip").forEach(c => {
          c.classList.remove("active");
          c.setAttribute("aria-selected", "false");
        });
        chip.classList.add("active");
        chip.setAttribute("aria-selected", "true");
        applyFilters();
      });
    });
  }

  /**
   * Apply Subject & Search Filters dynamically
   */
  function applyFilters() {
    let result = [...allRecordings];

    // Filter by Subject
    if (selectedSubject !== "All") {
      result = result.filter(rec => (rec.subject || "").toLowerCase() === selectedSubject.toLowerCase());
    }

    // Filter by Search Keyword (Title, Subject, Description)
    if (searchKeyword) {
      const query = searchKeyword.toLowerCase();
      result = result.filter(rec => {
        const title = (rec.title || "").toLowerCase();
        const subject = (rec.subject || "").toLowerCase();
        const description = (rec.description || "").toLowerCase();
        return title.includes(query) || subject.includes(query) || description.includes(query);
      });
    }

    currentFiltered = result;
    renderRecordings(result);
  }

  /**
   * Render recording cards
   */
  function renderRecordings(records) {
    if (!recordingsGrid) return;

    // Update result count header
    if (resultsCount) {
      if (allRecordings.length === 0) {
        resultsCount.textContent = "0 recordings available";
      } else if (records.length === allRecordings.length) {
        resultsCount.textContent = `Showing all ${records.length} recordings`;
      } else {
        resultsCount.textContent = `Showing ${records.length} of ${allRecordings.length} recordings`;
      }
    }

    // Global empty state: no recordings at all
    if (allRecordings.length === 0) {
      recordingsGrid.innerHTML = `
        <div class="state-container">
          <div class="state-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
            </svg>
          </div>
          <h2 class="state-title">No classes available yet. Check back soon!</h2>
          <p class="state-description">Recordings will appear here once new class links are uploaded.</p>
        </div>
      `;
      return;
    }

    // Search / Filter empty state: no matches found
    if (records.length === 0) {
      recordingsGrid.innerHTML = `
        <div class="state-container">
          <div class="state-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h2 class="state-title">No recordings found</h2>
          <p class="state-description">No recordings match "${ClassService.escapeHtml(searchKeyword || selectedSubject)}". Try searching with different keywords or reset your filters.</p>
          <button type="button" class="btn-secondary" id="resetFiltersBtn">
            Reset All Filters
          </button>
        </div>
      `;

      const resetBtn = document.getElementById("resetFiltersBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          searchKeyword = "";
          selectedSubject = "All";
          if (heroSearchInput) heroSearchInput.value = "";
          if (headerSearchInput) headerSearchInput.value = "";
          if (searchClearBtn) searchClearBtn.classList.remove("visible");
          renderCategories();
          applyFilters();
        });
      }
      return;
    }

    // Render Cards
    recordingsGrid.innerHTML = records.map(rec => {
      const subject = ClassService.escapeHtml(rec.subject || "Other");
      const title = ClassService.escapeHtml(rec.title || "Untitled Recording");
      const description = ClassService.escapeHtml(rec.description || "No description provided for this lecture.");
      const formattedDate = ClassService.formatDisplayDate(rec.date);
      const driveUrl = ClassService.escapeHtml(rec.driveUrl || "");

      return `
        <article class="recording-card" data-id="${ClassService.escapeHtml(rec.id)}">
          <div>
            <div class="card-top">
              <span class="subject-pill" data-subject="${subject}">${subject}</span>
              <span class="card-date">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <time datetime="${ClassService.escapeHtml(rec.date)}">${formattedDate}</time>
              </span>
            </div>
            <h3 class="card-title">${title}</h3>
            <p class="card-description">${description}</p>
          </div>
          <div class="card-footer">
            <button 
              type="button" 
              class="btn-watch" 
              data-url="${driveUrl}"
              aria-label="Watch class recording on Google Drive for ${title}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Watch Class</span>
            </button>
          </div>
        </article>
      `;
    }).join("");

    // Attach safe external watch handlers
    recordingsGrid.querySelectorAll(".btn-watch").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.url;
        handleWatchClick(url);
      });
    });
  }

  /**
   * Safe Class Watching Navigation Handler
   */
  function handleWatchClick(url) {
    if (!url || !url.trim()) {
      ClassService.showToast("Google Drive link is missing for this recording.", "error");
      return;
    }

    const trimmedUrl = url.trim();

    if (!ClassService.isValidDriveUrl(trimmedUrl)) {
      ClassService.showToast("The provided link does not appear to be a valid Google Drive URL.", "warning");
    }

    const newWindow = window.open(trimmedUrl, "_blank", "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      const a = document.createElement("a");
      a.href = trimmedUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  /**
   * Render shimmer loading skeleton cards
   */
  function renderLoadingSkeletons() {
    if (!recordingsGrid) return;
    const skeletonHtml = Array(6).fill(0).map(() => `
      <div class="skeleton-card" aria-hidden="true">
        <div style="display:flex; justify-content:space-between; margin-bottom:1.25rem;">
          <div class="skeleton-line" style="width:70px; height:24px;"></div>
          <div class="skeleton-line" style="width:85px; height:18px;"></div>
        </div>
        <div class="skeleton-line" style="width:90%; height:22px; margin-bottom:0.75rem;"></div>
        <div class="skeleton-line" style="width:65%; height:22px; margin-bottom:1.25rem;"></div>
        <div class="skeleton-line" style="width:100%; height:14px; margin-bottom:0.5rem;"></div>
        <div class="skeleton-line" style="width:80%; height:14px; margin-bottom:2rem;"></div>
        <div class="skeleton-line" style="width:100%; height:40px; margin-top:auto;"></div>
      </div>
    `).join("");

    recordingsGrid.innerHTML = skeletonHtml;
  }

  /**
   * Render network error state
   */
  function renderErrorState(message) {
    if (!recordingsGrid) return;
    recordingsGrid.innerHTML = `
      <div class="state-container">
        <div class="state-icon" style="color:var(--danger);" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 class="state-title">Unable to Connect</h2>
        <p class="state-description">${ClassService.escapeHtml(message)}</p>
        <button type="button" class="btn-secondary" id="retryFetchBtn">
          Try Again
        </button>
      </div>
    `;

    const retryBtn = document.getElementById("retryFetchBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        renderLoadingSkeletons();
        loadRecordings();
      });
    }
  }

  // Expose PublicController globally for cross-view synchronization
  window.PublicController = {
    loadRecordings,
    switchView
  };

  // Run initialization
  init();
});
