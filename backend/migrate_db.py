"""
migrate_db.py - Fresh database migration with raw SQL column additions
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "cisco_monitor.db")

print("=== Cisco Monitor DB Migration ===")

# Step 1: Add columns to existing tables via raw SQLite
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

print("\n[1] Migrating existing tables (adding columns)...")

# Add columns to users table (ignore if already exists)
new_user_cols = [
    ("ALTER TABLE users ADD COLUMN full_name TEXT", "full_name"),
    ("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1", "is_active"),
    ("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 1", "must_change_password"),
    ("ALTER TABLE users ADD COLUMN created_at TEXT", "created_at"),
]
for sql, col in new_user_cols:
    try:
        cur.execute(sql)
        print(f"    + users.{col} added")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print(f"    ~ users.{col} already exists")
        else:
            raise

# Add columns to switches table
new_switch_cols = [
    ("ALTER TABLE switches ADD COLUMN site_id INTEGER REFERENCES sites(id)", "site_id"),
]
for sql, col in new_switch_cols:
    try:
        cur.execute(sql)
        print(f"    + switches.{col} added")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print(f"    ~ switches.{col} already exists")
        else:
            raise

# Remove old columns that don't exist in new model (SQLite doesn't support DROP COLUMN easily, just ignore)
# site, branch_id columns in switches - we leave them, SQLAlchemy will ignore extra columns

conn.commit()
conn.close()

print("    Column migration done")

# Step 2: Create new tables via SQLAlchemy
print("\n[2] Creating new tables (sites, user_site_assignments, audit_logs)...")
import database, models, auth
models.Base.metadata.create_all(bind=database.engine)
print("    Tables created OK")

db = database.SessionLocal()

try:
    # Step 3: Seed admin user
    print("\n[3] Checking admin user...")
    # Use raw query to avoid column mismatch
    from sqlalchemy import text
    result = db.execute(text("SELECT id, username FROM users WHERE username='admin'")).fetchone()

    if not result:
        raw_password = "Admin@1234"
        from datetime import datetime
        import bcrypt
        hashed = bcrypt.hashpw(raw_password.encode(), bcrypt.gensalt()).decode()
        db.execute(text(
            "INSERT INTO users (username, full_name, hashed_password, role, is_active, must_change_password, created_at) "
            "VALUES (:u, :fn, :hp, :r, 1, 0, :ca)"
        ), {"u": "admin", "fn": "System Administrator", "hp": hashed, "r": "admin", "ca": datetime.utcnow().isoformat()})
        db.commit()
        print(f"    [OK] Admin created: username=admin  password={raw_password}")
    else:
        # Update role column for existing admin if needed
        db.execute(text("UPDATE users SET role='admin', is_active=1, must_change_password=0 WHERE username='admin'"))
        db.commit()
        print("    Admin already exists, updated role/flags")

    # Step 4: Seed default site
    print("\n[4] Checking default site...")
    existing_site = db.query(models.Site).filter(models.Site.name == "Bigc-Hyper Phitsanulok").first()
    if not existing_site:
        from datetime import datetime
        site = models.Site(
            name="Bigc-Hyper Phitsanulok",
            description="Big C Hypermarket Phitsanulok - Access Switches"
        )
        db.add(site)
        db.commit()
        db.refresh(site)
        print(f"    [OK] Site created: ID={site.id}")
    else:
        site = existing_site
        print(f"    Site exists: ID={site.id}")

    # Step 5: Assign switches to site
    print("\n[5] Migrating switches to site...")
    migrated = db.execute(text(
        f"UPDATE switches SET site_id={site.id} WHERE site_id IS NULL"
    )).rowcount
    db.commit()
    print(f"    [OK] Migrated {migrated} switch(es) to site_id={site.id}")

    # Summary
    user_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
    switch_count = db.execute(text("SELECT COUNT(*) FROM switches")).scalar()
    site_count = db.execute(text("SELECT COUNT(*) FROM sites")).scalar()

    print(f"\n=== Migration Complete ===")
    print(f"  Sites:    {site_count}")
    print(f"  Users:    {user_count}")
    print(f"  Switches: {switch_count}")
    print(f"  Login: admin / Admin@1234")
    print(f"  NOTE: Please change default password after first login!\n")

finally:
    db.close()
