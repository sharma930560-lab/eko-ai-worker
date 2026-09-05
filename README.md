# Eko Partner Operations

Eko Partner Operations is a professional, intelligent mobile assistant for Eko's financial-services ecosystem. It helps authorized operators manage customers, monitor live transaction activity, and automate operational tasks using context-grounded AI.

📱 **Professional Fintech Assistant**: High-fidelity fintech operations platform for Eko field partners.

---

## What it does

Eko Partner Operations organizes complex financial service workflows into a single, intelligent mobile experience:
- **Transaction Monitoring**: Real-time tracking of DMT, AePS, and Bill Payment health.
- **Customer Operations**: Detailed profiling and service history tracking for reliable financial service delivery.
- **AI-Powered Insights**: "Ask Eko" analyzes live transaction data to identify failures, suggest resolution steps, and summarize daily performance.
- **Operational Automation**: Generates professional service updates, KYC requests, and support responses via WhatsApp.
- **Risk Assessment**: Calculates transaction-based trust scores to help operators manage service limits safely.

---

## Features

- **Fintech Dashboard**: Real-time metrics for transaction volume, success rates, and service alerts.
- **Activity Tracker**: Searchable, filterable history of all service interactions with deep-link resolution.
- **Customer Profiles**: Secure management of customer data and service preferences.
- **Operational Tasks**: Prioritized checklist for resolving failed transactions, verifications, and support follow-ups.
- **Ask Eko AI**: Context-grounded reasoning engine powered by Gemini (1.5 Flash).
- **Service Utility Tools**:
    - **📊 Bill Scanner**: OCR extraction for utility bills and financial documents.
    - **🎙️ Voice Records**: Record service activity and events via vernacular voice commands.
    - **💬 WhatsApp Studio**: AI-assisted professional communication templates.
    - **🛡️ Credit Scorer**: Transaction-velocity-based risk assessment.
    - **🎨 Flyer Creator**: Marketing automation for Eko services.
- **Offline-First Resilience**: Local data caching via Room (Android) and IndexedDB (Web) for reliability in low-connectivity areas.

---

## How Ask Eko works

Ask Eko provides grounded operational advice based strictly on verified service activity:

```
Operator Question
      ↓
Multi-stage Data Retrieval (Customer Profile, Credit Score, Timeline, Transactions, Grievances)
      ↓
Gemini AI Engine (with fintech system instruction)
      ↓
Grounded Response (attributing facts to verified transaction logs)
      ↓
Action Proposal (Optional resolution steps)
      ↓
Operator Review & Approval
      ↓
Database Update & Audit Logging
```

### Safety & Grounding
Eko refuses to invent financial data. If a transaction ID or failure reason is missing from the context, Eko transparently identifies the information gap and suggests the correct investigative path.

---

## Architecture

- **Android App**: Native Kotlin shell using WebViewAssetLoader for secure, high-performance local asset delivery.
- **FastAPI Backend**: Robust Python 3.11 service with structured error handling and secure AI orchestration.
- **AI Provider Abstraction**: `ai_provider.py` supports Gemini, OpenAI, and LocalDeterministic fallback — zero vendor lock-in.
- **Database**: PostgreSQL (Render) with user-scoped isolation for all operational entities. Schema migrations via `sqlalchemy.inspect`.
- **AI Integration**: Server-side multi-stage grounding — customer profile, credit history, timeline, transactions, and grievances assembled before AI reasoning.

---

## Security

- **Zero API Keys in APK**: Gemini and Database credentials remain server-side.
- **User Isolation**: Strict `user_id` filtering on every database query.
- **Hardware Security**: Integrated with Android Keystore and biometric unlock stubs.
- **HTTPS Only**: All communications encrypted via TLS/HTTPS.
- **Human-in-the-Loop**: Consequential database mutations require explicit operator confirmation.
- **Request Deduplication**: Frontend lock (`isAiRequestInProgress`) + `requestId` tracking prevents duplicate AI submissions.
- **AbortController Timeouts**: 20s standard / 45s AI with clean abort handling.

---

## Live Deployment

| Resource | URL |
|---|---|
| 🌐 Web App | https://eko-field-worker.netlify.app |
| 🔧 Backend API | https://eko-field-worker-api.onrender.com |
| 💚 Health Check | https://eko-field-worker-api.onrender.com/api/health |
| 📦 GitHub Release | https://github.com/sharma930560-lab/eko-ai-worker/releases/tag/v1.2.0 |

---

## Latest Release (v1.2.0)

- 📱 **Android Package**: `com.eko.fieldworker` (versionCode 3)
- 🤖 **AI Provider**: Gemini 1.5 Flash with OpenAI and LocalDeterministic fallback
- 🔨 **Build Result**: Fully compiled production APK — `eko-partner-operations-v1.2.0.apk`
- 🚀 **AI Status**: Live multi-stage grounded reasoning with structured `AskEkoResponse` schema
- 🗄️ **Database**: PostgreSQL on Render — connected and healthy
- 🔄 **Migrations**: PostgreSQL-safe via `sqlalchemy.inspect`
