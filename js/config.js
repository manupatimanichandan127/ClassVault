/**
 * ClassVault - Centralized Configuration
 * All API endpoints, subject taxonomies, and validation rules are configured here.
 */

const CONFIG = {
  // Replace with your Google Apps Script Web App URL after deployment:
  // e.g. "https://script.google.com/macros/s/AKfycbx.../exec"
  APPS_SCRIPT_URL: "",

  // Standard Subject Categories
  SUBJECTS: [
    "Java",
    "SQL",
    "HTML",
    "CSS",
    "JavaScript",
    "ReactJS",
    "Spring Boot",
    "Other"
  ],

  // Google Drive URL Regex Pattern
  // Matches drive.google.com or docs.google.com file/folder/sharing links
  DRIVE_URL_REGEX: /^https?:\/\/(drive\.google\.com|docs\.google\.com)\/(file\/d\/[a-zA-Z0-9_-]+|open\?id=[a-zA-Z0-9_-]+|drive\/folders\/[a-zA-Z0-9_-]+|folderview\?id=[a-zA-Z0-9_-]+|uc\?id=[a-zA-Z0-9_-]+|uc\?export=download&id=[a-zA-Z0-9_-]+).*/i,

  // Fallback storage key for local testing when APPS_SCRIPT_URL is not yet set
  LOCAL_STORAGE_KEY: "classvault_local_records_v1",

  // App Metadata
  APP_NAME: "ClassVault",
  APP_VERSION: "1.0.0"
};

// Freeze config object to prevent accidental runtime mutations
Object.freeze(CONFIG);

