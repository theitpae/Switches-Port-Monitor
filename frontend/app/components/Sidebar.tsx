"use client";
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';
import { useVpn } from '../context/VpnContext';
import { useState, useEffect } from 'react';

export default function Sidebar({ active }: { active: string }) {
  const { user, logout, isAdmin, canEdit } = useAuth();
  const { alerts, downCount, dismissAlert, dismissAll } = useAlerts();
  const { theme, toggleTheme, isDark } = useTheme();
  const { vpnStatus, checkVpn, showWarning, dismissWarning } = useVpn();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [sessionRemaining, setSessionRemaining] = useState<string>('');
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Session countdown timer
  useEffect(() => {
    if (!user?.exp) return;
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = user.exp! - now;
      if (remaining <= 0) {
        setSessionRemaining('หมดอายุแล้ว');
        setSessionWarning(true);
        return;
      }
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      if (h > 0) setSessionRemaining(`${h}h ${m}m`);
      else if (m > 0) setSessionRemaining(`${m}m ${s}s`);
      else setSessionRemaining(`${s}s`);
      setSessionWarning(remaining < 300); // warn if < 5 min
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [user?.exp]);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { setPwMsg('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (newPw.length < 8) { setPwMsg('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setPwLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('cisco_auth') || '{}').token;
      const res = await fetch('/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setPwMsg('เปลี่ยนรหัสผ่านสำเร็จ!');
      // Update must_change_password in localStorage
      const stored = JSON.parse(localStorage.getItem('cisco_auth') || '{}');
      stored.must_change_password = false;
      localStorage.setItem('cisco_auth', JSON.stringify(stored));
      setTimeout(() => { setShowPasswordModal(false); setOldPw(''); setNewPw(''); setConfirmPw(''); setPwMsg(''); }, 1500);
    } catch (e: any) {
      setPwMsg(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setPwLoading(false);
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: '👑 Admin System',
    technical: '🔧 Technical Support',
    monitor: '👁 User Monitor',
  };

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button
        className="hamburger-btn"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay (mobile only, when sidebar open) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '32px', width: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '18px' }}>🔑 เปลี่ยนรหัสผ่าน</h3>
            {['old', 'new', 'confirm'].map((type) => (
              <div key={type} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {type === 'old' ? 'รหัสผ่านเดิม' : type === 'new' ? 'รหัสผ่านใหม่ (8+ ตัวอักษร)' : 'ยืนยันรหัสผ่านใหม่'}
                </label>
                <input
                  type="password"
                  value={type === 'old' ? oldPw : type === 'new' ? newPw : confirmPw}
                  onChange={e => type === 'old' ? setOldPw(e.target.value) : type === 'new' ? setNewPw(e.target.value) : setConfirmPw(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {pwMsg && <p style={{ color: pwMsg.includes('สำเร็จ') ? '#10b981' : '#ef4444', fontSize: '13px', margin: '8px 0' }}>{pwMsg}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={handleChangePassword} disabled={pwLoading} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                {pwLoading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setShowPasswordModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.4)', color: 'white', cursor: 'pointer', fontSize: '14px' }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Cisco Monitor</span>
          {/* Alert Bell */}
          {downCount > 0 && (
            <button onClick={() => setShowAlertPanel(p => !p)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative', padding: '4px'
              }}
              title={`${downCount} Switch offline`}>
              <span style={{ fontSize: '18px', animation: 'bellRing 1s ease-in-out infinite' }}>🔔</span>
              <span style={{
                position: 'absolute', top: 0, right: 0,
                background: '#ef4444', color: 'white',
                borderRadius: '50%', width: '16px', height: '16px',
                fontSize: '10px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pulse 1s ease-in-out infinite',
              }}>{downCount}</span>
            </button>
          )}
        </div>

        {/* Alert Panel */}
        {showAlertPanel && downCount > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)',
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 700 }}>⚠️ Switch Offline ({downCount})</span>
              <button onClick={dismissAll}
                style={{ fontSize: '10px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>ปิดทั้งหมด</button>
            </div>
            {alerts.map(a => (
              <div key={a.id} style={{
                background: 'rgba(239,68,68,0.12)', borderRadius: '6px',
                padding: '6px 8px', marginBottom: '4px',
                border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5' }}>{a.hostname}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{a.ip} · {a.site}</div>
                </div>
                <button onClick={() => dismissAlert(a.id)}
                  style={{ fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <nav style={{ flex: 1 }}>
          <a href="/" className={`nav-link${active === '/' ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>📊 Dashboard</span>
            {downCount > 0 && (
              <span style={{
                background: '#ef4444', color: 'white', borderRadius: '10px',
                padding: '1px 7px', fontSize: '10px', fontWeight: 800,
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>{downCount} down</span>
            )}
          </a>
          <a href="/ports" className={`nav-link${active === '/ports' ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>🔌 Switches &amp; Ports</a>
          <a href="/map" className={`nav-link${active === '/map' ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>🗺️ Network Map</a>
          {canEdit() && <a href="/audit" className={`nav-link${active === '/audit' ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>📋 Audit Logs</a>}
          {canEdit() && <a href="/report" className={`nav-link${active === '/report' ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>📊 Summary Report</a>}
          {(isAdmin() || user?.role === 'technical') && <a href="/admin" className={`nav-link${active === '/admin' ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>⚙️ Admin Settings</a>}
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{ROLE_LABELS[user?.role || ''] || user?.role}</div>
          <div style={{ fontSize: '13px', color: 'white', fontWeight: 600, marginBottom: '8px' }}>{user?.full_name || user?.username}</div>

          {/* Session expiry info */}
          {sessionRemaining && (
            <div style={{
              fontSize: '11px', marginBottom: '10px', padding: '6px 10px', borderRadius: '6px',
              background: sessionWarning ? 'rgba(239,68,68,0.15)' : 'rgba(15,23,42,0.6)',
              border: `1px solid ${sessionWarning ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)'}`,
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span>{sessionWarning ? '⚠️' : '⏱️'}</span>
              <span style={{ color: sessionWarning ? '#fca5a5' : '#64748b' }}>Session: </span>
              <span style={{ color: sessionWarning ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>{sessionRemaining}</span>
            </div>
          )}

          {/* VPN Status Badge */}
          <div
            onClick={() => checkVpn()}
            title="คลิกเพื่อตรวจสอบ VPN ใหม่"
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '6px 10px', borderRadius: '6px', marginBottom: '8px',
              cursor: 'pointer',
              background: vpnStatus === 'connected' ? 'rgba(16,185,129,0.1)'
                        : vpnStatus === 'disconnected' ? 'rgba(239,68,68,0.12)'
                        : 'rgba(15,23,42,0.5)',
              border: `1px solid ${
                vpnStatus === 'connected' ? 'rgba(16,185,129,0.3)'
                : vpnStatus === 'disconnected' ? 'rgba(239,68,68,0.3)'
                : 'rgba(255,255,255,0.06)'
              }`,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '13px' }}>
              {vpnStatus === 'connected' ? '🟢'
               : vpnStatus === 'disconnected' ? '🔴'
               : vpnStatus === 'checking' ? '🟡'
               : '⚪'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>VPN</div>
              <div style={{
                fontSize: '11px', fontWeight: 700,
                color: vpnStatus === 'connected' ? '#34d399'
                      : vpnStatus === 'disconnected' ? '#f87171'
                      : '#64748b',
              }}>
                {vpnStatus === 'connected' ? 'Connected'
                 : vpnStatus === 'disconnected' ? 'ไม่ได้เชื่อมต่อ'
                 : vpnStatus === 'checking' ? 'กำลังตรวจสอบ...'
                 : 'ไม่ทราบสถานะ'}
              </div>
            </div>
            <span style={{ fontSize: '10px', color: '#475569' }}>↻</span>
          </div>

          <button onClick={() => setShowPasswordModal(true)} style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '6px', borderRadius: '6px', border: 'none', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>
            🔑 เปลี่ยนรหัสผ่าน
          </button>

          {/* Dark/Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '8px', marginBottom: '6px',
              borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '12px', textAlign: 'left', fontWeight: 600,
              background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(100,116,139,0.2)',
              color: isDark ? '#fcd34d' : '#475569',
              transition: 'all 0.3s ease',
            }}
          >
            <span style={{ fontSize: '16px', transition: 'transform 0.4s ease', display: 'inline-block', transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
              {isDark ? '☀️' : '🌙'}
            </span>
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button onClick={() => logout()} style={{ display: 'block', width: '100%', padding: '8px', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>
            🚪 ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
}
