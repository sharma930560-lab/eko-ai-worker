"""
Ask Eko Context Isolation & Cross-Contamination Prevention Test Suite
Verifies intent planning, multi-domain isolation, anti-hijack protection,
and seamless English/Hindi/Hinglish execution across continuous sessions.
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
from context_router import plan_context

client = TestClient(app)
headers = {"X-User-Id": "usr_field_agent_01"}

def run_tests():
    print("=" * 80)
    print("TEST SUITE: ASK EKO CONTEXT ISOLATION & RESPONSE INTEGRITY")
    print("=" * 80)

    # ── 1. Context Planner Direct Unit Verification ──────────────────────────
    print("\n[PART 1] Context Planner Intent Classification Checks")
    test_cases = [
        ("Explain Rahul's credit assessment.", "CREDIT"),
        ("Show today's failed transactions.", "TRANSACTION"),
        ("meri earnings kitni hain?", "EARNINGS"),
        ("aaj mera task kya hai", "TASK"),
        ("aaj ki complaints kya hain?", "COMPLAINT"),
        ("eko mere business ke baare mei btao", "BUSINESS_OVERVIEW"),
        ("show today's failed transactions", "TRANSACTION"),
        ("hi eko, aaj mere pending tasks aur failed transactions batao", "COMPOUND"),
    ]

    for q, expected_intent in test_cases:
        plan = plan_context(q)
        print(f"  Query: '{q}' -> Intent: {plan.intent} (Language: {plan.language})")
        assert plan.intent == expected_intent, f"Expected {expected_intent} but got {plan.intent} for query '{q}'"
    print("  ✓ Part 1 Passed: All 8 intents accurately classified without ambiguity.")

    # ── 2. Context Anti-Hijack Check (Stale Screen/Customer Context) ───────────
    print("\n[PART 2] Context Anti-Hijacking Under Stale Credit Screen Context")
    stale_context = {
        "screen": "credit_analysis",
        "customer_id": "cust-rahul-01",
        "customer_name": "Rahul Kumar",
        "assessment": "79.6"
    }

    # Query for tasks while user happens to have Rahul's credit screen open
    plan_with_stale_ctx = plan_context("aaj mera task kya hai", active_context=stale_context)
    print(f"  Stale context on 'aaj mera task kya hai' -> Intent: {plan_with_stale_ctx.intent}")
    assert plan_with_stale_ctx.intent == "TASK", "Stale credit context hijacked task intent!"
    assert "credit" not in plan_with_stale_ctx.domains

    # Query for failed txns while user happens to have credit screen open
    plan_txns_with_stale_ctx = plan_context("Show today's failed transactions.", active_context=stale_context)
    print(f"  Stale context on 'Show today's failed transactions.' -> Intent: {plan_txns_with_stale_ctx.intent}")
    assert plan_txns_with_stale_ctx.intent == "TRANSACTION", "Stale credit context hijacked transaction intent!"
    assert "credit" not in plan_txns_with_stale_ctx.domains
    print("  ✓ Part 2 Passed: Stale screen context does not hijack operational queries.")

    # ── 3. Continuous 8-Query Live API Sequence Execution ─────────────────────
    print("\n[PART 3] Continuous 8-Query Sequential Session Execution")
    session_history = []
    
    sequence = [
        (1, "Explain Rahul's credit assessment.", "CREDIT", ["credit", "assessment", "79.6"], ["task", "complaint"]),
        (2, "Show today's failed transactions.", "TRANSACTION", ["failed", "transaction", "reconciliation"], ["credit assessment"]),
        (3, "meri earnings kitni hain?", "EARNINGS", ["earnings", "commission", "₹"], ["credit assessment"]),
        (4, "aaj mera task kya hai", "TASK", ["task", "pending"], ["credit assessment", "settlement dues"]),
        (5, "aaj ki complaints kya hain?", "COMPLAINT", ["complaint", "sla"], ["credit assessment"]),
        (6, "eko mere business ke baare mei btao", "BUSINESS_OVERVIEW", ["overview", "volume", "txns"], []),
        (7, "show today's failed transactions", "TRANSACTION", ["failed", "transaction"], ["credit assessment"]),
        (8, "hi eko, aaj mere pending tasks aur failed transactions batao", "COMPOUND", ["task", "failed"], ["credit assessment"]),
    ]

    for step_num, q_text, exp_intent, must_have, must_not_have in sequence:
        payload = {
            "question": q_text,
            "history": session_history[-6:], # Carry rolling history in same session
            "page_context": stale_context if step_num > 1 else None # Simulate active screen
        }
        res = client.post("/api/ai/ask", json=payload, headers=headers)
        assert res.status_code == 200, f"Step {step_num} failed with {res.status_code}: {res.text}"
        data = res.json()
        ans = data.get("answer", "")
        intent = data.get("intent")
        facts = data.get("facts", [])

        print(f"\n  [Step {step_num}] '{q_text}'")
        print(f"    -> Intent: {intent} (Expected: {exp_intent})")
        print(f"    -> Answer snippet: {ans[:90]}...")
        print(f"    -> Facts count: {len(facts)}")

        assert intent == exp_intent, f"Step {step_num} returned intent {intent}, expected {exp_intent}"
        ans_lower = ans.lower()
        for term in must_have:
            assert term.lower() in ans_lower, f"Step {step_num} missing expected term '{term}' in answer"
        for forbidden in must_not_have:
            assert forbidden.lower() not in ans_lower, f"Step {step_num} leaked forbidden term '{forbidden}' into answer!"

        # Append to continuous session history
        session_history.append({"role": "user", "content": q_text})
        session_history.append({"role": "assistant", "content": ans})

    print("\n  ✓ Part 3 Passed: All 8 sequential queries succeeded in the SAME session without cross-contamination!")

    print("\n" + "=" * 80)
    print("ALL CONTEXT ISOLATION & RESPONSE INTEGRITY TESTS PASSED (100% GREEN)")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
