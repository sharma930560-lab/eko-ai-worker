"""
Eko AI Operations — PDF Document Processing Engine
Extracts text from uploaded PDF statements and parses recognized structured operations records
strictly adhering to the canonical Customer & ServiceActivity schemas.
"""

import io
import re
import logging
from typing import Dict, Any, List, Optional
import pypdf

logger = logging.getLogger("eko.pdf")

VALID_SERVICES = {
    "dmt": "DMT",
    "direct money transfer": "DMT",
    "domestic money transfer": "DMT",
    "money transfer": "DMT",
    "aeps": "AePS",
    "aadhaar enabled payment": "AePS",
    "cash withdrawal": "AePS",
    "bbps": "BBPS",
    "bharat bill payment": "BBPS",
    "bill payment": "BBPS",
    "recharge": "Recharge",
    "mobile recharge": "Recharge",
    "micro atm": "Micro ATM",
    "matm": "Micro ATM",
    "insurance": "Insurance",
    "pan": "PAN",
    "indo-nepal remittance": "Indo-Nepal Remittance"
}

VALID_STATUSES = {"success", "failed", "pending", "refunded"}


def normalize_service(svc_raw: str) -> str:
    s = svc_raw.strip().lower()
    for k, v in VALID_SERVICES.items():
        if k in s or s in k:
            return v
    return "DMT"


def normalize_amount(amt_str: str) -> Optional[float]:
    clean = re.sub(r"[^\d.]", "", amt_str)
    try:
        val = float(clean)
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def parse_pdf_text_to_records(text: str) -> List[Dict[str, Any]]:
    """
    Parse extracted PDF text for structured banking statements or customer transaction records.
    Returns list of dicts matching the canonical schema.
    """
    records = []
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return []

    # ── Strategy 1: Delimited or Pipe/Comma/Tab Separated Rows ──
    # Check if lines have pipe, comma, or multi-space delimiters with recognized headers
    header_idx = -1
    col_map = {}
    for i, line in enumerate(lines[:15]):
        lower = line.lower()
        if any(h in lower for h in ["reference", "ref id", "txn id", "transaction id"]) and \
           any(h in lower for h in ["customer", "client", "name", "beneficiary"]) and \
           any(h in lower for h in ["amount", "volume", "value", "amt"]):
            header_idx = i
            # Determine delimiter
            delimiter = "|" if "|" in line else ("," if "," in line else ("\t" if "\t" in line else None))
            if delimiter:
                headers = [h.strip().lower() for h in line.split(delimiter)]
            else:
                headers = [h.strip().lower() for h in re.split(r"\s{2,}", line)]
            for col_i, h in enumerate(headers):
                if any(x in h for x in ["ref", "txn"]):
                    col_map["ref"] = col_i
                elif any(x in h for x in ["customer", "name", "client"]):
                    col_map["name"] = col_i
                elif any(x in h for x in ["phone", "mobile", "contact"]):
                    col_map["phone"] = col_i
                elif any(x in h for x in ["service", "type"]):
                    col_map["service"] = col_i
                elif any(x in h for x in ["amount", "amt", "volume"]):
                    col_map["amount"] = col_i
                elif any(x in h for x in ["status", "state"]):
                    col_map["status"] = col_i
                elif any(x in h for x in ["partner", "outlet", "agent"]):
                    col_map["partner"] = col_i
            break

    if header_idx != -1 and "name" in col_map and "amount" in col_map:
        delimiter = "|" if "|" in lines[header_idx] else ("," if "," in lines[header_idx] else ("\t" if "\t" in lines[header_idx] else None))
        for idx, line in enumerate(lines[header_idx + 1:], 1):
            if not line or line.startswith("---") or line.startswith("==="):
                continue
            if delimiter:
                parts = [p.strip() for p in line.split(delimiter)]
            else:
                parts = [p.strip() for p in re.split(r"\s{2,}", line)]
            if len(parts) <= max(col_map.values(), default=0):
                continue

            c_name = parts[col_map["name"]] if "name" in col_map else ""
            amt_val = normalize_amount(parts[col_map["amount"]]) if "amount" in col_map else None
            if not c_name or amt_val is None:
                continue

            ref_id = parts[col_map["ref"]] if "ref" in col_map and col_map["ref"] < len(parts) else f"TXN-PDF-{idx}"
            c_phone = parts[col_map["phone"]] if "phone" in col_map and col_map["phone"] < len(parts) else "9876500001"
            svc_raw = parts[col_map["service"]] if "service" in col_map and col_map["service"] < len(parts) else "DMT"
            st_raw = parts[col_map["status"]].lower() if "status" in col_map and col_map["status"] < len(parts) else "success"
            p_name = parts[col_map["partner"]] if "partner" in col_map and col_map["partner"] < len(parts) else "Paras General Store"

            clean_phone = re.sub(r"[^\d]", "", c_phone)
            if len(clean_phone) > 10:
                clean_phone = clean_phone[-10:]
            elif len(clean_phone) < 10:
                clean_phone = "9876500001"

            records.append({
                "customer_name": c_name,
                "customer_phone": clean_phone,
                "service": normalize_service(svc_raw),
                "amount": amt_val,
                "status": st_raw if st_raw in VALID_STATUSES else "success",
                "reference_id": ref_id or f"TXN-PDF-{idx}",
                "partner_name": p_name or "Paras General Store"
            })

    if records:
        return records

    # ── Strategy 2: Key-Value / Record Blocks ──
    # Look for repeated labeled blocks: Customer: ... / Amount: ... / Service: ...
    # Match blocks separated by blank lines or headers
    block_pattern = re.compile(
        r"(?:(?:Transaction|Ref(?:erence)?)\s*(?:ID|#)?\s*[:\-]\s*(?P<ref>[^\r\n]+))?.*?"
        r"(?:Customer(?:\s*Name)?\s*[:\-]\s*(?P<name>[^\r\n]+)).*?"
        r"(?:(?:Phone|Mobile|Contact)\s*[:\-]\s*(?P<phone>[^\r\n]+))?.*?"
        r"(?:Service(?:\s*Type)?\s*[:\-]\s*(?P<service>[^\r\n]+)).*?"
        r"(?:Amount\s*[:\-]\s*(?:INR|Rs\.?|₹)?\s*(?P<amount>[\d,]+(?:\.\d{1,2})?)).*?"
        r"(?:Status\s*[:\-]\s*(?P<status>SUCCESS|FAILED|PENDING|REFUNDED|Success|Failed|Pending|Refunded))?",
        re.IGNORECASE | re.DOTALL
    )

    # Split text by double newlines or record boundaries
    chunks = re.split(r"\n\s*\n|(?=Transaction\s*(?:ID|Ref|#)\s*[:\-])|(?=Record\s*#?\d+\s*[:\-])", text, flags=re.IGNORECASE)
    for idx, chunk in enumerate(chunks, 1):
        m = block_pattern.search(chunk)
        if m:
            c_name = (m.group("name") or "").strip()
            amt_raw = m.group("amount")
            amt_val = normalize_amount(amt_raw) if amt_raw else None
            if not c_name or amt_val is None:
                continue

            ref_id = (m.group("ref") or f"TXN-PDF-{idx}").strip()
            phone_raw = m.group("phone") or "9876500001"
            clean_phone = re.sub(r"[^\d]", "", phone_raw)
            if len(clean_phone) > 10:
                clean_phone = clean_phone[-10:]
            elif len(clean_phone) < 10:
                clean_phone = "9876500001"

            svc = normalize_service(m.group("service") or "DMT")
            st = (m.group("status") or "success").strip().lower()

            records.append({
                "customer_name": c_name,
                "customer_phone": clean_phone,
                "service": svc,
                "amount": amt_val,
                "status": st if st in VALID_STATUSES else "success",
                "reference_id": ref_id,
                "partner_name": "Paras General Store"
            })

    if records:
        return records

    # ── Strategy 3: Regex Line-By-Line Parser for Common Banking Statements ──
    # Regex matching: <REF> <NAME> <PHONE> <SERVICE> <AMOUNT> <STATUS>
    row_regex = re.compile(
        r"^(?P<ref>TXN-[A-Za-z0-9\-]+|REF-[A-Za-z0-9\-]+|[A-Z]{3}\d{6,})\s+"
        r"(?P<name>[A-Za-z\s]{3,25})\s+"
        r"(?P<phone>[6-9]\d{9})\s+"
        r"(?P<service>DMT|AEPS|BBPS|RECHARGE|MICRO\s*ATM|INSURANCE|PAN)\s+"
        r"(?:₹|Rs\.?|INR)?\s*(?P<amount>[\d,]+(?:\.\d{1,2})?)\s+"
        r"(?P<status>SUCCESS|FAILED|PENDING|REFUNDED)",
        re.IGNORECASE
    )
    for idx, line in enumerate(lines, 1):
        m = row_regex.search(line)
        if m:
            amt_val = normalize_amount(m.group("amount"))
            if amt_val is not None:
                records.append({
                    "customer_name": m.group("name").strip(),
                    "customer_phone": m.group("phone").strip(),
                    "service": normalize_service(m.group("service")),
                    "amount": amt_val,
                    "status": m.group("status").strip().lower(),
                    "reference_id": m.group("ref").strip(),
                    "partner_name": "Paras General Store"
                })

    return records


def extract_pdf_data(pdf_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
    """
    Extract text and structured records from an uploaded PDF.
    Enforces strict security, format checks, and error classifications.
    """
    if not pdf_bytes or len(pdf_bytes) == 0:
        return {
            "success": False,
            "status": "empty",
            "error": "Empty PDF file.",
            "doc_type": "empty"
        }

    if len(pdf_bytes) > 5 * 1024 * 1024:
        return {
            "success": False,
            "status": "oversized",
            "error": "File size exceeds maximum 5MB limit.",
            "doc_type": "oversized"
        }

    try:
        stream = io.BytesIO(pdf_bytes)
        try:
            reader = pypdf.PdfReader(stream)
        except Exception as err:
            return {
                "success": False,
                "status": "corrupt",
                "error": f"Invalid or corrupted PDF file: {str(err)}",
                "doc_type": "corrupt"
            }

        # Check for encrypted / password protected PDF
        if reader.is_encrypted:
            return {
                "success": False,
                "status": "encrypted",
                "error": "Encrypted or password-protected PDF cannot be processed.",
                "doc_type": "encrypted"
            }

        if len(reader.pages) == 0:
            return {
                "success": False,
                "status": "empty",
                "error": "PDF document contains no pages.",
                "doc_type": "empty"
            }

        full_text_list = []
        has_images = False

        for page in reader.pages:
            t = page.extract_text() or ""
            full_text_list.append(t)

            # Check for scanned image elements
            if hasattr(page, "images") and len(page.images) > 0:
                has_images = True
            elif "/Resources" in page and "/XObject" in page["/Resources"]:
                try:
                    xObject = page["/Resources"]["/XObject"]
                    if hasattr(xObject, "get_object"):
                        xObject = xObject.get_object()
                    for obj in xObject:
                        subtype = xObject[obj].get("/Subtype", "")
                        if subtype == "/Image":
                            has_images = True
                            break
                except Exception:
                    pass

        combined_text = "\n".join(full_text_list).strip()

        # ── Case B: Scanned / Image-Only PDF ──
        # Negligible text (< 15 characters), but valid PDF with images or substantial payload
        if len(combined_text) < 15:
            if has_images or len(pdf_bytes) > 1500:
                return {
                    "success": False,
                    "status": "scanned_pdf",
                    "doc_type": "scanned",
                    "error": "Scanned PDF detected. OCR is required for structured import."
                }
            else:
                return {
                    "success": False,
                    "status": "empty_text",
                    "doc_type": "empty_text",
                    "error": "PDF document contains no readable text or content."
                }

        # ── Case A: Text-based PDF ──
        records = parse_pdf_text_to_records(combined_text)

        # ── Case C: Unsupported PDF Structure ──
        if not records:
            preview = combined_text[:300].replace("\n", " ").strip()
            return {
                "success": False,
                "status": "unsupported_schema",
                "doc_type": "unsupported",
                "error": "PDF received, but no supported import schema was detected.",
                "extracted_preview": preview
            }

        # Case A: Success with recognized records
        return {
            "success": True,
            "status": "success",
            "doc_type": "structured_statement",
            "records": records,
            "page_count": len(reader.pages),
            "record_count": len(records),
            "extracted_preview": combined_text[:200].replace("\n", " ").strip()
        }

    except Exception as e:
        logger.error(f"Unexpected error in extract_pdf_data: {e}", exc_info=True)
        return {
            "success": False,
            "status": "error",
            "error": f"Failed to process PDF: {str(e)}",
            "doc_type": "error"
        }
