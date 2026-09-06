"""
One-time script: imports schema_aiven.sql into Aiven MySQL.
Run from the backend folder:  python import_aiven_schema.py
"""
import mysql.connector
import os

AIVEN = {
    "host": "mysql-34628147-riyanaik8790-e7ca.i.aivencloud.com",
    "port": 15502,
    "user": "avnadmin",
    "password": os.getenv("AIVEN_PASSWORD", ""),  # pass via env or edit below
    "database": "defaultdb",
    "ssl_disabled": False,
}

# ── Read password from .env if present ──────────────────────────────────────
from dotenv import load_dotenv
import urllib.parse as urlparse
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
if "DATABASE_URL" in os.environ:
    url = urlparse.urlparse(os.environ["DATABASE_URL"])
    AIVEN["password"] = url.password or ""
    print(f"[info] Using password from DATABASE_URL")
else:
    print("[warn] DATABASE_URL not set in .env — set AIVEN_PASSWORD env var or edit this script")

# ── Run the SQL file ─────────────────────────────────────────────────────────
schema_path = os.path.join(os.path.dirname(__file__), "schema_aiven.sql")
with open(schema_path, "r", encoding="utf-8") as f:
    sql = f.read()

# Split on semicolons, skip blank / comment-only statements
# Keep multi-line statements intact by joining lines before splitting
raw_statements = sql.split(";")
statements = []
for s in raw_statements:
    # Remove leading/trailing whitespace and skip pure comment blocks
    lines = [l for l in s.strip().splitlines() if l.strip() and not l.strip().startswith("--")]
    if lines:
        statements.append("\n".join(lines))

print(f"[info] Connecting to Aiven MySQL at {AIVEN['host']}:{AIVEN['port']} ...")
conn = mysql.connector.connect(**AIVEN)
cur = conn.cursor()
print(f"[info] Connected. Executing schema ...")

total_ok = 0
total_warn = 0
for i, stmt in enumerate(statements, 1):
    try:
        cur.execute(stmt)
        conn.commit()
        print(f"  [{i}] OK: {stmt[:60].replace(chr(10),' ')}")
        total_ok += 1
    except mysql.connector.Error as e:
        print(f"  [{i}] WARN: {e}  |  stmt: {stmt[:60].replace(chr(10),' ')}")
        total_warn += 1

cur.close()
conn.close()
print(f"[done] Schema import complete! OK={total_ok}  WARN={total_warn}")
