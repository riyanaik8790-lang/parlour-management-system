import requests

r = requests.post("http://localhost:5000/api/login", json={
    "email": "riya@gmail.com",
    "password": "Salon@1234"
})
print("=== LOGIN ===")
print("Status:", r.status_code)

if r.status_code != 200:
    print("Body:", r.text)
    exit(1)

token = r.json()["token"]
print("Token OK:", token[:50], "...")

headers = {"Authorization": f"Bearer {token}"}

print("\n=== MY-BOOKINGS ===")
r2 = requests.get("http://localhost:5000/api/my-bookings", headers=headers)
print("Status:", r2.status_code)
print("Body:", r2.text[:300])

print("\n=== ADMIN STATS ===")
r3 = requests.get("http://localhost:5000/api/admin/stats", headers=headers)
print("Status:", r3.status_code)
print("Body:", r3.text[:300])

print("\n=== ADMIN USERS ===")
r4 = requests.get("http://localhost:5000/api/admin/users", headers=headers)
print("Status:", r4.status_code)
print("Body:", r4.text[:300])
