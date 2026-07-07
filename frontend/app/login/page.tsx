"use client";
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../globals.css';

export default function LoginPage() {
  const { login, sessionExpiredMsg, clearSessionMsg } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .login-card { animation: fadeIn 0.5s ease; }
        .login-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,130,246,0.5) !important; }
        .login-btn:active { transform: translateY(0); }
        .eye-btn:hover { color: white !important; }
      `}</style>

      <div className="login-card" style={{
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(24px)',
        borderRadius: '24px', padding: '52px 44px', width: '400px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', boxShadow: '0 8px 24px rgba(59,130,246,0.4)'
          }}>🌐</div>
          <h1 style={{ color: 'white', fontSize: '26px', fontWeight: 800, margin: '0 0 6px' }}>Cisco Monitor</h1>
          <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Enterprise Switch Management System</p>
        </div>

        {/* Session Expired Banner */}
        {sessionExpiredMsg && (
          <div style={{
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⏰</span>
              <span style={{ color: '#fcd34d', fontSize: '13px', fontWeight: 600 }}>{sessionExpiredMsg}</span>
            </div>
            <button onClick={clearSessionMsg} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
              USERNAME
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', opacity: 0.5 }}>👤</span>
              <input
                className="login-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="กรอก username"
                required
                autoFocus
                style={{
                  width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px',
                  background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', outline: 'none', fontSize: '15px', boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', opacity: 0.5 }}>🔒</span>
              <input
                className="login-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="กรอก password"
                required
                style={{
                  width: '100%', padding: '13px 48px 13px 42px', borderRadius: '12px',
                  background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', outline: 'none', fontSize: '15px', boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
              {/* Eye Button */}
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: showPassword ? '#3b82f6' : '#64748b',
                  fontSize: '20px', lineHeight: 1, padding: '4px',
                  transition: 'color 0.2s', userSelect: 'none'
                }}
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {/* password hint */}
            {password && (
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '3px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px', transition: 'width 0.3s',
                    width: password.length < 6 ? '25%' : password.length < 10 ? '60%' : '100%',
                    background: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#10b981'
                  }} />
                </div>
                <span style={{ fontSize: '11px', color: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#10b981' }}>
                  {password.length < 6 ? 'อ่อน' : password.length < 10 ? 'ปานกลาง' : 'แข็งแกร่ง'}
                </span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '10px', padding: '12px 16px', color: '#fca5a5', fontSize: '13px',
              marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-btn"
            style={{
              width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
              background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: 'white', fontWeight: 700, fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(59,130,246,0.35)',
              letterSpacing: '0.5px'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>⏳</span> กำลังเข้าสู่ระบบ...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>🔐</span> เข้าสู่ระบบ
              </span>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#334155', fontSize: '11px', margin: 0 }}>
            Cisco Network Monitor v2.0 · Secured Access
          </p>
        </div>
      </div>
    </div>
  );
}
