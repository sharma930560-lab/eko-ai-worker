# Eko AI Operations 2.0

Eko AI Operations is a professional, intelligent mobile assistant for Eko's financial-services ecosystem. It helps authorized operators manage customers, monitor live transaction activity, and automate operational tasks using context-grounded AI.

📱 **Professional Fintech Assistant**: Transitioned from a micro-business tool to a high-fidelity fintech operations platform.

---

## What it does

Eko AI Operations organizes complex financial service workflows into a single, intelligent mobile experience:
- **Transaction Monitoring**: Real-time tracking of DMT, AePS, and Bill Payment health.
- **Customer Operations**: Detailed profiling and service history tracking for reliable financial service delivery.
- **AI-Powered Insights**: "Ask Eko" analyzes live transaction data to identify failures, suggest resolution steps, and summarize daily performance.
- **Operational Automation**: Generates professional service updates, kyc requests, and support responses via WhatsApp.
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
Relevant Operational Data (Activity, Tasks, Customers, Goals)
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
- **Database**: PostgreSQL with user-scoped isolation for all operational entities.
- **AI Integration**: Server-side Google Gemini integration with structured error propagation (`AI_UNAVAILABLE` states).

---

## Security

- **Zero API Keys in APK**: Gemini and Database credentials remain server-side.
- **User Isolation**: Strict `user_id` filtering on every database query.
- **Hardware Security**: Integrated with Android Keystore and biometric unlock stubs.
- **HTTPS Only**: All communications encrypted via TLS/HTTPS.
- **Human-in-the-Loop**: Consequential database mutations require explicit operator confirmation.

---

## Latest Release (v1.1.0)

- 📱 **Android Package**: `com.eko.fieldworker`
- 🔨 **Build Result**: Fully compiled and verified.
- 🚀 **AI Status**: Live Gemini-1.5-Flash integration with robust fallback.
