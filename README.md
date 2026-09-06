# Eko Partner Operations

Eko Partner Operations is a professional, intelligent mobile assistant for Eko's financial-services ecosystem. It helps authorized operators manage customers, monitor live transaction activity, and automate operational tasks using context-grounded AI.

📱 **Professional Fintech Assistant**: High-fidelity fintech operations platform for Eko field partners.

---

## 📱 Download Android App

[⬇️ Download Eko Partner Operations v1.4.0](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.4.0/Eko-Partner-Operations-v1.4.0.apk)

**Version**: `v1.4.0` (versionCode 4)  
*Android APK for the v1.4.0 production release.*  
[View Release Notes](https://github.com/sharma930560-lab/eko-ai-worker/releases/tag/v1.4.0)

---

## 🚀 Production Release v1.4.0

Production release featuring:

- **WhatsApp Customer Outreach & Studio**: 3-stage lifecycle (`PENDING` -> `WHATSAPP_OPENED` -> `SENT`), WorkManager follow-up reminders, and automatic reminder cancellation.
- **Interactive Credit Analysis**: Deterministic, grounded multi-factor risk assessment (KYC status, failed transactions, volume, performance tenure) with dynamic simulation and one-click baseline restoration.
- **Banner & Poster Studio**: Mobile-first marketing editor with hero canvas, touch-to-edit, and segmented panels.
- **15 Production-Ready Templates**: Preloaded across 8 categories (Offers, DMT, AePS, Recharge, Festival, Promotion, Engagement, All).
- **Accurate Percentage Offer Engine**: Strict arithmetic grounding for original price, discount percentage, discount amount, and final price (e.g. ₹1,299 @ 23% = ₹1,000.23, ₹1,299 @ 10% = ₹1,169.10).
- **Protected "Made by Eko" Layer**: Tamper-proof partner branding permanently preserved across previews, saved states, and PNG exports.
- **Undo / Redo History**: Mathematically sound stack-based state management.
- **Real PNG Export & Native Android Share**: High-resolution canvas rendering with Android `FileProvider` share sheet integration.
- **AI-Assisted Marketing Copy**: Context-aware promotional copy generator with manual editability.
- **Enterprise Security**: Zero client secrets, strictly isolated user data tenant architecture, and production-grade CSP headers.

---

## 🌐 Live Production Deployment

| Resource | URL |
|---|---|
| 🌐 Web App | https://eko-field-worker.netlify.app |
| 🔧 Backend API | https://eko-field-worker-api.onrender.com |
| 💚 Health Check | https://eko-field-worker-api.onrender.com/api/health |
| 📦 GitHub Release | https://github.com/sharma930560-lab/eko-ai-worker/releases/tag/v1.4.0 |
| 📱 Android APK | [Download Eko-Partner-Operations-v1.4.0.apk](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.4.0/Eko-Partner-Operations-v1.4.0.apk) |

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
    - **💬 WhatsApp Studio**: AI-assisted professional communication templates and lifecycle reminders.
    - **🛡️ Credit Scorer**: Multi-factor grounded risk engine and simulation.
    - **🎨 Poster Studio**: Production-grade marketing studio with 15 preloaded templates and exact offer pricing.
- **Offline-First Resilience**: Local data caching via Room (Android) and IndexedDB (Web) for reliability in low-connectivity areas.
- **Sandbox Simulation**: Financial service operations run in a simulated demonstration sandbox environment with realistic transaction responses.

---

## Architecture

- **Android App**: Native Kotlin shell using `WebViewAssetLoader` for secure, high-performance local asset delivery.
- **FastAPI Backend**: Robust Python service with structured error handling and secure AI orchestration.
- **AI Provider Abstraction**: Supports Gemini, OpenAI, and LocalDeterministic fallback with zero vendor lock-in.
- **Database**: PostgreSQL on Render with user-scoped isolation for all operational entities. Schema migrations via `sqlalchemy.inspect`.
- **AI Integration**: Server-side multi-stage grounding — customer profile, credit history, timeline, transactions, and grievances assembled before AI reasoning.

---

## Security

- **Zero API Keys in APK**: Gemini and Database credentials remain strictly server-side.
- **Tenant Data Isolation**: Strict `user_id` authorization filters on every database query.
- **Hardware Security**: Integrated with Android Keystore and biometric authentication callbacks.
- **HTTPS Only**: All communications encrypted via TLS/HTTPS.
- **Human-in-the-Loop**: Consequential database mutations require explicit operator confirmation.
- **Request Deduplication**: Frontend lock (`isAiRequestInProgress`) + `requestId` tracking prevents duplicate AI submissions.
- **AbortController Timeouts**: 20s standard / 45s AI with clean abort handling.
