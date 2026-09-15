import psycopg2
import os

SUPABASE_URL = "postgresql://postgres:hemangi%40Salon3845@db.dldewlhruackgkwauxsx.supabase.co:5432/postgres"

def main():
    print("Connecting to Supabase...")
    conn = psycopg2.connect(SUPABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Reading schema_supabase.sql...")
    with open("schema_supabase.sql", "r") as f:
        sql = f.read()

    print("Executing schema...")
    cur.execute(sql)
    print("Schema applied successfully!")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
