from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import asyncio
import socket
import csv
import io
import uuid
import models, schemas, auth, database
import json
from cisco_integration import (
    get_switch_connection, fetch_port_status, fetch_vlans,
    assign_port_to_vlan, set_port_description, shutdown_port,
    enable_port, save_running_config
)

# ─── Background Health Check ───────────────────────────────────────────────────

HEALTH_CHECK_INTERVAL = 300  # 5 minutes

def ping_host(ip: str, timeout: int = 3) -> bool:
    """Simple TCP ping on port 22 (SSH)"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, 22))
        sock.close()
        return result == 0
    except Exception:
        return False

async def health_check_loop():
    """Background task: ping all switches every 5 minutes"""
    await asyncio.sleep(10)  # wait for app to fully start
    while True:
        try:
            db = database.SessionLocal()
            switches = db.query(models.Switch).filter(models.Switch.is_active == True).all()
            for sw in switches:
                is_up = await asyncio.get_event_loop().run_in_executor(None, ping_host, sw.ip_address)
                sw.status = "up" if is_up else "down"
                sw.last_checked = datetime.utcnow()
            db.commit()
            db.close()
        except Exception as e:
            print(f"[HealthCheck] Error: {e}")
        await asyncio.sleep(HEALTH_CHECK_INTERVAL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(health_check_loop())
    yield
    task.cancel()

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Cisco Switch Monitoring API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── เพิ่มหน้าแรก (Root Path) แก้ปัญหา Not Found ──────────────────────────────────
@app.get("/")
def read_root():
    return {
        "message": "Welcome to Cisco Switch Monitoring API",
        "docs_url": "/docs",
        "health_check": "/health"
    }

# ─── Session Store (in-memory) ────────────────────────────────────────────────
active_sessions: dict[str, dict] = {}

def _get_user_from_request(request: Request, token_param: str, db) -> models.User:
    """Resolve user from Authorization header or ?token= query param."""
    from jose import jwt as jose_jwt, JWTError
    bearer_token = token_param
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer_token = auth_header.split(" ", 1)[1]
    if not bearer_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jose_jwt.decode(bearer_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Not authenticated")
        user = auth.get_user_by_username(db, username)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token ไม่ถูกต้องหรือหมดอายุ")

# ─── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = auth.get_user_by_username(db, form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Username หรือ Password ไม่ถูกต้อง")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อ Admin")
    jti = str(uuid.uuid4())
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role, "jti": jti})
    # Track session
    active_sessions[jti] = {
        "jti": jti,
        "username": user.username,
        "full_name": user.full_name or user.username,
        "role": user.role,
        "login_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(hours=auth.ACCESS_TOKEN_EXPIRE_HOURS)).isoformat(),
    }
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "must_change_password": user.must_change_password,
        "full_name": user.full_name,
        "user_id": user.id,
    }

@app.get("/auth/me", response_model=schemas.User)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/auth/sessions")
def get_sessions(current_user: models.User = Depends(auth.require_admin)):
    """List all active sessions (admin only)"""
    from jose import jwt as jose_jwt
    now = datetime.utcnow()
    valid = []
    expired_jtis = []
    for jti, sess in active_sessions.items():
        exp = datetime.fromisoformat(sess["expires_at"])
        if exp < now:
            expired_jtis.append(jti)
        else:
            valid.append({**sess, "expires_in_minutes": int((exp - now).total_seconds() / 60)})
    # Clean up expired
    for jti in expired_jtis:
        active_sessions.pop(jti, None)
    return sorted(valid, key=lambda x: x["login_at"], reverse=True)

@app.delete("/auth/sessions/{jti}")
def revoke_session(jti: str, current_user: models.User = Depends(auth.require_admin)):
    """Revoke a specific session (admin only)"""
    if jti not in active_sessions:
        raise HTTPException(status_code=404, detail="Session ไม่พบ")
    active_sessions.pop(jti)
    return {"message": "Session ถูกยกเลิกแล้ว"}

@app.delete("/auth/sessions")
def revoke_all_sessions(current_user: models.User = Depends(auth.require_admin)):
    """Revoke ALL sessions except current admin (admin only)"""
    active_sessions.clear()
    return {"message": "ยกเลิก session ทั้งหมดแล้ว"}

@app.put("/auth/change-password")
def change_password(
    body: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not auth.verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="รหัสผ่านเดิมไม่ถูกต้อง")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
    current_user.hashed_password = auth.get_password_hash(body.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "เปลี่ยนรหัสผ่านสำเร็จ"}

# ─── Sites (Admin only) ────────────────────────────────────────────────────────

@app.get("/api/sites", response_model=list[schemas.Site])
def get_sites(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    if current_user.role == "admin":
        return db.query(models.Site).all()
    # technical/monitor see only their assigned sites
    return current_user.assigned_sites

@app.post("/api/sites", response_model=schemas.Site)
def create_site(site: schemas.SiteCreate, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    existing = db.query(models.Site).filter(models.Site.name == site.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="ชื่อ Site นี้มีอยู่แล้ว")
    db_site = models.Site(**site.dict())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

@app.put("/api/sites/{site_id}", response_model=schemas.Site)
def update_site(site_id: int, site: schemas.SiteCreate, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(status_code=404, detail="ไม่พบ Site")
    db_site.name = site.name
    db_site.description = site.description
    db.commit()
    db.refresh(db_site)
    return db_site

@app.delete("/api/sites/{site_id}")
def delete_site(site_id: int, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(status_code=404, detail="ไม่พบ Site")
    db.delete(db_site)
    db.commit()
    return {"message": "ลบ Site สำเร็จ"}

# ─── Users (Admin only) ────────────────────────────────────────────────────────

@app.get("/api/users", response_model=list[schemas.User])
def get_users(_=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    return db.query(models.User).all()

@app.post("/api/users")
def create_user(user: schemas.UserCreate, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    existing = auth.get_user_by_username(db, user.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username นี้มีอยู่แล้ว")
    raw_password = auth.generate_random_password()
    db_user = models.User(
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        hashed_password=auth.get_password_hash(raw_password),
        must_change_password=True,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {
        "id": db_user.id,
        "username": db_user.username,
        "role": db_user.role,
        "generated_password": raw_password,  # Admin must copy and share this
        "message": "สร้าง User สำเร็จ กรุณาแจ้ง Password นี้ให้ผู้ใช้"
    }

@app.put("/api/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserUpdate, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")
    for key, value in user.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, current_user: models.User = Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถลบตัวเองได้")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")
    db.delete(db_user)
    db.commit()
    return {"message": "ลบ User สำเร็จ"}

@app.post("/api/users/{user_id}/reset-password")
def reset_password(user_id: int, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")
    raw_password = auth.generate_random_password()
    db_user.hashed_password = auth.get_password_hash(raw_password)
    db_user.must_change_password = True
    db.commit()
    return {
        "message": f"Reset Password ของ {db_user.username} สำเร็จ",
        "generated_password": raw_password
    }

@app.put("/api/users/{user_id}/assign-sites")
def assign_sites(user_id: int, body: schemas.AssignSitesRequest, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="ไม่พบ User")
    sites = db.query(models.Site).filter(models.Site.id.in_(body.site_ids)).all()
    db_user.assigned_sites = sites
    db.commit()
    return {"message": f"Assign {len(sites)} Site(s) ให้ {db_user.username} สำเร็จ"}

# ─── Switches ──────────────────────────────────────────────────────────────────

@app.get("/api/switches")
def get_switches(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    if current_user.role == "admin":
        switches = db.query(models.Switch).all()
    else:
        site_ids = [s.id for s in current_user.assigned_sites]
        switches = db.query(models.Switch).filter(models.Switch.site_id.in_(site_ids)).all()
    result = []
    for sw in switches:
        d = {c.name: getattr(sw, c.name) for c in sw.__table__.columns}
        try:
            d['tags'] = json.loads(sw.tags) if sw.tags else []
        except Exception:
            d['tags'] = []
        d['site'] = {'id': sw.site.id, 'name': sw.site.name} if sw.site_id and sw.site else None
        result.append(d)
    return result

@app.post("/api/switches")
def create_switch(switch: schemas.SwitchCreate, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    if current_user.role == "technical" and switch.site_id:
        allowed_site_ids = [s.id for s in current_user.assigned_sites]
        if switch.site_id not in allowed_site_ids:
            raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เพิ่ม Switch ใน Site นี้")
    sw_data = switch.dict()
    tags_list = sw_data.pop('tags', []) or []
    db_switch = models.Switch(**sw_data)
    db_switch.tags = json.dumps(tags_list, ensure_ascii=False)
    db.add(db_switch)
    db.commit()
    db.refresh(db_switch)
    result = {c.name: getattr(db_switch, c.name) for c in db_switch.__table__.columns}
    result['tags'] = tags_list
    result['site'] = None
    return result

@app.put("/api/switches/{switch_id}")
def update_switch(switch_id: int, switch: schemas.SwitchUpdate, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = db.query(models.Switch).filter(models.Switch.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="ไม่พบ Switch")
    if current_user.role == "technical":
        allowed_site_ids = [s.id for s in current_user.assigned_sites]
        if db_switch.site_id not in allowed_site_ids:
            raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์แก้ไข Switch นี้")
    sw_data = switch.dict(exclude_unset=True)
    if 'tags' in sw_data:
        tags_list = sw_data.pop('tags') or []
        db_switch.tags = json.dumps(tags_list, ensure_ascii=False)
    for key, value in sw_data.items():
        setattr(db_switch, key, value)
    db.commit()
    db.refresh(db_switch)
    result = {c.name: getattr(db_switch, c.name) for c in db_switch.__table__.columns}
    try:
        result['tags'] = json.loads(db_switch.tags) if db_switch.tags else []
    except Exception:
        result['tags'] = []
    result['site'] = {'id': db_switch.site.id, 'name': db_switch.site.name} if db_switch.site_id and db_switch.site else None
    return result

@app.delete("/api/switches/{switch_id}")
def delete_switch(switch_id: int, _=Depends(auth.require_admin), db: Session = Depends(database.get_db)):
    db_switch = db.query(models.Switch).filter(models.Switch.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="ไม่พบ Switch")
    db.delete(db_switch)
    db.commit()
    return {"message": f"ลบ Switch สำเร็จ"}

@app.get("/api/tags")
def get_all_tags(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Return sorted list of all unique tags used across switches"""
    switches = db.query(models.Switch.tags).filter(models.Switch.tags != None).all()
    all_tags = set()
    for (tags_str,) in switches:
        try:
            tags = json.loads(tags_str) if tags_str else []
            all_tags.update(t.strip() for t in tags if t.strip())
        except Exception:
            pass
    return sorted(all_tags)

# ─── Live Data ─────────────────────────────────────────────────────────────────

def _check_switch_access(switch_id: int, user: models.User, db: Session) -> models.Switch:
    db_switch = db.query(models.Switch).filter(models.Switch.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="ไม่พบ Switch")
    if user.role != "admin":
        allowed_site_ids = [s.id for s in user.assigned_sites]
        if db_switch.site_id not in allowed_site_ids:
            raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง Switch นี้")
    return db_switch

@app.get("/api/switches/{switch_id}/live-ports")
def get_live_ports(switch_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        ports = fetch_port_status(net_connect)
        net_connect.disconnect()
        db_switch.status = "up"
        db_switch.last_checked = datetime.utcnow()
        db.commit()
        # Record port stats snapshot for charting
        try:
            _record_port_stats(switch_id, db, ports)
        except Exception:
            pass  # Don't fail the main request if stats recording fails
        return ports
    except Exception as e:
        db_switch.status = "down"
        db_switch.last_checked = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"เชื่อมต่อ Switch ไม่ได้: {str(e)}")


@app.get("/api/switches/{switch_id}/live-vlans")
def get_live_vlans(switch_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        vlans = fetch_vlans(net_connect)
        net_connect.disconnect()
        return vlans
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เชื่อมต่อ Switch ไม่ได้: {str(e)}")

# ─── Port Actions (Admin + Technical only) ─────────────────────────────────────

@app.post("/api/switches/{switch_id}/ping")
def manual_ping(switch_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Manual ping a switch via TCP on port 22 — returns latency in ms"""
    import time
    db_switch = db.query(models.Switch).filter(models.Switch.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="ไม่พบ Switch")
    ip = db_switch.ip_address
    results = []
    count = 3  # ping 3 times
    for _ in range(count):
        try:
            t0 = time.monotonic()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            result = sock.connect_ex((ip, 22))
            elapsed = (time.monotonic() - t0) * 1000  # ms
            sock.close()
            if result == 0:
                results.append(round(elapsed, 1))
            else:
                results.append(None)
        except Exception:
            results.append(None)

    success_results = [r for r in results if r is not None]
    is_up = len(success_results) > 0
    avg_ms = round(sum(success_results) / len(success_results), 1) if success_results else None
    min_ms = min(success_results) if success_results else None
    max_ms = max(success_results) if success_results else None

    # Update switch status in DB
    db_switch.status = "up" if is_up else "down"
    db_switch.last_checked = datetime.utcnow()
    db.commit()

    return {
        "ip": ip,
        "hostname": db_switch.hostname,
        "reachable": is_up,
        "results_ms": results,
        "avg_ms": avg_ms,
        "min_ms": min_ms,
        "max_ms": max_ms,
        "loss_pct": round((results.count(None) / count) * 100),
    }

def _log_action(db, switch_id, switch_ip, action, interface, old_value, new_value, user="admin", status="success"):
    log = models.AuditLog(switch_id=switch_id, switch_ip=switch_ip, action=action,
        interface=interface, old_value=old_value, new_value=new_value, user=user, status=status)
    db.add(log)
    db.commit()

@app.put("/api/switches/{switch_id}/port-description")
def set_description(switch_id: int, body: schemas.SetDescriptionRequest, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        result = set_port_description(net_connect, body.interface, body.description)
        save_running_config(net_connect)
        net_connect.disconnect()
        _log_action(db, switch_id, db_switch.ip_address, "set_description", body.interface, None, body.description, user=current_user.username)
        return {"success": True, "message": f"บันทึก Description ของ {body.interface} สำเร็จ"}
    except Exception as e:
        _log_action(db, switch_id, db_switch.ip_address, "set_description", body.interface, None, body.description, user=current_user.username, status="failed")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

@app.put("/api/switches/{switch_id}/port-vlan")
def set_vlan(switch_id: int, body: schemas.SetVlanRequest, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        result = assign_port_to_vlan(net_connect, body.interface, body.vlan_id)
        save_running_config(net_connect)
        net_connect.disconnect()
        _log_action(db, switch_id, db_switch.ip_address, "set_vlan", body.interface, None, str(body.vlan_id), user=current_user.username)
        if str(body.vlan_id).lower() == "trunk":
            return {"success": True, "message": f"เปลี่ยน {body.interface} เป็น Trunk สำเร็จ"}
        return {"success": True, "message": f"เปลี่ยน VLAN {body.vlan_id} ที่ {body.interface} สำเร็จ"}
    except Exception as e:
        _log_action(db, switch_id, db_switch.ip_address, "set_vlan", body.interface, None, body.vlan_id, user=current_user.username, status="failed")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

@app.post("/api/switches/{switch_id}/port-shutdown")
def port_shutdown(switch_id: int, body: schemas.PortActionRequest, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        result = shutdown_port(net_connect, body.interface)
        save_running_config(net_connect)
        net_connect.disconnect()
        _log_action(db, switch_id, db_switch.ip_address, "shutdown", body.interface, "up", "down", user=current_user.username)
        return {"success": True, "message": f"Shutdown {body.interface} สำเร็จ"}
    except Exception as e:
        _log_action(db, switch_id, db_switch.ip_address, "shutdown", body.interface, None, None, user=current_user.username, status="failed")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

@app.post("/api/switches/{switch_id}/port-enable")
def port_enable(switch_id: int, body: schemas.PortActionRequest, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        result = enable_port(net_connect, body.interface)
        save_running_config(net_connect)
        net_connect.disconnect()
        _log_action(db, switch_id, db_switch.ip_address, "enable", body.interface, "down", "up", user=current_user.username)
        return {"success": True, "message": f"Enable {body.interface} สำเร็จ"}
    except Exception as e:
        _log_action(db, switch_id, db_switch.ip_address, "enable", body.interface, None, None, user=current_user.username, status="failed")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

# ─── Audit Logs ────────────────────────────────────────────────────────────────

@app.get("/api/audit-logs")
def get_audit_logs(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    switch_ip: str = None,
    action: str = None,
    status: str = None,
    user: str = None,
    search: str = None,
    current_user: models.User = Depends(auth.require_admin_or_technical),
    db: Session = Depends(database.get_db)
):
    from fastapi.responses import JSONResponse
    query = db.query(models.AuditLog)
    if switch_ip:
        query = query.filter(models.AuditLog.switch_ip == switch_ip)
    if action:
        query = query.filter(models.AuditLog.action == action)
    if status:
        query = query.filter(models.AuditLog.status == status)
    if user:
        query = query.filter(models.AuditLog.user.ilike(f"%{user}%"))
    if search:
        query = query.filter(
            models.AuditLog.switch_ip.ilike(f"%{search}%") |
            models.AuditLog.interface.ilike(f"%{search}%") |
            models.AuditLog.new_value.ilike(f"%{search}%") |
            models.AuditLog.old_value.ilike(f"%{search}%") |
            models.AuditLog.user.ilike(f"%{search}%")
        )
    total = query.count()
    logs = query.order_by(models.AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    # Serialize manually (pydantic model list can't set headers)
    result = [
        {
            "id": l.id, "switch_id": l.switch_id, "switch_ip": l.switch_ip,
            "interface": l.interface, "action": l.action,
            "old_value": l.old_value, "new_value": l.new_value,
            "user": l.user, "status": l.status,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        } for l in logs
    ]
    response = JSONResponse(content=result)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
    return response

@app.get("/api/audit-logs/switch/{switch_id}", response_model=list[schemas.AuditLog])
def get_audit_logs_by_switch(switch_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    return db.query(models.AuditLog).filter(models.AuditLog.switch_id == switch_id).order_by(models.AuditLog.timestamp.desc()).limit(100).all()

# ─── Export CSV ────────────────────────────────────────────────────────────────

@app.get("/api/audit-logs/export-csv")
def export_audit_csv(
    request: Request,
    token: str = None,
    db: Session = Depends(database.get_db)
):
    """Export audit logs as CSV — respects same filters as GET /api/audit-logs"""
    current_user = _get_user_from_request(request, token, db)
    if current_user.role not in ("admin", "technical"):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์")
    switch_ip = request.query_params.get("switch_ip")
    action    = request.query_params.get("action")
    fstatus   = request.query_params.get("status")
    user_q    = request.query_params.get("user")
    search    = request.query_params.get("search")
    query = db.query(models.AuditLog)
    if switch_ip: query = query.filter(models.AuditLog.switch_ip == switch_ip)
    if action:    query = query.filter(models.AuditLog.action == action)
    if fstatus:   query = query.filter(models.AuditLog.status == fstatus)
    if user_q:    query = query.filter(models.AuditLog.user.ilike(f"%{user_q}%"))
    if search:
        query = query.filter(
            models.AuditLog.switch_ip.ilike(f"%{search}%") |
            models.AuditLog.interface.ilike(f"%{search}%") |
            models.AuditLog.new_value.ilike(f"%{search}%") |
            models.AuditLog.old_value.ilike(f"%{search}%") |
            models.AuditLog.user.ilike(f"%{search}%")
        )
    logs = query.order_by(models.AuditLog.timestamp.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp", "Switch IP", "Interface", "Action", "Old Value", "New Value", "User", "Status"])
    for log in logs:
        writer.writerow([
            log.id,
            log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "",
            log.switch_ip or "",
            log.interface or "",
            log.action or "",
            log.old_value or "",
            log.new_value or "",
            log.user or "",
            log.status or "",
        ])
    output.seek(0)
    filename = f"audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/switches/{switch_id}/ports-export-csv")
def export_ports_csv(
    switch_id: int,
    request: Request,
    token: str = None,
    db: Session = Depends(database.get_db)
):
    """Export live port status as CSV (supports ?token= query param)"""
    current_user = _get_user_from_request(request, token, db)
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        ports = fetch_port_status(net_connect)
        net_connect.disconnect()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เชื่อมต่อ Switch ไม่ได้: {str(e)}")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Interface", "Name/Description", "Status", "VLAN", "Duplex", "Speed", "Type"])
    for port in ports:
        writer.writerow([
            port.get("interface", ""),
            port.get("name", ""),
            port.get("status", ""),
            port.get("vlan", ""),
            port.get("duplex", ""),
            port.get("speed", ""),
            port.get("type", ""),
        ])
    output.seek(0)
    filename = f"{db_switch.hostname}_ports_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ─── Config Backup ─────────────────────────────────────────────────────────────

@app.post("/api/switches/{switch_id}/save-config")
def save_config_manual(switch_id: int, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    """Manually trigger write memory on the switch"""
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        result = save_running_config(net_connect)
        net_connect.disconnect()
        _log_action(db, switch_id, db_switch.ip_address, "write_memory", None, None, "manual save", user=current_user.username)
        return {"success": True, "message": f"บันทึก Config ของ {db_switch.hostname} สำเร็จ (write memory)"}
    except Exception as e:
        _log_action(db, switch_id, db_switch.ip_address, "write_memory", None, None, "manual save", user=current_user.username, status="failed")
        raise HTTPException(status_code=500, detail=f"Save Config ไม่สำเร็จ: {str(e)}")

@app.post("/api/switches/{switch_id}/backup-config")
def backup_config(switch_id: int, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    """Fetch and store running-config in DB"""
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        config = net_connect.send_command("show running-config")
        net_connect.disconnect()

        backup = models.ConfigBackup(
            switch_id=switch_id,
            config_text=config,
            backed_up_by=current_user.username,
            created_at=datetime.utcnow()
        )
        db.add(backup)
        db.commit()
        db.refresh(backup)
        return {"success": True, "backup_id": backup.id, "lines": len(config.splitlines())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup ไม่สำเร็จ: {str(e)}")

@app.get("/api/switches/{switch_id}/backups")
def list_backups(switch_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    _check_switch_access(switch_id, current_user, db)
    backups = db.query(models.ConfigBackup).filter(models.ConfigBackup.switch_id == switch_id).order_by(models.ConfigBackup.created_at.desc()).limit(20).all()
    return [{"id": b.id, "created_at": b.created_at.isoformat(), "backed_up_by": b.backed_up_by, "lines": len(b.config_text.splitlines())} for b in backups]

@app.get("/api/backups/{backup_id}/download")
def download_backup(
    backup_id: int,
    request: Request,
    token: str = None,
    db: Session = Depends(database.get_db)
):
    """Download config backup - supports Bearer header and ?token= query param"""
    from jose import JWTError, jwt as jose_jwt

    # Try Authorization header first
    current_user = None
    auth_header = request.headers.get("Authorization", "")
    bearer_token = token  # fallback to query param

    if auth_header.startswith("Bearer "):
        bearer_token = auth_header.split(" ", 1)[1]

    if bearer_token:
        try:
            payload = jose_jwt.decode(bearer_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            username = payload.get("sub")
            if username:
                current_user = auth.get_user_by_username(db, username)
        except Exception:
            pass

    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    backup = db.query(models.ConfigBackup).filter(models.ConfigBackup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    filename = f"config_backup_{backup_id}_{backup.created_at.strftime('%Y%m%d_%H%M%S')}.txt"
    return StreamingResponse(
        iter([backup.config_text]),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Multi-port Actions ────────────────────────────────────────────────────────

@app.post("/api/switches/{switch_id}/bulk-shutdown")
def bulk_shutdown(switch_id: int, body: schemas.BulkPortActionRequest, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        results = []
        for iface in body.interfaces:
            try:
                shutdown_port(net_connect, iface)
                _log_action(db, switch_id, db_switch.ip_address, "shutdown", iface, None, "shutdown", user=current_user.username)
                results.append({"interface": iface, "success": True})
            except Exception as e:
                results.append({"interface": iface, "success": False, "error": str(e)})
        save_running_config(net_connect)
        net_connect.disconnect()
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/switches/{switch_id}/bulk-enable")
def bulk_enable(switch_id: int, body: schemas.BulkPortActionRequest, current_user: models.User = Depends(auth.require_admin_or_technical), db: Session = Depends(database.get_db)):
    db_switch = _check_switch_access(switch_id, current_user, db)
    try:
        net_connect = get_switch_connection(db_switch.ip_address, db_switch.username, db_switch.password)
        results = []
        for iface in body.interfaces:
            try:
                enable_port(net_connect, iface)
                _log_action(db, switch_id, db_switch.ip_address, "enable", iface, None, "enable", user=current_user.username)
                results.append({"interface": iface, "success": True})
            except Exception as e:
                results.append({"interface": iface, "success": False, "error": str(e)})
        save_running_config(net_connect)
        net_connect.disconnect()
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok"}

# ─── Port Stats ────────────────────────────────────────────────────────────────

def _parse_port_stats_from_live(ports: list) -> list:
    """Extract traffic stats from live port data for recording"""
    results = []
    for p in ports:
        try:
            results.append({
                "interface": p.get("interface", ""),
                "in_bytes": int(p.get("input_bytes", 0) or 0),
                "out_bytes": int(p.get("output_bytes", 0) or 0),
                "in_rate_mbps": int(p.get("input_rate", 0) or 0),
                "out_rate_mbps": int(p.get("output_rate", 0) or 0),
                "in_errors": int(p.get("input_errors", 0) or 0),
                "out_errors": int(p.get("output_errors", 0) or 0),
                "bandwidth": int(p.get("bandwidth", 0) or 0),
            })
        except Exception:
            pass
    return results

def _record_port_stats(switch_id: int, db: Session, ports: list):
    """Save port stat snapshots to DB"""
    try:
        now = datetime.utcnow()
        stats = _parse_port_stats_from_live(ports)
        for s in stats:
            if not s["interface"]:
                continue
            stat = models.PortStat(
                switch_id=switch_id,
                interface=s["interface"],
                in_bytes=s["in_bytes"],
                out_bytes=s["out_bytes"],
                in_rate_mbps=s["in_rate_mbps"],
                out_rate_mbps=s["out_rate_mbps"],
                in_errors=s["in_errors"],
                out_errors=s["out_errors"],
                bandwidth=s["bandwidth"],
                recorded_at=now,
            )
            db.add(stat)
        db.commit()
    except Exception:
        db.rollback()

@app.get("/api/switches/{switch_id}/port-stats")
def get_port_stats(
    switch_id: int,
    interface: str = None,
    hours: int = 24,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Return port stat history for charting. Filter by interface and time range."""
    _check_switch_access(switch_id, current_user, db)
    since = datetime.utcnow() - timedelta(hours=hours)
    q = db.query(models.PortStat).filter(
        models.PortStat.switch_id == switch_id,
        models.PortStat.recorded_at >= since
    )
    if interface:
        q = q.filter(models.PortStat.interface == interface)
    stats = q.order_by(models.PortStat.recorded_at.asc()).all()
    return [
        {
            "interface": s.interface,
            "in_rate_mbps": s.in_rate_mbps,
            "out_rate_mbps": s.out_rate_mbps,
            "in_bytes": s.in_bytes,
            "out_bytes": s.out_bytes,
            "in_errors": s.in_errors,
            "out_errors": s.out_errors,
            "bandwidth": s.bandwidth,
            "recorded_at": s.recorded_at.isoformat(),
        }
        for s in stats
    ]

@app.get("/api/switches/{switch_id}/port-stats/interfaces")
def get_port_stat_interfaces(
    switch_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Return list of interfaces that have recorded stats for this switch"""
    _check_switch_access(switch_id, current_user, db)
    rows = db.query(models.PortStat.interface).filter(
        models.PortStat.switch_id == switch_id
    ).distinct().all()
    return sorted([r[0] for r in rows])
