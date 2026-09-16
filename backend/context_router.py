"""
Eko Partner Operations — Intelligent Context Router & Multilingual Intent Planner
Guarantees domain isolation, context reset, and accurate intent extraction.
Prevents cross-domain contamination and generic Ops Brief convergence.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class ContextPlan:
    intent: str  # GREETING, TASK, TRANSACTION, EARNINGS, COMPLAINT, BUSINESS_OVERVIEW, CREDIT, SETTLEMENT, CUSTOMER, WHATSAPP, COMPOUND, UNKNOWN
    domains: List[str] = field(default_factory=list)  # ['tasks'], ['transactions'], ['earnings'], ['complaints'], ['credit'], ['settlements'], ['business']
    language: str = "en"  # 'en', 'hi', 'hinglish'
    entity_name: Optional[str] = None
    entity_id: Optional[str] = None
    date_scope: Optional[str] = None  # 'today', etc.
    status_scope: Optional[str] = None  # 'failed', 'pending', etc.
    is_compound: bool = False
    requires_conversation_context: bool = False


# Hindi / Hinglish detection indicators
HINDI_DEVANAGARI_RE = re.compile(r'[\u0900-\u097F]')
HINGLISH_WORDS = {
    "aaj", "mera", "meri", "mere", "kya", "hai", "hain", "karna", "karein", "kaise", "kaisa",
    "btao", "batao", "dikhao", "chal", "raha", "rahi", "kitna", "kitni", "kitne", "baare",
    "mei", "mein", "shikayat", "shikayaten", "paisa", "kamai", "ko", "se", "aur", "namaste",
    "dhanyawad", "mujhe", "aapka", "kuch", "nahi", "bhejo", "bana", "do"
}


def detect_language(text: str) -> str:
    """Detect if text is Devanagari Hindi, Latin Hinglish, or English."""
    if not text:
        return "en"
    if HINDI_DEVANAGARI_RE.search(text):
        return "hi"
    tokens = set(re.findall(r'\b[a-zA-Z]+\b', text.lower()))
    hinglish_matches = tokens.intersection(HINGLISH_WORDS)
    if len(hinglish_matches) >= 1:
        return "hinglish"
    return "en"


def extract_entity_name(text: str) -> Optional[str]:
    """Extract known customer/partner name from text."""
    known_names = [
        "Rahul Kumar", "Rahul", "Rajesh Kumar", "Rajesh", "Sunita Devi", "Sunita",
        "Priya Sharma", "Priya", "Mohammad Imran", "Imran", "Sharma Telecom", "Sharma",
        "Patel Enterprise", "Patel", "Paras General Store", "Paras", "Verma Communication", "Verma",
        "Gupta Digital", "Gupta"
    ]
    lower = text.lower()
    for name in known_names:
        if re.search(rf'\b{re.escape(name.lower())}\b', lower):
            return name
    # Fallback to Title-cased single proper noun that isn't a command word
    stopwords = {"Show", "Explain", "Today", "Daily", "Open", "Draft", "Send", "Tell", "Eko", "Namaste", "Hello", "What", "Why", "How", "Status"}
    matches = re.findall(r'\b[A-Z][a-z]{2,}\b', text)
    for m in matches:
        if m not in stopwords:
            return m
    return None


def plan_context(query: str, active_context: Optional[Dict[str, Any]] = None, conversation_history: Optional[List[Dict[str, Any]]] = None) -> ContextPlan:
    """
    Constructs an authoritative ContextPlan for the query.
    Enforces that current query intent overrides previous active context.
    """
    q_raw = query.strip()
    q = q_raw.lower()
    lang = detect_language(q_raw)
    entity_name = extract_entity_name(q_raw)

    # 1. Instant Greeting Fast Path
    greeting_match = re.match(
        r'^\s*(hi+|hey+|hlo|hello|howdy|namaste|namaskar|good\s*(morning|afternoon|evening|night|day))\s*[!.?]*\s*$',
        q
    )
    if greeting_match:
        return ContextPlan(intent="GREETING", domains=[], language=lang)

    # Token and intent indicators
    has_task_terms = bool(re.search(r'\b(task|tasks|kya karna hai|pending task|pending tasks|follow-?ups?|follow up|karya)\b', q))
    has_failed_terms = bool(re.search(r'\b(failed|fail|failure|failures|decline|declined|timeout)\b', q))
    has_txn_terms = bool(re.search(r'\b(transaction|transactions|txn|txns|len-?den|transfer|payout)\b', q))
    has_earning_terms = bool(re.search(r'\b(earning|earnings|kamai|commission|commissions|kitna mila|kitni kamai|earnings kitni)\b', q))
    has_settlement_terms = bool(re.search(r'\b(settlement|settlements|neft|payout cycle|settle)\b', q))
    has_complaint_terms = bool(re.search(r'\b(complaint|complaints|shikayat|shikayaten|dispute|disputes|sla|grievance|grievances)\b', q))
    has_credit_terms = bool(re.search(r'\b(credit|score|assessment|cibil|risk bracket|why is .* lower|factors affecting)\b', q))
    has_whatsapp_terms = bool(re.search(r'\b(whatsapp|draft message|send message|message bana|outreach)\b', q))
    has_business_terms = bool(re.search(r'\b(business|karobar|business kaisa|business overview|business ke baare|how is my business|operations brief|ops brief|summarize today\'s operations)\b', q))

    # Explicit conversational pronoun references ("his score", "her KYC", "why is he", etc.)
    has_pronoun_dependency = bool(re.search(r'\b(his|her|their|he|she|uska|uski|unka|unki)\b', q))

    # Entity reuse only if explicitly referenced by pronoun and missing entity in query
    resolved_entity_name = entity_name
    resolved_entity_id = None
    if not resolved_entity_name and has_pronoun_dependency and active_context:
        resolved_entity_name = active_context.get("entity_name") or active_context.get("label")
        resolved_entity_id = active_context.get("customer_id") or active_context.get("partner_id")

    # 2. Check for Compound Intent (e.g. Tasks + Failed Transactions)
    is_compound_task_txn = has_task_terms and (has_failed_terms or has_txn_terms)
    if is_compound_task_txn:
        return ContextPlan(
            intent="COMPOUND",
            domains=["tasks", "transactions"],
            language=lang,
            entity_name=resolved_entity_name,
            entity_id=resolved_entity_id,
            date_scope="today",
            status_scope="failed",
            is_compound=True
        )

    # "improve" alone is ambiguous — only treat as credit if entity is named or other credit indicators present
    has_explicit_credit_terms = bool(re.search(r'\b(credit|score|assessment|cibil|risk bracket|why is .* lower|factors affecting|kyc|credit limit|risk level|creditworthiness|sudharna|uthana)\b', q))
    has_improve_with_entity = bool(re.search(r'\b(improve|improve)\b', q)) and bool(entity_name or resolved_entity_name)
    has_credit_terms = has_explicit_credit_terms or has_improve_with_entity

    # 3. Credit Intent
    if has_credit_terms:
        return ContextPlan(
            intent="CREDIT",
            domains=["credit"],
            language=lang,
            entity_name=resolved_entity_name or "Rahul Kumar",
            entity_id=resolved_entity_id,
            is_compound=False
        )

    # 4. Earnings Intent
    if has_earning_terms:
        return ContextPlan(
            intent="EARNINGS",
            domains=["earnings"],
            language=lang,
            date_scope="today",
            is_compound=False
        )

    # 5. Settlement Intent
    if has_settlement_terms:
        return ContextPlan(
            intent="SETTLEMENT",
            domains=["settlements"],
            language=lang,
            date_scope="today",
            is_compound=False
        )

    # 6. Task Intent
    if has_task_terms:
        return ContextPlan(
            intent="TASK",
            domains=["tasks"],
            language=lang,
            date_scope="today",
            is_compound=False
        )

    # 7. Complaint Intent
    if has_complaint_terms:
        return ContextPlan(
            intent="COMPLAINT",
            domains=["complaints"],
            language=lang,
            date_scope="today",
            is_compound=False
        )

    # 8. Transaction Intent (specifically failed or general)
    if has_failed_terms or has_txn_terms:
        return ContextPlan(
            intent="TRANSACTION",
            domains=["transactions"],
            language=lang,
            date_scope="today",
            status_scope="failed" if has_failed_terms else None,
            is_compound=False
        )

    # 9. WhatsApp Outreach Intent
    if has_whatsapp_terms:
        return ContextPlan(
            intent="WHATSAPP",
            domains=["whatsapp"],
            language=lang,
            entity_name=resolved_entity_name,
            entity_id=resolved_entity_id,
            is_compound=False
        )

    # 10. Business Overview Intent (The ONLY general cross-domain intent)
    if has_business_terms:
        return ContextPlan(
            intent="BUSINESS_OVERVIEW",
            domains=["business"],
            language=lang,
            date_scope="today",
            is_compound=False
        )

    # 11. Customer 360 / Performance / Volume / History
    if (resolved_entity_name or resolved_entity_id or "customer" in q or "partner" in q) and any(k in q for k in ["detail", "profile", "baare mein", "info", "who is", "performing", "performance", "volume", "history", "trend"]):
        return ContextPlan(
            intent="CUSTOMER",
            domains=["customer"],
            language=lang,
            entity_name=resolved_entity_name,
            entity_id=resolved_entity_id,
            is_compound=False
        )

    # Fallback to Safe Unknown Intent (Clarification prompt, never generic Ops Brief!)
    return ContextPlan(
        intent="UNKNOWN",
        domains=[],
        language=lang,
        is_compound=False
    )
