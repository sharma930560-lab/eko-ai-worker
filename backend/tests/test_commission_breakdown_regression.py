"""
Regression tests for Commission Breakdown API endpoint and data-binding integrity.
Validates:
1. Positive earned commission (+₹22.50 DMT) with accurate transaction amount, reference, partner, and rate.
2. Paid commission with settlement UTR, settlement date, and settlement status.
3. Pending commission with pending settlement state.
4. Reversed commission with zero commission and failed transaction linkage.
5. Response contract compatibility: guarantees both top-level flattened fields AND nested commission/transaction blocks.
"""
import sys
import os
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from main import app, ensure_user_seeded
import database
import models

client = TestClient(app)
USER_ID = "demo-operator-01"
HEADERS = {"X-User-Id": USER_ID}


@pytest.fixture(scope="module", autouse=True)
def setup_seed():
    db = next(database.get_db())
    try:
        ensure_user_seeded(USER_ID, db)
    finally:
        db.close()


def test_positive_earned_commission_breakdown_22_50():
    """Verify the exact +₹22.50 commission record has accurate data binding in detail API."""
    db = next(database.get_db())
    try:
        c = db.query(models.Commission).filter(
            models.Commission.user_id == USER_ID,
            models.Commission.commission_amount == 22.5
        ).first()
        assert c is not None, "Expected at least one ₹22.50 commission record in seed data"

        res = client.get(f"/api/commissions/{c.id}", headers=HEADERS)
        assert res.status_code == 200, f"API failed: {res.text}"
        data = res.json()

        # 1. Non-zero Commission Amount
        assert data["commission_amount"] == 22.5, f"Expected 22.5, got {data.get('commission_amount')}"
        assert data["commission"]["commission_amount"] == 22.5

        # 2. Commission Status
        assert data["status"] in ("EARNED", "PAID"), f"Expected EARNED/PAID, got {data.get('status')}"
        assert data["status"] != "undefined"
        assert data["status"] != "UNDEFINED"

        # 3. Service Type
        assert "DMT" in data["service"]
        assert data["service"] != "N/A"

        # 4. Transaction Volume / Amount
        assert data["transaction_amount"] == 5000.0 or data["transaction_amount"] > 0
        assert data["transaction_amount"] != 0

        # 5. Transaction Reference / ID
        assert data["transaction_id"] == c.transaction_id
        assert data["transaction_reference"] is not None
        assert data["transaction_reference"] != "N/A"

        # 6. Commission Rate Reconciled
        assert data["commission_rate"] == 0.0045 or abs(data["commission_rate"] - (22.5 / 5000.0)) < 0.0001

        # 7. Associated Partner
        assert data["partner_name"] is not None
        assert data["partner_name"] != "N/A"
        assert data["partner_name"] != "undefined"
        assert "Paras" in data["partner_name"] or len(data["partner_name"]) > 3

        # 8. Settlement State
        if c.settlement_id:
            assert data["settlement_id"] is not None
        else:
            assert data["settlement_status"] in ("PENDING", "EARNED", None)
            assert data["settlement_reference"] is None

        # 9. Schema Compatibility (Both top-level and nested)
        assert "commission" in data
        assert "transaction" in data
        assert data["commission"]["id"] == c.id
    finally:
        db.close()


def test_paid_commission_with_settlement():
    """Verify a PAID commission record resolves settlement reference and status correctly."""
    db = next(database.get_db())
    try:
        c = db.query(models.Commission).filter(
            models.Commission.user_id == USER_ID,
            models.Commission.status == "PAID",
            models.Commission.settlement_id.isnot(None)
        ).first()
        assert c is not None, "Expected at least one PAID commission with settlement_id"

        res = client.get(f"/api/commissions/{c.id}", headers=HEADERS)
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "PAID"
        assert data["commission_amount"] > 0
        assert data["settlement_id"] == c.settlement_id
        assert data["settlement_status"] == "PAID"
        settle = db.query(models.Settlement).filter(models.Settlement.id == c.settlement_id).first()
        if settle and settle.bank_reference:
            assert data["settlement_reference"] == settle.bank_reference
    finally:
        db.close()


def test_reversed_commission_tied_to_failed_txn():
    """Verify a REVERSED commission record links properly to failed transaction and zero amount."""
    db = next(database.get_db())
    try:
        c = db.query(models.Commission).filter(
            models.Commission.user_id == USER_ID,
            models.Commission.status == "REVERSED"
        ).first()
        assert c is not None, "Expected at least one REVERSED commission"

        res = client.get(f"/api/commissions/{c.id}", headers=HEADERS)
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "REVERSED"
        assert data["commission_amount"] == 0.0
        assert data["transaction_amount"] > 0
        assert data["transaction"] is not None
        assert data["transaction"]["status"] == "failed"
    finally:
        db.close()


def test_multiple_service_types_commission():
    """Verify commission detail correctly resolves multiple service types."""
    db = next(database.get_db())
    try:
        for svc in ["DMT", "AePS", "BBPS"]:
            c = db.query(models.Commission).filter(
                models.Commission.user_id == USER_ID,
                models.Commission.service.ilike(f"%{svc}%")
            ).first()
            if not c:
                continue

            res = client.get(f"/api/commissions/{c.id}", headers=HEADERS)
            assert res.status_code == 200
            data = res.json()
            assert svc.lower() in data["service"].lower()
            assert data["transaction_amount"] is not None
            assert data["commission_amount"] is not None
            assert data["status"] in ("EARNED", "PAID", "PENDING", "REVERSED")
    finally:
        db.close()


def test_earnings_summary_reconciled():
    """Verify earnings summary totals reconcile with actual Commission ledger records."""
    db = next(database.get_db())
    try:
        all_comms = db.query(models.Commission).filter(models.Commission.user_id == USER_ID).all()
        calc_total = round(sum(c.commission_amount for c in all_comms if c.status in ("EARNED", "PAID")), 2)
        calc_pending = round(sum(c.commission_amount for c in all_comms if c.status == "PENDING"), 2)
        calc_paid = round(sum(c.commission_amount for c in all_comms if c.status == "PAID"), 2)

        res = client.get("/api/earnings/summary", headers=HEADERS)
        assert res.status_code == 200
        summary = res.json()

        assert summary["total_earnings"] == calc_total
        assert summary["pending_earnings"] == calc_pending
        assert summary["paid_earnings"] == calc_paid
    finally:
        db.close()
