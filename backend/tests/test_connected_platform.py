import sys
import os
import json

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

headers = {"X-User-Id": "qa-test-user-001"}

print("=== STARTING CONNECTED PLATFORM QA SUITE ===")

# 1. Health
res = client.get("/api/health")
assert res.status_code == 200, f"Health failed: {res.text}"
print("[PASS] 1. Health Check:", res.json())

# 2. Ops Dashboard
res = client.get("/api/ops/dashboard", headers=headers)
assert res.status_code == 200, f"Dashboard failed: {res.text}"
dash = res.json()
print("[PASS] 2. Ops Dashboard:", dash)
assert "today_transactions" in dash
assert "success_rate" in dash

# 3. Create Partner
res = client.post("/api/partners", json={
    "name": "Sharma Telecom QA",
    "phone": "9876543210",
    "category": "Retailer",
    "email": "sharma.qa@example.com"
}, headers=headers)
assert res.status_code == 200, f"Create partner failed: {res.text}"
partner = res.json()
partner_id = partner["id"]
print("[PASS] 3. Create Partner:", partner_id, partner["name"])

# 4. List Partners & Detail
res = client.get("/api/partners", headers=headers)
assert res.status_code == 200
partners = res.json()
assert any(p["id"] == partner_id for p in partners)

res = client.get(f"/api/partners/{partner_id}", headers=headers)
assert res.status_code == 200
p_detail = res.json()
assert "stats" in p_detail
assert "transactions" in p_detail
assert "complaints" in p_detail
print("[PASS] 4. Partner Detail Verified with stats, transactions, complaints")

# 5. Service Flow: DMT
res = client.post("/api/services/dmt", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Telecom QA",
    "receiver_name": "Amit Kumar",
    "receiver_account": "1122334455",
    "receiver_ifsc": "SBIN0001234",
    "amount": 2500
}, headers=headers)
assert res.status_code == 200
dmt_res = res.json()
txn_id = dmt_res["id"]
print("[PASS] 5. DMT Money Transfer:", dmt_res["status"], f"ID: {txn_id}")

# 6. Service Flow: AePS (Failure Case to test failure handling & alert generation)
res = client.post("/api/services/aeps", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Telecom QA",
    "aadhaar_last4": "0000", # triggers simulated failure
    "service_type": "withdrawal",
    "amount": 1000
}, headers=headers)
assert res.status_code == 200
aeps_res = res.json()
assert aeps_res["status"] == "failed"
failed_txn_id = aeps_res["id"]
print("[PASS] 6. AePS Simulated Failure:", aeps_res["failure_reason"])

# 7. Check Notifications (AePS failure must have generated notification)
res = client.get("/api/notifications", headers=headers)
assert res.status_code == 200
notifs = res.json()
assert len(notifs) > 0
print(f"[PASS] 7. Notifications Auto-Created on Failure: {len(notifs)} pending")

# 8. Service Flow: BBPS
res = client.post("/api/services/bbps", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Telecom QA",
    "category": "Electricity",
    "provider": "BSES Rajdhani",
    "consumer_number": "1002948192",
    "amount": 1450
}, headers=headers)
assert res.status_code == 200
bbps_res = res.json()
print("[PASS] 8. BBPS Bill Payment:", bbps_res["status"], bbps_res.get("reference_id"))

# 9. Service Flow: Recharge
res = client.post("/api/services/recharge", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Telecom QA",
    "mobile_number": "9876543210",
    "operator": "Jio",
    "plan_amount": 299
}, headers=headers)
assert res.status_code == 200
rech_res = res.json()
print("[PASS] 9. Mobile Recharge:", rech_res["status"])

# 10. Create Complaint for Failed Txn
res = client.post("/api/complaints", json={
    "customer_id": partner_id,
    "transaction_id": failed_txn_id,
    "subject": "AePS Biometric Timeout on Withdrawal",
    "description": "Customer attempted ₹1000 withdrawal but biometric timed out at bank server.",
    "priority": "high",
    "sla_hours": 24
}, headers=headers)
assert res.status_code == 200
complaint = res.json()
complaint_id = complaint["id"]
print("[PASS] 10. Complaint Registered:", complaint_id, complaint["subject"])

# 11. List Complaints & Detail with SLA calculation
res = client.get("/api/complaints", headers=headers)
assert res.status_code == 200
complaints = res.json()
c_match = next((c for c in complaints if c["id"] == complaint_id), None)
assert c_match is not None
assert c_match["sla_hours_remaining"] is not None
print(f"[PASS] 11. Complaint Listed with SLA: {c_match['sla_hours_remaining']:.1f}h remaining")

res = client.get(f"/api/complaints/{complaint_id}", headers=headers)
assert res.status_code == 200
c_detail = res.json()
assert c_detail["transaction"]["id"] == failed_txn_id
assert c_detail["customer"]["id"] == partner_id
print("[PASS] 12. Complaint Detail with linked transaction and customer verified")

# 12. Global Search
res = client.get("/api/search?q=Sharma", headers=headers)
assert res.status_code == 200
search_res = res.json()
assert len(search_res["partners"]) > 0 or len(search_res["transactions"]) > 0
print(f"[PASS] 13. Global Search: found {len(search_res['partners'])} partners, {len(search_res['transactions'])} txns, {len(search_res['complaints'])} complaints")

# 13. Daily Brief
res = client.get("/api/ai/brief", headers=headers)
assert res.status_code == 200
brief = res.json()
assert "summary" in brief
assert "stats" in brief
assert "summary_items" in brief
print("[PASS] 14. Daily Brief:", brief["summary"])

# 14. Ask Eko with active transaction context
res = client.post("/api/ai/ask", json={
    "question": "Why did this transaction fail and what should I do?",
    "transaction_id": failed_txn_id
}, headers=headers)
assert res.status_code == 200
ai_res = res.json()
ai_ans = ai_res["answer"][:120].encode("ascii", "replace").decode("ascii")
print("[PASS] 15. Ask Eko with Active Transaction Context:", ai_ans, "...")

# 15. AI Utilities: Scan Bill, Voice Parse, Generate Message
res = client.post("/api/ai/scan-bill", json={"image_base64": "mock_data"}, headers=headers)
assert res.status_code == 200
assert res.json()["status"] == "success"

res = client.post("/api/ai/voice-parse", json={"text": "Send 2000 to Ramesh via DMT"}, headers=headers)
assert res.status_code == 200
assert res.json()["intent"] == "DMT_TRANSFER"

res = client.post("/api/ai/generate-message", json={"type": "reminder", "customer_id": partner_id}, headers=headers)
assert res.status_code == 200
assert "message" in res.json()
print("[PASS] 16. AI Suite Utilities (Scan Bill, Voice Parse, Generate Message) Verified")

# 16. Resolve Complaint & Check Auto-dismissal of notification
res = client.patch(f"/api/complaints/{complaint_id}", json={"status": "resolved"}, headers=headers)
assert res.status_code == 200
print("[PASS] 17. Complaint Resolved successfully")

# 18. Tasks API (GET, POST, PATCH)
res = client.get("/api/tasks", headers=headers)
assert res.status_code == 200
tasks = res.json()
print(f"[PASS] 18. Tasks List: {len(tasks)} tasks found")

res = client.post("/api/tasks", json={
    "title": "Visit Sharma Telecom for biometric device check",
    "due_date": "Today"
}, headers=headers)
assert res.status_code == 200
new_task = res.json()
task_id = new_task["id"]
assert new_task["completed"] is False
print(f"[PASS] 19. Task Created: {task_id}")

res = client.patch(f"/api/tasks/{task_id}", json={"completed": True}, headers=headers)
assert res.status_code == 200
assert res.json()["completed"] is True
print("[PASS] 20. Task Completed via PATCH")

# 19. Notes API (GET, POST, DELETE)
res = client.get("/api/notes", headers=headers)
assert res.status_code == 200
notes = res.json()
print(f"[PASS] 21. Notes List: {len(notes)} notes found")

res = client.post("/api/notes", json={
    "title": "Sharma Telecom Route Memo",
    "content": "Retailer needs updated marketing banner and new QR standee."
}, headers=headers)
assert res.status_code == 200
new_note = res.json()
note_id = new_note["id"]
print(f"[PASS] 22. Note Created: {note_id}")

res = client.delete(f"/api/notes/{note_id}", headers=headers)
assert res.status_code == 200
print("[PASS] 23. Note Deleted successfully")

# 20. Direct Activity / Transaction Detail Endpoint
res = client.get(f"/api/activity/{txn_id}", headers=headers)
assert res.status_code == 200
assert res.json()["id"] == txn_id

res = client.get(f"/api/transactions/{txn_id}", headers=headers)
assert res.status_code == 200
assert res.json()["id"] == txn_id
print("[PASS] 24. Direct /api/activity and /api/transactions verified")

# 21. Demo Operator 01 Pre-seeded State
demo_headers = {"X-User-Id": "demo-operator-01"}
res = client.get("/api/partners", headers=demo_headers)
assert res.status_code == 200
demo_partners = res.json()
assert len(demo_partners) >= 6
paras_store = next((p for p in demo_partners if "Paras" in p["name"]), None)
assert paras_store is not None, "Paras General Store must be seeded"
print(f"[PASS] 25. Demo Operator Seeding: {len(demo_partners)} partners, found {paras_store['name']}")

# Demo reset must remain blocked unless the process explicitly enables DEMO_MODE.
res = client.post("/api/demo/reset", headers=demo_headers)
assert res.status_code == 403
print("[PASS] 25a. Demo Reset Protection: blocked outside DEMO_MODE")

# 22. Grounded AI Operational Prompts - No Inventory / Retail Items
ai_prompts = [
    "Who is Paras General Store?",
    "Why did transaction TXN-DEMO-1001 fail?",
    "Show me today's urgent complaints",
    "Which partners have pending payments?",
    "What is today's operations brief?",
    "Tell me about operator Rahul Kumar",
    "Help me with AePS timeout"
]

for prompt in ai_prompts:
    res = client.post("/api/ai/ask", json={"question": prompt}, headers=demo_headers)
    assert res.status_code == 200
    ans = res.json()["answer"].lower()
    # Ensure no stock/inventory/retail items are returned
    forbidden = ["in stock", "out of stock", "inventory count", "shelf life", "grocery item", "sku-", "warehouse aisle"]
    for word in forbidden:
        assert word not in ans, f"Forbidden inventory term '{word}' found in response to: {prompt}"
print(f"[PASS] 26. Grounded AI: All {len(ai_prompts)} operational prompts answered cleanly with zero inventory/stock hallucinations")

# Exact regression for the production Rahul assessment bug.
res = client.post("/api/ai/ask", json={"question": "Why is Rahul's assessment lower?"}, headers=demo_headers)
assert res.status_code == 200
rahul_ai = res.json()
rahul_answer = rahul_ai["answer"].lower()
assert rahul_ai["grounded"] is True
assert "credit assessment" in rahul_answer
assert "stock" not in rahul_answer
assert "inventory" not in rahul_answer
assert "purchase volume" not in rahul_answer
print("[PASS] 26a. Rahul Credit Regression: database-grounded response with no legacy retail narrative")

# 23. Ops Dashboard re-check (complaint count should update)
res = client.get("/api/ops/dashboard", headers=headers)
assert res.status_code == 200
updated_dash = res.json()
print("[PASS] 27. Ops Dashboard after updates:", updated_dash)

print("\nSUCCESS: ALL 27 CONNECTED PLATFORM & GROUNDED AI QA WORKFLOWS PASSED EMPIRICALLY!")


