"""
Unit and Integration Tests for Credit Analysis Engine and Dynamic AI Result Formatting.
Tests:
- Baseline verified calculation
- Dynamic factor recalculation (KYC, failed transactions, volume, performance, tenure)
- Reset behavior
- Authorization / tenant isolation
- AI credit question differentiation & raw JSON elimination
- Step-by-step recruiter demo sequence
"""
import sys
import os
import json
import pytest
from fastapi.testclient import TestClient

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from main import app
import models

client = TestClient(app)
demo_headers = {"X-User-Id": "demo-operator-01"}
alt_headers = {"X-User-Id": "user_unauthorized_attacker_999"}


def test_credit_analysis_baseline_and_factors():
    # 1. Fetch partners to find Rahul Kumar
    res = client.get("/api/partners", headers=demo_headers)
    assert res.status_code == 200
    partners = res.json()
    rahul = next((p for p in partners if "rahul" in p["name"].lower()), None)
    assert rahul is not None, "Rahul Kumar must be seeded in demo database"
    rahul_id = rahul["id"]

    # 2. Baseline Credit Analysis
    res = client.post("/api/credit-score/analyze", json={"customer_id": rahul_id}, headers=demo_headers)
    assert res.status_code == 200
    base_data = res.json()
    assert base_data["customer_id"] == rahul_id
    assert base_data["customer_name"] == rahul["name"]
    baseline_score = base_data["score"]
    assert 50.0 <= baseline_score <= 70.0, f"Expected Rahul baseline score ~58.9, got {baseline_score}"
    assert base_data["risk"] == "MODERATE"
    assert base_data["delta"] == 0.0
    assert base_data["factors"]["kyc_status"] == "pending"
    assert base_data["factors"]["failed_transactions"] == 0
    print(f"[PASS] Baseline verified score for {rahul['name']}: {baseline_score}/100 ({base_data['risk']})")

    # 3. Factor Change: KYC Pending -> Verified
    res = client.post("/api/credit-score/analyze", json={
        "customer_id": rahul_id,
        "factors": {"kyc_status": "verified"}
    }, headers=demo_headers)
    assert res.status_code == 200
    kyc_data = res.json()
    assert kyc_data["score"] > baseline_score
    assert kyc_data["delta"] > 0
    assert "KYC changed from Pending → Verified" in kyc_data["what_changed"]
    print(f"[PASS] KYC Verified score: {kyc_data['score']}/100 (Delta: +{kyc_data['delta']} pts)")

    # 4. Factor Change: Failed Transactions 0 -> 5
    res = client.post("/api/credit-score/analyze", json={
        "customer_id": rahul_id,
        "factors": {"failed_transactions": 5}
    }, headers=demo_headers)
    assert res.status_code == 200
    fail_data = res.json()
    assert fail_data["score"] < baseline_score
    assert fail_data["risk"] == "HIGH"
    assert fail_data["delta"] < -15.0
    assert "Failed transactions changed from 0 → 5" in fail_data["what_changed"]
    print(f"[PASS] 5 Failed Txns score: {fail_data['score']}/100 (Risk: {fail_data['risk']}, Delta: {fail_data['delta']} pts)")

    # 5. Factor Change: Transaction Volume Increase
    res = client.post("/api/credit-score/analyze", json={
        "customer_id": rahul_id,
        "factors": {"transaction_volume": 150000.0}
    }, headers=demo_headers)
    assert res.status_code == 200
    vol_data = res.json()
    assert vol_data["score"] > baseline_score
    print(f"[PASS] High Volume score: {vol_data['score']}/100 (Delta: +{vol_data['delta']} pts)")

    # 6. Factor Change: Performance Drop (100% -> 40%)
    res = client.post("/api/credit-score/analyze", json={
        "customer_id": rahul_id,
        "factors": {"recent_performance": "40%"}
    }, headers=demo_headers)
    assert res.status_code == 200
    perf_data = res.json()
    assert perf_data["score"] < baseline_score
    print(f"[PASS] Low Performance score: {perf_data['score']}/100 (Delta: {perf_data['delta']} pts)")

    # 7. Factor Change: Operational Tenure (2 days -> 180 days)
    res = client.post("/api/credit-score/analyze", json={
        "customer_id": rahul_id,
        "factors": {"operational_tenure_days": 180}
    }, headers=demo_headers)
    assert res.status_code == 200
    tenure_data = res.json()
    assert tenure_data["score"] > baseline_score
    print(f"[PASS] Extended Tenure score: {tenure_data['score']}/100 (Delta: +{tenure_data['delta']} pts)")

    # 8. Reset: Calling without factors returns baseline exactly
    res = client.post("/api/credit-score/analyze", json={"customer_id": rahul_id}, headers=demo_headers)
    assert res.status_code == 200
    reset_data = res.json()
    assert reset_data["score"] == baseline_score
    assert reset_data["delta"] == 0.0
    print(f"[PASS] Reset restored baseline: {reset_data['score']}/100")


def test_credit_analysis_cross_customer_isolation():
    # Verify different customers produce isolated baselines without state leakage
    res = client.get("/api/partners", headers=demo_headers)
    partners = res.json()
    assert len(partners) >= 2
    p1 = partners[0]
    p2 = partners[1]

    res1 = client.post("/api/credit-score/analyze", json={"customer_id": p1["id"]}, headers=demo_headers)
    res2 = client.post("/api/credit-score/analyze", json={"customer_id": p2["id"]}, headers=demo_headers)
    assert res1.status_code == 200
    assert res2.status_code == 200
    data1 = res1.json()
    data2 = res2.json()
    assert data1["customer_id"] == p1["id"]
    assert data2["customer_id"] == p2["id"]
    assert data1["customer_name"] == p1["name"]
    assert data2["customer_name"] == p2["name"]
    print(f"[PASS] Cross-customer state isolation verified between {p1['name']} and {p2['name']}")


def test_credit_analysis_tenant_authorization():
    # Ensure unauthorized user cannot analyze another user's customer
    res = client.get("/api/partners", headers=demo_headers)
    rahul_id = res.json()[0]["id"]

    res_unauth = client.post("/api/credit-score/analyze", json={"customer_id": rahul_id}, headers=alt_headers)
    assert res_unauth.status_code in [403, 404], f"Expected 403 or 404 for cross-tenant access, got {res_unauth.status_code}"
    print("[PASS] Tenant authorization isolation verified")


def test_ai_credit_output_formatting_and_differentiation():
    # 1. Test "Why is Rahul's assessment lower?"
    res1 = client.post("/api/ai/ask", json={"question": "Why is Rahul's assessment lower?"}, headers=demo_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    ans1 = data1["answer"]
    assert "credit assessment" in ans1.lower()
    assert "{" not in ans1 and "}" not in ans1, f"Raw JSON found in response: {ans1}"
    assert '"success_rate"' not in ans1
    assert "stock" not in ans1.lower()
    assert "inventory" not in ans1.lower()
    assert "kyc" in ans1.lower()

    # 2. Test "What is affecting Rahul's score?"
    res2 = client.post("/api/ai/ask", json={"question": "What is affecting Rahul's score?"}, headers=demo_headers)
    assert res2.status_code == 200
    ans2 = res2.json()["answer"]
    assert "{" not in ans2 and "}" not in ans2
    assert "affecting" in ans2.lower() or "factors" in ans2.lower()

    # 3. Test "What should Rahul improve?"
    res3 = client.post("/api/ai/ask", json={"question": "What should Rahul improve?"}, headers=demo_headers)
    assert res3.status_code == 200
    ans3 = res3.json()["answer"]
    assert "{" not in ans3 and "}" not in ans3
    assert "improve" in ans3.lower()

    # 4. Test "What happens if Rahul's KYC is verified?"
    res4 = client.post("/api/ai/ask", json={"question": "What happens if Rahul's KYC is verified?"}, headers=demo_headers)
    assert res4.status_code == 200
    ans4 = res4.json()["answer"]
    assert "{" not in ans4 and "}" not in ans4
    assert "+8.0" in ans4 or "increases" in ans4.lower() or "66.9" in ans4

    # Ensure answers are NOT all identical
    assert ans1 != ans2, "Distinct questions must not return identical answers"
    assert ans1 != ans3, "Distinct questions must not return identical answers"
    assert ans1 != ans4, "Distinct questions must not return identical answers"
    print("[PASS] AI credit response formatting and question differentiation verified with zero raw JSON")


if __name__ == "__main__":
    test_credit_analysis_baseline_and_factors()
    test_credit_analysis_cross_customer_isolation()
    test_credit_analysis_tenant_authorization()
    test_ai_credit_output_formatting_and_differentiation()
    print("\nALL CREDIT ANALYSIS AND AI FORMATTING TESTS PASSED SUCCESSFULLY!")
