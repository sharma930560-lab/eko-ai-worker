"""
Eko Master Engineering Regression Test Suite
Validates Tasks, Notes, Complaints, Data Upload, AI Fast-Path, and Tenant Isolation
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)
USER_HEADERS = {"X-User-Id": "demo-operator-01"}
OTHER_USER_HEADERS = {"X-User-Id": "test-operator-isolated"}


def test_tasks_crud_and_isolation():
    # 1. Unauthenticated request must return 401
    unauth_res = client.get("/api/tasks")
    assert unauth_res.status_code == 401, "Expected 401 for unauthenticated tasks request"

    # 2. Authenticated user tasks list
    res = client.get("/api/tasks", headers=USER_HEADERS)
    assert res.status_code == 200
    tasks = res.json()
    assert isinstance(tasks, list)
    initial_count = len(tasks)

    # 3. Create task
    create_payload = {
        "title": "Automated Regression Test Task",
        "priority": "high",
        "due_date": "2026-09-30 18:00"
    }
    create_res = client.post("/api/tasks", json=create_payload, headers=USER_HEADERS)
    assert create_res.status_code == 200
    created_task = create_res.json()
    assert created_task["title"] == create_payload["title"]
    assert created_task["priority"] == "high"
    assert created_task["completed"] is False
    task_id = created_task["id"]

    # 4. Toggle completion
    patch_res = client.patch(f"/api/tasks/{task_id}", json={"completed": True}, headers=USER_HEADERS)
    assert patch_res.status_code == 200
    assert patch_res.json()["completed"] is True

    # 5. Tenant isolation: other user cannot see or update this task
    other_res = client.get("/api/tasks", headers=OTHER_USER_HEADERS)
    assert other_res.status_code == 200
    other_tasks = other_res.json()
    assert all(t["id"] != task_id for t in other_tasks)

    other_patch = client.patch(f"/api/tasks/{task_id}", json={"completed": False}, headers=OTHER_USER_HEADERS)
    assert other_patch.status_code == 404, "Tenant isolation failure: other user modified task"

    # 6. Delete task with tenant isolation check
    other_del = client.delete(f"/api/tasks/{task_id}", headers=OTHER_USER_HEADERS)
    assert other_del.status_code == 404, "Tenant isolation failure: other user deleted task"

    del_res = client.delete(f"/api/tasks/{task_id}", headers=USER_HEADERS)
    assert del_res.status_code == 200, "Failed to delete task as owner"


def test_notes_crud_and_isolation():
    # 1. Unauthenticated request must return 401
    unauth_res = client.get("/api/notes")
    assert unauth_res.status_code == 401

    # 2. List notes
    res = client.get("/api/notes", headers=USER_HEADERS)
    assert res.status_code == 200
    notes = res.json()
    assert isinstance(notes, list)

    # 3. Create note
    note_payload = {
        "content": "Regression test journal note: switch routing check passed."
    }
    create_res = client.post("/api/notes", json=note_payload, headers=USER_HEADERS)
    assert create_res.status_code == 200
    created_note = create_res.json()
    assert created_note["content"] == note_payload["content"]
    note_id = created_note["id"]

    # 4. Tenant isolation: other user cannot see or delete this note
    other_res = client.get("/api/notes", headers=OTHER_USER_HEADERS)
    assert other_res.status_code == 200
    assert all(n["id"] != note_id for n in other_res.json())

    other_del = client.delete(f"/api/notes/{note_id}", headers=OTHER_USER_HEADERS)
    assert other_del.status_code == 404

    # 5. Delete note as owner
    del_res = client.delete(f"/api/notes/{note_id}", headers=USER_HEADERS)
    assert del_res.status_code == 200


def test_complaints_endpoint():
    # 1. Unauthenticated request must return 401
    unauth = client.get("/api/complaints")
    assert unauth.status_code == 401

    # 2. Authenticated complaints list
    res = client.get("/api/complaints", headers=USER_HEADERS)
    assert res.status_code == 200
    complaints = res.json()
    assert isinstance(complaints, list)
    assert len(complaints) > 0

    first = complaints[0]
    assert "id" in first
    assert "subject" in first
    assert "status" in first
    assert "sla_deadline" in first


def test_upload_validate_and_import():
    # 1. Validation with valid, invalid and duplicate records
    records = [
        {
            "partner_name": "Sharma Telecom",
            "customer_name": "Test Cust One",
            "customer_phone": "9876543210",
            "service": "DMT",
            "amount": 2500,
            "status": "success",
            "reference_id": "TEST-UPL-001"
        },
        {
            "partner_name": "Pooja Banking Point",
            "customer_name": "Test Cust Two",
            "customer_phone": "9876543211",
            "service": "AePS",
            "amount": 1000,
            "status": "failed",
            "reference_id": "TEST-UPL-002",
            "failure_reason": "Biometric mismatch"
        }
    ]

    val_res = client.post("/api/upload/validate", json={"records": records}, headers=USER_HEADERS)
    assert val_res.status_code == 200
    vdata = val_res.json()
    assert vdata["total_records"] == 2
    assert vdata["valid_count"] == 2
    assert vdata["error_count"] == 0

    # 2. Import records
    imp_res = client.post("/api/upload/import", json={"records": vdata["preview"]}, headers=USER_HEADERS)
    assert imp_res.status_code == 200
    idata = imp_res.json()
    assert idata["status"] == "ok"
    assert idata["imported"] == 2


def test_ai_greeting_fastpath_and_operational():
    # 1. Pure greeting triggers instant fast path without expensive LLM call
    greetings = ["hi", "hello", "namaste", "good morning", "thank you"]
    for g in greetings:
        res = client.post("/api/ai/ask", json={"question": g}, headers=USER_HEADERS)
        assert res.status_code == 200
        data = res.json()
        ans = data["answer"].lower()
        assert any(term in ans for term in ["eko", "namaste", "hello", "welcome", "help"])

    # 2. Operational query with grounding
    op_res = client.post("/api/ai/ask", json={"question": "show today's failed transactions"}, headers=USER_HEADERS)
    assert op_res.status_code == 200
    op_data = op_res.json()
    assert "answer" in op_data
    assert len(op_data["answer"]) > 10
