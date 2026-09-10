"""
Eko Partner Operations — Canonical Synthetic Demo Data Generator
Creates fully connected, deterministic, multi-service operational records at realistic scale:
- 22 Partners (9 Retailers, 5 Merchants, 3 Enterprise, 5 Others)
- 65 Customers (linked to partners)
- 140 Transactions (68% Success, 18% Failed with domain reasons, 14% Pending)
- 140 Commissions (deterministic rate engine)
- 4 Settlements (reconciled with commission batches)
- 18 Complaints (SLA tracked, categorized)
- 24 WhatsApp Outreach records (Pending, Sent, Delivered, Read, Failed)
- 18 Operational Tasks
- Credit Assessments
"""
import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session
import models

def calculate_commission(service: str, amount: float, status: str) -> Tuple[float, float, str]:
    """
    Deterministic commission engine.
    Returns: (rate, amount, status)
    """
    svc = (service or "").upper()
    amt = float(amount or 0.0)
    st = (status or "").lower()

    if "DMT" in svc or "SEND MONEY" in svc or "REMITTANCE" in svc:
        rate = 0.0045
        calc = round(amt * rate, 2)
    elif "AEPS" in svc or "CASH" in svc:
        rate = 0.0035
        calc = min(25.0, max(3.0, round(amt * rate, 2)))
    elif "MICRO ATM" in svc or "ATM" in svc:
        rate = 0.0035
        calc = min(25.0, max(3.0, round(amt * rate, 2)))
    elif "BBPS" in svc or "BILL" in svc:
        rate = 0.001
        calc = 5.0
    elif "RECHARGE" in svc or "DTH" in svc:
        rate = 0.015
        calc = round(amt * rate, 2)
    elif "INSURANCE" in svc:
        rate = 0.020
        calc = round(amt * rate, 2)
    elif "NEPAL" in svc:
        rate = 0.0050
        calc = round(amt * rate, 2)
    else:
        rate = 0.0030
        calc = round(amt * rate, 2)

    if st == "failed":
        return rate, 0.0, "REVERSED"
    elif st == "pending":
        return rate, calc, "PENDING"
    else:
        return rate, calc, "EARNED"


def seed_canonical_environment(user_id: str, db: Session):
    """Seed comprehensive connected demo operations dataset."""
    now = datetime.now()
    seed_suffix = "" if user_id == "demo-operator-01" else f"-{hashlib.sha1(user_id.encode()).hexdigest()[:8]}"

    def seed_ref(ref: str) -> str:
        return f"{ref}{seed_suffix}"

    def seed_id(label: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"eko-demo:{user_id}:{label}"))

    # ─────────────────────────────────────────────────────────────────────────
    # 1. 22 Connected Partners
    # ─────────────────────────────────────────────────────────────────────────
    partner_configs = [
        # Retailers (9)
        ("partner-paras", "Paras General Store & Banking Point", "9811223344", "paras.store@ekopartner.in", "Retail & CSP", "Retailer", "verified", 11200.0, "Top volume banking outlet. Handles DMT and AePS cash withdrawals daily.", 45),
        ("partner-sharma", "Sharma Telecom & Digital Seva", "9876543210", "sharma.telecom@ekopartner.in", "Telecom & Remittance", "Retailer", "verified", 14500.0, "High-volume DMT center near metro station. Fast settlement preferred.", 60),
        ("partner-gupta", "Gupta Daily Mart & CSP", "9898989898", "gupta.digital@ekopartner.in", "CSC & Utility", "Retailer", "verified", 5400.0, "Government services center & AePS mini-ATM point.", 20),
        ("partner-verma", "Verma Communication", "9823456789", "verma.hub@ekopartner.in", "Digital Services", "Retailer", "verified", 8200.0, "Primary BBPS bill collection and mobile recharge counter.", 30),
        ("partner-rahul", "Rahul Kumar", "9988776655", "rahul.k@ekopartner.in", "Retailer & CSP", "Retailer", "pending", 3200.0, "Active retail partner outlet pending final biometric KYC verification.", 15),
        ("partner-singh", "Singh Mobile & Digital Services", "9812345678", "singh.digital@ekopartner.in", "Telecom & CSP", "Retailer", "verified", 6500.0, "Multi-utility center managing BBPS bill payments and DTH recharge.", 25),
        ("partner-pooja", "Pooja Banking Point", "9834567890", "pooja.banking@ekopartner.in", "Rural Mini-ATM & AePS", "Retailer", "verified", 7800.0, "Rural touchpoint with steady biometric cash withdrawals.", 40),
        ("partner-aarav", "Aarav Digital Seva Kendra", "9845012345", "aarav.seva@ekopartner.in", "Common Service Centre", "Retailer", "verified", 4900.0, "Citizen services, PAN issuance, and AePS cash withdrawal counter.", 35),
        ("partner-rajesh", "Rajesh Provision Store & CSP", "9856123456", "rajesh.store@ekopartner.in", "Kirana & Banking Point", "Retailer", "verified", 6100.0, "Local neighborhood grocer providing cash-in/cash-out services.", 50),

        # Merchants (5)
        ("partner-city", "City Pay Point", "9856789012", "city.pay@ekopartner.in", "Express Remittance Hub", "Merchant", "verified", 12600.0, "High-velocity remittance counter located in commercial trade corridor.", 35),
        ("partner-kisan", "Kisan Seva Kendra", "9867234567", "kisan.seva@ekopartner.in", "Agri Inputs & CSP", "Merchant", "verified", 8900.0, "Direct cash disbursement point for rural agricultural supply chain.", 40),
        ("partner-jaihind", "Jai Hind Multi Services", "9878345678", "jaihind.ms@ekopartner.in", "Travel & Remittance", "Merchant", "verified", 15400.0, "High-traffic travel terminal processing Indo-Nepal and domestic remittances.", 55),
        ("partner-omsai", "Om Sai Ram Commercial Center", "9889456789", "omsai.comm@ekopartner.in", "Wholesale Merchant Point", "Merchant", "verified", 22000.0, "B2B bulk payments and merchant collections point.", 70),
        ("partner-modern", "Modern Digital Pay", "9890567890", "modern.pay@ekopartner.in", "Urban Merchant CSP", "Merchant", "verified", 9500.0, "Express checkout and bill aggregation counter in retail complex.", 28),

        # Enterprise (3)
        ("partner-anand", "Anand Enterprises", "9765432109", "anand.enterprises@ekopartner.in", "Enterprise Banking Point", "Enterprise", "verified", 32000.0, "Commercial enterprise with high DMT transfers and corporate settlement terms.", 90),
        ("partner-agro", "National Agro Business Hub", "9776543210", "national.agro@ekopartner.in", "Institutional Agri CSP", "Enterprise", "verified", 45000.0, "State-wide agricultural cooperative disbursements and corporate bulk payouts.", 120),
        ("partner-capital", "Capital Express Remittance Ltd", "9787654321", "capital.express@ekopartner.in", "Corporate Remittance Partner", "Enterprise", "verified", 58000.0, "Multi-location corporate franchise managing express domestic money transfer.", 100),

        # Others (5: Distributor, Agent, Aggregator, Service Partner, Institutional)
        ("partner-apex-dist", "Apex District Distributor", "9798765432", "apex.dist@ekopartner.in", "Master Distributor & CSP", "Others", "verified", 38000.0, "District super-stockist supplying terminal hardware and liquidity float.", 110),
        ("partner-north-agent", "North Zone Super Agent", "9709876543", "north.agent@ekopartner.in", "Independent Field Agent", "Others", "verified", 14200.0, "Mobile field agent managing on-demand agent onboarding and cash routing.", 65),
        ("partner-vikas-agg", "Vikas Gramin Aggregator", "9710987654", "vikas.agg@ekopartner.in", "Regional Sub-Kiosk Aggregator", "Others", "verified", 29500.0, "Coordinates 14 rural village banking kiosks with weekly reconciliation.", 80),
        ("partner-pratham-srv", "Pratham Service Partner Hub", "9721098765", "pratham.hub@ekopartner.in", "Authorized Service Partner", "Others", "verified", 18700.0, "Provides tech maintenance, biometric scanner provisioning, and training.", 75),
        ("partner-coop-inst", "State Cooperative Federation", "9732109876", "state.coop@ekopartner.in", "Institutional Partner Point", "Others", "verified", 64000.0, "Federated rural cooperative body managing pension & welfare distributions.", 150),
    ]

    partners = []
    partner_map = {}
    for pid_label, pname, pphone, pemail, pbiz, pcat, pkyc, pamtdue, pnotes, pdays in partner_configs:
        p_obj = models.Customer(
            id=seed_id(pid_label),
            user_id=user_id,
            name=pname,
            phone=pphone,
            email=pemail,
            business_type=pbiz,
            is_partner=True,
            partner_id=None,
            category=pcat,
            kyc_status=pkyc,
            amount_due=pamtdue,
            notes=pnotes,
            created_at=now - timedelta(days=pdays)
        )
        partners.append(p_obj)
        partner_map[pid_label] = p_obj
        db.add(p_obj)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 2. 65 Synthetic Retail Customers (Linked to Partners)
    # ─────────────────────────────────────────────────────────────────────────
    customer_raw_seeds = [
        ("Paras Demo", "9305601503", "Express Banking & DMT Customer", "verified", "partner-paras"),
        ("Rahul Kumar", "9305601503", "Retail & Remittance Customer", "pending", "partner-rahul"),
        ("Ramesh Chandra", "9876500001", "Verified Consumer", "verified", "partner-paras"),
        ("Sunita Devi", "9876500002", "DMT Regular Customer", "pending", "partner-paras"),
        ("Anil Joshi", "9876500003", "AePS Micro-ATM Customer", "verified", "partner-sharma"),
        ("Priya Sharma", "9876500004", "Utility Bill Payer", "verified", "partner-sharma"),
        ("Vikram Patel", "9876500005", "Merchant Payout Recipient", "verified", "partner-anand"),
        ("Mohammad Imran", "9876500006", "Remittance Beneficiary", "verified", "partner-anand"),
        ("Kavita Singh", "9876500007", "Rural Banking Customer", "pending", "partner-pooja"),
        ("Rajesh Verma", "9876500008", "Broadband Bill Customer", "verified", "partner-verma"),
        ("Deepak Gupta", "9876500009", "Mobile Recharge Customer", "verified", "partner-gupta"),
        ("Meena Kumari", "9876500010", "Old Age Pension AePS", "verified", "partner-pooja"),
        ("Sanjay Yadav", "9876500011", "Kirana Shop Customer", "verified", "partner-paras"),
        ("Pooja Mishra", "9876500012", "Electricity Bill Customer", "verified", "partner-verma"),
        ("Manoj Tiwari", "9876500013", "Water Utility Customer", "verified", "partner-verma"),
        ("Rekha Rani", "9876500014", "DMT Sender", "verified", "partner-city"),
        ("Ajay Kumar", "9876500015", "Student Fee Payee", "verified", "partner-city"),
        ("Harish Rawat", "9876500016", "Express Remittance", "verified", "partner-city"),
        ("Geeta Choudhary", "9876500017", "AePS Cash Withdrawal", "verified", "partner-pooja"),
        ("Santosh Jha", "9876500018", "DMT Transfer Customer", "verified", "partner-sharma"),
        ("Kishore Lal", "9876500019", "Gas Cylinder Bill Payer", "verified", "partner-verma"),
        ("Nisha Bano", "9876500020", "Recharge & DMT Customer", "verified", "partner-gupta"),
        ("Tarun Bajaj", "9876500021", "Commercial Trader", "verified", "partner-anand"),
        ("Anita Soren", "9876500022", "Self-Help Group Lead", "verified", "partner-pooja"),
        ("Dharmendra Pal", "9876500023", "Transport Driver Remittance", "verified", "partner-paras"),
        ("Sita Ram", "9876500024", "Agriculture Subsidy AePS", "verified", "partner-kisan"),
        ("Vikas Mehra", None, "Insurance Premium Payer", "verified", "partner-verma"),
        # Additional 38 customers to hit 65 scale
        ("Amit Singhania", "9876500025", "Hardware Merchant Remittance", "verified", "partner-paras"),
        ("Babita Sharma", "9876500026", "School Fee BBPS Payer", "verified", "partner-sharma"),
        ("Chetan Bhagat", "9876500027", "Express Money Transfer", "verified", "partner-city"),
        ("Divya Joshi", "9876500028", "DTH Recharge & Bill Pay", "verified", "partner-verma"),
        ("Eknath Shinde", "9876500029", "Cooperative Milk Producer AePS", "verified", "partner-coop-inst"),
        ("Farhan Akhtar", "9876500030", "Indo-Nepal Transfer Customer", "verified", "partner-jaihind"),
        ("Gautam Gambhir", "9876500031", "Fast Remittance Sender", "verified", "partner-anand"),
        ("Hema Malini", "9876500032", "Widow Pension Beneficiary", "verified", "partner-pooja"),
        ("Ishaan Khatter", "9876500033", "Mobile Postpaid Bill", "verified", "partner-singh"),
        ("Jagdish Chandra", "9876500034", "Solar Pump Loan Repayment", "verified", "partner-kisan"),
        ("Kamal Hassan", "9876500035", "Commercial Freight Payout", "verified", "partner-agro"),
        ("Lata Mangeshkar", "9876500036", "Senior Citizen Pension", "verified", "partner-pooja"),
        ("Mukesh Ambani", "9876500037", "Retail CSP Regular", "verified", "partner-paras"),
        ("Neha Kakkar", "9876500038", "Broadband Fiber Bill", "verified", "partner-verma"),
        ("Om Puri", "9876500039", "Rural Bank Kiosk Deposit", "verified", "partner-vikas-agg"),
        ("Pankaj Tripathi", "9876500040", "Fertilizer Subsidy Cashout", "verified", "partner-kisan"),
        ("Qasim Ali", "9876500041", "Export Labor Remittance", "verified", "partner-jaihind"),
        ("Rohit Shetty", "9876500042", "Commercial Transport Driver", "verified", "partner-capital"),
        ("Salman Khan", "9876500043", "DMT Express User", "verified", "partner-city"),
        ("Tushar Kapoor", "9876500044", "Fastag Wallet Topup", "verified", "partner-modern"),
        ("Urmila Matondkar", "9876500045", "Municipal Water Tax", "verified", "partner-aarav"),
        ("Varun Dhawan", "9876500046", "College Tuition Payout", "verified", "partner-aarav"),
        ("Wasim Akram", "9876500047", "Indo-Nepal Remittance", "verified", "partner-jaihind"),
        ("Yash Chopra", "9876500048", "Telecom Kiosk Franchisee", "verified", "partner-apex-dist"),
        ("Zaheer Khan", "9876500049", "Wholesale Grain Trader", "verified", "partner-omsai"),
        ("Aparna Sen", "9876500050", "Handicrafts SHG Lead", "verified", "partner-pratham-srv"),
        ("Bappi Lahiri", "9876500051", "Music Academy Utility Bill", "verified", "partner-verma"),
        ("Chitra Singh", "9876500052", "AePS Domestic Payout", "verified", "partner-pooja"),
        ("Dev Anand", "9876500053", "Commercial Seed Payout", "verified", "partner-kisan"),
        ("Govinda Ahuja", "9876500054", "Kirana Supplier Transfer", "verified", "partner-rajesh"),
        ("Hemant Kumar", "9876500055", "Express Cash-In", "verified", "partner-paras"),
        ("Inder Kumar", "9876500056", "Micro-ATM Withdrawal", "verified", "partner-north-agent"),
        ("Jaya Bachchan", "9876500057", "Self Help Group AePS", "verified", "partner-coop-inst"),
        ("Kailash Kher", "9876500058", "Folk Artist Remittance", "verified", "partner-city"),
        ("Lucky Ali", "9876500059", "Organic Farm Payout", "verified", "partner-agro"),
        ("Madhuri Dixit", "9876500060", "Hospital Emergency Remittance", "verified", "partner-anand"),
        ("Naseeruddin Shah", "9876500061", "Theatre Group Payout", "verified", "partner-modern"),
        ("Paresh Rawal", "9876500062", "District Hardware Vendor", "verified", "partner-apex-dist"),
    ]

    customers = []
    for idx, (cname, cphone, cbiz, ckyc, pref_label) in enumerate(customer_raw_seeds, 1):
        target_partner = partner_map.get(pref_label, partner_map["partner-paras"])
        c_obj = models.Customer(
            id=seed_id(f"cust-{idx}"),
            user_id=user_id,
            name=cname,
            phone=cphone,
            email=f"cust{idx}@ekodemo.in",
            business_type=cbiz,
            is_partner=False,
            partner_id=target_partner.id,
            category=None,
            kyc_status=ckyc,
            amount_due=0.0,
            notes=f"Customer registered through {target_partner.name}.",
            created_at=now - timedelta(days=60 - (idx % 45))
        )
        customers.append(c_obj)
        db.add(c_obj)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 3. 140 Multi-Service Realistic Transactions (68% Success, 18% Fail, 14% Pending)
    # ─────────────────────────────────────────────────────────────────────────
    # Primary Anchor Transactions
    t_failed = models.ServiceActivity(
        id=seed_ref("TXN-DEMO-1001"), user_id=user_id,
        partner_id=partner_map["partner-sharma"].id,
        customer_id=customers[4].id, customer_name="Anil Joshi",
        service_name="DMT", status="failed", amount=8500.0, commission=0.0,
        reference_id=seed_ref("DMT984729104"),
        failure_reason="Beneficiary bank IMPS switch timeout during money transfer.",
        created_at=now - timedelta(hours=2)
    )

    t_paras_25k = models.ServiceActivity(
        id=seed_id("txn-paras-dmt-25k"), user_id=user_id,
        partner_id=partner_map["partner-paras"].id,
        customer_id=customers[0].id, customer_name="Paras Demo",
        service_name="Send Money", status="success", amount=25000.0, commission=112.5,
        reference_id=seed_ref("DMTBEF965B72E"),
        failure_reason=None,
        created_at=now - timedelta(minutes=30)
    )

    t_rahul_aeps = models.ServiceActivity(
        id=seed_id("txn-rahul-aeps-01"), user_id=user_id,
        partner_id=partner_map["partner-rahul"].id,
        customer_id=partner_map["partner-rahul"].id, customer_name="Rahul Kumar",
        service_name="AePS-Mini Statement", status="success", amount=0.0, commission=0.0,
        reference_id=seed_ref("AEPS849201020"),
        failure_reason=None,
        created_at=now - timedelta(hours=14)
    )

    t_rahul_dmt = models.ServiceActivity(
        id=seed_id("txn-rahul-dmt-01"), user_id=user_id,
        partner_id=partner_map["partner-rahul"].id,
        customer_id=partner_map["partner-rahul"].id, customer_name="Rahul Kumar",
        service_name="DMT", status="success", amount=1500.0, commission=7.5,
        reference_id=seed_ref("DMT849200990"),
        failure_reason=None,
        created_at=now - timedelta(hours=15)
    )

    transactions = [t_failed, t_paras_25k, t_rahul_aeps, t_rahul_dmt]

    # Pre-calculated patterns to yield exactly 140 transactions:
    # 95 success, 25 failed, 20 pending (1 fail, 3 success already created)
    services_pool = ["DMT", "AePS", "BBPS", "Recharge", "Insurance", "Micro ATM", "Indo-Nepal"]
    failure_reasons_pool = [
        "Beneficiary bank IMPS switch timeout during money transfer.",
        "Biometric capture timeout at UIDAI authentication gateway.",
        "Biller gateway timeout on Bharat BillPay switch.",
        "Beneficiary account blocked or frozen by recipient bank.",
        "Daily debit velocity limit exceeded at issuer bank.",
        "Issuer switch inoperative; transaction aborted safely.",
        "Insufficient terminal cash float at partner desk.",
        "PIN entry exceeded maximum attempt threshold."
    ]
    pending_reasons_pool = [
        "NEFT batch settlement confirmation pending from nodal bank.",
        "Pending NPCI switch clearance acknowledgement.",
        "Biller verification response delayed from electricity board gateway.",
        "Biometric authorization response pending from core banking system."
    ]

    for i in range(1, 137):
        if i <= 24:
            st = "failed"
            fail_reason = failure_reasons_pool[i % len(failure_reasons_pool)]
        elif i <= 44:
            st = "pending"
            fail_reason = pending_reasons_pool[i % len(pending_reasons_pool)]
        else:
            st = "success"
            fail_reason = None

        svc = services_pool[i % len(services_pool)]
        p_obj = partners[i % len(partners)]
        if st == "failed" and p_obj.id == partner_map["partner-rahul"].id:
            p_obj = partner_map["partner-sharma"]
        c_obj = customers[i % len(customers)]

        if svc == "DMT":
            amt = float((((i * 13) % 15) + 1) * 2000)
        elif svc in ("AePS", "Micro ATM"):
            amt = float((((i * 7) % 8) + 1) * 1000)
        elif svc == "BBPS":
            amt = float((((i * 5) % 12) + 2) * 350)
        elif svc == "Recharge":
            amt = float([299.0, 499.0, 719.0, 999.0, 149.0, 666.0][i % 6])
        elif svc == "Insurance":
            amt = float((((i * 3) % 6) + 1) * 1250)
        elif svc == "Indo-Nepal":
            amt = float((((i * 9) % 10) + 1) * 3000)
        else:
            amt = 1500.0

        rate, comm_amt, _ = calculate_commission(svc, amt, st)
        hours_ago = (i * 2.3) + 0.5
        t_obj = models.ServiceActivity(
            id=seed_id(f"txn-{i:03d}"),
            user_id=user_id,
            partner_id=p_obj.id,
            customer_id=c_obj.id,
            customer_name=c_obj.name,
            service_name=svc,
            status=st,
            amount=amt,
            commission=comm_amt,
            reference_id=seed_ref(f"{svc[:3].upper()}{849000000 + i}"),
            failure_reason=fail_reason,
            created_at=now - timedelta(hours=hours_ago)
        )
        transactions.append(t_obj)

    for t in transactions:
        db.add(t)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 4. 140 Commissions & 4 Settlements
    # ─────────────────────────────────────────────────────────────────────────
    s1 = models.Settlement(
        id=seed_id("settlement-01"), user_id=user_id, partner_id=partner_map["partner-paras"].id,
        amount=5240.0, status="PAID", bank_reference="CMS984729104", payout_account="HDFC Nodal *4402",
        settled_at=now - timedelta(days=7), period_start=now - timedelta(days=14), period_end=now - timedelta(days=7),
        created_at=now - timedelta(days=7)
    )
    s2 = models.Settlement(
        id=seed_id("settlement-02"), user_id=user_id, partner_id=partner_map["partner-sharma"].id,
        amount=4850.0, status="PAID", bank_reference="CMS849201948", payout_account="ICICI Nodal *8819",
        settled_at=now - timedelta(days=4), period_start=now - timedelta(days=7), period_end=now - timedelta(days=4),
        created_at=now - timedelta(days=4)
    )
    s3 = models.Settlement(
        id=seed_id("settlement-03"), user_id=user_id, partner_id=partner_map["partner-anand"].id,
        amount=3920.0, status="PAID", bank_reference="CMS849201882", payout_account="Axis Nodal *2291",
        settled_at=now - timedelta(days=1), period_start=now - timedelta(days=4), period_end=now - timedelta(days=1),
        created_at=now - timedelta(days=1)
    )
    db.add_all([s1, s2, s3])
    db.commit()

    commissions = []
    for idx, t in enumerate(transactions):
        rate, comm_amt, comm_status = calculate_commission(t.service_name, t.amount, t.status)
        settle_id = None
        settle_dt = None
        if t.status == "success":
            t_created = t.created_at
            if hasattr(t_created, "tzinfo") and t_created and t_created.tzinfo is not None:
                t_created = t_created.replace(tzinfo=None)
            days_ago = (now - t_created).days if t_created else 0
            if days_ago >= 7:
                comm_status = "PAID"
                settle_id = s1.id
                settle_dt = s1.settled_at
            elif days_ago >= 4:
                comm_status = "PAID"
                settle_id = s2.id
                settle_dt = s2.settled_at
            elif days_ago >= 1:
                comm_status = "PAID"
                settle_id = s3.id
                settle_dt = s3.settled_at
            else:
                comm_status = "EARNED"

        c_obj = models.Commission(
            id=seed_id(f"comm-{idx:03d}"),
            user_id=user_id,
            transaction_id=t.id,
            partner_id=t.partner_id,
            customer_id=t.customer_id,
            service=t.service_name,
            transaction_amount=t.amount,
            commission_rate=rate,
            commission_amount=comm_amt,
            status=comm_status,
            earned_at=t.created_at,
            settlement_id=settle_id,
            settlement_date=settle_dt,
            created_at=t.created_at
        )
        commissions.append(c_obj)
        db.add(c_obj)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 5. 18 Realistic Complaints
    # ─────────────────────────────────────────────────────────────────────────
    complaint_configs = [
        ("comp-01", partner_map["partner-sharma"].id, t_failed.id, "TXN-DEMO-1001 IMPS Switch Timeout", "IMPS switch timeout on ₹8,500 DMT transfer at Sharma Telecom. Customer sender account debited without beneficiary acknowledgment. Bank desk escalation in progress.", "open", "urgent", "switch_timeout", "Naman Sharma", 3),
        ("comp-02", partner_map["partner-anand"].id, None, "Commercial Settlement Reconciliation — Anand Enterprises", "Pending settlement cycle reconciliation of ₹32,000 awaiting nodal account clearance confirmation.", "in_progress", "high", "settlement", "Operations Lead", 18),
        ("comp-03", partner_map["partner-verma"].id, transactions[2].id, "BBPS Biller Reversal Verification", "Electricity bill payment of ₹1,450 processed. Consumer requested physical stamped receipt.", "resolved", "medium", "txn_failure", "Support Desk", -2),
        ("comp-04", partner_map["partner-gupta"].id, transactions[3].id, "Recharge Gateway Rejection — Gupta Daily Mart", "The mobile recharge was rejected by operator gateway and required refund verification.", "resolved", "low", "service", "Support Desk", -1),
        ("comp-05", partner_map["partner-pooja"].id, None, "AePS Biometric Match Error Rate High", "High biometric mismatch rate reported during morning pension disbursement hours at Pooja Banking Point.", "escalated", "high", "switch_timeout", "Field Technical Lead", 8),
        ("comp-06", partner_map["partner-paras"].id, None, "Daily Cash Limit Upgrade Request", "Paras General Store requested increase in terminal daily cash float limit from ₹50,000 to ₹1,00,000.", "in_progress", "medium", "service", "Area Manager", 24),
        ("comp-07", partner_map["partner-city"].id, transactions[10].id, "Express DMT NEFT Delay Investigation", "Beneficiary account credit not acknowledged by regional cooperative bank switch after 4 hours.", "open", "high", "switch_timeout", "Naman Sharma", 6),
        ("comp-08", partner_map["partner-rahul"].id, None, "Aadhaar e-KYC Biometric Verification Pending", "Physical store inspection completed; waiting for UIDAI e-KYC response.", "open", "medium", "kyc", "Compliance Desk", 12),
        ("comp-09", partner_map["partner-kisan"].id, transactions[15].id, "Fertilizer Direct Benefit AePS Timeout", "Farmer cash withdrawal failed at terminal with debit on Aadhaar bank account.", "escalated", "urgent", "txn_failure", "Field Tech Lead", 2),
        ("comp-10", partner_map["partner-jaihind"].id, transactions[20].id, "Indo-Nepal Remittance Routing Check", "Remittance through Nepal SBI gateway took 48 hours for confirmation.", "resolved", "medium", "service", "Remittance Desk", -8),
        ("comp-11", partner_map["partner-singh"].id, None, "BBPS Commission Variance Discrepancy", "Partner flagged ₹18 variance between earned commission and statement payout.", "resolved", "low", "settlement", "Recon Engine", -12),
        ("comp-12", partner_map["partner-aarav"].id, transactions[25].id, "PAN Verification OCR Rejection", "Uploaded document image resolution below OCR threshold for applicant.", "open", "low", "service", "Support Desk", 36),
        ("comp-13", partner_map["partner-omsai"].id, None, "Merchant Bulk Payout Switch Latency", "Commercial B2B batch payout queued for 35 minutes before processor confirmation.", "in_progress", "medium", "switch_timeout", "Operations Desk", 14),
        ("comp-14", partner_map["partner-agro"].id, None, "Institutional Settlement Cycle Shift", "National Agro requested shift from T+2 to T+1 settlement cadence.", "in_progress", "high", "settlement", "Lead Banking Ops", 20),
        ("comp-15", partner_map["partner-apex-dist"].id, None, "Micro-ATM Terminal Paper Roll Stock", "Request for 50 rolls of thermal receipt paper for sub-agents.", "resolved", "low", "service", "Inventory Lead", -24),
        ("comp-16", partner_map["partner-vikas-agg"].id, transactions[35].id, "Sub-Kiosk Transaction Reversal", "Duplicate customer debit reversed to wallet within standard 2-hour window.", "resolved", "medium", "txn_failure", "Support Desk", -36),
        ("comp-17", partner_map["partner-north-agent"].id, None, "Field Agent Security Token Expired", "Hardware authentication token battery drained during field visit.", "resolved", "low", "service", "IT Helpdesk", -48),
        ("comp-18", partner_map["partner-coop-inst"].id, None, "Monthly Welfare Pension Reconciliation", "Mismatch in 2 beneficiary records out of 1,400 successfully disbursed.", "in_progress", "high", "settlement", "Nodal Officer", 10),
    ]

    for cid_lbl, pid, tid, subj, desc_text, st, prio, cat, assigned, sla_hours in complaint_configs:
        c_obj = models.Complaint(
            id=seed_id(cid_lbl),
            user_id=user_id,
            customer_id=pid,
            transaction_id=tid,
            subject=subj,
            description=desc_text,
            status=st,
            priority=prio,
            category=cat,
            assigned_to=assigned,
            sla_deadline=now + timedelta(hours=sla_hours),
            timeline_json=json.dumps([
                {"action": "Logged", "note": "Issue captured in ops desk", "timestamp": (now - timedelta(hours=abs(sla_hours) + 4)).isoformat(), "author": "System"},
                {"action": "Assigned", "note": f"Handled by {assigned}", "timestamp": (now - timedelta(hours=abs(sla_hours) + 2)).isoformat(), "author": "Supervisor"}
            ]),
            created_at=now - timedelta(hours=abs(sla_hours) + 4)
        )
        db.add(c_obj)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 6. 24 WhatsApp Outreach Records across ALL 5 Tabs
    # ─────────────────────────────────────────────────────────────────────────
    wa_configs = [
        # Pending (5)
        ("wa-pend-1", customers[0].id, "Paras Demo", "9305601503", "dmt", "hinglish", "pending", "daily", True, "Namaste Paras ji, Eko operations desk ki taraf se update. Aapka ₹25,000 Send Money transfer successfully complete ho gaya hai. Any sahayata ke liye sampark karein.", None, None, None, None, None, 20),
        ("wa-pend-2", customers[1].id, "Rahul Kumar", "9305601503", "kyc_reminder", "hindi", "pending", "daily", True, "नमस्ते राहुल जी, आपका KYC verification अभी pending है। कृपया इसे पूरा कर लें ताकि आपकी services active रहें।", None, None, None, None, None, 60),
        ("wa-pend-3", customers[3].id, "Sunita Devi", "9876500002", "kyc_reminder", "hinglish", "pending", "daily", True, "Namaste Sunita ji, aapke Eko Banking point par KYC verification document upload pending hai. Kripya counter par aakar Aadhaar/PAN submit karein taaki daily transaction limit active rahe.", None, None, None, None, None, 180),
        ("wa-pend-4", customers[4].id, "Anil Joshi", "9876500003", "aeps", "english", "pending", "4hours", True, "Hello Anil, your AePS cash withdrawal and mini-statement receipt is ready for download at your counter.", None, None, None, None, None, 240),
        ("wa-pend-5", customers[8].id, "Kavita Singh", "9876500007", "offer", "hindi", "pending", "once", True, "नमस्ते कविता जी, ईको के माध्यम से घरेलू मनी ट्रांसफर पर इस हफ्ते पाएं 10% अतिरिक्त कमीशन!", None, None, None, None, None, 300),

        # Sent (5)
        ("wa-sent-1", customers[2].id, "Ramesh Chandra", "9876500001", "settlement_notice", "hinglish", "sent", "none", False, "Namaste Ramesh ji, aapke store par T+1 settlement balance ₹11,200 successfully credit kar diya gaya hai. Details ke liye Eko app check karein.", 120, None, None, None, None, 180),
        ("wa-sent-2", customers[6].id, "Vikram Patel", "9876500005", "offer", "hindi", "sent", "none", False, "नमस्ते विक्रम जी, इस त्योहारी सीजन में अपने ग्राहकों को ईको की मनी ट्रांसफर एवं बिल सेवाएं दें और पाएं उच्चतम कमीशन!", 360, None, None, None, None, 480),
        ("wa-sent-3", customers[10].id, "Deepak Gupta", "9876500009", "offer", "english", "sent", "none", False, "Hello Deepak! Special festive offer: Enjoy fast money transfers, cash withdrawals, and bill payments with highest commission and zero downtime!", 720, None, None, None, None, 840),
        ("wa-sent-4", customers[9].id, "Rajesh Verma", "9876500008", "bbps", "hinglish", "sent", "none", False, "Namaste Rajesh ji, electricity aur broadband bills ka instant payment counter par karein. Official BBPS receipt instantly mil jayegi.", 180, None, None, None, None, 300),
        ("wa-sent-5", customers[20].id, "Kishore Lal", "9876500019", "payment_reminder", "english", "sent", "none", False, "Hello Kishore, reminder regarding your utility bill schedule. Visit our Eko counter today.", 240, None, None, None, None, 360),

        # Delivered (5)
        ("wa-del-1", customers[5].id, "Priya Sharma", "9876500004", "dispute_update", "hinglish", "delivered", "none", False, "Namaste Priya ji, aapki transaction complaint TXN-DEMO-1001 bank desk par escalate kar di gayi hai. Resolve hote hi aapko turant update diya jayega.", 90, 70, None, None, None, 120),
        ("wa-del-2", customers[11].id, "Meena Kumari", "9876500010", "aeps", "hindi", "delivered", "none", False, "नमस्ते मीना जी, आपकी सामाजिक सुरक्षा पेंशन का आधार बायोमेट्रिक नकद भुगतान केंद्र पर उपलब्ध है।", 240, 200, None, None, None, 360),
        ("wa-del-3", customers[12].id, "Sanjay Yadav", "9876500011", "payment_reminder", "english", "delivered", "none", False, "Hello Sanjay, your Eko partner account has a pending settlement balance due. Please complete payment today.", 300, 250, None, None, None, 420),
        ("wa-del-4", customers[17].id, "Harish Rawat", "9876500016", "dmt", "hinglish", "delivered", "none", False, "Namaste Harish ji, aapka express remittance successfully account me transfer ho gaya hai.", 150, 130, None, None, None, 200),
        ("wa-del-5", customers[18].id, "Geeta Choudhary", "9876500017", "aeps", "hindi", "delivered", "none", False, "नमस्ते गीता जी, आपका मिनी-एटीएम नकदी निकासी विवरण तैयार है।", 320, 290, None, None, None, 400),

        # Read (5)
        ("wa-read-1", customers[13].id, "Pooja Mishra", "9876500012", "bbps", "hindi", "read", "none", False, "नमस्ते पूजा जी, बिजली एवं पानी बिलों का भुगतान केंद्र पर सफलतापूर्वक हो गया है। डिजिटल रसीद सुरक्षित रखें।", 480, 450, 400, None, None, 600),
        ("wa-read-2", customers[14].id, "Manoj Tiwari", "9876500013", "recharge", "hinglish", "read", "none", False, "Namaste Manoj ji, aapka mobile data recharge successfully activate ho gaya hai. Eko services use karne ke liye dhanyawad.", 540, 500, 420, None, None, 720),
        ("wa-read-3", customers[15].id, "Rekha Rani", "9876500014", "dmt", "english", "read", "none", False, "Dear Rekha, your Domestic Money Transfer transaction has been credited to the beneficiary account.", 600, 560, 490, None, None, 800),
        ("wa-read-4", customers[16].id, "Ajay Kumar", "9876500015", "custom", "hinglish", "read", "none", False, "Namaste Ajay ji, student admission fee payment verified through Eko BBPS portal.", 350, 320, 280, None, None, 450),
        ("wa-read-5", customers[22].id, "Tarun Bajaj", "9876500021", "settlement_notice", "english", "read", "none", False, "Hello Tarun, your commercial trade payout of ₹16,500 has settled cleanly to your bank account.", 420, 390, 310, None, None, 500),

        # Failed (4)
        ("wa-fail-1", customers[7].id, "Mohammad Imran", "9876500006", "custom", "hinglish", "failed", "none", False, "Aapka ₹10,000 DMT payout bank switch confirmation pending hai. Hamare agent se turant sampark karein.", 360, None, None, 350, "Number temporarily unreachable; recipient off network", 360),
        ("wa-fail-2", customers[24].id, "Dharmendra Pal", "9876500023", "kyc_reminder", "hindi", "failed", "none", False, "नमस्ते धर्मेंद्र जी, आधार सत्यापन लिंक पर क्लिक करके अपना ई-केवाईसी पूर्ण करें।", 420, None, None, 410, "WhatsApp delivery timed out; invalid recipient handset response", 420),
        ("wa-fail-3", customers[23].id, "Anita Soren", "9876500022", "offer", "english", "failed", "none", False, "Hello Anita, special loan repayment discount available this week at Eko Seva Kendra.", 500, None, None, 490, "Destination handset carrier rejected incoming message packet", 500),
        ("wa-fail-4", customers[25].id, "Sita Ram", "9876500024", "aeps", "hinglish", "failed", "none", False, "Sita Ram ji, aapka Kisan subsidy cash payout counter par ready hai.", 280, None, None, 270, "Synthetic recipient number reported inactive", 280),
    ]

    cust_map = {c.id: c for c in customers}
    for wid_lbl, cid, cname, cphone, ttype, lang, st, freq, active_rem, msg, s_min, d_min, r_min, f_min, reason, c_min in wa_configs:
        cid_cust = cust_map.get(cid)
        p_id = cid if any(p.id == cid for p in partners) else (cid_cust.partner_id if cid_cust else None)
        w_obj = models.WhatsAppOutreach(
            id=seed_id(wid_lbl),
            user_id=user_id,
            customer_id=cid,
            customer_name=cname,
            customer_phone=cphone or "919305601503",
            template_type=ttype,
            language=lang,
            message=msg,
            status=st,
            reminder_frequency=freq,
            reminder_active=active_rem,
            partner_id=p_id,
            sent_at=(now - timedelta(minutes=s_min)) if s_min else None,
            delivered_at=(now - timedelta(minutes=d_min)) if d_min else None,
            read_at=(now - timedelta(minutes=r_min)) if r_min else None,
            failed_at=(now - timedelta(minutes=f_min)) if f_min else None,
            failure_reason=reason,
            notes=f"Synthetic operational outreach record ({st.upper()}).",
            created_at=now - timedelta(minutes=c_min)
        )
        db.add(w_obj)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 7. 18 Operational Tasks
    # ─────────────────────────────────────────────────────────────────────────
    task_configs = [
        ("task-01", partner_map["partner-paras"].id, "Review Paras General Store terminal daily cash limit", "high", False, now + timedelta(hours=6)),
        ("task-02", partner_map["partner-sharma"].id, "Investigate TXN-DEMO-1001 IMPS switch failure with bank desk", "urgent", False, now + timedelta(hours=2)),
        ("task-03", partner_map["partner-rahul"].id, "Conduct in-person biometric e-KYC verification for Rahul Kumar", "high", False, now + timedelta(hours=24)),
        ("task-04", partner_map["partner-pooja"].id, "Inspect Pooja Banking Point biometric scanner hardware", "high", False, now + timedelta(hours=8)),
        ("task-05", partner_map["partner-anand"].id, "Reconcile commercial settlement batch for Anand Enterprises", "medium", False, now + timedelta(hours=18)),
        ("task-06", partner_map["partner-verma"].id, "Verify physical receipt dispatch for electricity bill customer", "low", True, now - timedelta(hours=4)),
        ("task-07", partner_map["partner-gupta"].id, "Confirm operator refund credited for failed recharge", "low", True, now - timedelta(hours=10)),
        ("task-08", partner_map["partner-city"].id, "Review peak evening remittance gateway latency at City Pay Point", "medium", False, now + timedelta(hours=12)),
        ("task-09", partner_map["partner-kisan"].id, "Distribute farmer welfare AePS transaction logs to cooperative", "medium", False, now + timedelta(hours=36)),
        ("task-10", partner_map["partner-jaihind"].id, "Update Indo-Nepal Remittance currency conversion rate card", "medium", True, now - timedelta(hours=2)),
        ("task-11", partner_map["partner-singh"].id, "Audit BBPS collection statement for Singh Mobile counter", "low", True, now - timedelta(days=1)),
        ("task-12", partner_map["partner-aarav"].id, "Deliver second receipt printer to Aarav Digital Seva Kendra", "low", False, now + timedelta(days=2)),
        ("task-13", partner_map["partner-omsai"].id, "Configure B2B merchant batch payout webhook notifications", "medium", False, now + timedelta(hours=30)),
        ("task-14", partner_map["partner-agro"].id, "Finalize corporate bulk remittance agreement with National Agro", "high", False, now + timedelta(days=3)),
        ("task-15", partner_map["partner-apex-dist"].id, "Replenish thermal paper roll inventory for district sub-agents", "low", True, now - timedelta(days=2)),
        ("task-16", partner_map["partner-vikas-agg"].id, "Run weekly sub-kiosk reconciliation across 14 rural touchpoints", "medium", False, now + timedelta(days=4)),
        ("task-17", partner_map["partner-north-agent"].id, "Issue replacement OTP hardware security token for field agent", "low", True, now - timedelta(days=3)),
        ("task-18", partner_map["partner-coop-inst"].id, "Submit monthly state pension disbursement audit report", "high", False, now + timedelta(days=5)),
    ]

    for tid_lbl, pid, title, prio, done, d_date in task_configs:
        t_obj = models.Task(
            id=seed_id(tid_lbl),
            user_id=user_id,
            customer_id=pid,
            title=title,
            priority=prio,
            completed=done,
            due_date=d_date.strftime("%Y-%m-%d %H:%M") if d_date else None,
            created_at=now - timedelta(days=2)
        )
        db.add(t_obj)
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 8. Stored Credit Assessments for All 22 Partners & Sample Customers
    # ─────────────────────────────────────────────────────────────────────────
    from main import calculate_dynamic_score

    for p in partners:
        score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, p.id)
        factors["transaction_volume"] = sum(t.amount for t in transactions if (t.partner_id == p.id or t.customer_id == p.id) and t.status == "success")
        factors["total_transactions"] = len([t for t in transactions if t.partner_id == p.id or t.customer_id == p.id])
        factors["failed_transactions"] = len([t for t in transactions if (t.partner_id == p.id or t.customer_id == p.id) and t.status == "failed"])
        factors["risk_indicators"] = "none"

        db.add(models.CreditScore(
            id=seed_id(f"credit-{p.id}"),
            user_id=user_id,
            customer_id=p.id,
            customer_name=p.name,
            score=round(score_val, 1),
            risk_bracket=risk,
            confidence=round(conf, 2),
            factors=json.dumps(factors),
            recommendations=recs,
            created_at=now - timedelta(days=1)
        ))
    db.commit()

    # Credit profiles for customers
    for c in customers[:10]:
        score_val, risk, conf, factors, recs = calculate_dynamic_score(db, user_id, c.id)
        factors["transaction_volume"] = sum(t.amount for t in transactions if (t.partner_id == c.id or t.customer_id == c.id) and t.status == "success")
        factors["total_transactions"] = len([t for t in transactions if t.partner_id == c.id or t.customer_id == c.id])
        factors["failed_transactions"] = len([t for t in transactions if (t.partner_id == c.id or t.customer_id == c.id) and t.status == "failed"])
        factors["risk_indicators"] = "none"

        db.add(models.CreditScore(
            id=seed_id(f"credit-{c.id}"),
            user_id=user_id,
            customer_id=c.id,
            customer_name=c.name,
            score=round(score_val, 1),
            risk_bracket=risk,
            confidence=round(conf, 2),
            factors=json.dumps(factors),
            recommendations=recs,
            created_at=now - timedelta(days=1)
        ))
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 9. Notes
    # ─────────────────────────────────────────────────────────────────────────
    note1 = models.Note(
        id=seed_id("note-1"), user_id=user_id, customer_id=partner_map["partner-paras"].id,
        content="Paras General Store confirmed morning cash drawer float is balanced and ready for weekend DMT volume.",
        created_at=now - timedelta(hours=8)
    )
    note2 = models.Note(
        id=seed_id("note-2"), user_id=user_id, customer_id=partner_map["partner-sharma"].id,
        content="Sharma Telecom DMT ticket TXN-DEMO-1001 escalated to bank switch nodal desk. Customer updated via WhatsApp.",
        created_at=now - timedelta(hours=1)
    )
    note3 = models.Note(
        id=seed_id("note-3"), user_id=user_id, customer_id=partner_map["partner-rahul"].id,
        content="Rahul Kumar submitted digital copy of shop rent agreement and PAN. Original Aadhaar in-person verification scheduled for tomorrow.",
        created_at=now - timedelta(hours=4)
    )
    db.add_all([note1, note2, note3])
    db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 10. Operational Notifications
    # ─────────────────────────────────────────────────────────────────────────
    notifs = [
        models.OperationalNotification(
            id=seed_id("notif-1"), user_id=user_id,
            title="TXN-DEMO-1001: IMPS Switch Failure",
            message=f"₹8,500 DMT transfer failed at {partner_map['partner-sharma'].name}. Beneficiary switch timeout requires immediate review.",
            category="alert", priority="urgent", deep_link=f"/activity/{t_failed.id}",
            created_at=now - timedelta(hours=2)
        ),
        models.OperationalNotification(
            id=seed_id("notif-2"), user_id=user_id,
            title="Pending Settlement: ₹4,850 Available",
            message="Your partner operational commissions are reconciled and ready for next cutoff payout.",
            category="info", priority="medium", deep_link="/earnings",
            created_at=now - timedelta(hours=5)
        ),
        models.OperationalNotification(
            id=seed_id("notif-3"), user_id=user_id,
            title="Pending KYC: Rahul Kumar",
            message="Partner onboarding documentation pending physical premises inspection.",
            category="reminder", priority="medium", deep_link=f"/partners/{partner_map['partner-rahul'].id}",
            created_at=now - timedelta(hours=4)
        ),
        models.OperationalNotification(
            id=seed_id("notif-4"), user_id=user_id,
            title="WhatsApp Outreach Due: Sunita Devi",
            message="Reminder: Follow up on pending customer KYC document submission via WhatsApp.",
            category="reminder", priority="medium", deep_link="/whatsapp-studio",
            created_at=now - timedelta(hours=2)
        )
    ]
    db.add_all(notifs)
    db.commit()

    return {
        "partners": len(partners),
        "customers": len(customers),
        "transactions": len(transactions),
        "commissions": len(commissions),
        "settlements": 3,
        "complaints": len(complaint_configs),
        "whatsapp": len(wa_configs),
        "tasks": len(task_configs)
    }
