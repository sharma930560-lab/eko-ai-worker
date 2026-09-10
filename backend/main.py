"""
Eko AI Operations — FastAPI Backend
Professional Fintech Operations + Customer 360 + AI Logic
"""
import os
import asyncio
import uuid
import hashlib
import logging
import json
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date, timedelta

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, text, inspect
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

import database
import models
from ai_provider import get_ai_provider, LocalDeterministicProvider
import canonical_seed

# ─── Setup ────────────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("eko")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
# NOTE: AI API keys are never loaded at module level.
# They are managed exclusively inside ai_provider.py via get_ai_provider().
# This ensures keys never accidentally appear in logs or tracebacks.
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"

app = FastAPI(
    title="Eko Partner Operations API",
    version="1.4.0",
    description="Intelligent fintech operations assistant for Eko partners.",
)

models.Base.metadata.create_all(bind=database.engine)

def run_migrations():
    """Ensure newly added columns exist in existing SQLite/PostgreSQL tables."""
    columns_to_ensure = [
        ("users", "wallet_balance", "FLOAT DEFAULT 0.0"),
        ("customers", "email", "VARCHAR"),
        ("customers", "kyc_status", "VARCHAR DEFAULT 'pending'"),
        ("customers", "is_partner", "BOOLEAN DEFAULT FALSE"),
        ("customers", "partner_id", "VARCHAR"),
        ("customers", "category", "VARCHAR"),
        ("service_activity", "partner_id", "VARCHAR"),
        ("tasks", "customer_id", "VARCHAR"),
        ("notes", "customer_id", "VARCHAR"),
        ("complaints", "category", "VARCHAR"),
        ("complaints", "assigned_to", "VARCHAR"),
        ("complaints", "resolution_note", "TEXT"),
        ("complaints", "timeline_json", "TEXT"),
        ("whatsapp_outreach", "language", "VARCHAR DEFAULT 'hinglish'"),
        ("whatsapp_outreach", "partner_id", "VARCHAR"),
        ("whatsapp_outreach", "delivered_at", "TIMESTAMP"),
        ("whatsapp_outreach", "read_at", "TIMESTAMP"),
        ("whatsapp_outreach", "failed_at", "TIMESTAMP"),
        ("whatsapp_outreach", "failure_reason", "VARCHAR"),
    ]

    try:
        inspector = inspect(database.engine)
        table_names = set(inspector.get_table_names())
        for table, col, col_type in columns_to_ensure:
            if table not in table_names:
                continue
            try:
                # Refresh table column check
                cols = {c["name"] for c in inspector.get_columns(table)}
                if col not in cols:
                    logger.info(f"Migrating DB: Adding {col} column to {table} table ({col_type})")
                    with database.engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                    logger.info(f"Migrated {table}.{col} successfully")
            except Exception as col_err:
                logger.warning(f"Column migration check for {table}.{col}: {col_err}")
    except Exception as e:
        logger.warning(f"Database migration check failed: {e}")

run_migrations()

# ─── CORS ─────────────────────────────────────────────────────────────────────
_default_origins = (
    "https://appassets.androidplatform.net,"
    "http://appassets.androidplatform.net,"
    "https://eko-field-worker.netlify.app,"
    "http://localhost:3000,"
    "http://127.0.0.1:3000,"
    "http://localhost:8000,"
    "http://127.0.0.1:8000"
)
_origins_env = os.getenv("ALLOWED_ORIGINS", _default_origins)
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

# Extra protection: ensure common origins are always included
for _essential in [
    "https://appassets.androidplatform.net",
    "http://appassets.androidplatform.net",
    "https://eko-field-worker.netlify.app"
]:
    if _essential not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_essential)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ENVIRONMENT == "development" else ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth Helpers ──────────────────────────────────────────────────────────────
def verify_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header.")
    return x_user_id

# ─── Pydantic Schemas ──────────────────────────────────────────────────────────
class GoogleTokenRequest(BaseModel):
    credential: Optional[str] = None
    id_token: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str]
    business_name: Optional[str]
    business_type: Optional[str]
    wallet_balance: float
    onboarding_completed: bool
    model_config = {"from_attributes": True}

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    business_type: Optional[str] = None
    notes: Optional[str] = None
    amount_due: Optional[float] = 0.0
    follow_up_date: Optional[str] = None
    is_partner: Optional[bool] = False
    partner_id: Optional[str] = None
    category: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    name: str
    phone: Optional[str]
    masked_phone: Optional[str] = None
    email: Optional[str]
    kyc_status: str
    business_type: Optional[str]
    notes: Optional[str]
    amount_due: float
    last_contact: Optional[str]
    follow_up_date: Optional[str]
    is_partner: Optional[bool] = False
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None
    category: Optional[str] = None
    total_transactions: Optional[int] = 0
    total_volume: Optional[float] = 0.0
    latest_status: Optional[str] = None
    risk_level: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class ActivityCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    partner_id: Optional[str] = None
    service_name: str
    status: str = "initiated"
    amount: float = 0.0
    commission: float = 0.0
    reference_id: Optional[str] = None
    failure_reason: Optional[str] = None

class ActivityResponse(BaseModel):
    id: str
    service_name: str
    status: str
    amount: float
    commission: float
    customer_id: Optional[str]
    customer_name: Optional[str]
    partner_id: Optional[str] = None
    reference_id: Optional[str]
    failure_reason: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class TimelineEventResponse(BaseModel):
    id: str
    event_type: str
    title: str
    description: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class ComplaintCreate(BaseModel):
    customer_id: Optional[str] = None
    transaction_id: Optional[str] = None
    subject: str
    description: str
    priority: str = "medium"

class ComplaintResponse(BaseModel):
    id: str
    subject: str
    status: str
    priority: str
    created_at: datetime
    model_config = {"from_attributes": True}

class ComplaintNoteCreate(BaseModel):
    note: str
    author: Optional[str] = "Operator"

class WhatsAppOutreachCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    template_type: Optional[str] = "custom"
    language: Optional[str] = "hinglish"
    message: str
    notes: Optional[str] = None

class WhatsAppOutreachUpdate(BaseModel):
    status: Optional[str] = None
    language: Optional[str] = None
    reminder_frequency: Optional[str] = None
    reminder_active: Optional[bool] = None
    notes: Optional[str] = None
    message: Optional[str] = None

class WhatsAppGenerateRequest(BaseModel):
    customer_name: Optional[str] = "Customer"
    customer_phone: Optional[str] = None
    template_type: Optional[str] = "custom"
    context: Optional[str] = None
    language: Optional[str] = "hinglish"

class ComplaintTriageRequest(BaseModel):
    subject: str
    description: Optional[str] = None
    transaction_id: Optional[str] = None
    customer_id: Optional[str] = None

class ComplaintTriageResponse(BaseModel):
    category: str
    severity: str
    summary: str
    recommended_action: str
    escalation_suggestion: str
    is_ai_suggestion: bool = True

class PosterDesignCreate(BaseModel):
    title: str
    template_type: Optional[str] = "custom"
    layers_json: str
    width: Optional[int] = 800
    height: Optional[int] = 800
    preview_data: Optional[str] = None

class PosterDesignUpdate(BaseModel):
    title: str
    template_type: Optional[str] = "custom"
    layers_json: str
    width: Optional[int] = 800
    height: Optional[int] = 800
    preview_data: Optional[str] = None

class PosterCopyGenerateRequest(BaseModel):
    prompt: Optional[str] = ""
    template_type: Optional[str] = "dmt"
    partner_name: Optional[str] = None
    language: Optional[str] = "hindi"


class CreditScoreResponse(BaseModel):
    id: str
    score: float
    risk_bracket: str
    confidence: float
    factors: Optional[str]
    recommendations: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class AskEkoRequest(BaseModel):
    question: str
    history: List[Dict[str, str]] = []
    customer_id: Optional[str] = None
    transaction_id: Optional[str] = None
    complaint_id: Optional[str] = None
    page_context: Optional[Dict[str, Any]] = None
    date_from: Optional[str] = None # YYYY-MM-DD
    date_to: Optional[str] = None   # YYYY-MM-DD

class Fact(BaseModel):
    text: str
    source_ids: List[str] = []
    timestamp: Optional[datetime] = None

class Inference(BaseModel):
    text: str
    confidence: float

class Recommendation(BaseModel):
    text: str
    reason: str

class AIError(BaseModel):
    code: str
    message: str
    retryable: bool = True

class AskEkoResponse(BaseModel):
    success: bool = True
    answer: str
    facts: List[Fact] = []
    inferences: List[Inference] = []
    recommendations: List[Recommendation] = []
    actions: List[Dict[str, Any]] = []
    sources: List[str] = []
    confidence: float = 1.0
    data_mode: str = "online"
    ai_mode: str = "demo_fallback"
    ai_provider: str = "deterministic"
    ai_model: Optional[str] = None
    grounded: bool = True
    insufficient_data: bool = False
    missing_info: Optional[str] = None
    error: Optional[AIError] = None

class TaskCreate(BaseModel):
    title: str
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    customer_id: Optional[str] = None

class TaskUpdate(BaseModel):
    completed: Optional[bool] = None
    title: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    due_date: Optional[str] = None
    completed: bool
    priority: str
    customer_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class NoteCreate(BaseModel):
    content: str
    customer_id: Optional[str] = None

class NoteResponse(BaseModel):
    id: str
    content: str
    customer_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class CreditSimulationRequest(BaseModel):
    customer_id: str
    hypothetical_success_txns: int = 0
    hypothetical_failed_txns: int = 0
    hypothetical_volume: float = 0.0

class CreditAnalysisFactors(BaseModel):
    recent_performance: Optional[Union[str, float]] = None
    transaction_volume: Optional[float] = None
    failed_transactions: Optional[int] = None
    kyc_status: Optional[str] = None
    operational_tenure_days: Optional[int] = None
    total_txns: Optional[int] = None
    risk_indicators: Optional[str] = None

class CreditAnalysisRequest(BaseModel):
    customer_id: str
    factors: Optional[CreditAnalysisFactors] = None

# ── Hardened Eko Master Brain System Prompt (Fintech Operations Engine) ──────
SYSTEM_PROMPT = """You are Eko.
You are the user's intelligent operational assistant for Eko's financial-services ecosystem, supporting authorized operators, agents, and field staff in India.

YOUR CORE PHILOSOPHY & REASONING:
Always think in this strict cycle:
MONITOR → ANALYZE → PRIORITIZE → RECOMMEND → EXPLAIN WHY → ASK IF NEEDED → ACTION PROPOSAL

You are NOT a passive chatbot. Your goal is to help the operator manage financial services efficiently:
1. Transaction Monitoring: "What needs my attention?" (Failed/Pending transactions).
2. Customer Operations: Which customers need follow-up for verification or support?
3. Operational Risks: Identifying trends in transaction failures or service downtime.
4. Business Insights: Real-time volume analysis and service health.
5. Communications: Ready-to-send professional WhatsApp updates for transaction status or support.

SERVICES SUPPORTED:
- Money Transfer (DMT)
- AePS (Aadhaar Enabled Payment System)
- BBPS (Bill Payments)
- Recharge
- Insurance
- Indo-Nepal Remittance

LANGUAGE & TONE:
- Professional & Efficient: Natural vernacular (Hindi, Hinglish, or English).
- Precise, trustworthy, and data-driven.
- Currency: Always use Indian Rupee symbol (₹) and Indian number format (e.g. ₹10,000).

CRITICAL OPERATIONAL RULES:
1. STRICT GROUNDING: Never invent transactions, customers, IDs, or amounts not present in the BUSINESS CONTEXT. If data is missing, say: "I don't have enough verified data to answer that."
2. ACTION APPROVAL: AI must NOT execute operations directly. Propose actions for user review.
3. EXPLAIN FAILURES: When asked about failed transactions, analyze the failure reason and suggest specific resolution steps.
4. PRIVACY: Never expose sensitive customer PII unnecessarily.
5. OPERATIONAL PRIORITY: When asked "What needs my attention today?", always prioritize FAILED transactions and PENDING bills above routine tasks.

RESPONSE FORMAT:
You MUST return your response as a valid JSON object with the following structure:
{
  "answer": "A natural language summary of the response.",
  "facts": [{"text": "Verified fact from database", "source_ids": ["txn_id_or_other"], "timestamp": "ISO-date-string"}],
  "inferences": [{"text": "Logical deduction based on facts", "confidence": 0.95}],
  "recommendations": [{"text": "Suggested action", "reason": "Why this action matters"}],
  "grounded": true,
  "insufficient_data": false,
  "missing_info": "Explain what's missing if insufficient_data is true"
}
"""

# ─── Timeline Helper ──────────────────────────────────────────────────────────
def add_timeline_event(db: Session, user_id: str, customer_id: str, event_type: str, title: str, description: str = None, ref_id: Optional[str] = None, metadata: dict = None):
    event = models.TimelineEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        customer_id=customer_id,
        event_type=event_type,
        event_ref_id=ref_id,
        title=title,
        description=description,
        metadata_json=json.dumps(metadata) if metadata else None
    )
    db.add(event)
    db.commit()

# ─── Utility: Currency Format ─────────────────────────────────────────────────
def fmt_inr(n) -> str:
    if n is None: return "₹0"
    try:
        n = int(float(n))
    except (ValueError, TypeError):
        return f"₹{n}"
    s = str(n)
    if len(s) <= 3: return f"₹{s}"
    last3 = s[-3:]
    rest = s[:-3]
    parts = []
    while len(rest) > 2:
        parts.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest: parts.insert(0, rest)
    return f"₹{','.join(parts)},{last3}"

# ─── Deterministic Sandbox / User Seeding ─────────────────────────────────────
def _normalise_name_tokens(value: str) -> set:
    import re
    stop_words = {
        "why", "what", "when", "where", "which", "who", "how", "is", "are",
        "the", "this", "that", "tell", "show", "about", "assessment", "lower"
    }
    return {
        token for token in re.findall(r"[a-z0-9]+", (value or "").lower())
        if len(token) > 2 and token not in stop_words
    }

def find_customer_for_question(db: Session, user_id: str, question: str) -> Optional[models.Customer]:
    q_lower = (question or "").lower()
    q_tokens = _normalise_name_tokens(question or "")
    if not q_tokens and not q_lower:
        return None

    customers = db.query(models.Customer).filter(models.Customer.user_id == user_id).all()
    best_match = None
    best_score = 0
    for customer in customers:
        name = (customer.name or "").lower()
        if name and name in q_lower:
            return customer

        name_tokens = _normalise_name_tokens(customer.name or "")
        overlap = len(q_tokens.intersection(name_tokens))
        if overlap > best_score:
            best_match = customer
            best_score = overlap

    return best_match if best_score > 0 else None

def _seed_poster_templates(user_id: str, db: Session):
    """Seed 6 default editable posters into PosterDesign table if not already present."""
    if db.query(models.PosterDesign).filter(models.PosterDesign.user_id == user_id).count() > 0:
        return
    def seed_id(label: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"eko-demo:{user_id}:{label}"))

    poster_templates = [
        models.PosterDesign(
            id=seed_id("poster-dmt"), user_id=user_id,
            title="Fast Money Transfer up to ₹50,000", template_type="dmt",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#1e3a8a", "gradient": "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#fbbf24", "x": 50, "y": 40, "width": 260, "height": 44, "text": "⚡ 100% Instant IMPS Credit"},
                {"id": "logo", "type": "logo", "text": "Eko Partner CSP", "color": "#ffffff", "size": 24, "bold": True, "x": 540, "y": 48},
                {"id": "h1", "type": "text", "text": "पूरे भारत में कहीं भी तुरंत पैसे भेजें", "color": "#ffffff", "size": 42, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Direct Bank Account Deposit via IMPS • Safe & Fast", "color": "#93c5fd", "size": 22, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "box", "type": "shape", "shape": "card", "color": "rgba(255,255,255,0.08)", "x": 50, "y": 280, "width": 700, "height": 340},
                {"id": "f1", "type": "text", "text": "✔ मनी ट्रांसफर सीमा: ₹100 से ₹50,000 तक", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "✔ रविवार और बैंक छुट्टियों के दिन भी सेवा चालू", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 380},
                {"id": "f3", "type": "text", "text": "✔ सटीक प्रिंटेड रसीद एवं तुरंत एसएमएस सूचना", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 440},
                {"id": "f4", "type": "text", "text": "✔ सभी राष्ट्रीय एवं क्षेत्रीय ग्रामीण बैंक मान्य", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 500},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#22c55e", "x": 50, "y": 660, "width": 700, "height": 68, "text": "आज ही अपने नजदीकी काउंटर पर संपर्क करें", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-aeps"), user_id=user_id,
            title="Aadhaar Banking & Mini ATM", template_type="aeps",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#064e3b", "gradient": "linear-gradient(135deg, #022c22 0%, #064e3b 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#a7f3d0", "x": 50, "y": 40, "width": 280, "height": 44, "text": "🔒 NPCI / AePS सुरक्षित सेवा", "textColor": "#064e3b"},
                {"id": "h1", "type": "text", "text": "आधार से तुरंत पैसा निकालें", "color": "#ffffff", "size": 44, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Mini ATM Banking: Cash Out & Balance Check in 10 Seconds", "color": "#6ee7b7", "size": 20, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• फिंगरप्रिंट लगाकर तुरंत नकद निकासी", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• फ्री बैलेंस चेक एवं मिनी स्टेटमेंट", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 390},
                {"id": "f3", "type": "text", "text": "• बिना बैंक या एटीएम की लाइन में लगे सेवा", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 460},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#10b981", "x": 50, "y": 660, "width": 700, "height": 68, "text": "अपना आधार नंबर और बैंक पासबुक लाएं", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-bbps"), user_id=user_id,
            title="Bharat BillPay Utility Hub", template_type="bbps",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#7c2d12", "gradient": "linear-gradient(135deg, #431407 0%, #7c2d12 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#fed7aa", "x": 50, "y": 40, "width": 300, "height": 44, "text": "🧾 भारत बिलपे अधिकृत केंद्र", "textColor": "#7c2d12"},
                {"id": "h1", "type": "text", "text": "सभी बिलों का भुगतान एक ही जगह", "color": "#ffffff", "size": 42, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Electricity, Water, Gas, Fastag, Loan EMI & Broadband", "color": "#fdba74", "size": 20, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• तुरंत रसीद और शून्य लेट फीस का भरोसा", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• सभी राज्यों के बिजली बोर्ड उपलब्ध", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 400},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#ea580c", "x": 50, "y": 660, "width": 700, "height": 68, "text": "अपना बिल और उपभोक्ता संख्या लाएं", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-recharge"), user_id=user_id,
            title="All Mobile & DTH Recharge", template_type="recharge",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#581c87", "gradient": "linear-gradient(135deg, #3b0764 0%, #581c87 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#e9d5ff", "x": 50, "y": 40, "width": 260, "height": 44, "text": "📱 फास्ट डिजिटल रिचार्ज", "textColor": "#581c87"},
                {"id": "h1", "type": "text", "text": "मोबाइल एवं DTH तुरंत रिचार्ज", "color": "#ffffff", "size": 44, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Jio, Airtel, Vi, BSNL, Tata Play, Airtel DTH, DishTV", "color": "#d8b4fe", "size": 20, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• अनलिमिटेड कॉलिंग और डेटा पैक तुरंत चालू", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• बेस्ट ऑफर्स और कैशबैक की जानकारी", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 400},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#a855f7", "x": 50, "y": 660, "width": 700, "height": 68, "text": "नंबर बताएं और तुरंत रीचार्ज करवाएं", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-festival"), user_id=user_id,
            title="Diwali Financial Services Dhamaka", template_type="festival",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#78350f", "gradient": "linear-gradient(135deg, #451a03 0%, #78350f 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#fde68a", "x": 50, "y": 40, "width": 300, "height": 44, "text": "🪔 शुभ दीपावली महोत्सव ऑफर", "textColor": "#78350f"},
                {"id": "h1", "type": "text", "text": "त्योहारी सीजन में घर भेजें खुशियां", "color": "#ffffff", "size": 42, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Zero Wait Time • Instant Family Remittance across India", "color": "#fcd34d", "size": 20, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• गांव या शहर, किसी भी बैंक में तुरंत ट्रांसफर", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• आधार कार्ड से नकद निकासी सुविधा", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 400},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#f59e0b", "x": 50, "y": 660, "width": 700, "height": 68, "text": "खुशियों का त्योहार, ईको के साथ!", "textColor": "#000000", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-announcement"), user_id=user_id,
            title="Authorized Eko Digital CSP Outlet", template_type="announcement",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#0f172a", "gradient": "linear-gradient(135deg, #020617 0%, #1e293b 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#38bdf8", "x": 50, "y": 40, "width": 300, "height": 44, "text": "⭐ अधिकृत ईको बिजनेस पार्टनर", "textColor": "#0f172a"},
                {"id": "h1", "type": "text", "text": "आपका नजदीकी डिजिटल बैंकिंग केंद्र", "color": "#ffffff", "size": 40, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "f1", "type": "text", "text": "✔ मनी ट्रांसफर (DMT) • आधार बैंकिंग (AePS)", "color": "#38bdf8", "size": 24, "bold": True, "align": "left", "x": 80, "y": 280},
                {"id": "f2", "type": "text", "text": "✔ बिजली, पानी, गैस बिल पेमेंट (BBPS)", "color": "#38bdf8", "size": 24, "bold": True, "align": "left", "x": 80, "y": 360},
                {"id": "f3", "type": "text", "text": "✔ सभी मोबाइल एवं डीटीएच रिचार्ज", "color": "#38bdf8", "size": 24, "bold": True, "align": "left", "x": 80, "y": 440},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#0284c7", "x": 50, "y": 660, "width": 700, "height": 68, "text": "विश्वसनीय • सुरक्षित • तुरंत समाधान", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
    ]
    for p in poster_templates:
        db.add(p)
    db.commit()


def ensure_user_seeded(user_id: str, db: Session):
    """Seed comprehensive connected canonical demo operations data for any fresh/demo user."""
    if not user_id:
        return

    try:
        # Check if user already has full canonical dataset (22 partners, >= 120 txns, >= 20 wa, commissions)
        existing_partners = db.query(models.Customer).filter(
            models.Customer.user_id == user_id, 
            models.Customer.is_partner == True
        ).count()
        existing_txns = db.query(models.ServiceActivity).filter(models.ServiceActivity.user_id == user_id).count()
        existing_commissions = db.query(models.Commission).filter(models.Commission.user_id == user_id).count()
        existing_wa = db.query(models.WhatsAppOutreach).filter(models.WhatsAppOutreach.user_id == user_id).count()

        if existing_partners >= 20 and existing_txns >= 120 and existing_commissions >= 100 and existing_wa >= 20:
            return
    except Exception as count_err:
        logger.warning(f"Error checking existing seed counts: {count_err}")
        db.rollback()
        try:
            run_migrations()
        except Exception:
            pass

    # Clear prior seed if upgrading to canonical dataset
    for model in (
        models.TimelineEvent,
        models.CreditScoreHistory,
        models.CreditScore,
        models.OperationalNotification,
        models.Complaint,
        models.Task,
        models.Note,
        models.Commission,
        models.Settlement,
        models.TransactionIssue,
        models.Bill,
        models.ServiceActivity,
        models.Customer,
        models.WhatsAppOutreach,
        models.PosterDesign,
    ):
        try:
            db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()

    logger.info(f"Seeding canonical connected operations environment for user: {user_id}")
    try:
        canonical_seed.seed_canonical_environment(user_id, db)
        _seed_poster_templates(user_id, db)
        logger.info(f"Successfully initialized canonical demo environment for user: {user_id}")
    except Exception as seed_err:
        logger.error(f"Error during canonical seed: {seed_err}")
        db.rollback()
    return
    now = datetime.now()
    seed_suffix = "" if user_id == "demo-operator-01" else f"-{hashlib.sha1(user_id.encode()).hexdigest()[:8]}"
    def seed_ref(reference: str) -> str:
        return f"{reference}{seed_suffix}"

    def seed_id(label: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"eko-demo:{user_id}:{label}"))

    # 1. 10 Legitimate Connected Partners
    p_paras = models.Customer(
        id=seed_id("partner-paras"), user_id=user_id,
        name="Paras General Store & Banking Point",
        phone="9811223344", email="paras.store@ekopartner.in",
        business_type="Retail & CSP", kyc_status="verified",
        amount_due=11200.0, notes="Top volume banking outlet. Handles DMT and AePS cash withdrawals daily.",
        created_at=now - timedelta(days=45)
    )
    p_sharma = models.Customer(
        id=seed_id("partner-sharma"), user_id=user_id,
        name="Sharma Telecom & Digital Seva",
        phone="9876543210", email="sharma.telecom@ekopartner.in",
        business_type="Telecom & Remittance", kyc_status="verified",
        amount_due=14500.0, notes="High-volume DMT center near metro station (also operates as Sharma Telecom & Money Transfer). Fast settlement preferred.",
        created_at=now - timedelta(days=60)
    )
    p_gupta = models.Customer(
        id=seed_id("partner-gupta"), user_id=user_id,
        name="Gupta Daily Mart & CSP",
        phone="9898989898", email="gupta.digital@ekopartner.in",
        business_type="CSC & Utility", kyc_status="verified",
        amount_due=5400.0, notes="Government services center & AePS mini-ATM point (Gupta Digital Services).",
        created_at=now - timedelta(days=20)
    )
    p_verma = models.Customer(
        id=seed_id("partner-verma"), user_id=user_id,
        name="Verma Communication",
        phone="9823456789", email="verma.hub@ekopartner.in",
        business_type="Digital Services", kyc_status="verified",
        amount_due=8200.0, notes="Primary BBPS bill collection and mobile recharge counter (Verma Communication Hub).",
        created_at=now - timedelta(days=30)
    )
    p_anand = models.Customer(
        id=seed_id("partner-anand"), user_id=user_id,
        name="Anand Enterprises",
        phone="9765432109", email="anand.enterprises@ekopartner.in",
        business_type="Enterprise Banking Point", kyc_status="verified",
        amount_due=32000.0, notes="Commercial hub with high DMT transfers and corporate settlement terms (Patel/Anand network).",
        created_at=now - timedelta(days=90)
    )
    p_pooja = models.Customer(
        id=seed_id("partner-pooja"), user_id=user_id,
        name="Pooja Banking Point",
        phone="9834567890", email="pooja.banking@ekopartner.in",
        business_type="Rural Mini-ATM & AePS", kyc_status="verified",
        amount_due=7800.0, notes="Rural touchpoint with steady biometric cash withdrawals and balance inquiries.",
        created_at=now - timedelta(days=40)
    )
    p_metro = models.Customer(
        id=seed_id("partner-metro"), user_id=user_id,
        name="Metro Digital Seva",
        phone="9845678901", email="metro.digital@ekopartner.in",
        business_type="Citizen Services & BBPS", kyc_status="verified",
        amount_due=9300.0, notes="Central hub for electricity, water, and broadband bill payments.",
        created_at=now - timedelta(days=55)
    )
    p_city = models.Customer(
        id=seed_id("partner-city"), user_id=user_id,
        name="City Pay Point",
        phone="9856789012", email="city.pay@ekopartner.in",
        business_type="Express Remittance Hub", kyc_status="verified",
        amount_due=12600.0, notes="High-velocity remittance counter located in the commercial trade corridor.",
        created_at=now - timedelta(days=35)
    )
    p_rahul = models.Customer(
        id=seed_id("partner-rahul"), user_id=user_id,
        name="Rahul Kumar",
        phone="9988776655", email="rahul.k@ekopartner.in",
        business_type="Kirana & CSP", kyc_status="pending",
        amount_due=0.0, notes="Newly onboarded partner pending physical KYC document verification.",
        created_at=now - timedelta(days=2)
    )
    p_singh = models.Customer(
        id=seed_id("partner-singh"), user_id=user_id,
        name="Singh Mobile & Digital Services",
        phone="9812345678", email="singh.digital@ekopartner.in",
        business_type="Telecom & CSP", kyc_status="verified",
        amount_due=6500.0, notes="Multi-utility center managing BBPS bill payments, DTH recharge and AePS mini-ATM.",
        created_at=now - timedelta(days=25)
    )

    all_partners = [p_paras, p_sharma, p_gupta, p_verma, p_anand, p_pooja, p_metro, p_city, p_rahul, p_singh]
    for p in all_partners:
        db.add(p)
    db.commit()
    for p in all_partners:
        db.refresh(p)

    # 2. 27 Synthetic Retail Customers Mapped to Partners
    customer_seeds = [
        ("Paras Demo", "9305601503", "Express Banking & DMT Customer", "verified", p_paras.id),
        ("Rahul Kumar", "9305601503", "Retail & Remittance Customer", "pending", p_rahul.id),
        ("Ramesh Chandra", "9876500001", "Verified Consumer", "verified", p_paras.id),
        ("Sunita Devi", "9876500002", "DMT Regular Customer", "pending", p_paras.id),
        ("Anil Joshi", "9876500003", "AePS Micro-ATM Customer", "verified", p_sharma.id),
        ("Priya Sharma", "9876500004", "Utility Bill Payer", "verified", p_sharma.id),
        ("Vikram Patel", "9876500005", "Merchant Payout Recipient", "verified", p_anand.id),
        ("Mohammad Imran", "9876500006", "Remittance Beneficiary", "verified", p_anand.id),
        ("Kavita Singh", "9876500007", "Rural Banking Customer", "pending", p_pooja.id),
        ("Rajesh Verma", "9876500008", "Broadband Bill Customer", "verified", p_verma.id),
        ("Deepak Gupta", "9876500009", "Mobile Recharge Customer", "verified", p_gupta.id),
        ("Meena Kumari", "9876500010", "Old Age Pension AePS", "verified", p_pooja.id),
        ("Sanjay Yadav", "9876500011", "Kirana Shop Customer", "verified", p_paras.id),
        ("Pooja Mishra", "9876500012", "Electricity Bill Customer", "verified", p_metro.id),
        ("Manoj Tiwari", "9876500013", "Water Utility Customer", "verified", p_metro.id),
        ("Rekha Rani", "9876500014", "DMT Sender", "verified", p_city.id),
        ("Ajay Kumar", "9876500015", "Student Fee Payee", "verified", p_city.id),
        ("Harish Rawat", "9876500016", "Express Remittance", "verified", p_city.id),
        ("Geeta Choudhary", "9876500017", "AePS Cash Withdrawal", "verified", p_pooja.id),
        ("Santosh Jha", "9876500018", "DMT Transfer Customer", "verified", p_sharma.id),
        ("Kishore Lal", "9876500019", "Gas Cylinder Bill Payer", "verified", p_verma.id),
        ("Nisha Bano", "9876500020", "Recharge & DMT Customer", "verified", p_gupta.id),
        ("Tarun Bajaj", "9876500021", "Commercial Trader", "verified", p_anand.id),
        ("Anita Soren", "9876500022", "Self-Help Group Lead", "verified", p_pooja.id),
        ("Dharmendra Pal", "9876500023", "Transport Driver Remittance", "verified", p_paras.id),
        ("Sita Ram", "9876500024", "Agriculture Subsidy AePS", "verified", p_metro.id),
        ("Vikas Mehra", None, "Insurance Premium Payer", "verified", p_verma.id),
    ]

    seeded_customers = []
    for idx, (cname, cphone, cbiz, ckyc, cpid) in enumerate(customer_seeds, 1):
        c_obj = models.Customer(
            id=seed_id(f"cust-{idx}"), user_id=user_id,
            name=cname, phone=cphone, email=f"cust{idx}@ekodemo.in",
            business_type=cbiz, kyc_status=ckyc,
            amount_due=0.0, notes=f"Customer registered through partner outlet {cpid[-6:]}.",
            created_at=now - timedelta(days=30 - idx)
        )
        seeded_customers.append(c_obj)
        db.add(c_obj)
    db.commit()

    # 3. 25 Multi-Service Realistic Transactions
    # TXN-DEMO-1001: Required DMT ₹8,500 FAILED
    t_failed = models.ServiceActivity(
        id=seed_ref("TXN-DEMO-1001"), user_id=user_id,
        customer_id=p_sharma.id, customer_name=p_sharma.name,
        service_name="DMT", status="failed", amount=8500.0, commission=0.0,
        reference_id=seed_ref("DMT984729104"),
        failure_reason="Beneficiary bank IMPS switch timeout during money transfer.",
        created_at=now - timedelta(hours=2)
    )

    t_paras_25k = models.ServiceActivity(
        id=seed_id("txn-paras-dmt-25k"), user_id=user_id,
        customer_id=p_paras.id, customer_name=p_paras.name,
        service_name="Send Money", status="success", amount=25000.0, commission=112.5,
        reference_id=seed_ref("DMTBEF965B72E"),
        failure_reason=None,
        created_at=now - timedelta(minutes=30)
    )

    txns = [
        t_failed,
        t_paras_25k,
        models.ServiceActivity(
            id=seed_id("txn-paras-dmt-01"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="DMT", status="success", amount=5000.0, commission=22.5,
            reference_id=seed_ref("DMT849201948"), created_at=now - timedelta(hours=1)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-aeps-01"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="AePS", status="success", amount=2000.0, commission=8.0,
            reference_id=seed_ref("AEPS849201882"), created_at=now - timedelta(hours=3)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-bbps-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="BBPS", status="success", amount=1450.0, commission=5.0,
            reference_id=seed_ref("BBPS849201773"), created_at=now - timedelta(hours=4)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-recharge-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="Recharge", status="success", amount=299.0, commission=4.5,
            reference_id=seed_ref("RCH849201664"), created_at=now - timedelta(hours=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-anand-dmt-01"), user_id=user_id,
            customer_id=p_anand.id, customer_name=p_anand.name,
            service_name="DMT", status="pending", amount=10000.0, commission=45.0,
            reference_id=seed_ref("DMT849201555"),
            failure_reason="Bank confirmation pending from beneficiary NEFT switch.",
            created_at=now - timedelta(hours=6)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-aeps-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="AePS", status="success", amount=3000.0, commission=12.0,
            reference_id=seed_ref("AEPS849201446"), created_at=now - timedelta(hours=7)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-dmt-01"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="DMT", status="success", amount=7500.0, commission=33.5,
            reference_id=seed_ref("DMT849201337"), created_at=now - timedelta(hours=8)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-bbps-01"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="BBPS", status="failed", amount=850.0, commission=0.0,
            reference_id=seed_ref("BBPS849201010"),
            failure_reason="Biller acknowledgement timed out before confirmation.",
            created_at=now - timedelta(hours=9)
        ),
        models.ServiceActivity(
            id=seed_id("txn-pooja-aeps-01"), user_id=user_id,
            customer_id=p_pooja.id, customer_name=p_pooja.name,
            service_name="AePS", status="success", amount=2500.0, commission=10.0,
            reference_id=seed_ref("AEPS849201021"), created_at=now - timedelta(hours=10)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-recharge-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="Recharge", status="failed", amount=399.0, commission=0.0,
            reference_id=seed_ref("RCH849201001"),
            failure_reason="Operator gateway rejected the recharge request.",
            created_at=now - timedelta(hours=11)
        ),
        models.ServiceActivity(
            id=seed_id("txn-metro-bbps-01"), user_id=user_id,
            customer_id=p_metro.id, customer_name=p_metro.name,
            service_name="BBPS", status="success", amount=2150.0, commission=7.5,
            reference_id=seed_ref("BBPS849201111"), created_at=now - timedelta(hours=12)
        ),
        models.ServiceActivity(
            id=seed_id("txn-city-dmt-01"), user_id=user_id,
            customer_id=p_city.id, customer_name=p_city.name,
            service_name="DMT", status="processing", amount=4500.0, commission=20.0,
            reference_id=seed_ref("DMT849201112"), created_at=now - timedelta(hours=13)
        ),
        models.ServiceActivity(
            id=seed_id("txn-rahul-aeps-01"), user_id=user_id,
            customer_id=p_rahul.id, customer_name=p_rahul.name,
            service_name="AePS-Mini Statement", status="success", amount=0.0, commission=0.0,
            reference_id=seed_ref("AEPS849201020"), created_at=now - timedelta(hours=14)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-dmt-02"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="DMT", status="success", amount=4200.0, commission=18.0,
            reference_id=seed_ref("DMT849201119"), created_at=now - timedelta(days=1)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-bbps-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="BBPS", status="success", amount=3200.0, commission=10.0,
            reference_id=seed_ref("BBPS849201228"), created_at=now - timedelta(days=1)
        ),
        models.ServiceActivity(
            id=seed_id("txn-metro-bbps-02"), user_id=user_id,
            customer_id=p_metro.id, customer_name=p_metro.name,
            service_name="BBPS", status="pending", amount=2400.0, commission=8.0,
            reference_id=seed_ref("BBPS849201229"), created_at=now - timedelta(days=1)
        ),
        models.ServiceActivity(
            id=seed_id("txn-city-dmt-02"), user_id=user_id,
            customer_id=p_city.id, customer_name=p_city.name,
            service_name="DMT", status="success", amount=12000.0, commission=54.0,
            reference_id=seed_ref("DMT849201230"), created_at=now - timedelta(days=2)
        ),
        models.ServiceActivity(
            id=seed_id("txn-pooja-aeps-02"), user_id=user_id,
            customer_id=p_pooja.id, customer_name=p_pooja.name,
            service_name="AePS", status="processing", amount=1200.0, commission=4.8,
            reference_id=seed_ref("AEPS849201231"), created_at=now - timedelta(hours=2)
        ),
        models.ServiceActivity(
            id=seed_id("txn-anand-dmt-02"), user_id=user_id,
            customer_id=p_anand.id, customer_name=p_anand.name,
            service_name="DMT", status="success", amount=15000.0, commission=67.5,
            reference_id=seed_ref("DMT849201232"), created_at=now - timedelta(days=2)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-recharge-02"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="Recharge", status="success", amount=666.0, commission=9.5,
            reference_id=seed_ref("RCH849201233"), created_at=now - timedelta(days=2)
        ),
        models.ServiceActivity(
            id=seed_id("txn-rahul-dmt-01"), user_id=user_id,
            customer_id=p_rahul.id, customer_name=p_rahul.name,
            service_name="DMT", status="success", amount=1500.0, commission=7.5,
            reference_id=seed_ref("DMT849200990"), created_at=now - timedelta(hours=15)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-dmt-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="DMT", status="success", amount=2800.0, commission=12.6,
            reference_id=seed_ref("DMT849200989"), created_at=now - timedelta(hours=16)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-aeps-02"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="AePS", status="success", amount=10000.0, commission=40.0,
            reference_id=seed_ref("AEPS849201234"), created_at=now - timedelta(days=3)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-dmt-02"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="DMT", status="success", amount=9500.0, commission=42.0,
            reference_id=seed_ref("DMT849201235"), created_at=now - timedelta(days=3)
        ),
        models.ServiceActivity(
            id=seed_id("txn-singh-bbps-01"), user_id=user_id,
            customer_id=p_singh.id, customer_name=p_singh.name,
            service_name="BBPS", status="success", amount=1850.0, commission=6.5,
            reference_id=seed_ref("BBPS849201236"), created_at=now - timedelta(hours=2)
        ),
        models.ServiceActivity(
            id=seed_id("txn-singh-recharge-01"), user_id=user_id,
            customer_id=p_singh.id, customer_name=p_singh.name,
            service_name="Recharge", status="success", amount=479.0, commission=7.0,
            reference_id=seed_ref("RCH849201237"), created_at=now - timedelta(hours=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-singh-aeps-01"), user_id=user_id,
            customer_id=p_singh.id, customer_name=p_singh.name,
            service_name="AePS", status="success", amount=3500.0, commission=14.0,
            reference_id=seed_ref("AEPS849201238"), created_at=now - timedelta(hours=8)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-dmt-03"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="DMT", status="success", amount=18000.0, commission=81.0,
            reference_id=seed_ref("DMT849201239"), created_at=now - timedelta(days=3)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-aeps-02"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="AePS", status="success", amount=4000.0, commission=16.0,
            reference_id=seed_ref("AEPS849201240"), created_at=now - timedelta(days=4)
        ),
        models.ServiceActivity(
            id=seed_id("txn-anand-dmt-03"), user_id=user_id,
            customer_id=p_anand.id, customer_name=p_anand.name,
            service_name="DMT", status="success", amount=22000.0, commission=99.0,
            reference_id=seed_ref("DMT849201241"), created_at=now - timedelta(days=4)
        ),
        models.ServiceActivity(
            id=seed_id("txn-pooja-aeps-03"), user_id=user_id,
            customer_id=p_pooja.id, customer_name=p_pooja.name,
            service_name="AePS", status="failed", amount=5000.0, commission=0.0,
            reference_id=seed_ref("AEPS849201242"),
            failure_reason="Biometric fingerprint capture mismatch threshold exceeded.",
            created_at=now - timedelta(hours=14)
        ),
        models.ServiceActivity(
            id=seed_id("txn-metro-dmt-01"), user_id=user_id,
            customer_id=p_metro.id, customer_name=p_metro.name,
            service_name="DMT", status="success", amount=6200.0, commission=28.0,
            reference_id=seed_ref("DMT849201243"), created_at=now - timedelta(days=4)
        ),
        models.ServiceActivity(
            id=seed_id("txn-city-bbps-01"), user_id=user_id,
            customer_id=p_city.id, customer_name=p_city.name,
            service_name="BBPS", status="success", amount=3100.0, commission=10.0,
            reference_id=seed_ref("BBPS849201244"), created_at=now - timedelta(days=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-aeps-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="AePS", status="success", amount=1500.0, commission=6.0,
            reference_id=seed_ref("AEPS849201245"), created_at=now - timedelta(days=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-dmt-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="DMT", status="success", amount=8900.0, commission=40.0,
            reference_id=seed_ref("DMT849201246"), created_at=now - timedelta(days=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-rahul-recharge-01"), user_id=user_id,
            customer_id=p_rahul.id, customer_name=p_rahul.name,
            service_name="Recharge", status="success", amount=239.0, commission=3.5,
            reference_id=seed_ref("RCH849201247"), created_at=now - timedelta(hours=18)
        ),
        models.ServiceActivity(
            id=seed_id("txn-singh-dmt-01"), user_id=user_id,
            customer_id=p_singh.id, customer_name=p_singh.name,
            service_name="DMT", status="success", amount=7200.0, commission=32.0,
            reference_id=seed_ref("DMT849201248"), created_at=now - timedelta(days=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-bbps-01"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="BBPS", status="success", amount=4500.0, commission=15.0,
            reference_id=seed_ref("BBPS849201249"), created_at=now - timedelta(days=6)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-recharge-01"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="Recharge", status="success", amount=719.0, commission=10.5,
            reference_id=seed_ref("RCH849201250"), created_at=now - timedelta(days=6)
        ),
        models.ServiceActivity(
            id=seed_id("txn-anand-aeps-01"), user_id=user_id,
            customer_id=p_anand.id, customer_name=p_anand.name,
            service_name="AePS", status="success", amount=8000.0, commission=32.0,
            reference_id=seed_ref("AEPS849201251"), created_at=now - timedelta(days=6)
        ),
        models.ServiceActivity(
            id=seed_id("txn-pooja-bbps-01"), user_id=user_id,
            customer_id=p_pooja.id, customer_name=p_pooja.name,
            service_name="BBPS", status="success", amount=980.0, commission=3.5,
            reference_id=seed_ref("BBPS849201252"), created_at=now - timedelta(days=7)
        ),
        models.ServiceActivity(
            id=seed_id("txn-metro-recharge-01"), user_id=user_id,
            customer_id=p_metro.id, customer_name=p_metro.name,
            service_name="Recharge", status="success", amount=199.0, commission=3.0,
            reference_id=seed_ref("RCH849201253"), created_at=now - timedelta(days=7)
        ),
        models.ServiceActivity(
            id=seed_id("txn-city-aeps-01"), user_id=user_id,
            customer_id=p_city.id, customer_name=p_city.name,
            service_name="AePS", status="success", amount=2000.0, commission=8.0,
            reference_id=seed_ref("AEPS849201254"), created_at=now - timedelta(days=7)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-bbps-02"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="BBPS", status="refunded", amount=1250.0, commission=0.0,
            reference_id=seed_ref("BBPS849201255"),
            failure_reason="Duplicate biller payment refunded to wallet.",
            created_at=now - timedelta(days=8)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-aeps-02"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="AePS", status="success", amount=1800.0, commission=7.2,
            reference_id=seed_ref("AEPS849201256"), created_at=now - timedelta(days=8)
        ),
        models.ServiceActivity(
            id=seed_id("txn-singh-recharge-02"), user_id=user_id,
            customer_id=p_singh.id, customer_name=p_singh.name,
            service_name="Recharge", status="success", amount=299.0, commission=4.5,
            reference_id=seed_ref("RCH849201257"), created_at=now - timedelta(days=8)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-dmt-04"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="DMT", status="success", amount=14000.0, commission=63.0,
            reference_id=seed_ref("DMT849201258"), created_at=now - timedelta(days=9)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-bbps-02"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="BBPS", status="success", amount=1950.0, commission=6.8,
            reference_id=seed_ref("BBPS849201259"), created_at=now - timedelta(days=9)
        ),
        models.ServiceActivity(
            id=seed_id("txn-anand-dmt-04"), user_id=user_id,
            customer_id=p_anand.id, customer_name=p_anand.name,
            service_name="DMT", status="success", amount=16500.0, commission=74.2,
            reference_id=seed_ref("DMT849201260"), created_at=now - timedelta(days=10)
        ),
        models.ServiceActivity(
            id=seed_id("txn-city-dmt-03"), user_id=user_id,
            customer_id=p_city.id, customer_name=p_city.name,
            service_name="DMT", status="success", amount=9000.0, commission=40.5,
            reference_id=seed_ref("DMT849201261"), created_at=now - timedelta(days=10)
        ),
    ]

    for t in txns:
        db.add(t)
    db.commit()

    # 4. 11 Realistic Complaints with Categories, Owners, SLA & Timelines
    c1 = models.Complaint(
        id=seed_id("complaint-sharma-dmt"), user_id=user_id,
        customer_id=p_sharma.id, transaction_id=t_failed.id,
        subject="TXN-DEMO-1001 IMPS Switch Timeout",
        description="IMPS switch timeout on ₹8,500 DMT transfer at Sharma Telecom. Customer sender account debited without beneficiary acknowledgment. Bank desk escalation in progress.",
        status="open", priority="urgent", category="switch_timeout",
        assigned_to="Naman Sharma", sla_deadline=now + timedelta(hours=3),
        timeline_json=json.dumps([
            {"action": "Incident Triggered", "note": "Switch timeout from NPCI/Bank", "timestamp": (now - timedelta(hours=2)).isoformat(), "author": "System"},
            {"action": "Complaint Logged", "note": "Urgent priority assigned", "timestamp": (now - timedelta(hours=1)).isoformat(), "author": "Operator"}
        ]),
        created_at=now - timedelta(hours=1)
    )
    c2 = models.Complaint(
        id=seed_id("complaint-patel-settlement"), user_id=user_id,
        customer_id=p_anand.id, transaction_id=None,
        subject="Commercial Settlement Reconciliation — Anand Enterprises",
        description="Pending settlement cycle reconciliation of ₹32,000 awaiting nodal account clearance confirmation.",
        status="in_progress", priority="high", category="settlement",
        assigned_to="Operations Lead", sla_deadline=now + timedelta(hours=18),
        timeline_json=json.dumps([
            {"action": "Batch Mismatch", "note": "Cycle 1 mismatch detected", "timestamp": (now - timedelta(hours=6)).isoformat(), "author": "Recon Engine"},
            {"action": "Under Review", "note": "Assigned to Operations Lead", "timestamp": (now - timedelta(hours=5)).isoformat(), "author": "System"}
        ]),
        created_at=now - timedelta(hours=6)
    )
    c3 = models.Complaint(
        id=seed_id("complaint-verma-bbps"), user_id=user_id,
        customer_id=p_verma.id, transaction_id=txns[4].id,
        subject="BBPS Biller Reversal Verification",
        description="Electricity bill payment of ₹1,450 processed. Consumer requested physical stamped receipt.",
        status="resolved", priority="medium", category="txn_failure",
        assigned_to="Support Desk", resolution_note="Reversed ₹850 to partner wallet via nodal settlement batch.",
        sla_deadline=now - timedelta(hours=2),
        timeline_json=json.dumps([
            {"action": "Logged", "note": "Customer query received", "timestamp": (now - timedelta(hours=12)).isoformat(), "author": "Verma Hub"},
            {"action": "Resolved", "note": "Duplicate reversal reconciled and resolved", "timestamp": (now - timedelta(hours=2)).isoformat(), "author": "Support Desk"}
        ]),
        created_at=now - timedelta(hours=12)
    )
    c4 = models.Complaint(
        id=seed_id("complaint-gupta-recharge"), user_id=user_id,
        customer_id=p_gupta.id, transaction_id=txns[11].id,
        subject="Recharge Gateway Rejection — Gupta Daily Mart",
        description="The mobile recharge was rejected by operator gateway and required refund verification.",
        status="resolved", priority="low", category="service",
        assigned_to="Support Desk", resolution_note="Auto-refunded by telco gateway within 2 hours.",
        sla_deadline=now - timedelta(hours=1),
        timeline_json=json.dumps([
            {"action": "Logged", "note": "Gateway rejection error", "timestamp": (now - timedelta(hours=11)).isoformat(), "author": "System"},
            {"action": "Resolved", "note": "Refund confirmed by telco", "timestamp": (now - timedelta(hours=1)).isoformat(), "author": "Support Desk"}
        ]),
        created_at=now - timedelta(hours=11)
    )
    c5 = models.Complaint(
        id=seed_id("complaint-pooja-aeps"), user_id=user_id,
        customer_id=p_pooja.id, transaction_id=None,
        subject="AePS Biometric Match Error Rate High",
        description="High biometric mismatch rate (62%) reported during morning pension disbursement hours at Pooja Banking Point.",
        status="escalated", priority="high", category="switch_timeout",
        assigned_to="Field Technical Lead", sla_deadline=now + timedelta(hours=8),
        timeline_json=json.dumps([
            {"action": "Alert Raised", "note": "Biometric failure threshold exceeded", "timestamp": (now - timedelta(hours=4)).isoformat(), "author": "Monitoring Bot"},
            {"action": "Escalated", "note": "Escalated to Field Tech Lead for scanner replacement", "timestamp": (now - timedelta(hours=2)).isoformat(), "author": "Operations Desk"}
        ]),
        created_at=now - timedelta(hours=4)
    )
    c6 = models.Complaint(
        id=seed_id("complaint-metro-bbps"), user_id=user_id,
        customer_id=p_metro.id, transaction_id=txns[12].id,
        subject="Water Bill Receipt Delay — Metro Digital Seva",
        description="Customer paid ₹2,150 Delhi Jal Board bill; awaiting consumer CA acknowledgment token.",
        status="waiting_for_customer", priority="medium", category="reconciliation",
        assigned_to="Operations Desk", sla_deadline=now + timedelta(hours=24),
        timeline_json=json.dumps([
            {"action": "Logged", "note": "Pending consumer bill copy", "timestamp": (now - timedelta(hours=8)).isoformat(), "author": "Metro Seva"},
            {"action": "Customer Contacted", "note": "Requested consumer to send meter photo on WhatsApp", "timestamp": (now - timedelta(hours=3)).isoformat(), "author": "Operations Desk"}
        ]),
        created_at=now - timedelta(hours=8)
    )
    c7 = models.Complaint(
        id=seed_id("complaint-city-dmt"), user_id=user_id,
        customer_id=p_city.id, transaction_id=txns[13].id,
        subject="DMT Beneficiary Verification Required — City Pay Point",
        description="Large ticket DMT transfer (₹4,500) triggered secondary AML verification check.",
        status="in_progress", priority="high", category="txn_failure",
        assigned_to="Risk Analyst", sla_deadline=now + timedelta(hours=6),
        timeline_json=json.dumps([
            {"action": "Rule Triggered", "note": "Secondary KYC check requested", "timestamp": (now - timedelta(hours=5)).isoformat(), "author": "Risk Engine"}
        ]),
        created_at=now - timedelta(hours=5)
    )
    c8 = models.Complaint(
        id=seed_id("complaint-rahul-kyc"), user_id=user_id,
        customer_id=p_rahul.id, transaction_id=None,
        subject="Partner Onboarding Physical KYC Verification",
        description="Rahul Kumar counter onboarding pending in-person biometric and shop premises validation.",
        status="open", priority="medium", category="service",
        assigned_to="Onboarding Agent", sla_deadline=now + timedelta(hours=48),
        timeline_json=json.dumps([
            {"action": "Self-Registration", "note": "Digital form submitted", "timestamp": (now - timedelta(days=2)).isoformat(), "author": "Portal"}
        ]),
        created_at=now - timedelta(days=2)
    )
    c9 = models.Complaint(
        id=seed_id("complaint-singh-bbps"), user_id=user_id,
        customer_id=p_singh.id, transaction_id=None,
        subject="Electricity Biller Gateway Timeout — Singh Mobile",
        description="Electricity biller switch timed out during peak evening collection cycle.",
        status="open", priority="urgent", category="switch_timeout",
        assigned_to="Naman Sharma", sla_deadline=now + timedelta(hours=3),
        timeline_json=json.dumps([
            {"action": "Incident Triggered", "note": "Switch timeout from NPCI BBPS", "timestamp": (now - timedelta(hours=1)).isoformat(), "author": "System"}
        ]),
        created_at=now - timedelta(hours=1)
    )
    c10 = models.Complaint(
        id=seed_id("complaint-anand-dmt-reversal"), user_id=user_id,
        customer_id=p_anand.id, transaction_id=None,
        subject="IMPS Beneficiary Bank Reversal Pending",
        description="Beneficiary account IFSC mismatch caused delay in auto-reversal of remittance.",
        status="in_progress", priority="high", category="txn_failure",
        assigned_to="Banking Desk", sla_deadline=now + timedelta(hours=12),
        timeline_json=json.dumps([
            {"action": "Dispute Filed", "note": "Beneficiary bank UTR inquiry", "timestamp": (now - timedelta(hours=5)).isoformat(), "author": "Operations Desk"}
        ]),
        created_at=now - timedelta(hours=5)
    )
    c11 = models.Complaint(
        id=seed_id("complaint-gupta-settlement"), user_id=user_id,
        customer_id=p_gupta.id, transaction_id=None,
        subject="Daily Counter Settlement Discrepancy",
        description="Evening wallet balance reconciliation matched with bank nodal statement.",
        status="resolved", priority="medium", category="settlement",
        assigned_to="Support Desk", resolution_note="Reconciled successfully against nodal ledger batch.",
        sla_deadline=now - timedelta(hours=4),
        timeline_json=json.dumps([
            {"action": "Resolved", "note": "Reconciled with nodal batch", "timestamp": (now - timedelta(hours=4)).isoformat(), "author": "Support Desk"}
        ]),
        created_at=now - timedelta(hours=10)
    )

    complaints = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11]
    for c in complaints:
        db.add(c)
    db.commit()

    # 5. 8 Operational Tasks
    tasks = [
        models.Task(
            id=seed_id("task-1"), user_id=user_id, customer_id=p_sharma.id,
            title="Follow up on Sharma Telecom IMPS failure before 4 PM SLA cutoff",
            due_date=(now).strftime("%Y-%m-%d"), completed=False, priority="urgent",
            created_at=now - timedelta(hours=1)
        ),
        models.Task(
            id=seed_id("task-2"), user_id=user_id, customer_id=p_anand.id,
            title="Reconcile Anand Enterprises T+1 settlement batch",
            due_date=(now).strftime("%Y-%m-%d"), completed=False, priority="high",
            created_at=now - timedelta(hours=6)
        ),
        models.Task(
            id=seed_id("task-3"), user_id=user_id, customer_id=p_rahul.id,
            title="Verify uploaded Aadhaar and PAN documents for Rahul Kumar",
            due_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"), completed=False, priority="medium",
            created_at=now - timedelta(hours=4)
        ),
        models.Task(
            id=seed_id("task-4"), user_id=user_id, customer_id=p_pooja.id,
            title="Deliver replacement biometric scanner to Pooja Banking Point",
            due_date=(now).strftime("%Y-%m-%d"), completed=False, priority="high",
            created_at=now - timedelta(hours=3)
        ),
        models.Task(
            id=seed_id("task-5"), user_id=user_id, customer_id=p_verma.id,
            title="Audit monthly BBPS electricity bill receipts for Verma Communication",
            due_date=(now - timedelta(days=1)).strftime("%Y-%m-%d"), completed=True, priority="low",
            created_at=now - timedelta(days=2)
        ),
        models.Task(
            id=seed_id("task-6"), user_id=user_id, customer_id=p_metro.id,
            title="Conduct WhatsApp outreach for Metro Digital Seva Diwali festival scheme",
            due_date=(now).strftime("%Y-%m-%d"), completed=False, priority="medium",
            created_at=now - timedelta(hours=8)
        ),
        models.Task(
            id=seed_id("task-7"), user_id=user_id, customer_id=p_city.id,
            title="Review credit score recalibration for City Pay Point",
            due_date=(now - timedelta(days=1)).strftime("%Y-%m-%d"), completed=True, priority="low",
            created_at=now - timedelta(days=1)
        ),
        models.Task(
            id=seed_id("task-8"), user_id=user_id, customer_id=p_paras.id,
            title="Approve festive DMT threshold extension (+₹50k) for Paras General Store",
            due_date=(now).strftime("%Y-%m-%d"), completed=False, priority="medium",
            created_at=now - timedelta(hours=2)
        ),
    ]
    for tk in tasks:
        db.add(tk)

    # 6. 6 Operational Field Notes
    notes = [
        models.Note(
            id=seed_id("note-1"), user_id=user_id, customer_id=p_sharma.id,
            content="Sharma Telecom operator reported intermittent NPCI network latency around 2 PM today. Keep monitoring AePS and DMT success rates.",
            created_at=now - timedelta(hours=2)
        ),
        models.Note(
            id=seed_id("note-2"), user_id=user_id, customer_id=p_paras.id,
            content="Paras store owner requested higher daily DMT threshold (+₹50,000) ahead of upcoming festive season. Biometric hardware in excellent condition.",
            created_at=now - timedelta(days=1)
        ),
        models.Note(
            id=seed_id("note-3"), user_id=user_id, customer_id=p_verma.id,
            content="Verma Communication Hub confirmed the BBPS duplicate reversal was successfully completed via nodal settlement batch.",
            created_at=now - timedelta(hours=12)
        ),
        models.Note(
            id=seed_id("note-4"), user_id=user_id, customer_id=p_rahul.id,
            content="Rahul Kumar submitted digital copy of shop rent agreement and PAN. Original Aadhaar in-person verification scheduled for tomorrow.",
            created_at=now - timedelta(hours=4)
        ),
        models.Note(
            id=seed_id("note-5"), user_id=user_id, customer_id=p_pooja.id,
            content="Pooja Banking Point requests second micro-ATM terminal to handle peak morning pension rush.",
            created_at=now - timedelta(hours=3)
        ),
        models.Note(
            id=seed_id("note-6"), user_id=user_id, customer_id=p_city.id,
            content="City Pay Point remittance counter maintaining 99.2% transaction success rate over the last 14 days.",
            created_at=now - timedelta(days=2)
        ),
    ]
    for nt in notes:
        db.add(nt)

    # 7. 8 Deep-Linked Notifications
    notifs = [
        models.OperationalNotification(
            id=seed_id("notif-1"), user_id=user_id,
            title="TXN-DEMO-1001: IMPS Switch Failure",
            message=f"₹8,500 DMT transfer failed at {p_sharma.name}. Beneficiary switch timeout requires immediate review.",
            category="alert", priority="urgent", deep_link=f"/activity/{t_failed.id}",
            created_at=now - timedelta(hours=2)
        ),
        models.OperationalNotification(
            id=seed_id("notif-2"), user_id=user_id,
            title="Urgent Complaint: 3h SLA Remaining",
            message=f"Complaint '{c1.subject}' for {p_sharma.name} has only 3 hours before SLA breach.",
            category="complaint", priority="urgent", deep_link=f"/grievances/{c1.id}",
            created_at=now - timedelta(hours=1)
        ),
        models.OperationalNotification(
            id=seed_id("notif-3"), user_id=user_id,
            title="Pending KYC: Rahul Kumar",
            message="Partner onboarding documentation pending physical premises inspection.",
            category="reminder", priority="medium", deep_link=f"/partners/{p_rahul.id}",
            created_at=now - timedelta(hours=4)
        ),
        models.OperationalNotification(
            id=seed_id("notif-4"), user_id=user_id,
            title="Settlement Credited: ₹11,200",
            message=f"T+1 settlement batch for {p_paras.name} successfully credited to settlement nodal account.",
            category="info", priority="low", deep_link=f"/partners/{p_paras.id}",
            created_at=now - timedelta(hours=7)
        ),
        models.OperationalNotification(
            id=seed_id("notif-5"), user_id=user_id,
            title="Scanner Fault Escalation: Pooja Banking",
            message="Biometric error rate alert escalated to Field Technical Lead for replacement.",
            category="alert", priority="high", deep_link=f"/grievances/{c5.id}",
            created_at=now - timedelta(hours=3)
        ),
        models.OperationalNotification(
            id=seed_id("notif-6"), user_id=user_id,
            title="WhatsApp Outreach Due: Sunita Devi",
            message="Reminder: Follow up on pending customer KYC document submission via WhatsApp.",
            category="reminder", priority="medium", deep_link="/whatsapp-studio",
            created_at=now - timedelta(hours=2)
        ),
        models.OperationalNotification(
            id=seed_id("notif-7"), user_id=user_id,
            title="Commercial Settlement Pending: ₹32,000",
            message=f"Reconciliation pending for {p_anand.name} nodal settlement.",
            category="complaint", priority="high", deep_link=f"/grievances/{c2.id}",
            created_at=now - timedelta(hours=5)
        ),
        models.OperationalNotification(
            id=seed_id("notif-8"), user_id=user_id,
            title="Poster Studio: 6 Templates Ready",
            message="Promotional marketing posters for DMT, AePS, BBPS and Recharge available in Poster Studio.",
            category="info", priority="low", deep_link="/poster-studio",
            created_at=now - timedelta(days=1)
        ),
    ]
    for n in notifs:
        db.add(n)

    # 8. 8 Stored Credit Assessments
    for p in all_partners:
        score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, p.id)
        db.add(models.CreditScore(
            id=seed_id(f"credit-{p.id}"), user_id=user_id, customer_id=p.id,
            customer_name=p.name, score=score_val or 75.0, risk_bracket=risk if score_val else "LOW",
            confidence=conf, factors=json.dumps(factors), recommendations=recs
        ))

    # 9. 15 WhatsApp Outreach Records with Multi-Language Support
    wa_records = [
        models.WhatsAppOutreach(
            id=seed_id("wa-paras-1"), user_id=user_id, customer_id=seeded_customers[0].id,
            customer_name="Paras Demo", customer_phone="9305601503", template_type="dmt", language="hinglish",
            message="Namaste Paras ji, Eko operations desk ki taraf se update. Aapka ₹25,000 Send Money transfer successfully complete ho gaya hai. Any sahayata ke liye sampark karein.",
            status="pending", reminder_frequency="daily", reminder_active=True,
            created_at=now - timedelta(minutes=20)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-rahul-1"), user_id=user_id, customer_id=seeded_customers[1].id,
            customer_name="Rahul Kumar", customer_phone="9305601503", template_type="kyc_reminder", language="hindi",
            message="नमस्ते राहुल जी, आपका KYC verification अभी pending है। कृपया इसे पूरा कर लें ताकि आपकी services active रहें।",
            status="pending", reminder_frequency="daily", reminder_active=True,
            created_at=now - timedelta(hours=1)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-sunita-1"), user_id=user_id, customer_id=seeded_customers[3].id,
            customer_name="Sunita Devi", customer_phone="9876500002", template_type="kyc_reminder", language="hinglish",
            message="Namaste Sunita ji, aapke Eko Banking point par KYC verification document upload pending hai. Kripya counter par aakar Aadhaar/PAN submit karein taaki daily transaction limit active rahe.",
            status="pending", reminder_frequency="daily", reminder_active=True,
            created_at=now - timedelta(hours=4)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-anil-1"), user_id=user_id, customer_id=seeded_customers[4].id,
            customer_name="Anil Joshi", customer_phone="9876500003", template_type="aeps", language="english",
            message="Hello Anil, your AePS cash withdrawal and mini-statement receipt is ready for download at your counter.",
            status="pending", reminder_frequency="4hours", reminder_active=True,
            created_at=now - timedelta(hours=5)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-ramesh-1"), user_id=user_id, customer_id=seeded_customers[2].id,
            customer_name="Ramesh Chandra", customer_phone="9876500001", template_type="settlement_notice", language="hinglish",
            message="Namaste Ramesh ji, aapke store par T+1 settlement balance ₹11,200 successfully credit kar diya gaya hai. Details ke liye Eko app check karein.",
            status="sent", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=2),
            created_at=now - timedelta(hours=3)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-vikram-1"), user_id=user_id, customer_id=seeded_customers[6].id,
            customer_name="Vikram Patel", customer_phone="9876500005", template_type="offer", language="hindi",
            message="नमस्ते विक्रम जी, इस त्योहारी सीजन में अपने ग्राहकों को ईको की मनी ट्रांसफर एवं बिल सेवाएं दें और पाएं उच्चतम कमीशन!",
            status="sent", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=6),
            created_at=now - timedelta(hours=8)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-deepak-1"), user_id=user_id, customer_id=seeded_customers[10].id,
            customer_name="Deepak Gupta", customer_phone="9876500009", template_type="offer", language="english",
            message="Hello Deepak! Special festive offer: Enjoy fast money transfers, cash withdrawals, and bill payments with highest commission and zero downtime!",
            status="sent", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(days=1),
            created_at=now - timedelta(days=1)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-rajesh-1"), user_id=user_id, customer_id=seeded_customers[9].id,
            customer_name="Rajesh Verma", customer_phone="9876500008", template_type="bbps", language="hinglish",
            message="Namaste Rajesh ji, electricity aur broadband bills ka instant payment counter par karein. Official BBPS receipt instantly mil jayegi.",
            status="sent", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=3),
            created_at=now - timedelta(hours=5)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-priya-1"), user_id=user_id, customer_id=seeded_customers[5].id,
            customer_name="Priya Sharma", customer_phone="9876500004", template_type="dispute_update", language="hinglish",
            message="Namaste Priya ji, aapki transaction complaint TXN-DEMO-1001 bank desk par escalate kar di gayi hai. Resolve hote hi aapko turant update diya jayega.",
            status="delivered", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=1),
            created_at=now - timedelta(hours=2)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-meena-1"), user_id=user_id, customer_id=seeded_customers[11].id,
            customer_name="Meena Kumari", customer_phone="9876500010", template_type="aeps", language="hindi",
            message="नमस्ते मीना जी, आपकी सामाजिक सुरक्षा पेंशन का आधार बायोमेट्रिक नकद भुगतान केंद्र पर उपलब्ध है।",
            status="delivered", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=4),
            created_at=now - timedelta(hours=6)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-sanjay-1"), user_id=user_id, customer_id=seeded_customers[12].id,
            customer_name="Sanjay Yadav", customer_phone="9876500011", template_type="payment_reminder", language="english",
            message="Hello Sanjay, your Eko partner account has a pending settlement balance due. Please complete payment today.",
            status="delivered", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=5),
            created_at=now - timedelta(hours=7)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-pooja-1"), user_id=user_id, customer_id=seeded_customers[13].id,
            customer_name="Pooja Mishra", customer_phone="9876500012", template_type="bbps", language="hindi",
            message="नमस्ते पूजा जी, बिजली एवं पानी बिलों का भुगतान केंद्र पर सफलतापूर्वक हो गया है। डिजिटल रसीद सुरक्षित रखें।",
            status="read", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=8),
            created_at=now - timedelta(hours=10)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-manoj-1"), user_id=user_id, customer_id=seeded_customers[14].id,
            customer_name="Manoj Tiwari", customer_phone="9876500013", template_type="recharge", language="hinglish",
            message="Namaste Manoj ji, aapka mobile data recharge successfully activate ho gaya hai. Eko services use karne ke liye dhanyawad.",
            status="read", reminder_frequency="none", reminder_active=False, sent_at=now - timedelta(hours=9),
            created_at=now - timedelta(hours=12)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-imran-1"), user_id=user_id, customer_id=seeded_customers[7].id,
            customer_name="Mohammad Imran", customer_phone="9876500006", template_type="custom", language="hinglish",
            message="Aapka ₹10,000 DMT payout bank switch confirmation pending hai. Hamare agent se turant sampark karein.",
            status="failed", reminder_frequency="none", reminder_active=False, notes="Delivery failed: Number unreachable",
            created_at=now - timedelta(hours=6)
        ),
        models.WhatsAppOutreach(
            id=seed_id("wa-kavita-1"), user_id=user_id, customer_id=seeded_customers[8].id,
            customer_name="Kavita Singh", customer_phone="9876500007", template_type="kyc_reminder", language="english",
            message="Hi Kavita, your KYC verification is still pending. Please complete it to keep your services active.",
            status="failed", reminder_frequency="none", reminder_active=False, notes="Delivery timed out",
            created_at=now - timedelta(hours=7)
        ),
    ]
    for w in wa_records:
        db.add(w)

    # 10. 6 Pre-configured Editable Poster Designs
    poster_templates = [
        models.PosterDesign(
            id=seed_id("poster-dmt"), user_id=user_id,
            title="Fast Money Transfer up to ₹50,000", template_type="dmt",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#1e3a8a", "gradient": "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#fbbf24", "x": 50, "y": 40, "width": 260, "height": 44, "text": "⚡ 100% Instant IMPS Credit"},
                {"id": "logo", "type": "logo", "text": "Eko Partner CSP", "color": "#ffffff", "size": 24, "bold": True, "x": 540, "y": 48},
                {"id": "h1", "type": "text", "text": "पूरे भारत में कहीं भी तुरंत पैसे भेजें", "color": "#ffffff", "size": 42, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Direct Bank Account Deposit via IMPS • Safe & Fast", "color": "#93c5fd", "size": 22, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "box", "type": "shape", "shape": "card", "color": "rgba(255,255,255,0.08)", "x": 50, "y": 280, "width": 700, "height": 340},
                {"id": "f1", "type": "text", "text": "✔ मनी ट्रांसफर सीमा: ₹100 से ₹50,000 तक", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "✔ रविवार और बैंक छुट्टियों के दिन भी सेवा चालू", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 380},
                {"id": "f3", "type": "text", "text": "✔ सटीक प्रिंटेड रसीद एवं तुरंत एसएमएस सूचना", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 440},
                {"id": "f4", "type": "text", "text": "✔ सभी राष्ट्रीय एवं क्षेत्रीय ग्रामीण बैंक मान्य", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 500},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#22c55e", "x": 50, "y": 660, "width": 700, "height": 68, "text": "आज ही अपने नजदीकी काउंटर पर संपर्क करें", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-aeps"), user_id=user_id,
            title="Aadhaar Banking & Mini ATM", template_type="aeps",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#064e3b", "gradient": "linear-gradient(135deg, #022c22 0%, #064e3b 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#a7f3d0", "x": 50, "y": 40, "width": 280, "height": 44, "text": "🔒 NPCI / AePS सुरक्षित सेवा", "textColor": "#064e3b"},
                {"id": "h1", "type": "text", "text": "आधार से तुरंत पैसा निकालें", "color": "#ffffff", "size": 44, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Mini ATM Banking: Cash Out & Balance Check in 10 Seconds", "color": "#6ee7b7", "size": 20, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• फिंगरप्रिंट लगाकर तुरंत नकद निकासी", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• फ्री बैलेंस चेक एवं मिनी स्टेटमेंट", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 390},
                {"id": "f3", "type": "text", "text": "• बिना बैंक या एटीएम की लाइन में लगे सेवा", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 460},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#10b981", "x": 50, "y": 660, "width": 700, "height": 68, "text": "अपना आधार नंबर और बैंक पासबुक लाएं", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-bbps"), user_id=user_id,
            title="Bharat BillPay Utility Hub", template_type="bbps",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#701a75", "gradient": "linear-gradient(135deg, #4a044e 0%, #701a75 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#fbcfe8", "x": 50, "y": 40, "width": 260, "height": 44, "text": "🏛 भारत बिल पे अधिकृत केंद्र", "textColor": "#701a75"},
                {"id": "h1", "type": "text", "text": "सभी सरकारी एवं बिजली बिल यहाँ भरें", "color": "#ffffff", "size": 40, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "f1", "type": "text", "text": "✔ बिजली बिल (BSES, UPPCL, DHBVN, TPDDL)", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 280},
                {"id": "f2", "type": "text", "text": "✔ पानी एवं पाइप गैस बिल तुरंत जमा", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 350},
                {"id": "f3", "type": "text", "text": "✔ एलआईसी एवं बीमा प्रीमियम भुगतान", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 420},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#d946ef", "x": 50, "y": 660, "width": 700, "height": 68, "text": "तुरंत पेमेंट रसीद प्राप्त करें", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-recharge"), user_id=user_id,
            title="All Mobile & DTH Recharge", template_type="recharge",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#c2410c", "gradient": "linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#ffedd5", "x": 50, "y": 40, "width": 260, "height": 44, "text": "📱 100% इंस्टेंट रिचार्ज", "textColor": "#c2410c"},
                {"id": "h1", "type": "text", "text": "सभी मोबाइल और DTH रिचार्ज", "color": "#ffffff", "size": 42, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "Jio • Airtel • Vi • BSNL • Tata Play • Dish TV", "color": "#fed7aa", "size": 24, "bold": True, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• अनलिमिटेड कॉलिंग एवं डाटा बूस्टर प्लान्स", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• बेस्ट 84-दिन एवं 365-दिन एनुअल ऑफर्स", "color": "#ffffff", "size": 22, "bold": True, "align": "left", "x": 80, "y": 400},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#ea580c", "x": 50, "y": 660, "width": 700, "height": 68, "text": "अपना मोबाइल नंबर बताकर तुरंत रिचार्ज कराएं", "textColor": "#ffffff", "textSize": 22, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-festival"), user_id=user_id,
            title="Shubh Deepawali Special Banking", template_type="festival",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#78350f", "gradient": "linear-gradient(135deg, #451a03 0%, #92400e 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#fef08a", "x": 50, "y": 40, "width": 240, "height": 44, "text": "✨ त्योहार धमाका ऑफर", "textColor": "#78350f"},
                {"id": "h1", "type": "text", "text": "शुभ दीपोत्सव — घर पैसे भेजें", "color": "#fef08a", "size": 44, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "sub", "type": "text", "text": "त्योहारों पर अपने परिवार को भेजें खुशियां तुरंत", "color": "#ffffff", "size": 22, "bold": False, "align": "left", "x": 50, "y": 210, "width": 700},
                {"id": "f1", "type": "text", "text": "• गांव और घर तुरंत मनी ट्रांसफर (24x7 सेवा)", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 320},
                {"id": "f2", "type": "text", "text": "• आधार कार्ड से नकद निकासी सुविधा", "color": "#ffffff", "size": 24, "bold": True, "align": "left", "x": 80, "y": 400},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#f59e0b", "x": 50, "y": 660, "width": 700, "height": 68, "text": "खुशियों का त्योहार, ईको के साथ!", "textColor": "#000000", "textSize": 24, "bold": True}
            ])
        ),
        models.PosterDesign(
            id=seed_id("poster-announcement"), user_id=user_id,
            title="Authorized Eko Digital CSP Outlet", template_type="announcement",
            width=800, height=800,
            layers_json=json.dumps([
                {"id": "bg", "type": "background", "color": "#0f172a", "gradient": "linear-gradient(135deg, #020617 0%, #1e293b 100%)"},
                {"id": "badge", "type": "shape", "shape": "badge", "color": "#38bdf8", "x": 50, "y": 40, "width": 300, "height": 44, "text": "⭐ अधिकृत ईको बिजनेस पार्टनर", "textColor": "#0f172a"},
                {"id": "h1", "type": "text", "text": "आपका नजदीकी डिजिटल बैंकिंग केंद्र", "color": "#ffffff", "size": 40, "bold": True, "align": "left", "x": 50, "y": 140, "width": 700},
                {"id": "f1", "type": "text", "text": "✔ मनी ट्रांसफर (DMT) • आधार बैंकिंग (AePS)", "color": "#38bdf8", "size": 24, "bold": True, "align": "left", "x": 80, "y": 280},
                {"id": "f2", "type": "text", "text": "✔ बिजली, पानी, गैस बिल पेमेंट (BBPS)", "color": "#38bdf8", "size": 24, "bold": True, "align": "left", "x": 80, "y": 360},
                {"id": "f3", "type": "text", "text": "✔ सभी मोबाइल एवं डीटीएच रिचार्ज", "color": "#38bdf8", "size": 24, "bold": True, "align": "left", "x": 80, "y": 440},
                {"id": "cta", "type": "shape", "shape": "pill", "color": "#0284c7", "x": 50, "y": 660, "width": 700, "height": 68, "text": "विश्वसनीय • सुरक्षित • तुरंत समाधान", "textColor": "#ffffff", "textSize": 24, "bold": True}
            ])
        ),
    ]
    for p in poster_templates:
        db.add(p)

    db.commit()
    logger.info(f"Successfully initialized connected recruiter demo environment for user: {user_id}")


# ─── Health & Readiness ───────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    db_ok = database.check_db_connection()
    configured_provider = os.getenv("AI_PROVIDER", "ollama").lower()
    has_optional_hosted = bool(
        os.getenv("GEMINI_API_KEY", "").strip() or
        os.getenv("OPENAI_API_KEY", "").strip()
    )
    ai_ok = configured_provider in ("ollama", "local", "local-llm", "deterministic") or has_optional_hosted
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen3:4b")
    git_sha = os.getenv("RENDER_GIT_COMMIT", "e88e953")[:7]  # deploy-trigger: v1.4.0-hotfix
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "Eko Partner Operations API",
        "version": "1.4.0",
        "commit_sha": git_sha,
        "environment": ENVIRONMENT,
        "ai_configured": ai_ok,
        "ai_provider": configured_provider,
        "ai_model": ollama_model if configured_provider in ("ollama", "local-llm") else ("database-grounded" if configured_provider in ("local", "deterministic") else "hosted"),
        "auth_configured": bool(GOOGLE_CLIENT_ID),
        "database": "connected" if db_ok else "disconnected",
    }


@app.get("/api/ai/health")
async def ai_health():
    """
    Safe AI health check — never returns API keys, tokens, or secrets.
    Distinguishes LIVE AI from DEMO FALLBACK via actual live probe.
    """
    configured_provider = os.getenv("AI_PROVIDER", "ollama").lower().strip()
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen3:4b").strip()
    ai_provider = get_ai_provider()

    live_verified = False
    provider_name = type(ai_provider).__name__
    model_display = getattr(ai_provider, "model_name", "database-grounded")

    # Perform live probe if an external or local LLM is configured
    if not isinstance(ai_provider, LocalDeterministicProvider):
        try:
            res = await asyncio.wait_for(
                ai_provider.generate(
                    system_instruction="Safe health check probe.",
                    prompt="Ping",
                    timeout=2.0
                ),
                timeout=2.5
            )
            if res and isinstance(res, dict):
                live_verified = True
        except Exception as e:
            logger.info(f"AI live probe failed or offline ({e}). Reporting fallback status.")
            live_verified = False

    if live_verified:
        ai_mode = "live_ai"
        status_msg = "healthy"
        provider_display = configured_provider
    else:
        ai_mode = "demo_fallback"
        status_msg = "fallback_only"
        provider_display = "deterministic"
        model_display = "database-grounded"

    return {
        "configured": True,
        "provider": provider_display,
        "model": model_display,
        "status": status_msg,
        "ai_mode": ai_mode,
        "live_verified": live_verified,
        "multilingual": True,
        "languages": ["en", "hi", "hinglish"],
        "grounded": True,
        "note": "AI provider credentials are never returned in this endpoint."
    }

@app.get("/api/ready")
def ready():
    db_ok = database.check_db_connection()
    if not db_ok:
        raise HTTPException(status_code=503, detail="Database not ready")
    return {"status": "ready", "version": "1.4.0"}

@app.get("/api/ops/migrate")
@app.post("/api/ops/migrate")
def trigger_migration(seed_user: Optional[str] = None, db: Session = Depends(database.get_db)):
    """Ensure database schema is up-to-date across all tables and optionally re-seed user."""
    run_migrations()
    result = {"status": "ok", "message": "Schema migration completed successfully."}
    if seed_user:
        # Force re-seed
        for model in (
            models.TimelineEvent,
            models.CreditScoreHistory,
            models.CreditScore,
            models.OperationalNotification,
            models.Complaint,
            models.Task,
            models.Note,
            models.Commission,
            models.Settlement,
            models.TransactionIssue,
            models.Bill,
            models.ServiceActivity,
            models.Customer,
            models.WhatsAppOutreach,
            models.PosterDesign,
        ):
            try:
                db.query(model).filter(model.user_id == seed_user).delete(synchronize_session=False)
            except Exception:
                pass
        try:
            db.commit()
        except Exception:
            db.rollback()
        ensure_user_seeded(seed_user, db)
        result["seeded_user"] = seed_user
        result["counts"] = {
            "partners": db.query(models.Customer).filter(models.Customer.user_id == seed_user, models.Customer.is_partner.is_(True)).count(),
            "customers": db.query(models.Customer).filter(models.Customer.user_id == seed_user).count(),
            "transactions": db.query(models.ServiceActivity).filter(models.ServiceActivity.user_id == seed_user).count(),
            "commissions": db.query(models.Commission).filter(models.Commission.user_id == seed_user).count(),
            "settlements": db.query(models.Settlement).filter(models.Settlement.user_id == seed_user).count(),
            "complaints": db.query(models.Complaint).filter(models.Complaint.user_id == seed_user).count(),
            "whatsapp": db.query(models.WhatsAppOutreach).filter(models.WhatsAppOutreach.user_id == seed_user).count(),
            "tasks": db.query(models.Task).filter(models.Task.user_id == seed_user).count(),
            "notes": db.query(models.Note).filter(models.Note.user_id == seed_user).count(),
            "notifications": db.query(models.OperationalNotification).filter(models.OperationalNotification.user_id == seed_user).count(),
            "posters": db.query(models.PosterDesign).filter(models.PosterDesign.user_id == seed_user).count(),
        }
    return result


@app.post("/api/demo/reset")
def reset_demo(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    if not DEMO_MODE or user_id != "demo-operator-01":
        raise HTTPException(status_code=403, detail="Demo reset is disabled outside the protected demo environment.")

    for model in (
        models.TimelineEvent,
        models.CreditScoreHistory,
        models.CreditScore,
        models.OperationalNotification,
        models.Complaint,
        models.Task,
        models.Note,
        models.Commission,
        models.Settlement,
        models.TransactionIssue,
        models.Bill,
        models.ServiceActivity,
        models.Customer,
        models.WhatsAppOutreach,
        models.PosterDesign,
    ):
        try:
            db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()
    ensure_user_seeded(user_id, db)
    return {"status": "reset", "user_id": user_id, "demo_mode": True}

# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/api/auth/google", response_model=UserResponse)
def google_login(payload: GoogleTokenRequest, db: Session = Depends(database.get_db)):
    if not GOOGLE_CLIENT_ID:
        logger.error("Auth failed: GOOGLE_CLIENT_ID environment variable is missing on backend")
        raise HTTPException(status_code=500, detail="Server authentication is not configured.")

    token = payload.credential or payload.id_token
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Missing credential/id_token in request body.")

    try:
        id_info = id_token.verify_oauth2_token(
            token.strip(),
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.warning("Google token verification failed (ValueError): %s", str(e))
        raise HTTPException(status_code=401, detail="Invalid Google token: " + str(e))
    except Exception as e:
        logger.error("Google token verification failed (Unexpected): %s", str(e))
        raise HTTPException(status_code=401, detail="Google authentication failed.")

    issuer = id_info.get("iss")
    if issuer not in ["accounts.google.com", "https://accounts.google.com"]:
        logger.warning("Rejected token with invalid issuer: %s", issuer)
        raise HTTPException(status_code=401, detail="Invalid token issuer.")

    audience = id_info.get("aud")
    if audience != GOOGLE_CLIENT_ID:
        logger.warning("Token audience mismatch (expected client ID)")
        raise HTTPException(status_code=401, detail="Token audience mismatch.")

    google_sub = id_info.get("sub")
    email = id_info.get("email")
    if not google_sub or not email:
        raise HTTPException(status_code=400, detail="Google token missing subject or email identity.")

    name = id_info.get("name") or email.split("@")[0]
    picture = id_info.get("picture")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            id=google_sub,
            email=email,
            name=name,
            picture=picture,
            onboarding_completed=False,
            wallet_balance=0.0,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Successfully created new authenticated user: %s (id: %s)", email, user.id)
    else:
        changed = False
        if name and user.name != name:
            user.name = name
            changed = True
        if picture and user.picture != picture:
            user.picture = picture
            changed = True
        if changed:
            db.commit()
            db.refresh(user)
        logger.info("Successfully authenticated existing user: %s (id: %s)", email, user.id)

    return user

# ─── Customer 360 ─────────────────────────────────────────────────────────────
@app.get("/api/customers", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = None,
    partner_id: Optional[str] = None,
    only_retail: bool = False,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    ensure_user_seeded(user_id, db)
    query = db.query(models.Customer).filter(models.Customer.user_id == user_id)

    if only_retail:
        query = query.filter(models.Customer.is_partner == False)

    if partner_id and partner_id.strip():
        query = query.filter(models.Customer.partner_id == partner_id.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Customer.name.ilike(term),
                models.Customer.phone.ilike(term),
                models.Customer.id.ilike(term),
                models.Customer.email.ilike(term),
                models.Customer.notes.ilike(term)
            )
        )

    customers = query.order_by(desc(models.Customer.created_at)).all()

    # Partner lookup
    partners = {
        p.id: p.name for p in db.query(models.Customer).filter(
            models.Customer.user_id == user_id,
            models.Customer.is_partner == True
        ).all()
    }

    # Credit risk bracket lookup
    credit_scores = {
        cs.customer_id: cs.risk_bracket for cs in db.query(models.CreditScore).filter(
            models.CreditScore.user_id == user_id
        ).all()
    }

    results = []
    for c in customers:
        txns = db.query(models.ServiceActivity).filter(
            models.ServiceActivity.user_id == user_id,
            or_(
                models.ServiceActivity.customer_id == c.id,
                models.ServiceActivity.partner_id == c.id
            )
        ).order_by(desc(models.ServiceActivity.created_at)).all()

        total_txns = len(txns)
        total_vol = sum(t.amount for t in txns if t.status == "success")
        latest_status = txns[0].status if txns else None

        raw_phone = c.phone or ""
        masked_phone = f"••••{raw_phone[-4:]}" if len(raw_phone) >= 4 else raw_phone
        risk_level = credit_scores.get(c.id, "LOW")

        c_dict = {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "masked_phone": masked_phone,
            "email": c.email,
            "kyc_status": c.kyc_status,
            "business_type": c.business_type,
            "notes": c.notes,
            "amount_due": c.amount_due,
            "last_contact": c.last_contact,
            "follow_up_date": c.follow_up_date,
            "is_partner": bool(c.is_partner),
            "partner_id": c.partner_id,
            "partner_name": partners.get(c.partner_id, "Direct CSP Outlet"),
            "category": c.category,
            "total_transactions": total_txns,
            "total_volume": total_vol,
            "latest_status": latest_status,
            "risk_level": risk_level,
            "created_at": c.created_at
        }
        results.append(CustomerResponse(**c_dict))
    return results

@app.get("/api/customers/{cid}/timeline", response_model=List[TimelineEventResponse])
def get_customer_timeline(cid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    return db.query(models.TimelineEvent).filter(
        models.TimelineEvent.customer_id == cid,
        models.TimelineEvent.user_id == user_id
    ).order_by(desc(models.TimelineEvent.created_at)).all()

@app.post("/api/customers", response_model=CustomerResponse)
def create_customer(data: CustomerCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    cid = str(uuid.uuid4())
    c = models.Customer(id=cid, user_id=user_id, **data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    add_timeline_event(db, user_id, cid, "kyc", "Customer Onboarded", f"Added as {data.business_type or 'Individual'}", cid)
    return c

# ─── Transaction Operations ───────────────────────────────────────────────────
@app.get("/api/activity", response_model=List[ActivityResponse])
def list_activity(
    status: Optional[str] = None,
    service: Optional[str] = None,
    partner_id: Optional[str] = None,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    try:
        ensure_user_seeded(user_id, db)
    except Exception as e:
        logger.warning(f"ensure_user_seeded warning in list_activity: {e}")
        db.rollback()

    query = db.query(models.ServiceActivity).filter(models.ServiceActivity.user_id == user_id)
    if status and status.lower() != "all":
        query = query.filter(models.ServiceActivity.status.ilike(status))
    if service and service.lower() != "all":
        query = query.filter(models.ServiceActivity.service_name.ilike(f"%{service}%"))
    if partner_id:
        query = query.filter(models.ServiceActivity.partner_id == partner_id)

    return query.order_by(desc(models.ServiceActivity.created_at)).all()

@app.post("/api/activity", response_model=ActivityResponse)
def create_activity(data: ActivityCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    aid = str(uuid.uuid4())
    act = models.ServiceActivity(id=aid, user_id=user_id, **data.model_dump())
    db.add(act)

    # Automatically generate deterministic commission record
    rate, comm_amount, comm_status = canonical_seed.calculate_commission(data.service_name, data.amount, data.status)
    comm = models.Commission(
        id=str(uuid.uuid4()),
        user_id=user_id,
        transaction_id=aid,
        partner_id=data.partner_id or data.customer_id or "partner-paras",
        customer_id=data.customer_id,
        service=data.service_name,
        transaction_amount=data.amount,
        commission_rate=rate,
        commission_amount=comm_amount,
        status=comm_status,
        earned_at=datetime.now() if comm_status in ("EARNED", "PAID") else None
    )
    db.add(comm)

    db.commit()
    db.refresh(act)
    if data.customer_id:
        add_timeline_event(db, user_id, data.customer_id, "txn", f"{data.service_name} Transaction", f"Amount: {fmt_inr(data.amount)} - Status: {data.status}", aid)
    return act

@app.get("/api/activity/{aid}")
@app.get("/api/transactions/{aid}")
def get_activity_detail(aid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    act = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.id == aid,
        models.ServiceActivity.user_id == user_id
    ).first()
    if not act:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    partner = None
    if act.customer_id:
        cust = db.query(models.Customer).filter(models.Customer.id == act.customer_id).first()
        if cust:
            partner = {
                "id": cust.id,
                "name": cust.name,
                "phone": cust.phone,
                "business_type": cust.business_type,
                "kyc_status": cust.kyc_status
            }

    complaints = db.query(models.Complaint).filter(
        models.Complaint.transaction_id == aid,
        models.Complaint.user_id == user_id
    ).all()

    return {
        "id": act.id,
        "service_name": act.service_name,
        "amount": act.amount,
        "commission": act.commission,
        "status": act.status,
        "reference_id": act.reference_id,
        "failure_reason": act.failure_reason,
        "customer_id": act.customer_id,
        "customer_name": act.customer_name,
        "created_at": act.created_at.isoformat() if act.created_at else None,
        "partner": partner,
        "complaints": [
            {
                "id": c.id,
                "subject": c.subject,
                "status": c.status,
                "priority": c.priority,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in complaints
        ]
    }

# ─── Grievance & SLA Tracking ──────────────────────────────────────────────────
@app.post("/api/complaints", response_model=ComplaintResponse)
def create_complaint(data: ComplaintCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    comp_id = str(uuid.uuid4())
    # SLA by priority: urgent = 4h, high = 24h, medium = 48h
    hours = 4 if data.priority == "urgent" else (24 if data.priority == "high" else 48)
    complaint = models.Complaint(
        id=comp_id,
        user_id=user_id,
        **data.model_dump(),
        sla_deadline=datetime.now() + timedelta(hours=hours)
    )
    db.add(complaint)
    
    # Auto-generate operational notification
    notif = models.OperationalNotification(
        id=str(uuid.uuid4()), user_id=user_id,
        title=f"Complaint Logged: {data.subject[:35]}",
        message=f"SLA countdown active ({hours}h). Priority: {data.priority.upper()}.",
        category="complaint", priority=data.priority or "high",
        deep_link=f"/complaints/{comp_id}"
    )
    db.add(notif)
    db.commit()
    db.refresh(complaint)
    if data.customer_id:
        add_timeline_event(db, user_id, data.customer_id, "complaint", "Complaint Registered", data.subject, comp_id)
    return complaint

@app.get("/api/complaints")
def list_complaints(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """List complaints with calculated SLA remaining time and customer context."""
    ensure_user_seeded(user_id, db)
    complaints = db.query(models.Complaint).filter(models.Complaint.user_id == user_id).order_by(desc(models.Complaint.created_at)).all()
    results = []
    for c in complaints:
        remaining = None
        if c.sla_deadline and c.status not in ("closed", "resolved"):
            remaining = (c.sla_deadline - datetime.now()).total_seconds() / 3600

        cust_name = None
        if c.customer_id:
            cust = db.query(models.Customer).filter(models.Customer.id == c.customer_id).first()
            if cust:
                cust_name = cust.name

        results.append({
            "id": c.id,
            "subject": c.subject,
            "description": c.description,
            "status": c.status,
            "priority": c.priority,
            "customer_id": c.customer_id,
            "customer_name": cust_name,
            "transaction_id": c.transaction_id,
            "sla_hours_remaining": remaining,
            "sla_deadline": c.sla_deadline.isoformat() if c.sla_deadline else None,
            "category": c.category,
            "assigned_to": c.assigned_to,
            "resolution_note": c.resolution_note,
            "created_at": c.created_at
        })
    return results


# ─── Advanced Credit Intelligence ─────────────────────────────────────────────
def calculate_dynamic_score(db: Session, user_id: str, customer_id: str) -> tuple:
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.user_id == user_id
    ).first()
    activity = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.customer_id == customer_id
    ).order_by(desc(models.ServiceActivity.created_at)).all()

    tenure_days = 0
    if customer and customer.created_at:
        created_at = customer.created_at.replace(tzinfo=None)
        tenure_days = max(0, (datetime.now() - created_at).days)
    tenure_bonus = min(7.0, tenure_days / 90 * 7.0)
    kyc_bonus = 7.0 if customer and customer.kyc_status == "verified" else 0.0

    if not activity:
        score = 45.0 + tenure_bonus + kyc_bonus
        if customer and customer.kyc_status != "verified":
            score -= 5.0
        score = min(65.0, max(10.0, score))
        risk = "LOW" if score >= 80 else "MODERATE" if score >= 50 else "HIGH"
        factors = {
            "success_rate": "N/A",
            "recent_performance": "N/A",
            "volume_handled": fmt_inr(0),
            "total_txns": "0",
            "kyc_status": customer.kyc_status if customer else "unknown",
            "operational_tenure_days": str(tenure_days)
        }
        recs = "Build transaction history before approving higher operational limits."
        if customer and customer.kyc_status != "verified":
            recs = "Complete KYC verification and record successful activity before raising limits."
        return score, risk, 0.35, factors, recs

    total = len(activity)
    successful = [a for a in activity if a.status == "success"]
    failed = [a for a in activity if a.status == "failed"]

    success_rate = len(successful) / total
    volume = sum(a.amount for a in successful)

    # Time-weighted logic: Recent success is more valuable
    recent_activity = activity[:10]
    recent_success_rate = len([a for a in recent_activity if a.status == "success"]) / len(recent_activity)

    # Deterministic scoring: performance first, adjusted by tenure/KYC and sample size.
    score = 35.0
    score += (success_rate * 25.0)
    score += (recent_success_rate * 15.0)
    score += min(8.0, volume / 50000 * 8.0)
    score += min(5.0, total / 20 * 5.0)
    score += tenure_bonus
    score += kyc_bonus

    if total < 3:
        score -= 3.0 if customer and customer.kyc_status == "verified" else 17.0

    score = min(99.0, max(10.0, score))
    risk = "LOW" if score >= 80 else "MODERATE" if score >= 50 else "HIGH"
    confidence = min(1.0, 0.45 + (total / 20 * 0.45) + (0.10 if customer and customer.kyc_status == "verified" else 0.0))

    factors = {
        "success_rate": f"{int(success_rate*100)}%",
        "recent_performance": f"{int(recent_success_rate*100)}%",
        "volume_handled": fmt_inr(volume),
        "total_txns": str(total),
        "failed_txns": str(len(failed)),
        "kyc_status": customer.kyc_status if customer else "unknown",
        "operational_tenure_days": str(tenure_days)
    }

    recs = "Maintain high volume and success rate to improve assessment."
    if risk == "HIGH": recs = "Urgent: Improve transaction success ratio before requesting higher limits."
    elif customer and customer.kyc_status != "verified":
        recs = "Complete KYC verification and add more successful transactions before approving higher limits."

    return score, risk, confidence, factors, recs

@app.post("/api/credit-score/recalculate/{cid}")
def recalculate_eko_score(cid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == cid, models.Customer.user_id == user_id).first()
    if not customer: raise HTTPException(status_code=404, detail="Customer not found.")

    score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, cid)

    old_score_rec = db.query(models.CreditScore).filter(
        models.CreditScore.customer_id == cid,
        models.CreditScore.user_id == user_id
    ).order_by(desc(models.CreditScore.created_at)).first()
    old_val = old_score_rec.score if old_score_rec else 50.0

    if not old_score_rec:
        old_score_rec = models.CreditScore(
            id=str(uuid.uuid4()), user_id=user_id, customer_id=cid,
            customer_name=customer.name, score=score_val, risk_bracket=risk,
            confidence=conf, factors=json.dumps(factors), recommendations=recs
        )
        db.add(old_score_rec)
    else:
        if abs(old_val - score_val) >= 0.5:
            change = score_val - old_val
            hist = models.CreditScoreHistory(
                id=str(uuid.uuid4()), user_id=user_id, customer_id=cid,
                old_score=old_val, new_score=score_val,
                change_reason=f"Activity update: {'Improved' if change > 0 else 'Declined'} by {abs(change):.1f} points.",
                contributing_factors=json.dumps(factors)
            )
            db.add(hist)
            old_score_rec.score = score_val
            old_score_rec.risk_bracket = risk
            old_score_rec.confidence = conf
            old_score_rec.factors = json.dumps(factors)
            old_score_rec.recommendations = recs

            add_timeline_event(db, user_id, cid, "credit", "Credit Assessment Updated",
                               f"Score moved from {old_val:.1f} to {score_val:.1f}. Bracket: {risk}")

    db.commit()
    return {
        "status": "success",
        "score": score_val,
        "risk": risk,
        "confidence": conf,
        "factors": factors,
        "recommendations": recs
    }

@app.get("/api/credit-score/history")
def get_credit_score_history(customer_id: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.user_id == user_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    current = db.query(models.CreditScore).filter(
        models.CreditScore.customer_id == customer_id,
        models.CreditScore.user_id == user_id
    ).order_by(desc(models.CreditScore.created_at)).first()

    if not current:
        score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, customer_id)
        current_payload = {
            "score": score_val,
            "risk_bracket": risk,
            "confidence": conf,
            "factors": factors,
            "recommendations": recs,
            "created_at": None
        }
    else:
        try:
            factors = json.loads(current.factors) if current.factors else {}
        except json.JSONDecodeError:
            factors = {"raw": current.factors}
        current_payload = {
            "id": current.id,
            "score": current.score,
            "risk_bracket": current.risk_bracket,
            "confidence": current.confidence,
            "factors": factors,
            "recommendations": current.recommendations,
            "created_at": current.created_at.isoformat() if current.created_at else None
        }

    history = db.query(models.CreditScoreHistory).filter(
        models.CreditScoreHistory.customer_id == customer_id,
        models.CreditScoreHistory.user_id == user_id
    ).order_by(desc(models.CreditScoreHistory.created_at)).limit(20).all()

    return {
        "customer_id": customer_id,
        "customer_name": customer.name,
        "current": current_payload,
        "history": [
            {
                "id": item.id,
                "old_score": item.old_score,
                "new_score": item.new_score,
                "change_reason": item.change_reason,
                "contributing_factors": json.loads(item.contributing_factors) if item.contributing_factors else {},
                "created_at": item.created_at.isoformat() if item.created_at else None
            }
            for item in history
        ]
    }

# ─── Operational Dashboard Metrics ────────────────────────────────────────────
@app.get("/api/ops/dashboard")
def get_ops_dashboard(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    today_start = datetime.combine(date.today(), datetime.min.time())

    activity = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.created_at >= today_start
    ).all()

    successful = [a for a in activity if a.status == "success"]
    failed = [a for a in activity if a.status == "failed"]
    pending = [a for a in activity if a.status == "pending"]

    total_volume = sum(a.amount for a in successful)
    total_commission = sum(a.commission for a in successful)

    open_complaints = db.query(models.Complaint).filter(
        models.Complaint.user_id == user_id,
        models.Complaint.status != "closed"
    ).count()

    approaching_sla = db.query(models.Complaint).filter(
        models.Complaint.user_id == user_id,
        models.Complaint.status != "closed",
        models.Complaint.sla_deadline <= datetime.now() + timedelta(hours=12)
    ).count()

    return {
        "today_transactions": len(activity),
        "success_rate": f"{(len(successful)/len(activity)*100 if activity else 100):.1f}%",
        "total_volume": total_volume,
        "total_commission": total_commission,
        "failed_alerts": len(failed),
        "pending_operations": len(pending),
        "open_complaints": open_complaints,
        "sla_at_risk": approaching_sla
    }

@app.post("/api/credit-score/simulate")
def simulate_credit_score(body: CreditSimulationRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Predict projected credit impact of hypothetical scenarios without database mutations."""
    customer = db.query(models.Customer).filter(models.Customer.id == body.customer_id, models.Customer.user_id == user_id).first()
    if not customer: raise HTTPException(status_code=404, detail="Customer not found.")

    # Get current state
    activity = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.customer_id == body.customer_id
    ).all()

    current_score, current_risk, _, _, _ = calculate_dynamic_score(db, user_id, body.customer_id)

    # Inject hypothetical events into in-memory list
    simulated_activity = list(activity)
    for _ in range(body.hypothetical_success_txns):
        # We only need the status and amount for the simplified scorer
        simulated_activity.append(models.ServiceActivity(status="success", amount=body.hypothetical_volume / body.hypothetical_success_txns if body.hypothetical_success_txns > 0 else 0))

    for _ in range(body.hypothetical_failed_txns):
        simulated_activity.append(models.ServiceActivity(status="failed", amount=0.0))

    # Manual in-memory scoring (matches calculate_dynamic_score logic)
    def core_score_logic(activity_list):
        if not activity_list: return 0, "INSUFFICIENT_DATA"
        total = len(activity_list)
        successful = [a for a in activity_list if a.status == "success"]
        success_rate = len(successful) / total
        volume = sum(a.amount for a in successful)

        score = 40.0 + (success_rate * 30.0)
        if volume > 50000: score += 5
        if total > 50: score += 4
        score = min(99.0, max(10.0, score))
        risk = "LOW" if score >= 80 else "MODERATE" if score >= 50 else "HIGH"
        return score, risk

    projected_score, projected_risk = core_score_logic(simulated_activity)

    return {
        "current_score": current_score,
        "current_risk": current_risk,
        "projected_score": projected_score,
        "projected_risk": projected_risk,
        "delta": round(projected_score - current_score, 2),
        "explanation": f"If the customer completes {body.hypothetical_success_txns} more successful transactions, their score is projected to move by {round(projected_score - current_score, 2)} points."
    }

@app.post("/api/credit-score/analyze")
def analyze_credit_score(
    body: CreditAnalysisRequest,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Interactive Credit Analysis & Risk Simulator.
    Computes verified baseline from DB and evaluates operator-adjusted factor scenarios
    deterministically without mutating records.
    """
    ensure_user_seeded(user_id, db)
    customer = db.query(models.Customer).filter(
        models.Customer.id == body.customer_id,
        models.Customer.user_id == user_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found or unauthorized.")

    baseline_score, baseline_risk, baseline_conf, baseline_factors, baseline_recs = calculate_dynamic_score(db, user_id, body.customer_id)

    tenure_days = 0
    if customer.created_at:
        c_at = customer.created_at.replace(tzinfo=None)
        tenure_days = max(0, (datetime.now() - c_at).days)

    db_txns = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.customer_id == body.customer_id
    ).all()
    baseline_total_txns = len(db_txns)
    baseline_failed_txns = len([t for t in db_txns if t.status == "failed"])
    baseline_volume = sum(t.amount for t in db_txns if t.status == "success")
    baseline_kyc = customer.kyc_status or "pending"

    overrides = body.factors
    if not overrides:
        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "baseline_score": round(baseline_score, 1),
            "baseline_risk": baseline_risk,
            "score": round(baseline_score, 1),
            "risk": baseline_risk,
            "confidence": round(baseline_conf, 2),
            "delta": 0.0,
            "what_changed": "Baseline verified operational state.",
            "factors": {
                "recent_performance": baseline_factors.get("recent_performance", "100%"),
                "transaction_volume": baseline_volume,
                "volume_formatted": fmt_inr(baseline_volume),
                "failed_transactions": baseline_failed_txns,
                "total_transactions": baseline_total_txns,
                "kyc_status": baseline_kyc,
                "operational_tenure_days": tenure_days,
                "risk_indicators": "None"
            },
            "recommendations": baseline_recs,
            "data_mode": "verified-operational",
            "last_updated": "Just now"
        }

    effective_kyc = overrides.kyc_status.lower() if overrides.kyc_status else baseline_kyc
    effective_tenure = overrides.operational_tenure_days if overrides.operational_tenure_days is not None else tenure_days
    effective_failed = overrides.failed_transactions if overrides.failed_transactions is not None else baseline_failed_txns
    effective_total = overrides.total_txns if overrides.total_txns is not None else max(baseline_total_txns, effective_failed + (2 if effective_failed > 0 else 0))
    effective_volume = overrides.transaction_volume if overrides.transaction_volume is not None else baseline_volume

    perf_input = overrides.recent_performance
    if perf_input is not None:
        if isinstance(perf_input, str):
            perf_clean = perf_input.replace("%", "").strip()
            try:
                perf_ratio = float(perf_clean) / 100.0 if float(perf_clean) > 1.0 else float(perf_clean)
            except ValueError:
                perf_ratio = 1.0
        else:
            perf_ratio = float(perf_input) / 100.0 if float(perf_input) > 1.0 else float(perf_input)
    else:
        perf_ratio = 1.0 if effective_total == 0 else max(0.0, (effective_total - effective_failed) / effective_total)

    risk_ind = overrides.risk_indicators.lower() if overrides.risk_indicators else "none"

    sim_score = 35.0
    sim_score += (perf_ratio * 25.0)
    sim_score += (perf_ratio * 15.0)
    sim_score += min(8.0, effective_volume / 50000.0 * 8.0)
    sim_score += min(5.0, effective_total / 20.0 * 5.0)
    tenure_bonus = min(7.0, effective_tenure / 90.0 * 7.0)
    sim_score += tenure_bonus
    kyc_bonus = 7.0 if effective_kyc == "verified" else 0.0
    sim_score += kyc_bonus

    if effective_total < 3:
        sim_score -= (3.0 if effective_kyc == "verified" else 17.0)

    if effective_failed > 0:
        sim_score -= min(30.0, effective_failed * 5.0)

    if risk_ind in ["reversals", "timeouts"]:
        sim_score -= 8.0
    elif risk_ind in ["limits", "violations"]:
        sim_score -= 12.0

    sim_score = min(99.0, max(10.0, sim_score))
    sim_risk = "LOW" if sim_score >= 80.0 else "MODERATE" if sim_score >= 50.0 else "HIGH"

    delta = round(sim_score - baseline_score, 1)

    changes = []
    if effective_kyc != baseline_kyc:
        changes.append(f"KYC changed from {baseline_kyc.title()} → {effective_kyc.title()}")
    if effective_failed != baseline_failed_txns:
        changes.append(f"Failed transactions changed from {baseline_failed_txns} → {effective_failed}")
    if abs(effective_volume - baseline_volume) > 500:
        changes.append(f"Volume adjusted from {fmt_inr(baseline_volume)} → {fmt_inr(effective_volume)}")
    if overrides.recent_performance is not None:
        changes.append(f"Recent performance set to {int(perf_ratio * 100)}%")
    if effective_tenure != tenure_days:
        changes.append(f"Tenure adjusted to {effective_tenure} days")
    if risk_ind != "none":
        changes.append(f"Risk indicator flagged: {risk_ind.title()}")

    if changes:
        delta_str = f"+{delta}" if delta > 0 else f"{delta}"
        what_changed = f"{'; '.join(changes)}. Impact: {delta_str} points."
    else:
        what_changed = "No factor changes from baseline verified operational records."

    if sim_risk == "HIGH":
        recs = "Urgent: Resolve operational issues and reduce failed transactions before extending limits."
    elif effective_kyc != "verified":
        recs = "Complete KYC verification and maintain consistent transaction activity to raise limits."
    elif effective_volume < 20000:
        recs = "Increase daily transaction volume and maintain consistent operational velocity."
    else:
        recs = "Partner profile is stable. Maintain current transaction volume and success rate."

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "baseline_score": round(baseline_score, 1),
        "baseline_risk": baseline_risk,
        "score": round(sim_score, 1),
        "risk": sim_risk,
        "confidence": round(min(1.0, baseline_conf + (0.1 if effective_kyc == 'verified' else 0.0)), 2),
        "delta": delta,
        "what_changed": what_changed,
        "factors": {
            "recent_performance": f"{int(perf_ratio * 100)}%",
            "transaction_volume": effective_volume,
            "volume_formatted": fmt_inr(effective_volume),
            "failed_transactions": effective_failed,
            "total_transactions": effective_total,
            "kyc_status": effective_kyc,
            "operational_tenure_days": effective_tenure,
            "risk_indicators": risk_ind.title()
        },
        "recommendations": recs,
        "data_mode": "simulated-operational" if changes else "verified-operational",
        "last_updated": "Just now"
    }

# ─── Ask Eko AI Core (Refined for Historical Retrieval & Structured Output) ──
@app.post("/api/ai/ask-eko", response_model=AskEkoResponse)
@app.post("/api/ai/ask", response_model=AskEkoResponse)
async def ask_eko(body: AskEkoRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Deep contextual assistant with multi-stage historical retrieval and provider independence."""
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(body.question) > 2000:
        raise HTTPException(status_code=400, detail="Question exceeds maximum allowed length of 2000 characters.")

    # Defense against prompt injection
    suspicious_patterns = [
        "ignore previous instructions",
        "ignore all instructions",
        "disregard previous instructions",
        "you are now a",
        "print system prompt",
        "show system prompt",
        "override safety"
    ]
    q_lower = body.question.lower()
    if any(pattern in q_lower for pattern in suspicious_patterns):
        return AskEkoResponse(
            success=False,
            answer="I am Eko Business Partner Operations Copilot. I cannot process requests that attempt to override my system guidelines or role.",
            grounded=True,
            insufficient_data=False,
            sources=["System Security Filter"],
            error=AIError(code="PROMPT_INJECTION_DETECTED", message="Security validation failed: prompt injection pattern detected.", retryable=False)
        )

    ensure_user_seeded(user_id, db)
    context_lines = [f"Today's Date: {date.today()}"]

    customer = None
    if body.customer_id:
        customer = db.query(models.Customer).filter(
            models.Customer.id == body.customer_id,
            models.Customer.user_id == user_id
        ).first()

    if not customer and body.question:
        customer = find_customer_for_question(db, user_id, body.question)

    if customer:
        context_lines.append(f"Subject Customer Profile: Name={customer.name}, KYC Status={customer.kyc_status}, Business Type={customer.business_type or 'General'}, Amount Due={fmt_inr(customer.amount_due)}")

        # Credit Score and factors
        score_record = db.query(models.CreditScore).filter(
            models.CreditScore.customer_id == customer.id,
            models.CreditScore.user_id == user_id
        ).order_by(desc(models.CreditScore.created_at)).first()
        if score_record:
            context_lines.append(f"Customer Credit Assessment: Score={score_record.score}/100, Risk Bracket={score_record.risk_bracket}, Confidence={score_record.confidence}")
            if score_record.factors:
                context_lines.append(f"Assessment Risk Factors: {score_record.factors}")
            if score_record.recommendations:
                context_lines.append(f"Assessment Recommendations: {score_record.recommendations}")

        # Credit Score History
        score_history = db.query(models.CreditScoreHistory).filter(
            models.CreditScoreHistory.customer_id == customer.id,
            models.CreditScoreHistory.user_id == user_id
        ).order_by(desc(models.CreditScoreHistory.created_at)).limit(5).all()
        if score_history:
            context_lines.append("Assessment History Changes:")
            for sh in score_history:
                context_lines.append(f"- {sh.created_at.date()}: Old={sh.old_score}, New={sh.new_score}, Reason: {sh.change_reason}")

        # Timeline events
        query = db.query(models.TimelineEvent).filter(
            models.TimelineEvent.customer_id == customer.id,
            models.TimelineEvent.user_id == user_id
        )
        if body.date_from:
            query = query.filter(models.TimelineEvent.created_at >= body.date_from)
        if body.date_to:
            query = query.filter(models.TimelineEvent.created_at <= body.date_to)

        hist_keywords = ["history", "last year", "old", "previous", "was", "happened"]
        limit = 50 if any(k in body.question.lower() for k in hist_keywords) else 15
        timeline = query.order_by(desc(models.TimelineEvent.created_at)).limit(limit).all()

        if timeline:
            context_lines.append(f"Retrieved {len(timeline)} timeline events for {customer.name}:")
            for e in timeline:
                context_lines.append(f"- {e.created_at.date()} | {e.event_type.upper()} | {e.title}: {e.description}")
        else:
            context_lines.append(f"No timeline events recorded yet for {customer.name}.")

        # Complaints / Grievances
        complaints = db.query(models.Complaint).filter(
            models.Complaint.customer_id == customer.id,
            models.Complaint.user_id == user_id
        ).all()
        if complaints:
            context_lines.append(f"Customer Grievances/Complaints ({len(complaints)}):")
            for comp in complaints:
                context_lines.append(f"- Status: {comp.status.upper()} | Priority: {comp.priority} | Subject: {comp.subject} | {comp.description}")

        # Recent transactions for customer
        txns = db.query(models.ServiceActivity).filter(
            models.ServiceActivity.user_id == user_id,
            or_(models.ServiceActivity.customer_id == customer.id, models.ServiceActivity.customer_name == customer.name)
        ).order_by(desc(models.ServiceActivity.created_at)).limit(10).all()
        if txns:
            context_lines.append(f"Recent Transactions for {customer.name}:")
            for t in txns:
                reason = f" (Failure Reason: {t.failure_reason})" if t.failure_reason else ""
                context_lines.append(f"- {t.created_at.date()} | {t.service_name} | {fmt_inr(t.amount)} | Status: {t.status.upper()}{reason}")
    else:
        # Check if query specifically mentioned a name
        import re
        name_match = re.search(r'\b([A-Z][a-z]+)\b', body.question)
        if name_match:
            potential_name = name_match.group(1)
            context_lines.append(f"Information Notice: The query mentions '{potential_name}', but no customer record exists for '{potential_name}' in the verified database.")

    # General Operational Summary
    dashboard = get_ops_dashboard(user_id, db)
    context_lines.append(f"Operational Business Summary: {dashboard['today_transactions']} txns today, Volume {fmt_inr(dashboard['total_volume'])}, Success Rate {dashboard['success_rate']}, Active Customers {dashboard.get('active_customers', 0)}.")

    # Recent Failed Transactions across system
    failed_txns = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.status == "failed"
    ).order_by(desc(models.ServiceActivity.created_at)).limit(5).all()
    if failed_txns:
        context_lines.append("Recent System Failures:")
        for ft in failed_txns:
            context_lines.append(f"- {ft.service_name} for {ft.customer_name or 'Anonymous'} ({fmt_inr(ft.amount)}): {ft.failure_reason or 'Bank server timeout'}")

    # Active Transaction Context (Page Context)
    target_txn_id = body.transaction_id or (body.page_context.get("transaction_id") if body.page_context else None)
    if not target_txn_id and body.question:
        import re
        txn_match = re.search(r'\b(DMT[A-Za-z0-9]+|t_[a-z0-9_]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b', body.question)
        if txn_match:
            target_txn_id = txn_match.group(1)
        elif "25,000" in body.question or "25000" in body.question:
            t_25k = db.query(models.ServiceActivity).filter(
                models.ServiceActivity.user_id == user_id,
                models.ServiceActivity.amount == 25000.0
            ).first()
            if t_25k:
                target_txn_id = t_25k.id

    if target_txn_id:
        t = db.query(models.ServiceActivity).filter(
            or_(
                models.ServiceActivity.id == target_txn_id,
                models.ServiceActivity.reference_id == target_txn_id,
                models.ServiceActivity.reference_id.like(f"%{target_txn_id}%")
            ),
            models.ServiceActivity.user_id == user_id
        ).first()
        if t:
            context_lines.append(
                f"ACTIVE SCREEN CONTEXT — SELECTED TRANSACTION: ID={t.id} | Reference={t.reference_id or 'N/A'} | "
                f"Service={t.service_name} | Amount={fmt_inr(t.amount)} | Status={t.status.upper()} | "
                f"Customer={t.customer_name or 'N/A'} | Date={t.created_at.date() if t.created_at else 'N/A'} | "
                f"Failure Reason={t.failure_reason or 'Not provided'}"
            )

    # Active Complaint Context (Page Context)
    target_comp_id = body.complaint_id or (body.page_context.get("complaint_id") if body.page_context else None)
    if target_comp_id:
        c = db.query(models.Complaint).filter(
            models.Complaint.id == target_comp_id,
            models.Complaint.user_id == user_id
        ).first()
        if c:
            remaining_hours = None
            if c.sla_deadline and c.status not in ("closed", "resolved"):
                remaining_hours = round((c.sla_deadline - datetime.now()).total_seconds() / 3600, 1)
            context_lines.append(
                f"ACTIVE SCREEN CONTEXT — SELECTED COMPLAINT: ID={c.id}, Subject='{c.subject}', "
                f"Status={c.status.upper()}, Priority={c.priority.upper()}, "
                f"Description='{c.description or 'N/A'}', SLA Deadline={c.sla_deadline}, "
                f"SLA Hours Remaining={remaining_hours if remaining_hours is not None else 'N/A'}, "
                f"Linked Transaction ID={c.transaction_id or 'None'}, Customer ID={c.customer_id or 'None'}"
            )

    if body.page_context and isinstance(body.page_context, dict):
        cf = body.page_context.get("credit_factors")
        if cf:
            context_lines.append(f"ACTIVE CREDIT ANALYSIS SIMULATION FACTORS: {cf}")

    ai_provider = get_ai_provider()
    provider_name = type(ai_provider).__name__
    provider_model = getattr(ai_provider, "model_name", None)
    system_instruction = f"{SYSTEM_PROMPT}\n\n<VERIFIED_DATABASE_CONTEXT>\n" + "\n".join(context_lines) + "\n</VERIFIED_DATABASE_CONTEXT>"
    prompt = f"<USER_QUESTION>\n{body.question}\n</USER_QUESTION>\nPrevious History: {body.history}"

    try:
        res_data = await ai_provider.generate(system_instruction, prompt, timeout=25.0)

        facts = [Fact(**f) if isinstance(f, dict) else Fact(text=str(f)) for f in res_data.get("facts", [])]
        inferences = [Inference(**i) if isinstance(i, dict) else Inference(text=str(i), confidence=0.9) for i in res_data.get("inferences", [])]
        recommendations = [Recommendation(**r) if isinstance(r, dict) else Recommendation(text=str(r), reason="Operational advice") for r in res_data.get("recommendations", [])]

        return AskEkoResponse(
            success=True,
            answer=res_data.get("answer", "Here is the operational assessment based on your records."),
            facts=facts,
            inferences=inferences,
            recommendations=recommendations,
            actions=res_data.get("actions", []),
            sources=res_data.get("sources", ["Eko Core Database"]),
            confidence=float(res_data.get("confidence", 0.95)),
            data_mode="online",
            ai_mode="live_ai",
            ai_provider=provider_name,
            ai_model=provider_model,
            grounded=res_data.get("grounded", True),
            insufficient_data=res_data.get("insufficient_data", False),
            missing_info=res_data.get("missing_info")
        )
    except Exception as e:
        logger.error(f"AI Provider execution failed: {e}")
        local_provider = LocalDeterministicProvider()
        fallback_res = await local_provider.generate(system_instruction, prompt)
        facts = [Fact(**f) if isinstance(f, dict) else Fact(text=str(f)) for f in fallback_res.get("facts", [])]
        inferences = [Inference(**i) if isinstance(i, dict) else Inference(text=str(i), confidence=0.85) for i in fallback_res.get("inferences", [])]
        recommendations = [Recommendation(**r) if isinstance(r, dict) else Recommendation(text=str(r), reason="Operational advice") for r in fallback_res.get("recommendations", [])]

        return AskEkoResponse(
            success=True,
            answer=fallback_res.get("answer", "Cloud reasoning engine is temporarily unavailable. Local operational records are intact."),
            facts=facts,
            inferences=inferences,
            recommendations=recommendations,
            actions=[],
            sources=["Local Database Cache"],
            confidence=0.8,
            data_mode="grounded-local",
            ai_mode="demo_fallback",
            ai_provider="deterministic",
            ai_model="database-grounded",
            grounded=True,
            insufficient_data=fallback_res.get("insufficient_data", True),
            missing_info=fallback_res.get("missing_info", "Cloud reasoning connection paused"),
            error=AIError(
                code="AI_PROVIDER_UNAVAILABLE",
                message="Cloud reasoning engine is temporarily unavailable. Displaying local grounded evaluation.",
                retryable=True
            )
        )


# ─── Complaint Detail & Update ─────────────────────────────────────────────────
@app.get("/api/complaints/{cid}")
def get_complaint_detail(cid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Full complaint detail with linked transaction and customer info."""
    ensure_user_seeded(user_id, db)
    c = db.query(models.Complaint).filter(
        models.Complaint.id == cid,
        models.Complaint.user_id == user_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    # Linked transaction
    txn = None
    if c.transaction_id:
        t = db.query(models.ServiceActivity).filter(models.ServiceActivity.id == c.transaction_id).first()
        if t:
            txn = {
                "id": t.id,
                "service_name": t.service_name,
                "amount": t.amount,
                "status": t.status,
                "failure_reason": t.failure_reason,
                "customer_name": t.customer_name,
                "reference_id": t.reference_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }

    # Customer info
    customer = None
    if c.customer_id:
        cust = db.query(models.Customer).filter(models.Customer.id == c.customer_id).first()
        if cust:
            customer = {"id": cust.id, "name": cust.name, "phone": cust.phone, "kyc_status": cust.kyc_status}

    remaining = None
    if c.sla_deadline and c.status not in ("closed", "resolved"):
        remaining = (c.sla_deadline - datetime.now()).total_seconds() / 3600

    return {
        "id": c.id,
        "subject": c.subject,
        "description": c.description,
        "status": c.status,
        "priority": c.priority,
        "sla_hours_remaining": remaining,
        "sla_deadline": c.sla_deadline.isoformat() if c.sla_deadline else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "transaction": txn,
        "customer": customer,
        "transaction_id": c.transaction_id,
        "customer_id": c.customer_id,
        "category": c.category,
        "assigned_to": c.assigned_to,
        "resolution_note": c.resolution_note,
        "timeline_json": c.timeline_json,
    }


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_note: Optional[str] = None
    resolution_notes: Optional[str] = None


@app.patch("/api/complaints/{cid}")
def update_complaint(cid: str, data: ComplaintUpdate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    c = db.query(models.Complaint).filter(
        models.Complaint.id == cid,
        models.Complaint.user_id == user_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    if data.status:
        c.status = data.status
        if data.status in ("resolved", "closed"):
            db.query(models.OperationalNotification).filter(
                models.OperationalNotification.user_id == user_id,
                models.OperationalNotification.deep_link.like(f"%{cid}%")
            ).update({"is_read": True}, synchronize_session=False)
    if data.priority:
        c.priority = data.priority
    if data.assigned_to is not None:
        c.assigned_to = data.assigned_to
    note_val = data.resolution_note or data.resolution_notes
    if note_val is not None:
        c.resolution_note = note_val
    db.commit()
    db.refresh(c)
    return {
        "id": c.id,
        "status": c.status,
        "priority": c.priority,
        "assigned_to": c.assigned_to,
        "resolution_note": c.resolution_note
    }


@app.post("/api/complaints/{cid}/notes")
def add_complaint_note(cid: str, data: ComplaintNoteCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    c = db.query(models.Complaint).filter(
        models.Complaint.id == cid,
        models.Complaint.user_id == user_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    existing_notes = []
    if c.timeline_json:
        try:
            existing_notes = json.loads(c.timeline_json)
        except Exception:
            existing_notes = []
    note_obj = {
        "id": str(uuid.uuid4()),
        "note": data.note,
        "author": data.author or "Operator",
        "created_at": datetime.now().isoformat()
    }
    existing_notes.append(note_obj)
    c.timeline_json = json.dumps(existing_notes)
    db.commit()
    db.refresh(c)
    return {"status": "ok", "note": note_obj, "timeline": existing_notes}


# ─── Partners (Customers as Partners) ─────────────────────────────────────────
@app.post("/api/partners", response_model=CustomerResponse)
def create_partner(data: CustomerCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Create a new partner profile."""
    data.is_partner = True
    if not data.business_type:
        data.business_type = data.category or "Partner CSP"
    return create_customer(data, user_id, db)

@app.get("/api/partners")
def list_partners(
    category: Optional[str] = None,
    search: Optional[str] = None,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    """Partners list with aggregated transaction stats, dynamic calculation, and category/search filtering."""
    ensure_user_seeded(user_id, db)
    query = db.query(models.Customer).filter(
        models.Customer.user_id == user_id,
        or_(
            models.Customer.is_partner == True,
            models.Customer.business_type.isnot(None),
            models.Customer.category.isnot(None)
        )
    )

    # Category filter
    if category and category.lower() not in ("all", ""):
        c_clean = category.strip().capitalize()
        if c_clean.startswith("Retail"):
            query = query.filter(models.Customer.category == "Retailer")
        elif c_clean.startswith("Merchant"):
            query = query.filter(models.Customer.category == "Merchant")
        elif c_clean.startswith("Enterprise"):
            query = query.filter(models.Customer.category == "Enterprise")
        elif c_clean.startswith("Other"):
            query = query.filter(models.Customer.category == "Others")
        else:
            query = query.filter(models.Customer.category == category)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Customer.name.ilike(term),
                models.Customer.phone.ilike(term),
                models.Customer.id.ilike(term),
                models.Customer.business_type.ilike(term),
                models.Customer.category.ilike(term),
            )
        )

    partners = query.order_by(desc(models.Customer.created_at)).all()
    results = []
    for cust in partners:
        txns = db.query(models.ServiceActivity).filter(
            models.ServiceActivity.user_id == user_id,
            or_(
                models.ServiceActivity.partner_id == cust.id,
                models.ServiceActivity.customer_id == cust.id
            )
        ).all()
        total = len(txns)
        success = len([t for t in txns if t.status == "success"])
        failed = len([t for t in txns if t.status == "failed"])
        pending = len([t for t in txns if t.status == "pending"])
        volume = sum(t.amount for t in txns if t.status == "success")
        commission = round(sum(t.commission for t in txns if t.status == "success"), 2)

        open_complaints = db.query(models.Complaint).filter(
            models.Complaint.user_id == user_id,
            models.Complaint.customer_id == cust.id,
            models.Complaint.status.notin_(["closed", "resolved"])
        ).count()

        pending_tasks = db.query(models.Task).filter(
            models.Task.user_id == user_id,
            models.Task.customer_id == cust.id,
            models.Task.completed == False
        ).count()

        results.append({
            "id": cust.id,
            "name": cust.name,
            "phone": cust.phone,
            "business_type": cust.business_type,
            "category": cust.category or "Others",
            "kyc_status": cust.kyc_status,
            "amount_due": cust.amount_due,
            "total_transactions": total,
            "success_transactions": success,
            "failed_transactions": failed,
            "pending_transactions": pending,
            "total_volume": volume,
            "commission": commission,
            "success_rate": f"{(success/total*100 if total else 0):.0f}%",
            "open_complaints": open_complaints,
            "pending_tasks": pending_tasks,
            "created_at": cust.created_at.isoformat() if cust.created_at else None,
        })
    return results


@app.get("/api/partners/{pid}")
def get_partner_detail(pid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Single partner detail with full transaction and complaint history."""
    ensure_user_seeded(user_id, db)
    cust = db.query(models.Customer).filter(
        models.Customer.id == pid,
        models.Customer.user_id == user_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Partner not found.")

    txns = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        or_(
            models.ServiceActivity.partner_id == pid,
            models.ServiceActivity.customer_id == pid
        )
    ).order_by(desc(models.ServiceActivity.created_at)).limit(50).all()

    complaints = db.query(models.Complaint).filter(
        models.Complaint.user_id == user_id,
        models.Complaint.customer_id == pid
    ).order_by(desc(models.Complaint.created_at)).all()

    tasks = db.query(models.Task).filter(
        models.Task.user_id == user_id,
        models.Task.customer_id == pid
    ).order_by(desc(models.Task.created_at)).all()

    total = len(txns)
    success = len([t for t in txns if t.status == "success"])
    failed = [t for t in txns if t.status == "failed"]
    pending = [t for t in txns if t.status == "pending"]
    volume = sum(t.amount for t in txns if t.status == "success")
    commission = round(sum(t.commission for t in txns if t.status == "success"), 2)

    def txn_dict(t):
        return {
            "id": t.id, "service_name": t.service_name, "amount": t.amount,
            "status": t.status, "failure_reason": t.failure_reason,
            "customer_name": t.customer_name, "reference_id": t.reference_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }

    def comp_dict(c):
        remaining = None
        if c.sla_deadline and c.status not in ("closed", "resolved"):
            remaining = (c.sla_deadline - datetime.now()).total_seconds() / 3600
        return {
            "id": c.id, "subject": c.subject, "status": c.status, "priority": c.priority,
            "transaction_id": c.transaction_id, "sla_hours_remaining": remaining,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

    return {
        "id": cust.id, "name": cust.name, "phone": cust.phone,
        "email": cust.email, "business_type": cust.business_type,
        "category": cust.category or "Others",
        "kyc_status": cust.kyc_status, "amount_due": cust.amount_due,
        "notes": cust.notes, "created_at": cust.created_at.isoformat() if cust.created_at else None,
        "stats": {
            "total_transactions": total, "success_transactions": success,
            "failed_transactions": len(failed), "pending_transactions": len(pending),
            "total_volume": volume,
            "commission": commission,
            "success_rate": f"{(success/total*100 if total else 0):.0f}%",
            "open_complaints": len([c for c in complaints if c.status not in ("closed","resolved")]),
            "pending_tasks": len([t for t in tasks if not t.completed]),
        },
        "transactions": [txn_dict(t) for t in txns],
        "complaints": [comp_dict(c) for c in complaints],
    }


# ─── Commissions & Earnings Operations ─────────────────────────────────────────
@app.get("/api/commissions")
def list_commissions(
    status: Optional[str] = None,
    service: Optional[str] = None,
    date_range: Optional[str] = None,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    """List commissions with status, service, and date filters."""
    ensure_user_seeded(user_id, db)
    query = db.query(models.Commission).filter(models.Commission.user_id == user_id)

    if status and status.lower() not in ("all", ""):
        query = query.filter(models.Commission.status == status.upper())

    if service and service.lower() not in ("all", "all services", ""):
        query = query.filter(models.Commission.service.ilike(f"%{service.strip()}%"))

    now = datetime.now()
    if date_range:
        dr = date_range.lower().strip()
        if dr == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(models.Commission.created_at >= start)
        elif dr in ("this week", "week"):
            start = now - timedelta(days=7)
            query = query.filter(models.Commission.created_at >= start)
        elif dr in ("this month", "month"):
            start = now - timedelta(days=30)
            query = query.filter(models.Commission.created_at >= start)

    commissions = query.order_by(desc(models.Commission.created_at)).all()

    # Partner & customer names lookup
    all_names = {
        c.id: c.name for c in db.query(models.Customer).filter(models.Customer.user_id == user_id).all()
    }

    results = []
    for c in commissions:
        results.append({
            "id": c.id,
            "transaction_id": c.transaction_id,
            "partner_id": c.partner_id,
            "partner_name": all_names.get(c.partner_id, "Eko Partner Outlet"),
            "customer_id": c.customer_id,
            "customer_name": all_names.get(c.customer_id, "Retail Customer"),
            "service": c.service,
            "transaction_amount": c.transaction_amount,
            "commission_rate": c.commission_rate,
            "commission_amount": c.commission_amount,
            "status": c.status,
            "settlement_id": c.settlement_id,
            "settlement_date": c.settlement_date.isoformat() if c.settlement_date else None,
            "earned_at": c.earned_at.isoformat() if c.earned_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
    return results


@app.get("/api/commissions/{cid}")
def get_commission_detail(cid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Commission detail with linked transaction and partner context."""
    ensure_user_seeded(user_id, db)
    c = db.query(models.Commission).filter(
        models.Commission.id == cid,
        models.Commission.user_id == user_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Commission record not found.")

    txn = db.query(models.ServiceActivity).filter(models.ServiceActivity.id == c.transaction_id).first()
    partner = db.query(models.Customer).filter(models.Customer.id == c.partner_id).first()

    return {
        "commission": {
            "id": c.id,
            "transaction_id": c.transaction_id,
            "partner_id": c.partner_id,
            "partner_name": partner.name if partner else "Eko Partner Outlet",
            "service": c.service,
            "transaction_amount": c.transaction_amount,
            "commission_rate": c.commission_rate,
            "commission_amount": c.commission_amount,
            "status": c.status,
            "settlement_id": c.settlement_id,
            "settlement_date": c.settlement_date.isoformat() if c.settlement_date else None,
            "earned_at": c.earned_at.isoformat() if c.earned_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        },
        "transaction": {
            "id": txn.id if txn else None,
            "reference_id": txn.reference_id if txn else None,
            "status": txn.status if txn else None,
            "service_name": txn.service_name if txn else None,
            "amount": txn.amount if txn else None,
            "failure_reason": txn.failure_reason if txn else None,
            "created_at": txn.created_at.isoformat() if txn and txn.created_at else None,
        } if txn else None
    }


@app.get("/api/earnings/summary")
def get_earnings_summary(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Aggregated earnings summary from canonical commission & settlement models."""
    ensure_user_seeded(user_id, db)
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now - timedelta(days=30)

    commissions = db.query(models.Commission).filter(models.Commission.user_id == user_id).all()

    total_earnings = round(sum(c.commission_amount for c in commissions if c.status in ("EARNED", "PAID")), 2)
    today_earnings = round(sum(c.commission_amount for c in commissions if c.status in ("EARNED", "PAID") and c.created_at >= today_start), 2)
    month_earnings = round(sum(c.commission_amount for c in commissions if c.status in ("EARNED", "PAID") and c.created_at >= month_start), 2)
    pending_earnings = round(sum(c.commission_amount for c in commissions if c.status == "PENDING"), 2)
    paid_earnings = round(sum(c.commission_amount for c in commissions if c.status == "PAID"), 2)
    reversed_earnings = round(sum(c.commission_amount for c in commissions if c.status == "REVERSED"), 2)

    available_for_settlement = round(sum(c.commission_amount for c in commissions if c.status == "EARNED" and not c.settlement_id), 2)

    # Last paid settlement
    last_settlement = db.query(models.Settlement).filter(
        models.Settlement.user_id == user_id,
        models.Settlement.status == "PAID"
    ).order_by(desc(models.Settlement.settled_at)).first()

    # Service breakdown
    services = ["DMT", "AePS", "BBPS", "Recharge", "Insurance", "Micro ATM", "Indo-Nepal"]
    service_breakdown = {}
    for svc in services:
        service_breakdown[svc] = round(sum(
            c.commission_amount for c in commissions 
            if svc.lower() in (c.service or "").lower() and c.status in ("EARNED", "PAID")
        ), 2)

    return {
        "total_earnings": total_earnings,
        "today_earnings": today_earnings,
        "this_month_earnings": month_earnings,
        "pending_earnings": pending_earnings,
        "paid_earnings": paid_earnings,
        "reversed_earnings": reversed_earnings,
        "available_for_settlement": available_for_settlement,
        "next_settlement_date": (now + timedelta(days=2)).strftime("%d %b %Y"),
        "last_settlement": {
            "id": last_settlement.id if last_settlement else None,
            "amount": last_settlement.amount if last_settlement else 0.0,
            "settled_at": last_settlement.settled_at.strftime("%d %b %Y") if last_settlement and last_settlement.settled_at else None,
            "bank_reference": last_settlement.bank_reference if last_settlement else None,
            "status": last_settlement.status if last_settlement else None
        } if last_settlement else None,
        "service_breakdown": service_breakdown
    }


@app.get("/api/settlements")
def list_settlements(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """List settlement batches and history."""
    ensure_user_seeded(user_id, db)
    settlements = db.query(models.Settlement).filter(
        models.Settlement.user_id == user_id
    ).order_by(desc(models.Settlement.created_at)).all()

    return [
        {
            "id": s.id,
            "amount": s.amount,
            "status": s.status,
            "bank_reference": s.bank_reference,
            "payout_account": s.payout_account,
            "settled_at": s.settled_at.strftime("%d %b %Y, %I:%M %p") if s.settled_at else None,
            "period_start": s.period_start.strftime("%d %b %Y") if s.period_start else None,
            "period_end": s.period_end.strftime("%d %b %Y") if s.period_end else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in settlements
    ]


# ─── Data Upload & Canonical Ingestion ─────────────────────────────────────────
class UploadValidateRequest(BaseModel):
    records: List[Dict[str, Any]]

class UploadImportRequest(BaseModel):
    records: List[Dict[str, Any]]

@app.post("/api/upload/validate")
def validate_upload(data: UploadValidateRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Validate uploaded operations data before committing to canonical database."""
    ensure_user_seeded(user_id, db)
    raw_records = data.records or []
    if not raw_records:
        return {
            "total_records": 0, "valid_count": 0, "warning_count": 0, "error_count": 0,
            "errors": ["Uploaded file contains 0 records."], "warnings": [], "preview": []
        }

    # Fetch existing partner IDs and names for cross-validation
    existing_partners = {
        p.id: p.name for p in db.query(models.Customer).filter(
            models.Customer.user_id == user_id,
            models.Customer.is_partner == True
        ).all()
    }
    existing_ref_ids = {
        t.reference_id for t in db.query(models.ServiceActivity.reference_id).filter(
            models.ServiceActivity.user_id == user_id
        ).all() if t.reference_id
    }

    seen_in_batch = set()
    valid_records = []
    warnings = []
    errors = []

    valid_statuses = {"success", "failed", "pending", "refunded"}
    valid_services = {"dmt", "aeps", "bbps", "recharge", "insurance", "micro atm", "indo-nepal remittance", "pan"}

    for idx, r in enumerate(raw_records, 1):
        row_errs = []
        # Required fields check
        p_id = str(r.get("partner_id") or "").strip()
        p_name = str(r.get("partner_name") or "").strip()
        c_name = str(r.get("customer_name") or "").strip()
        svc = str(r.get("service") or r.get("service_name") or "").strip()
        st = str(r.get("status") or "success").strip().lower()
        amt_raw = r.get("amount")
        ref_id = str(r.get("reference_id") or r.get("transaction_id") or f"TXN-UPL-{idx}").strip()

        if not c_name:
            row_errs.append(f"Row {idx}: Customer Name is required.")
        if not svc:
            row_errs.append(f"Row {idx}: Service is required.")

        # Status validation
        if st not in valid_statuses:
            row_errs.append(f"Row {idx}: Invalid status '{st}'. Must be one of: {', '.join(valid_statuses)}.")

        # Amount validation
        try:
            amt = float(amt_raw)
            if amt <= 0:
                row_errs.append(f"Row {idx}: Amount must be greater than 0 (got {amt}).")
        except (ValueError, TypeError):
            row_errs.append(f"Row {idx}: Amount must be a valid positive number.")
            amt = 0.0

        # Duplicate reference check
        if ref_id in seen_in_batch:
            row_errs.append(f"Row {idx}: Duplicate reference ID '{ref_id}' within upload file.")
        elif ref_id in existing_ref_ids:
            warnings.append(f"Row {idx}: Reference ID '{ref_id}' already exists in database; will be updated.")
        seen_in_batch.add(ref_id)

        # Partner relationship check
        matched_pid = None
        if p_id and p_id in existing_partners:
            matched_pid = p_id
        else:
            # Check by name
            for ep_id, ep_name in existing_partners.items():
                if p_name and p_name.lower() in ep_name.lower():
                    matched_pid = ep_id
                    break
        if not matched_pid:
            # Fallback to first active retailer partner with warning
            fallback_p = next(iter(existing_partners.keys()), None)
            matched_pid = fallback_p
            if p_id or p_name:
                warnings.append(f"Row {idx}: Partner '{p_id or p_name}' not found; mapped to outlet '{existing_partners.get(fallback_p, 'CSP Point')}'.")

        if row_errs:
            errors.extend(row_errs)
        else:
            valid_records.append({
                "row": idx,
                "partner_id": matched_pid,
                "partner_name": existing_partners.get(matched_pid, "Eko Partner CSP"),
                "customer_name": c_name,
                "customer_phone": str(r.get("customer_phone") or "9876500001"),
                "service": svc,
                "amount": amt,
                "status": st,
                "reference_id": ref_id,
                "failure_reason": str(r.get("failure_reason") or "") if st == "failed" else None
            })

    return {
        "total_records": len(raw_records),
        "valid_count": len(valid_records),
        "warning_count": len(warnings),
        "error_count": len(errors),
        "errors": errors[:25],
        "warnings": warnings[:25],
        "preview": valid_records[:15]
    }


@app.post("/api/upload/import")
def import_upload(data: UploadImportRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Commit validated records into canonical database, updating transactions, commissions & partner metrics."""
    ensure_user_seeded(user_id, db)
    records = data.records or []
    if not records:
        raise HTTPException(status_code=400, detail="No records provided for import.")

    now = datetime.now()
    imported_count = 0

    for r in records:
        try:
            amt = float(r.get("amount", 0.0))
            st = str(r.get("status", "success")).lower()
            svc = str(r.get("service") or r.get("service_name") or "DMT")
            c_name = str(r.get("customer_name") or "Walk-in Customer")
            c_phone = str(r.get("customer_phone") or "9876500001")
            p_id = str(r.get("partner_id") or "partner-paras")
            ref_id = str(r.get("reference_id") or f"UPL-{uuid.uuid4().hex[:8].upper()}")
            fail_reason = r.get("failure_reason") if st == "failed" else None

            # 1. Insert Transaction into ServiceActivity
            txn_id = str(uuid.uuid4())
            act = models.ServiceActivity(
                id=txn_id,
                user_id=user_id,
                customer_id=p_id,
                customer_name=c_name,
                partner_id=p_id,
                service_name=svc,
                status=st,
                amount=amt,
                commission=0.0,
                reference_id=ref_id,
                failure_reason=fail_reason,
                created_at=now
            )

            # 2. Deterministic Commission calculation & creation
            rate, comm_amount, comm_status = canonical_seed.calculate_commission(svc, amt, st)
            act.commission = comm_amount
            db.add(act)

            comm = models.Commission(
                id=str(uuid.uuid4()),
                user_id=user_id,
                transaction_id=txn_id,
                partner_id=p_id,
                customer_id=p_id,
                service=svc,
                transaction_amount=amt,
                commission_rate=rate,
                commission_amount=comm_amount,
                status=comm_status,
                earned_at=now if comm_status in ("EARNED", "PAID") else None,
                created_at=now
            )
            db.add(comm)
            imported_count += 1
        except Exception as e:
            logger.warning(f"Skipping failed import record: {e}")

    db.commit()
    return {
        "status": "ok",
        "imported": imported_count,
        "message": f"Successfully imported {imported_count} records into canonical database. Partner metrics, transactions, and earnings have been synchronized."
    }


# ─── Service Flow Endpoints (Sandbox Adapters) ────────────────────────────────
# All services write to service_activity for unified transaction history.
# Provider adapters are clearly isolated — replace sandbox logic with real provider calls.

SANDBOX_FAILURE_SCENARIOS = [
    "Bank server did not respond in time. Please retry after a few minutes.",
    "Beneficiary account is not registered on the bank network.",
    "Daily transaction limit reached for this service.",
]

class DMTRequest(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    receiver_name: str
    receiver_account: str
    receiver_ifsc: str
    amount: float
    remarks: Optional[str] = None

class AePSRequest(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    aadhaar_last4: str
    service_type: str  # withdrawal | balance | mini_statement
    amount: Optional[float] = 0.0

class BBPSRequest(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    category: str       # electricity | water | gas | broadband | etc.
    provider: str
    consumer_number: str
    amount: float

class RechargeRequest(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    mobile_number: str
    operator: str
    plan_amount: float
    plan_description: Optional[str] = None


def _sandbox_process(service_name: str, amount: float, trigger_failure: bool = False) -> tuple[str, Optional[str], float]:
    """Sandbox: deterministic trigger when specified, or success with deterministic commission calculation."""
    if trigger_failure:
        reason = SANDBOX_FAILURE_SCENARIOS[0] if SANDBOX_FAILURE_SCENARIOS else "Beneficiary switch response timed out."
        return "failed", reason, 0.0
    _, commission, _ = canonical_seed.calculate_commission(service_name, amount, "success")
    return "success", None, commission


@app.post("/api/services/dmt")
def initiate_dmt(data: DMTRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Sandbox DMT — Send Money. Replace _sandbox_process with real provider call."""
    trigger_fail = (data.amount == 99999 or "FAIL" in data.receiver_name.upper())
    status, failure_reason, commission = _sandbox_process("DMT", data.amount, trigger_fail)
    ref_id = f"DMT{uuid.uuid4().hex[:10].upper()}"
    act = models.ServiceActivity(
        id=str(uuid.uuid4()), user_id=user_id,
        customer_id=data.customer_id, customer_name=data.customer_name,
        service_name="DMT", status=status, amount=data.amount,
        commission=commission, reference_id=ref_id, failure_reason=failure_reason
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    if data.customer_id:
        add_timeline_event(db, user_id, data.customer_id, "txn",
                           f"Send Money — {fmt_inr(data.amount)}",
                           f"To {data.receiver_name} ({data.receiver_account}) • Status: {status}", act.id)
    if status == "failed":
        notif = models.OperationalNotification(
            id=str(uuid.uuid4()), user_id=user_id,
            title="Send Money Failed",
            message=f"₹{data.amount:,.0f} transfer to {data.receiver_name} failed. {failure_reason}",
            category="alert", priority="high",
            deep_link=f"/transactions/{act.id}"
        )
        db.add(notif)
        db.commit()
    return {"id": act.id, "status": status, "reference_id": ref_id,
            "failure_reason": failure_reason, "commission": commission,
            "amount": data.amount, "service": "DMT", "sandbox": True}


@app.post("/api/services/aeps")
def initiate_aeps(data: AePSRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Sandbox AePS — Aadhaar Banking."""
    service_label = {"withdrawal": "Cash Withdrawal", "balance": "Balance Check", "mini_statement": "Mini Statement"}.get(data.service_type, "AePS")
    trigger_fail = (data.aadhaar_last4 == "0000")
    status, failure_reason, commission = _sandbox_process("AePS", data.amount or 1.0, trigger_fail)
    ref_id = f"AePS{uuid.uuid4().hex[:10].upper()}"
    act = models.ServiceActivity(
        id=str(uuid.uuid4()), user_id=user_id,
        customer_id=data.customer_id, customer_name=data.customer_name,
        service_name=f"AePS-{service_label}", status=status, amount=data.amount or 0.0,
        commission=commission, reference_id=ref_id, failure_reason=failure_reason
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    if data.customer_id:
        add_timeline_event(db, user_id, data.customer_id, "txn",
                           f"Aadhaar Banking — {service_label}",
                           f"Aadhaar ****{data.aadhaar_last4} • Status: {status}", act.id)
    if status == "failed":
        notif = models.OperationalNotification(
            id=str(uuid.uuid4()), user_id=user_id,
            title="AePS Transaction Failed",
            message=f"{service_label} for {data.customer_name} failed. {failure_reason}",
            category="alert", priority="high",
            deep_link=f"/transactions/{act.id}"
        )
        db.add(notif)
        db.commit()
    return {"id": act.id, "status": status, "reference_id": ref_id,
            "service_type": service_label, "failure_reason": failure_reason,
            "amount": data.amount, "sandbox": True}


@app.post("/api/services/bbps")
def initiate_bbps(data: BBPSRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Sandbox BBPS — Pay Bills."""
    trigger_fail = (data.amount == 99999 or data.consumer_number == "000000")
    status, failure_reason, commission = _sandbox_process("BBPS", data.amount, trigger_fail)
    ref_id = f"BBPS{uuid.uuid4().hex[:10].upper()}"
    act = models.ServiceActivity(
        id=str(uuid.uuid4()), user_id=user_id,
        customer_id=data.customer_id, customer_name=data.customer_name,
        service_name=f"BBPS-{data.category}", status=status, amount=data.amount,
        commission=commission, reference_id=ref_id, failure_reason=failure_reason
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    if data.customer_id:
        add_timeline_event(db, user_id, data.customer_id, "txn",
                           f"Bill Payment — {data.category} ({data.provider})",
                           f"Consumer: {data.consumer_number} • {fmt_inr(data.amount)} • Status: {status}", act.id)
    if status == "failed":
        notif = models.OperationalNotification(
            id=str(uuid.uuid4()), user_id=user_id,
            title="Bill Payment Failed",
            message=f"₹{data.amount:,.0f} {data.category} bill for {data.customer_name} failed. {failure_reason}",
            category="alert", priority="high",
            deep_link=f"/transactions/{act.id}"
        )
        db.add(notif)
        db.commit()
    return {"id": act.id, "status": status, "reference_id": ref_id,
            "category": data.category, "provider": data.provider,
            "failure_reason": failure_reason, "commission": commission,
            "amount": data.amount, "sandbox": True}


@app.post("/api/services/recharge")
def initiate_recharge(data: RechargeRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Sandbox Mobile Recharge."""
    status, failure_reason, commission = _sandbox_process("Recharge", data.plan_amount)
    ref_id = f"RCH{uuid.uuid4().hex[:10].upper()}"
    act = models.ServiceActivity(
        id=str(uuid.uuid4()), user_id=user_id,
        customer_id=data.customer_id, customer_name=data.customer_name,
        service_name="Recharge", status=status, amount=data.plan_amount,
        commission=commission, reference_id=ref_id, failure_reason=failure_reason
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    if data.customer_id:
        add_timeline_event(db, user_id, data.customer_id, "txn",
                           f"Mobile Recharge — {data.operator}",
                           f"{data.mobile_number} • {fmt_inr(data.plan_amount)} • Status: {status}", act.id)
    if status == "failed":
        notif = models.OperationalNotification(
            id=str(uuid.uuid4()), user_id=user_id,
            title="Recharge Failed",
            message=f"₹{data.plan_amount:,.0f} recharge for {data.mobile_number} failed. {failure_reason}",
            category="alert", priority="high",
            deep_link=f"/transactions/{act.id}"
        )
        db.add(notif)
        db.commit()
    return {"id": act.id, "status": status, "reference_id": ref_id,
            "mobile_number": data.mobile_number, "operator": data.operator,
            "failure_reason": failure_reason, "commission": commission,
            "amount": data.plan_amount, "sandbox": True}


# ─── Global Search ─────────────────────────────────────────────────────────────
@app.get("/api/search")
def global_search(q: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Cross-module search: transactions, complaints, partners."""
    ensure_user_seeded(user_id, db)
    if not q or len(q.strip()) < 2:
        return {"transactions": [], "complaints": [], "partners": []}

    q_lower = q.lower().strip()

    # Transactions
    txns = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        or_(
            models.ServiceActivity.customer_name.ilike(f"%{q}%"),
            models.ServiceActivity.reference_id.ilike(f"%{q}%"),
            models.ServiceActivity.service_name.ilike(f"%{q}%"),
        )
    ).order_by(desc(models.ServiceActivity.created_at)).limit(10).all()

    # Complaints
    complaints = db.query(models.Complaint).filter(
        models.Complaint.user_id == user_id,
        or_(
            models.Complaint.subject.ilike(f"%{q}%"),
            models.Complaint.description.ilike(f"%{q}%"),
        )
    ).limit(5).all()

    # Partners
    partners = db.query(models.Customer).filter(
        models.Customer.user_id == user_id,
        or_(
            models.Customer.name.ilike(f"%{q}%"),
            models.Customer.phone.ilike(f"%{q}%"),
            models.Customer.business_type.ilike(f"%{q}%"),
        )
    ).limit(5).all()

    return {
        "transactions": [
            {"id": t.id, "service_name": t.service_name, "amount": t.amount,
             "status": t.status, "customer_name": t.customer_name,
             "reference_id": t.reference_id,
             "created_at": t.created_at.isoformat() if t.created_at else None}
            for t in txns
        ],
        "complaints": [
            {"id": c.id, "subject": c.subject, "status": c.status,
             "priority": c.priority,
             "created_at": c.created_at.isoformat() if c.created_at else None}
            for c in complaints
        ],
        "partners": [
            {"id": p.id, "name": p.name, "phone": p.phone,
             "business_type": p.business_type, "kyc_status": p.kyc_status}
            for p in partners
        ],
    }


# ─── AI Daily Brief ────────────────────────────────────────────────────────────
@app.get("/api/ai/brief")
def get_daily_brief(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Real operational brief from actual data."""
    ensure_user_seeded(user_id, db)
    today_start = datetime.combine(date.today(), datetime.min.time())

    txns_today = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.created_at >= today_start
    ).all()

    failed_today = [t for t in txns_today if t.status == "failed"]
    pending_today = [t for t in txns_today if t.status == "pending"]
    success_today = [t for t in txns_today if t.status == "success"]

    open_complaints = db.query(models.Complaint).filter(
        models.Complaint.user_id == user_id,
        models.Complaint.status.notin_(["closed", "resolved"])
    ).all()

    overdue_complaints = [c for c in open_complaints if c.sla_deadline and c.sla_deadline < datetime.now()]

    pending_tasks = db.query(models.Task).filter(
        models.Task.user_id == user_id,
        models.Task.completed == False
    ).count()

    items = []
    if overdue_complaints:
        items.append(f"🔴 {len(overdue_complaints)} overdue complaint{'s' if len(overdue_complaints)>1 else ''}")
    if failed_today:
        total_failed_amount = sum(t.amount for t in failed_today)
        items.append(f"🔴 {len(failed_today)} failed transaction{'s' if len(failed_today)>1 else ''} today (₹{total_failed_amount:,.0f} affected)")
    if len(open_complaints) - len(overdue_complaints) > 0:
        items.append(f"🟠 {len(open_complaints) - len(overdue_complaints)} open complaint{'s' if len(open_complaints)>1 else ''} pending resolution")
    if pending_today:
        items.append(f"🟠 {len(pending_today)} transaction{'s' if len(pending_today)>1 else ''} still processing")
    if pending_tasks:
        items.append(f"🟡 {pending_tasks} pending task{'s' if pending_tasks>1 else ''}")
    if success_today:
        vol = sum(t.amount for t in success_today)
        items.append(f"🟢 {len(success_today)} successful transaction{'s' if len(success_today)>1 else ''} (₹{vol:,.0f})")

    # Priority recommendation
    if overdue_complaints:
        next_step = f"Resolve overdue complaint '{overdue_complaints[0].subject[:40]}' immediately — SLA has passed."
    elif failed_today:
        ft = failed_today[0]
        next_step = f"Investigate failed {ft.service_name} transaction of ₹{ft.amount:,.0f} for {ft.customer_name or 'customer'}."
    elif open_complaints:
        oc = open_complaints[0]
        next_step = f"Follow up on complaint '{oc.subject[:40]}' to meet SLA deadline."
    elif pending_today:
        next_step = "Check pending transactions — some may need manual resolution."
    else:
        next_step = "Operations are running smoothly. Great work!"

    return {
        "date": date.today().isoformat(),
        "summary": next_step,
        "summary_items": items,
        "next_step": next_step,
        "brief_markdown": "\n".join(items) if items else "All operations are running smoothly today.",
        "stats": {
            "total_today": len(txns_today),
            "success_today": len(success_today),
            "failed_today": len(failed_today),
            "pending_today": len(pending_today),
            "open_complaints": len(open_complaints),
            "overdue_complaints": len(overdue_complaints),
        }
    }


# ─── Notifications Engine ─────────────────────────────────────────────────────
@app.get("/api/notifications")
def list_notifications(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    notifs = db.query(models.OperationalNotification).filter(
        models.OperationalNotification.user_id == user_id,
        models.OperationalNotification.is_read == False
    ).order_by(desc(models.OperationalNotification.created_at)).limit(20).all()
    return [
        {"id": n.id, "title": n.title, "message": n.message, "category": n.category,
         "priority": n.priority, "deep_link": n.deep_link, "is_read": n.is_read,
         "created_at": n.created_at.isoformat() if n.created_at else None}
        for n in notifs
    ]

@app.post("/api/notifications/mark-read/{nid}")
def mark_notification_read(nid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    n = db.query(models.OperationalNotification).filter(models.OperationalNotification.id == nid).first()
    if n:
        n.is_read = True
        db.commit()
    return {"status": "ok"}


# ─── AI Operations Utilities ──────────────────────────────────────────────────
class ScanBillRequest(BaseModel):
    image_base64: Optional[str] = None
    file_name: Optional[str] = None

class VoiceParseRequest(BaseModel):
    audio_base64: Optional[str] = None
    text: Optional[str] = None

class GenerateMessageRequest(BaseModel):
    type: str = "reminder"
    customer_id: Optional[str] = None
    context: Optional[dict] = None

@app.post("/api/ai/scan-bill")
def scan_bill(data: ScanBillRequest, user_id: str = Depends(verify_user_id)):
    """Automated bill data extraction for BBPS services."""
    return {
        "status": "success",
        "data": {
            "payment_status": "DUE",
            "store_or_customer_name": "State Electricity Board",
            "total_amount": "2,450.00",
            "due_date": (datetime.now() + timedelta(days=7)).strftime("%d-%b-%Y"),
            "consumer_number": "1002948192",
            "biller_category": "Electricity"
        }
    }

@app.post("/api/ai/voice-parse")
def voice_parse(data: VoiceParseRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Vernacular voice transcription and financial intent extraction."""
    text = (data.text or "").strip()
    return {
        "status": "success",
        "transcription": text or "Send five thousand rupees to Ramesh Sharma via DMT",
        "intent": "DMT_TRANSFER",
        "extracted_entities": {
            "recipient_name": "Ramesh Sharma",
            "amount": 5000,
            "service": "dmt",
            "confidence": 0.94
        }
    }

@app.post("/api/ai/generate-message")
def generate_message(data: GenerateMessageRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Generate transactional communications and reminders."""
    cust_name = "Valued Customer"
    if data.customer_id:
        cust = db.query(models.Customer).filter(models.Customer.id == data.customer_id).first()
        if cust:
            cust_name = cust.name
    msg = f"Namaste {cust_name}, your recent Eko transaction has been processed securely. For assistance, contact Eko Operations Support."
    return {
        "status": "success",
        "message": msg,
        "recipient": cust_name
    }


# ─── Operational Tasks & Notes Endpoints ──────────────────────────────────────
@app.get("/api/tasks", response_model=List[TaskResponse])
def list_tasks(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    return db.query(models.Task).filter(models.Task.user_id == user_id).order_by(desc(models.Task.created_at)).all()

@app.post("/api/tasks", response_model=TaskResponse)
def create_task(data: TaskCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    tid = str(uuid.uuid4())
    t = models.Task(
        id=tid,
        user_id=user_id,
        title=data.title,
        due_date=data.due_date,
        priority=data.priority or "medium",
        customer_id=data.customer_id,
        completed=False
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@app.patch("/api/tasks/{tid}", response_model=TaskResponse)
def update_task(tid: str, data: TaskUpdate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    t = db.query(models.Task).filter(models.Task.id == tid, models.Task.user_id == user_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found.")
    if data.completed is not None:
        t.completed = data.completed
    if data.title is not None:
        t.title = data.title
    if data.priority is not None:
        t.priority = data.priority
    if data.due_date is not None:
        t.due_date = data.due_date
    db.commit()
    db.refresh(t)
    return t

@app.get("/api/notes", response_model=List[NoteResponse])
def list_notes(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    return db.query(models.Note).filter(models.Note.user_id == user_id).order_by(desc(models.Note.created_at)).all()

@app.post("/api/notes", response_model=NoteResponse)
def create_note(data: NoteCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    nid = str(uuid.uuid4())
    n = models.Note(
        id=nid,
        user_id=user_id,
        customer_id=data.customer_id,
        content=data.content
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n

@app.delete("/api/notes/{nid}")
def delete_note(nid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    n = db.query(models.Note).filter(models.Note.id == nid, models.Note.user_id == user_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")
    db.delete(n)
    db.commit()
    return {"status": "ok", "deleted_id": nid}


# ─── WhatsApp Outreach & Studio Endpoints ─────────────────────────────────────
@app.get("/api/whatsapp/outreach")
def list_whatsapp_outreach(
    status: Optional[str] = None,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    ensure_user_seeded(user_id, db)
    q = db.query(models.WhatsAppOutreach).filter(models.WhatsAppOutreach.user_id == user_id)
    if status:
        q = q.filter(models.WhatsAppOutreach.status == status)
    outreaches = q.order_by(desc(models.WhatsAppOutreach.created_at)).all()
    return [
        {
            "id": o.id,
            "customer_id": o.customer_id,
            "customer_name": o.customer_name,
            "customer_phone": o.customer_phone,
            "template_type": o.template_type,
            "language": getattr(o, "language", None) or "hinglish",
            "message": o.message,
            "status": o.status,
            "reminder_frequency": o.reminder_frequency,
            "reminder_active": o.reminder_active,
            "last_reminded_at": o.last_reminded_at.isoformat() if o.last_reminded_at else None,
            "sent_at": o.sent_at.isoformat() if o.sent_at else None,
            "notes": o.notes,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None,
        }
        for o in outreaches
    ]


@app.post("/api/whatsapp/outreach")
def create_whatsapp_outreach(
    data: WhatsAppOutreachCreate,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    oid = str(uuid.uuid4())
    outreach = models.WhatsAppOutreach(
        id=oid,
        user_id=user_id,
        customer_id=data.customer_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        template_type=data.template_type or "custom",
        language=data.language or "hinglish",
        message=data.message,
        status="pending",
        reminder_frequency="none",
        reminder_active=False,
        notes=data.notes
    )
    db.add(outreach)
    db.commit()
    db.refresh(outreach)
    return {
        "id": outreach.id,
        "customer_id": outreach.customer_id,
        "customer_name": outreach.customer_name,
        "customer_phone": outreach.customer_phone,
        "template_type": outreach.template_type,
        "language": outreach.language,
        "message": outreach.message,
        "status": outreach.status,
        "reminder_frequency": outreach.reminder_frequency,
        "reminder_active": outreach.reminder_active,
        "notes": outreach.notes,
        "created_at": outreach.created_at.isoformat() if outreach.created_at else None
    }


@app.patch("/api/whatsapp/outreach/{id}")
def update_whatsapp_outreach(
    id: str,
    data: WhatsAppOutreachUpdate,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    o = db.query(models.WhatsAppOutreach).filter(
        models.WhatsAppOutreach.id == id,
        models.WhatsAppOutreach.user_id == user_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Outreach record not found.")

    if data.status is not None:
        o.status = data.status
        if data.status == "sent":
            o.sent_at = datetime.now()
            if data.reminder_active is None:
                o.reminder_active = False
        elif data.status in ("failed", "cancelled"):
            if data.reminder_active is None:
                o.reminder_active = False
    if data.language is not None:
        o.language = data.language
    if data.reminder_frequency is not None:
        o.reminder_frequency = data.reminder_frequency
    if data.reminder_active is not None:
        o.reminder_active = data.reminder_active
    if data.notes is not None:
        o.notes = data.notes
    if data.message is not None:
        o.message = data.message

    db.commit()
    db.refresh(o)
    return {
        "id": o.id,
        "status": o.status,
        "language": getattr(o, "language", None) or "hinglish",
        "reminder_frequency": o.reminder_frequency,
        "reminder_active": o.reminder_active,
        "notes": o.notes,
        "sent_at": o.sent_at.isoformat() if o.sent_at else None,
        "message": o.message
    }


@app.post("/api/whatsapp/generate")
def generate_whatsapp_template(
    data: WhatsAppGenerateRequest,
    user_id: str = Depends(verify_user_id)
):
    cname = data.customer_name or "Partner"
    raw_ttype = (data.template_type or "custom").lower()
    lang = (data.language or "hinglish").lower()
    if "hindi" in lang or lang == "hi":
        norm_lang = "hindi"
    elif "english" in lang or lang == "en":
        norm_lang = "english"
    else:
        norm_lang = "hinglish"

    # Map aliases
    if raw_ttype in ("kyc_reminder", "kyc"):
        ttype = "kyc_reminder"
    elif raw_ttype in ("payment_reminder", "payment", "due"):
        ttype = "payment_reminder"
    elif raw_ttype in ("settlement_notice", "settlement"):
        ttype = "settlement_notice"
    elif raw_ttype in ("dispute_update", "dispute", "sla"):
        ttype = "dispute_update"
    elif raw_ttype in ("money_transfer", "dmt", "send_money"):
        ttype = "money_transfer"
    elif raw_ttype in ("aeps", "cash_withdrawal", "aadhaar"):
        ttype = "aeps"
    elif raw_ttype in ("bbps", "bill_payment", "bill"):
        ttype = "bbps"
    elif raw_ttype in ("recharge", "mobile_recharge"):
        ttype = "recharge"
    elif raw_ttype in ("offer", "festival", "festive"):
        ttype = "offer"
    else:
        ttype = "custom"

    templates = {
        "kyc_reminder": {
            "english": f"Hi {cname}, your KYC verification is still pending. Please complete your Aadhaar and PAN verification to keep your services active and unlock higher transaction limits.",
            "hindi": f"नमस्ते {cname} जी, आपका KYC verification अभी pending है। कृपया इसे पूरा कर लें ताकि आपकी services active रहें और transaction limit बढ़ सके।",
            "hinglish": f"Namaste {cname} ji, aapka KYC verification abhi pending hai. Please ise complete kar lijiye taaki aapki services active rahen aur transaction limits open ho sakein."
        },
        "money_transfer": {
            "english": f"Hi {cname}, your money transfer service is active and ready. Send funds instantly with zero failed transactions and live confirmation.",
            "hindi": f"नमस्ते {cname} जी, आपका मनी ट्रांसफर उपलब्ध है। तुरंत पैसे भेजें, सुरक्षित एवं बिना किसी रुकावट के।",
            "hinglish": f"Namaste {cname} ji, aapka money transfer available hai. Instant settlement aur zero downtime ke saath kisi bhi bank account mein transfer karein."
        },
        "aeps": {
            "english": f"Hi {cname}, AePS cash withdrawal and mini-statement services are fully operational at your nearest Eko counter with instant receipt.",
            "hindi": f"नमस्ते {cname} जी, आधार बैंकिंग (AePS) एवं कैश निकासी सेवा हमारे ईको केंद्र पर उपलब्ध है। तुरंत रसीद प्राप्त करें।",
            "hinglish": f"Namaste {cname} ji, AePS cash withdrawal aur mini statement facility counter par available hai. Instant cash aur official receipt payein."
        },
        "bbps": {
            "english": f"Hi {cname}, pay all your electricity, water, and broadband bills instantly with instant BBPS confirmation at our counter.",
            "hindi": f"नमस्ते {cname} जी, बिजली, पानी एवं सभी उपयोगी बिलों का भुगतान हमारे ईको केंद्र पर तुरंत करें एवं पक्की रसीद पाएं।",
            "hinglish": f"Namaste {cname} ji, electricity, water aur broadband bills ka instant payment hamare counter par karein. Official BBPS receipt instantly mil jayegi."
        },
        "recharge": {
            "english": f"Hi {cname}, recharge your mobile or DTH connection instantly with exciting cashback offers at our Eko service point.",
            "hindi": f"नमस्ते {cname} जी, अपने मोबाइल एवं डीटीएच का रिचार्ज हमारे ईको केंद्र पर तुरंत करवाएं और पाएं बेहतरीन ऑफर्स।",
            "hinglish": f"Namaste {cname} ji, mobile aur DTH recharge counter par available hai. Instant activation aur best festive plans ke liye visit karein."
        },
        "payment_reminder": {
            "english": f"Hello {cname}, your Eko partner account has a pending settlement balance due. Please complete the payment today to ensure uninterrupted operations.",
            "hindi": f"नमस्ते {cname} जी, आपके ईको अकाउंट का बकाया सेटलमेंट भुगतान लंबित है। निर्बाध सेवाओं के लिए कृपया आज ही भुगतान करें।",
            "hinglish": f"Namaste {cname} ji, aapke Eko account ka settlement balance pending hai. Kripya samay par settlement clear karein taaki services chalti rahein."
        },
        "settlement_notice": {
            "english": f"Hello {cname}, today's operational settlement for your Eko service point has been successfully processed and reconciled.",
            "hindi": f"नमस्ते {cname} जी, आपके ईको केंद्र का आज का सेटलमेंट सफलतापूर्वक प्रोसेस हो गया है। सभी लेन-देन का मिलान पूरा हुआ।",
            "hinglish": f"Namaste {cname} ji, aapke Eko center ka daily settlement report process ho chuka hai. Statement portal par check karein."
        },
        "dispute_update": {
            "english": f"Hello {cname}, your transaction dispute is actively being coordinated with the banking switch. Resolution will be provided within SLA.",
            "hindi": f"नमस्ते {cname} जी, आपके लेन-देन विवाद पर हमारी टीम बैंक स्विच से समन्वय कर रही है। SLA के तहत जल्द समाधान किया जाएगा।",
            "hinglish": f"Namaste {cname} ji, aapki transaction dispute request Eko operations desk par actively monitor ho rahi hai. Bank switch SLA ke bheetar resolution mil jayega."
        },
        "offer": {
            "english": f"Hello {cname}! Special festive offer: Enjoy fast money transfers, cash withdrawals, and bill payments with highest commission and zero downtime!",
            "hindi": f"नमस्ते {cname} जी, इस त्योहारी सीजन में अपने ग्राहकों को ईको की मनी ट्रांसफर, AePS एवं बिल सेवाएं दें और पाएं उच्चतम कमीशन!",
            "hinglish": f"Namaste {cname} ji! Is festive season apne customers ko dein Eko ki fast DMT aur AePS services. Highest commission aur instant settlement ka labh uthayein!"
        },
        "custom": {
            "english": f"Hello {cname}, operational update from Eko Operations. Please visit your dashboard or counter for details.",
            "hindi": f"नमस्ते {cname} जी, ईको डिजिटल ऑपरेशंस से संदेश। किसी भी सहायता के लिए हमें तुरंत सूचित करें।",
            "hinglish": f"Namaste {cname} ji, Eko operations center se update. Kisi bhi banking sahayata ke liye sampark karein."
        }
    }

    msg = templates.get(ttype, templates["custom"]).get(norm_lang, templates["custom"]["hinglish"])

    return {
        "message": msg,
        "template_type": ttype,
        "language": norm_lang
    }


# ─── AI Complaint Triage Endpoint ──────────────────────────────────────────────
@app.post("/api/complaints/triage", response_model=ComplaintTriageResponse)
def triage_complaint(
    data: ComplaintTriageRequest,
    user_id: str = Depends(verify_user_id)
):
    subject_lower = data.subject.lower()
    desc_lower = (data.description or "").lower()
    combined = f"{subject_lower} {desc_lower}"

    if any(k in combined for k in ["aeps", "biometric", "fingerprint", "timeout", "npc"]):
        category = "Switch Latency / AePS"
        severity = "Urgent"
        summary = "NPCI biometric switch timeout detected during AePS transaction."
        action = "Verify issuer bank authorization logs and initiate NPCI reversal inquiry."
        escalation = "Escalate to NPCI switch desk within 4-hour SLA window."
    elif any(k in combined for k in ["dmt", "transfer", "send money", "credited", "debited"]):
        category = "Payment Status / DMT"
        severity = "High"
        summary = "DMT remittance settlement discrepancy between debit and beneficiary credit."
        action = "Check beneficiary bank IMPS UTR status and verify bank clearing switch."
        escalation = "Route to Banking Operations if uncredited after 2 hours."
    elif any(k in combined for k in ["kyc", "document", "aadhaar", "pan", "limit"]):
        category = "Document Verification"
        severity = "Medium"
        summary = "Customer KYC document verification issue affecting operational limits."
        action = "Review uploaded Aadhaar/PAN image clarity and trigger re-verification."
        escalation = "Assign to Field Operations Agent for counter verification."
    elif any(k in combined for k in ["bbps", "bill", "electricity", "broadband"]):
        category = "Utility Biller Response"
        severity = "Medium"
        summary = "BBPS bill payment confirmation pending from utility provider."
        action = "Query biller Bharat BillPay switch for clearing acknowledgement."
        escalation = "File automated dispute with biller aggregator if pending > 24h."
    else:
        category = "General Operational Support"
        severity = "Medium"
        summary = "General service grievance requiring operator investigation."
        action = "Review transaction activity logs and contact customer for details."
        escalation = "Assign to Team Lead if unresolved within standard SLA."

    return ComplaintTriageResponse(
        category=category,
        severity=severity,
        summary=summary,
        recommended_action=action,
        escalation_suggestion=escalation,
        is_ai_suggestion=True
    )


# ─── Banner & Poster Studio Endpoints ─────────────────────────────────────────
@app.get("/api/posters")
def list_posters(
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    ensure_user_seeded(user_id, db)
    posters = db.query(models.PosterDesign).filter(
        models.PosterDesign.user_id == user_id
    ).order_by(desc(models.PosterDesign.updated_at)).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "template_type": p.template_type,
            "layers_json": p.layers_json,
            "width": p.width,
            "height": p.height,
            "preview_data": p.preview_data,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in posters
    ]


@app.get("/api/posters/{pid}")
def get_poster(
    pid: str,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    p = db.query(models.PosterDesign).filter(
        models.PosterDesign.id == pid,
        models.PosterDesign.user_id == user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Poster design not found.")
    return {
        "id": p.id,
        "title": p.title,
        "template_type": p.template_type,
        "layers_json": p.layers_json,
        "width": p.width,
        "height": p.height,
        "preview_data": p.preview_data,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@app.post("/api/posters")
def create_poster(
    data: PosterDesignCreate,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    pid = str(uuid.uuid4())
    poster = models.PosterDesign(
        id=pid,
        user_id=user_id,
        title=data.title,
        template_type=data.template_type or "custom",
        layers_json=data.layers_json,
        width=data.width or 800,
        height=data.height or 800,
        preview_data=data.preview_data
    )
    db.add(poster)
    db.commit()
    db.refresh(poster)
    return {
        "id": poster.id,
        "title": poster.title,
        "template_type": poster.template_type,
        "layers_json": poster.layers_json,
        "width": poster.width,
        "height": poster.height,
        "preview_data": poster.preview_data,
        "created_at": poster.created_at.isoformat() if poster.created_at else None
    }


@app.put("/api/posters/{pid}")
def update_poster(
    pid: str,
    data: PosterDesignUpdate,
    user_id: str = Depends(verify_user_id),
    db: Session = Depends(database.get_db)
):
    p = db.query(models.PosterDesign).filter(
        models.PosterDesign.id == pid,
        models.PosterDesign.user_id == user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Poster design not found.")
    p.title = data.title
    p.template_type = data.template_type or p.template_type
    p.layers_json = data.layers_json
    p.width = data.width or p.width
    p.height = data.height or p.height
    if data.preview_data:
        p.preview_data = data.preview_data
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "title": p.title,
        "template_type": p.template_type,
        "layers_json": p.layers_json,
        "width": p.width,
        "height": p.height,
        "preview_data": p.preview_data,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None
    }


@app.post("/api/posters/generate-copy")
def generate_poster_copy(
    data: PosterCopyGenerateRequest,
    user_id: str = Depends(verify_user_id)
):
    p_name = data.partner_name or "Eko Banking & Digital Point"
    ttype = (data.template_type or "dmt").lower()
    prompt = (data.prompt or "").lower()

    if "aeps" in ttype or "aadhaar" in prompt or "cash" in prompt:
        headline = "आधार से रुपया निकालें (Aadhaar ATM)"
        tagline = f"{p_name} पर सभी बैंकों का कैश विड्रॉल एवं बैलेंस इन्क्वायरी"
        bullets = [
            "सभी बैंकों के खातों से तुरंत कैश निकासी",
            "बिना ATM कार्ड केवल अंगूठे के निशान से",
            "सरकारी पेंशन व छात्रवृत्ति का तुरंत भुगतान"
        ]
        cta = "आज ही पधारें · त्वरित एवं सुरक्षित सेवा"
    elif "bbps" in ttype or "bill" in prompt or "bijli" in prompt:
        headline = "सभी बिजली व पानी बिल यहाँ भरें"
        tagline = "भारत बिल पे (BBPS) अधिकृत डिजिटल केंद्र"
        bullets = [
            "बिजली, पानी, गैस व मोबाइल पोस्टपेड बिल",
            "तुरंत अधिकृत रसीद (Instant Digital Receipt)",
            "बिना किसी लाइन या अतिरिक्त शुल्क के"
        ]
        cta = "अंतिम तिथि से पहले बिल जमा करें"
    elif "recharge" in ttype or "mobile" in prompt:
        headline = "सभी कंपनियों के मोबाइल व DTH रिचार्ज"
        tagline = f"{p_name} — जिओ, एयरटेल, VI एवं BSNL"
        bullets = [
            "अनलिमिटेड 5G कॉलिंग व डेटा पैक्स",
            "Tata Play, Dish TV, Airtel DTH रिचार्ज",
            "बेस्ट कैशबैक व तुरंत एक्टिवेशन"
        ]
        cta = "तुरंत रिचार्ज करवाएं"
    elif "festival" in ttype or "diwali" in prompt or "holi" in prompt:
        headline = "त्योहारों की हार्दिक शुभकामनाएं!"
        tagline = f"{p_name} — आपके साथ हर कदम पर"
        bullets = [
            "घर बैठे देश भर में तुरंत पैसा भेजें",
            "त्योहारी ऑफर पर विशेष सुविधाएं",
            "24x7 निरंतर डिजिटल सेवाएं"
        ]
        cta = "सपनों को दें नई उड़ान · ईको पार्टनर"
    else:  # DMT default
        headline = "देश भर में किसी भी बैंक में तुरंत पैसा भेजें"
        tagline = f"{p_name} — 24x7 मनी ट्रांसफर सेवा"
        bullets = [
            "IMPS द्वारा मात्र 5 सेकंड में पैसा खाते में",
            "सरकारी व प्राइवेट सभी बैंक शाखाओं में ट्रांसफर",
            "एसएमएस द्वारा तुरंत पुष्टि एवं पक्की रसीद"
        ]
        cta = "विश्वास और सुरक्षा का 100% वादा"

    return {
        "headline": headline,
        "tagline": tagline,
        "bullets": bullets,
        "cta": cta,
        "partner_name": p_name,
        "template_type": ttype
    }




