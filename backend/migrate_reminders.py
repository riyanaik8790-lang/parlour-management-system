import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("Error: DATABASE_URL not found in environment.")
    exit(1)

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    print("Connected to database. Running migration...")

    # Add reminder_sent column
    cur.execute("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Migration successful: added reminder_sent to appointments.")
except Exception as e:
    print(f"Migration failed: {e}")
