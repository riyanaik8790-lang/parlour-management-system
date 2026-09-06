"""
Creates an ADMIN user in Aiven MySQL.
"""
import mysql.connector
import bcrypt
import os
import urllib.parse as urlparse
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── Aiven connection ─────────────────────────────────────────────────────────
url = urlparse.urlparse(os.environ["DATABASE_URL"])
AIVEN = {
    "host": url.hostname,
    "port": url.port or 3306,
    "user": url.username,
    "password": url.password,
    "database": url.path[1:],
    "ssl_disabled": False,
}

# ── Admin details ─────────────────────────────────────────────────────────────
ADMIN_NAME     = "Hemangi Patil"
ADMIN_EMAIL    = "patilh3845@gmail.com"
ADMIN_PASSWORD = "Hemangi@Salon2026"
ADMIN_PHONE    = "0000000000"

# ── Hash password ─────────────────────────────────────────────────────────────
hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ── Insert into Aiven ─────────────────────────────────────────────────────────
conn = mysql.connector.connect(**AIVEN)
cur = conn.cursor(dictionary=True)

# Check if already exists
cur.execute("SELECT id, role FROM users WHERE email = %s", (ADMIN_EMAIL,))
existing = cur.fetchone()

if existing:
    # Just promote to ADMIN
    cur.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", (ADMIN_EMAIL,))
    conn.commit()
    print(f"[done] User '{ADMIN_EMAIL}' already existed → promoted to ADMIN (id={existing['id']})")
else:
    cur.execute(
        "INSERT INTO users (name, email, password, phone, role) VALUES (%s, %s, %s, %s, 'ADMIN')",
        (ADMIN_NAME, ADMIN_EMAIL, hashed, ADMIN_PHONE)
    )
    conn.commit()
    print(f"[done] Admin created!")
    print(f"       Name:  {ADMIN_NAME}")
    print(f"       Email: {ADMIN_EMAIL}")
    print(f"       Role:  ADMIN")

cur.close()
conn.close()
