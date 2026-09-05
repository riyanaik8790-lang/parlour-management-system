import mysql.connector
try:
    c = mysql.connector.connect(host="localhost", port=3306, user="root", password="", database="salon_db")
    print("Connected OK")
    c.close()
except Exception as e:
    print(f"ERROR: {e}")
