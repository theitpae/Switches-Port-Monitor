import database, models

db = database.SessionLocal()

new_switch = models.Switch(
    ip_address="10.128.95.23",
    username="netadmin",
    password="Jupiter12",
    hostname="PL-2960-P23-2",
    site="Bigc-Hyper Phitsanulok",
    location_area="Hyper IT Rack Manager Room",
    model="Access Switch IP.23-2"
)
db.add(new_switch)
db.commit()
print("Added switch 10.128.95.23 to database")
db.close()
