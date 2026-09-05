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
from sqlalchemy import desc, and_, or_
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

import database
import models

# ─── Setup ────────────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("eko")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

app = FastAPI(
    title="Eko AI Operations API",
    version="2.0.0",
    description="Intelligent fintech operations assistant for Eko partners.",
)

models.Base.metadata.create_all(bind=database.engine)

# ─── CORS ─────────────────────────────────────────────────────────────────────
_default_origins = (
    "https://appassets.androidplatform.net,"
    "https://eko-field-worker.netlify.app,"
    "http://localhost:3000,"
    "http://127.0.0.1:3000"
)
_origins_env = os.getenv("ALLOWED_ORIGINS", _default_origins)
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-User-Id", "Authorization"],
)

# ─── Auth Helpers ──────────────────────────────────────────────────────────────
def verify_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header.")
    return x_user_id

# ─── Pydantic Schemas ──────────────────────────────────────────────────────────
class GoogleTokenRequest(BaseModel):
    credential: str

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

class AskEkoResponse(BaseModel):
    answer: str
    facts: List[Fact] = []
    inferences: List[Inference] = []
    recommendations: List[Recommendation] = []
    grounded: bool = True
    insufficient_data: bool = False
    missing_info: Optional[str] = None

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

# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0", "ai_ready": bool(GEMINI_API_KEY)}

# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/api/auth/google", response_model=UserResponse)
def google_login(payload: GoogleTokenRequest, db: Session = Depends(database.get_db)):
    user_id = "demo_user_123"
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = models.User(id=user_id, email="demo@eko.co.in", name="Eko Partner", onboarding_completed=True, wallet_balance=15000.0)
        db.add(user)
        db.commit()
        db.refresh(user)
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
    """Deep contextual assistant with multi-stage historical retrieval."""
    context_lines = [f"Today's Date: {date.today()}"]

    if body.customer_id:
        customer = db.query(models.Customer).filter(models.Customer.id == body.customer_id).first()
        if customer:
            context_lines.append(f"Subject Customer: {customer.name} (KYC: {customer.kyc_status})")

            # Smart retrieval: if dates provided or question mentions history
            query = db.query(models.TimelineEvent).filter(models.TimelineEvent.customer_id == body.customer_id)

            if body.date_from:
                query = query.filter(models.TimelineEvent.created_at >= body.date_from)
            if body.date_to:
                query = query.filter(models.TimelineEvent.created_at <= body.date_to)

            # If no dates but keywords suggest history, fetch more
            hist_keywords = ["history", "last year", "old", "previous", "was", "happened"]
            limit = 50 if any(k in body.question.lower() for k in hist_keywords) else 15

            timeline = query.order_by(desc(models.TimelineEvent.created_at)).limit(limit).all()

            if timeline:
                context_lines.append(f"Retrieved {len(timeline)} timeline events for context:")
                for e in timeline:
                    context_lines.append(f"- {e.created_at.date()} | {e.event_type.upper()} | {e.title}: {e.description}")
            else:
                context_lines.append("No relevant historical events found for the specified period.")

    # General Operational Summary
    dashboard = get_ops_dashboard(user_id, db)
    context_lines.append(f"Business Summary: {dashboard['today_transactions']} txns today, Volume {fmt_inr(dashboard['total_volume'])}, Success Rate {dashboard['success_rate']}.")

    if not is_gemini_ready():
        return AskEkoResponse(
            answer="I'm in offline reasoning mode. I can verify current transaction success, but complex analysis is unavailable.",
            grounded=True, insufficient_data=True, missing_info="Gemini API connection"
        )

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)

        system_instruction = f"{SYSTEM_PROMPT}\n\nCONTEXT:\n" + "\n".join(context_lines)
        prompt = f"User Question: {body.question}\nHistory: {body.history}"

        response = await asyncio.wait_for(asyncio.to_thread(model.generate_content, f"{system_instruction}\n\n{prompt}"), timeout=10.0)

        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()

        parsed = json.loads(raw_text)
        return AskEkoResponse(**parsed)
    except Exception as e:
        logger.error(f"AI Error: {e}")
        return AskEkoResponse(
            answer="I'm having trouble connecting to my reasoning engine. Please try again.",
            grounded=False, insufficient_data=True, missing_info=str(e)
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
