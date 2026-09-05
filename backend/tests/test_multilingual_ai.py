"""
Multilingual Live AI & PII Redaction Test Suite
Tests English, Hindi, Hinglish, and Mixed query reasoning + PII Sanitization
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
from ai_provider import sanitize_context_for_ai

client = TestClient(app)
headers = {"X-User-Id": "multilingual-qa-user"}

print("="*80)
print("MULTILINGUAL LIVE AI & DATA PRIVACY TEST SUITE")
print("="*80)

# 1. PII Redaction Unit Test
raw_pii_text = (
    "Customer Aadhaar: 9876-5432-1098, PAN: ABCDE1234F, Card: 4111-2222-3333-4444, "
    "JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c, "
    "API Key: AIzaSyA1234567890abcdef1234567890abcde"
)
sanitized = sanitize_context_for_ai(raw_pii_text)
print("\n[TEST 1] PII Sanitization & Redaction Check:")
print("Original PII snippet present:", "9876-5432-1098" in raw_pii_text)
print("Sanitized contains [AADHAAR_REDACTED]:", "[AADHAAR_REDACTED]" in sanitized)
print("Sanitized contains [PAN_REDACTED]:", "[PAN_REDACTED]" in sanitized)
print("Sanitized contains [CARD_REDACTED]:", "[CARD_REDACTED]" in sanitized)
print("Sanitized contains [JWT_REDACTED]:", "[JWT_REDACTED]" in sanitized)
print("Sanitized contains [API_KEY_REDACTED]:", "[API_KEY_REDACTED]" in sanitized)
assert "[AADHAAR_REDACTED]" in sanitized
assert "[PAN_REDACTED]" in sanitized
assert "[CARD_REDACTED]" in sanitized
assert "[JWT_REDACTED]" in sanitized
assert "[API_KEY_REDACTED]" in sanitized
assert "9876-5432-1098" not in sanitized
assert "ABCDE1234F" not in sanitized
assert "4111-2222-3333-4444" not in sanitized
print("✓ PII Redaction Test Passed cleanly!")

# 2. Multilingual Queries Test
queries = [
    ("ENGLISH", "Which partner has the most failed transactions?"),
    ("HINDI", "Sabse zyada failed transactions kis partner ke hain?"),
    ("HINGLISH", "Aaj mujhe kaunse partner ko priority deni chahiye?"),
    ("MIXED", "Paras General Store ka failed transaction trend kaisa hai?")
]

print("\n[TEST 2] Multilingual Reasoning Queries:")
for lang, q in queries:
    res = client.post("/api/ai/ask-eko", json={"question": q}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    ans = data["answer"].encode("ascii", "replace").decode("ascii")
    print(f"[{lang}] Question: '{q}'")
    print(f"        Answer: {ans[:100]}...")
    print(f"        Grounded: {data['grounded']} | Mode: {data['ai_mode']}")
    assert data["grounded"] is True

print("\n✓ ALL MULTILINGUAL & DATA PRIVACY TESTS PASSED!")
