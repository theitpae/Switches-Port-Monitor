"use client";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authHeaders } from './AuthContext';

interface SwitchAlert {
  id: number;
  hostname: string;
  ip: string;
  site: string;
  status: 'down' | 'up';
  changedAt: Date;
  dismissed: boolean;
}

interface AlertContextValue {
  alerts: SwitchAlert[];
  downCount: number;
  dismissAlert: (id: number) => void;
  dismissAll: () => void;
}

const AlertContext = createContext<AlertContextValue>({
  alerts: [],
  downCount: 0,
  dismissAlert: () => {},
  dismissAll: () => {},
});

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<SwitchAlert[]>([]);
  const prevStatusRef = useRef<Record<number, string>>({});
  const toastQueueRef = useRef<{ msg: string; type: 'up' | 'down' }[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'up' | 'down' } | null>(null);

  const showNextToast = useCallback(() => {
    if (toastQueueRef.current.length > 0) {
      const next = toastQueueRef.current.shift()!;
      setToast(next);
      setTimeout(() => { setToast(null); setTimeout(showNextToast, 300); }, 4000);
    }
  }, []);

  const pushToast = useCallback((msg: string, type: 'up' | 'down') => {
    toastQueueRef.current.push({ msg, type });
    if (toastQueueRef.current.length === 1) showNextToast();
  }, [showNextToast]);

  const checkSwitches = useCallback(async () => {
    try {
      const res = await fetch('/api/switches', { headers: authHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const switches: any[] = await res.json();
      if (!Array.isArray(switches)) return;

      const prev = prevStatusRef.current;
      const newPrev: Record<number, string> = {};

      switches.forEach(sw => {
        newPrev[sw.id] = sw.status;
        const prevStatus = prev[sw.id];
        if (prevStatus === undefined) return; // first run, just record

        // Status changed
        if (prevStatus !== sw.status) {
          if (sw.status === 'down') {
            // Switch went down
            pushToast(`⚠️ ${sw.hostname} (${sw.ip_address}) Offline!`, 'down');
            setAlerts(a => [
              { id: sw.id, hostname: sw.hostname, ip: sw.ip_address,
                site: sw.site?.name || '-', status: 'down', changedAt: new Date(), dismissed: false },
              ...a.filter(x => x.id !== sw.id),
            ]);
          } else if (sw.status === 'up' && prevStatus === 'down') {
            // Switch came back up
            pushToast(`✅ ${sw.hostname} (${sw.ip_address}) กลับมา Online แล้ว`, 'up');
            setAlerts(a => a.map(x => x.id === sw.id ? { ...x, status: 'up', dismissed: true } : x));
          }
        }
      });

      prevStatusRef.current = newPrev;
    } catch (_) { /* network error, ignore */ }
  }, [pushToast]);

  // Poll every 30 seconds
  useEffect(() => {
    // Initial run to populate prevStatus (silent)
    const init = async () => {
      try {
        const res = await fetch('/api/switches', { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) return;
        const switches: any[] = await res.json();
        if (!Array.isArray(switches)) return;
        const map: Record<number, string> = {};
        switches.forEach(sw => { map[sw.id] = sw.status; });
        prevStatusRef.current = map;
        // Pre-populate existing down alerts
        const downs = switches.filter(sw => sw.status === 'down');
        if (downs.length > 0) {
          setAlerts(downs.map(sw => ({
            id: sw.id, hostname: sw.hostname, ip: sw.ip_address,
            site: sw.site?.name || '-', status: 'down' as const,
            changedAt: new Date(), dismissed: false
          })));
        }
      } catch (_) {}
    };
    init();
    const interval = setInterval(checkSwitches, 30000);
    return () => clearInterval(interval);
  }, [checkSwitches]);

  const dismissAlert = (id: number) =>
    setAlerts(a => a.map(x => x.id === id ? { ...x, dismissed: true } : x));
  const dismissAll = () =>
    setAlerts(a => a.map(x => ({ ...x, dismissed: true })));

  const activeAlerts = alerts.filter(a => !a.dismissed && a.status === 'down');
  const downCount = activeAlerts.length;

  return (
    <AlertContext.Provider value={{ alerts: activeAlerts, downCount, dismissAlert, dismissAll }}>
      {children}

      {/* Global Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 99999,
          background: toast.type === 'down' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)',
          backdropFilter: 'blur(12px)',
          color: 'white', padding: '14px 20px', borderRadius: '12px',
          boxShadow: `0 8px 32px ${toast.type === 'down' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
          fontSize: '14px', fontWeight: 700, maxWidth: '360px',
          animation: 'slideInRight 0.3s ease',
          border: `1px solid ${toast.type === 'down' ? 'rgba(254,202,202,0.3)' : 'rgba(167,243,208,0.3)'}`,
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </AlertContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertContext);
