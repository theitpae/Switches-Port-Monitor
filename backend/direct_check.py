import sqlite3
import os

try:
    conn = sqlite3.connect("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/cisco_monitor.db")
    cursor = conn.cursor()
    cursor.execute("SELECT ip_address FROM switches")
    rows = cursor.fetchall()
    with open("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/direct_db_check.txt", "w") as f:
        f.write(f"Rows: {rows}\n")
    conn.close()
except Exception as e:
    with open("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/direct_db_check.txt", "w") as f:
        f.write(f"Error: {e}\n")
