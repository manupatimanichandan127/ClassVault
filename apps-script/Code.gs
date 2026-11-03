/**
 * ==============================================================================
 * ClassVault API - Google Apps Script Backend
 * ==============================================================================
 * 
 * Database: Google Sheets ("ClassVault Database")
 * Sheet: "Classes"
 * Columns: id | title | subject | description | date | driveUrl | createdAt
 * 
 * SECURITY NOTICE:
 * As designed in the project blueprint, this API is publicly accessible without
 * authentication or API secret keys so that it runs at zero cost without user logins.
 * Anyone who discovers the web app URL or inspects network requests in the owner
 * dashboard may perform read, add, update, and delete actions on Google Sheets records.
 * Google Drive videos themselves are NOT hosted or deleted by this script.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets and create a spreadsheet named "ClassVault Database".
 * 2. Rename the active sheet tab to "Classes".
 * 3. Add column headers in Row 1:
 *    A1: id | B1: title | C1: subject | D1: description | E1: date | F1: driveUrl | G1: createdAt
 * 4. Go to Extensions > Apps Script.
 * 5. Replace existing code with this Code.gs file.
 * 6. (Optional) Run the setupSheet() function once from the editor to verify headers.
 * 7. Click Deploy > New deployment.
 * 8. Select type: "Web app".
 * 9. Set "Execute as": "Me".
 * 10. Set "Who has access": "Anyone" (or "Anyone with Google account" if preferred).
 * 11. Click Deploy and copy the Web App URL (ends with /exec).
 * 12. Paste the URL into `js/config.js` -> APPS_SCRIPT_URL.
 * ==============================================================================
 */

const SHEET_NAME = 'Classes';
const EXPECTED_HEADERS = ['id', 'title', 'subject', 'description', 'date', 'driveUrl', 'createdAt'];

/**
 * Handle HTTP GET Requests
 * Supports:
 *   ?action=list (default) -> Returns all class records sorted newest first
 *   ?action=get&id=xxx     -> Returns a single class record by ID
 *   ?action=ping           -> Health check
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action.toLowerCase() : 'list';

    if (action === 'ping') {
      return createJsonResponse({ status: 'success', message: 'ClassVault API is online', timestamp: new Date().toISOString() });
    }

    if (action === 'get') {
      const id = e.parameter.id;
      if (!id) {
        return createJsonResponse({ status: 'error', message: 'Missing required parameter: id' }, 400);
      }
      const record = getRecordById(id);
      if (!record) {
        return createJsonResponse({ status: 'error', message: 'Record not found' }, 404);
      }
      return createJsonResponse({ status: 'success', data: record });
    }

    // Default action: list
    const records = getAllRecords();
    return createJsonResponse({
      status: 'success',
      count: records.length,
      data: records
    });

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() }, 500);
  }
}

/**
 * Handle HTTP POST Requests
 * Supports:
 *   action: 'add'    -> Adds a new class recording metadata row
 *   action: 'update' -> Updates existing record by ID
 *   action: 'delete' -> Deletes row matching ID from Google Sheets
 */
function doPost(e) {
  try {
    let payload = {};

    // Parse JSON payload or form data
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        // Fallback for form-encoded or raw query
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = (payload.action || (e.parameter && e.parameter.action) || '').toLowerCase();

    switch (action) {
      case 'add':
        return handleAddRecord(payload);

      case 'update':
        return handleUpdateRecord(payload);

      case 'delete':
        return handleDeleteRecord(payload);

      case 'list':
        // Fallback if client queries list via POST
        const records = getAllRecords();
        return createJsonResponse({ status: 'success', count: records.length, data: records });

      default:
        return createJsonResponse({
          status: 'error',
          message: 'Invalid or missing action parameter. Supported actions: list, add, update, delete'
        }, 400);
    }

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() }, 500);
  }
}

/**
 * Add a new recording record
 */
function handleAddRecord(data) {
  const title = (data.title || '').trim();
  const subject = (data.subject || '').trim();
  const description = (data.description || '').trim();
  const date = (data.date || '').trim();
  const driveUrl = (data.driveUrl || '').trim();

  // Field Validations
  if (!title) return createJsonResponse({ status: 'error', message: 'Class title is required.' }, 400);
  if (!subject) return createJsonResponse({ status: 'error', message: 'Subject is required.' }, 400);
  if (!date) return createJsonResponse({ status: 'error', message: 'Recording date is required.' }, 400);
  if (!driveUrl) return createJsonResponse({ status: 'error', message: 'Google Drive URL is required.' }, 400);

  // Validate Google Drive URL pattern
  if (!isValidDriveUrl(driveUrl)) {
    return createJsonResponse({
      status: 'error',
      message: 'Invalid Google Drive URL. Must be a valid drive.google.com link.'
    }, 400);
  }

  const sheet = getOrCreateSheet();
  const id = 'cv_' + Utilities.getUuid().slice(0, 8) + '_' + Date.now();
  const createdAt = new Date().toISOString();

  // [id, title, subject, description, date, driveUrl, createdAt]
  sheet.appendRow([id, title, subject, description, date, driveUrl, createdAt]);

  const newRecord = { id, title, subject, description, date, driveUrl, createdAt };
  return createJsonResponse({
    status: 'success',
    message: 'Class recording added successfully.',
    data: newRecord
  });
}

/**
 * Update an existing recording record by ID
 */
function handleUpdateRecord(data) {
  const id = (data.id || '').trim();
  if (!id) {
    return createJsonResponse({ status: 'error', message: 'Missing record id for update.' }, 400);
  }

  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return createJsonResponse({ status: 'error', message: 'Record not found.' }, 404);
  }

  let targetRowIndex = -1;
  let existingRow = null;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === id) {
      targetRowIndex = i + 1; // 1-based index in Google Sheets
      existingRow = rows[i];
      break;
    }
  }

  if (targetRowIndex === -1) {
    return createJsonResponse({ status: 'error', message: 'Record with id "' + id + '" not found.' }, 404);
  }

  const title = data.title !== undefined ? String(data.title).trim() : existingRow[1];
  const subject = data.subject !== undefined ? String(data.subject).trim() : existingRow[2];
  const description = data.description !== undefined ? String(data.description).trim() : existingRow[3];
  const date = data.date !== undefined ? String(data.date).trim() : existingRow[4];
  const driveUrl = data.driveUrl !== undefined ? String(data.driveUrl).trim() : existingRow[5];
  const createdAt = existingRow[6];

  if (!title) return createJsonResponse({ status: 'error', message: 'Title cannot be empty.' }, 400);
  if (!subject) return createJsonResponse({ status: 'error', message: 'Subject cannot be empty.' }, 400);
  if (!date) return createJsonResponse({ status: 'error', message: 'Date cannot be empty.' }, 400);
  if (!driveUrl) return createJsonResponse({ status: 'error', message: 'Drive URL cannot be empty.' }, 400);
  if (!isValidDriveUrl(driveUrl)) {
    return createJsonResponse({ status: 'error', message: 'Invalid Google Drive URL.' }, 400);
  }

  // Update specific cells in target row
  sheet.getRange(targetRowIndex, 1, 1, 7).setValues([[id, title, subject, description, date, driveUrl, createdAt]]);

  return createJsonResponse({
    status: 'success',
    message: 'Class recording updated successfully.',
    data: { id, title, subject, description, date, driveUrl, createdAt }
  });
}

/**
 * Delete recording metadata row by ID
 * Note: Never touches the actual Google Drive file!
 */
function handleDeleteRecord(data) {
  const id = (data.id || '').trim();
  if (!id) {
    return createJsonResponse({ status: 'error', message: 'Missing record id for deletion.' }, 400);
  }

  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return createJsonResponse({ status: 'error', message: 'Record not found.' }, 404);
  }

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === id) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) {
    return createJsonResponse({ status: 'error', message: 'Record not found.' }, 404);
  }

  // Delete row from sheet
  sheet.deleteRow(targetRowIndex);

  return createJsonResponse({
    status: 'success',
    message: 'Class record metadata deleted from Google Sheets. (Drive video remains untouched).'
  });
}

/**
 * Retrieve all records from Google Sheets, sorted newest first
 */
function getAllRecords() {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue; // skip blank rows

    // Format date properly if it comes as a Date object from Google Sheets
    let formattedDate = row[4];
    if (formattedDate instanceof Date) {
      formattedDate = Utilities.formatDate(formattedDate, Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd');
    }

    records.push({
      id: String(row[0]),
      title: String(row[1] || ''),
      subject: String(row[2] || 'Other'),
      description: String(row[3] || ''),
      date: String(formattedDate || ''),
      driveUrl: String(row[5] || ''),
      createdAt: String(row[6] || '')
    });
  }

  // Sort newest recordings first by date, fallback to createdAt
  records.sort(function(a, b) {
    const dateA = new Date(a.date || a.createdAt).getTime();
    const dateB = new Date(b.date || b.createdAt).getTime();
    return dateB - dateA;
  });

  return records;
}

/**
 * Retrieve a single record by ID
 */
function getRecordById(id) {
  const records = getAllRecords();
  for (let i = 0; i < records.length; i++) {
    if (records[i].id === id) return records[i];
  }
  return null;
}

/**
 * Access or initialize the "Classes" sheet with headers
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(EXPECTED_HEADERS);
    // Format header row bold with soft background
    sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length)
         .setFontWeight('bold')
         .setBackground('#f1f5f9');
  } else {
    // If empty sheet, set headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(EXPECTED_HEADERS);
      sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length)
           .setFontWeight('bold')
           .setBackground('#f1f5f9');
    }
  }
  return sheet;
}

/**
 * Utility helper to test and initialize sheet from editor
 */
function setupSheet() {
  const sheet = getOrCreateSheet();
  Logger.log('ClassVault Database ready on sheet: ' + sheet.getName());
}

/**
 * Basic validation for Google Drive URLs
 */
function isValidDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const pattern = /^https?:\/\/(drive\.google\.com|docs\.google\.com)\/(file\/d\/|open\?|drive\/folders\/|folderview\?|uc\?|preview).+/i;
  return pattern.test(url.trim());
}

/**
 * Helper to build JSON ContentService response with proper MIME type
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

