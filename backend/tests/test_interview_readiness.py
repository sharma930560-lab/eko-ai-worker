"""
Interview Readiness Test Suite
Verifies:
1. Transaction amount preservation (₹25,000 stays ₹25,000)
2. No status contradictions (SUCCESS is never marked failed; no 'None (Success)')
3. AI Operational Summary structure
4. Customer credit analysis reasoning
5. WhatsApp Outreach multi-language endpoints (English, Hindi, Hinglish)
6. Complaint Triage AI endpoint
7. Zero '[object Object]' user-facing occurrences
"""

import pytest
import re
import urllib.parse
from fastapi.testclient import TestClient
from main import app
import ai_provider

client = TestClient(app)
TEST_USER = "demo_user"
HEADERS = {"X-User-Id": TEST_USER}


def test_transaction_25k_success_explanation():
    """Verify ₹25,000 Send Money transaction explanation preserves amount and status."""
    res = client.post(
        "/api/ai/ask",
        json={"question": "Explain transaction DMTBEF965B72E of ₹25,000"},
        headers=HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    answer = data.get("answer", "")
    facts = [f["text"] for f in data.get("facts", [])]

    # Verify amount ₹25,000 is preserved, not ₹25
    assert "₹25,000" in answer or "25,000" in answer
    assert "₹25 " not in answer
    assert "₹25." not in answer

    # Verify status is success, never failed
    assert "successful" in answer.lower() or "success" in answer.lower()
    assert "failed" not in answer.lower()
    assert "None (Success)" not in answer

    # Verify facts
    assert any("25,000" in f for f in facts)
    assert any("Success" in f for f in facts)


@pytest.mark.parametrize("status,expected_phrase,unexpected_phrase", [
    ("SUCCESS", "was successful", "failed"),
    ("PENDING", "currently pending", "was successful"),
    ("FAILED", "failed. Failure reason: Issuer bank switch timeout", "None (Success)"),
])
def test_deterministic_transaction_statuses(status, expected_phrase, unexpected_phrase):
    """Regression test for all 3 transaction statuses in LocalDeterministicProvider."""
    provider = ai_provider.LocalDeterministicProvider()
    reason = "Issuer bank switch timeout" if status == "FAILED" else ("Not provided" if status == "PENDING" else "None")
    context = (
        f"<VERIFIED_DATABASE_CONTEXT>\n"
        f"ACTIVE SCREEN CONTEXT — SELECTED TRANSACTION: ID=t_test_01 | Reference=DMTBEF965B72E | "
        f"Service=Send Money | Amount=₹25,000 | Status={status} | Customer=Paras | Failure Reason={reason}\n"
        f"</VERIFIED_DATABASE_CONTEXT>"
    )
    prompt = "<USER_QUESTION>\nExplain transaction DMTBEF965B72E of ₹25,000\n</USER_QUESTION>"

    import asyncio
    res = asyncio.run(provider.generate(context, prompt))
    answer = res["answer"]
    facts = [f["text"] for f in res["facts"]]

    assert "₹25,000" in answer
    assert "₹25 " not in answer
    assert expected_phrase in answer
    assert unexpected_phrase not in answer
    assert "None (Success)" not in answer
    assert any("₹25,000" in f for f in facts)


def test_ai_operational_summary():
    """Verify operational summary flow with verified facts, summary, and actions."""
    res = client.post(
        "/api/ai/ask",
        json={"question": "Summarize today's operations"},
        headers=HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data.get("facts", [])) >= 1
    assert len(data.get("recommendations", [])) >= 1
    assert "Sharma Telecom" in data["answer"] or "AePS" in data["answer"]


def test_ai_rahul_credit_explanation():
    """Verify customer credit question uses actual synthetic customer data."""
    res = client.post(
        "/api/ai/ask",
        json={"question": "Why is Rahul's assessment lower?"},
        headers=HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    answer = data.get("answer", "")
    assert "Rahul" in answer
    assert "credit assessment" in answer.lower() or "score" in answer.lower()
    assert len(data.get("facts", [])) >= 1


def test_complaint_triage_endpoint():
    """Verify AI Complaint Triage suggestions for AePS and DMT issues."""
    res_aeps = client.post(
        "/api/complaints/triage",
        json={"subject": "AePS biometric timeout", "description": "Customer fingerprint authenticated but cash not dispensed"},
        headers=HEADERS
    )
    assert res_aeps.status_code == 200
    data_aeps = res_aeps.json()
    assert data_aeps["severity"] == "Urgent"
    assert "AePS" in data_aeps["category"]
    assert "NPCI" in data_aeps["summary"]
    assert data_aeps["is_ai_suggestion"] is True

    res_dmt = client.post(
        "/api/complaints/triage",
        json={"subject": "DMT Money Transfer debited", "description": "Sender account debited ₹25,000 but beneficiary account uncredited"},
        headers=HEADERS
    )
    assert res_dmt.status_code == 200
    data_dmt = res_dmt.json()
    assert data_dmt["severity"] == "High"
    assert "DMT" in data_dmt["category"]
    assert data_dmt["is_ai_suggestion"] is True


def test_whatsapp_multilanguage_generation():
    """Verify English, Hindi, and Hinglish generation produce distinctly different text."""
    # English
    en_res = client.post(
        "/api/whatsapp/generate",
        json={"customer_name": "Rahul Kumar", "customer_phone": "9305601503", "template_type": "kyc_reminder", "language": "english"},
        headers=HEADERS
    )
    assert en_res.status_code == 200
    en_msg = en_res.json()["message"]
    assert "Hi Rahul Kumar" in en_msg or "Hello Rahul Kumar" in en_msg
    assert "KYC" in en_msg

    # Hindi (Devanagari)
    hi_res = client.post(
        "/api/whatsapp/generate",
        json={"customer_name": "Rahul Kumar", "customer_phone": "9305601503", "template_type": "kyc_reminder", "language": "hindi"},
        headers=HEADERS
    )
    assert hi_res.status_code == 200
    hi_msg = hi_res.json()["message"]
    assert "नमस्ते" in hi_msg
    assert "राहुल" in hi_msg or "Rahul" in hi_msg

    # Hinglish (Roman Hindi)
    hg_res = client.post(
        "/api/whatsapp/generate",
        json={"customer_name": "Rahul Kumar", "customer_phone": "9305601503", "template_type": "kyc_reminder", "language": "hinglish"},
        headers=HEADERS
    )
    assert hg_res.status_code == 200
    hg_msg = hg_res.json()["message"]
    assert "Namaste Rahul Kumar ji" in hg_msg
    assert "aapka KYC" in hg_msg

    # Ensure all 3 are distinct
    assert en_msg != hi_msg
    assert hi_msg != hg_msg
    assert en_msg != hg_msg


def test_whatsapp_records_crud():
    """Verify GET and POST WhatsApp outreach records."""
    # GET
    res = client.get("/api/whatsapp/outreach", headers=HEADERS)
    assert res.status_code == 200
    records = res.json()
    assert isinstance(records, list)
    assert len(records) >= 14

    # POST
    create_payload = {
        "customer_name": "Paras Demo",
        "customer_phone": "9305601503",
        "template_type": "dmt",
        "language": "hinglish",
        "message": "Namaste Paras ji, instant money transfer counter par chalu hai."
    }
    create_res = client.post("/api/whatsapp/outreach", json=create_payload, headers=HEADERS)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["customer_name"] == "Paras Demo"
    assert created["status"] == "pending"
    assert created["language"] == "hinglish"

    # Status transitions
    rec_id = created["id"]
    patch_open = client.patch(f"/api/whatsapp/outreach/{rec_id}", json={"status": "whatsapp_opened"}, headers=HEADERS)
    assert patch_open.status_code == 200
    assert patch_open.json()["status"] == "whatsapp_opened"

    patch_sent = client.patch(f"/api/whatsapp/outreach/{rec_id}", json={"status": "sent", "reminder_active": False}, headers=HEADERS)
    assert patch_sent.status_code == 200
    assert patch_sent.json()["status"] == "sent"
    assert patch_sent.json()["reminder_active"] is False


def test_whatsapp_url_encoding_unicode():
    """Verify Hindi unicode characters encode and decode perfectly for WhatsApp URLs."""
    hindi_msg = "नमस्ते राहुल जी, आपका KYC pending है। कृपया verification पूरा करें।"
    encoded = urllib.parse.quote(hindi_msg)
    url = f"https://wa.me/919305601503?text={encoded}"

    # Verify url format
    assert url.startswith("https://wa.me/919305601503?text=")
    # Verify decode restores exact original message without loss
    extracted = urllib.parse.unquote(url.split("?text=")[1])
    assert extracted == hindi_msg


def test_no_object_object_in_codebase():
    """Verify no accidental '[object Object]' template string is present in source."""
    import os
    frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
    for root, _, files in os.walk(frontend_dir):
        for f in files:
            if f.endswith((".html", ".js")):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
                    # In api.js we have the handler that strips '[object Object]', but no file should display it
                    if f != "api.js":
                        assert "[object Object]" not in content, f"Found [object Object] in {path}"
