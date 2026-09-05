import requests
import json

BASE_URL = "http://localhost:8000"

def test_cors_http_appassets():
    headers = {
        "Origin": "http://appassets.androidplatform.net",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    res = requests.options(f"{BASE_URL}/api/auth/google", headers=headers)
    print(f"CORS http://appassets.androidplatform.net: status={res.status_code}, allow-origin={res.headers.get('access-control-allow-origin')}")
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://appassets.androidplatform.net"

def test_cors_https_appassets():
    headers = {
        "Origin": "https://appassets.androidplatform.net",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    res = requests.options(f"{BASE_URL}/api/auth/google", headers=headers)
    print(f"CORS https://appassets.androidplatform.net: status={res.status_code}, allow-origin={res.headers.get('access-control-allow-origin')}")
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://appassets.androidplatform.net"

def test_missing_token():
    res = requests.post(f"{BASE_URL}/api/auth/google", json={})
    print(f"Missing token response: status={res.status_code}, body={res.text}")
    assert res.status_code == 400

def test_invalid_token():
    res = requests.post(f"{BASE_URL}/api/auth/google", json={"credential": "invalid_bogus_token"})
    print(f"Invalid token response: status={res.status_code}, body={res.text}")
    assert res.status_code == 401
    assert "Invalid Google token" in res.text

if __name__ == "__main__":
    test_cors_http_appassets()
    test_cors_https_appassets()
    test_missing_token()
    test_invalid_token()
    print("ALL AUTH API TESTS PASSED!")
