"""
Eko AI Operations — Database Models
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, ForeignKey, Integer
from sqlalchemy.sql import func
from database import Base


def new_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    picture = Column(String, nullable=True)
    business_name = Column(String, nullable=True)
    business_type = Column(String, nullable=True)
    language_preference = Column(String, default="en")
    location_city = Column(String, nullable=True)
    onboarding_completed = Column(Boolean, default=False)
    wallet_balance = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active = Column(DateTime(timezone=True), onupdate=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    kyc_status = Column(String, default="pending")  # pending | verified | rejected
    business_type = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    amount_due = Column(Float, default=0.0)
    last_contact = Column(String, nullable=True)
    follow_up_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ServiceActivity(Base):
    __tablename__ = "service_activity"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=True)
    customer_name = Column(String, nullable=True)
    service_name = Column(String, nullable=False)  # DMT | AePS | BBPS | etc.
    status = Column(String, default="initiated")  # initiated | processing | success | failed | pending | reversed
    amount = Column(Float, default=0.0)
    commission = Column(Float, default=0.0)
    reference_id = Column(String, unique=True, index=True, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TransactionIssue(Base):
    __tablename__ = "transaction_issues"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    transaction_id = Column(String, ForeignKey("service_activity.id"), index=True, nullable=False)
    category = Column(String, nullable=False)  # amount_deducted_not_received | delay | etc.
    priority = Column(String, default="medium")  # low | medium | high | urgent
    status = Column(String, default="open")  # open | investigating | resolved | closed
    sla_deadline = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=False)
    transaction_id = Column(String, index=True, nullable=True)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="open")  # open | acknowledged | in_progress | resolved | escalated | closed
    priority = Column(String, default="medium")
    sla_deadline = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CreditScore(Base):
    __tablename__ = "credit_scores"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=True)
    customer_name = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    risk_bracket = Column(String, nullable=False)
    confidence = Column(Float, default=1.0)
    factors = Column(Text, nullable=True)  # JSON
    recommendations = Column(Text, nullable=True)
    version = Column(String, default="3.0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CreditScoreHistory(Base):
    __tablename__ = "credit_score_history"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=False)
    old_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    change_reason = Column(Text, nullable=False)
    contributing_factors = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Bill(Base):
    __tablename__ = "bills"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=True)
    provider = Column(String, nullable=True)
    bill_number = Column(String, index=True, nullable=True)
    consumer_number = Column(String, index=True, nullable=True)
    amount = Column(Float, nullable=False)
    due_date = Column(String, nullable=True)
    customer_name = Column(String, nullable=True)
    service_type = Column(String, default="utility")
    status = Column(String, default="pending")  # pending | paid
    ocr_raw = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=True)
    title = Column(String, nullable=False)
    due_date = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    priority = Column(String, default="medium")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AIMemory(Base):
    __tablename__ = "ai_memories"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=True)
    category = Column(String, default="general")
    content = Column(Text, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, index=True, nullable=False)
    event_type = Column(String, nullable=False)  # txn | bill | complaint | credit | note | task | kyc | comm
    event_ref_id = Column(String, nullable=True)  # ID of related entity
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OperationalNotification(Base):
    __tablename__ = "operational_notifications"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # alert | reminder | info
    priority = Column(String, default="medium")
    is_read = Column(Boolean, default=False)
    deep_link = Column(String, nullable=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Offer(Base):
    __tablename__ = "offers"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    discount = Column(String, nullable=True)
    valid_until = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
