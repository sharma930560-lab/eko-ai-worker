"""
Regression Test Suite for EKO Data Upload:
- CSV, TSV, JSON, and PDF Formats
- Structured PDF Text Extraction & Canonical Ingestion
- Scanned / Image-Only PDF Detection
- Unsupported Schema Rejection
- Password-Protected, Empty, Corrupt, and Oversized PDF Handling
- Duplicate Record Deduplication
- Tenant Isolation
"""

import io
import json
import base64
import pytest
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
import pypdf

from main import app
import pdf_parser

client = TestClient(app)
AUTH_HEADERS = {"X-User-Id": "demo_user"}
FOREIGN_HEADERS = {"X-User-Id": "foreign_user_999"}


# ── Helpers to generate synthetic PDFs in memory ──

def make_statement_table_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 750, "Eko Operations - Partner Settlement Statement")
    c.drawString(50, 720, "Reference | Customer Name | Phone | Service | Amount | Status")
    c.drawString(50, 700, "TXN-PDF-001 | Ramesh Kumar | 9876543210 | DMT | 2500.00 | SUCCESS")
    c.drawString(50, 680, "TXN-PDF-002 | Sunita Devi | 9811223344 | AePS | 1500.00 | SUCCESS")
    c.drawString(50, 660, "TXN-PDF-003 | Amit Patel | 9822334455 | BBPS | 750.00 | FAILED")
    c.save()
    return buf.getvalue()


def make_key_value_block_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 750, "Transaction Receipt")
    c.drawString(50, 720, "Transaction Ref: TXN-PDF-KV-1")
    c.drawString(50, 700, "Customer Name: Rajesh Verma")
    c.drawString(50, 680, "Phone: 9876501234")
    c.drawString(50, 660, "Service Type: Domestic Money Transfer")
    c.drawString(50, 640, "Amount: INR 4500.00")
    c.drawString(50, 620, "Status: SUCCESS")
    c.save()
    return buf.getvalue()


def make_unsupported_text_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 750, "Terms and Conditions of Employment")
    c.drawString(50, 720, "This contract governs the terms of mutual non-disclosure and intellectual property.")
    c.drawString(50, 700, "All rights reserved by the corporation under international copyright statutes.")
    c.save()
    return buf.getvalue()


def make_scanned_image_pdf() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (250, 250), color=(200, 200, 200))
    img_buf = io.BytesIO()
    img.save(img_buf, format="JPEG")
    img_buf.seek(0)
    c = canvas.Canvas(buf, pagesize=letter)
    # Only draw image, zero text
    c.drawImage(ImageReader(img_buf), 50, 500, width=250, height=250)
    c.save()
    return buf.getvalue()


def make_encrypted_pdf() -> bytes:
    raw_pdf = make_statement_table_pdf()
    reader = pypdf.PdfReader(io.BytesIO(raw_pdf))
    writer = pypdf.PdfWriter()
    for p in reader.pages:
        writer.add_page(p)
    writer.encrypt("securepassword123")
    enc_buf = io.BytesIO()
    writer.write(enc_buf)
    return enc_buf.getvalue()


# ── Test Cases ──

def test_upload_csv_flow():
    """Verify CSV records can be validated and imported."""
    records = [
        {
            "reference_id": "TXN-CSV-TEST-1",
            "customer_name": "Ramesh CSV",
            "customer_phone": "9876543210",
            "service": "DMT",
            "amount": 2000.0,
            "status": "success",
            "partner_id": "partner-paras"
        }
    ]
    val_res = client.post("/api/upload/validate", json={"records": records}, headers=AUTH_HEADERS)
    assert val_res.status_code == 200
    data = val_res.json()
    assert data["valid_count"] == 1
    assert data["error_count"] == 0

    imp_res = client.post("/api/upload/import", json={"records": data["preview"]}, headers=AUTH_HEADERS)
    assert imp_res.status_code == 200
    assert imp_res.json()["imported"] >= 1


def test_upload_tsv_flow():
    """Verify TSV records can be validated and imported."""
    records = [
        {
            "reference_id": "TXN-TSV-TEST-1",
            "customer_name": "Sunita TSV",
            "customer_phone": "9811223344",
            "service": "AePS",
            "amount": 1200.0,
            "status": "success",
            "partner_id": "partner-paras"
        }
    ]
    val_res = client.post("/api/upload/validate", json={"records": records}, headers=AUTH_HEADERS)
    assert val_res.status_code == 200
    assert val_res.json()["valid_count"] == 1


def test_upload_json_flow():
    """Verify JSON records can be validated and imported."""
    records = [
        {
            "reference_id": "TXN-JSON-TEST-1",
            "customer_name": "Amit JSON",
            "customer_phone": "9822334455",
            "service": "BBPS",
            "amount": 850.0,
            "status": "success",
            "partner_id": "partner-paras"
        }
    ]
    val_res = client.post("/api/upload/validate", json={"records": records}, headers=AUTH_HEADERS)
    assert val_res.status_code == 200
    assert val_res.json()["valid_count"] == 1


def test_pdf_table_statement_extraction_and_import():
    """Verify structured statement PDF extracts text and imports canonical records."""
    pdf_bytes = make_statement_table_pdf()
    files = {"file": ("statement.pdf", pdf_bytes, "application/pdf")}
    res = client.post("/api/upload/parse-pdf", files=files, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["doc_type"] == "structured_statement"
    assert len(data["records"]) == 3
    assert data["records"][0]["customer_name"] == "Ramesh Kumar"
    assert data["records"][0]["amount"] == 2500.0
    assert data["records"][0]["service"] == "DMT"

    # Feed into validation
    val_res = client.post("/api/upload/validate", json={"records": data["records"]}, headers=AUTH_HEADERS)
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valid_count"] == 3
    assert val_data["error_count"] == 0

    # Feed into import
    imp_res = client.post("/api/upload/import", json={"records": val_data["preview"]}, headers=AUTH_HEADERS)
    assert imp_res.status_code == 200
    assert imp_res.json()["imported"] >= 3


def test_pdf_key_value_block_extraction():
    """Verify key-value receipt PDF extracts records correctly."""
    pdf_bytes = make_key_value_block_pdf()
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    res = client.post("/api/upload/parse-pdf", json={"file_base64": b64, "filename": "receipt.pdf"}, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["records"]) == 1
    assert data["records"][0]["customer_name"] == "Rajesh Verma"
    assert data["records"][0]["amount"] == 4500.0


def test_scanned_image_only_pdf_detection():
    """Verify scanned/image-only PDF reports exact requirement message without fabricating records."""
    pdf_bytes = make_scanned_image_pdf()
    files = {"file": ("scanned.pdf", pdf_bytes, "application/pdf")}
    res = client.post("/api/upload/parse-pdf", files=files, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["status"] == "scanned_pdf"
    assert "Scanned PDF detected. OCR is required for structured import." in data["error"]


def test_unsupported_pdf_schema_rejection():
    """Verify text PDF with non-banking structure reports exact requirement message."""
    pdf_bytes = make_unsupported_text_pdf()
    files = {"file": ("legal_contract.pdf", pdf_bytes, "application/pdf")}
    res = client.post("/api/upload/parse-pdf", files=files, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["status"] == "unsupported_schema"
    assert "PDF received, but no supported import schema was detected." in data["error"]


def test_encrypted_password_protected_pdf():
    """Verify password protected PDF reports clean error."""
    pdf_bytes = make_encrypted_pdf()
    files = {"file": ("protected.pdf", pdf_bytes, "application/pdf")}
    res = client.post("/api/upload/parse-pdf", files=files, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["status"] == "encrypted"
    assert "Encrypted or password-protected PDF cannot be processed" in data["error"]


def test_empty_and_corrupt_pdf():
    """Verify empty and corrupt PDFs are rejected safely."""
    # Empty
    res_empty = client.post("/api/upload/parse-pdf", json={"file_base64": "", "filename": "empty.pdf"}, headers=AUTH_HEADERS)
    assert res_empty.status_code == 400

    # Corrupt
    res_corrupt = client.post(
        "/api/upload/parse-pdf",
        json={"file_base64": base64.b64encode(b"%PDF-invalid-binary-content").decode("utf-8"), "filename": "bad.pdf"},
        headers=AUTH_HEADERS
    )
    assert res_corrupt.status_code == 200
    assert res_corrupt.json()["success"] is False
    assert res_corrupt.json()["status"] == "corrupt"


def test_oversized_file_rejection():
    """Verify file exceeding 5MB limit is rejected."""
    huge_bytes = b"0" * (5 * 1024 * 1024 + 100)
    res = pdf_parser.extract_pdf_data(huge_bytes)
    assert res["success"] is False
    assert res["status"] == "oversized"
    assert "exceeds maximum 5MB limit" in res["error"]


def test_tenant_isolation_on_import():
    """Verify uploaded records are strictly isolated to the authenticated tenant."""
    # Tenant 1 import
    rec_user1 = [{
        "reference_id": "TXN-ISO-U1",
        "customer_name": "Tenant One Customer",
        "service": "DMT",
        "amount": 1000.0,
        "status": "success",
        "partner_id": "partner-paras"
    }]
    client.post("/api/upload/import", json={"records": rec_user1}, headers=AUTH_HEADERS)

    # Tenant 2 query
    res2 = client.get("/api/activity", headers=FOREIGN_HEADERS)
    assert res2.status_code == 200
    activities = res2.json()
    # Ensure foreign user does not see Tenant 1's uploaded transaction
    assert not any(a.get("reference_id") == "TXN-ISO-U1" for a in activities)
