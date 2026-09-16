import sqlite3
import os

db_candidates = ["../eko_data.db", "eko_data.db", "data/eko_data.db"]
db_path = None
for p in db_candidates:
    if os.path.exists(p) and os.path.getsize(p) > 10000:
        db_path = p
        break

if not db_path:
    print("Database not found")
    exit(1)
print(f"Using database: {db_path} (size: {os.path.getsize(db_path)} bytes)")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("=== CHECKING RELATIONAL INTEGRITY & ORPHAN RECORDS ===")

# 1. Check Commissions pointing to non-existent activity
cur.execute("""
    SELECT count(*) FROM commissions c 
    LEFT JOIN service_activity s ON c.transaction_id = s.id 
    WHERE c.transaction_id IS NOT NULL AND s.id IS NULL
""")
orphan_comm = cur.fetchone()[0]
print(f"Orphan Commissions (invalid transaction_id): {orphan_comm}")

# 2. Check ServiceActivity pointing to non-existent customer
cur.execute("""
    SELECT count(*) FROM service_activity s 
    LEFT JOIN customers c ON s.customer_id = c.id 
    WHERE s.customer_id IS NOT NULL AND c.id IS NULL
""")
orphan_act = cur.fetchone()[0]
print(f"Orphan Activities (invalid customer_id): {orphan_act}")

# 3. Check Complaints pointing to non-existent customer
cur.execute("""
    SELECT count(*) FROM complaints cmp 
    LEFT JOIN customers c ON cmp.customer_id = c.id 
    WHERE cmp.customer_id IS NOT NULL AND c.id IS NULL
""")
orphan_cmp = cur.fetchone()[0]
print(f"Orphan Complaints (invalid customer_id): {orphan_cmp}")

# 4. Check CreditScores pointing to non-existent customer
cur.execute("""
    SELECT count(*) FROM credit_scores cs 
    LEFT JOIN customers c ON cs.customer_id = c.id 
    WHERE cs.customer_id IS NOT NULL AND c.id IS NULL
""")
orphan_cs = cur.fetchone()[0]
print(f"Orphan Credit Scores (invalid customer_id): {orphan_cs}")

conn.close()

assert orphan_comm == 0, f"Found {orphan_comm} orphan commissions"
assert orphan_act == 0, f"Found {orphan_act} orphan activities"
assert orphan_cmp == 0, f"Found {orphan_cmp} orphan complaints"
assert orphan_cs == 0, f"Found {orphan_cs} orphan credit scores"
print("ALL ORPHAN CHECKS PASSED: ZERO ORPHAN RECORDS IN DATABASE!")
