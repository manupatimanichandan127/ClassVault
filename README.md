# ClassVault – Public Class Recording Library

ClassVault is a modern, responsive, lightweight class recording library built for students and educators. It allows class recording links stored on Google Drive to be curated and made easily accessible through a clean, distraction-free web portal.

The actual videos remain safely hosted on Google Drive. ClassVault stores only class metadata and URLs, requiring zero database hosting costs.

---

## 🌟 Key Features

- **Integrated Single-Page Architecture**: The public catalog and the Admin Management Panel are integrated directly into `index.html`—no external admin page required.
- **One-Click Instant View Switching**: Switch seamlessly between the Public Library and the Admin Panel using the blue **Admin** button in the header without page reloads.
- **Modern Minimalist UI**: Clean educational light theme, soft borders, subtle shadows, and responsive two-column grid layouts.
- **Pure Web Stack**: 100% HTML5, CSS3, and Vanilla JavaScript—no heavy frameworks (No React, Vue, or Angular).
- **Zero-Cost Serverless Backend**: Powered by Google Sheets as the database and Google Apps Script as the REST API.
- **Instant Search & Subject Filtering**: Dynamic live filtering across Title, Subject, and Description without page reloads.
- **Dynamic Metrics**: Real-time counter statistics for total recordings, active subjects, and recent additions.
- **Direct & Safe Video Watching**: Opens original Google Drive videos directly in a new tab in Viewer mode with `rel="noopener noreferrer"`.
- **Full Metadata Management**: Add, edit, delete, and search class records directly within the dashboard.
- **Vercel-Ready**: Preconfigured with `vercel.json` for rapid, zero-config static hosting.

---

## 📁 Project Structure

```
ClassVault/
│
├── index.html              # Unified Single-Page Application (Public & Admin views)
├── README.md               # Documentation & setup instructions
├── vercel.json             # Vercel static routing and security headers
│
├── css/
│   ├── style.css           # Global design system, typography, header & public styling
│   └── dashboard.css       # Admin dashboard styling, forms, table & modals
│
├── js/
│   ├── config.js           # Central configuration (Apps Script API URL, subjects)
│   ├── classes.js          # API service, local storage fallback & validation utilities
│   ├── app.js              # SPA view controller & public catalog logic (search, filter, stats)
│   └── admin.js            # Admin management logic (add, edit, delete, modals)
│
├── assets/
│   ├── logo.svg            # Custom SVG logo
│   └── images/             # Media assets
│
└── apps-script/
    └── Code.gs             # Google Apps Script Web App source code
```

---

## 🚀 Setup & Integration Guide

Follow these steps to connect your live Google Sheets database to ClassVault:

### Step 1: Google Drive Preparation
1. Upload your recorded class video files to your Google Drive folder.
2. For each video file or recording folder:
   - Click **Share** > **General access**.
   - Change setting to **"Anyone with the link"** and set role to **"Viewer"**.
   - Copy the sharing link (e.g., `https://drive.google.com/file/d/.../view?usp=sharing`).

### Step 2: Google Sheets Database Setup
1. Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Name the spreadsheet: **`ClassVault Database`**.
3. Rename the active sheet tab at the bottom to: **`Classes`**.
4. In Row 1, insert the following column headers exactly:
   | A1 | B1 | C1 | D1 | E1 | F1 | G1 |
   | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
   | `id` | `title` | `subject` | `description` | `date` | `driveUrl` | `createdAt` |

### Step 3: Google Apps Script API Deployment
1. Inside your Google Sheet, click **Extensions** > **Apps Script**.
2. Erase any code inside `Code.gs` and replace it entirely with the contents of [`apps-script/Code.gs`](apps-script/Code.gs).
3. Click the **Save** disk icon.
4. Click **Deploy** > **New deployment**.
5. Choose type: **Web app**.
6. Set:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` *(Allows the web app to query and update recordings)*
7. Click **Deploy** and copy your **Web App URL** (ends in `/exec`).

### Step 4: Connect Web App to Frontend
1. Open [`js/config.js`](js/config.js).
2. Set `APPS_SCRIPT_URL` to your deployed Apps Script URL:
   ```javascript
   const CONFIG = {
     APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb.../exec",
     ...
   };
   ```
3. Save the file. Your live Google Sheets database is now connected!

> **Local Preview Mode**: If `APPS_SCRIPT_URL` is empty, ClassVault operates in local preview mode using browser `localStorage` and preloaded demo data so that all features can be tested before deploying Google Apps Script.

---

## 🔒 Security & Architecture Disclosure

ClassVault operates on an unauthenticated, zero-cost serverless model:

1. **No Password Authentication**: Anyone who clicks the **Admin** button in the header or obtains the Google Apps Script URL can view, add, edit, or delete metadata records.
2. **Not Private or Secure**: Because there are no credentials or logins, this architecture is intended for public class sharing among peers, not for confidential institutional records.
3. **Google Drive Isolation**: Deleting a recording in ClassVault **only removes the metadata row** from Google Sheets. It **never deletes or modifies** the original video file in Google Drive.

---

## 🌐 Deploying to Vercel

1. Push this directory to your GitHub repository.
2. In [Vercel](https://vercel.com), select **Add New** > **Project** and import your repository.
3. Keep the default settings (Framework: *Other*, Root Directory: `./`).
4. Click **Deploy**. Your site will be live on your custom `.vercel.app` domain.
