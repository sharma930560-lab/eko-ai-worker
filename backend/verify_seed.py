"""
Eko Partner Operations — Synthetic Data Integrity Verifier
Run: cd backend && python verify_seed.py

Checks that the canonical seed data is relationally consistent and
complete. Prints PASS/FAIL per check. Exit code 0 = all pass.
"""
import sys
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
Session = sessionmaker(bind=engine)
db = Session()

USER_ID = "demo-operator-01"
PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

results = []

def check(label, condition, detail=""):
    status = PASS if condition else FAIL
    mark = "✓" if condition else "✗"
    msg = f"  [{mark}] {label}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append(condition)


print("\n══════════════════════════════════════════")
print("  EKO Synthetic Data Integrity Verifier")
print("══════════════════════════════════════════\n")

# ── 1. Record Count Checks ─────────────────────────────────────────────────────
print("▶ Record Counts")

partners_count = db.execute(text(
    "SELECT COUNT(*) FROM customers WHERE user_id=:uid AND is_partner=1"
), {"uid": USER_ID}).scalar() or 0
check("Partners seeded", partners_count >= 15, f"{partners_count} records (expected ≥15)")

customers_count = db.execute(text(
    "SELECT COUNT(*) FROM customers WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Customers seeded", customers_count >= 60, f"{customers_count} records (expected ≥60)")

txn_count = db.execute(text(
    "SELECT COUNT(*) FROM service_activity WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Transactions seeded", txn_count >= 100, f"{txn_count} records (expected ≥100)")

comm_count = db.execute(text(
    "SELECT COUNT(*) FROM commissions WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Commissions seeded", comm_count >= 100, f"{comm_count} records (expected ≥100)")

settle_count = db.execute(text(
    "SELECT COUNT(*) FROM settlements WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Settlements seeded", settle_count >= 3, f"{settle_count} records (expected ≥3)")

complaint_count = db.execute(text(
    "SELECT COUNT(*) FROM complaints WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Complaints seeded", complaint_count >= 10, f"{complaint_count} records (expected ≥10)")

wa_count = db.execute(text(
    "SELECT COUNT(*) FROM whatsapp_outreach WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("WhatsApp outreach seeded", wa_count >= 15, f"{wa_count} records (expected ≥15)")

task_count = db.execute(text(
    "SELECT COUNT(*) FROM tasks WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Tasks seeded", task_count >= 10, f"{task_count} records (expected ≥10)")

credit_count = db.execute(text(
    "SELECT COUNT(*) FROM credit_scores WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Credit scores seeded", credit_count >= 5, f"{credit_count} records (expected ≥5)")

# ── 2. FK Integrity ───────────────────────────────────────────────────────────
print("\n▶ Foreign Key Integrity")

# Every commission must reference a valid service_activity row
orphan_commissions = db.execute(text("""
    SELECT COUNT(*) FROM commissions c
    WHERE user_id=:uid
      AND NOT EXISTS (
        SELECT 1 FROM service_activity sa WHERE sa.id = c.transaction_id
      )
"""), {"uid": USER_ID}).scalar() or 0
check("Commission → ServiceActivity FK", orphan_commissions == 0,
      f"{orphan_commissions} orphan commission(s)")

# Every complaint's transaction_id (if set) must reference service_activity
orphan_complaints = db.execute(text("""
    SELECT COUNT(*) FROM complaints c
    WHERE user_id=:uid
      AND transaction_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM service_activity sa WHERE sa.id = c.transaction_id
      )
"""), {"uid": USER_ID}).scalar() or 0
check("Complaint → ServiceActivity FK", orphan_complaints == 0,
      f"{orphan_complaints} orphan complaint(s)")

# Every service_activity with a customer_id must have a matching customer
orphan_txns = db.execute(text("""
    SELECT COUNT(*) FROM service_activity sa
    WHERE user_id=:uid
      AND customer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM customers c WHERE c.id = sa.customer_id
      )
"""), {"uid": USER_ID}).scalar() or 0
check("ServiceActivity → Customer FK", orphan_txns == 0,
      f"{orphan_txns} orphan transaction(s)")

# ── 3. Business Logic Checks ──────────────────────────────────────────────────
print("\n▶ Business Logic")

# At least one PAID settlement
paid_settlements = db.execute(text(
    "SELECT COUNT(*) FROM settlements WHERE user_id=:uid AND status='PAID'"
), {"uid": USER_ID}).scalar() or 0
check("At least one PAID settlement", paid_settlements >= 1, f"{paid_settlements} paid")

# Success rate check: ≥50% of transactions should be 'success'
success_txns = db.execute(text(
    "SELECT COUNT(*) FROM service_activity WHERE user_id=:uid AND status='success'"
), {"uid": USER_ID}).scalar() or 0
success_rate = (success_txns / txn_count * 100) if txn_count > 0 else 0
check("Transaction success rate ≥50%", success_rate >= 50,
      f"{success_rate:.1f}% ({success_txns}/{txn_count})")

# All REVERSED commissions have a failed transaction
reversed_with_success = db.execute(text("""
    SELECT COUNT(*) FROM commissions c
    JOIN service_activity sa ON sa.id = c.transaction_id
    WHERE c.user_id=:uid
      AND c.status='REVERSED'
      AND sa.status != 'failed'
"""), {"uid": USER_ID}).scalar() or 0
check("REVERSED commissions tied to failed txns only", reversed_with_success == 0,
      f"{reversed_with_success} mismatches")

# Credit scores are in valid range (0-100)
out_of_range_scores = db.execute(text(
    "SELECT COUNT(*) FROM credit_scores WHERE user_id=:uid AND (score < 0 OR score > 100)"
), {"uid": USER_ID}).scalar() or 0
check("Credit scores in valid range [0,100]", out_of_range_scores == 0,
      f"{out_of_range_scores} out-of-range scores")

# Transactions reference at least 3 different service types
service_types = db.execute(text(
    "SELECT COUNT(DISTINCT service_name) FROM service_activity WHERE user_id=:uid"
), {"uid": USER_ID}).scalar() or 0
check("Multiple service types in ledger", service_types >= 3,
      f"{service_types} distinct service types")

# ── 4. Data Quality ───────────────────────────────────────────────────────────
print("\n▶ Data Quality")

# No null amounts (except AePS-Mini Statement which is non-monetary)
null_amounts = db.execute(text(
    "SELECT COUNT(*) FROM service_activity "
    "WHERE user_id=:uid AND (amount IS NULL OR amount <= 0) "
    "AND service_name NOT IN ('AePS-Mini Statement', 'AePS Mini Statement', 'AePS-Balance Enquiry')"
), {"uid": USER_ID}).scalar() or 0
check("All monetary transactions have positive amounts", null_amounts == 0,
      f"{null_amounts} zero/null amounts (AePS mini-stmt excluded)")

# No duplicate reference_ids
dup_refs = db.execute(text("""
    SELECT COUNT(*) FROM (
        SELECT reference_id FROM service_activity
        WHERE user_id=:uid AND reference_id IS NOT NULL
        GROUP BY reference_id HAVING COUNT(*) > 1
    ) t
"""), {"uid": USER_ID}).scalar() or 0
check("No duplicate reference IDs", dup_refs == 0, f"{dup_refs} duplicate refs")

# WhatsApp records have valid status values (full real-world lifecycle)
invalid_wa_status = db.execute(text("""
    SELECT COUNT(*) FROM whatsapp_outreach
    WHERE user_id=:uid
      AND status NOT IN ('draft','pending','sent','delivered','read',
                         'whatsapp_opened','failed','cancelled')
"""), {"uid": USER_ID}).scalar() or 0
check("WhatsApp status values valid", invalid_wa_status == 0,
      f"{invalid_wa_status} invalid status(es)")

db.close()

# ── Summary ───────────────────────────────────────────────────────────────────
passed = sum(1 for r in results if r)
total = len(results)
failed = total - passed
print(f"\n══════════════════════════════════════════")
print(f"  Result: {passed}/{total} checks passed", end="")
if failed > 0:
    print(f"  ({failed} FAILED)", end="")
print(f"\n══════════════════════════════════════════\n")

sys.exit(0 if failed == 0 else 1)
