import sqlite3

db = sqlite3.connect('cisco_monitor.db')
cur = db.cursor()

try:
    cur.execute('ALTER TABLE switches ADD COLUMN is_active INTEGER DEFAULT 1')
    print('Added is_active to switches')
except Exception as e:
    print(f'switches.is_active already exists: {e}')

try:
    cur.execute('''CREATE TABLE IF NOT EXISTS config_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        switch_id INTEGER REFERENCES switches(id),
        config_text TEXT,
        backed_up_by VARCHAR,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    print('Created config_backups table')
except Exception as e:
    print(f'config_backups error: {e}')

db.commit()
db.close()
print('Migration complete!')
