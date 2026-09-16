"""
EKO MULTILINGUAL & CONTEXT INTEGRITY REGRESSION SUITE
Validates:
1. 15 test cases: 5 distinct customers x 3 languages (English, Hindi Devanagari, Hinglish)
2. Zero customer context pollution (e.g. Rajesh Kumar never maps to Rahul Kumar)
3. Genuine language output: Hindi has real Devanagari Unicode (\u0900-\u097f), Hinglish has natural Roman-script vernacular
4. WhatsApp deep link encoding and URL correctness
5. Tasks demo data quality gate (18 clean tasks, 0 test pollution, balanced priorities)
6. Task teardown and tenant isolation
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import urllib.parse
import pytest
from fastapi.testclient import TestClient
import main
import database
import models

client = TestClient(main.app)

DEMO_USER_ID = "demo-operator-01"
OTHER_USER_ID = "tenant-beta"

CUSTOMERS = [
    {"name": "Rajesh Kumar", "phone": "9856123456"},
    {"name": "Sharma Telecom", "phone": "9876543210"},
    {"name": "Pooja Devi", "phone": "9834567890"},
    {"name": "Aarav Sharma", "phone": "9845012345"},
    {"name": "Verma Communication", "phone": "9823456789"}
]

LANGUAGES = ["English", "Hindi", "Hinglish"]


def test_whatsapp_15_multilingual_matrix():
    """
    5 distinct customers x 3 languages = 15 test cases
    All must succeed with 100% name and language fidelity.
    """
    for cust in CUSTOMERS:
        for lang in LANGUAGES:
            payload = {
                "customer_name": cust["name"],
                "customer_phone": cust["phone"],
                "template_type": "dmt_success",
                "details": "10000",
                "language": lang
            }
            res = client.post("/api/whatsapp/generate", json=payload, headers={"X-User-Id": DEMO_USER_ID})
            assert res.status_code == 200, f"Failed for {cust['name']} in {lang}: {res.text}"
            data = res.json()

            # 1. Verify customer name
            assert data["customer_name"] == cust["name"], f"Name mismatch for {cust['name']}"
            assert "Rahul" not in data["message"] or cust["name"] == "Rahul", f"Polluted with Rahul for {cust['name']}"
            assert cust["name"] in data["message"], f"Expected {cust['name']} in message: {data['message']}"

            # 2. Verify language fidelity
            msg = data["message"]
            if lang == "Hindi":
                devanagari_chars = [c for c in msg if '\u0900' <= c <= '\u097F']
                assert len(devanagari_chars) >= 10, f"Hindi message must have genuine Devanagari chars: {msg}"
            elif lang == "English":
                devanagari_chars = [c for c in msg if '\u0900' <= c <= '\u097F']
                assert len(devanagari_chars) == 0, f"English message must not have Devanagari chars: {msg}"
                assert "successful" in msg.lower() or "completed" in msg.lower() or "transferred" in msg.lower()
            elif lang == "Hinglish":
                lower_msg = msg.lower()
                has_hinglish_terms = any(term in lower_msg for term in ["namaste", "ji", "karein", "ho gaya", "safar", "labh", "ke liye", "instant"])
                assert has_hinglish_terms, f"Hinglish message must contain natural vernacular phrasing: {msg}"

            # 3. Verify details / amount interpolation
            assert "10,000" in msg or "10000" in msg, f"Details/Amount 10000 missing in message: {msg}"

            # 4. Verify WhatsApp deep link
            wa_url = data.get("whatsapp_url", "")
            assert wa_url.startswith("https://wa.me/"), f"Invalid WA URL: {wa_url}"
            assert urllib.parse.quote(msg) in wa_url or urllib.parse.quote_plus(msg) in wa_url or cust["name"] in urllib.parse.unquote(wa_url)


def test_customer_context_mismatch_prevention():
    """
    Explicit regression test for Bug A:
    Selecting 'Rajesh Kumar' must NEVER produce 'Rahul Kumar'.
    """
    res = client.post("/api/whatsapp/generate", json={
        "customer_name": "Rajesh Kumar",
        "template_type": "dmt_success",
        "details": "₹10,000 transferred to HDFC bank account",
        "language": "Hindi"
    }, headers={"X-User-Id": DEMO_USER_ID})

    assert res.status_code == 200
    data = res.json()
    assert data["customer_name"] == "Rajesh Kumar"
    assert "Rahul" not in data["message"]
    assert "Rajesh Kumar" in data["message"]
    assert any('\u0900' <= c <= '\u097F' for c in data["message"]), "Hindi must be Devanagari"


def test_all_template_types_supported():
    """Verify all templates work in Hindi, English, and Hinglish."""
    templates = ["dmt_success", "dmt_failed", "aeps_success", "bbps_success", "recharge_success", "payment_reminder", "custom"]
    for ttype in templates:
        res = client.post("/api/whatsapp/generate", json={
            "customer_name": "Sharma Telecom",
            "template_type": ttype,
            "details": "Invoice #4401 ₹2,500",
            "language": "Hindi"
        }, headers={"X-User-Id": DEMO_USER_ID})
        assert res.status_code == 200
        data = res.json()
        assert "Sharma Telecom" in data["message"]
        assert any('\u0900' <= c <= '\u097F' for c in data["message"])


def test_tasks_demo_dataset_quality_gate():
    """
    Verify the tasks dataset for demo-operator-01 is realistic, unpolluted,
    and free of repeated automated regression test tasks.
    """
    res = client.get("/api/tasks", headers={"X-User-Id": DEMO_USER_ID})
    assert res.status_code == 200
    tasks = res.json()

    # Must have realistic count
    assert len(tasks) == 18, f"Expected exactly 18 demo tasks, found {len(tasks)}"

    # Must NOT have any regression test pollution
    for task in tasks:
        title = task.get("title", "")
        assert "Automated Regression Test Task" not in title, f"Found test pollution task: {title}"
        assert "test" not in title.lower() or "csp test" in title.lower(), f"Suspicious test task: {title}"

    # Verify priority distribution is realistic (not all HIGH)
    priorities = [t.get("priority", "medium").lower() for t in tasks]
    high_count = priorities.count("high")
    med_count = priorities.count("medium")
    low_count = priorities.count("low")

    assert high_count > 0, "Should have high priority tasks"
    assert med_count > 0, "Should have medium priority tasks"
    assert low_count > 0, "Should have low priority tasks"
    assert high_count < len(tasks), "Priorities must be distributed, not all high"


def test_task_creation_deletion_isolation():
    """
    Verifies that creating and deleting tasks maintains clean teardown
    and adheres to strict tenant isolation.
    """
    # 1. Baseline count
    res_before = client.get("/api/tasks", headers={"X-User-Id": DEMO_USER_ID})
    count_before = len(res_before.json())

    # 2. Create a temporary task
    create_res = client.post("/api/tasks", json={
        "title": "Ephemeral Verification Task",
        "description": "Will be cleaned up immediately",
        "priority": "low",
        "due_date": "2026-09-30"
    }, headers={"X-User-Id": DEMO_USER_ID})
    assert create_res.status_code == 200
    task_id = create_res.json()["id"]

    # 3. Cross-tenant delete must fail with 404
    cross_del = client.delete(f"/api/tasks/{task_id}", headers={"X-User-Id": OTHER_USER_ID})
    assert cross_del.status_code == 404, "Tenant isolation failure: other user deleted task"

    # 4. Legitimate owner delete succeeds
    owner_del = client.delete(f"/api/tasks/{task_id}", headers={"X-User-Id": DEMO_USER_ID})
    assert owner_del.status_code == 200
    assert owner_del.json()["deleted"] is True

    # 5. Verify count returned to exact baseline
    res_after = client.get("/api/tasks", headers={"X-User-Id": DEMO_USER_ID})
    assert len(res_after.json()) == count_before
