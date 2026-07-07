import sqlite3

try:
    conn = sqlite3.connect("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/cisco_monitor.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM switches")
    rows = cursor.fetchall()
    
    with open("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/debug_output2.txt", "w") as f:
        f.write(f"ROWS IN DB: {rows}\n")
except Exception as e:
    with open("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/debug_output2.txt", "w") as f:
        f.write(f"ERROR: {e}\n")
