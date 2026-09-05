# EKO FIELD OPERATIONS — PRODUCTION AI ARCHITECTURE & PROVIDER SELECTION

## Executive Architecture Summary

Eko Field Operations employs a **triple-tier hybrid AI architecture** designed to guarantee privacy, structural accuracy, and zero-downtime operations across local development and production cloud environments:

```
                  ┌───────────────────────────────────────────────┐
                  │          AI Provider Router                   │
                  │        (backend/ai_provider.py)               │
                  └───────────────────────┬───────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌──────────────┐                 ┌─────────────────┐               ┌─────────────────┐
│ LOCAL (Dev)  │                 │ HOSTED CLOUD API│               │ DEMO FALLBACK   │
│ Ollama Local │                 │ Groq / Gemini   │               │ Grounded Engine │
│ qwen3:4b     │                 │ Llama-3.3-70b   │               │ DB-Grounded     │
│ (Unlimited)  │                 │ (Low Latency)   │               │ (Deterministic) │
└──────────────┘                 └─────────────────┘               └─────────────────┘
```

---

## 1. Production Deployment Constraints & Architectural Decision

### Production Infrastructure Constraints (Render Free Tier)
- **RAM**: 512 MB
- **GPU**: None
- **CPU**: Shared vCPU (container process lifecycle with inactivity sleep)

### Impact on Ollama
Running a local LLM daemon like `qwen3:4b` inside a 512 MB container is physically impossible (models require >2.8 GB VRAM/RAM). Attempting to run Ollama inside Render free tier causes OOM container termination.

### Selected Production Solution (Option B + Option C)
1. **Primary Production Mode (Hosted API Adapter)**:
   - When a server-side API key (`GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY`) is set in the production environment variables, the backend routes requests to the hosted provider (`Llama-3.3-70b` / `gemini-2.5-flash` / `gpt-4o-mini`).
   - Server-side keys are strictly held in backend env vars; **zero keys reach the client**.
2. **Fallback Mode (Database-Grounded Deterministic Engine)**:
   - If no cloud key is present or if network calls to cloud providers fail, the backend seamlessly routes to `LocalDeterministicProvider`.
   - `/api/ai/health` truthfully probes live provider availability, returning `live_verified: false` and `ai_mode: "demo_fallback"` when offline, avoiding false health claims.

---

## 2. Comprehensive AI Provider Matrix

| Feature / Criteria | Ollama Local (`qwen3:4b`) | Groq Cloud (`llama-3.3-70b`) | Google Gemini (`gemini-2.5-flash`) | Local Deterministic Engine |
|---|---|---|---|---|
| **Environment** | Local Dev / Private Server | Production Hosted | Production Hosted | Offline / Free Tier Fallback |
| **Hardware Required** | 8GB RAM / GPU | None (Cloud) | None (Cloud) | Minimal (512MB RAM) |
| **Cost / Rate Limits** | **100% Free & Unlimited** | Free tier (30 RPM, 14.4k RPD) | Free tier (15 RPM, 1.5k RPD) | **100% Free & Unlimited** |
| **Hindi Support** | Excellent | Excellent | Excellent | Grounded DB Templating |
| **Hinglish Support** | Excellent | Excellent | Excellent | Grounded DB Templating |
| **Structured Output** | JSON Schema (`format: json`) | JSON Object (`json_object`) | JSON Schema | Native JSON Object |
| **Data Privacy** | 100% On-Premise / Zero Egress | Data Minimization via `sanitize_context_for_ai()` | Data Minimization via `sanitize_context_for_ai()` | 100% Internal DB |
| **License** | Open Weights (Qwen) | Commercial API | Commercial API | Proprietary Eko Code |

---

## 3. Data Sanitization & PII Redaction Policy

All prompts and system instructions pass through `sanitize_context_for_ai()` prior to dispatch:

```python
# Strip sensitive identifiers before external transmission:
- 12-digit Aadhaar Numbers -> [AADHAAR_REDACTED]
- 10-char Indian PAN -> [PAN_REDACTED]
- 16-digit Credit/Debit Cards -> [CARD_REDACTED]
- JWT Tokens -> [JWT_REDACTED]
- API Keys -> [API_KEY_REDACTED]
- Passwords & Auth Tokens -> [SECRET_REDACTED]
```

---

## 4. Compromised Keys & Credential Revocation Audit

- **Historical Exposure**: Commits `ea80e52` and `4d6c664` contained references to old test keys.
- **Action**: All historical personal API keys are marked as **COMPROMISED & RECOMMENDED FOR IMMEDIATE REVOCATION**.
- **Active Codebase**: Zero hardcoded secrets in source code, `.env`, `frontend/`, or Android APK.
- **OAuth Distinction**: Google OAuth Client ID (`GOOGLE_CLIENT_ID`) remains configured solely for client-side authentication and contains zero AI generation capabilities.
