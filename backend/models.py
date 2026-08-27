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
