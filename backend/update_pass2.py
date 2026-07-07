import database, models
db = database.SessionLocal()
switch = db.query(models.Switch).filter_by(ip_address='10.178.135.23').first()
if switch:
    switch.password = 'Jupiter12'
    db.commit()
    print('Password updated successfully')
else:
    print('Switch not found')
db.close()
