"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type VpnStatus = 'checking' | 'connected' | 'disconnected' | 'unknown';

interface VpnContextType {
  vpnStatus: VpnStatus;
  checkVpn: () => Promise<void>;
  dismissWarning: () => void;
  showWarning: boolean;
}

const VpnContext = createContext<VpnContextType>({
  vpnStatus: 'unknown',
  checkVpn: async () => {},
  dismissWarning: () => {},
  showWarning: false,
});

// ตรวจ VPN โดยเช็คว่า backend API ตอบสนองและเห็น switch หรือไม่
// ในการใช้งานจริง: ถ้าไม่ได้ต่อ VPN จะ reach internal backend ไม่ได้
async function detectVpnConnection(): Promise<boolean> {
  try {
    // Session key เพื่อไม่ให้ check ซ้ำทุก render
    const token = (() => {
      try { return JSON.parse(localStorage.getItem('cisco_auth') || '{}').token; } catch { return ''; }
    })();
    if (!token) return true; // ยังไม่ login ไม่ต้องเช็ค

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch('/api/switches', {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return false;
    // ถ้า fetch สำเร็จ → network/backend reachable
    return true;
  } catch (err: any) {
    // AbortError = timeout = ไม่สามารถ reach backend
    if (err?.name === 'AbortError') return false;
    // Network error
    return false;
  }
}

export function VpnProvider({ children }: { children: React.ReactNode }) {
  const [vpnStatus, setVpnStatus] = useState<VpnStatus>('unknown');
  const [showWarning, setShowWarning] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkVpn = useCallback(async () => {
    setVpnStatus('checking');
    const connected = await detectVpnConnection();
    setVpnStatus(connected ? 'connected' : 'disconnected');
    if (!connected) {
      setShowWarning(true);
    }
    setChecked(true);
  }, []);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    // เก็บไว้ใน session ว่า dismiss แล้ว ไม่ต้องแสดงซ้ำในการโหลดหน้าถัดไป
    sessionStorage.setItem('cisco_vpn_warned', '1');
  }, []);

  // ตรวจ VPN ทันทีหลัง component mount (หลัง login)
  useEffect(() => {
    const alreadyWarned = sessionStorage.getItem('cisco_vpn_warned');
    const token = (() => {
      try { return JSON.parse(localStorage.getItem('cisco_auth') || '{}').token; } catch { return ''; }
    })();

    if (token && !alreadyWarned && !checked) {
      // หน่วงเล็กน้อยให้หน้าโหลดก่อน
      setTimeout(checkVpn, 1500);
    }
  }, [checkVpn, checked]);

  return (
    <VpnContext.Provider value={{ vpnStatus, checkVpn, dismissWarning, showWarning }}>
      {children}
    </VpnContext.Provider>
  );
}

export const useVpn = () => useContext(VpnContext);
