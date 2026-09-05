import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

config = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'port': int(os.getenv('MYSQL_PORT', '3306')),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'salon_db'),
}

try:
    db = mysql.connector.connect(**config)
    cur = db.cursor()
    
    # Check if role column exists
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
    """, (config['database'],))
    exists = cur.fetchone()[0]
    
    if not exists:
        cur.execute("ALTER TABLE users ADD COLUMN role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER' AFTER phone")
        db.commit()
        print('SUCCESS: role column added to users table')
    else:
        cur.execute("ALTER TABLE users MODIFY COLUMN role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER'")
        db.commit()
        print('SUCCESS: role column already exists, type confirmed')
    
    # Show current users and their roles
    cur.execute("SELECT id, name, email, role FROM users ORDER BY id")
    rows = cur.fetchall()
    print(f'\nCurrent users ({len(rows)} total):')
    for row in rows:
        print(f'  #{row[0]} {row[1]} <{row[2]}> role={row[3]}')
    
    cur.close()
    db.close()
except Exception as e:
    print(f'ERROR: {e}')
