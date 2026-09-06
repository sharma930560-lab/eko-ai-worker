import sys
import os
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_complaints_and_services():
    user_header = {'X-User-Id': 'demo-operator-01'}

    # 1. Complaints Fetch
    res = client.get('/api/complaints', headers=user_header)
    assert res.status_code == 200, f"Fetch complaints failed: {res.text}"
    complaints = res.json()
    assert len(complaints) >= 8, f"Expected at least 8 complaints, got {len(complaints)}"
    c0 = complaints[0]
    cid = c0['id']
    print(f"Complaint {cid}: Status={c0['status']}, Category={c0.get('category')}")

    # 2. Add Note
    res_note = client.post(f'/api/complaints/{cid}/notes', json={'note': 'Partner visited counter, reviewed physical register and bank UTR.'}, headers=user_header)
    assert res_note.status_code == 200, f"Add note failed: {res_note.text}"
    timeline = res_note.json().get('timeline', [])
    assert any('physical register' in t.get('note', '') for t in timeline), "Note should be in timeline"
    print(f"Note added successfully. Timeline events count: {len(timeline)}")

    # 3. Patch Status & Assigned To
    res_patch = client.patch(f'/api/complaints/{cid}', json={'status': 'IN_PROGRESS', 'assigned_to': 'Naman Sharma'}, headers=user_header)
    assert res_patch.status_code == 200, f"Patch failed: {res_patch.text}"
    patched_data = res_patch.json()
    assert patched_data['status'] == 'IN_PROGRESS'
    assert patched_data['assigned_to'] == 'Naman Sharma'
    print(f"Complaint patched: Status={patched_data['status']}, AssignedTo={patched_data['assigned_to']}")

    # 4. WhatsApp Outreach list & generate
    res_wa = client.get('/api/whatsapp/outreach', headers=user_header)
    assert res_wa.status_code == 200, f"Fetch outreach failed: {res_wa.text}"
    outreaches = res_wa.json()
    assert len(outreaches) >= 8, f"Expected 8 outreaches, got {len(outreaches)}"
    print(f"WhatsApp outreach count: {len(outreaches)}")

    gen_payload = {'template_type': 'kyc_reminder', 'customer_name': 'Aarav Sharma', 'language': 'hinglish'}
    res_gen = client.post('/api/whatsapp/generate', json=gen_payload, headers=user_header)
    assert res_gen.status_code == 200, f"WA gen failed: {res_gen.text}"
    gen_data = res_gen.json()
    assert 'message' in gen_data
    print(f"WhatsApp AI Generator: template_type={gen_data.get('template_type')}, message={gen_data.get('message')[:40]}...")

    # 5. Poster Studio list & generate copy
    res_posters = client.get('/api/posters', headers=user_header)
    assert res_posters.status_code == 200, f"Fetch posters failed: {res_posters.text}"
    posters = res_posters.json()
    assert len(posters) >= 6, f"Expected 6 posters, got {len(posters)}"
    print(f"Posters count: {len(posters)}")

    copy_payload = {'template_type': 'dmt', 'partner_name': 'Sharma Digital Store'}
    res_copy = client.post('/api/posters/generate-copy', json=copy_payload, headers=user_header)
    assert res_copy.status_code == 200, f"Poster gen failed: {res_copy.text}"
    copy_data = res_copy.json()
    assert 'headline' in copy_data
    print(f"Poster AI Copy Generator: headline='{copy_data.get('headline')}'")

    print("\nALL RECRUITER DEMO SANDBOX & STUDIO ENDPOINTS VALIDATED SUCCESSFULLY!")

if __name__ == '__main__':
    test_complaints_and_services()
