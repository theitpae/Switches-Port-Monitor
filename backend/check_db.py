import database, models
db = database.SessionLocal()
switches = db.query(models.Switch).all()
for s in switches:
    print(f"ID: {s.id}, IP: {s.ip_address}, Host: {s.hostname}")
db.close()
