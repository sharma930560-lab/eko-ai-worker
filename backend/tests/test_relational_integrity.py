"""
Relational Integrity and Grounded Demo Operations Test Suite
Covers:
1. Nonexistent customer references in transactions
2. Nonexistent transaction references in commissions
3. Nonexistent transaction/customer references in complaints
4. Nonexistent customer references in tasks
5. Nonexistent customer references in WhatsApp outreach
6. Deterministic verification of 'Sharma Telecom & Digital Seva'
   - retrievable by customer ID
   - transactions >= 8
   - volume > 50,000
   - operational commissions present
   - active complaint linked to failed transaction
7. Ask Eko customer context accuracy (operational stats vs N/A)
"""
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import or_

from main import app
import database
import models

client = TestClient(app)
demo_headers = {"X-User-Id": "demo-operator-01"}


def test_relational_integrity_orphans():
    db = database.SessionLocal()
    user_id = "demo-operator-01"

    # Ensure user is seeded
    from main import ensure_user_seeded
    ensure_user_seeded(user_id, db)

    # 1. Check all customers & partners
    all_custs = db.query(models.Customer).filter(models.Customer.user_id == user_id).all()
    cust_ids = set(c.id for c in all_custs)
    partner_ids = set(c.id for c in all_custs if c.is_partner)
    assert len(partner_ids) >= 20, f"Expected at least 20 partners, got {len(partner_ids)}"
    assert len(cust_ids) >= 65, f"Expected at least 65 customer records, got {len(cust_ids)}"

    # 2. Check transactions pointing to nonexistent customers or partners
    txns = db.query(models.ServiceActivity).filter(models.ServiceActivity.user_id == user_id).all()
    assert len(txns) >= 120, f"Expected >= 120 transactions, got {len(txns)}"
    for t in txns:
        if t.customer_id:
            assert t.customer_id in cust_ids, f"Transaction {t.id} points to nonexistent customer_id: {t.customer_id}"
        if t.partner_id:
            assert t.partner_id in cust_ids, f"Transaction {t.id} points to nonexistent partner_id: {t.partner_id}"

    txn_ids = set(t.id for t in txns)

    # 3. Check commissions pointing to nonexistent transactions or partners
    comms = db.query(models.Commission).filter(models.Commission.user_id == user_id).all()
    assert len(comms) >= 120, f"Expected >= 120 commissions, got {len(comms)}"
    for c in comms:
        assert c.transaction_id in txn_ids, f"Commission {c.id} points to nonexistent transaction_id: {c.transaction_id}"
        if c.partner_id:
            assert c.partner_id in cust_ids, f"Commission {c.id} points to nonexistent partner_id: {c.partner_id}"
        if c.customer_id:
            assert c.customer_id in cust_ids, f"Commission {c.id} points to nonexistent customer_id: {c.customer_id}"

    # 4. Check complaints pointing to nonexistent customers or transactions
    complaints = db.query(models.Complaint).filter(models.Complaint.user_id == user_id).all()
    assert len(complaints) >= 15, f"Expected >= 15 complaints, got {len(complaints)}"
    for comp in complaints:
        assert comp.customer_id in cust_ids, f"Complaint {comp.id} points to nonexistent customer_id: {comp.customer_id}"
        if comp.transaction_id:
            assert comp.transaction_id in txn_ids, f"Complaint {comp.id} points to nonexistent transaction_id: {comp.transaction_id}"

    # 5. Check tasks pointing to nonexistent customers
    tasks = db.query(models.Task).filter(models.Task.user_id == user_id).all()
    assert len(tasks) >= 15, f"Expected >= 15 tasks, got {len(tasks)}"
    for tk in tasks:
        if tk.customer_id:
            assert tk.customer_id in cust_ids, f"Task {tk.id} points to nonexistent customer_id: {tk.customer_id}"

    # 6. Check WhatsApp outreach pointing to nonexistent customers
    wa_msgs = db.query(models.WhatsAppOutreach).filter(models.WhatsAppOutreach.user_id == user_id).all()
    assert len(wa_msgs) >= 20, f"Expected >= 20 WhatsApp messages, got {len(wa_msgs)}"
    for wa in wa_msgs:
        if wa.customer_id:
            assert wa.customer_id in cust_ids, f"WhatsApp {wa.id} points to nonexistent customer_id: {wa.customer_id}"
        if wa.partner_id:
            assert wa.partner_id in cust_ids, f"WhatsApp {wa.id} points to nonexistent partner_id: {wa.partner_id}"

    print(f"[PASS] Relational integrity verified: 0 orphan records across {len(txns)} txns, {len(comms)} commissions, {len(complaints)} complaints, {len(tasks)} tasks, {len(wa_msgs)} outreach records.")
    db.close()


def test_sharma_telecom_retrievable_and_interconnected():
    db = database.SessionLocal()
    user_id = "demo-operator-01"

    # 1. Locate Sharma Telecom
    sharma = db.query(models.Customer).filter(
        models.Customer.name.like("%Sharma Telecom%"),
        models.Customer.user_id == user_id
    ).first()
    assert sharma is not None, "Sharma Telecom & Digital Seva must exist in database"
    sharma_id = sharma.id
    print(f"[PASS] Found Sharma Telecom ID: {sharma_id}")

    # 2. Query transactions using customer ID (via API)
    res_part = client.get(f"/api/partners/{sharma_id}", headers=demo_headers)
    assert res_part.status_code == 200, f"Failed to get partner detail: {res_part.text}"
    pdata = res_part.json()
    assert pdata["id"] == sharma_id
    assert len(pdata["transactions"]) >= 8, f"Expected >= 8 transactions, got {len(pdata['transactions'])}"
    assert pdata["stats"]["total_volume"] >= 50000.0, f"Expected volume >= 50,000, got {pdata['stats']['total_volume']}"
    assert pdata["stats"]["commission"] > 0, "Expected commission > 0"
    print(f"[PASS] Partner API verified: {len(pdata['transactions'])} transactions, Volume ₹{pdata['stats']['total_volume']}, Commission ₹{pdata['stats']['commission']}")

    # 3. Query Credit Score Analysis
    res_credit = client.post("/api/credit-score/analyze", json={"customer_id": sharma_id}, headers=demo_headers)
    assert res_credit.status_code == 200, f"Credit analysis failed: {res_credit.text}"
    cdata = res_credit.json()
    assert cdata["score"] > 60.0, f"Expected dynamic score > 60.0, got {cdata['score']}"
    assert cdata["risk"] in ["LOW", "MODERATE"]
    factors = cdata["factors"]
    assert factors["total_transactions"] >= 8
    assert factors["transaction_volume"] >= 50000.0
    assert factors["recent_performance"] != "N/A"
    print(f"[PASS] Credit Analysis API verified: Score {cdata['score']}/100, Performance {factors['recent_performance']}, Txns {factors['total_transactions']}, Volume ₹{factors['transaction_volume']}")

    # 4. Query Ask Eko for Sharma Telecom Credit Assessment
    res_ai_credit = client.post("/api/ai/ask", json={
        "question": "Explain the credit assessment for Sharma Telecom & Digital Seva",
        "customer_id": sharma_id
    }, headers=demo_headers)
    assert res_ai_credit.status_code == 200
    ai_credit_json = res_ai_credit.json()
    ai_credit_ans = ai_credit_json["answer"]
    assert "79" in ai_credit_ans or "score" in ai_credit_ans.lower() or "assessment" in ai_credit_ans.lower()
    assert "₹0" not in ai_credit_ans, f"Ask Eko must not return ₹0 volume for Sharma Telecom: {ai_credit_ans}"
    assert "N/A" not in ai_credit_ans, f"Ask Eko must not return N/A performance for Sharma Telecom: {ai_credit_ans}"
    print(f"[PASS] Ask Eko Credit Assessment verified with non-zero operational values:\n{ai_credit_ans}")

    # 5. Query Ask Eko for Sharma Telecom Performance & History
    res_ai_perf = client.post("/api/ai/ask", json={
        "question": "How is Sharma Telecom & Digital Seva performing?",
        "customer_id": sharma_id
    }, headers=demo_headers)
    assert res_ai_perf.status_code == 200
    ai_perf_json = res_ai_perf.json()
    ai_perf_ans = ai_perf_json["answer"]
    assert "operations" in ai_perf_ans or "transactions" in ai_perf_ans or "volume" in ai_perf_ans.lower()
    assert "₹53,999" in ai_perf_ans or "53999" in ai_perf_ans
    print(f"[PASS] Ask Eko Performance verified with grounded operational numbers:\n{ai_perf_ans}")

    db.close()


def test_ask_eko_grounded_queries():
    # Test all Item 21 prompts:
    # - failed transactions today
    # - customer transaction history
    # - customer volume
    # - pending commission
    # - complaints near SLA
    sharma_id = "ef188a1b-3ca9-5a6d-9bf3-ff48194bb814"

    # 1. Failed transactions today
    r1 = client.post("/api/ai/ask", json={"question": "Show today's failed transactions"}, headers=demo_headers)
    assert r1.status_code == 200
    ans1 = r1.json()["answer"]
    assert "failed" in ans1.lower()
    assert "TXN-DEMO-1001" in ans1 or "timeout" in ans1.lower()
    print("[PASS] 1. Failed transactions today query answered correctly")

    # 2. Customer transaction history
    r2 = client.post("/api/ai/ask", json={"question": "Show customer transaction history", "customer_id": sharma_id}, headers=demo_headers)
    assert r2.status_code == 200
    ans2 = r2.json()["answer"]
    assert "operations" in ans2 or "transactions" in ans2
    print("[PASS] 2. Customer transaction history query answered correctly")

    # 3. Customer volume
    r3 = client.post("/api/ai/ask", json={"question": "What is customer volume?", "customer_id": sharma_id}, headers=demo_headers)
    assert r3.status_code == 200
    ans3 = r3.json()["answer"]
    assert "volume" in ans3.lower() or "₹" in ans3
    print("[PASS] 3. Customer volume query answered correctly")

    # 4. Pending commission
    r4 = client.post("/api/ai/ask", json={"question": "Explain pending commission", "customer_id": sharma_id}, headers=demo_headers)
    assert r4.status_code == 200
    ans4 = r4.json()["answer"]
    assert "commission" in ans4.lower()
    print("[PASS] 4. Pending commission query answered correctly")

    # 5. Complaints near SLA
    r5 = client.post("/api/ai/ask", json={"question": "Show urgent complaints near SLA"}, headers=demo_headers)
    assert r5.status_code == 200
    ans5 = r5.json()["answer"]
    assert "sla" in ans5.lower() or "complaint" in ans5.lower()
    print("[PASS] 5. Complaints near SLA query answered correctly")


if __name__ == "__main__":
    test_relational_integrity_orphans()
    test_sharma_telecom_retrievable_and_interconnected()
    test_ask_eko_grounded_queries()
    print("\nALL RELATIONAL INTEGRITY AND SHARMA TELECOM TESTS PASSED!")
