"use client";
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../globals.css';

export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPw !== confirmPw) { setError('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (newPw.length < 8) { setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('cisco_auth') || '{}').token;
      const res = await fetch('/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      // Update localStorage
      const stored = JSON.parse(localStorage.getItem('cisco_auth') || '{}');
      stored.must_change_password = false;
      localStorage.setItem('cisco_auth', JSON.stringify(stored));
      setSuccess(true);
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div style={{ background: 'rgba(30,41,59,0.9)', borderRadius: '20px', padding: '48px 40px', width: '400px', border: '1px solid rgba(255,165,0,0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '48px' }}>🔑</div>
          <h2 style={{ color: 'white', margin: '8px 0 4px' }}>เปลี่ยนรหัสผ่าน</h2>
          <p style={{ color: '#f59e0b', fontSize: '13px', margin: 0 }}>⚠️ กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ</p>
          {user?.full_name && <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>สวัสดี {user.full_name}</p>}
        </div>

        {success ? (
          <div style={{ textAlign: 'center', color: '#10b981', fontSize: '16px', padding: '20px' }}>✅ เปลี่ยนรหัสผ่านสำเร็จ! กำลังเข้าสู่ระบบ...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {[{ label: 'รหัสผ่านเดิม (ที่ได้รับจาก Admin)', val: oldPw, set: setOldPw },
              { label: 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)', val: newPw, set: setNewPw },
              { label: 'ยืนยันรหัสผ่านใหม่', val: confirmPw, set: setConfirmPw }
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '5px' }}>{f.label}</label>
                <input type="password" value={f.val} onChange={e => f.set(e.target.value)} required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            ))}
            {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>⚠️ {error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', marginTop: '4px' }}>
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
            <button type="button" onClick={() => logout()}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13px', marginTop: '8px' }}>
              ออกจากระบบ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
