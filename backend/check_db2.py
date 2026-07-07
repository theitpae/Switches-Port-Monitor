import database, models
db = database.SessionLocal()
switches = db.query(models.Switch).all()
with open("db_output.txt", "w") as f:
    for s in switches:
        f.write(f"ID: {s.id}, IP: {s.ip_address}, Host: {s.hostname}\n")
    if not switches:
        f.write("DATABASE IS EMPTY!\n")
db.close()
