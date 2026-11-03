/**
 * ClassVault - Data & API Services
 * Handles network requests to Google Apps Script, local fallback storage,
 * and data validation logic.
 */

const ClassService = (() => {
  /**
   * Seed data for local preview / offline testing
   */
  const SEED_CLASSES = [
    {
      id: "cv_seed_001",
      title: "Java Object-Oriented Programming & Collections Framework",
      subject: "Java",
      description: "Deep dive into OOP concepts, polymorphism, interfaces, and comprehensive ArrayList vs LinkedList performance analysis.",
      date: "2026-10-28",
      driveUrl: "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J-sample/view",
      createdAt: "2026-10-28T10:00:00.000Z"
    },
    {
      id: "cv_seed_002",
      title: "Advanced SQL Joins, Window Functions & Indexing",
      subject: "SQL",
      description: "Hands-on session covering INNER, LEFT, FULL OUTER joins, PARTITION BY window functions, and query optimization strategies.",
      date: "2026-10-25",
      driveUrl: "https://drive.google.com/file/d/2B3C4D5E6F7G8H9I0J1K-sample/view",
      createdAt: "2026-10-25T14:30:00.000Z"
    },
    {
      id: "cv_seed_003",
      title: "React State Management: useState, useEffect & Custom Hooks",
      subject: "ReactJS",
      description: "Building resilient client state workflows, understanding the component lifecycle, and preventing infinite re-render cycles.",
      date: "2026-10-22",
      driveUrl: "https://drive.google.com/file/d/3C4D5E6F7G8H9I0J1K2L-sample/view",
      createdAt: "2026-10-22T09:15:00.000Z"
    },
    {
      id: "cv_seed_004",
      title: "Spring Boot RESTful APIs with Spring Data JPA",
      subject: "Spring Boot",
      description: "Structuring layered architecture (Controller, Service, Repository), entity relationships, and DTO mapping.",
      date: "2026-10-18",
      driveUrl: "https://drive.google.com/file/d/4D5E6F7G8H9I0J1K2L3M-sample/view",
      createdAt: "2026-10-18T16:00:00.000Z"
    },
    {
      id: "cv_seed_005",
      title: "Modern JavaScript (ES6+): Promises, Async/Await & Event Loop",
      subject: "JavaScript",
      description: "Understanding microtasks vs macrotasks, async exception handling, and functional array transformations.",
      date: "2026-10-12",
      driveUrl: "https://drive.google.com/file/d/5E6F7G8H9I0J1K2L3M4N-sample/view",
      createdAt: "2026-10-12T11:00:00.000Z"
    }
  ];

  /**
   * Check whether live Google Apps Script endpoint is configured
   */
  function isLiveApiConfigured() {
    return Boolean(
      CONFIG.APPS_SCRIPT_URL &&
      typeof CONFIG.APPS_SCRIPT_URL === "string" &&
      CONFIG.APPS_SCRIPT_URL.trim().length > 0 &&
      !CONFIG.APPS_SCRIPT_URL.includes("PASTE_YOUR_")
    );
  }

  /**
   * Validate Google Drive link format
   */
  function isValidDriveUrl(url) {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    // Allow standard drive.google.com or docs.google.com share links
    if (CONFIG.DRIVE_URL_REGEX.test(trimmed)) return true;
    // Basic fallback check for standard drive file patterns
    return trimmed.startsWith("https://drive.google.com/") || trimmed.startsWith("https://docs.google.com/");
  }

  /**
   * Format ISO / YYYY-MM-DD date for clean UI display
   */
  function formatDisplayDate(dateStr) {
    if (!dateStr) return "N/A";
    try {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, monthIndex, day);
        return dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      }
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * LocalStorage Helpers (Active when APPS_SCRIPT_URL is not set)
   */
  function getLocalRecords() {
    try {
      const raw = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(SEED_CLASSES));
        return [...SEED_CLASSES];
      }
      return JSON.parse(raw);
    } catch (err) {
      console.warn("ClassVault: Failed reading from localStorage:", err);
      return [...SEED_CLASSES];
    }
  }

  function saveLocalRecords(records) {
    try {
      localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error("ClassVault: Failed writing to localStorage:", err);
    }
  }

  /**
   * Low-level fetch wrapper handling Google Apps Script quirks:
   * Google Apps Script redirects on POST (302) and rejects CORS OPTIONS preflight.
   * Sending text/plain avoids the OPTIONS preflight in browsers!
   */
  async function callAppsScript(action, payload = {}, method = "POST") {
    const url = CONFIG.APPS_SCRIPT_URL.trim();

    if (method === "GET") {
      const getUrl = new URL(url);
      getUrl.searchParams.set("action", action);
      Object.keys(payload).forEach(key => getUrl.searchParams.set(key, payload[key]));
      
      const res = await fetch(getUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    }

    // POST request with text/plain to bypass CORS preflight
    const requestData = { action, ...payload };
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(requestData),
      headers: {
        // text/plain prevents browser CORS preflight (OPTIONS) which Apps Script does not handle
        "Content-Type": "text/plain;charset=utf-8"
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  /**
   * Fetch all class recordings
   */
  async function fetchClasses() {
    if (!isLiveApiConfigured()) {
      // Local fallback mode
      const localData = getLocalRecords();
      return {
        status: "success",
        isLive: false,
        data: localData.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      };
    }

    try {
      // Try GET action=list
      const res = await callAppsScript("list", {}, "GET");
      if (res && res.status === "success" && Array.isArray(res.data)) {
        return { status: "success", isLive: true, data: res.data };
      }
      throw new Error(res.message || "Failed to parse records from API");
    } catch (err) {
      console.error("ClassVault: API Error while fetching classes:", err);
      throw err;
    }
  }

  /**
   * Add a new class recording
   */
  async function addClass(record) {
    // Validate inputs
    if (!record.title || !record.title.trim()) throw new Error("Class title is required.");
    if (!record.subject || !record.subject.trim()) throw new Error("Subject is required.");
    if (!record.date || !record.date.trim()) throw new Error("Recording date is required.");
    if (!record.driveUrl || !record.driveUrl.trim()) throw new Error("Google Drive URL is required.");
    if (!isValidDriveUrl(record.driveUrl)) {
      throw new Error("Invalid Google Drive URL. Must be a valid Google Drive sharing link.");
    }

    if (!isLiveApiConfigured()) {
      const records = getLocalRecords();
      const newRecord = {
        id: "cv_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now(),
        title: record.title.trim(),
        subject: record.subject.trim(),
        description: (record.description || "").trim(),
        date: record.date.trim(),
        driveUrl: record.driveUrl.trim(),
        createdAt: new Date().toISOString()
      };
      records.unshift(newRecord);
      saveLocalRecords(records);
      return { status: "success", isLive: false, data: newRecord };
    }

    const res = await callAppsScript("add", record, "POST");
    if (res && res.status === "success") {
      return { status: "success", isLive: true, data: res.data };
    }
    throw new Error(res.message || "Failed to add class.");
  }

  /**
   * Update an existing class recording
   */
  async function updateClass(id, record) {
    if (!id) throw new Error("Record ID is required for update.");
    if (!record.title || !record.title.trim()) throw new Error("Class title cannot be empty.");
    if (!record.subject || !record.subject.trim()) throw new Error("Subject cannot be empty.");
    if (!record.date || !record.date.trim()) throw new Error("Recording date cannot be empty.");
    if (!record.driveUrl || !record.driveUrl.trim()) throw new Error("Google Drive URL cannot be empty.");
    if (!isValidDriveUrl(record.driveUrl)) {
      throw new Error("Invalid Google Drive URL format.");
    }

    if (!isLiveApiConfigured()) {
      const records = getLocalRecords();
      const index = records.findIndex(r => r.id === id);
      if (index === -1) throw new Error("Class recording not found.");
      records[index] = {
        ...records[index],
        title: record.title.trim(),
        subject: record.subject.trim(),
        description: (record.description || "").trim(),
        date: record.date.trim(),
        driveUrl: record.driveUrl.trim()
      };
      saveLocalRecords(records);
      return { status: "success", isLive: false, data: records[index] };
    }

    const res = await callAppsScript("update", { id, ...record }, "POST");
    if (res && res.status === "success") {
      return { status: "success", isLive: true, data: res.data };
    }
    throw new Error(res.message || "Failed to update class.");
  }

  /**
   * Delete an existing class recording
   */
  async function deleteClass(id) {
    if (!id) throw new Error("Record ID is required for deletion.");

    if (!isLiveApiConfigured()) {
      const records = getLocalRecords();
      const filtered = records.filter(r => r.id !== id);
      saveLocalRecords(filtered);
      return { status: "success", isLive: false };
    }

    const res = await callAppsScript("delete", { id }, "POST");
    if (res && res.status === "success") {
      return { status: "success", isLive: true };
    }
    throw new Error(res.message || "Failed to delete class record.");
  }

  /**
   * UI Toast Helper
   */
  function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    // Icon based on type
    let iconSvg = "";
    if (type === "success") {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === "error") {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.6rem;">
        ${iconSvg}
        <span>${escapeHtml(message)}</span>
      </div>
      <button type="button" style="color:inherit;opacity:0.8;cursor:pointer;" aria-label="Close notification">&times;</button>
    `;

    toast.querySelector("button").addEventListener("click", () => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 200);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 250);
      }
    }, 4000);
  }

  /**
   * Escape HTML to prevent XSS in dynamic renders
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return {
    isLiveApiConfigured,
    isValidDriveUrl,
    formatDisplayDate,
    fetchClasses,
    addClass,
    updateClass,
    deleteClass,
    showToast,
    escapeHtml
  };
})();

