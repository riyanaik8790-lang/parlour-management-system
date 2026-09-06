import os
import urllib.parse as urlparse
import mysql.connector

# Ask the user to paste their Aiven DATABASE_URL
print("Please paste your full Aiven DATABASE_URL (mysql://...): ")
db_url_input = input().strip()

if not db_url_input.startswith("mysql://"):
    print("Error: Invalid URL. It must start with mysql://")
    exit(1)

url = urlparse.urlparse(db_url_input)

try:
    print("\nConnecting to remote database...")
    db = mysql.connector.connect(
        host=url.hostname,
        port=url.port or 3306,
        user=url.username,
        password=url.password,
        database=url.path[1:], # strip leading slash
        autocommit=True
    )
    cursor = db.cursor()
    print("Successfully connected!")
    
    # Read the schema.sql file
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    print(f"Reading schema from {schema_path}...")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    
    # Execute the statements one by one
    print("Creating tables...")
    statements = [s.strip() for s in schema_sql.split(";") if s.strip()]
    for statement in statements:
        try:
            cursor.execute(statement)
        except mysql.connector.Error as err:
            # Ignore "Table already exists" errors just in case
            if err.errno != 1050:
                print(f"Warning on statement: {err}")
                
    print("\n✅ Success! All tables have been created on your live Aiven database.")
    cursor.close()
    db.close()
except Exception as e:
    print(f"\n❌ Error connecting or setting up tables: {e}")
