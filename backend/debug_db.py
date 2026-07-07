import sqlite3
try:
    conn = sqlite3.connect("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/cisco_monitor.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM switches")
    rows = cursor.fetchall()
    print("ROWS IN DB:", rows)
except Exception as e:
    print("ERROR:", e)
