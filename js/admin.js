/**
 * ClassVault - Owner Dashboard Application Logic
 * Manages Add, Edit, and Delete operations with validation, modal dialogs,
 * real-time table rendering, and Google Apps Script / Local storage synchronization.
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements - Add Form
  const addClassForm = document.getElementById("addClassForm");
  const classTitleInput = document.getElementById("classTitle");
  const classSubjectSelect = document.getElementById("classSubject");
  const classDateInput = document.getElementById("classDate");
  const classDriveUrlInput = document.getElementById("classDriveUrl");
  const classDescInput = document.getElementById("classDescription");
  const submitAddBtn = document.getElementById("submitAddBtn");

  // DOM Elements - Existing Recordings
  const adminRecordsTableBody = document.getElementById("adminRecordsTableBody");
  const adminTotalCountBadge = document.getElementById("adminTotalCountBadge");
  const adminSearchInput = document.getElementById("adminSearchInput");
  const refreshListBtn = document.getElementById("refreshListBtn");

  // Edit Modal Elements
  const editModalOverlay = document.getElementById("editModalOverlay");
  const editClassForm = document.getElementById("editClassForm");
  const editClassId = document.getElementById("editClassId");
  const editClassTitle = document.getElementById("editClassTitle");
  const editClassSubject = document.getElementById("editClassSubject");
  const editClassDate = document.getElementById("editClassDate");
  const editClassDriveUrl = document.getElementById("editClassDriveUrl");
  const editClassDescription = document.getElementById("editClassDescription");
  const closeEditModalBtn = document.getElementById("closeEditModalBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const saveEditBtn = document.getElementById("saveEditBtn");

  // Delete Modal Elements
  const deleteModalOverlay = document.getElementById("deleteModalOverlay");
  const deleteTargetTitle = document.getElementById("deleteTargetTitle");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");

  // State
  let adminRecords = [];
  let pendingDeleteId = null;

  /**
   * Initialize Dashboard
   */
  async function init() {
    populateSubjectDropdowns();
    setDefaultDate();
    setupEventListeners();
    await loadAdminRecords();
  }

  /**
   * Populate Subject Select Options
   */
  function populateSubjectDropdowns() {
    const optionsHtml = CONFIG.SUBJECTS.map(sub => `
      <option value="${ClassService.escapeHtml(sub)}">${ClassService.escapeHtml(sub)}</option>
    `).join("");

    if (classSubjectSelect) {
      classSubjectSelect.innerHTML = `<option value="" disabled selected>Select a subject...</option>` + optionsHtml;
    }

    if (editClassSubject) {
      editClassSubject.innerHTML = optionsHtml;
    }
  }

  /**
   * Default recording date to today (YYYY-MM-DD)
   */
  function setDefaultDate() {
    if (classDateInput && !classDateInput.value) {
      const today = new Date().toISOString().split("T")[0];
      classDateInput.value = today;
    }
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Add Form Submit
    if (addClassForm) {
      addClassForm.addEventListener("submit", handleAddClassSubmit);
    }

    // Refresh Button
    if (refreshListBtn) {
      refreshListBtn.addEventListener("click", () => {
        loadAdminRecords();
      });
    }

    // Search Filter with instant rendering
    if (adminSearchInput) {
      adminSearchInput.addEventListener("input", (e) => {
        renderAdminTable(e.target.value.trim().toLowerCase());
      });
    }

    // Edit Modal Close Handlers
    if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);
    if (editClassForm) editClassForm.addEventListener("submit", handleEditFormSubmit);

    // Delete Modal Close & Confirm Handlers
    if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", closeDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

    // Close on backdrop click
    if (editModalOverlay) {
      editModalOverlay.addEventListener("click", (e) => {
        if (e.target === editModalOverlay) closeEditModal();
      });
    }

    if (deleteModalOverlay) {
      deleteModalOverlay.addEventListener("click", (e) => {
        if (e.target === deleteModalOverlay) closeDeleteModal();
      });
    }

    // Keyboard support: Close modals on Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeEditModal();
        closeDeleteModal();
      }
    });
  }

  /**
   * Fetch all records for admin view
   */
  async function loadAdminRecords() {
    if (adminRecordsTableBody) {
      adminRecordsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">
            <div class="btn-spinner" style="border-color:#cbd5e1; border-top-color:#0f172a; width:20px; height:20px; margin-bottom:0.5rem;"></div>
            <div style="font-size:0.875rem;">Loading class recordings...</div>
          </td>
        </tr>
      `;
    }

    try {
      const res = await ClassService.fetchClasses();
      adminRecords = res.data || [];
      updateCountBadge();
      const currentQuery = adminSearchInput ? adminSearchInput.value.trim().toLowerCase() : "";
      renderAdminTable(currentQuery);
    } catch (err) {
      console.error("Dashboard error loading records:", err);
      if (adminRecordsTableBody) {
        adminRecordsTableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding: 2rem; color: #dc2626; font-size:0.875rem;">
              Failed to load records from Google Sheets. Please verify your Apps Script URL in js/config.js.
            </td>
          </tr>
        `;
      }
      ClassService.showToast("Could not load class records.", "error");
    }
  }

  /**
   * Update Total Count Badge
   */
  function updateCountBadge() {
    if (!adminTotalCountBadge) return;
    const count = adminRecords.length;
    adminTotalCountBadge.textContent = `${count} ${count === 1 ? "recording" : "recordings"}`;
  }

  /**
   * Render records in management table
   */
  function renderAdminTable(filterQuery = "") {
    if (!adminRecordsTableBody) return;

    let records = [...adminRecords];
    if (filterQuery) {
      records = records.filter(r => {
        const title = (r.title || "").toLowerCase();
        const subject = (r.subject || "").toLowerCase();
        const desc = (r.description || "").toLowerCase();
        return title.includes(filterQuery) || subject.includes(filterQuery) || desc.includes(filterQuery);
      });
    }

    if (records.length === 0) {
      adminRecordsTableBody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="table-empty-state">
              <div class="table-empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                  <line x1="7" y1="2" x2="7" y2="22"></line>
                  <line x1="17" y1="2" x2="17" y2="22"></line>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                </svg>
              </div>
              <div class="table-empty-title">${filterQuery ? "No matching recordings" : "No recordings available yet"}</div>
              <div class="table-empty-desc">${filterQuery ? "Try searching with different keywords." : "Add your first class using the form on the left."}</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    adminRecordsTableBody.innerHTML = records.map(rec => {
      const id = ClassService.escapeHtml(rec.id);
      const title = ClassService.escapeHtml(rec.title);
      const subject = ClassService.escapeHtml(rec.subject || "Other");
      const description = ClassService.escapeHtml(rec.description || "");
      const formattedDate = ClassService.formatDisplayDate(rec.date);
      const driveUrl = ClassService.escapeHtml(rec.driveUrl);

      return `
        <tr data-id="${id}">
          <td class="cell-title">
            <div>${title}</div>
            ${description ? `<div class="cell-desc-sub">${description}</div>` : ""}
          </td>
          <td>
            <span class="subject-pill" data-subject="${subject}">${subject}</span>
          </td>
          <td style="white-space:nowrap; color:#475569; font-size:0.825rem;">
            ${formattedDate}
          </td>
          <td>
            <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="cell-drive-link" title="${driveUrl}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Drive Link</span>
            </a>
          </td>
          <td style="text-align:right; white-space:nowrap;">
            <button type="button" class="btn-action-edit" data-id="${id}" aria-label="Edit class ${title}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
            <button type="button" class="btn-action-delete" data-id="${id}" data-title="${title}" aria-label="Delete class ${title}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Attach row events
    adminRecordsTableBody.querySelectorAll(".btn-action-edit").forEach(btn => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });

    adminRecordsTableBody.querySelectorAll(".btn-action-delete").forEach(btn => {
      btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, btn.dataset.title));
    });
  }

  /**
   * Handle Add Class Form Submit
   */
  async function handleAddClassSubmit(e) {
    e.preventDefault();

    const title = classTitleInput.value.trim();
    const subject = classSubjectSelect.value.trim();
    const date = classDateInput.value.trim();
    const driveUrl = classDriveUrlInput.value.trim();
    const description = classDescInput.value.trim();

    // Validations
    if (!title) {
      ClassService.showToast("Please enter a class title.", "warning");
      classTitleInput.focus();
      return;
    }
    if (!subject) {
      ClassService.showToast("Please select a subject category.", "warning");
      classSubjectSelect.focus();
      return;
    }
    if (!date) {
      ClassService.showToast("Please pick a recording date.", "warning");
      classDateInput.focus();
      return;
    }
    if (!driveUrl) {
      ClassService.showToast("Please enter the Google Drive URL.", "warning");
      classDriveUrlInput.focus();
      return;
    }
    if (!ClassService.isValidDriveUrl(driveUrl)) {
      ClassService.showToast("Please enter a valid Google Drive URL (drive.google.com).", "error");
      classDriveUrlInput.focus();
      return;
    }

    setButtonLoading(submitAddBtn, true, "Adding Class...");

    try {
      await ClassService.addClass({
        title,
        subject,
        date,
        driveUrl,
        description
      });

      ClassService.showToast("Class recording added successfully!", "success");

      // Reset form
      addClassForm.reset();
      setDefaultDate();

      // Refresh records
      await loadAdminRecords();
      if (window.PublicController && typeof window.PublicController.loadRecordings === "function") {
        window.PublicController.loadRecordings();
      }
    } catch (err) {
      console.error("Error adding class:", err);
      ClassService.showToast(err.message || "Failed to add class.", "error");
    } finally {
      setButtonLoading(submitAddBtn, false, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Add Class</span>
      `);
    }
  }

  /**
   * Open Edit Modal with prefilled data
   */
  function openEditModal(id) {
    const record = adminRecords.find(r => r.id === id);
    if (!record) {
      ClassService.showToast("Record not found.", "error");
      return;
    }

    editClassId.value = record.id;
    editClassTitle.value = record.title || "";
    editClassSubject.value = record.subject || "Other";
    editClassDate.value = record.date ? record.date.split("T")[0] : "";
    editClassDriveUrl.value = record.driveUrl || "";
    editClassDescription.value = record.description || "";

    editModalOverlay.classList.add("is-open");
    editModalOverlay.classList.add("active");
  }

  function closeEditModal() {
    if (editModalOverlay) {
      editModalOverlay.classList.remove("is-open");
      editModalOverlay.classList.remove("active");
    }
  }

  /**
   * Handle Edit Form Submit
   */
  async function handleEditFormSubmit(e) {
    e.preventDefault();

    const id = editClassId.value;
    const title = editClassTitle.value.trim();
    const subject = editClassSubject.value.trim();
    const date = editClassDate.value.trim();
    const driveUrl = editClassDriveUrl.value.trim();
    const description = editClassDescription.value.trim();

    if (!title || !subject || !date || !driveUrl) {
      ClassService.showToast("Please fill in all required fields.", "warning");
      return;
    }

    if (!ClassService.isValidDriveUrl(driveUrl)) {
      ClassService.showToast("Please enter a valid Google Drive URL.", "error");
      return;
    }

    setButtonLoading(saveEditBtn, true, "Saving...");

    try {
      await ClassService.updateClass(id, {
        title,
        subject,
        date,
        driveUrl,
        description
      });

      ClassService.showToast("Class recording updated successfully!", "success");
      closeEditModal();
      await loadAdminRecords();
      if (window.PublicController && typeof window.PublicController.loadRecordings === "function") {
        window.PublicController.loadRecordings();
      }
    } catch (err) {
      console.error("Error updating class:", err);
      ClassService.showToast(err.message || "Failed to update recording.", "error");
    } finally {
      setButtonLoading(saveEditBtn, false, "Save Changes");
    }
  }

  /**
   * Delete Modal Handlers
   */
  function openDeleteModal(id, title) {
    pendingDeleteId = id;
    if (deleteTargetTitle) {
      deleteTargetTitle.textContent = `"${title}"`;
    }
    if (deleteModalOverlay) {
      deleteModalOverlay.classList.add("is-open");
      deleteModalOverlay.classList.add("active");
    }
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    if (deleteModalOverlay) {
      deleteModalOverlay.classList.remove("is-open");
      deleteModalOverlay.classList.remove("active");
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    setButtonLoading(confirmDeleteBtn, true, "Deleting...");

    try {
      await ClassService.deleteClass(pendingDeleteId);
      ClassService.showToast("Class metadata deleted. (Drive video remains untouched).", "success");
      closeDeleteModal();
      await loadAdminRecords();
      if (window.PublicController && typeof window.PublicController.loadRecordings === "function") {
        window.PublicController.loadRecordings();
      }
    } catch (err) {
      console.error("Error deleting class:", err);
      ClassService.showToast(err.message || "Failed to delete record.", "error");
    } finally {
      setButtonLoading(confirmDeleteBtn, false, "Delete Metadata");
    }
  }

  /**
   * Button loading state helper
   */
  function setButtonLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.innerHTML = `<span class="btn-spinner"></span> <span>${text}</span>`;
    } else {
      button.innerHTML = text;
    }
  }

  // Expose AdminController globally for cross-view synchronization
  window.AdminController = {
    onViewActivated: loadAdminRecords,
    loadAdminRecords
  };

  // Run initialization
  init();
});
