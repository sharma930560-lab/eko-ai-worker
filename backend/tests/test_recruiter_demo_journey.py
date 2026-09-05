"""
Eko AI Operations — Recruiter Demo Journey Test
Full end-to-end workflow for an authorized recruiter operator
"""
import sys
import os
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n" + "="*80)
print("EKO AI OPERATIONS — RECRUITER DEMO JOURNEY TEST")
print("="*80)
print("\nScenario: A recruiter operator logs in, manages a partner, processes")
print("transactions, handles complaints, and uses AI assistance.\n")

# ── Session Setup ──
recruiter_id = "recruiter-demo-001"
headers = {"X-User-Id": recruiter_id}

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 1] Authentication & Initial Setup")
print("-" * 80)

res = client.get("/api/health", headers=headers)
assert res.status_code == 200
print("✓ Health check passed")
print(f"  Service: {res.json()['service']} v{res.json()['version']}")

res = client.get("/api/ops/dashboard", headers=headers)
assert res.status_code == 200
dashboard = res.json()
print("✓ Dashboard loaded successfully")
print(f"  Today's transactions: {dashboard['today_transactions']}")
print(f"  Success rate: {dashboard['success_rate']}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 2] Partner Management")
print("-" * 80)

# Create a new partner (retailer)
res = client.post("/api/partners", json={
    "name": "Sharma Retail & Banking Point",
    "phone": "+91-9876543210",
    "business_type": "Retailer",
    "email": "sharma.retail@example.com"
}, headers=headers)
assert res.status_code == 200
partner = res.json()
partner_id = partner["id"]
print(f"✓ Partner created: {partner['name']} (ID: {partner_id})")
print(f"  Business Type: {partner.get('business_type', 'N/A')}")
print(f"  Phone: {partner.get('phone', 'N/A')}")

# List all partners
res = client.get("/api/partners", headers=headers)
assert res.status_code == 200
partners = res.json()
print(f"✓ Partners list retrieved: {len(partners)} partners found")

# Get partner detail
res = client.get(f"/api/partners/{partner_id}", headers=headers)
assert res.status_code == 200
partner_detail = res.json()
print(f"✓ Partner profile loaded")
print(f"  Stats: {partner_detail.get('stats', {})}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 3] Financial Service Transactions")
print("-" * 80)

# Transaction 1: Money Transfer (DMT)
print("\n  [3.1] Money Transfer (DMT) - Success Case")
res = client.post("/api/services/dmt", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Retail",
    "receiver_name": "Amit Kumar Patel",
    "receiver_account": "1122334455",
    "receiver_ifsc": "HDFC0001234",
    "amount": 5000
}, headers=headers)
assert res.status_code == 200
dmt_txn = res.json()
dmt_txn_id = dmt_txn["id"]
assert dmt_txn["status"] == "success"
print(f"  ✓ DMT successful")
print(f"    Reference ID: {dmt_txn.get('reference_id', 'N/A')}")
print(f"    Amount: ₹{dmt_txn.get('amount', 0)}")
print(f"    Status: {dmt_txn['status']}")

# Transaction 2: AePS (Biometric Auth) - Success
print("\n  [3.2] Aadhaar e-Payment System (AePS) - Withdrawal")
res = client.post("/api/services/aeps", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Retail",
    "aadhaar_last4": "5678",
    "service_type": "withdrawal",
    "amount": 2000
}, headers=headers)
assert res.status_code == 200
aeps_txn = res.json()
aeps_txn_id = aeps_txn["id"]
print(f"  ✓ AePS transaction processed")
print(f"    Transaction ID: {aeps_txn_id}")
print(f"    Status: {aeps_txn['status']}")

# Transaction 3: Bill Payment (BBPS)
print("\n  [3.3] Bill Payments (BBPS) - Utility Bill")
res = client.post("/api/services/bbps", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Retail",
    "category": "electricity",
    "provider": "BSES Rajdhani",
    "consumer_number": "1002948192",
    "amount": 1500
}, headers=headers)
assert res.status_code == 200
bbps_txn = res.json()
bbps_txn_id = bbps_txn["id"]
print(f"  ✓ BBPS bill payment initiated")
print(f"    Bill ID: {bbps_txn.get('reference_id', 'N/A')}")
print(f"    Status: {bbps_txn['status']}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 4] Transaction Monitoring & Activity")
print("-" * 80)

# Get activity log
res = client.get("/api/activity", headers=headers)
assert res.status_code == 200
activities = res.json()
print(f"✓ Activity log retrieved: {len(activities)} transactions")

# Get specific transaction detail
res = client.get(f"/api/activity/{dmt_txn_id}", headers=headers)
assert res.status_code == 200
txn_detail = res.json()
print(f"✓ Transaction detail retrieved for {txn_detail.get('service_name', 'Unknown')}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 5] Operational Support & Complaints")
print("-" * 80)

# Create a complaint (simulated service failure)
res = client.post("/api/services/aeps", json={
    "customer_id": partner_id,
    "customer_name": "Sharma Retail",
    "aadhaar_last4": "0000",  # Triggers simulated failure
    "service_type": "withdrawal",
    "amount": 1000
}, headers=headers)
assert res.status_code == 200
failed_txn = res.json()
failed_txn_id = failed_txn["id"]
assert failed_txn["status"] == "failed"
print("✓ Simulated transaction failure for complaint handling")
print(f"  Failure reason: {failed_txn.get('failure_reason', 'Unknown')}")

# Register complaint for failed transaction
res = client.post("/api/complaints", json={
    "subject": "AePS Biometric Verification Failed",
    "description": "Customer unable to authenticate via Aadhaar biometric. Device timeout.",
    "priority": "high",
    "service_type": "aeps",
    "transaction_id": failed_txn_id,
    "customer_id": partner_id
}, headers=headers)
assert res.status_code == 200
complaint = res.json()
complaint_id = complaint["id"]
print(f"✓ Complaint registered")
print(f"  Complaint ID: {complaint_id}")
print(f"  Priority: {complaint.get('priority', 'N/A')}")
print(f"  SLA Hours: {complaint.get('sla_hours', 24)}h")

# List complaints
res = client.get("/api/complaints", headers=headers)
assert res.status_code == 200
complaints_list = res.json()
print(f"✓ Complaints list: {len(complaints_list)} open complaints")

# Get complaint detail
res = client.get(f"/api/complaints/{complaint_id}", headers=headers)
assert res.status_code == 200
complaint_detail = res.json()
print(f"✓ Complaint detail retrieved")
print(f"  Status: {complaint_detail.get('status', 'N/A')}")
print(f"  SLA Remaining: {complaint_detail.get('sla_hours_remaining', 'N/A')}h")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 6] AI-Powered Insights (Ask Eko)")
print("-" * 80)

# Question 1: What needs attention today?
res = client.post("/api/ai/ask", json={
    "question": "What operational tasks need my attention today?",
    "page_context": {"screen": "dashboard"},
    "customer_id": partner_id
}, headers=headers)
assert res.status_code == 200
ai_response = res.json()
print("✓ AI Brief - Operational priorities")
print(f"  Answer: {ai_response.get('answer', 'N/A')[:100]}...")
print(f"  Grounded: {ai_response.get('grounded', False)}")

# Question 2: How is my partner performing?
res = client.post("/api/ai/ask", json={
    "question": "How is Sharma Retail performing today?",
    "customer_id": partner_id,
    "page_context": {"screen": "partner-detail"}
}, headers=headers)
assert res.status_code == 200
ai_response = res.json()
print("✓ AI Partner Assessment")
print(f"  Answer: {ai_response.get('answer', 'N/A')[:100]}...")

# Question 3: Transaction analysis
res = client.post("/api/ai/ask", json={
    "question": "Why did the AePS transaction fail?",
    "transaction_id": failed_txn_id,
    "page_context": {"screen": "activity-detail"}
}, headers=headers)
assert res.status_code == 200
ai_response = res.json()
print("✓ AI Transaction Analysis")
print(f"  Answer: {ai_response.get('answer', 'N/A')[:100]}...")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 7] Operational Tasks & Notes")
print("-" * 80)

# Create a task
res = client.post("/api/tasks", json={
    "title": "Follow up with Sharma Retail on AePS device calibration",
    "priority": "high",
    "due_date": "2026-09-07"
}, headers=headers)
assert res.status_code == 200
task = res.json()
task_id = task["id"]
print(f"✓ Task created: {task.get('title', 'N/A')}")

# Get tasks list
res = client.get("/api/tasks", headers=headers)
assert res.status_code == 200
tasks_list = res.json()
print(f"✓ Tasks list: {len(tasks_list)} tasks")

# Create a note
res = client.post("/api/notes", json={
    "content": "Sharma Retail requested temporary increase in DMT daily limit after successful 5K transaction."
}, headers=headers)
assert res.status_code == 200
note = res.json()
print(f"✓ Note created for operational record")

# Get notes list
res = client.get("/api/notes", headers=headers)
assert res.status_code == 200
notes_list = res.json()
print(f"✓ Notes list: {len(notes_list)} notes")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 8] Notifications & Alerts")
print("-" * 80)

# Check notifications (auto-generated from failures and alerts)
res = client.get("/api/notifications", headers=headers)
assert res.status_code == 200
notifications = res.json()
print(f"✓ Notifications retrieved: {len(notifications)} pending alerts")
if notifications:
    sample = notifications[0]
    print(f"  Sample: {sample.get('message', 'N/A')[:80]}...")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 9] Credit Intelligence & Risk Assessment")
print("-" * 80)

# Get credit score history
res = client.get(f"/api/credit-score/history?customer_id={partner_id}", headers=headers)
assert res.status_code == 200
credit_history = res.json()
print(f"✓ Credit score history: {len(credit_history) if isinstance(credit_history, list) else len(credit_history.get('scores', []))} historical scores")
if isinstance(credit_history, list) and credit_history:
    latest = credit_history[0]
    print(f"  Latest assessment: {latest.get('score', 'N/A')}/100")
elif isinstance(credit_history, dict) and credit_history.get('scores'):
    latest = credit_history['scores'][0]
    print(f"  Latest assessment: {latest.get('score', 'N/A')}/100")

# Recalculate credit score
res = client.post(f"/api/credit-score/recalculate/{partner_id}", headers=headers)
assert res.status_code == 200
new_score = res.json()
print(f"✓ Credit score recalculated")
print(f"  New Score: {new_score.get('score', 'N/A')}/100")
print(f"  Risk Level: {new_score.get('risk_bracket', 'N/A')}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 10] Global Search & Discovery")
print("-" * 80)

# Search for partner by name
res = client.get("/api/search?q=Sharma", headers=headers)
assert res.status_code == 200
search_result = res.json()
print(f"✓ Global search for 'Sharma'")
print(f"  Partners found: {len(search_result.get('partners', []))}")
print(f"  Transactions: {len(search_result.get('transactions', []))}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 11] Resolve Complaint")
print("-" * 80)

# Update complaint status to resolved
res = client.patch(f"/api/complaints/{complaint_id}", json={
    "status": "resolved",
    "resolution_notes": "Device biometric module recalibrated. AePS now working normally."
}, headers=headers)
assert res.status_code == 200
resolved = res.json()
print(f"✓ Complaint resolved")
print(f"  Resolution: {resolved.get('resolution_notes', 'N/A')}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n[STEP 12] Final Dashboard Summary")
print("-" * 80)

res = client.get("/api/ops/dashboard", headers=headers)
assert res.status_code == 200
final_dashboard = res.json()
print("✓ Final Operations Dashboard")
print(f"  Total transactions processed: {final_dashboard['today_transactions']}")
print(f"  Overall success rate: {final_dashboard['success_rate']}")
print(f"  Open complaints: {final_dashboard['open_complaints']}")
print(f"  SLA at risk: {final_dashboard['sla_at_risk']}")

# ──────────────────────────────────────────────────────────────────────────────
print("\n" + "="*80)
print("✅ RECRUITER DEMO JOURNEY COMPLETED SUCCESSFULLY!")
print("="*80)
print("\nDemo Flow Summary:")
print(f"  • Partner registered: {partner['name']}")
print(f"  • Transactions processed: DMT, AePS, BBPS")
print(f"  • Complaint logged and resolved")
print(f"  • AI assistance: 3 contextual questions answered")
print(f"  • Tasks created and tracked")
print(f"  • Credit assessment performed")
print(f"  • All operations end-to-end verified")
print("\n✓ The Eko AI Operations platform is ready for recruiter deployment!\n")
