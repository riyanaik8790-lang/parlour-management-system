"""Update admin phone number in Aiven MySQL."""
import mysql.connector, os, urllib.parse as urlparse
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

url = urlparse.urlparse(os.environ["DATABASE_URL"])
conn = mysql.connector.connect(
    host=url.hostname, port=url.port or 3306,
    user=url.username, password=url.password,
    database=url.path[1:], ssl_disabled=False,
)
cur = conn.cursor()
cur.execute("UPDATE users SET phone = %s WHERE email = %s", ("8208576165", "patilh3845@gmail.com"))
conn.commit()
print(f"[done] Rows updated: {cur.rowcount}")
cur.close()
conn.close()
