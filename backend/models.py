from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Boolean, Text, Table
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# Many-to-many: User ↔ Site
user_site_assignments = Table(
    "user_site_assignments",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("site_id", Integer, ForeignKey("sites.id"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String)
    role = Column(String, default="monitor")  # admin | technical | monitor
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=True)  # force change on first login
    created_at = Column(DateTime, default=datetime.utcnow)

    # Sites this user is assigned to (for technical/monitor roles)
    assigned_sites = relationship("Site", secondary=user_site_assignments, back_populates="assigned_users")

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    switches = relationship("Switch", back_populates="site")
    assigned_users = relationship("User", secondary=user_site_assignments, back_populates="assigned_sites")

class Switch(Base):
    __tablename__ = "switches"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, unique=True, index=True)
    username = Column(String)
    password = Column(String)
    hostname = Column(String)
    model = Column(String, default="Cisco Catalyst 2960")
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)
    location_area = Column(String, nullable=True)
    status = Column(String, default="unknown")  # up, down, unknown
    is_active = Column(Boolean, default=True)
    tags = Column(String, nullable=True)  # JSON array of tag strings e.g. '["core","critical"]'
    last_checked = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="switches")
    backups = relationship("ConfigBackup", back_populates="switch")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    switch_id = Column(Integer, ForeignKey("switches.id"))
    switch_ip = Column(String)
    action = Column(String)
    interface = Column(String)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    user = Column(String, default="admin")
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="success")

    switch = relationship("Switch")

class ConfigBackup(Base):
    __tablename__ = "config_backups"

    id = Column(Integer, primary_key=True, index=True)
    switch_id = Column(Integer, ForeignKey("switches.id"))
    config_text = Column(Text)
    backed_up_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    switch = relationship("Switch", back_populates="backups")

class PortStat(Base):
    """Periodic snapshot of port traffic counters (recorded every 5 min)"""
    __tablename__ = "port_stats"

    id = Column(Integer, primary_key=True, index=True)
    switch_id = Column(Integer, ForeignKey("switches.id"), index=True)
    interface = Column(String, index=True)       # e.g. "GigabitEthernet0/1"
    in_bytes = Column(Integer, default=0)        # cumulative input bytes
    out_bytes = Column(Integer, default=0)       # cumulative output bytes
    in_rate_mbps = Column(Integer, default=0)    # input rate in Kbps (from show int)
    out_rate_mbps = Column(Integer, default=0)   # output rate in Kbps
    in_errors = Column(Integer, default=0)
    out_errors = Column(Integer, default=0)
    bandwidth = Column(Integer, default=0)       # interface bandwidth in Kbps
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    switch = relationship("Switch")
