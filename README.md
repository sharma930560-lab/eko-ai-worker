# Eko Field Worker

An offline-first AI business assistant for micro-entrepreneurs, small retail shopkeepers, and field operators.

Eko helps business owners track credit balances (khata), follow up on pending customer payments, manage daily tasks, monitor inventory levels, and get contextual business suggestions on both web and Android.

---

## Live Links & Downloads

- **Web App / PWA**: [https://eko-field-worker.netlify.app](https://eko-field-worker.netlify.app)
- **Backend API**: [https://eko-field-worker-api.onrender.com](https://eko-field-worker-api.onrender.com)
- **Latest GitHub Release**: [v1.0.0 Releases](https://github.com/sharma930560-lab/eko-ai-worker/releases/latest)

| Asset | Type | Description | Link |
|---|---|---|---|
| **Eko Field Worker APK** | Android APK | Universal release build (ARM64, ARMv7, x86_64) | [Download APK](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.0.0/eko-field-worker-v1.0.0.apk) |
| **Play Store Bundle** | Android AAB | Production App Bundle | [Download AAB](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.0.0/app-release.aab) |

---

## Features

- **Google Sign-In**: Authentication via Google Identity Services on Web and Android Credential Manager on mobile.
- **Customer & Khata Management**: Track customer records, outstanding credit balances, and due dates.
- **Task Management**: Create, prioritize, and track daily operational to-dos.
- **Business Notes**: Log daily commercial notes and observations.
- **Inventory & Stock Tracking**: Monitor product stock levels with low-stock reorder warnings.
- **Payment History**: Record received and pending payments with settlement statuses.
- **Ask Eko AI**: Contextual assistant that analyzes your current ledger to suggest prioritized follow-ups and draft WhatsApp messages.
- **Bill OCR**: Scan handwritten store receipts and invoices to extract structured line items and totals.
- **Voice Khata**: Speech-to-text ledger entry supporting spoken Hindi and Hinglish phrases.
- **WhatsApp Tools**: Generate culturally appropriate payment reminders (polite, standard, or firm) ready to send in one tap.
- **Offline-First Support**: Loads instantly from local storage (IndexedDB / Room SQLite) and queues offline changes to sync when connection resumes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│   Web (HTML / Vanilla JS / Service Worker / IndexedDB)      │
│   Android App (Kotlin + WebView + Room SQLite)              │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS REST API
┌──────────────────────────────▼──────────────────────────────┐
│                      Backend Layer                          │
│   FastAPI Gateway + SQLAlchemy                              │
│   PostgreSQL (Production) / SQLite (Local Dev)              │
└──────────────────────────────┬──────────────────────────────┘
                               │ Structured Prompts
┌──────────────────────────────▼──────────────────────────────┐
│                        AI Layer                             │
│   Google Gemini API (Multi-turn Chat & Vision OCR)          │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend**: Vanilla ES6 JavaScript, HTML5, CSS3. Zero external build dependencies.
- **Storage**: IndexedDB in browser, Room SQLite on Android, PostgreSQL on Render.
- **Backend**: Python 3.11 with FastAPI, Pydantic v2, and SQLAlchemy.
- **AI Integration**: Google Gemini API for multi-turn conversational assistance, receipt parsing, and message drafting.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js / `http-server` (or any static web server for local frontend)
- Android Studio (for native Android builds)

### 1. Run Backend Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy environment template and set variables
cp .env.example .env

# Run FastAPI server
uvicorn main:app --reload --port 8000
```

### 2. Run Frontend Locally

```bash
cd frontend
npx http-server -p 3000
```

Open `http://localhost:3000` in your browser.

### 3. Build Android APK

```bash
cd android
./gradlew assembleRelease
```

The release APK will be generated at `android/app/build/outputs/apk/release/app-release.apk`.

---

## Configuration

Set the following environment variables in `backend/.env` or in your deployment settings:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:password@hostname:5432/eko_db
ALLOWED_ORIGINS=https://eko-field-worker.netlify.app,https://appassets.androidplatform.net
ENVIRONMENT=production
```

---

## License

MIT License
