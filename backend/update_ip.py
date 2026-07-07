import database, models
db = database.SessionLocal()
switch = db.query(models.Switch).filter_by(ip_address='172.17.32.221').first()
if switch:
    switch.ip_address = '10.178.135.23'
    db.commit()
    print('IP updated to 10.178.135.23')
else:
    print('Switch not found')
db.close()
