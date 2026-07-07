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

# Avoid duplicates
if not db.query(models.Switch).filter(models.Switch.ip_address == "10.178.135.23").first():
    db.add(new_switch)
    db.commit()
    print("Switch PL-2960-P23 seeded successfully!")
else:
    print("Switch already exists in DB.")

db.close()
