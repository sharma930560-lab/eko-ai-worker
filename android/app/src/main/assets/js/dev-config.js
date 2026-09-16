/**
 * EKO LOCAL DEVELOPMENT CONFIG
 * ─────────────────────────────────────────────────────────────────────────────
 * This file is loaded ONLY in local development.
 * It is NOT deployed to Netlify or Android assets.
 *
 * How it works:
 *   - Sets window.EKO_API_BASE to http://localhost:8000
 *   - api.js reads window.EKO_API_BASE before falling back to production URL
 *   - Production: window.EKO_API_BASE is never set → production URL is used
 *
 * To switch back to production from the browser console:
 *   delete window.EKO_API_BASE; location.reload();
 */
(function () {
    'use strict';
    // Only activate in true browser dev mode — never in Android WebView
    var host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    // Point all API calls to the local FastAPI backend
    window.EKO_API_BASE = 'http://localhost:8000';
    console.info('[EKO DEV] API base set to:', window.EKO_API_BASE);
})();
