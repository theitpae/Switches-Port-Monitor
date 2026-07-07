"use client";
import { useState, useEffect } from 'react';

interface VpnWarningModalProps {
  onDismiss: () => void;
}

// VPN Gateway IPs ที่ใช้งาน (Remote Gateway)
const VPN_GATEWAYS = [
  '110.170.81.240',
  '119.63.94.110',
];

export default function VpnWarningModal({ onDismiss }: VpnWarningModalProps) {
  const [visible, setVisible] = useState(true);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        borderRadius: '20px',
        padding: '36px 40px',
        width: '460px',
        maxWidth: '90vw',
        border: '1px solid rgba(239,68,68,0.4)',
        boxShadow: '0 0 40px rgba(239,68,68,0.2), 0 24px 60px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', flexShrink: 0,
          }}>🔒</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
              ไม่ตรวจพบการเชื่อมต่อ VPN
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Network ภายในอาจเข้าถึงไม่ได้
            </p>
          </div>
        </div>

        {/* Warning message */}
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#fca5a5', lineHeight: 1.6 }}>
            ระบบนี้ต้องเชื่อมต่อ <strong style={{ color: '#ef4444' }}>VPN</strong> เพื่อเข้าถึง Cisco Switch
            ในเครือข่ายภายใน กรุณาเชื่อมต่อ VPN ก่อนใช้งาน
          </p>
        </div>

        {/* VPN Gateway Info */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🌐 Remote Gateway
          </p>
          {VPN_GATEWAYS.map(ip => (
            <div key={ip} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: '6px',
              fontFamily: 'monospace', fontSize: '13px', color: '#93c5fd',
            }}>
              <span style={{ color: '#475569', fontSize: '11px' }}>⬡</span>
              {ip}
              <span style={{ color: '#475569', fontSize: '11px', marginLeft: 'auto' }}>:10443</span>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 วิธีเชื่อมต่อ VPN
          </p>
          {[
            'เปิดโปรแกรม FortiClient VPN',
            'เลือก Remote Gateway และ Log in',
            'รอจนเชื่อมต่อสำเร็จ',
            'Refresh หน้าเว็บนี้',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
                color: '#93c5fd', fontSize: '11px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '20px' }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
              color: 'white', fontWeight: 700, fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            🔄 ลองใหม่หลังต่อ VPN
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '12px 18px', borderRadius: '10px',
              border: '1px solid rgba(100,116,139,0.3)',
              background: 'rgba(100,116,139,0.15)',
              color: '#94a3b8', fontSize: '14px', cursor: 'pointer',
            }}
          >
            ปิด
          </button>
        </div>

        <p style={{ margin: '14px 0 0 0', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
          ยังสามารถใช้งานระบบได้ แต่อาจไม่สามารถเห็น Switch ได้
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
      `}</style>
    </div>
  );
}
