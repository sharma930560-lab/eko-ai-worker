# Eko Field Worker — Internship Assignment Submission

**Project**: Eko Field Worker  
**Track**: Full-Stack / AI Workflow / Forward-Deployed Engineer  
**Repository**: [https://github.com/sharma930560-lab/eko-ai-worker](https://github.com/sharma930560-lab/eko-ai-worker)  
**Live Web Application**: [https://eko-field-worker.netlify.app](https://eko-field-worker.netlify.app)  
**Live Production API**: [https://eko-field-worker-api.onrender.com](https://eko-field-worker-api.onrender.com)  
**Latest Production Commit**: `ae72210`  
**Android Release APK (v1.1.0)**: `android/app/build/outputs/apk/release/app-release.apk`  

---

## 1. Problem & Context

Micro-entrepreneurs (such as local kirana store owners, wholesalers, and small service providers) manage their daily operations across disconnected channels: paper notebooks (Khata), mental notes, and WhatsApp messages. 

This causes three recurring operational problems:
1. **Blocked Cash Flow**: Delayed or missed credit recovery follow-ups because customer debt is spread across unorganized pages.
2. **Stock Outages**: Low stock is noticed only after an item runs out, leading to lost sales.
3. **Cognitive Overload**: Small business owners lack dedicated staff and spend significant energy deciding what to do first every morning.

Generic AI chatbots fail here because they answer questions in isolation without context, hallucinate financial numbers, and cannot take bounded actions inside the business workflow.

---

## 2. User Persona

- **User**: A micro-entrepreneur running a small retail or wholesale trade business.
- **Environment**: Low-to-mid range Android smartphone, intermittent 3G/4G connectivity, high ambient noise, and limited daily time.
- **Language**: Prefers conversational Hinglish or vernacular Hindi over formal English.
- **Digital Comfort**: Familiar with WhatsApp and basic smartphone apps, but does not use complex desktop ERPs or accounting software.

---

## 3. Goal & Definition of Done

### Goal
Build an offline-first AI business assistant that continuously inspects customer debt, inventory levels, tasks, and business goals to provide prioritized daily advice, draft personalized communications, and execute bounded actions with explicit human confirmation.

### Definition of Done
1. **Ledger & Operations Core**: User can record customers, debts, payments, inventory, and tasks both online and offline.
2. **Grounded AI Analysis**: Ask Eko retrieves only verified database records to answer questions without inventing numbers.
3. **Intentional Guardrails**: When necessary data is missing (e.g. sales velocity), Eko refuses to guess and asks for the missing data instead.
4. **Human-in-the-Loop Execution**: Consequential actions (creating tasks, logging follow-ups) require user approval before database commits.
5. **Durable Memory**: Eko remembers overarching business preferences and goals across sessions.
6. **Mobile Reliability**: Native Android wrapper supports calling, WhatsApp intents, and offline static asset caching.

---

## 4. Why This is an AI Worker (Not Just a Chatbot)

| Aspect | Generic Chatbot | Eko Field Worker |
|---|---|---|
| **Trigger** | Waits for user to ask a prompt | Analyzes real-time ledger & inventory on every load |
| **Context** | Context window only | Live database state + persistent business memories |
| **Prioritization** | Generic advice | Computes **Next Best Action** based on debt & stock thresholds |
| **Missing Data** | Often guesses or hallucinates | Intentionally refuses to guess and explains what is missing |
| **Action Execution** | Produces plain text | Emits structured action cards with `[Approve & Execute]` buttons |
| **Audit Trail** | None | Records approved actions in a `business_events` audit table |
| **Device Model** | Heavy web browser only | Lightweight Android WebView + Service Worker offline caching |

---

## 5. System Workflow & State Machine

```
               ┌───────────────────────┐
               │         IDLE          │
               └──────────┬────────────┘
                          │ (User input / App load)
                          ▼
               ┌───────────────────────┐
               │    LOAD REAL DATA     │
               │ (Ledger, Stock, Memory)│
               └──────────┬────────────┘
                          │
                          ▼
               ┌───────────────────────┐
               │  ANALYZE & PRIORITIZE │
               └──────────┬────────────┘
                          │
                Is required data missing?
               ┌──────────┴────────────┐
         [YES] │                       │ [NO]
               ▼                       ▼
   ┌───────────────────────┐ ┌───────────────────────┐
   │ INTENTIONAL REFUSAL   │ │ GROUNDED RESPONSE     │
   │ (Explains missing     │ │ (Attributed to live   │
   │  sales history)       │ │  business records)    │
   └───────────────────────┘ └──────────┬────────────┘
                                       │
                                Action suggested?
                               ┌────────┴────────┐
                         [NO]  │                 │ [YES]
                               ▼                 ▼
                     ┌────────────────┐ ┌─────────────────────┐
                     │ RESPOND TO USER│ │ WAIT FOR APPROVAL   │
                     └────────────────┘ └────────┬────────────┘
                                                 │
                                           User Decision
                                         ┌───────┴───────┐
                                  [LATER]│               │ [APPROVE]
                                         ▼               ▼
                                   ┌──────────┐ ┌──────────────────┐
                                   │ DISMISS  │ │ EXECUTE & RECORD │
                                   │ (No DB   │ │ (Update DB +     │
                                   │  change) │ │  Business Event) │
                                   └──────────┘ └──────────────────┘
```

---

## 6. Real Interaction Examples (Using Sample Data)

*Note: The following examples use dummy test data (`Ramesh Kumar: ₹3,500 due`, `Mustard Oil: 2 bottles remaining`).*

### Example 1: Daily Prioritization
> **User**: "Aaj mujhe kya karna chahiye?"  
> **Eko**: "☀️ **Aaj ka Business Brief**: Pehle **Ramesh Kumar** ko call karein kyunki unka **₹3,500** pending hai aur follow-up due hai. Iske alawa Mustard Oil 1L (2 bottles) low stock par hai."  
> **Action Card**: `[💬 Draft WhatsApp Reminder]` `[📞 Call Ramesh]`

### Example 2: Multi-Turn Message Drafting & Refinement
> **User**: "Uske liye message bana do"  
> **Eko**: "Namaste Ramesh Kumar ji 🙏 Aapka ₹3,500 ka hisaab balance pending hai. Jab convenient ho please settle kar dijiye. Dhanyawad!"  
> **User**: "Short karo"  
> **Eko**: "Namaste Ramesh Kumar ji 🙏 ₹3,500 hisaab clear kar dein please. Dhanyawad!"  

### Example 3: Intentional Failure on Missing Sales Data
> **User**: "Kal kitna stock order karu?"  
> **Eko**: "⚠️ **Intentional Business Guardrail**: Main exact reorder quantity recommend **nahi** karunga kyunki aapke business records mein **recent 7–30 days ki sales movement** available nahi hai. Main guess nahi karunga.  
> 👉 **Next Step**: Pehle is item ka weekly sales count add karein, phir main data-driven reorder recommendation calculate kar sakta hoon."

### Example 4: Data Source Attribution
> **User**: "Tumhe kaise pata?"  
> **Eko**: "💡 **Data Transparency**: Yeh recommendation aapke verified database records se aayi hai:  
> - Customer Khata (Ramesh Kumar: ₹3,500 pending)  
> - Live Inventory tracker (Mustard Oil: 2 remaining vs threshold 5)  
> - Active Business Goals (Goal: outstanding credit kam karna hai)"

---

## 7. Persistent Business Memory

Eko stores durable user preferences in an `ai_memories` table:
- **Storage**: When a user states an overarching objective (e.g. *"Yaad rakhna: Mera goal outstanding credit kam karna hai"*), Eko extracts and persists this goal.
- **Recall**: In future sessions, Eko injects active memories into its prompt context so recommendations align with the user's high-level goal.
- **Tenant Isolation**: Memories are strictly isolated by `user_id == current_user`.
- **User Control**: Memories can be deactivated/cleared via `DELETE /api/ai/memories/{id}` or by saying *"bhool jao"*.

---

## 8. Human-in-the-Loop Action Approval

Consequential business operations follow a strict approval model:
1. **Detection**: Eko identifies that an action is appropriate (e.g. creating a follow-up task or sending a message).
2. **Drafting**: Eko displays a structured card with `[✅ Approve & Execute]` and `[Later]` buttons.
3. **No Phantom Commits**: Before the user clicks approve, no database modifications occur.
4. **Execution & Audit Log**: When the user approves, `POST /api/ai/approve-action` commits the task/follow-up and logs an entry in `models.BusinessEvent`.
5. **Idempotency**: Repeated rapid taps are protected against duplicate record creation.

---

## 9. Device-Constrained & Offline-First Design

### Why Android WebView + Vanilla PWA?
- **Low Memory Footprint**: Avoids heavy cross-platform frameworks (e.g. React Native or Flutter bundle sizes of 30MB+). Total release APK is only **5.67 MB**.
- **Instant Asset Loading**: Static assets (`HTML`, `CSS`, `JS`) are packaged locally inside Android assets and cached via Service Worker.
- **Native Scheme Interception**: `MainActivity.kt` intercepts `tel:`, `whatsapp://`, and `mailto:` links to open Android's native dialer and WhatsApp without WebView security errors.

### Offline vs. Online Boundary
- **Works Fully Offline**: Customer directory, local task list, inventory tracking, notes, and local draft messages via IndexedDB and Service Worker cache.
- **Requires Network**: Live Gemini generative reasoning (`/api/ai/ask`) and PostgreSQL cloud synchronization.
- **Offline Transparency**: When disconnected, Eko displays an offline badge and informs the user that live AI reasoning is unavailable rather than pretending to generate answers.

---

## 10. Privacy & Data Minimization (DPDP Approach)

1. **User Scoping**: Every SQL query is filtered by authenticated `user_id`.
2. **Data Minimization in Prompts**: Context builder injects only relevant summaries (names, amounts, overdue status) into Gemini prompts rather than full historical dumps.
3. **No Hardcoded Secrets**: All OAuth secrets, database credentials, and Gemini API keys reside in server environment variables.
4. **No Third-Party Tracking**: No analytics SDKs or advertising trackers are embedded.

*Note: While designed following data minimization and privacy best practices, formal legal and compliance certification would be required prior to enterprise-scale deployment.*

---

## 11. Core Technologies Used

- **Android Client**: Kotlin, Android SDK 34, AndroidX, WebView with native intent overrides.
- **Web Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+), Service Worker, IndexedDB.
- **Backend Service**: Python 3.11, FastAPI, SQLAlchemy ORM, Uvicorn, SlowAPI rate limiter.
- **Database**: PostgreSQL on Render.
- **AI Engine**: Google Gemini API (`gemini-3.7-flash` with localized fallback engine).
- **Hosting**: Netlify (Frontend SPA), Render (FastAPI Docker container & PostgreSQL).

---

## 12. Honest Limitations & Future Work

To maintain engineering honesty, here is what is implemented vs. what remains future work:

### Current Implementation (Verified)
- Full CRUD for Customers, Tasks, Notes, Inventory, and Payments.
- Multi-turn AI chat with context grounding and memory recall.
- Daily Business Brief and Next Best Action calculation.
- Intentional failure guardrail on missing sales velocity data.
- Transparent database source attribution.
- Human approval workflow with `BusinessEvent` audit logging.
- Android release APK (v1.1.0) with native calling/WhatsApp intent handling.

### What Remains Human-Led / Future Roadmap
- **Sales Velocity Tracking**: Reorder calculations currently require manual input of weekly sales velocity. Building automated movement tracking is planned for V2.
- **Voice Input in Vernacular Languages**: Currently relies on text-based Hinglish/Hindi. Native on-device voice STT in Indian regional dialects is planned.
- **Advanced Multi-Device Conflict Resolution**: Current sync uses client timestamping; formal CRDT or operational transformation would be needed for multi-clerk simultaneous edits.
- **Field Deployment Testing**: The system has been validated via automated production test suites; direct pilot testing with real kirana merchants is the necessary next step.

---

## 13. Demo Video Script & Shot-by-Shot Guide

**Estimated Duration**: ~3 minutes  
**Tone**: Practical developer explaining the architecture and workflow.

### Shot 1: Context & Problem (0:00 - 0:35)
- **Visual**: Show physical kirana paper notebook (Khata) or open Eko dashboard on phone.
- **Spoken Script**: *"Micro-entrepreneurs lose money every week to forgotten customer follow-ups and unmonitored stock. Instead of building another generic chatbot that gives generic advice, I built Eko Field Worker — an offline-first assistant that connects directly to the merchant's business data."*

### Shot 2: Business Grounding & Daily Brief (0:35 - 1:15)
- **Visual**: Click *Ask Eko* $\rightarrow$ Select *☀️ Daily Brief* $\rightarrow$ Show response identifying overdue customer and low stock item.
- **Spoken Script**: *"When the user asks 'Aaj kya karu?', Eko doesn't guess. It checks the live customer ledger and inventory to generate a Daily Brief. Here it highlights that Ramesh Kumar has ₹3,500 pending recovery."*

### Shot 3: Multi-Turn Refinement & Human Approval (1:15 - 1:55)
- **Visual**: Ask *"Uske liye message bana do"* $\rightarrow$ show draft $\rightarrow$ Ask *"Short karo"* $\rightarrow$ Tap *[Approve & Execute]* $\rightarrow$ Show task created with toast.
- **Spoken Script**: *"I can refine the follow-up in Hinglish. Notice that Eko doesn't commit anything to the database automatically. Only when I tap 'Approve & Execute' is the follow-up logged and a task created in the business audit trail."*

### Shot 4: Intentional Failure Guardrail (1:55 - 2:30)
- **Visual**: Ask *"Kal kitna stock order karu?"* $\rightarrow$ Show Eko's refusal message.
- **Spoken Script**: *"An essential principle in this project is intentional failure. When I ask 'Kal kitna stock order karu?', Eko notices that 30-day sales velocity data isn't recorded. Instead of hallucinating a random quantity, it transparently explains that data is missing and recommends what to do next."*

### Shot 5: Mobile & Offline Behavior (2:30 - 3:00)
- **Visual**: Show Android APK interface $\rightarrow$ Trigger phone dialer / WhatsApp $\rightarrow$ Switch on Airplane mode to show offline UI.
- **Spoken Script**: *"The frontend is packaged inside a 5.6MB Android APK with native dialer and WhatsApp intent handling. Local records remain accessible offline via IndexedDB. This gives the entrepreneur a reliable tool that works on real-world networks."*

---

## 14. Repository & Deployment Links

- **GitHub Repository**: [https://github.com/sharma930560-lab/eko-ai-worker](https://github.com/sharma930560-lab/eko-ai-worker)
- **Live Frontend**: [https://eko-field-worker.netlify.app](https://eko-field-worker.netlify.app)
- **Production API**: [https://eko-field-worker-api.onrender.com](https://eko-field-worker-api.onrender.com)
- **Health Endpoint**: [https://eko-field-worker-api.onrender.com/api/health](https://eko-field-worker-api.onrender.com/api/health)
- **GitHub Releases Hub**: [https://github.com/sharma930560-lab/eko-ai-worker/releases](https://github.com/sharma930560-lab/eko-ai-worker/releases)
- **Latest Release (v1.1.0)**: [https://github.com/sharma930560-lab/eko-ai-worker/releases/tag/v1.1.0](https://github.com/sharma930560-lab/eko-ai-worker/releases/tag/v1.1.0)
- **Direct APK (v1.1.0)**: [Download app-release.apk (v1.1.0)](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.1.0/app-release.apk)
- **Direct AAB (v1.1.0)**: [Download app-release.aab (v1.1.0)](https://github.com/sharma930560-lab/eko-ai-worker/releases/download/v1.1.0/app-release.aab)
- **Local Release Build**: `android/app/build/outputs/apk/release/app-release.apk`

