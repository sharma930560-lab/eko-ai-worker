"""
Eko Micro-Entrepreneur Worker — Database Models
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, ForeignKey
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
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active = Column(DateTime(timezone=True), onupdate=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    business_type = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    amount_due = Column(Float, nullable=True)
    last_contact = Column(String, nullable=True)  # ISO date string
    follow_up_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    due_date = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    priority = Column(String, default="medium")  # low / medium / high
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    content = Column(Text, nullable=False)
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


class InventoryItem(Base):
    __tablename__ = "inventory"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Float, default=0.0)
    unit = Column(String, default="units")  # kg, L, packets, pieces, etc.
    low_stock_threshold = Column(Float, default=5.0)
    price = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, nullable=True)
    customer_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default="pending")  # pending | paid | overdue
    due_date = Column(String, nullable=True)
    paid_date = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, default="Business Chat")
    provider = Column(String, default="gemini")
    latest_interaction_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AIMemory(Base):
    __tablename__ = "ai_memories"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    category = Column(String, default="general")  # business_goal | preference | commitment | insight | rule
    content = Column(Text, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BusinessEvent(Base):
    __tablename__ = "business_events"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, index=True, nullable=False)
    event_type = Column(String, nullable=False)  # action_approved | follow_up_completed | reminder_sent | stock_reordered
    title = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


