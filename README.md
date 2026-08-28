# Eko Field Worker

Eko Field Worker is an offline-first business assistant for micro-entrepreneurs. It helps manage customers, payments, inventory and daily tasks, while Ask Eko uses business data to provide practical recommendations.

📄 **Detailed Internship Submission Document**: See [ASSIGNMENT.md](ASSIGNMENT.md) for problem framing, reasoning loops, failure scenarios, and video demo script.

---


## What it does

Micro-entrepreneurs (such as kirana store owners, wholesalers, and field agents) often struggle with credit recovery, manual stock tracking, and unorganized daily tasks. 

Eko Field Worker organizes these daily operations into a single mobile-friendly workflow:
- Tracks customer accounts and outstanding dues (Khata).
- Monitors low stock thresholds and reorder triggers.
- Provides a prioritized daily action plan (Daily Business Brief & Next Best Action).
- Drafts polite, personalized customer follow-ups and payment reminders.
- Requires explicit user confirmation before executing database actions.
- Works offline on the road, syncing when connectivity is restored.

---

## Features

- **Google Sign-In**: Quick sign-in across desktop web and Android WebView.
- **Customer Management (Khata)**: Add, edit, search, and track customer contact information and balance due.
- **Task Management**: Daily priority checklist with due dates and completion toggles.
- **Business Notes**: Log supplier meetings, order details, and operational reminders.
- **Inventory Tracking**: Manage item stock quantities, units, unit prices, and low-stock alerts.
- **Payment Ledger**: Record incoming and outgoing payments with status tracking.
- **Ask Eko AI**: Context-grounded business assistant powered by Gemini.
- **Persistent Business Memory**: Remembers high-level business goals (e.g. reducing outstanding credit) across sessions.
- **Daily Business Brief**: Aggregates pending payments, low stock counts, and overdue tasks into a daily summary.
- **Next Best Action**: Automatically identifies the most important action for the day.
- **AI Utility Tools**: Handwritten bill parser (OCR), voice note transcriber, and flyer copy generator.
- **Offline-First Storage**: Caches data locally with IndexedDB and Service Worker support.
- **Human-in-the-Loop Actions**: Displays confirmation cards before modifying business records.
- **Android APK**: Native Android WebView app with intent handling for phone calls, WhatsApp, and email.

---

## How Ask Eko works

Ask Eko is designed to give grounded answers based strictly on actual business records:

```
User Question
      ↓
Relevant Business Data (Customers, Inventory, Tasks, Payments, Goals)
      ↓
Gemini AI Engine (with system guardrails)
      ↓
Grounded Response (attributing facts to verified ledger data)
      ↓
Suggested Action (Optional action card)
      ↓
User Approval ([Approve & Execute] / [Later])
      ↓
Database Update & Business Event Audit Log
```

### Anti-Hallucination Guardrails
If necessary data is missing (for example, asking *"Kal kitna stock order karu?"* when recent sales movement data is not recorded), Eko refuses to guess arbitrary numbers. Instead, it explains what information is missing and suggests a safe next step.

---

## Architecture

- **Android App**: Android WebView wrapper with native scheme interceptors (`tel:`, `whatsapp://`, `mailto:`) and offline caching.
- **Web Frontend**: Single-page application written in HTML5, Vanilla CSS, and JavaScript. Uses IndexedDB and Service Worker for offline resilience.
- **Backend API**: FastAPI REST service running on Python 3.11 with rate limiting, CORS configuration, and Pydantic validation.
- **Database**: PostgreSQL (managed on Render) with SQLAlchemy ORM.
- **AI Engine**: Google Gemini API (`gemini-3.7-flash` / `gemini-1.5-flash`) with fallback to local rule-based engine if offline.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Mobile** | Kotlin, Android SDK 34, AndroidX, WebView |
| **Frontend** | HTML5, Vanilla CSS, Vanilla JavaScript, Service Worker, IndexedDB |
| **Backend** | Python 3.11, FastAPI, Uvicorn, SQLAlchemy, Pydantic, SlowAPI |
| **Database** | PostgreSQL |
| **AI / LLM** | Google Gemini API (`google-generativeai`) |
| **Deployment** | Netlify (Frontend), Render (Backend & PostgreSQL) |

---

## Project Structure

```
.
├── android/               # Native Android application source & Gradle build
│   └── app/src/main/
│       ├── java/          # Kotlin WebView & native scheme handlers
│       └── assets/        # Synchronized production web assets
├── backend/               # FastAPI backend application
│   ├── main.py            # API routes, Gemini integration & approval handlers
│   ├── models.py          # SQLAlchemy database models
│   ├── database.py        # Database session and connection pool
│   └── Dockerfile         # Production container definition
├── frontend/              # Production web application
│   ├── index.html         # Main single-page application entry point
│   ├── css/               # Application styling and responsive design tokens
│   ├── js/                # Client logic, API bridge, and screen routers
│   └── sw.js              # Service Worker for offline asset caching
├── render.yaml            # Render deployment blueprint
├── netlify.toml           # Netlify build and redirect configuration
└── README.md              # Project documentation
```

---

## Running Locally

### 1. Prerequisites
- Python 3.10+
- Node.js or simple HTTP server
- Android Studio (optional, for APK build)

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:
```ini
ENVIRONMENT=development
DATABASE_URL=sqlite:///./eko.db
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Start the API server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
Serve the `frontend/` folder with any local web server:
```bash
# Using Python
cd frontend
python -m http.server 3000
```
Open `http://localhost:3000` in your browser.

### 4. Android Build
```bash
cd android
./gradlew assembleRelease
```
The APK will be generated at `android/app/build/outputs/apk/release/app-release.apk`.

---

## Production

- **Live Web App**: [https://eko-field-worker.netlify.app](https://eko-field-worker.netlify.app)
- **Live Backend API**: [https://eko-field-worker-api.onrender.com](https://eko-field-worker-api.onrender.com)
- **Health Check**: [https://eko-field-worker-api.onrender.com/api/health](https://eko-field-worker-api.onrender.com/api/health)
- **GitHub Repository**: [https://github.com/sharma930560-lab/eko-ai-worker](https://github.com/sharma930560-lab/eko-ai-worker)

---

## Android APK Downloads

- 🏷️ **GitHub Releases Hub**: [https://github.com/sharma930560-lab/eko-ai-worker/releases](https://github.com/sharma930560-lab/eko-ai-worker/releases)
- 📱 **Direct APK Download (GitHub Release Asset)**: [Download app-release.apk](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.0.0/app-release.apk)
- 📦 **Direct AAB Bundle (GitHub Release Asset)**: [Download app-release.aab](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.0.0/app-release.aab)
- 🔨 **Local Build Path (v1.1.0)**: `android/app/build/outputs/apk/release/app-release.apk` (`versionName 1.1.0`, `versionCode 2`, 5.67 MB)



---

## Security

- API keys and database credentials are kept exclusively in environment variables and are never checked into source control.
- All database queries for business data, tasks, notes, inventory, and memories enforce user-level scoping (`user_id == current_user`).
- Authentication uses Google ID token verification with client ID matching.
- CORS policy restricts API access to known frontend origins.
- Rate limiting is configured on AI and auth endpoints to prevent abuse.
