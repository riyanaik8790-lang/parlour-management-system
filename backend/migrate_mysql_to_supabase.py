import os
import sys
import mysql.connector
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

AIVEN_URL = os.getenv("AIVEN_DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_DATABASE_URL")

if not AIVEN_URL or not SUPABASE_URL:
    print("Error: AIVEN_DATABASE_URL and SUPABASE_DATABASE_URL must be set in .env or environment variables.")
    print("Example:")
    print("  AIVEN_DATABASE_URL=\"mysql://user:pass@host:port/dbname\"")
    print("  SUPABASE_DATABASE_URL=\"postgresql://postgres.xxx:pass@aws-0-region.pooler.supabase.com:5432/postgres\"")
    sys.exit(1)

def main():
    print("Connecting to Aiven MySQL...")
    try:
        from urllib.parse import urlparse
        url = urlparse(AIVEN_URL)
        mysql_conn = mysql.connector.connect(
            host=url.hostname,
            port=url.port or 3306,
            user=url.username,
            password=url.password,
            database=url.path[1:],
            ssl_disabled=False
        )
        mysql_cur = mysql_conn.cursor(dictionary=True)
    except Exception as e:
        print(f"Failed to connect to MySQL: {e}")
        sys.exit(1)

    print("Connecting to Supabase Postgres...")
    try:
        pg_conn = psycopg2.connect(SUPABASE_URL)
        pg_cur = pg_conn.cursor()
    except Exception as e:
        print(f"Failed to connect to Postgres: {e}")
        sys.exit(1)

    # Order matters due to foreign keys!
    tables = [
        "users",
        "services",
        "appointments",
        "skin_analyses",
        "notifications",
        "push_subscriptions",
        "admin_actions"
    ]

    for table in tables:
        print(f"\nMigrating table: {table}...")
        
        # 1. Read from MySQL
        try:
            mysql_cur.execute(f"SELECT * FROM {table}")
            rows = mysql_cur.fetchall()
            print(f"  Found {len(rows)} rows in MySQL.")
        except Exception as e:
            print(f"  Error reading from MySQL: {e}")
            if table == "push_subscriptions":
                print("  (Skipping push_subscriptions as it seems to not exist or be empty in MySQL)")
                continue
            else:
                sys.exit(1)

        if not rows:
            print("  No data to migrate.")
            continue

        # 2. Insert into Postgres
        columns = list(rows[0].keys())
        col_names = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        # Handle duplicate keys smoothly, especially for 'services' seeded via schema
        if table == "services":
            insert_query = f"INSERT INTO {table} ({col_names}) VALUES %s ON CONFLICT (id) DO NOTHING"
        else:
            insert_query = f"INSERT INTO {table} ({col_names}) VALUES %s ON CONFLICT (id) DO NOTHING"

        values = [[row[col] for col in columns] for row in rows]
        
        try:
            psycopg2.extras.execute_values(pg_cur, insert_query, values, page_size=1000)
            pg_conn.commit()
            print(f"  Successfully inserted into Postgres.")
        except Exception as e:
            print(f"  Error inserting into Postgres: {e}")
            pg_conn.rollback()
            sys.exit(1)

        # 3. Verify row counts
        pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
        pg_count = pg_cur.fetchone()[0]
        if pg_count != len(rows) and table != "services":
            print(f"  WARNING: Row count mismatch! MySQL: {len(rows)}, Postgres: {pg_count}")
        else:
            print(f"  Verified row count: {pg_count}")
        
        # 4. Update sequences for tables with SERIAL primary keys so new inserts don't fail
        if table != "services":
            try:
                pg_cur.execute(f"SELECT setval('{table}_id_seq', COALESCE((SELECT MAX(id)+1 FROM {table}), 1), false);")
                pg_conn.commit()
                print("  Updated sequence generator.")
            except Exception as e:
                print(f"  Error updating sequence: {e}")

    print("\nMigration completed successfully!")
    
    mysql_cur.close()
    mysql_conn.close()
    pg_cur.close()
    pg_conn.close()

if __name__ == "__main__":
    main()
