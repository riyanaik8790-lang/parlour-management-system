import mysql.connector, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

config = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "salon_db"),
}

c = mysql.connector.connect(**config)
cur = c.cursor()

sql = open(os.path.join(os.path.dirname(__file__), "schema_push.sql")).read()
# mysql.connector doesn't support multiple statements, execute one at a time
for stmt in sql.split(";"):
    stmt = stmt.strip()
    if stmt:
        cur.execute(stmt)

c.commit()
print("Migration OK — push_subscriptions table created/verified.")
cur.close()
c.close()
