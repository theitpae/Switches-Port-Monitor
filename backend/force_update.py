import database, models
db = database.SessionLocal()
switch = db.query(models.Switch).first()
if switch:
    switch.ip_address = '10.178.135.23'
    switch.password = 'jupiter12'
    db.commit()
    print("Switch updated forcibly to 10.178.135.23 and jupiter12")
else:
    print("No switch found!")
db.close()
