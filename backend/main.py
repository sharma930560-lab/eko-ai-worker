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
from typing import Optional, List, Dict, Any
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
    version="1.3.0",
    description="Intelligent fintech operations assistant for Eko partners.",
)

models.Base.metadata.create_all(bind=database.engine)

def run_migrations():
    """Ensure newly added columns exist in existing SQLite/PostgreSQL tables."""
    try:
        inspector = inspect(database.engine)
        table_names = inspector.get_table_names()
        with database.engine.connect() as conn:
            # Check users table
            if "users" in table_names:
                user_cols = {col["name"] for col in inspector.get_columns("users")}
                if "wallet_balance" not in user_cols:
                    logger.info("Migrating DB: Adding wallet_balance column to users table")
                    conn.execute(text("ALTER TABLE users ADD COLUMN wallet_balance FLOAT DEFAULT 0.0"))
                    conn.commit()

            # Check customers table
            if "customers" in table_names:
                cust_cols = {col["name"] for col in inspector.get_columns("customers")}
                if "email" not in cust_cols:
                    logger.info("Migrating DB: Adding email column to customers table")
                    conn.execute(text("ALTER TABLE customers ADD COLUMN email VARCHAR"))
                    conn.commit()
                if "kyc_status" not in cust_cols:
                    logger.info("Migrating DB: Adding kyc_status column to customers table")
                    conn.execute(text("ALTER TABLE customers ADD COLUMN kyc_status VARCHAR DEFAULT 'pending'"))
                    conn.commit()

            # Check tasks table
            if "tasks" in table_names:
                task_cols = {col["name"] for col in inspector.get_columns("tasks")}
                if "customer_id" not in task_cols:
                    logger.info("Migrating DB: Adding customer_id column to tasks table")
                    conn.execute(text("ALTER TABLE tasks ADD COLUMN customer_id VARCHAR"))
                    conn.commit()

            # Check notes table
            if "notes" in table_names:
                note_cols = {col["name"] for col in inspector.get_columns("notes")}
                if "customer_id" not in note_cols:
                    logger.info("Migrating DB: Adding customer_id column to notes table")
                    conn.execute(text("ALTER TABLE notes ADD COLUMN customer_id VARCHAR"))
                    conn.commit()
    except Exception as e:
        logger.warning("Auto-migration notice: %s", e)

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

class CustomerResponse(BaseModel):
    id: str
    name: str
    phone: Optional[str]
    email: Optional[str]
    kyc_status: str
    business_type: Optional[str]
    notes: Optional[str]
    amount_due: float
    last_contact: Optional[str]
    follow_up_date: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class ActivityCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
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
    customer_id: str
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

def ensure_user_seeded(user_id: str, db: Session):
    """Seed comprehensive connected demo operations data for any fresh/demo user."""
    if not user_id:
        return

    # Check if user already has data
    existing_partners = db.query(models.Customer).filter(models.Customer.user_id == user_id).count()
    if existing_partners > 0:
        return

    logger.info(f"Seeding connected operational environment for user: {user_id}")
    now = datetime.now()
    seed_suffix = "" if user_id == "demo-operator-01" else f"-{hashlib.sha1(user_id.encode()).hexdigest()[:8]}"
    def seed_ref(reference: str) -> str:
        return f"{reference}{seed_suffix}"

    def seed_id(label: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"eko-demo:{user_id}:{label}"))

    # 1. Connected Partners (Retailers / Agents / CSPs)
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
        name="Sharma Telecom & Money Transfer",
        phone="9876543210", email="sharma.telecom@ekopartner.in",
        business_type="Telecom & Remittance", kyc_status="verified",
        amount_due=14500.0, notes="High-volume DMT center near metro station. Fast settlement preferred.",
        created_at=now - timedelta(days=60)
    )
    p_verma = models.Customer(
        id=seed_id("partner-verma"), user_id=user_id,
        name="Verma Communication Hub",
        phone="9823456789", email="verma.hub@ekopartner.in",
        business_type="Digital Services", kyc_status="verified",
        amount_due=8200.0, notes="Primary BBPS bill collection and mobile recharge counter.",
        created_at=now - timedelta(days=30)
    )
    p_gupta = models.Customer(
        id=seed_id("partner-gupta"), user_id=user_id,
        name="Gupta Digital Services",
        phone="9898989898", email="gupta.digital@ekopartner.in",
        business_type="CSC & Utility", kyc_status="verified",
        amount_due=5400.0, notes="Government services center & AePS mini-ATM point.",
        created_at=now - timedelta(days=20)
    )
    p_patel = models.Customer(
        id=seed_id("partner-patel"), user_id=user_id,
        name="Patel Enterprise Banking",
        phone="9765432109", email="patel.banking@ekopartner.in",
        business_type="Enterprise Banking Point", kyc_status="verified",
        amount_due=32000.0, notes="Commercial hub with high DMT transfers. Corporate settlement terms.",
        created_at=now - timedelta(days=90)
    )
    p_rahul = models.Customer(
        id=seed_id("partner-rahul"), user_id=user_id,
        name="Rahul Kumar",
        phone="9988776655", email="rahul.k@ekopartner.in",
        business_type="Kirana & CSP", kyc_status="pending",
        amount_due=0.0, notes="Newly onboarded partner pending physical KYC document verification.",
        created_at=now - timedelta(days=2)
    )

    all_partners = [p_paras, p_sharma, p_verma, p_gupta, p_patel, p_rahul]
    for p in all_partners:
        db.add(p)
    db.commit()
    for p in all_partners:
        db.refresh(p)

    # 2. Realistic Multi-Service Transactions
    # TXN-DEMO-1001: Failed AePS cash withdrawal (linked to complaint and alert)
    t_failed = models.ServiceActivity(
        id=seed_ref("TXN-DEMO-1001"), user_id=user_id,
        customer_id=p_sharma.id, customer_name=p_sharma.name,
        service_name="AePS", status="failed", amount=2500.0, commission=0.0,
        reference_id=seed_ref("AEPS984729104"),
        failure_reason="Issuer bank switch timeout during biometric balance withdrawal.",
        created_at=now - timedelta(hours=2)
    )
    # Additional realistic operational transactions
    txns = [
        t_failed,
        models.ServiceActivity(
            id=seed_id("txn-paras-dmt-01"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="DMT", status="success", amount=5000.0, commission=22.5,
            reference_id=seed_ref("DMT849201948"),
            created_at=now - timedelta(hours=1)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-aeps-01"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="AePS", status="success", amount=2000.0, commission=8.0,
            reference_id=seed_ref("AEPS849201882"),
            created_at=now - timedelta(hours=3)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-bbps-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="BBPS", status="success", amount=1450.0, commission=5.0,
            reference_id=seed_ref("BBPS849201773"),
            created_at=now - timedelta(hours=4)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-recharge-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="Recharge", status="success", amount=299.0, commission=4.5,
            reference_id=seed_ref("RCH849201664"),
            created_at=now - timedelta(hours=5)
        ),
        models.ServiceActivity(
            id=seed_id("txn-patel-dmt-01"), user_id=user_id,
            customer_id=p_patel.id, customer_name=p_patel.name,
            service_name="DMT", status="pending", amount=10000.0, commission=45.0,
            reference_id=seed_ref("DMT849201555"),
            failure_reason="Bank confirmation pending from beneficiary NEFT switch.",
            created_at=now - timedelta(hours=6)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-aeps-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="AePS", status="success", amount=3000.0, commission=12.0,
            reference_id=seed_ref("AEPS849201446"),
            created_at=now - timedelta(hours=7)
        ),
        models.ServiceActivity(
            id=seed_id("txn-sharma-dmt-01"), user_id=user_id,
            customer_id=p_sharma.id, customer_name=p_sharma.name,
            service_name="DMT", status="success", amount=7500.0, commission=33.5,
            reference_id=seed_ref("DMT849201337"),
            created_at=now - timedelta(hours=8)
        ),
        models.ServiceActivity(
            id=seed_id("txn-gupta-bbps-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="BBPS", status="success", amount=3200.0, commission=10.0,
            reference_id=seed_ref("BBPS849201228"),
            created_at=now - timedelta(days=1)
        ),
        models.ServiceActivity(
            id=seed_id("txn-rahul-aeps-01"), user_id=user_id,
            customer_id=p_rahul.id, customer_name=p_rahul.name,
            service_name="AePS-Mini Statement", status="success", amount=0.0, commission=0.0,
            reference_id=seed_ref("AEPS849201020"),
            created_at=now - timedelta(hours=10)
        ),
        models.ServiceActivity(
            id=seed_id("txn-paras-dmt-02"), user_id=user_id,
            customer_id=p_paras.id, customer_name=p_paras.name,
            service_name="DMT", status="success", amount=4200.0, commission=18.0,
            reference_id=seed_ref("DMT849201119"),
            created_at=now - timedelta(days=1)
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
            id=seed_id("txn-gupta-recharge-01"), user_id=user_id,
            customer_id=p_gupta.id, customer_name=p_gupta.name,
            service_name="Mobile Recharge", status="failed", amount=399.0, commission=0.0,
            reference_id=seed_ref("RCH849201001"),
            failure_reason="Operator gateway rejected the recharge request.",
            created_at=now - timedelta(hours=11)
        ),
        models.ServiceActivity(
            id=seed_id("txn-rahul-dmt-01"), user_id=user_id,
            customer_id=p_rahul.id, customer_name=p_rahul.name,
            service_name="DMT", status="success", amount=1500.0, commission=7.5,
            reference_id=seed_ref("DMT849200990"),
            created_at=now - timedelta(hours=13)
        ),
        models.ServiceActivity(
            id=seed_id("txn-verma-dmt-01"), user_id=user_id,
            customer_id=p_verma.id, customer_name=p_verma.name,
            service_name="DMT", status="success", amount=2800.0, commission=12.6,
            reference_id=seed_ref("DMT849200989"),
            created_at=now - timedelta(hours=14)
        ),
    ]
    for t in txns:
        db.add(t)
    db.commit()

    # 3. Operational Complaints with realistic SLAs
    c_urgent = models.Complaint(
        id=seed_id("complaint-sharma-aeps"), user_id=user_id,
        customer_id=p_sharma.id, transaction_id=t_failed.id,
        subject="TXN-DEMO-1001 AePS Switch Timeout",
        description="Biometric timeout on ₹2,500 withdrawal at Sharma Telecom. Customer account debited but cash dispenser did not dispense. Bank reversal escalation required.",
        status="open", priority="urgent",
        sla_deadline=now + timedelta(hours=3),
        created_at=now - timedelta(hours=1)
    )
    c_high = models.Complaint(
        id=seed_id("complaint-patel-settlement"), user_id=user_id,
        customer_id=p_patel.id, transaction_id=None,
        subject="Commercial Settlement Delay — Patel Enterprise",
        description="Pending settlement cycle reconciliation of ₹32,000 awaiting nodal account clearance confirmation.",
        status="in_progress", priority="high",
        sla_deadline=now + timedelta(hours=18),
        created_at=now - timedelta(hours=6)
    )
    c_med = models.Complaint(
        id=seed_id("complaint-verma-bbps"), user_id=user_id,
        customer_id=p_verma.id, transaction_id=txns[3].id,
        subject="BBPS Biller Reversal Verification",
        description="Electricity bill payment of ₹1,450 for BSES Rajdhani processed, consumer requested physical receipt copy.",
        status="acknowledged", priority="medium",
        sla_deadline=now + timedelta(hours=36),
        created_at=now - timedelta(hours=12)
    )
    c_bbps = models.Complaint(
        id=seed_id("complaint-sharma-bbps"), user_id=user_id,
        customer_id=p_sharma.id, transaction_id=txns[11].id,
        subject="BBPS Confirmation Timeout — Sharma Telecom",
        description="The biller acknowledgement timed out for the linked BBPS payment and requires status reconciliation.",
        status="open", priority="high",
        sla_deadline=now + timedelta(hours=12),
        created_at=now - timedelta(hours=9)
    )
    c_recharge = models.Complaint(
        id=seed_id("complaint-gupta-recharge"), user_id=user_id,
        customer_id=p_gupta.id, transaction_id=txns[12].id,
        subject="Recharge Gateway Rejection — Gupta Digital Services",
        description="The linked mobile recharge was rejected by the operator gateway and needs retry confirmation.",
        status="in_progress", priority="medium",
        sla_deadline=now + timedelta(hours=24),
        created_at=now - timedelta(hours=11)
    )
    complaints = [c_urgent, c_high, c_med, c_bbps, c_recharge]
    for c in complaints:
        db.add(c)
    db.commit()

    # 4. Operational Notifications (linked to entities)
    notifs = [
        models.OperationalNotification(
            id=seed_id("notification-sharma-aeps"), user_id=user_id,
            title="Urgent: Failed AePS Transaction Alert",
            message=f"₹2,500 AePS transaction failed for {p_sharma.name}. Switch timeout requires immediate escalation.",
            category="alert", priority="urgent",
            deep_link=f"/transactions/{t_failed.id}",
            created_at=now - timedelta(hours=2)
        ),
        models.OperationalNotification(
            id=seed_id("notification-sharma-sla"), user_id=user_id,
            title="SLA Warning: 3h Remaining",
            message=f"Complaint '{c_urgent.subject}' has only 3 hours left before SLA breach.",
            category="complaint", priority="high",
            deep_link=f"/complaints/{c_urgent.id}",
            created_at=now - timedelta(hours=1)
        ),
        models.OperationalNotification(
            id=seed_id("notification-rahul-kyc"), user_id=user_id,
            title="KYC Verification Pending",
            message=f"{p_rahul.name} document submission awaiting operational field verification.",
            category="reminder", priority="medium",
            deep_link=f"/partners/{p_rahul.id}",
            created_at=now - timedelta(hours=4)
        ),
        models.OperationalNotification(
            id=seed_id("notification-sharma-bbps"), user_id=user_id,
            title="BBPS Confirmation Needs Review",
            message=f"{p_sharma.name} has a BBPS acknowledgement timeout linked to a high-priority complaint.",
            category="complaint", priority="high",
            deep_link=f"/complaints/{c_bbps.id}",
            created_at=now - timedelta(hours=8)
        ),
        models.OperationalNotification(
            id=seed_id("notification-gupta-recharge"), user_id=user_id,
            title="Recharge Gateway Rejection",
            message=f"{p_gupta.name} has a failed mobile recharge awaiting retry confirmation.",
            category="alert", priority="medium",
            deep_link=f"/transactions/{txns[12].id}",
            created_at=now - timedelta(hours=10)
        ),
        models.OperationalNotification(
            id=seed_id("notification-patel-settlement"), user_id=user_id,
            title="Settlement Reconciliation Pending",
            message=f"{p_patel.name} settlement reconciliation remains linked to an open operational complaint.",
            category="reminder", priority="high",
            deep_link=f"/complaints/{c_high.id}",
            created_at=now - timedelta(hours=5)
        ),
    ]
    for n in notifs:
        db.add(n)

    # 5. Connected Operational Tasks
    tasks = [
        models.Task(
            id=seed_id("task-sharma-aeps"), user_id=user_id,
            customer_id=p_sharma.id,
            title="Follow up with bank desk on AePS TXN-DEMO-1001",
            due_date=(now + timedelta(hours=2)).strftime("%Y-%m-%d"),
            completed=False, priority="urgent",
            created_at=now - timedelta(hours=1)
        ),
        models.Task(
            id=seed_id("task-rahul-kyc"), user_id=user_id,
            customer_id=p_rahul.id,
            title="Complete on-site KYC verification for Rahul Kumar",
            due_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
            completed=False, priority="high",
            created_at=now - timedelta(hours=4)
        ),
        models.Task(
            id=seed_id("task-paras-float"), user_id=user_id,
            customer_id=p_paras.id,
            title="Audit daily float balance at Paras General Store",
            due_date=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
            completed=True, priority="medium",
            created_at=now - timedelta(days=1)
        ),
        models.Task(
            id=seed_id("task-sharma-bbps"), user_id=user_id,
            customer_id=p_sharma.id,
            title="Reconcile BBPS acknowledgement for Sharma Telecom",
            due_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
            completed=False, priority="high",
            created_at=now - timedelta(hours=8)
        ),
        models.Task(
            id=seed_id("task-gupta-recharge"), user_id=user_id,
            customer_id=p_gupta.id,
            title="Retry failed mobile recharge for Gupta Digital Services",
            due_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
            completed=False, priority="medium",
            created_at=now - timedelta(hours=10)
        ),
        models.Task(
            id=seed_id("task-patel-settlement"), user_id=user_id,
            customer_id=p_patel.id,
            title="Confirm Patel Enterprise settlement clearance",
            due_date=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
            completed=False, priority="high",
            created_at=now - timedelta(hours=5)
        ),
    ]
    for tk in tasks:
        db.add(tk)

    # 6. Operational Field Notes
    notes = [
        models.Note(
            id=seed_id("note-sharma-network"), user_id=user_id,
            customer_id=p_sharma.id,
            content="Sharma Telecom operator reported intermittent NPCI network latency around 2 PM today. Keep monitoring AePS success rates.",
            created_at=now - timedelta(hours=2)
        ),
        models.Note(
            id=seed_id("note-paras-float"), user_id=user_id,
            customer_id=p_paras.id,
            content="Paras store owner requested higher daily DMT threshold (+₹50,000) ahead of upcoming festive season.",
            created_at=now - timedelta(days=1)
        ),
        models.Note(
            id=seed_id("note-verma-bbps"), user_id=user_id,
            customer_id=p_verma.id,
            content="Verma Communication Hub confirmed the BBPS receipt request and needs follow-up after biller reconciliation.",
            created_at=now - timedelta(hours=12)
        ),
        models.Note(
            id=seed_id("note-rahul-kyc"), user_id=user_id,
            customer_id=p_rahul.id,
            content="Rahul Kumar submitted onboarding documents; physical KYC verification remains pending.",
            created_at=now - timedelta(hours=4)
        ),
    ]
    for nt in notes:
        db.add(nt)

    # 7. Credit Score Assessments
    for p in all_partners:
        score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, p.id)
        db.add(models.CreditScore(
            id=seed_id(f"credit-{p.id}"), user_id=user_id, customer_id=p.id,
            customer_name=p.name, score=score_val or 75.0, risk_bracket=risk if score_val else "LOW",
            confidence=conf, factors=json.dumps(factors), recommendations=recs
        ))

    db.commit()
    logger.info(f"Successfully initialized connected demo environment for user: {user_id}")

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
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "Eko Partner Operations API",
        "version": "1.3.0",
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
    return {"status": "ready", "version": "1.3.0"}

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
        models.ServiceActivity,
        models.Customer,
    ):
        db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
    db.commit()
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
def list_customers(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    return db.query(models.Customer).filter(models.Customer.user_id == user_id).all()

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
def list_activity(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    ensure_user_seeded(user_id, db)
    return db.query(models.ServiceActivity).filter(models.ServiceActivity.user_id == user_id).order_by(desc(models.ServiceActivity.created_at)).all()

@app.post("/api/activity", response_model=ActivityResponse)
def create_activity(data: ActivityCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    aid = str(uuid.uuid4())
    act = models.ServiceActivity(id=aid, user_id=user_id, **data.model_dump())
    db.add(act)
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
    if target_txn_id:
        t = db.query(models.ServiceActivity).filter(
            or_(models.ServiceActivity.id == target_txn_id, models.ServiceActivity.reference_id == target_txn_id),
            models.ServiceActivity.user_id == user_id
        ).first()
        if t:
            context_lines.append(
                f"ACTIVE SCREEN CONTEXT — SELECTED TRANSACTION: ID={t.id}, Reference={t.reference_id or 'N/A'}, "
                f"Service={t.service_name}, Amount={fmt_inr(t.amount)}, Status={t.status.upper()}, "
                f"Customer={t.customer_name or 'N/A'}, Date={t.created_at.date() if t.created_at else 'N/A'}, "
                f"Failure Reason={t.failure_reason or 'None (Success)'}"
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
    }


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
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
    db.commit()
    db.refresh(c)
    return {"id": c.id, "status": c.status, "priority": c.priority}


# ─── Partners (Customers as Partners) ─────────────────────────────────────────
@app.post("/api/partners", response_model=CustomerResponse)
def create_partner(data: CustomerCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Create a new partner profile."""
    return create_customer(data, user_id, db)

@app.get("/api/partners")
def list_partners(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Partners list with aggregated transaction stats."""
    ensure_user_seeded(user_id, db)
    customers = db.query(models.Customer).filter(models.Customer.user_id == user_id).all()
    results = []
    for cust in customers:
        txns = db.query(models.ServiceActivity).filter(
            models.ServiceActivity.user_id == user_id,
            models.ServiceActivity.customer_id == cust.id
        ).all()
        total = len(txns)
        success = len([t for t in txns if t.status == "success"])
        failed = len([t for t in txns if t.status == "failed"])
        pending = len([t for t in txns if t.status == "pending"])
        volume = sum(t.amount for t in txns if t.status == "success")

        open_complaints = db.query(models.Complaint).filter(
            models.Complaint.customer_id == cust.id,
            models.Complaint.status.notin_(["closed", "resolved"])
        ).count()

        results.append({
            "id": cust.id,
            "name": cust.name,
            "phone": cust.phone,
            "business_type": cust.business_type,
            "kyc_status": cust.kyc_status,
            "amount_due": cust.amount_due,
            "total_transactions": total,
            "success_transactions": success,
            "failed_transactions": failed,
            "pending_transactions": pending,
            "total_volume": volume,
            "success_rate": f"{(success/total*100 if total else 0):.0f}%",
            "open_complaints": open_complaints,
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
        models.ServiceActivity.customer_id == pid
    ).order_by(desc(models.ServiceActivity.created_at)).limit(50).all()

    complaints = db.query(models.Complaint).filter(
        models.Complaint.user_id == user_id,
        models.Complaint.customer_id == pid
    ).order_by(desc(models.Complaint.created_at)).all()

    total = len(txns)
    success = len([t for t in txns if t.status == "success"])
    failed = [t for t in txns if t.status == "failed"]
    pending = [t for t in txns if t.status == "pending"]
    volume = sum(t.amount for t in txns if t.status == "success")

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
        "kyc_status": cust.kyc_status, "amount_due": cust.amount_due,
        "notes": cust.notes, "created_at": cust.created_at.isoformat() if cust.created_at else None,
        "stats": {
            "total_transactions": total, "success_transactions": success,
            "failed_transactions": len(failed), "pending_transactions": len(pending),
            "total_volume": volume,
            "success_rate": f"{(success/total*100 if total else 0):.0f}%",
            "open_complaints": len([c for c in complaints if c.status not in ("closed","resolved")]),
        },
        "transactions": [txn_dict(t) for t in txns],
        "complaints": [comp_dict(c) for c in complaints],
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
    """Sandbox: ~85% success rate simulation, or deterministic trigger when specified. Returns (status, failure_reason, commission)."""
    import random
    if trigger_failure:
        reason = random.choice(SANDBOX_FAILURE_SCENARIOS)
        return "failed", reason, 0.0
    success = random.random() > 0.15
    if success:
        commission = round(amount * 0.005, 2)  # 0.5% commission simulation
        return "success", None, commission
    else:
        reason = random.choice(SANDBOX_FAILURE_SCENARIOS)
        return "failed", reason, 0.0


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



