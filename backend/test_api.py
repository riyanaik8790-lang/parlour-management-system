import requests
import json

BASE = "http://localhost:5000"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6MTc4NTYxNDM2MCwiaWF0IjoxNzg1MDA5NTYwfQ.ukBu7YfSd10mXYPIja4N1oJ6qc9oy7-w9hko-qhGeoQ"

H = {"Authorization": f"Bearer {TOKEN}"}

# Test admin/stats
print("=== /api/admin/stats ===")
r = requests.get(f"{BASE}/api/admin/stats", headers=H)
print(f"Status: {r.status_code}, Response: {json.dumps(r.json(), indent=2)}")

# Test admin/bookings
print("\n=== /api/admin/bookings ===")
r = requests.get(f"{BASE}/api/admin/bookings", headers=H)
print(f"Status: {r.status_code}")
d = r.json()
print(f"Total: {d.get('total')}")

# Test admin/users
print("\n=== /api/admin/users ===")
r = requests.get(f"{BASE}/api/admin/users", headers=H)
print(f"Status: {r.status_code}, Response: {json.dumps(r.json(), indent=2)}")

# Test my-bookings  
print("\n=== /api/my-bookings ===")
r = requests.get(f"{BASE}/api/my-bookings", headers=H)
print(f"Status: {r.status_code}, Response: {json.dumps(r.json(), indent=2)}")
