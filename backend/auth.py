from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, schemas, database
import secrets
import string
import bcrypt

SECRET_KEY = "cisco_monitor_secret_key_2025_change_in_prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ─── Password Utils ────────────────────────────────────────────────────────────

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def get_password_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def generate_random_password(length: int = 12) -> str:
    """Generate a secure random password with upper, lower, digits"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        # Ensure it has at least one of each type
        if (any(c.isupper() for c in password) and
            any(c.islower() for c in password) and
            any(c.isdigit() for c in password)):
            return password

# ─── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ─── User Helpers ──────────────────────────────────────────────────────────────

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token ไม่ถูกต้องหรือหมดอายุ กรุณา Login ใหม่",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_username(db, username=username)
    if user is None or not user.is_active:
        raise credentials_exception
    return user

# ─── Role Guards ───────────────────────────────────────────────────────────────

async def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องการสิทธิ์ Admin เท่านั้น"
        )
    return current_user

async def require_admin_or_technical(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "technical"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องการสิทธิ์ Admin หรือ Technical Support"
        )
    return current_user

def get_accessible_switch_ids(user: models.User, db: Session) -> Optional[list]:
    """Returns None if admin (all access), or list of switch IDs for technical/monitor"""
    if user.role == "admin":
        return None  # all
    site_ids = [s.id for s in user.assigned_sites]
    if not site_ids:
        return []
    switches = db.query(models.Switch).filter(models.Switch.site_id.in_(site_ids)).all()
    return [s.id for s in switches]
