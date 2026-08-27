# Eko Micro-Entrepreneur Worker — System Definition

## Goal
Improve the daily business efficiency of a micro-entrepreneur by giving them a simple, local-first AI Worker that helps manage customers, track tasks, write business notes, create offers, and get contextual AI suggestions — all from a low-end mobile phone or laptop, with or without reliable internet.

**Target outcome:** A kirana owner, vegetable vendor, or small wholesaler can close 10-20% more pending payments, reduce missed follow-ups, and spend 15 fewer minutes per day on mental bookkeeping.

---

## User
**Primary:** Micro-entrepreneur in urban, semi-urban, or rural India running a small business (kirana store, vegetable vendor, small wholesaler, tailor, etc.)
- Age: 25–55
- Device: Android phone (low to mid-end), sometimes a shared laptop
- Digital comfort: Low to medium — uses WhatsApp, basic apps
- Languages: Hindi, Hinglish, or local language
- Internet: Unreliable — 2G/3G in semi-urban, patchy WiFi in urban

**Secondary:** Eko field agent helping the entrepreneur set up and use the tool

---

## System

```
[Micro-Entrepreneur Device]
        ↕ (static HTML/JS, works offline after first load)
[Frontend: Eko PWA]
        ↕ (REST API, HTTPS, only when online)
[Backend: FastAPI + SQLite]
        ↕ (ID token only, never raw credentials)
[Google Auth: GIS]
        ↕ (question + business context, no raw PII)
[Gemini AI: gemini-1.5-flash]
```

---

## Workflow States

```
[New User] → [Login] → [Onboarding (5 steps)] → [Home Dashboard]
                ↓                                       ↕
           [Demo Mode] ────────────────────→ [Home Dashboard]
                                                    ↕
                              ┌─────────────────────┴──────────────────┐
                         [Customers]   [Tasks]   [Notes]   [Ask Eko AI]
                              ↓           ↓         ↓            ↓
                         [Add/Update] [Add/Done] [Write]   [Question →
                              ↓                              Response]
                         [Follow-up                       [Failure →
                          Reminder]                       Graceful msg]
```

---

## Inputs
| Input | Source |
|---|---|
| Google ID token | Google Identity Services (frontend) |
| Customer name, phone, type, amount due | Manual entry by user |
| Task title, due date, priority | Manual entry |
| Daily business notes | Text input (voice-to-text via browser in Phase 2) |
| Local offer details | Manual entry |
| Business question | Text input to Ask Eko |
| Business context (customers, tasks, type) | Pulled from local SQLite database |

---

## Outputs
| Output | Description |
|---|---|
| Customer list with follow-up flags | Who to call today |
| Task list filtered by status | What to do next |
| Daily notes log | Business journal |
| Offer cards | Promotions to show customers |
| AI response (Ask Eko) | Contextual business advice in Hinglish/Hindi/English |
| WhatsApp message drafts | Payment reminders, offer announcements |

---

## Decisions the AI Worker Can Make
- Recommend which customers to follow up with today (based on follow_up_date and amount_due)
- Generate WhatsApp message drafts for payment reminders
- Suggest local promotions based on business type and season
- Summarize pending tasks and prioritize them
- Translate or rephrase business notes in another language

## What the AI Worker Does NOT Decide
- Actual payment amounts or financial commitments
- Medical, legal, or regulatory questions → escalates with "consult a professional"
- Anything outside business context → refuses gracefully
- Does not take any autonomous action — all outputs are suggestions, user confirms

---

## Constraints
- No access to microphone or camera (Phase 1)
- No access to contacts or SMS (user manually enters phone numbers)
- No real-time market data (no internet scraping)
- No financial transactions — information only
- PII stays local (see Privacy section)

---

## Device Constraint Design
| Constraint | Design Decision |
|---|---|
| Low-end Android / 2G | Static HTML/CSS/JS — no heavy framework, no React |
| No reliable internet | Service Worker caches app shell; offline banner shown |
| Small screen | Mobile-first bottom nav; no sidebars on mobile |
| Low storage | SQLite (single file); no heavy dependencies |
| Shared device | Session storage only (clears on tab close); no persistent login on shared phones |
| Low digital literacy | Simple icons + text labels; Hinglish option; minimal required fields |

---

## Privacy / DPDP Design
| Data | Decision |
|---|---|
| Customer names, phones | Stored in local SQLite only. Never sent to Eko or any third party. |
| Business notes | Stored locally. Not sent to AI unless user explicitly asks. |
| Questions to Ask Eko | Sent to Gemini API. Business context (aggregated counts, business type) is included — no customer names or phone numbers. |
| Google profile (name, email, photo) | Used for session display. Stored in SQLite with user's sub ID. |
| Location | City-level only (not GPS). Optional. User-entered. |
| No tracking, no analytics | No page view tracking, no usage analytics, no behavioral data collected. |
| PII Redaction | Before sending context to Gemini: customer names replaced with "Customer A/B/C", phone numbers stripped. |

---

## Escalation — When the AI Stops and Asks a Human
1. **Financial amounts are large or unclear** → "Apne accountant se check karein" (Check with your accountant)
2. **Medical or legal question** → "Yeh meri expertise ke bahar hai" (This is outside my expertise)
3. **AI is not confident** → "Mujhe thoda aur information chahiye" (I need more information)
4. **API failure or timeout** → Graceful error message in Hinglish, no crash, no silent failure
5. **Offline** → Explain why AI is unavailable, suggest offline alternatives

---

## Definition of Done
The workflow is complete and acceptable when:
- [x] A user can log in with Google OR try demo in under 30 seconds
- [x] A user can add a customer with follow-up date in under 1 minute
- [x] A user can add and complete a task
- [x] A user can write and save a business note
- [x] A user can ask "Who should I follow up with today?" and get a grounded answer
- [x] The app loads from cache when offline
- [x] An offline banner appears when internet is lost
- [x] "Ask Eko" shows a clear, friendly error when offline or API fails
- [x] No customer PII is sent to Gemini API
- [x] The app works on a 360px wide mobile screen

---

## Intentional Failure Scenarios (Required by Eko Brief)
1. **Offline + Ask Eko** → Banner: "Internet nahi hai. Jab connection aaye tab puchho."
2. **No GEMINI_API_KEY** → Banner: "Eko AI is not available right now. Please add your GEMINI_API_KEY."
3. **Gemini API error/timeout** → Banner: "Kuch technical problem. Thodi der baad try karein."
4. **Add customer with empty name** → Inline form error: "Customer name is required."
5. **Backend not running** → Item list shows: "Could not load data. Is the backend running?"

---

## Success Metrics
| Metric | Target |
|---|---|
| Time to first useful action (add customer) | < 2 minutes from login |
| Follow-up reminder accuracy | User confirms suggestion was correct ≥ 70% of the time |
| AI response helpfulness rating | User thumbs-up ≥ 60% |
| Offline functionality | App loads and shows cached data 100% of the time |
| PII leak to AI | 0 customer phone numbers sent to Gemini API |

---

## What the Current Version Can Do
- Google Sign-In or Demo mode
- Multi-language: English, Hindi, Hinglish
- Add, view, delete customers with follow-up tracking
- Add, complete, delete tasks with priority
- Write and delete daily business notes
- Create local offers
- Ask Eko AI (Gemini 1.5 Flash) business questions with grounded context
- Demo mode with simulated AI responses
- Offline app shell via Service Worker
- Offline indicator banner

## What Remains Human-Led
- Deciding whether to call a customer (AI only suggests)
- Actual payment collection
- Pricing decisions
- Any action in the physical world

## What I Would Improve Next
1. Voice input for notes (browser Web Speech API — free, local)
2. WhatsApp deep link for follow-up messages (one tap to open WhatsApp)
3. IndexedDB offline write queue with sync on reconnect
4. Weekly business summary auto-generated by AI on Sunday
5. Multi-device sync (currently single-device via Docker volume)
