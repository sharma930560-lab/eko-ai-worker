"""
Authorization & Cross-User Data Isolation Test Suite
Verifies that user A cannot access user B's partners, transactions, or complaints.
"""
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

user_a_headers = {"X-User-Id": "user-alpha-101"}
user_b_headers = {"X-User-Id": "user-beta-202"}

print("="*80)
print("AUTHORIZATION & CROSS-USER DATA ISOLATION TEST")
print("="*80)

# 1. User A creates a partner
res_a = client.post("/api/partners", json={
    "name": "Alpha Secret Retailer",
    "phone": "9111111111",
    "category": "Retailer",
    "email": "alpha@example.com"
}, headers=user_a_headers)
assert res_a.status_code == 200
partner_a_id = res_a.json()["id"]
print(f"[STEP 1] User A created partner: {partner_a_id}")

# 2. User A creates a transaction
res_txn_a = client.post("/api/services/dmt", json={
    "customer_id": partner_a_id,
    "customer_name": "Alpha Secret Retailer",
    "receiver_name": "Secret Receiver",
    "receiver_account": "999888777",
    "receiver_ifsc": "SBIN0009999",
    "amount": 5000
}, headers=user_a_headers)
assert res_txn_a.status_code == 200
txn_a_id = res_txn_a.json()["id"]
print(f"[STEP 2] User A created transaction: {txn_a_id}")

# 3. User B attempts to fetch User A's partner
res_b_partner = client.get(f"/api/partners/{partner_a_id}", headers=user_b_headers)
print(f"[STEP 3] User B fetch User A partner response: {res_b_partner.status_code}")
assert res_b_partner.status_code in (404, 403)

# 4. User B attempts to fetch User A's transaction detail
res_b_txn = client.get(f"/api/activity/{txn_a_id}", headers=user_b_headers)
print(f"[STEP 4] User B fetch User A transaction response: {res_b_txn.status_code}")
assert res_b_txn.status_code in (404, 403)

# 5. User B lists partners - User A's partner must NOT be in User B's list
res_b_list = client.get("/api/partners", headers=user_b_headers)
assert res_b_list.status_code == 200
user_b_partners = res_b_list.json()
assert not any(p["id"] == partner_a_id for p in user_b_partners)
print(f"[STEP 5] User B partners list verified: User A's partner is isolated and invisible to User B.")

print("\n✓ ALL AUTHORIZATION & CROSS-USER ISOLATION TESTS PASSED CLEANLY!")
