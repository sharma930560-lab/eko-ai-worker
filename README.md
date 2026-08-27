# Eko Micro-Entrepreneur AI Worker

> **A Production-Grade, Offline-First AI Operating System for Indian Small Businesses & Field Agents**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Gemini 1.5 Flash](https://img.shields.io/badge/AI%20Engine-Gemini%201.5%20Flash-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev)
[![Android](https://img.shields.io/badge/Platform-Android%20Native%20APK-3DDC84.svg?logo=android&logoColor=white)](https://github.com/sharma930560-lab/eko-ai-worker/releases)
[![Offline First](https://img.shields.io/badge/Architecture-Offline--First%20IndexedDB%2BRoom-FFA000.svg)](#-offline-first-architecture)
[![DPDP Act 2023](https://img.shields.io/badge/Compliance-DPDP%20Act%202023-10B981.svg)](#-privacy--security)

---

## 📥 Download Production APK

| Package | Version | Architecture | Direct Download |
|---|---|---|---|
| **Eko Field Worker Release APK** | `v1.0.0` | Universal Android (ARM64, ARMv7, x86_64) | [**Download APK (5.6 MB)**](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.0.0/app-release.apk) |

---

## 🎯 Mission Alignment

In semi-urban, rural, and deep rural markets across India, micro-entrepreneurs (kirana store owners, mobile recharge agents, ration distributors, local facilitators) represent the financial backbone of local commerce. 

Traditional software fails them because:
1. **Low digital comfort**: Store owners do not type on desktop keyboards or fill 10-field forms.
2. **Device constraints**: They operate on $70–$150 Android phones with intermittent 2G/3G/4G connectivity.
3. **Complex credit/khata chaos**: Transactions happen via messy handwritten parchii, Hindi voice notes, and informal WhatsApp promises.

**Eko Micro-Entrepreneur Worker** solves these exact problems by pairing lightweight, zero-dependency frontend architecture with **True Multimodal & Generative AI superpowers** and **complete offline-first reliability**.

---

## ⚡ 5 True Generative & Multimodal AI Superpowers

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EKO AI SUPERPOWERS SUITE                                      │
├────────────────────────────────┬────────────────────────────────┬──────────────────────────────┤
│ 📷 Multimodal Bill Scanner     │ 🎙️ Vernacular Voice Khata      │ 💬 WhatsApp Studio & Debt    │
│ Gemini 1.5 Flash Vision reads  │ Web Speech API + Gemini NLP    │ Culturally nuanced tone-     │
│ messy handwritten Hindi/Eng    │ transforms unstructured Hindi  │ tuned messages (gentle,      │
│ parchment, receipts, and line  │ voice into structured ledger   │ firm overdue, festive combo) │
│ items with 1-click ledger save.│ items & follow-up reminders.   │ with direct 1-tap WhatsApp.  │
├────────────────────────────────┴────────────────────────────────┴──────────────────────────────┤
│ 🛡️ Khata Credit Risk & Trust Underwriting Scorer                                               │
│ Evaluates customer payment punctuality, delay days, and ticket volatility to generate a        │
│ Trust Score (1-100), safe credit limits, and delinquency warnings for micro-lending.          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🎨 Generative Marketing Flyer & Status Creator                                                  │
│ Automatically crafts high-converting WhatsApp Status promo copy and renders a downloadable     │
│ HTML5 Canvas poster for instant local customer broadcast.                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Offline-First Architecture & Auto-Sync

The app is built from the ground up to guarantee **zero blank screens** and **instant startup** even in zero-connectivity environments:

1. **Instant Startup**: All application UI and cached data (Customers, Tasks, Notes, Offers, AI history) load immediately from **IndexedDB** / **Room SQLite** without waiting for the network.
2. **Session Persistence**: Authentication profile persists safely across device restarts, reboots, and app lifecycle changes via hardened local persistence.
3. **Optimistic Offline Mutations**: Creating, editing, or deleting ledger items while offline queues the mutations in the background sync queue and optimistically updates the UI.
4. **Automatic Reconnection Sync**: When network connectivity returns, the engine automatically drains the sync queue with exponential backoff and refreshes all views seamlessly.

---

## 🏗️ Production System Architecture

```mermaid
graph TD
    A[Android Native Device / PWA Client] -->|HTTPS Asset Loader| B[Vanilla ES6 Frontend UI]
    B -->|Offline-First Cache & Queue| C[(IndexedDB / Room SQLite)]
    B -->|HTTPS REST API + X-User-Id| D[FastAPI Production Gateway]
    D -->|PostgreSQL Connection Pool| E[(Production PostgreSQL DB)]
    D -->|Topic Filter & Context Builder| F[AI Gateway Engine]
    F -->|In-Memory LRU Cache TTL 5m| G{Cache Hit?}
    G -->|Yes 1ms| B
    G -->|No| H[Gemini 1.5 Flash / Vision API]
    H -->|Structured Output JSON Mode| I[Post-Response Anti-Hallucination Validator]
    I -->|Valid Response| B
    I -->|Discrepancy Detected| J[Grounded Local Logic Engine]
    J --> B
```

---

## 🛡️ Production Security & AI Guardrails

| Feature | Implementation | Production Guardrail |
|---|---|---|
| **HTTPS Only** | Android Network Security Config + SSL | Completely blocks all cleartext HTTP traffic in production builds. |
| **Native Google Auth** | AndroidX Credential Manager | Native bottom sheet picker; no OAuth WebView redirection vulnerabilities. |
| **Session Persistence** | Hardened Local Storage | User session survives phone reboots, app closes, and offline restarts. |
| **Structured Output** | `response_mime_type="application/json"` | Guarantees reliable JSON rendering without client regex crashes. |
| **Rate Limiting** | SlowAPI Token Bucket | 30 req/min for Ask Eko, 20 req/min for Vision & Multimodal endpoints. |
| **Anti-Hallucination** | System prompt contract + `validate_no_hallucinated_names()` | Rejects phantom customer names not present in the user's actual database. |
| **PostgreSQL Support** | SQLAlchemy + Psycopg2 + Pool pre-ping | Production-ready connection pooling for concurrent requests. |

---

## 🚀 Deployment & Cloud Setup

### 1. Backend Deployment (Render.com + PostgreSQL)

The repository includes a ready-to-deploy [`render.yaml`](file:///c:/Users/naman/OneDrive/Desktop/Eko%20Field%20Worker/render.yaml) specification for 1-click cloud deployment.

#### Environment Variables for Production
```env
GOOGLE_CLIENT_ID=258255119262-hl7e15h4ohciliroc29gcpbfa6i1sf2l.apps.googleusercontent.com
GEMINI_API_KEY=your_gemini_api_key
ENVIRONMENT=production
ALLOWED_ORIGINS=https://appassets.androidplatform.net,http://localhost:3000
DATABASE_URL=postgresql://user:password@hostname:5432/eko_db
```

#### Production Endpoints
- **Health Check**: `GET /api/health`
- **Interactive Swagger Docs**: `GET /docs` (available in development/staging)
- **Google Auth**: `POST /api/auth/google`
- **Customer Khata**: `GET|POST|PATCH|DELETE /api/customers`
- **Tasks & Reminders**: `GET|POST|PATCH|DELETE /api/tasks`
- **AI Superpowers**:
  - `POST /api/ai/ask`
  - `POST /api/ai/scan-bill`
  - `POST /api/ai/voice-parse`
  - `POST /api/ai/generate-message`
  - `POST /api/ai/credit-score`
  - `POST /api/ai/generate-flyer`

---

## 📱 Building Android APK Locally

```bash
cd android

# Build both Release and Debug APKs
./gradlew.bat assembleRelease assembleDebug

# Output APKs:
# app/build/outputs/apk/release/app-release.apk
# app/build/outputs/apk/debug/app-debug.apk

# Install directly on device/emulator
adb install app/build/outputs/apk/release/app-release.apk
```

---

## 🧪 Recruiter Evaluation Walkthrough

1. **Option A: Native Android APK**: Install `app-release.apk` on any Android device or emulator.
2. **Option B: Web Demo Mode**: Run `docker-compose up` or start frontend and click **"Try Demo Mode"** for instant 1-click evaluation.
3. **Test 1: 📷 Parchii Scanner**: Click **AI Tools** → **Parchii Scanner** → Click test receipt *"Ramesh Khata Parchii"*. Observe Vision AI extracting items and totals with 1-click save.
4. **Test 2: 🎙️ Voice Khata**: Click **Voice Khata** → Click test sample *"Sharma ji 10 packet atta le gaye..."* → Observe natural language entity extraction and auto-create task.
5. **Test 3: 💬 WhatsApp Studio**: Click **WhatsApp Studio** → Switch tone to *"⚡ Firm & Professional Recovery"* → Click *"Open in WhatsApp"*.
6. **Test 4: 🛡️ Credit Risk Scorer**: Click **Credit Scorer** → Adjust delay slider → Observe real-time Micro-Lending Trust Score (1-100) and recommended credit cap.
7. **Test 5: 🎨 Flyer Creator**: Click **Flyer Creator** → Modify offer text → Observe real-time HTML5 canvas render and download PNG.
8. **Test 6: 🤖 Ask Eko Assistant**: Open **Ask Eko AI** → Click *"Daily plan summary"* → Click the **"Add to Tasks"** action button on the structured response card.
9. **Test 7: 📴 Offline Resilience**: Turn on Airplane mode on your device/emulator. Open app, navigate khata, add a task. Observe optimistic instant update, offline banner, and automatic sync upon disabling Airplane mode.

---

## 📜 License
Built with ❤️ by Paras Sharma for Eko Micro-Entrepreneur Operations. Open Source MIT License.
