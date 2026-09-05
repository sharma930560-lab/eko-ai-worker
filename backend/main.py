"""
Eko AI Operations — FastAPI Backend
Professional Fintech Operations + Customer 360 + AI Logic
"""
import os
import uuid
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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

app = FastAPI(
    title="Eko Partner Operations API",
    version="1.2.0",
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
    except Exception as e:
        logger.warning("Auto-migration notice: %s", e)

run_migrations()

# ─── CORS ─────────────────────────────────────────────────────────────────────
_default_origins = (
    "https://appassets.androidplatform.net,"
    "http://appassets.androidplatform.net,"
    "https://eko-field-worker.netlify.app,"
    "http://localhost:3000,"
    "http://127.0.0.1:3000"
)
_origins_env = os.getenv("ALLOWED_ORIGINS", _default_origins)
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
for _essential in [
    "https://appassets.androidplatform.net",
    "http://appassets.androidplatform.net",
    "https://eko-field-worker.netlify.app"
]:
    if _essential not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_essential)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-User-Id", "Authorization", "Accept", "Origin"],
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
    grounded: bool = True
    insufficient_data: bool = False
    missing_info: Optional[str] = None
    error: Optional[AIError] = None

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

# ─── Health & Readiness ───────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    db_ok = database.check_db_connection()
    ai_ok = bool(GEMINI_API_KEY or os.getenv("OPENAI_API_KEY"))
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "Eko Partner Operations API",
        "version": "1.2.0",
        "environment": ENVIRONMENT,
        "ai_configured": ai_ok,
        "ai_provider": os.getenv("AI_PROVIDER", "gemini" if GEMINI_API_KEY else "local"),
        "ai_model": GEMINI_MODEL,
        "auth_configured": bool(GOOGLE_CLIENT_ID),
        "database": "connected" if db_ok else "disconnected",
    }

@app.get("/api/ready")
def ready():
    db_ok = database.check_db_connection()
    if not db_ok:
        raise HTTPException(status_code=503, detail="Database not ready")
    return {"status": "ready", "version": "1.2.0"}

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

# ─── Grievance & SLA Tracking ──────────────────────────────────────────────────
@app.post("/api/complaints", response_model=ComplaintResponse)
def create_complaint(data: ComplaintCreate, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    comp_id = str(uuid.uuid4())
    complaint = models.Complaint(
        id=comp_id,
        user_id=user_id,
        **data.model_dump(),
        sla_deadline=datetime.now() + timedelta(hours=48)
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    add_timeline_event(db, user_id, data.customer_id, "complaint", "Complaint Registered", data.subject, comp_id)
    return complaint

@app.get("/api/complaints")
def list_complaints(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """List complaints with calculated SLA remaining time."""
    complaints = db.query(models.Complaint).filter(models.Complaint.user_id == user_id).all()
    results = []
    for c in complaints:
        remaining = None
        if c.sla_deadline and c.status != "closed":
            remaining = (c.sla_deadline - datetime.now()).total_seconds() / 3600

        results.append({
            "id": c.id,
            "subject": c.subject,
            "status": c.status,
            "priority": c.priority,
            "sla_hours_remaining": remaining,
            "created_at": c.created_at
        })
    return results

# ─── Advanced Credit Intelligence ─────────────────────────────────────────────
def calculate_dynamic_score(db: Session, user_id: str, customer_id: str) -> tuple:
    activity = db.query(models.ServiceActivity).filter(
        models.ServiceActivity.user_id == user_id,
        models.ServiceActivity.customer_id == customer_id
    ).order_by(desc(models.ServiceActivity.created_at)).all()

    if not activity:
        return 0, "INSUFFICIENT_DATA", 0.0, {}, "No transaction history found."

    total = len(activity)
    successful = [a for a in activity if a.status == "success"]
    failed = [a for a in activity if a.status == "failed"]

    success_rate = len(successful) / total
    volume = sum(a.amount for a in successful)

    # Time-weighted logic: Recent success is more valuable
    recent_activity = activity[:10]
    recent_success_rate = len([a for a in recent_activity if a.status == "success"]) / len(recent_activity)

    # Deterministic scoring
    score = 40.0
    score += (success_rate * 30.0)
    score += (recent_success_rate * 20.0)

    if volume > 50000: score += 5
    if total > 50: score += 4

    score = min(99.0, max(10.0, score))
    risk = "LOW" if score >= 80 else "MODERATE" if score >= 50 else "HIGH"

    factors = {
        "success_rate": f"{int(success_rate*100)}%",
        "recent_performance": f"{int(recent_success_rate*100)}%",
        "volume_handled": fmt_inr(volume),
        "total_txns": str(total)
    }

    recs = "Maintain high volume and success rate to improve assessment."
    if risk == "HIGH": recs = "Urgent: Improve transaction success ratio before requesting higher limits."

    return score, risk, 1.0, factors, recs

@app.post("/api/credit-score/recalculate/{cid}")
def recalculate_eko_score(cid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == cid, models.Customer.user_id == user_id).first()
    if not customer: raise HTTPException(status_code=404, detail="Customer not found.")

    score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, cid)

    old_score_rec = db.query(models.CreditScore).filter(models.CreditScore.customer_id == cid).first()
    old_val = old_score_rec.score if old_score_rec else 50.0

    if not old_score_rec:
        old_score_rec = models.CreditScore(
            id=str(uuid.uuid4()), user_id=user_id, customer_id=cid,
            customer_name=customer.name, score=score_val, risk_bracket=risk,
            factors=json.dumps(factors), recommendations=recs
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
            old_score_rec.factors = json.dumps(factors)
            old_score_rec.recommendations = recs

            add_timeline_event(db, user_id, cid, "credit", "Credit Assessment Updated",
                               f"Score moved from {old_val:.1f} to {score_val:.1f}. Bracket: {risk}")

    db.commit()
    return {"status": "success", "score": score_val, "risk": risk}

# ─── Operational Dashboard Metrics ────────────────────────────────────────────
@app.get("/api/ops/dashboard")
def get_ops_dashboard(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
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
@app.post("/api/ai/ask", response_model=AskEkoResponse)
async def ask_eko(body: AskEkoRequest, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    """Deep contextual assistant with multi-stage historical retrieval and provider independence."""
    context_lines = [f"Today's Date: {date.today()}"]

    customer = None
    if body.customer_id:
        customer = db.query(models.Customer).filter(
            models.Customer.id == body.customer_id,
            models.Customer.user_id == user_id
        ).first()

    if not customer and body.question:
        all_custs = db.query(models.Customer).filter(models.Customer.user_id == user_id).all()
        q_lower = body.question.lower()
        for c in all_custs:
            if c.name and c.name.lower() in q_lower:
                customer = c
                break

    if customer:
        context_lines.append(f"Subject Customer Profile: Name={customer.name}, Phone={customer.phone or 'N/A'}, KYC Status={customer.kyc_status}, Business Type={customer.business_type or 'General'}, Amount Due={fmt_inr(customer.amount_due)}")
        if customer.notes:
            context_lines.append(f"Customer Notes: {customer.notes}")

        # Credit Score and factors
        score_record = db.query(models.CreditScore).filter(
            models.CreditScore.customer_id == customer.id
        ).order_by(desc(models.CreditScore.created_at)).first()
        if score_record:
            context_lines.append(f"Customer Credit Assessment: Score={score_record.score}/100, Risk Bracket={score_record.risk_bracket}, Confidence={score_record.confidence}")
            if score_record.factors:
                context_lines.append(f"Assessment Risk Factors: {score_record.factors}")
            if score_record.recommendations:
                context_lines.append(f"Assessment Recommendations: {score_record.recommendations}")

        # Credit Score History
        score_history = db.query(models.CreditScoreHistory).filter(
            models.CreditScoreHistory.customer_id == customer.id
        ).order_by(desc(models.CreditScoreHistory.created_at)).limit(5).all()
        if score_history:
            context_lines.append("Assessment History Changes:")
            for sh in score_history:
                context_lines.append(f"- {sh.created_at.date()}: Old={sh.old_score}, New={sh.new_score}, Reason: {sh.change_reason}")

        # Timeline events
        query = db.query(models.TimelineEvent).filter(models.TimelineEvent.customer_id == customer.id)
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
        complaints = db.query(models.Complaint).filter(models.Complaint.customer_id == customer.id).all()
        if complaints:
            context_lines.append(f"Customer Grievances/Complaints ({len(complaints)}):")
            for comp in complaints:
                context_lines.append(f"- Status: {comp.status.upper()} | Priority: {comp.priority} | Subject: {comp.subject} | {comp.description}")

        # Recent transactions for customer
        txns = db.query(models.ServiceActivity).filter(
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

    ai_provider = get_ai_provider()
    system_instruction = f"{SYSTEM_PROMPT}\n\nVERIFIED BUSINESS CONTEXT:\n" + "\n".join(context_lines)
    prompt = f"User Question: {body.question}\nPrevious History: {body.history}"

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
            grounded=True,
            insufficient_data=fallback_res.get("insufficient_data", True),
            missing_info=fallback_res.get("missing_info", "Cloud reasoning connection paused"),
            error=AIError(
                code="AI_PROVIDER_UNAVAILABLE",
                message="Cloud reasoning engine is temporarily unavailable. Displaying local grounded evaluation.",
                retryable=True
            )
        )

# ─── Notifications Engine ─────────────────────────────────────────────────────
@app.get("/api/notifications")
def list_notifications(user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    # Simple polling endpoint for SLA/Follow-up alerts
    return db.query(models.OperationalNotification).filter(
        models.OperationalNotification.user_id == user_id,
        models.OperationalNotification.is_read == False
    ).order_by(desc(models.OperationalNotification.created_at)).all()

@app.post("/api/notifications/mark-read/{nid}")
def mark_notification_read(nid: str, user_id: str = Depends(verify_user_id), db: Session = Depends(database.get_db)):
    n = db.query(models.OperationalNotification).filter(models.OperationalNotification.id == nid).first()
    if n:
        n.is_read = True
        db.commit()
    return {"status": "ok"}
