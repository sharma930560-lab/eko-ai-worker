import os
import sys
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from main import app

client = TestClient(app)

USER_A = {"X-User-Id": "qa-wa-user-001"}
USER_B = {"X-User-Id": "qa-wa-user-002"}


def test_whatsapp_generation_templates():
    """Verify AI WhatsApp generator produces grounded text across languages and types."""
    # 1. KYC in English
    res = client.post("/api/whatsapp/generate", json={
        "customer_name": "Rahul Kumar",
        "template_type": "kyc_reminder",
        "language": "english"
    }, headers=USER_A)
    assert res.status_code == 200
    data = res.json()
    assert "Rahul Kumar" in data["message"]
    assert "KYC verification" in data["message"]
    assert "Aadhaar and PAN" in data["message"]

    # 2. Payment reminder in Hindi
    res2 = client.post("/api/whatsapp/generate", json={
        "customer_name": "Sharma Telecom",
        "template_type": "payment_reminder",
        "language": "hindi"
    }, headers=USER_A)
    assert res2.status_code == 200
    assert "सेटलमेंट" in res2.json()["message"]

    # 3. Dispute in Hinglish
    res3 = client.post("/api/whatsapp/generate", json={
        "customer_name": "Patel Enterprise",
        "template_type": "dispute_update",
        "language": "hinglish"
    }, headers=USER_A)
    assert res3.status_code == 200
    assert "Bank switch SLA" in res3.json()["message"]


def test_whatsapp_outreach_lifecycle():
    """Verify full outreach lifecycle: pending -> whatsapp_opened -> sent."""
    # 1. Create outreach
    payload = {
        "customer_name": "Rahul Kumar",
        "customer_phone": "9988776655",
        "template_type": "kyc_reminder",
        "message": "Namaste Rahul ji, please complete KYC verification."
    }
    create_res = client.post("/api/whatsapp/outreach", json=payload, headers=USER_A)
    assert create_res.status_code == 200
    record = create_res.json()
    assert record["status"] == "pending"
    assert record["customer_phone"] == "9988776655"
    outreach_id = record["id"]

    # 2. Mark as whatsapp_opened
    open_res = client.patch(f"/api/whatsapp/outreach/{outreach_id}", json={
        "status": "whatsapp_opened"
    }, headers=USER_A)
    assert open_res.status_code == 200
    assert open_res.json()["status"] == "whatsapp_opened"

    # 3. Mark as sent
    sent_res = client.patch(f"/api/whatsapp/outreach/{outreach_id}", json={
        "status": "sent"
    }, headers=USER_A)
    assert sent_res.status_code == 200
    updated = sent_res.json()
    assert updated["status"] == "sent"
    assert updated["sent_at"] is not None


def test_whatsapp_reminder_toggling():
    """Verify updating reminder preferences on an outreach record."""
    create_res = client.post("/api/whatsapp/outreach", json={
        "customer_name": "Sunita Devi",
        "customer_phone": "9876500002",
        "template_type": "payment_reminder",
        "message": "Reminder for settlement"
    }, headers=USER_A)
    assert create_res.status_code == 200
    outreach_id = create_res.json()["id"]

    # Set reminder active
    patch_res = client.patch(f"/api/whatsapp/outreach/{outreach_id}", json={
        "reminder_frequency": "once",
        "reminder_active": True
    }, headers=USER_A)
    assert patch_res.status_code == 200
    assert patch_res.json()["reminder_frequency"] == "once"
    assert patch_res.json()["reminder_active"] is True

    # Pause reminder
    pause_res = client.patch(f"/api/whatsapp/outreach/{outreach_id}", json={
        "reminder_active": False
    }, headers=USER_A)
    assert pause_res.status_code == 200
    assert pause_res.json()["reminder_active"] is False


def test_whatsapp_tenant_isolation():
    """Verify tenant A cannot read or mutate tenant B's outreach records."""
    # Create record as User A
    create_res = client.post("/api/whatsapp/outreach", json={
        "customer_name": "User A Partner",
        "customer_phone": "9123456780",
        "template_type": "custom",
        "message": "Private communication for Tenant A"
    }, headers=USER_A)
    assert create_res.status_code == 200
    record_id = create_res.json()["id"]

    # User B lists outreaches -> must not see User A's record
    list_res = client.get("/api/whatsapp/outreach", headers=USER_B)
    assert list_res.status_code == 200
    user_b_ids = [o["id"] for o in list_res.json()]
    assert record_id not in user_b_ids

    # User B attempts to patch User A's record -> must get 404
    patch_res = client.patch(f"/api/whatsapp/outreach/{record_id}", json={
        "status": "sent"
    }, headers=USER_B)
    assert patch_res.status_code == 404


def test_whatsapp_missing_phone_rejection():
    """Verify backend enforces phone presence for WhatsApp outreach."""
    res = client.post("/api/whatsapp/outreach", json={
        "customer_name": "No Phone User",
        "message": "Hello from Eko"
    }, headers=USER_A)
    assert res.status_code == 422


def test_whatsapp_sent_cancels_reminder():
    """Verify marking outreach as sent automatically cancels and deactivates any active reminders."""
    create_res = client.post("/api/whatsapp/outreach", json={
        "customer_name": "Active Reminder Customer",
        "customer_phone": "9811122233",
        "template_type": "kyc_reminder",
        "message": "Please submit KYC documents"
    }, headers=USER_A)
    assert create_res.status_code == 200
    oid = create_res.json()["id"]

    # Activate reminder
    patch_rem = client.patch(f"/api/whatsapp/outreach/{oid}", json={
        "reminder_frequency": "once",
        "reminder_active": True
    }, headers=USER_A)
    assert patch_rem.status_code == 200
    assert patch_rem.json()["reminder_active"] is True

    # Mark as sent
    sent_res = client.patch(f"/api/whatsapp/outreach/{oid}", json={
        "status": "sent"
    }, headers=USER_A)
    assert sent_res.status_code == 200
    # In main.py patch handler, if status is sent or cancelled, reminder_active is set to False
    data = sent_res.json()
    assert data["status"] == "sent"
    assert data["reminder_active"] is False
