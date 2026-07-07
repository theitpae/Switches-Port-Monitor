import os

try:
    if os.path.exists("cisco_monitor.db"):
        os.remove("cisco_monitor.db")
        print("Deleted old cisco_monitor.db")
except Exception as e:
    print(f"Error deleting db: {e}")

import database, models
models.Base.metadata.create_all(bind=database.engine)
db = database.SessionLocal()
new_switch = models.Switch(
    ip_address="10.178.135.23",
    username="netadmin",
    password="Jupiter12",
    hostname="PL-2960-P23",
    site="Bigc-Hyper Phitsanulok",
    location_area="Hyper IT Rack Manager Room",
    model="Access Switch IP.23"
)
db.add(new_switch)
db.commit()
print("Database rebuilt and seeded with 10.178.135.23 and Jupiter12")
db.close()
